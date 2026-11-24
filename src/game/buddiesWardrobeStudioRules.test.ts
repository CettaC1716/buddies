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
  shouldFlipWardrobeThumbY,
  undoWardrobeDraft,
  type WardrobeCatalogItem,
  type WardrobeOutfitDraft,
} from './buddiesWardrobeStudioRules';
import { getBlitzFaceUvCalibration } from './buddiesFaceCompositor';
import {
  WARDROBE_SERVER_CATALOG,
  handleWardrobePurchaseRequest,
  signWardrobeEntitlementReceipt,
} from '../../api/wardrobe-purchase';

test('partitionWardrobeCategoryItems cleanly separates Owned defaults & Blender items per gender and excludes legacy hollow outfits', () => {
  const femaleTop = partitionWardrobeCategoryItems('top', [], 'all', 'featured', 'female');
  assert.equal(femaleTop.owned.length, 6, 'Starter tee + 5 clean Blender female tops are owned');
  assert.equal(femaleTop.owned[0].isStarterDefault, true);
  assert.ok(femaleTop.owned.some((i) => i.id === 'new_player_f_top_ringer'));
  assert.ok(femaleTop.owned.some((i) => i.id === 'new_player_f_top_halter'));
  assert.equal(femaleTop.shop.length, 0);
  assert.ok(femaleTop.owned.every((i) => i.gender === 'unisex' || i.gender === 'female'));

  const maleTop = partitionWardrobeCategoryItems('top', [], 'all', 'featured', 'male');
  assert.equal(maleTop.owned.length, 6, 'Starter tee + 5 clean Blender male tops are owned');
  assert.ok(maleTop.owned.some((i) => i.id === 'bl_bl_m_o2_top'));
  assert.ok(maleTop.owned.every((i) => i.gender === 'unisex' || i.gender === 'male'));

  // Legacy broken blitz-female-01..04 / blitz-male-01..04 items must be completely gone
  assert.equal(getWardrobeCatalogItemById('blitz_f01_top'), null);
  assert.equal(getWardrobeCatalogItemById('blitz_f04_top'), null);
  assert.equal(getWardrobeCatalogItemById('blitz_m01_top'), null);

  // Body Shape partitions free/master shapes vs paid shop shapes
  const bodyPart = partitionWardrobeCategoryItems('body_shape', [], 'all', 'featured', 'male');
  assert.ok(bodyPart.owned.some((i) => i.id === 'body_m_vtaper'));
  assert.ok(bodyPart.shop.length >= 5);

  const boughtId = bodyPart.shop[0].id;
  const afterBuy = partitionWardrobeCategoryItems('body_shape', [boughtId], 'all', 'featured', 'male');
  assert.ok(afterBuy.owned.some((i) => i.id === boughtId));
  assert.ok(!afterBuy.shop.some((i) => i.id === boughtId));

  const ownedFilter = partitionWardrobeCategoryItems('body_shape', [boughtId], 'owned', 'featured', 'male');
  assert.equal(ownedFilter.shop.length, 0);

  const shopFilter = partitionWardrobeCategoryItems('body_shape', [boughtId], 'shop', 'price_asc', 'male');
  assert.equal(shopFilter.owned.length, 0);
  for (let i = 1; i < shopFilter.shop.length; i++) {
    assert.ok(shopFilter.shop[i].priceLul >= shopFilter.shop[i - 1].priceLul);
  }
});

test('Wardrobe undo/redo history and set-vs-slot mutual exclusivity work cleanly with Blender modular sets', () => {
  const fTop = getWardrobeCatalogItemById('new_player_f_top_halter')!;
  const fBottoms = getWardrobeCatalogItemById('bl_bl_f_o2_legs')!;
  const fSet = getWardrobeCatalogItemById('bl_set_f_outfit03')!;

  let h = createWardrobeHistory(EMPTY_WARDROBE_DRAFT);
  h = pushWardrobeDraft(h, applyItemSelectionToDraft(h.present, fTop));
  assert.equal(h.present.topId, fTop.id);

  h = pushWardrobeDraft(h, applyItemSelectionToDraft(h.present, fBottoms));
  assert.equal(h.present.bottomsId, fBottoms.id);

  // Equipping a full set clears conflicting top/bottoms/shoes
  h = pushWardrobeDraft(h, applyItemSelectionToDraft(h.present, fSet));
  assert.equal(h.present.setId, fSet.id);
  assert.equal(h.present.topId, null);
  assert.equal(h.present.bottomsId, null);

  // Undo restores previous top + bottoms
  h = undoWardrobeDraft(h);
  assert.equal(h.present.setId, null);
  assert.equal(h.present.topId, fTop.id);
  assert.equal(h.present.bottomsId, fBottoms.id);

  // Redo re-applies full set
  h = redoWardrobeDraft(h);
  assert.equal(h.present.setId, fSet.id);
});

test('Try-on locked items and opposite-gender items are sanitized cleanly to owned-only outfit URLs', () => {
  const draft = {
    ...EMPTY_WARDROBE_DRAFT,
    topId: 'new_player_f_top_halter',
    bottomsId: 'bl_bl_f_o2_legs',
    shoesId: 'bl_bl_f_o3_feet',
    hairId: 'bl_bl_f_o1_hair',
    setId: null,
    bodyShapeId: 'apparel_body_athletic_sculpt',
    eyeStyleId: 'face_eyes_espresso_doll',
    clothingTintHex: '#8ecae6',
  };
  const owned: string[] = [];
  const lockedFemale = collectUnownedItemsInDraft(draft, owned, 'female');
  assert.equal(lockedFemale.length, 2, 'Paid body shape + paid eye style are locked when unowned');

  const sanitizedFemale = sanitizeDraftToOwnedOnly(draft, owned, 'female');
  assert.equal(sanitizedFemale.topId, 'new_player_f_top_halter');
  assert.equal(sanitizedFemale.bottomsId, 'bl_bl_f_o2_legs');
  assert.equal(sanitizedFemale.bodyShapeId, null);
  assert.equal(sanitizedFemale.eyeStyleId, null);
  assert.equal(sanitizedFemale.clothingTintHex, '#8ecae6');

  const urlsFemale = resolveWardrobeDraftToModularOutfitUrls(sanitizedFemale, 'female');
  assert.equal(
    urlsFemale.torsoUrl,
    '/assets/outfit/blitz_torso_atasan_halter_hitam_outfit_01_BL_F_O1_TOP.glb',
  );
  assert.equal(urlsFemale.costumeUrl, null);

  // Switching to Male frame must NEVER resolve a Female garment GLB onto a Male BaseDoll
  const urlsMale = resolveWardrobeDraftToModularOutfitUrls(sanitizedFemale, 'male');
  assert.equal(urlsMale.torsoUrl, null);
  assert.equal(urlsMale.legsUrl, null);
});

test('purchaseWardrobeCatalogItem validates $LUL balance and unlocks item idempotently', () => {
  const fail = purchaseWardrobeCatalogItem([], 5, 'apparel_body_athletic_sculpt');
  assert.equal(fail.ok, false);
  assert.ok(fail.errorMessage?.includes('$LUL'));

  const ok = purchaseWardrobeCatalogItem([], 50, 'apparel_body_athletic_sculpt');
  assert.equal(ok.ok, true);
  assert.equal(ok.alreadyOwned, false);
  assert.equal(ok.priceChargedLul, 25);
  assert.equal(ok.nextLulBalance, 25);
  assert.ok(ok.nextOwnedIds.includes('apparel_body_athletic_sculpt'));

  const already = purchaseWardrobeCatalogItem(
    ok.nextOwnedIds,
    ok.nextLulBalance,
    'apparel_body_athletic_sculpt',
  );
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

test('All modular garment catalog items point exclusively to clean Blender /assets/outfit GLBs present on disk', () => {
  const preset = createSavedPresetFromDraft(
    { ...EMPTY_WARDROBE_DRAFT, topId: 'bl_bl_f_o2_top' },
    0,
    1700000000000,
  );
  assert.equal(preset.name, 'Look 1');
  assert.equal(preset.draft.topId, 'bl_bl_f_o2_top');

  const femalePresets = getVisibleBuiltInWardrobePresets('female');
  const malePresets = getVisibleBuiltInWardrobePresets('male');
  assert.equal(femalePresets.length, 5, 'Starter + 4 Female curated Blender looks');
  assert.equal(malePresets.length, 5, 'Starter + 4 Male curated Blender looks');

  for (const item of WARDROBE_STUDIO_ITEMS) {
    if (item.slot === 'body_shape') {
      assert.ok(item.bodyShape, `${item.id} must define a bodyShape morph & proportion profile`);
      assert.ok(item.bodyShape.heightScale >= 0.85 && item.bodyShape.heightScale <= 1.15);
      assert.ok(item.bodyShape.widthScale >= 0.85 && item.bodyShape.widthScale <= 1.15);
      if (item.bodyShape.baseDollGlbUrl) {
        const diskPath = path.join(process.cwd(), 'public', item.bodyShape.baseDollGlbUrl);
        assert.ok(fs.existsSync(diskPath), `Body shape GLB must exist on disk: ${diskPath}`);
      }
    } else if (item.slot === 'face_eyes') {
      assert.ok(item.eyeStyle, `${item.id} must define an eyeStyle spec`);
    } else if (item.slot === 'face_brows') {
      assert.ok(item.browStyle, `${item.id} must define a browStyle spec`);
    } else if (item.slot === 'face_lips') {
      assert.ok(item.lipStyle, `${item.id} must define a lipStyle spec`);
    } else if (
      item.slot === 'face_eyeshadow' ||
      item.slot === 'face_blush' ||
      item.slot === 'face_facepaint' ||
      item.slot === 'face_beard' ||
      item.slot === 'face_nose'
    ) {
      assert.ok(item.isStarterDefault || item.beautyOverlay || item.slot === 'face_nose');
    } else if (item.slot === 'style_anim') {
      assert.ok(
        item.animSet && item.animSet.clipCandidates.length > 0,
        `${item.id} must define a style_anim spec with clipCandidates`,
      );
    } else if (
      item.slot === 'style_dance' ||
      item.slot === 'style_pose' ||
      item.slot === 'style_action'
    ) {
      assert.ok(item.dancePose, `${item.id} must define a dancePose spec`);
    } else if (!item.isStarterDefault) {
      assert.ok(
        item.glbPath &&
          (/^\/assets\/outfit\/blitz_[a-z0-9_]+\.glb$/i.test(item.glbPath) ||
            /^\/assets\/outfit\/hair_extra\/[a-z0-9_]+\.glb$/i.test(item.glbPath)),
        `${item.id} must reference a clean modular /assets/outfit GLB (got ${item.glbPath})`,
      );
      const diskPath = path.join(process.cwd(), 'public', item.glbPath.split('#')[0]);
      assert.ok(fs.existsSync(diskPath), `GLB must exist on disk: ${diskPath}`);
    }
  }
});

test('Body Shape category partitions Owned vs Shop, includes Male & Female Master Shapes, and stays orthogonal to Sets/Clothes', () => {
  const partFemale = partitionWardrobeCategoryItems('body_shape', [], 'all', 'featured', 'female');
  assert.equal(partFemale.owned.length, 6, 'Starter Balanced + 5 Female Master body shapes are owned');
  assert.equal(partFemale.owned[0].id, 'apparel_body_default_balanced');
  assert.equal(partFemale.shop.length, 5, 'Five premium studio sculpt body shapes are listed in Shop');

  const partMale = partitionWardrobeCategoryItems('body_shape', [], 'all', 'featured', 'male');
  assert.equal(partMale.owned.length, 6, 'Starter Balanced + 5 Male Master body shapes are owned');
  assert.ok(partMale.owned.some((i) => i.id === 'body_m_vtaper'));
  assert.ok(partMale.owned.some((i) => i.id === 'body_m_full_trapezoid'));

  const athletic = getWardrobeCatalogItemById('apparel_body_athletic_sculpt')!;
  const f01Set = getWardrobeCatalogItemById('bl_set_f_outfit01')!;
  const f02Top = getWardrobeCatalogItemById('bl_bl_f_o2_top')!;

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

  const badAcct = await handleWardrobePurchaseRequest({ accountId: '!!bad', itemId: 'apparel_body_athletic_sculpt' });
  assert.equal(badAcct.status, 400);

  const badItem = await handleWardrobePurchaseRequest({ accountId: 'player.testnet', itemId: 'hacked_free_item' });
  assert.equal(badItem.status, 404);

  const sig1 = signWardrobeEntitlementReceipt({
    accountId: 'player.testnet',
    itemId: 'apparel_body_athletic_sculpt',
    priceLul: 25,
    issuedAtIso: '2026-11-20T00:00:00.000Z',
  });
  const sig2 = signWardrobeEntitlementReceipt({
    accountId: 'player.testnet',
    itemId: 'apparel_body_athletic_sculpt',
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
  const f01Set = getWardrobeCatalogItemById('bl_set_f_outfit01')!;

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

  const nosePart = partitionWardrobeCategoryItems('face_nose', [], 'all', 'featured', 'female');
  assert.equal(nosePart.owned.length, 6, 'All 6 nose styles are free/starter owned options');

  // Test face fine-tuning resolution and clamping
  const tunedDraft: WardrobeOutfitDraft = {
    ...EMPTY_WARDROBE_DRAFT,
    lipScale: 0.85,
    lipOffsetY: 2.5,
    eyeSpacing: 4.0,
    eyeTiltDeg: 3.5,
    eyeScale: 1.1,
    browOffsetY: -1.5,
    browTiltDeg: 4.0,
    noseStyleId: 'face_nose_button',
    headScale: 0.92,
  };
  const resolvedTuning = resolveWardrobeDraftFaceCustomization(tunedDraft).tuning;
  assert.ok(resolvedTuning, 'Tuning profile must be present');
  assert.equal(resolvedTuning.lipScale, 0.85);
  assert.equal(resolvedTuning.lipOffsetY, 2.5);
  assert.equal(resolvedTuning.eyeSpacing, 4.0);
  assert.equal(resolvedTuning.eyeTiltDeg, 3.5);
  assert.equal(resolvedTuning.eyeScale, 1.1);
  assert.equal(resolvedTuning.browOffsetY, -1.5);
  assert.equal(resolvedTuning.browTiltDeg, 4.0);
  assert.equal(resolvedTuning.noseStyleId, 'face_nose_button');
  assert.equal(resolvedTuning.headScale, 0.92);
  assert.equal(resolveWardrobeDraftBodyShape(tunedDraft).headScale, 0.92);

  // Verify strict aesthetic clamping on extreme out-of-bounds values
  const extremeDraft: WardrobeOutfitDraft = {
    ...EMPTY_WARDROBE_DRAFT,
    lipScale: 0.1,
    lipOffsetY: 99,
    eyeSpacing: 50,
    eyeTiltDeg: -45,
    eyeScale: 3.0,
    browOffsetY: -99,
    browTiltDeg: 80,
    headScale: 0.4,
  };
  const clamped = resolveWardrobeDraftFaceCustomization(extremeDraft).tuning!;
  assert.equal(clamped.lipScale, 0.72);
  assert.equal(clamped.lipOffsetY, 6);
  assert.equal(clamped.eyeSpacing, 10);
  assert.equal(clamped.eyeTiltDeg, -8);
  assert.equal(clamped.eyeScale, 1.22);
  assert.equal(clamped.browOffsetY, -7);
  assert.equal(clamped.browTiltDeg, 12);
  assert.equal(clamped.headScale, 0.78);
  assert.equal(resolveWardrobeDraftBodyShape(extremeDraft).headScale, 0.78);

  // Verify non-overlapping 1024x1024 UV clear regions (lips <= nose <= eyes <= brows) for both genders
  for (const gender of ['male', 'female'] as const) {
    const uv = getBlitzFaceUvCalibration(gender);
    const lipBottom = uv.lipClearRect.y + uv.lipClearRect.h;
    const noseTop = uv.noseClearRect.y;
    const noseBottom = uv.noseClearRect.y + uv.noseClearRect.h;
    const eyeTop = uv.eyeClearRect.y;
    const eyeBottom = uv.eyeClearRect.y + uv.eyeClearRect.h;
    const browTop = uv.browClearRect.y;
    assert.ok(lipBottom <= noseTop, `${gender} lips clear rect must stay below nose`);
    assert.ok(noseBottom <= eyeTop, `${gender} nose clear rect must stay below eyes`);
    assert.ok(eyeBottom <= browTop, `${gender} eye clear rect must not overlap brow clear rect`);
    assert.ok(
      uv.eyeLeftClearRect.x + uv.eyeLeftClearRect.w < uv.eyeRightClearRect.x,
      `${gender} left & right eye clear rects must preserve center nose bridge`,
    );
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

test('New Female Player master base & 5 modular outfits are free/owned in Wardrobe and classify lowercase blitz_* slots cleanly', () => {
  const newFemaleBaseDisk = path.join(process.cwd(), 'public/assets/avatars/new-female-player.glb');
  assert.ok(fs.existsSync(newFemaleBaseDisk), 'public/assets/avatars/new-female-player.glb must exist');

  const expectedIds = [
    'new_player_f_top_ringer',
    'new_player_f_top_halter',
    'new_player_f_bottoms_skirt',
    'new_player_f_shoes_sneakers',
    'new_player_f_hair_clipit',
  ] as const;

  let draft = { ...EMPTY_WARDROBE_DRAFT };
  for (const id of expectedIds) {
    const item = getWardrobeCatalogItemById(id);
    assert.ok(item, `Missing wardrobe catalog item ${id}`);
    assert.equal(item.gender, 'female');
    assert.equal(item.priceLul, 0);
    assert.equal(item.isStarterDefault, false);
    assert.ok(item.glbPath && fs.existsSync(path.join(process.cwd(), 'public', item.glbPath)));
    draft = applyItemSelectionToDraft(draft, item);
  }

  // Last selected top is Atasan Halter Hitam, paired with Skirt, Sneakers, and Clip-It Hair
  assert.equal(draft.topId, 'new_player_f_top_halter');
  assert.equal(draft.bottomsId, 'new_player_f_bottoms_skirt');
  assert.equal(draft.shoesId, 'new_player_f_shoes_sneakers');
  assert.equal(draft.hairId, 'new_player_f_hair_clipit');

  // All 5 are free/owned so zero unowned locks and sanitize preserves them
  assert.equal(collectUnownedItemsInDraft(draft, [], 'female').length, 0);
  const sanitized = sanitizeDraftToOwnedOnly(draft, [], 'female');
  assert.equal(sanitized.topId, 'new_player_f_top_halter');
  const urls = resolveWardrobeDraftToModularOutfitUrls(sanitized, 'female');
  assert.equal(
    urls.torsoUrl,
    '/assets/outfit/blitz_torso_atasan_halter_hitam_outfit_01_BL_F_O1_TOP.glb',
  );
  assert.equal(
    urls.legsUrl,
    '/assets/outfit/blitz_legs_rok_mini_hitam_sabuk_new_player_wanita_BL_F_NP_SKIRT.glb',
  );
  assert.equal(
    urls.feetUrl,
    '/assets/outfit/blitz_feet_sneakers_putih_new_player_wanita_BL_F_NP_SHOES.glb',
  );
  assert.equal(
    urls.hairUrl,
    '/assets/outfit/blitz_hair_rambut_clipit_new_player_BL_F_NP_HAIR.glb',
  );

  // Lowercase blitz_* mesh names inside new-female-player.glb & modular outfit GLBs classify cleanly
  assert.equal(classifyDefaultAvatarSlotFromMeshName('blitz_BaseDoll_Female_Mesh'), null);
  assert.equal(classifyDefaultAvatarSlotFromMeshName('blitz_BaseDoll_Female_Mesh_Outline'), null);
  assert.equal(classifyDefaultAvatarSlotFromMeshName('torso_blitz_NewPlayer_Top_Mesh'), 'torso');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('torso_blitz_Outfit_BlackHalterTop_Mesh_Outline'), 'torso');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('legs_blitz_NewPlayer_Skirt_Mesh'), 'legs');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('feet_blitz_NewPlayer_Shoes_Mesh'), 'feet');
  assert.equal(classifyDefaultAvatarSlotFromMeshName('hair_blitz_Hair_ClipIt_Mesh'), 'hair');
});

test('New Male Player master base, Male Body Shapes, Beauty catalog (403+), and Style Animations catalog (134+) exist on disk', () => {
  assert.ok(fs.existsSync(path.join(process.cwd(), 'public/assets/avatars/new-male-player.glb')));
  for (const maleShape of [
    'male-vtaper.glb',
    'male-athletic.glb',
    'male-trapezoid.glb',
    'male-full-trapezoid.glb',
    'male-rectangle.glb',
  ]) {
    assert.ok(
      fs.existsSync(path.join(process.cwd(), 'public/assets/avatars', maleShape)),
      `Missing male body shape GLB: ${maleShape}`,
    );
  }

  const beautyCatalogPath = path.join(process.cwd(), 'public/assets/beauty/catalog.json');
  assert.ok(fs.existsSync(beautyCatalogPath), 'Beauty catalog.json must exist');
  const beautyJson = JSON.parse(fs.readFileSync(beautyCatalogPath, 'utf-8')) as {
    total: number;
    counts: Record<string, number>;
    items: Array<{ id: string; f?: { url: string }; m?: { url: string }; thumbUrl?: string }>;
  };
  assert.ok(beautyJson.total >= 350, `Expected >=350 beauty items, got ${beautyJson.total}`);
  assert.ok(beautyJson.counts.eyes >= 100);
  assert.ok(beautyJson.counts.brows >= 50);
  assert.ok(beautyJson.counts.lips >= 70);
  assert.ok(beautyJson.counts.eyeshadow >= 30);
  assert.ok(beautyJson.counts.blush >= 50);
  // Spot check first 10 files exist on disk
  for (const it of beautyJson.items.slice(0, 10)) {
    const checkUrl = it.f?.url ?? it.m?.url;
    assert.ok(checkUrl && fs.existsSync(path.join(process.cwd(), 'public', checkUrl)));
  }

  const animCatalogPath = path.join(process.cwd(), 'public/assets/animations/catalog.json');
  assert.ok(fs.existsSync(animCatalogPath), 'Animations catalog.json must exist');
  const animJson = JSON.parse(fs.readFileSync(animCatalogPath, 'utf-8')) as {
    total: number;
    counts: Record<string, number>;
    items: Array<{
      id: string;
      category?: string;
      glbPath: string;
      initiateGlbPath?: string;
      receiveGlbPath?: string;
    }>;
  };
  assert.ok(animJson.total >= 200, `Expected >=200 style animations, got ${animJson.total}`);
  assert.ok(animJson.counts.anim_set >= 100, `Expected >=100 full 4-state anim sets, got ${animJson.counts.anim_set}`);
  assert.ok(animJson.counts.dance >= 20);
  assert.ok(animJson.counts.action >= 20);
  assert.ok(animJson.counts.pose >= 30);
  assert.ok(animJson.counts.paired >= 50, `Expected >=50 paired animations, got ${animJson.counts.paired}`);
  for (const it of animJson.items.slice(0, 10)) {
    assert.ok(fs.existsSync(path.join(process.cwd(), 'public', it.glbPath)));
  }
  const pairedItems = animJson.items.filter((x) => x.category === 'paired');
  assert.equal(pairedItems.length, 57);
  for (const p of pairedItems) {
    assert.ok(
      p.initiateGlbPath && fs.existsSync(path.join(process.cwd(), 'public', p.initiateGlbPath)),
      `Missing initiate GLB ${p.initiateGlbPath}`,
    );
    assert.ok(
      p.receiveGlbPath && fs.existsSync(path.join(process.cwd(), 'public', p.receiveGlbPath)),
      `Missing receive GLB ${p.receiveGlbPath}`,
    );
  }

  const uwCatalogPath = path.join(process.cwd(), 'public/assets/underwear/catalog.json');
  assert.ok(fs.existsSync(uwCatalogPath), 'Underwear catalog.json must exist');
  const uwJson = JSON.parse(fs.readFileSync(uwCatalogPath, 'utf-8')) as {
    total: number;
    counts: Record<string, number>;
    items: Array<{ id: string; uv: { url: string }; thumbUrl?: string | null }>;
  };
  assert.equal(uwJson.total, 50, `Expected 50 underwear/corewear items, got ${uwJson.total}`);
  assert.equal(uwJson.counts.female, 23);
  assert.equal(uwJson.counts.male, 27);
  for (const it of uwJson.items) {
    assert.ok(fs.existsSync(path.join(process.cwd(), 'public', it.uv.url)), `Missing ${it.uv.url}`);
    if (it.thumbUrl) {
      assert.ok(
        fs.existsSync(path.join(process.cwd(), 'public', it.thumbUrl)),
        `Missing ${it.thumbUrl}`,
      );
    }
  }
});

test('Underwear slot selection supports underwear + corewear layering and bare outer toggle', () => {
  const sampleUw: WardrobeCatalogItem = {
    id: 'uw_underwear_f_5d1ae180',
    slot: 'underwear',
    underwearSubSlot: 'underwear',
    gender: 'female',
    name: 'Blitz Basic White Bra & Briefs',
    subtitle: 'Bra Set',
    collection: 'Underwear · Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    swatchGradient: ['#fda4af', '#9f1239'],
    accentHex: '#fda4af',
  };
  const sampleCore: WardrobeCatalogItem = {
    ...sampleUw,
    id: 'uw_corewear_f_15463e19',
    underwearSubSlot: 'corewear',
    name: 'Blitz Burgundy Lace Bustier',
    subtitle: 'Bustier',
  };
  const starterNone = WARDROBE_STUDIO_ITEMS.find((i) => i.id === 'underwear_none')!;
  assert.ok(starterNone, 'underwear_none starter default must exist');

  let draft: WardrobeOutfitDraft = { ...EMPTY_WARDROBE_DRAFT, hideOuterForUnderwear: true };
  draft = applyItemSelectionToDraft(draft, sampleUw);
  assert.equal(draft.underwearId, sampleUw.id);
  assert.equal(draft.corewearId, null);

  draft = applyItemSelectionToDraft(draft, sampleCore);
  assert.equal(draft.underwearId, sampleUw.id);
  assert.equal(draft.corewearId, sampleCore.id);

  // Equipping an outer Top automatically restores outer clothes visibility
  const anyTop = WARDROBE_STUDIO_ITEMS.find((i) => i.slot === 'top' && !i.isStarterDefault)!;
  draft = applyItemSelectionToDraft(draft, anyTop);
  assert.equal(draft.hideOuterForUnderwear, false);

  // Selecting starter "Polos / Lepas" clears both underwear & corewear
  draft = applyItemSelectionToDraft(draft, starterNone);
  assert.equal(draft.underwearId, null);
  assert.equal(draft.corewearId, null);
});

test('shouldFlipWardrobeThumbY flips glTF UV beauty thumbnails upright without flipping underwear or procedural previews', () => {
  assert.equal(
    shouldFlipWardrobeThumbY({ thumbUrl: '/assets/beauty/eyes/12F06D23_t.webp' }),
    true,
  );
  assert.equal(
    shouldFlipWardrobeThumbY({ thumbUrl: '/assets/beauty/lips/105FDB_t.webp', thumbFlipY: true }),
    true,
  );
  assert.equal(
    shouldFlipWardrobeThumbY({ thumbUrl: '/assets/beauty/beard/28124C01_t.webp' }),
    true,
  );
  assert.equal(
    shouldFlipWardrobeThumbY({ thumbUrl: '/assets/underwear/thumbs/5D1AE180_t.webp' }),
    false,
  );
  assert.equal(shouldFlipWardrobeThumbY({ thumbUrl: null }), false);
  assert.equal(
    shouldFlipWardrobeThumbY({ thumbUrl: '/assets/beauty/eyes/custom_upright.webp', thumbFlipY: false }),
    false,
  );
});


