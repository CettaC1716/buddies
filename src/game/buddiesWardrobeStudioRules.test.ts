import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_NEUTRAL_BODY_SHAPE,
  EMPTY_WARDROBE_DRAFT,
  WARDROBE_STUDIO_ITEMS,
  applyItemSelectionToDraft,
  classifyDefaultAvatarSlotFromMeshName,
  collectUnownedItemsInDraft,
  createSavedPresetFromDraft,
  createWardrobeHistory,
  getVisibleBuiltInWardrobePresets,
  getWardrobeCatalogItemById,
  partitionWardrobeCategoryItems,
  purchaseWardrobeCatalogItem,
  pushWardrobeDraft,
  redoWardrobeDraft,
  resolveWardrobeDraftAnimStyle,
  resolveWardrobeDraftBodyShape,
  resolveWardrobeDraftFaceCustomization,
  resolveWardrobeDraftToModularOutfitUrls,
  resolveWardrobeGlassSurfaceMode,
  sanitizeDraftToOwnedOnly,
  undoWardrobeDraft,
} from './buddiesWardrobeStudioRules';
import { getBlitzFaceUvCalibration } from './buddiesFaceCompositor';
import {
  WARDROBE_SERVER_CATALOG,
  handleWardrobePurchaseRequest,
  signWardrobeEntitlementReceipt,
} from '../../api/wardrobe-purchase';

test('partitionWardrobeCategoryItems cleanly separates Owned defaults & bought items from Locked Shop items per gender', () => {
  const femaleTop = partitionWardrobeCategoryItems('top', [], 'all', 'featured', 'female');
  assert.equal(femaleTop.owned.length, 1, 'Starter tee is owned by default');
  assert.equal(femaleTop.owned[0].isStarterDefault, true);
  assert.equal(femaleTop.shop.length, 4, 'Four new-gen Female NPC tops in Shop');
  assert.ok(femaleTop.shop.every((i) => i.gender === 'female'));

  const maleTop = partitionWardrobeCategoryItems('top', [], 'all', 'featured', 'male');
  assert.equal(maleTop.owned.length, 1);
  assert.equal(maleTop.shop.length, 4, 'Four new-gen Male NPC tops in Shop');
  assert.ok(maleTop.shop.every((i) => i.gender === 'male'));

  const boughtId = femaleTop.shop[0].id;
  const afterBuy = partitionWardrobeCategoryItems('top', [boughtId], 'all', 'featured', 'female');
  assert.equal(afterBuy.owned.length, 2);
  assert.ok(afterBuy.owned.some((i) => i.id === boughtId));
  assert.ok(!afterBuy.shop.some((i) => i.id === boughtId));

  const ownedFilter = partitionWardrobeCategoryItems('top', [boughtId], 'owned', 'featured', 'female');
  assert.equal(ownedFilter.shop.length, 0);
  assert.equal(ownedFilter.owned.length, 2);

  const shopFilter = partitionWardrobeCategoryItems('top', [boughtId], 'shop', 'price_asc', 'female');
  assert.equal(shopFilter.owned.length, 0);
  for (let i = 1; i < shopFilter.shop.length; i++) {
    assert.ok(shopFilter.shop[i].priceLul >= shopFilter.shop[i - 1].priceLul);
  }
});

test('Wardrobe undo/redo history and set-vs-slot mutual exclusivity work cleanly with Blitz NPC sets', () => {
  const f01Top = getWardrobeCatalogItemById('blitz_f01_top')!;
  const f02Bottoms = getWardrobeCatalogItemById('blitz_f02_bottoms')!;
  const f03Set = getWardrobeCatalogItemById('blitz_f03_set')!;

  let h = createWardrobeHistory(EMPTY_WARDROBE_DRAFT);
  h = pushWardrobeDraft(h, applyItemSelectionToDraft(h.present, f01Top));
  assert.equal(h.present.topId, f01Top.id);

  h = pushWardrobeDraft(h, applyItemSelectionToDraft(h.present, f02Bottoms));
  assert.equal(h.present.bottomsId, f02Bottoms.id);

  // Equipping a full set clears conflicting top/bottoms/shoes
  h = pushWardrobeDraft(h, applyItemSelectionToDraft(h.present, f03Set));
  assert.equal(h.present.setId, f03Set.id);
  assert.equal(h.present.topId, null);
  assert.equal(h.present.bottomsId, null);

  // Undo restores previous top + bottoms
  h = undoWardrobeDraft(h);
  assert.equal(h.present.setId, null);
  assert.equal(h.present.topId, f01Top.id);
  assert.equal(h.present.bottomsId, f02Bottoms.id);

  // Redo re-applies full set
  h = redoWardrobeDraft(h);
  assert.equal(h.present.setId, f03Set.id);
});

test('Try-on locked items and opposite-gender items are sanitized cleanly to owned-only outfit URLs', () => {
  const draft = {
    ...EMPTY_WARDROBE_DRAFT,
    topId: 'blitz_f01_top',
    bottomsId: 'blitz_f02_bottoms',
    shoesId: 'blitz_f03_shoes',
    hairId: 'blitz_f01_hair',
    setId: null,
    bodyShapeId: 'apparel_body_athletic_sculpt',
    clothingTintHex: '#8ecae6',
  };
  const owned = ['blitz_f01_top'];
  const lockedFemale = collectUnownedItemsInDraft(draft, owned, 'female');
  assert.equal(lockedFemale.length, 4);

  const sanitizedFemale = sanitizeDraftToOwnedOnly(draft, owned, 'female');
  assert.equal(sanitizedFemale.topId, 'blitz_f01_top');
  assert.equal(sanitizedFemale.bottomsId, null);
  assert.equal(sanitizedFemale.shoesId, null);
  assert.equal(sanitizedFemale.hairId, null);
  assert.equal(sanitizedFemale.bodyShapeId, null);
  assert.equal(sanitizedFemale.clothingTintHex, '#8ecae6');

  const urlsFemale = resolveWardrobeDraftToModularOutfitUrls(sanitizedFemale, 'female');
  assert.equal(urlsFemale.torsoUrl, '/assets/avatars/blitz-female-01.glb#slot=torso');
  assert.equal(urlsFemale.legsUrl, null);
  assert.equal(urlsFemale.costumeUrl, null);

  // Switching to Male frame must NEVER resolve a Female garment GLB onto a Male BaseDoll
  const urlsMale = resolveWardrobeDraftToModularOutfitUrls(sanitizedFemale, 'male');
  assert.equal(urlsMale.torsoUrl, null);
});

test('purchaseWardrobeCatalogItem validates $LUL balance and unlocks item idempotently', () => {
  const fail = purchaseWardrobeCatalogItem([], 5, 'blitz_m01_top');
  assert.equal(fail.ok, false);
  assert.ok(fail.errorMessage?.includes('$LUL'));

  const ok = purchaseWardrobeCatalogItem([], 50, 'blitz_m01_top');
  assert.equal(ok.ok, true);
  assert.equal(ok.alreadyOwned, false);
  assert.equal(ok.priceChargedLul, 16);
  assert.equal(ok.nextLulBalance, 34);
  assert.ok(ok.nextOwnedIds.includes('blitz_m01_top'));

  const already = purchaseWardrobeCatalogItem(ok.nextOwnedIds, ok.nextLulBalance, 'blitz_m01_top');
  assert.equal(already.ok, true);
  assert.equal(already.alreadyOwned, true);
  assert.equal(already.priceChargedLul, 0);
});

test('resolveWardrobeGlassSurfaceMode defaults to 0% FPS smoked pseudo-glass on software/slow GPUs and frosted on fast hardware', () => {
  assert.equal(
    resolveWardrobeGlassSurfaceMode({
      preference: 'auto',
      isSoftwareGl: true,
      smoothedFrameMs: 12,
    }),
    'smoked_pseudo',
  );
  assert.equal(
    resolveWardrobeGlassSurfaceMode({
      preference: 'auto',
      isSoftwareGl: false,
      smoothedFrameMs: 24,
    }),
    'smoked_pseudo',
  );
  assert.equal(
    resolveWardrobeGlassSurfaceMode({
      preference: 'auto',
      isSoftwareGl: false,
      smoothedFrameMs: 14,
    }),
    'frosted_blur',
  );
  assert.equal(
    resolveWardrobeGlassSurfaceMode({
      preference: 'smoked_pseudo',
      isSoftwareGl: false,
      smoothedFrameMs: 10,
    }),
    'smoked_pseudo',
  );
});

test('All paid garment catalog items point exclusively to morph-capable Blitz NPC avatar GLBs present on disk', () => {
  const preset = createSavedPresetFromDraft(
    { ...EMPTY_WARDROBE_DRAFT, topId: 'blitz_f02_top' },
    0,
    1700000000000,
  );
  assert.equal(preset.name, 'Look 1');
  assert.equal(preset.draft.topId, 'blitz_f02_top');

  const femalePresets = getVisibleBuiltInWardrobePresets('female');
  const malePresets = getVisibleBuiltInWardrobePresets('male');
  assert.equal(femalePresets.length, 5, 'Starter + 4 Female curated NPC looks');
  assert.equal(malePresets.length, 5, 'Starter + 4 Male curated NPC looks');

  for (const item of WARDROBE_STUDIO_ITEMS) {
    if (item.slot === 'body_shape') {
      assert.ok(item.bodyShape, `${item.id} must define a bodyShape morph & proportion profile`);
      assert.ok(item.bodyShape.heightScale >= 0.85 && item.bodyShape.heightScale <= 1.15);
      assert.ok(item.bodyShape.widthScale >= 0.85 && item.bodyShape.widthScale <= 1.15);
    } else if (item.slot === 'face_eyes') {
      assert.ok(item.eyeStyle, `${item.id} must define an eyeStyle spec`);
    } else if (item.slot === 'face_brows') {
      assert.ok(item.browStyle, `${item.id} must define a browStyle spec`);
    } else if (item.slot === 'face_lips') {
      assert.ok(item.lipStyle, `${item.id} must define a lipStyle spec`);
    } else if (item.slot === 'style_anim') {
      assert.ok(
        item.animSet && item.animSet.clipCandidates.length > 0,
        `${item.id} must define a style_anim spec with clipCandidates`,
      );
    } else if (item.slot === 'style_dance') {
      assert.ok(item.dancePose, `${item.id} must define a style_dance spec`);
    } else if (!item.isStarterDefault) {
      assert.ok(
        item.glbPath && /^\/assets\/avatars\/blitz-(?:female|male)-0[1-4]\.glb#slot=(?:torso|legs|feet|hair|costume)$/.test(item.glbPath),
        `${item.id} must reference a morph-ready Blitz NPC avatar GLB with #slot fragment (got ${item.glbPath})`,
      );
      const diskPath = path.join(process.cwd(), 'public', item.glbPath.split('#')[0]);
      assert.ok(fs.existsSync(diskPath), `GLB must exist on disk: ${diskPath}`);
    }
  }
});

test('Body Shape category partitions Owned vs Shop, stays orthogonal to Sets/Clothes, and resolves morph profiles', () => {
  const part = partitionWardrobeCategoryItems('body_shape', [], 'all', 'featured', 'female');
  assert.equal(part.owned.length, 1, 'Starter Balanced body shape is owned by default');
  assert.equal(part.owned[0].id, 'apparel_body_default_balanced');
  assert.equal(part.shop.length, 5, 'Five premium body shapes are listed in Shop');

  const athletic = getWardrobeCatalogItemById('apparel_body_athletic_sculpt')!;
  const f01Set = getWardrobeCatalogItemById('blitz_f01_set')!;
  const f02Top = getWardrobeCatalogItemById('blitz_f02_top')!;

  // Selecting a Full Set must NOT wipe the active Body Shape, and selecting a Body Shape must NOT wipe the Set
  let draft = applyItemSelectionToDraft(EMPTY_WARDROBE_DRAFT, athletic);
  assert.equal(draft.bodyShapeId, athletic.id);
  draft = applyItemSelectionToDraft(draft, f01Set);
  assert.equal(draft.setId, f01Set.id);
  assert.equal(draft.bodyShapeId, athletic.id, 'Full Set preserves Body Shape');

  // Selecting Top preserves Body Shape
  draft = applyItemSelectionToDraft(draft, f02Top);
  assert.equal(draft.topId, f02Top.id);
  assert.equal(draft.bodyShapeId, athletic.id);

  // Morph profile resolution
  const resolvedAthletic = resolveWardrobeDraftBodyShape(draft);
  assert.ok(resolvedAthletic.morphWeights.Shoulder_Width > 0.5);
  assert.ok(resolvedAthletic.widthScale > 1.0);

  // Sanitizing strips unowned Body Shape back to neutral
  const sanitized = sanitizeDraftToOwnedOnly(draft, [f02Top.id], 'female');
  assert.equal(sanitized.bodyShapeId, null);
  assert.deepEqual(resolveWardrobeDraftBodyShape(sanitized), DEFAULT_NEUTRAL_BODY_SHAPE);
});

test('Server-authoritative wardrobe purchase catalog matches every paid client item & rejects tampered/invalid requests', async () => {
  for (const item of WARDROBE_STUDIO_ITEMS) {
    if (!item.isStarterDefault && item.priceLul > 0) {
      const serverEntry = WARDROBE_SERVER_CATALOG[item.id];
      assert.ok(serverEntry, `Paid item ${item.id} must exist in WARDROBE_SERVER_CATALOG`);
      assert.equal(serverEntry.priceLul, item.priceLul, `Server price must match catalog for ${item.id}`);
      assert.equal(serverEntry.slot, item.slot);
    }
  }

  const badAcct = await handleWardrobePurchaseRequest({ accountId: '!!bad', itemId: 'blitz_f01_set' });
  assert.equal(badAcct.status, 400);

  const badItem = await handleWardrobePurchaseRequest({ accountId: 'player.testnet', itemId: 'hacked_free_item' });
  assert.equal(badItem.status, 404);

  const sig1 = signWardrobeEntitlementReceipt({
    accountId: 'player.testnet',
    itemId: 'blitz_f01_set',
    priceLul: 34,
    issuedAtIso: '2026-11-20T00:00:00.000Z',
  });
  const sig2 = signWardrobeEntitlementReceipt({
    accountId: 'player.testnet',
    itemId: 'blitz_f01_set',
    priceLul: 0,
    issuedAtIso: '2026-11-20T00:00:00.000Z',
  });
  assert.equal(sig1.length, 64);
  assert.notEqual(sig1, sig2, 'HMAC receipt must bind price and item tamper-evidently');
});

test('classifyDefaultAvatarSlotFromMeshName matches Blitz NewPlayer & NPC garments + outlines while protecting BaseDoll skin', () => {
  // Male New Player & NPC defaults + runtime outline shells
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Male_NewPlayer_Top'), 'torso');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Male_NewPlayer_Top_Outline'), 'torso');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Male_Outfit01_Top_Mesh'), 'torso');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Male_Outfit01_Legs_Mesh'), 'legs');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Male_Outfit01_Shoes_Mesh'), 'feet');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Male_Outfit01_Hair_Mesh'), 'hair');

  // Female New Player & NPC defaults + runtime outline shells
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_NewPlayer_Top'), 'torso');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Outfit_BlackHalterTop_Mesh'), 'torso');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Outfit_BlackChainSkirt_Mesh'), 'legs');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Outfit_BlackHeels_Mesh'), 'feet');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Outfit_Heels_Instep_Mesh'), 'feet');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Hair_LongWave_Mesh'), 'hair');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Outfit02_Trousers_Mesh'), 'legs');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Outfit03_Shorts_Mesh'), 'legs');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Female_Outfit04_Top_Mesh'), 'torso');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Acc_Hands_Mesh'), 'hands');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_Acc_Necklace_Mesh'), 'neck');

  // BaseDoll & skin meshes must NEVER be hidden or extracted as clothing
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_BaseDoll_Male_Mesh'), null);
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_BaseDoll_Female_Mesh'), null);
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_BaseDoll_Male_BodySkin'), null);
  assert.equal(classifyDefaultAvatarSlotFromMeshName('Blitz_BaseDoll_Female_BodySkin_Outline'), null);
  assert.equal(classifyDefaultAvatarSlotFromMeshName('torso_skin'), null);
  assert.equal(classifyDefaultAvatarSlotFromMeshName('head_101'), null);
});

test('Face categories (Eyes, Brows, Lips) partition Free Owned vs Shop, stay orthogonal to outfits, and keep clean UV bounds', () => {
  for (const slot of ['face_eyes', 'face_brows', 'face_lips'] as const) {
    const part = partitionWardrobeCategoryItems(slot, [], 'all', 'featured', 'female');
    assert.equal(part.owned.length, 3, `${slot} has 3 free/starter owned options`);
    assert.equal(part.shop.length, 3, `${slot} has 3 premium shop options`);
  }

  const sapphireEyes = getWardrobeCatalogItemById('face_eyes_sapphire_sky')!;
  const sharpBrows = getWardrobeCatalogItemById('face_brows_sharp_noir')!;
  const cherryLips = getWardrobeCatalogItemById('face_lips_cherry_gloss')!;
  const f01Set = getWardrobeCatalogItemById('blitz_f01_set')!;

  let draft = applyItemSelectionToDraft(EMPTY_WARDROBE_DRAFT, f01Set);
  draft = applyItemSelectionToDraft(draft, sapphireEyes);
  draft = applyItemSelectionToDraft(draft, sharpBrows);
  draft = applyItemSelectionToDraft(draft, cherryLips);

  assert.equal(draft.setId, f01Set.id);
  assert.equal(draft.eyeStyleId, sapphireEyes.id);
  assert.equal(draft.browStyleId, sharpBrows.id);
  assert.equal(draft.lipStyleId, cherryLips.id);

  const faceProfile = resolveWardrobeDraftFaceCustomization(draft);
  assert.equal(faceProfile.eyeStyle?.irisOuterHex, '#1d4ed8');
  assert.equal(faceProfile.browStyle?.shape, 'sharp_angle');
  assert.equal(faceProfile.lipStyle?.shape, 'gloss_plump');

  // Unowned paid face styles are collected for Try-On checkout and stripped on sanitize, while free Sapphire Eyes persist!
  const unowned = collectUnownedItemsInDraft(draft, [], 'female').map((i) => i.id);
  assert.ok(unowned.includes(sharpBrows.id));
  assert.ok(unowned.includes(cherryLips.id));
  assert.ok(!unowned.includes(sapphireEyes.id), 'Free Ocean Sapphire eyes are owned by default');

  const sanitized = sanitizeDraftToOwnedOnly(draft, [], 'female');
  assert.equal(sanitized.eyeStyleId, sapphireEyes.id, 'Free owned eye style persists on commit');
  assert.equal(sanitized.browStyleId, null, 'Unowned paid brow is stripped on commit');
  assert.equal(sanitized.lipStyleId, null, 'Unowned paid lip is stripped on commit');

  // Verify non-overlapping 1024x1024 UV clear regions (lips < nose gap < eyes <= brows) for both genders
  for (const gender of ['male', 'female'] as const) {
    const uv = getBlitzFaceUvCalibration(gender);
    const lipBottom = uv.lipClearRect.y + uv.lipClearRect.h;
    const eyeTop = uv.eyeClearRect.y;
    const eyeBottom = uv.eyeClearRect.y + uv.eyeClearRect.h;
    const browTop = uv.browClearRect.y;
    assert.ok(lipBottom < eyeTop - 20, `${gender} lips clear rect must stay well clear of nose & eyes`);
    assert.ok(eyeBottom <= browTop, `${gender} eye clear rect must not overlap brow clear rect`);
  }
});

test('Style Animation Sets, Dance Poses & Saved Character gender partition Owned vs Shop and resolve cleanly', () => {
  const animPart = partitionWardrobeCategoryItems('style_anim', [], 'all', 'featured', 'female');
  assert.equal(animPart.owned.length, 3, '3 free/starter animation sets owned by default');
  assert.equal(animPart.shop.length, 5, '5 premium animation sets in Shop');

  const dancePart = partitionWardrobeCategoryItems('style_dance', [], 'all', 'featured', 'male');
  assert.equal(dancePart.owned.length, 4, '4 free/starter dance/emote poses owned by default');
  assert.equal(dancePart.shop.length, 3, '3 premium dance/emote poses in Shop');

  const freeRunwayAnim = getWardrobeCatalogItemById('style_anim_runway')!;
  const paidIdolAnim = getWardrobeCatalogItemById('style_anim_energetic')!;
  const freeGrooveDance = getWardrobeCatalogItemById('style_dance_groove')!;
  const paidHipHopDance = getWardrobeCatalogItemById('style_dance_hiphop')!;

  let draft = applyItemSelectionToDraft(EMPTY_WARDROBE_DRAFT, freeRunwayAnim);
  draft = applyItemSelectionToDraft(draft, freeGrooveDance);
  assert.equal(draft.animSetId, freeRunwayAnim.id);
  assert.equal(draft.dancePoseId, freeGrooveDance.id);

  const freeResolved = resolveWardrobeDraftAnimStyle(draft);
  assert.equal(freeResolved.danceKind, 'groove');
  assert.ok(freeResolved.tempoBpm > 0);
  assert.ok(freeResolved.clipCandidates.length > 0);

  // Free owned Style items survive sanitizeDraftToOwnedOnly
  const sanitizedFree = sanitizeDraftToOwnedOnly(draft, [], 'female');
  assert.equal(sanitizedFree.animSetId, freeRunwayAnim.id);
  assert.equal(sanitizedFree.dancePoseId, freeGrooveDance.id);

  // Paid unowned Style items show up in Try-On Preview and strip back to null on sanitize
  let paidDraft = applyItemSelectionToDraft(draft, paidIdolAnim);
  paidDraft = applyItemSelectionToDraft(paidDraft, paidHipHopDance);
  const unownedIds = collectUnownedItemsInDraft(paidDraft, [], 'male').map((i) => i.id);
  assert.ok(unownedIds.includes(paidIdolAnim.id));
  assert.ok(unownedIds.includes(paidHipHopDance.id));

  const sanitizedPaid = sanitizeDraftToOwnedOnly(paidDraft, [], 'male');
  assert.equal(sanitizedPaid.animSetId, null);
  assert.equal(sanitizedPaid.dancePoseId, null);

  // Saved Character preserves active gender along with complete draft
  const savedChar = createSavedPresetFromDraft(draft, 0, 1700000001000, 'female');
  assert.equal(savedChar.gender, 'female');
  assert.equal(savedChar.draft.animSetId, freeRunwayAnim.id);
  assert.equal(savedChar.draft.dancePoseId, freeGrooveDance.id);
});


