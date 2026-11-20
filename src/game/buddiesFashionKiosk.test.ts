import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FASHION_APPAREL_CATALOG_ITEMS,
  FASHION_APPAREL_KIOSK_LAYOUT,
  FASHION_BOUTIQUE_SHOP_TRIGGER,
  computeFashionKioskWorldColliders,
  computeWestPromenadeKioskSymmetryMetrics,
  evaluateFashionBoutiqueProximity,
  fashionKioskLocalToWorldPose,
  purchaseFashionApparelToBag,
  resolveEquippedTorsoGlbForGender,
  toggleEquipFashionApparel,
} from './buddiesFashionKioskRules';
import { pointInObb2D } from './buddiesBlitzRules';

describe('Fashion & Apparel Boutique Kiosk Trigger, Bag Purchase & Wardrobe Equip', () => {
  it('places the 3D interaction triangle beside the A-Frame sign outside all kiosk OBB colliders', () => {
    const signWorld = fashionKioskLocalToWorldPose(
      FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.x,
      FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.y,
      FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.z,
    );
    const distToSign = Math.hypot(
      FASHION_BOUTIQUE_SHOP_TRIGGER.x - signWorld.x,
      FASHION_BOUTIQUE_SHOP_TRIGGER.z - signWorld.z,
    );
    assert.ok(
      distToSign > 0.5 && distToSign < 1.5,
      `Expected trigger beside A-Frame sign (0.5m..1.5m), got ${distToSign.toFixed(3)}m`,
    );

    const colliders = computeFashionKioskWorldColliders();
    for (const obb of colliders) {
      const inside = pointInObb2D(
        FASHION_BOUTIQUE_SHOP_TRIGGER.x,
        FASHION_BOUTIQUE_SHOP_TRIGGER.z,
        obb.x,
        obb.z,
        obb.halfX,
        obb.halfZ,
        obb.rotY,
      );
      assert.equal(inside, false, `Trigger must be outside collider ${obb.id}`);
    }

    const near = evaluateFashionBoutiqueProximity(
      FASHION_BOUTIQUE_SHOP_TRIGGER.x + 0.5,
      FASHION_BOUTIQUE_SHOP_TRIGGER.z,
      false,
      false,
    );
    assert.equal(near.isNear, true);
    assert.equal(near.canInteract, true);

    const modalBlocked = evaluateFashionBoutiqueProximity(
      FASHION_BOUTIQUE_SHOP_TRIGGER.x,
      FASHION_BOUTIQUE_SHOP_TRIGGER.z,
      false,
      true,
    );
    assert.equal(modalBlocked.isNear, true);
    assert.equal(modalBlocked.canInteract, false);
  });

  it('maintains exact 6.75m symmetry across the three West Promenade arcade bays', () => {
    const metrics = computeWestPromenadeKioskSymmetryMetrics();
    assert.equal(metrics.isSymmetrical, true);
    assert.equal(metrics.northScooterZ, -11.15);
    assert.equal(metrics.centerRealEstateZ, -4.4);
    assert.equal(metrics.southFashionZ, 2.35);
    assert.equal(metrics.northToCenterSpanM, 6.75);
    assert.equal(metrics.centerToSouthSpanM, 6.75);
  });

  it('stores purchased apparel into Personal Bag first and toggles equip/unequip cleanly', () => {
    const sampleItem = FASHION_APPAREL_CATALOG_ITEMS[0];
    assert.ok(sampleItem);
    assert.equal(sampleItem.deliveryTarget, 'bag');
    assert.equal(
      resolveEquippedTorsoGlbForGender(sampleItem.id, 'male'),
      '/assets/torso_dropscience_hiphop_24_iap_1_3B9D82F3.glb',
    );
    assert.equal(
      resolveEquippedTorsoGlbForGender(sampleItem.id, 'female'),
      '/assets/torso_dropscience_hiphop_24_iap_1_3B9D82F3.glb',
    );

    // Cannot equip before buying into Bag
    const prematureEquip = toggleEquipFashionApparel([], null, sampleItem.id);
    assert.equal(prematureEquip.ok, false);
    assert.equal(prematureEquip.nextEquippedId, null);

    // Insufficient LUL check
    const failBuy = purchaseFashionApparelToBag([], 5, sampleItem.id);
    assert.equal(failBuy.ok, false);
    assert.deepEqual(failBuy.nextOwnedIds, []);

    // Successful purchase sends item to Bag
    const okBuy = purchaseFashionApparelToBag([], 100, sampleItem.id);
    assert.equal(okBuy.ok, true);
    assert.equal(okBuy.alreadyOwned, false);
    assert.equal(okBuy.priceChargedLul, sampleItem.priceLul);
    assert.equal(okBuy.nextLulBalance, 100 - sampleItem.priceLul);
    assert.deepEqual(okBuy.nextOwnedIds, [sampleItem.id]);

    // Equip from Bag, then unequip back to default top
    const wearRes = toggleEquipFashionApparel(okBuy.nextOwnedIds, null, sampleItem.id);
    assert.equal(wearRes.ok, true);
    assert.equal(wearRes.nextEquippedId, sampleItem.id);

    const takeOffRes = toggleEquipFashionApparel(
      okBuy.nextOwnedIds,
      wearRes.nextEquippedId,
      sampleItem.id,
    );
    assert.equal(takeOffRes.ok, true);
    assert.equal(takeOffRes.nextEquippedId, null);
  });

  it('verifies the torso GLB asset exists on disk and shares compatible skeletal joints with both avatars', () => {
    const sampleItem = FASHION_APPAREL_CATALOG_ITEMS[0];
    const glbDiskPath = path.join(process.cwd(), 'public', sampleItem.maleGlbPath);
    assert.equal(fs.existsSync(glbDiskPath), true, `Missing ${glbDiskPath}`);

    const parseGlbJson = (p: string) => {
      const buf = fs.readFileSync(p);
      assert.equal(buf.slice(0, 4).toString('ascii'), 'glTF');
      const jsonLen = buf.readUInt32LE(12);
      return JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
    };

    const torsoJson = parseGlbJson(glbDiskPath);
    const maleJson = parseGlbJson(
      path.join(
        process.cwd(),
        'public/assets/character_custom_idle_runway_catwalk_stylish_11 (2).glb',
      ),
    );
    const femaleJson = parseGlbJson(
      path.join(
        process.cwd(),
        'public/assets/character_custom_idle_runway_catwalk_stylish_11 (3).glb',
      ),
    );

    const maleNodeNames = new Set<string>(maleJson.nodes.map((n: { name?: string }) => n.name || ''));
    const femaleNodeNames = new Set<string>(
      femaleJson.nodes.map((n: { name?: string }) => n.name || ''),
    );

    assert.ok(Array.isArray(torsoJson.skins) && torsoJson.skins.length > 0);
    for (const skin of torsoJson.skins) {
      for (const jointIdx of skin.joints as number[]) {
        const boneName = torsoJson.nodes[jointIdx]?.name;
        assert.ok(boneName, 'Expected named joint on torso GLB');
        assert.equal(
          maleNodeNames.has(boneName),
          true,
          `Male avatar skeleton missing joint ${boneName}`,
        );
        assert.equal(
          femaleNodeNames.has(boneName),
          true,
          `Female avatar skeleton missing joint ${boneName}`,
        );
      }
    }
  });
});
