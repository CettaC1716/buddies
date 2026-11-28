import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  SHOP_BILLBOARD_MESH_SPEC,
  type ShopBuildingFormId,
  type ShopBuildingFormSpec,
} from '../game/buddiesCityRentalLotsRules';
import type {
  CentralPlazaGiftPreviewKind,
  StoreProduct3DArchetype,
} from '../game/shopStorefrontCatalogEngine';
import { buildPlazaCommercialArcade3D } from '../game/buddiesPlazaKioskArcadeBuilder';
import { buildOriginalBuddiesCatalogFurnitureMesh } from '../game/buddiesInteriorAssets';
import {
  createElectricScooterBike3D,
  createPushKickScooter3D,
} from '../game/buddiesUrbanScooterBuilder';
import { createCafeFoodPropMesh } from '../game/buddiesCafeFoodPropBuilder';
import type { CafeMenuItemId } from '../game/buddiesCafeRules';
import { GLOW_STUDIO_SALON_GLB_PATH } from '../game/buddiesBeautySalonBuilder';
import {
  BITES_SIPS_PAVILION_GLB_PATH,
  VINTAGE_CAFE_GLB_PATH,
} from '../game/buddiesUrbanPlazaBuildingsBuilder';
import {
  loadModularApparelGltf,
  parseModularAssetSlotFragment,
} from '../game/buddiesBlitzShadersAndAssets';
import { classifyDefaultAvatarSlotFromMeshName } from '../game/buddiesWardrobeStudioRules';
import {
  createLiveMotionSilhouettePreview,
  type LiveMotionSilhouetteHandle,
} from '../game/shopMotionSilhouetteRenderer';

export interface ShopProduct3DTurntableProps {
  archetype: StoreProduct3DArchetype;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  stageBgHex: string;
  /** Optional real 3D GLB model path (Outfits & Shop Buildings). */
  previewGlbPath?: string;
  /** Optional real catalog furniture id (rendered via buddiesInteriorAssets). */
  previewFurnitureId?: string;
  /** Optional real 3D scooter kind (rendered via buddiesUrbanScooterBuilder). */
  previewScooterKind?: 'electric_scooter_bike' | 'push_kick_scooter';
  /** Optional real 3D cafe food/drink prop (rendered via buddiesCafeFoodPropBuilder). */
  previewCafeFoodId?: CafeMenuItemId;
  /** Optional 3D floral / confection gift prop kind for Cerria Bites & Sips. */
  previewGiftKind?: CentralPlazaGiftPreviewKind;
  /** Optional Red Studio Wardrobe motion item id rendered as a live animated 3D human silhouette. */
  previewMotionItemId?: string;
  /** Optional real photo or beauty thumbnail render. */
  previewImageUrl?: string;
  /** True when a UV-exported beauty thumbnail should be vertically flipped upright. */
  previewThumbFlipY?: boolean;
  previewImageAlt?: string;
}

export type ShopBuildingDioramaViewPreset = 'home' | 'shop_corner' | 'hidden';

export interface ShopBuilding3DDioramaProps {
  formSpec: ShopBuildingFormSpec;
  customGlbPath?: string;
  /** Selects either a single lot GLB, West Plaza Commercial Arcade, or Central Plaza 3-store trio. */
  customDioramaMode?: 'lot_glb' | 'west_plaza_arcade' | 'central_plaza_trio';
  brandName: string;
  brandCategory: string;
  accentHex: string;
  billboardLogoUrl: string | null;
  compact?: boolean;
  fullBleed?: boolean;
  /** Target spatial pose for persistent full-bleed transitions across tabs. */
  viewPreset?: ShopBuildingDioramaViewPreset;
  /** Optional DOM anchor element under the "you are here" badge for pixel-exact corner landing. */
  cornerAnchorRef?: React.RefObject<HTMLDivElement | null>;
}

const _dioramaUnprojVec = new THREE.Vector3();
const _dioramaRayDir = new THREE.Vector3();

const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return true;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

interface DynamicTurntableMaterials {
  primaryMat: THREE.MeshStandardMaterial;
  secondaryMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  woodMat: THREE.MeshStandardMaterial;
  brassMat: THREE.MeshStandardMaterial;
  darkMetalMat: THREE.MeshStandardMaterial;
  screenGlowMat: THREE.MeshStandardMaterial;
}

function populateArchetypeMesh(
  root: THREE.Group,
  archetype: StoreProduct3DArchetype,
  mats: DynamicTurntableMaterials,
  disposables: Array<{ dispose: () => void }>,
) {
  const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };

  const addStand = () => {
    const baseDisc = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.46, 0.52, 0.09, 28)),
      mats.woodMat,
    );
    baseDisc.position.y = -0.82;
    root.add(baseDisc);

    const brassCollar = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.11, 0.14, 0.08, 20)),
      mats.brassMat,
    );
    brassCollar.position.y = -0.74;
    root.add(brassCollar);

    const pole = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.038, 0.038, 0.72, 16)),
      mats.brassMat,
    );
    pole.position.y = -0.4;
    root.add(pole);
  };

  if (
    archetype === 'classic_blazer' ||
    archetype === 'tailored_coat' ||
    archetype === 'pleated_dress' ||
    archetype === 'knit_cardigan' ||
    archetype === 'linen_apron'
  ) {
    addStand();
    const isLong = archetype === 'tailored_coat' || archetype === 'pleated_dress';

    // Inner mannequin torso collar
    const neck = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 20)),
      mats.secondaryMat,
    );
    neck.position.y = 0.62;
    root.add(neck);

    const neckCap = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 20)),
      mats.darkMetalMat,
    );
    neckCap.position.y = 0.74;
    root.add(neckCap);

    // Main tailored garment torso
    const torsoHeight = isLong ? 0.96 : 0.78;
    const torso = new THREE.Mesh(
      regGeo(
        new THREE.CylinderGeometry(
          0.32,
          archetype === 'pleated_dress' ? 0.44 : 0.28,
          torsoHeight,
          24,
        ),
      ),
      mats.primaryMat,
    );
    torso.scale.set(1.05, 1, 0.68);
    torso.position.y = isLong ? 0.12 : 0.18;
    root.add(torso);

    // Structured shoulders
    const shoulderBar = new THREE.Mesh(
      regGeo(new THREE.CapsuleGeometry(0.13, 0.52, 8, 16)),
      mats.primaryMat,
    );
    shoulderBar.rotation.z = Math.PI / 2;
    shoulderBar.scale.set(1, 1, 0.72);
    shoulderBar.position.y = 0.48;
    root.add(shoulderBar);

    // Left & right tailored sleeves
    for (const side of [-1, 1] as const) {
      const sleeve = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.105, 0.088, 0.62, 16)),
        mats.primaryMat,
      );
      sleeve.position.set(side * 0.38, 0.19, 0.02);
      sleeve.rotation.z = side * -0.11;
      sleeve.rotation.x = 0.06;
      root.add(sleeve);

      const cuff = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.082, 0.082, 0.06, 16)),
        mats.secondaryMat,
      );
      cuff.position.set(side * 0.41, -0.13, 0.04);
      root.add(cuff);
    }

    // Lapels / Front Belt / Pocket Flaps
    for (const side of [-1, 1] as const) {
      const lapel = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(0.11, 0.38, 0.04)),
        mats.primaryMat,
      );
      lapel.position.set(side * 0.1, 0.36, 0.21);
      lapel.rotation.z = side * 0.24;
      root.add(lapel);

      const pocketFlap = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(0.14, 0.045, 0.03)),
        mats.secondaryMat,
      );
      pocketFlap.position.set(side * 0.16, -0.02, 0.2);
      root.add(pocketFlap);
    }

    if (isLong || archetype === 'linen_apron') {
      const belt = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.305, 0.305, 0.065, 24)),
        mats.secondaryMat,
      );
      belt.scale.set(1.06, 1, 0.7);
      belt.position.y = 0.08;
      root.add(belt);

      const buckle = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(0.09, 0.085, 0.04)),
        mats.accentMat,
      );
      buckle.position.set(0, 0.08, 0.22);
      root.add(buckle);
    }
    return;
  }

  if (archetype === 'pro_gamepad') {
    // Center ergonomic controller chassis
    const body = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.92, 0.44, 0.22)),
      mats.primaryMat,
    );
    body.position.y = 0.05;
    root.add(body);

    const touchpad = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.36, 0.2, 0.235)),
      mats.secondaryMat,
    );
    touchpad.position.set(0, 0.14, 0.01);
    root.add(touchpad);

    // Dual sculpted grips
    for (const side of [-1, 1] as const) {
      const grip = new THREE.Mesh(
        regGeo(new THREE.CapsuleGeometry(0.155, 0.48, 10, 18)),
        mats.primaryMat,
      );
      grip.position.set(side * 0.44, -0.14, -0.02);
      grip.rotation.z = side * 0.28;
      grip.rotation.x = 0.15;
      root.add(grip);

      const gripInlay = new THREE.Mesh(
        regGeo(new THREE.CapsuleGeometry(0.14, 0.36, 8, 14)),
        mats.secondaryMat,
      );
      gripInlay.position.set(side * 0.46, -0.18, 0.01);
      gripInlay.rotation.z = side * 0.28;
      gripInlay.rotation.x = 0.15;
      root.add(gripInlay);
    }

    // LED Accent Ring + Thumbsticks
    const stickPositions: [number, number][] = [
      [-0.24, -0.06],
      [0.22, -0.08],
    ];
    for (const [sx, sy] of stickPositions) {
      const ledRing = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(0.105, 0.018, 12, 24)),
        mats.accentMat,
      );
      ledRing.position.set(sx, sy, 0.115);
      root.add(ledRing);

      const cap = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.085, 0.06, 0.08, 18)),
        mats.darkMetalMat,
      );
      cap.rotation.x = Math.PI / 2;
      cap.position.set(sx, sy, 0.16);
      root.add(cap);
    }

    // D-pad & Action buttons
    const dpadH = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.16, 0.055, 0.04)),
      mats.darkMetalMat,
    );
    dpadH.position.set(-0.31, 0.11, 0.125);
    root.add(dpadH);
    const dpadV = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.055, 0.16, 0.04)),
      mats.darkMetalMat,
    );
    dpadV.position.set(-0.31, 0.11, 0.125);
    root.add(dpadV);

    const btnOffsets: [number, number][] = [
      [0.31, 0.18],
      [0.38, 0.11],
      [0.31, 0.04],
      [0.24, 0.11],
    ];
    for (const [bx, by] of btnOffsets) {
      const btn = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 14)),
        mats.accentMat,
      );
      btn.rotation.x = Math.PI / 2;
      btn.position.set(bx, by, 0.125);
      root.add(btn);
    }
    return;
  }

  if (archetype === 'anc_headset') {
    // Desk stand
    const standBase = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.38, 0.42, 0.07, 24)),
      mats.secondaryMat,
    );
    standBase.position.y = -0.82;
    root.add(standBase);

    const standStem = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.03, 0.035, 1.32, 14)),
      mats.secondaryMat,
    );
    standStem.position.set(0, -0.15, -0.06);
    root.add(standStem);

    // Padded headband arc
    const headband = new THREE.Mesh(
      regGeo(new THREE.TorusGeometry(0.46, 0.055, 14, 32, Math.PI)),
      mats.primaryMat,
    );
    headband.position.y = 0.15;
    root.add(headband);

    const innerBand = new THREE.Mesh(
      regGeo(new THREE.TorusGeometry(0.43, 0.035, 10, 28, Math.PI * 0.75)),
      mats.accentMat,
    );
    innerBand.rotation.z = Math.PI * 0.125;
    innerBand.position.y = 0.15;
    root.add(innerBand);

    // Left & right earcups + memory foam cushions
    for (const side of [-1, 1] as const) {
      const yoke = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 12)),
        mats.secondaryMat,
      );
      yoke.position.set(side * 0.46, 0.02, 0);
      root.add(yoke);

      const cup = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.22, 0.2, 0.14, 24)),
        mats.primaryMat,
      );
      cup.rotation.z = Math.PI / 2;
      cup.scale.set(1.2, 1, 0.92);
      cup.position.set(side * 0.45, -0.14, 0);
      root.add(cup);

      const accentRing = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(0.18, 0.015, 10, 24)),
        mats.accentMat,
      );
      accentRing.rotation.y = Math.PI / 2;
      accentRing.scale.set(1, 1.2, 1);
      accentRing.position.set(side * 0.52, -0.14, 0);
      root.add(accentRing);

      const cushion = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(0.16, 0.055, 12, 24)),
        mats.darkMetalMat,
      );
      cushion.rotation.y = Math.PI / 2;
      cushion.scale.set(1, 1.22, 1);
      cushion.position.set(side * 0.37, -0.14, 0);
      root.add(cushion);
    }
    return;
  }

  if (archetype === 'ultrabook_laptop') {
    // Unibody aluminum base deck
    const baseDeck = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(1.18, 0.05, 0.78)),
      mats.primaryMat,
    );
    baseDeck.position.set(0, -0.42, 0.12);
    root.add(baseDeck);

    // Recessed keyboard well
    const keyboard = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.98, 0.015, 0.38)),
      mats.secondaryMat,
    );
    keyboard.position.set(0, -0.39, 0.02);
    root.add(keyboard);

    // Trackpad
    const trackpad = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.34, 0.012, 0.21)),
      mats.primaryMat,
    );
    trackpad.position.set(0, -0.39, 0.34);
    root.add(trackpad);

    // Tilted display lid group
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, -0.4, -0.26);
    lidGroup.rotation.x = -0.24;
    root.add(lidGroup);

    const lidShell = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(1.18, 0.76, 0.036)),
      mats.primaryMat,
    );
    lidShell.position.set(0, 0.38, 0);
    lidGroup.add(lidShell);

    const bezel = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(1.12, 0.7, 0.02)),
      mats.secondaryMat,
    );
    bezel.position.set(0, 0.38, 0.015);
    lidGroup.add(bezel);

    const screen = new THREE.Mesh(
      regGeo(new THREE.PlaneGeometry(1.05, 0.62)),
      mats.screenGlowMat,
    );
    screen.position.set(0, 0.39, 0.028);
    lidGroup.add(screen);

    const wallpaperBand = new THREE.Mesh(
      regGeo(new THREE.PlaneGeometry(0.92, 0.24)),
      mats.accentMat,
    );
    wallpaperBand.rotation.z = 0.22;
    wallpaperBand.position.set(0, 0.39, 0.031);
    lidGroup.add(wallpaperBand);
    return;
  }

  if (archetype === 'leather_satchel') {
    const body = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.88, 0.62, 0.32)),
      mats.primaryMat,
    );
    body.position.y = -0.12;
    root.add(body);

    const flap = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.9, 0.36, 0.34)),
      mats.secondaryMat,
    );
    flap.position.set(0, 0.06, 0.01);
    root.add(flap);

    const handle = new THREE.Mesh(
      regGeo(new THREE.TorusGeometry(0.18, 0.032, 10, 24, Math.PI)),
      mats.secondaryMat,
    );
    handle.position.set(0, 0.24, 0);
    root.add(handle);

    for (const side of [-1, 1] as const) {
      const strap = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(0.075, 0.44, 0.035)),
        mats.secondaryMat,
      );
      strap.position.set(side * 0.24, -0.08, 0.17);
      root.add(strap);

      const buckle = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(0.1, 0.09, 0.05)),
        mats.accentMat,
      );
      buckle.position.set(side * 0.24, -0.14, 0.18);
      root.add(buckle);
    }
    return;
  }

  if (archetype === 'fedora_hat') {
    addStand();
    const brim = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.62, 0.66, 0.045, 32)),
      mats.primaryMat,
    );
    brim.scale.set(1, 1, 1.12);
    brim.position.y = 0.04;
    root.add(brim);

    const crown = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.32, 0.38, 0.42, 28)),
      mats.primaryMat,
    );
    crown.scale.set(0.92, 1, 1.08);
    crown.position.y = 0.26;
    root.add(crown);

    const ribbon = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.365, 0.382, 0.095, 28)),
      mats.secondaryMat,
    );
    ribbon.scale.set(0.93, 1, 1.09);
    ribbon.position.y = 0.11;
    root.add(ribbon);

    const pin = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.06, 0.09, 0.04)),
      mats.accentMat,
    );
    pin.position.set(0.35, 0.11, 0);
    root.add(pin);
    return;
  }

  if (
    archetype === 'pourover_carafe' ||
    archetype === 'espresso_tin' ||
    archetype === 'ceramic_mug_set' ||
    archetype === 'botanical_diffuser' ||
    archetype === 'matcha_whisk_kit'
  ) {
    // Wooden serving coaster
    const tray = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.56, 0.6, 0.07, 28)),
      mats.woodMat,
    );
    tray.position.y = -0.68;
    root.add(tray);

    // Primary vessel / carafe / tin
    const lowerVessel = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.28, 0.42, 0.56, 28)),
      mats.primaryMat,
    );
    lowerVessel.position.y = -0.36;
    root.add(lowerVessel);

    // Collar / Label band
    const collar = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.24, 0.27, 0.26, 24)),
      mats.secondaryMat,
    );
    collar.position.y = 0.02;
    root.add(collar);

    const upperFlare = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.38, 0.23, 0.34, 28)),
      mats.accentMat,
    );
    upperFlare.position.y = 0.3;
    root.add(upperFlare);
    return;
  }

  if (archetype === 'urban_scooter') {
    // Stylized urban electric scooter silhouette on turntable
    const wheelGeo = regGeo(new THREE.TorusGeometry(0.24, 0.068, 14, 26));
    const frontWheel = new THREE.Mesh(wheelGeo, mats.darkMetalMat);
    frontWheel.position.set(0.46, -0.42, 0);
    root.add(frontWheel);

    const rearWheel = new THREE.Mesh(wheelGeo, mats.darkMetalMat);
    rearWheel.position.set(-0.46, -0.42, 0);
    root.add(rearWheel);

    const deck = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.88, 0.1, 0.26)),
      mats.secondaryMat,
    );
    deck.position.set(-0.02, -0.34, 0);
    root.add(deck);

    const rearBody = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.56, 0.34, 0.3)),
      mats.primaryMat,
    );
    rearBody.position.set(-0.34, -0.06, 0);
    root.add(rearBody);

    const seat = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.46, 0.1, 0.24)),
      mats.secondaryMat,
    );
    seat.position.set(-0.28, 0.16, 0);
    root.add(seat);

    const frontShield = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.22, 0.64, 0.28)),
      mats.primaryMat,
    );
    frontShield.position.set(0.36, 0.06, 0);
    frontShield.rotation.z = 0.22;
    root.add(frontShield);

    const handlebar = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.032, 0.032, 0.56, 12)),
      mats.darkMetalMat,
    );
    handlebar.rotation.x = Math.PI / 2;
    handlebar.position.set(0.28, 0.44, 0);
    root.add(handlebar);

    const headlamp = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 18)),
      mats.accentMat,
    );
    headlamp.rotation.z = Math.PI / 2;
    headlamp.position.set(0.46, 0.3, 0);
    root.add(headlamp);
    return;
  }

  if (archetype === 'apartment_deed' || archetype === 'shop_building') {
    // Clean architectural maquette on wooden plinth
    const plinth = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(1.18, 0.09, 0.96)),
      mats.woodMat,
    );
    plinth.position.y = -0.68;
    root.add(plinth);

    const mainBlock = new THREE.Mesh(
      regGeo(
        new THREE.BoxGeometry(
          archetype === 'shop_building' ? 0.88 : 0.96,
          archetype === 'shop_building' ? 0.96 : 0.78,
          0.72,
        ),
      ),
      mats.primaryMat,
    );
    mainBlock.position.y = archetype === 'shop_building' ? -0.15 : -0.24;
    root.add(mainBlock);

    const roofSlab = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(1.02, 0.08, 0.78)),
      mats.secondaryMat,
    );
    roofSlab.position.y = archetype === 'shop_building' ? 0.36 : 0.18;
    root.add(roofSlab);

    const glassBand = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.74, 0.24, 0.04)),
      mats.accentMat,
    );
    glassBand.position.set(0, -0.02, 0.37);
    root.add(glassBand);

    const entryDoor = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.22, 0.32, 0.05)),
      mats.secondaryMat,
    );
    entryDoor.position.set(0, -0.46, 0.37);
    root.add(entryDoor);
    return;
  }

  if (archetype === 'lounge_furniture') {
    // Low modern lounge sofa / credenza maquette
    const baseFrame = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(1.18, 0.16, 0.62)),
      mats.woodMat,
    );
    baseFrame.position.y = -0.36;
    root.add(baseFrame);

    const seatCushion = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(1.08, 0.22, 0.54)),
      mats.primaryMat,
    );
    seatCushion.position.y = -0.17;
    root.add(seatCushion);

    const backrest = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(1.08, 0.42, 0.18)),
      mats.primaryMat,
    );
    backrest.position.set(0, 0.12, -0.22);
    root.add(backrest);

    const pillow = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.26, 0.24, 0.12)),
      mats.accentMat,
    );
    pillow.position.set(-0.32, 0.08, -0.06);
    pillow.rotation.z = 0.16;
    root.add(pillow);

    const legGeo = regGeo(new THREE.CylinderGeometry(0.032, 0.025, 0.24, 12));
    for (const [lx, lz] of [
      [-0.48, -0.22],
      [0.48, -0.22],
      [-0.48, 0.22],
      [0.48, 0.22],
    ]) {
      const leg = new THREE.Mesh(legGeo, mats.secondaryMat);
      leg.position.set(lx, -0.54, lz);
      root.add(leg);
    }
    return;
  }

  if (archetype === 'beauty_palette') {
    // Cream vanity plinth + open studio compact palette + brass lipstick cylinder
    const tray = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.68, 0.72, 0.06, 32)),
      mats.woodMat,
    );
    tray.position.y = -0.66;
    root.add(tray);

    const caseBase = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.86, 0.1, 0.62)),
      mats.secondaryMat,
    );
    caseBase.position.set(-0.08, -0.56, 0.06);
    root.add(caseBase);

    const lidGroup = new THREE.Group();
    lidGroup.position.set(-0.08, -0.51, -0.25);
    lidGroup.rotation.x = -0.45;
    root.add(lidGroup);

    const lidBack = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.86, 0.58, 0.045)),
      mats.secondaryMat,
    );
    lidBack.position.set(0, 0.29, 0);
    lidGroup.add(lidBack);

    const mirrorFace = new THREE.Mesh(
      regGeo(new THREE.PlaneGeometry(0.76, 0.48)),
      mats.screenGlowMat,
    );
    mirrorFace.position.set(0, 0.29, 0.026);
    lidGroup.add(mirrorFace);

    // 4 sculpted pigment pans
    const panOffsets: Array<[number, number, THREE.Material]> = [
      [-0.28, -0.06, mats.primaryMat],
      [-0.08, -0.06, mats.accentMat],
      [0.12, -0.06, mats.primaryMat],
      [-0.18, 0.16, mats.accentMat],
    ];
    for (const [px, pz, pMat] of panOffsets) {
      const pan = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.095, 0.095, 0.04, 20)),
        pMat,
      );
      pan.position.set(px, -0.5, pz);
      root.add(pan);
    }

    // Standing brass lipstick tube beside compact
    const tubeBase = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.085, 0.085, 0.34, 18)),
      mats.brassMat,
    );
    tubeBase.position.set(0.46, -0.46, 0.14);
    root.add(tubeBase);

    const lipstickTip = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.062, 0.068, 0.22, 16)),
      mats.primaryMat,
    );
    lipstickTip.position.set(0.46, -0.2, 0.14);
    lipstickTip.rotation.z = 0.12;
    root.add(lipstickTip);
    return;
  }

  if (archetype === 'flower_bouquet') {
    // Linen kraft wrap cone + ribbon collar + lush clustered blooms & greenery
    const wrapCone = new THREE.Mesh(
      regGeo(new THREE.ConeGeometry(0.44, 0.96, 22, 1, true)),
      mats.accentMat,
    );
    wrapCone.rotation.x = Math.PI;
    wrapCone.position.set(0, -0.24, 0);
    root.add(wrapCone);

    const ribbonBand = new THREE.Mesh(
      regGeo(new THREE.TorusGeometry(0.16, 0.036, 12, 24)),
      mats.primaryMat,
    );
    ribbonBand.rotation.x = Math.PI / 2;
    ribbonBand.position.set(0, -0.44, 0);
    root.add(ribbonBand);

    const stemOffsets: Array<[number, number, number, number]> = [
      [0, 0.34, 0, 0.17],
      [-0.2, 0.24, 0.12, 0.14],
      [0.2, 0.25, 0.1, 0.14],
      [-0.14, 0.26, -0.16, 0.135],
      [0.16, 0.22, -0.15, 0.135],
      [0, 0.2, 0.22, 0.13],
    ];
    for (const [bx, by, bz, radius] of stemOffsets) {
      const bloom = new THREE.Mesh(
        regGeo(new THREE.DodecahedronGeometry(radius, 1)),
        mats.primaryMat,
      );
      bloom.position.set(bx, by, bz);
      root.add(bloom);

      const core = new THREE.Mesh(
        regGeo(new THREE.SphereGeometry(radius * 0.45, 10, 10)),
        mats.secondaryMat,
      );
      core.position.set(bx, by + radius * 0.35, bz);
      root.add(core);
    }

    const leafOffsets: Array<[number, number, number, number]> = [
      [-0.3, 0.14, 0.04, 0.65],
      [0.31, 0.15, -0.02, -0.65],
      [0.02, 0.18, -0.28, 0.35],
      [-0.08, 0.12, 0.28, -0.4],
    ];
    for (const [lx, ly, lz, rotZ] of leafOffsets) {
      const leaf = new THREE.Mesh(
        regGeo(new THREE.SphereGeometry(0.13, 10, 8)),
        mats.secondaryMat,
      );
      leaf.scale.set(0.55, 1.45, 0.28);
      leaf.position.set(lx, ly, lz);
      leaf.rotation.z = rotZ;
      root.add(leaf);
    }
    return;
  }

  if (archetype === 'gift_box') {
    // Ribboned keepsake gift box with lid and satin bow
    const boxBody = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.92, 0.54, 0.72)),
      mats.primaryMat,
    );
    boxBody.position.y = -0.34;
    root.add(boxBody);

    const lid = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.98, 0.14, 0.78)),
      mats.secondaryMat,
    );
    lid.position.y = -0.01;
    root.add(lid);

    const ribbonX = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(1.0, 0.69, 0.12)),
      mats.accentMat,
    );
    ribbonX.position.y = -0.27;
    root.add(ribbonX);

    const ribbonZ = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.12, 0.69, 0.8)),
      mats.accentMat,
    );
    ribbonZ.position.y = -0.27;
    root.add(ribbonZ);

    for (const side of [-1, 1] as const) {
      const bowLoop = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(0.14, 0.036, 10, 20)),
        mats.accentMat,
      );
      bowLoop.position.set(side * 0.13, 0.14, 0);
      bowLoop.rotation.y = side * 0.4;
      bowLoop.rotation.z = side * -0.28;
      root.add(bowLoop);
    }
    return;
  }

  if (archetype === 'motion_pose') {
    // Minimal sleek black editorial silhouette stand-in if GLB avatar is unavailable
    const head = new THREE.Mesh(
      regGeo(new THREE.SphereGeometry(0.13, 18, 16)),
      mats.darkMetalMat,
    );
    head.position.set(0.02, 0.56, 0);
    root.add(head);

    const torso = new THREE.Mesh(
      regGeo(new THREE.CapsuleGeometry(0.115, 0.34, 8, 16)),
      mats.darkMetalMat,
    );
    torso.position.set(0, 0.16, 0);
    torso.rotation.z = -0.06;
    root.add(torso);

    const leftArm = new THREE.Mesh(
      regGeo(new THREE.CapsuleGeometry(0.042, 0.38, 6, 12)),
      mats.darkMetalMat,
    );
    leftArm.position.set(-0.2, 0.36, 0.03);
    leftArm.rotation.z = 0.72;
    root.add(leftArm);

    const rightArm = new THREE.Mesh(
      regGeo(new THREE.CapsuleGeometry(0.042, 0.4, 6, 12)),
      mats.darkMetalMat,
    );
    rightArm.position.set(0.19, 0.06, -0.02);
    rightArm.rotation.z = -0.14;
    root.add(rightArm);

    const leftLeg = new THREE.Mesh(
      regGeo(new THREE.CapsuleGeometry(0.052, 0.54, 6, 12)),
      mats.darkMetalMat,
    );
    leftLeg.position.set(-0.08, -0.42, 0.02);
    leftLeg.rotation.z = 0.06;
    root.add(leftLeg);

    const rightLeg = new THREE.Mesh(
      regGeo(new THREE.CapsuleGeometry(0.052, 0.54, 6, 12)),
      mats.darkMetalMat,
    );
    rightLeg.position.set(0.1, -0.42, -0.03);
    rightLeg.rotation.z = -0.1;
    root.add(rightLeg);
    return;
  }

  // Flagship phone / earbuds / Hi-Fi speaker fallback sculpture
  const monolith = new THREE.Mesh(
    regGeo(new THREE.BoxGeometry(0.64, 1.12, 0.24)),
    mats.primaryMat,
  );
  monolith.position.y = -0.04;
  root.add(monolith);

  const screenFace = new THREE.Mesh(
    regGeo(new THREE.BoxGeometry(0.56, 0.98, 0.03)),
    mats.secondaryMat,
  );
  screenFace.position.set(0, -0.04, 0.125);
  root.add(screenFace);

  const accentBadge = new THREE.Mesh(
    regGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 24)),
    mats.accentMat,
  );
  accentBadge.rotation.x = Math.PI / 2;
  accentBadge.position.set(0, 0.14, 0.14);
  root.add(accentBadge);
}

function fitObjectIntoTurntableStage(obj: THREE.Object3D, maxExtent = 1.62): THREE.Group {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 0.01);
  const scale = maxExtent / maxDim;

  const wrapper = new THREE.Group();
  obj.position.set(
    -center.x * scale,
    -box.min.y * scale - 0.8,
    -center.z * scale,
  );
  obj.scale.multiplyScalar(scale);
  wrapper.add(obj);
  return wrapper;
}

function buildNormalizedOutfitTurntableGroup(
  gltfScene: THREE.Group,
  glbPath: string,
): { group: THREE.Group; disposables: Array<{ dispose: () => void }> } | null {
  const slotFilter = parseModularAssetSlotFragment(glbPath);
  const cloned = SkeletonUtils.clone(gltfScene) as THREE.Group;
  const visibleMeshes: THREE.Mesh[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  cloned.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const m = node as THREE.Mesh;
      const lower = (m.name || '').toLowerCase();
      if (
        lower.includes('outline') ||
        lower.includes('_skin') ||
        lower.includes('basedoll') ||
        lower.startsWith('head_') ||
        lower.startsWith('ears_')
      ) {
        m.visible = false;
        return;
      }
      if (slotFilter) {
        const meshSlot = classifyDefaultAvatarSlotFromMeshName(m.name);
        const keep =
          slotFilter === 'costume'
            ? meshSlot === 'torso' ||
              meshSlot === 'legs' ||
              meshSlot === 'feet' ||
              meshSlot === 'hands' ||
              meshSlot === 'neck'
            : meshSlot === slotFilter;
        if (!keep) {
          m.visible = false;
          return;
        }
      }
      if (Array.isArray(m.material)) {
        m.material = m.material.map((mat) => {
          const matClone = mat.clone();
          matClone.side = THREE.DoubleSide;
          disposables.push(matClone);
          return matClone;
        });
      } else if (m.material) {
        const matClone = m.material.clone();
        matClone.side = THREE.DoubleSide;
        disposables.push(matClone);
        m.material = matClone;
      }
      m.visible = true;
      m.frustumCulled = false;
      visibleMeshes.push(m);
    }
  });

  if (visibleMeshes.length === 0) {
    return null;
  }

  cloned.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const meshBox = new THREE.Box3();
  for (const vm of visibleMeshes) {
    const skinned = vm as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh && skinned.skeleton) {
      skinned.skeleton.update();
    }
    if (!vm.geometry.boundingBox) {
      vm.geometry.computeBoundingBox();
    }
    if (vm.geometry.boundingBox) {
      meshBox.copy(vm.geometry.boundingBox).applyMatrix4(vm.matrixWorld);
      box.union(meshBox);
    } else {
      box.expandByObject(vm);
    }
  }

  if (box.isEmpty()) {
    for (const d of disposables) d.dispose();
    return null;
  }

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x * 1.02, size.y, size.z, 0.08);
  const scale = 1.52 / maxDim;
  const scaledHeight = size.y * scale;
  const offsetY =
    scaledHeight >= 1.18
      ? -box.min.y * scale - 0.78
      : -center.y * scale - 0.05;

  const wrapper = new THREE.Group();
  cloned.scale.multiplyScalar(scale);
  cloned.position.set(-center.x * scale, offsetY, -center.z * scale);
  wrapper.add(cloned);
  return { group: wrapper, disposables };
}

export const ShopProduct3DTurntable: React.FC<ShopProduct3DTurntableProps> = ({
  archetype,
  primaryHex,
  secondaryHex,
  accentHex,
  stageBgHex,
  previewGlbPath,
  previewFurnitureId,
  previewScooterKind,
  previewCafeFoodId,
  previewGiftKind,
  previewMotionItemId,
  previewImageUrl,
  previewThumbFlipY,
  previewImageAlt,
}) => {
  const isImageOnlyMode = Boolean(
    previewImageUrl &&
      !previewGlbPath &&
      !previewFurnitureId &&
      !previewScooterKind &&
      !previewCafeFoodId &&
      !previewGiftKind &&
      !previewMotionItemId,
  );
  const mountRef = useRef<HTMLDivElement | null>(null);
  const matsRef = useRef<DynamicTurntableMaterials | null>(null);
  const rebuildModelRef = useRef<
    | ((opts: {
        archetype: StoreProduct3DArchetype;
        glbPath?: string;
        furnitureId?: string;
        scooterKind?: 'electric_scooter_bike' | 'push_kick_scooter';
        cafeFoodId?: CafeMenuItemId;
        giftKind?: CentralPlazaGiftPreviewKind;
        motionItemId?: string;
      }) => void)
    | null
  >(null);

  useEffect(() => {
    if (isImageOnlyMode) return;
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    camera.position.set(0, 0.38, 3.35);
    camera.lookAt(0, -0.06, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));

    const updateSize = () => {
      const w = Math.max(200, container.clientWidth || 320);
      const h = Math.max(200, container.clientHeight || 300);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    updateSize();
    container.innerHTML = '';
    renderer.domElement.className = 'w-full h-full block cursor-grab active:cursor-grabbing';
    container.appendChild(renderer.domElement);

    // Warm / cool studio 3-point lighting rig
    const hemiLight = new THREE.HemisphereLight(0xfff9ee, 0xd8cab8, 1.35);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e4, 2.1);
    keyLight.position.set(2.8, 4.2, 3.4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe2eefc, 0.95);
    fillLight.position.set(-3.0, 2.0, 2.2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffe7c4, 0.85);
    rimLight.position.set(0.5, 2.6, -3.2);
    scene.add(rimLight);

    // Soft radial contact shadow plane beneath turntable
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext('2d');
    if (sctx) {
      const grad = sctx.createRadialGradient(64, 64, 6, 64, 64, 60);
      grad.addColorStop(0, 'rgba(38, 26, 16, 0.34)');
      grad.addColorStop(0.55, 'rgba(38, 26, 16, 0.14)');
      grad.addColorStop(1, 'rgba(38, 26, 16, 0.0)');
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowGeo = new THREE.PlaneGeometry(1.65, 1.65);
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.87;
    scene.add(shadowMesh);

    const mats: DynamicTurntableMaterials = {
      primaryMat: new THREE.MeshStandardMaterial({
        color: new THREE.Color(primaryHex),
        roughness: 0.42,
        metalness: 0.14,
      }),
      secondaryMat: new THREE.MeshStandardMaterial({
        color: new THREE.Color(secondaryHex),
        roughness: 0.35,
        metalness: 0.25,
      }),
      accentMat: new THREE.MeshStandardMaterial({
        color: new THREE.Color(accentHex),
        roughness: 0.26,
        metalness: 0.45,
        emissive: new THREE.Color(accentHex),
        emissiveIntensity: 0.12,
      }),
      woodMat: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#8A562E'),
        roughness: 0.52,
        metalness: 0.08,
      }),
      brassMat: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#D5AA4E'),
        roughness: 0.24,
        metalness: 0.78,
      }),
      darkMetalMat: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1E2128'),
        roughness: 0.38,
        metalness: 0.42,
      }),
      screenGlowMat: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#E8F5FF'),
        emissive: new THREE.Color('#BCE3FF'),
        emissiveIntensity: 0.45,
        roughness: 0.18,
      }),
    };
    matsRef.current = mats;

    const turntableGroup = new THREE.Group();
    scene.add(turntableGroup);

    const meshDisposables: Array<{ dispose: () => void }> = [];
    let activeMotionHandle: LiveMotionSilhouetteHandle | null = null;
    let loadSeq = 0;
    const clearMeshes = () => {
      if (activeMotionHandle) {
        activeMotionHandle.dispose();
        activeMotionHandle = null;
      }
      turntableGroup.clear();
      for (const d of meshDisposables) d.dispose();
      meshDisposables.length = 0;
    };

    const buildModel = (opts: {
      archetype: StoreProduct3DArchetype;
      glbPath?: string;
      furnitureId?: string;
      scooterKind?: 'electric_scooter_bike' | 'push_kick_scooter';
      cafeFoodId?: CafeMenuItemId;
      giftKind?: CentralPlazaGiftPreviewKind;
      motionItemId?: string;
    }) => {
      const seq = ++loadSeq;
      if (opts.motionItemId) {
        void createLiveMotionSilhouettePreview(opts.motionItemId, isSoftwareGl).then((handle) => {
          if (seq !== loadSeq) {
            handle?.dispose();
            return;
          }
          clearMeshes();
          if (!handle) {
            populateArchetypeMesh(turntableGroup, opts.archetype, mats, meshDisposables);
            return;
          }
          activeMotionHandle = handle;
          turntableGroup.add(handle.group);
          if (!isDragging) {
            targetYaw = -0.22;
            currentYaw = -0.22;
          }
        });
        return;
      }

      clearMeshes();

      if (opts.cafeFoodId) {
        try {
          const foodRoot = createCafeFoodPropMesh(opts.cafeFoodId);
          foodRoot.traverse((node) => {
            const mesh = node as THREE.Mesh;
            if (mesh.isMesh && mesh.geometry) meshDisposables.push(mesh.geometry);
          });
          turntableGroup.add(fitObjectIntoTurntableStage(foodRoot, 1.48));
          return;
        } catch {
          // fall back to procedural archetype below
        }
      }

      if (opts.scooterKind) {
        const scooterRoot =
          opts.scooterKind === 'electric_scooter_bike'
            ? createElectricScooterBike3D({
                parked: true,
                steerAngleRad: -0.14,
                includeContactShadow: false,
              }).root
            : createPushKickScooter3D({
                parked: true,
                folded: false,
                steerAngleRad: -0.16,
                includeContactShadow: false,
              }).root;
        scooterRoot.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (mesh.isMesh && mesh.geometry) meshDisposables.push(mesh.geometry);
        });
        turntableGroup.add(fitObjectIntoTurntableStage(scooterRoot, 1.72));
        return;
      }

      if (opts.furnitureId) {
        try {
          const furnRoot = buildOriginalBuddiesCatalogFurnitureMesh(opts.furnitureId);
          furnRoot.traverse((node) => {
            const mesh = node as THREE.Mesh;
            if (mesh.isMesh && mesh.geometry) meshDisposables.push(mesh.geometry);
          });
          turntableGroup.add(fitObjectIntoTurntableStage(furnRoot, 1.56));
          return;
        } catch {
          // fall back to procedural archetype below
        }
      }

      if (opts.glbPath) {
        const isOutfitGlb = opts.glbPath.includes('/assets/outfit/');
        if (isOutfitGlb) {
          void loadModularApparelGltf(opts.glbPath).then((gltf) => {
            if (seq !== loadSeq) return;
            const built = gltf?.scene
              ? buildNormalizedOutfitTurntableGroup(gltf.scene, opts.glbPath!)
              : null;
            clearMeshes();
            if (!built) {
              populateArchetypeMesh(turntableGroup, opts.archetype, mats, meshDisposables);
              return;
            }
            for (const d of built.disposables) meshDisposables.push(d);
            turntableGroup.add(built.group);
          });
          return;
        }

        void loadCachedDioramaBuildingGlb(opts.glbPath).then((template) => {
          if (seq !== loadSeq) return;
          if (!template) {
            clearMeshes();
            populateArchetypeMesh(turntableGroup, opts.archetype, mats, meshDisposables);
            return;
          }
          clearMeshes();
          const clone = SkeletonUtils.clone(template) as THREE.Group;
          turntableGroup.add(fitObjectIntoTurntableStage(clone, 1.7));
        });
        return;
      }

      const resolvedArchetype: StoreProduct3DArchetype = opts.giftKind
        ? opts.giftKind.includes('bouquet')
          ? 'flower_bouquet'
          : 'gift_box'
        : opts.archetype;
      populateArchetypeMesh(turntableGroup, resolvedArchetype, mats, meshDisposables);
    };

    let isDragging = false;
    let lastClientX = 0;
    let targetYaw = previewMotionItemId ? -0.22 : -0.32;
    let currentYaw = previewMotionItemId ? -0.22 : -0.32;
    let lastInteractMs = 0;

    buildModel({
      archetype,
      glbPath: previewGlbPath,
      furnitureId: previewFurnitureId,
      scooterKind: previewScooterKind,
      cafeFoodId: previewCafeFoodId,
      giftKind: previewGiftKind,
      motionItemId: previewMotionItemId,
    });
    rebuildModelRef.current = buildModel;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      lastClientX = e.clientX;
      lastInteractMs = performance.now();
      renderer.domElement.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastClientX;
      lastClientX = e.clientX;
      targetYaw += dx * 0.014;
      lastInteractMs = performance.now();
    };
    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      renderer.domElement.releasePointerCapture?.(e.pointerId);
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    domEl.addEventListener('pointermove', onPointerMove);
    domEl.addEventListener('pointerup', onPointerUp);
    domEl.addEventListener('pointercancel', onPointerUp);

    const resizeObs =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateSize()) : null;
    resizeObs?.observe(container);

    let frameId = 0;
    let prevTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.08, Math.max(0.001, (now - prevTime) * 0.001));
      prevTime = now;

      if (activeMotionHandle) {
        activeMotionHandle.update(dt);
        if (!isDragging && now - lastInteractMs > 1600) {
          targetYaw += dt * 0.24;
        }
        currentYaw = THREE.MathUtils.damp(currentYaw, targetYaw, 10, dt);
        turntableGroup.rotation.y = currentYaw;
        turntableGroup.position.y = 0;
      } else {
        if (!isDragging && now - lastInteractMs > 1200) {
          targetYaw += dt * 0.42;
        }
        currentYaw = THREE.MathUtils.damp(currentYaw, targetYaw, 10, dt);
        turntableGroup.rotation.y = currentYaw;
        turntableGroup.position.y = Math.sin(now * 0.0022) * 0.025;
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        frameId = window.setTimeout(tick, 75);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    };
    tick();

    return () => {
      loadSeq++;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObs?.disconnect();
      domEl.removeEventListener('pointerdown', onPointerDown);
      domEl.removeEventListener('pointermove', onPointerMove);
      domEl.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('pointercancel', onPointerUp);
      clearMeshes();
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
      Object.values(mats).forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      matsRef.current = null;
      rebuildModelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImageOnlyMode]);

  // Rebuild geometry cleanly when product model or archetype switches
  useEffect(() => {
    if (isImageOnlyMode) return;
    rebuildModelRef.current?.({
      archetype,
      glbPath: previewGlbPath,
      furnitureId: previewFurnitureId,
      scooterKind: previewScooterKind,
      cafeFoodId: previewCafeFoodId,
      giftKind: previewGiftKind,
      motionItemId: previewMotionItemId,
    });
  }, [
    isImageOnlyMode,
    archetype,
    previewGlbPath,
    previewFurnitureId,
    previewScooterKind,
    previewCafeFoodId,
    previewGiftKind,
    previewMotionItemId,
  ]);

  // Real-time material swap when color variant pill changes
  useEffect(() => {
    const mats = matsRef.current;
    if (!mats) return;
    mats.primaryMat.color.set(primaryHex);
    mats.secondaryMat.color.set(secondaryHex);
    mats.accentMat.color.set(accentHex);
    mats.accentMat.emissive.set(accentHex);
  }, [primaryHex, secondaryHex, accentHex]);

  if (isImageOnlyMode && previewImageUrl) {
    const isBeautyPreview = Boolean(previewThumbFlipY) || previewImageUrl.includes('/assets/beauty/');
    return (
      <div
        key="image-preview-stage"
        className="relative w-full h-[290px] sm:h-[315px] rounded-[24px] flex flex-col items-center justify-between p-4 overflow-hidden select-none"
        style={{ backgroundColor: stageBgHex }}
      >
        <div
          className={`relative w-full flex-1 min-h-0 rounded-[18px] overflow-hidden border border-black/10 ${
            isBeautyPreview ? 'bg-[#FAF6F0]' : 'bg-black/5'
          }`}
        >
          <img
            src={previewImageUrl}
            alt={previewImageAlt || 'Product preview'}
            className={`absolute inset-0 w-full h-full ${
              isBeautyPreview ? 'object-contain p-5' : 'object-cover'
            } ${previewThumbFlipY ? 'scale-y-[-1]' : ''}`}
          />
        </div>
        <p className="mt-2 shrink-0 text-[11.5px] font-medium tracking-wide text-[#7E6D5E] pointer-events-none">
          {isBeautyPreview ? 'Studio Beauty Preview' : 'Architectural Preview'}
        </p>
      </div>
    );
  }

  return (
    <div
      key="webgl-turntable-stage"
      className="relative w-full h-[290px] sm:h-[315px] rounded-[24px] flex flex-col items-center justify-between p-4 overflow-hidden select-none"
      style={{ backgroundColor: stageBgHex }}
    >
      <div ref={mountRef} className="w-full flex-1 min-h-0" />
      <p className="shrink-0 text-[11.5px] font-medium tracking-wide text-[#7E6D5E] pointer-events-none">
        ‹ drag to rotate ›
      </p>
    </div>
  );
};

// Module-level GLB template cache so switching between Home and Shop tabs is instant (0 re-downloads)
const dioramaGltfLoader = new GLTFLoader();
const dioramaGlbTemplateCache = new Map<string, Promise<THREE.Group | null>>();

function loadCachedDioramaBuildingGlb(glbPath: string): Promise<THREE.Group | null> {
  const existing = dioramaGlbTemplateCache.get(glbPath);
  if (existing) return existing;

  const promise = new Promise<THREE.Group | null>((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    dioramaGltfLoader.load(
      glbPath,
      (gltf) => {
        const root = gltf.scene;
        root.updateMatrixWorld(true);
        // Normalize & center building footprint at origin (y = 0 at base)
        const box = new THREE.Box3().setFromObject(root);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 1);
        const normScale = 2.05 / maxDim;

        const wrapper = new THREE.Group();
        root.position.set(-center.x * normScale, -box.min.y * normScale, -center.z * normScale);
        root.scale.setScalar(normScale);
        wrapper.add(root);
        resolve(wrapper);
      },
      undefined,
      () => {
        dioramaGlbTemplateCache.delete(glbPath);
        resolve(null);
      },
    );
  });

  dioramaGlbTemplateCache.set(glbPath, promise);
  return promise;
}

function createEditorialBillboardTexture(
  brandName: string,
  brandCategory: string,
  accentHex: string,
  formId: ShopBuildingFormId,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const isTech = formId === 'glass_corner_3story';
    ctx.fillStyle = isTech ? '#111827' : '#F7F2E8';
    ctx.fillRect(0, 0, 512, 192);

    // Subtle border frame
    ctx.strokeStyle = isTech ? accentHex : '#2B1D16';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 492, 172);

    // Accent badge circle on right
    ctx.fillStyle = accentHex;
    ctx.beginPath();
    ctx.arc(425, 96, 44, 0, Math.PI * 2);
    ctx.fill();

    // Brand category kicker
    ctx.fillStyle = isTech ? '#7DD3FC' : accentHex;
    ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(brandCategory.toUpperCase().slice(0, 26), 34, 64);

    // Main brand name
    ctx.fillStyle = isTech ? '#FFFFFF' : '#231812';
    ctx.font = 'bold 38px "Playfair Display", Georgia, serif';
    ctx.fillText(brandName.slice(0, 20), 32, 114);

    // Tagline strip
    ctx.fillStyle = isTech ? '#9CA3AF' : '#6E5D4F';
    ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('CERRIA COMMERCIAL AVENUE · VERIFIED STOREFRONT', 34, 148);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

let cachedWestPlazaArcadeTemplate: THREE.Group | null = null;

function createSimpleMitredStripGeo(
  pts: [number, number][],
  width: number,
  height: number,
): THREE.BufferGeometry {
  if (pts.length < 2) return new THREE.BoxGeometry(width, height, width);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const spanX = Math.max(width, maxX - minX + width);
  const spanZ = Math.max(width, maxZ - minZ + width);
  const geo = new THREE.BoxGeometry(spanX, height, spanZ);
  geo.translate((minX + maxX) * 0.5, height * 0.5, (minZ + maxZ) * 0.5);
  return geo;
}

function getCachedWestPlazaArcadeTemplate(): THREE.Group {
  if (cachedWestPlazaArcadeTemplate) return cachedWestPlazaArcadeTemplate;

  const tempParent = new THREE.Group();
  const sharedClearGlassMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.34,
    roughness: 0.14,
    metalness: 0.08,
  });

  const arcadeGrp = buildPlazaCommercialArcade3D({
    westPlantGroup: tempParent,
    isSoftwareGl: true,
    sharedClearGlassMat,
    createMitredPolylineStripGeometry: createSimpleMitredStripGeo,
    addLobbyPart: (parent, geo, colorHex, pos, rot = [0, 0, 0], _stroke, tex, bumpScale) => {
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        map: tex ?? null,
        bumpMap: tex && bumpScale ? tex : null,
        bumpScale: bumpScale ? Math.min(0.06, bumpScale * 0.02) : 0,
        roughness: 0.62,
        metalness: 0.06,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.rotation.set(rot[0], rot[1], rot[2]);
      parent.add(mesh);
      return mesh;
    },
    createBlitzStrokeMesh: () => null,
    textures: {},
  });

  // Reset world offset and orient the 3-bay storefront facade toward +Z camera
  arcadeGrp.position.set(0, 0, 0);
  arcadeGrp.rotation.set(0, 0, 0);

  const normalizedWrapper = new THREE.Group();
  normalizedWrapper.add(arcadeGrp);
  normalizedWrapper.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(arcadeGrp);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Fit wide 3-bay arcade boldly across the editorial diorama stage
  const maxSpan = Math.max(size.x, size.z, 1);
  const targetSpan = 3.25;
  const scale = targetSpan / maxSpan;

  arcadeGrp.scale.setScalar(scale);
  arcadeGrp.position.set(
    -center.x * scale,
    -box.min.y * scale,
    -center.z * scale,
  );
  normalizedWrapper.updateMatrixWorld(true);

  cachedWestPlazaArcadeTemplate = normalizedWrapper;
  return normalizedWrapper;
}

let cachedCentralPlazaTrioPromise: Promise<THREE.Group | null> | null = null;

function loadCachedCentralPlazaTrioTemplate(): Promise<THREE.Group | null> {
  if (cachedCentralPlazaTrioPromise) return cachedCentralPlazaTrioPromise;

  cachedCentralPlazaTrioPromise = Promise.all([
    loadCachedDioramaBuildingGlb(GLOW_STUDIO_SALON_GLB_PATH),
    loadCachedDioramaBuildingGlb(BITES_SIPS_PAVILION_GLB_PATH),
    loadCachedDioramaBuildingGlb(VINTAGE_CAFE_GLB_PATH),
  ]).then(([glowTpl, bitesTpl, redTpl]) => {
    if (!glowTpl && !bitesTpl && !redTpl) {
      cachedCentralPlazaTrioPromise = null;
      return null;
    }

    const trio = new THREE.Group();
    const fitSubBuilding = (
      tpl: THREE.Group | null,
      targetWidth: number,
      posX: number,
      posZ: number,
    ) => {
      if (!tpl) return;
      const clone = tpl.clone(true);
      clone.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(clone);
      const s = new THREE.Vector3();
      const c = new THREE.Vector3();
      b.getSize(s);
      b.getCenter(c);
      const widthScale = targetWidth / Math.max(s.x, 0.25);
      clone.scale.multiplyScalar(widthScale);
      clone.position.set(
        posX - c.x * widthScale,
        -b.min.y * widthScale + 0.04,
        posZ - c.z * widthScale,
      );
      trio.add(clone);
    };

    // Place the 3 iconic Central Plaza facades side-by-side facing +Z:
    // Left: Glow Studio | Center: Cerria Bites & Sips | Right: Red Studio Building
    fitSubBuilding(glowTpl, 1.04, -1.16, 0.04);
    fitSubBuilding(bitesTpl, 1.08, 0.0, 0.06);
    fitSubBuilding(redTpl, 1.02, 1.14, -0.02);

    // Subtle terrazzo promenade strip linking all three buildings cleanly
    const plinthMat = new THREE.MeshStandardMaterial({
      color: '#EAE2D6',
      roughness: 0.78,
      metalness: 0.04,
    });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.05, 1.45), plinthMat);
    plinth.position.set(0, 0.025, 0.02);
    trio.add(plinth);

    const normalizedWrapper = new THREE.Group();
    normalizedWrapper.add(trio);
    normalizedWrapper.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(trio);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxSpan = Math.max(size.x, size.z, 1);
    const targetSpan = 3.25;
    const scale = targetSpan / maxSpan;
    trio.scale.setScalar(scale);
    trio.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    normalizedWrapper.updateMatrixWorld(true);

    return normalizedWrapper;
  });

  return cachedCentralPlazaTrioPromise;
}

/**
 * Real 3D Building Diorama (`alpha: true` transparent background) using On-Demand Rendering.
 * Consumes 0% idle GPU/CPU once rendered, and smoothly orbits on pointer drag.
 */
export const ShopBuilding3DDiorama: React.FC<ShopBuilding3DDioramaProps> = ({
  formSpec,
  customGlbPath,
  customDioramaMode = 'lot_glb',
  brandName,
  brandCategory,
  accentHex,
  billboardLogoUrl,
  compact = false,
  fullBleed = false,
  viewPreset = 'home',
  cornerAnchorRef,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const requestRenderRef = useRef<(() => void) | null>(null);
  const syncPoseTargetRef = useRef<((resetDrag: boolean) => void) | null>(null);
  const viewPresetRef = useRef<ShopBuildingDioramaViewPreset>(viewPreset);
  const cornerAnchorRefHolder = useRef<React.RefObject<HTMLDivElement | null> | undefined>(
    cornerAnchorRef,
  );
  cornerAnchorRefHolder.current = cornerAnchorRef;
  const billboardMatsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    const scene = new THREE.Scene();
    const isWestPlazaArcade = customDioramaMode === 'west_plaza_arcade';
    const isCentralPlazaTrio = customDioramaMode === 'central_plaza_trio';
    const isWideDistrictDiorama = isWestPlazaArcade || isCentralPlazaTrio;
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
    if (fullBleed) {
      camera.position.set(0, 1.48, 6.45);
      camera.lookAt(0, 0.44, 0);
    } else if (isWideDistrictDiorama) {
      if (compact) {
        camera.position.set(0.48, 1.05, 4.35);
        camera.lookAt(0, 0.36, 0);
      } else {
        camera.position.set(0.42, 0.92, 3.65);
        camera.lookAt(0, 0.34, 0);
      }
    } else {
      camera.position.set(0.55, 1.32, 4.35);
      camera.lookAt(0, 0.88, 0);
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));

    const updateSize = () => {
      const w = Math.max(180, container.clientWidth || (fullBleed ? 1200 : compact ? 280 : 380));
      const h = Math.max(150, container.clientHeight || (fullBleed ? 760 : compact ? 205 : 300));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      renderer.setSize(w, h, false);
    };
    updateSize();
    container.innerHTML = '';
    renderer.domElement.className = 'w-full h-full block cursor-grab active:cursor-grabbing';
    container.appendChild(renderer.domElement);

    // Warm editorial studio lighting rig
    const hemi = new THREE.HemisphereLight(0xfffaf0, 0xd8cbb8, 1.45);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff4e0, 2.25);
    sun.position.set(3.5, 5.2, 4.0);
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0xe4f1ff, 0.95);
    fill.position.set(-3.4, 2.4, 2.6);
    scene.add(fill);

    const dioramaRoot = new THREE.Group();
    scene.add(dioramaRoot);

    // Soft radial contact shadow + miniature sidewalk plinth & vintage streetlamp
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext('2d');
    if (sctx) {
      const grad = sctx.createRadialGradient(64, 64, 10, 64, 64, 62);
      grad.addColorStop(0, 'rgba(35, 24, 16, 0.30)');
      grad.addColorStop(0.65, 'rgba(35, 24, 16, 0.12)');
      grad.addColorStop(1, 'rgba(35, 24, 16, 0.0)');
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowGeo = new THREE.PlaneGeometry(
      isWideDistrictDiorama ? 3.55 : 3.1,
      isWideDistrictDiorama ? 1.85 : 2.6,
    );
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.01;
    dioramaRoot.add(shadowMesh);

    // Miniature vintage streetlamp next to building (matches video diorama charm)
    const lampPoleGeo = new THREE.CylinderGeometry(0.018, 0.028, 0.72, 10);
    const lampPoleMat = new THREE.MeshStandardMaterial({
      color: '#1F1B18',
      roughness: 0.4,
      metalness: 0.6,
    });
    const lampPole = new THREE.Mesh(lampPoleGeo, lampPoleMat);
    lampPole.position.set(1.28, 0.36, 0.78);
    lampPole.visible = !isWideDistrictDiorama;
    dioramaRoot.add(lampPole);

    const lampCapGeo = new THREE.ConeGeometry(0.085, 0.06, 12);
    const lampCap = new THREE.Mesh(lampCapGeo, lampPoleMat);
    lampCap.position.set(1.28, 0.74, 0.78);
    lampCap.visible = !isWideDistrictDiorama;
    dioramaRoot.add(lampCap);

    const lampBulbGeo = new THREE.SphereGeometry(0.042, 10, 10);
    const lampBulbMat = new THREE.MeshBasicMaterial({ color: '#FFF3C4' });
    const lampBulb = new THREE.Mesh(lampBulbGeo, lampBulbMat);
    lampBulb.position.set(1.28, 0.7, 0.78);
    lampBulb.visible = !isWideDistrictDiorama;
    dioramaRoot.add(lampBulb);

    const projectNdcToPlaneZ0 = (ndcX: number, ndcY: number) => {
      _dioramaUnprojVec.set(ndcX, ndcY, 0.5).unproject(camera);
      _dioramaRayDir.copy(_dioramaUnprojVec).sub(camera.position);
      const t = Math.abs(_dioramaRayDir.z) > 1e-5 ? -camera.position.z / _dioramaRayDir.z : 1;
      return {
        x: camera.position.x + _dioramaRayDir.x * t,
        y: camera.position.y + _dioramaRayDir.y * t,
      };
    };

    const resolveTargetPose = (preset: ShopBuildingDioramaViewPreset) => {
      if (!fullBleed) {
        return {
          x: 0,
          y: 0,
          scale: 1,
          baseYaw: isWideDistrictDiorama ? -0.22 : -0.14,
        };
      }

      const centerOffsetY = isCentralPlazaTrio ? 0.62 : isWestPlazaArcade ? 0.5 : 1.04;
      const rightEdge = projectNdcToPlaneZ0(1, 0);
      const leftEdge = projectNdcToPlaneZ0(-1, 0);
      const topEdge = projectNdcToPlaneZ0(0, 1);
      const bottomEdge = projectNdcToPlaneZ0(0, -1);
      const visibleWorldW = Math.max(0.5, rightEdge.x - leftEdge.x);
      const visibleWorldH = Math.max(0.5, topEdge.y - bottomEdge.y);

      if (preset === 'shop_corner') {
        let ndcX = -0.64;
        let ndcY = -0.5;
        let scale = isWideDistrictDiorama ? 0.44 : 0.4;

        const anchorEl = cornerAnchorRefHolder.current?.current;
        if (anchorEl) {
          const contRect = container.getBoundingClientRect();
          const anchorRect = anchorEl.getBoundingClientRect();
          if (
            contRect.width > 120 &&
            contRect.height > 120 &&
            anchorRect.width > 40 &&
            anchorRect.height > 40
          ) {
            const cx = anchorRect.left + anchorRect.width * 0.5;
            const cy = anchorRect.top + anchorRect.height * 0.5;
            ndcX = ((cx - contRect.left) / contRect.width) * 2 - 1;
            ndcY = 1 - ((cy - contRect.top) / contRect.height) * 2;
            const anchorWorldW = (anchorRect.width / contRect.width) * visibleWorldW;
            const anchorWorldH = (anchorRect.height / contRect.height) * visibleWorldH;
            if (isWideDistrictDiorama) {
              const fit = Math.min((anchorWorldW * 0.96) / 3.25, (anchorWorldH * 0.92) / 1.15);
              scale = Math.max(0.32, Math.min(0.56, fit));
            } else {
              const fit = Math.min((anchorWorldW * 0.88) / 1.85, (anchorWorldH * 0.94) / 2.15);
              scale = Math.max(0.28, Math.min(0.54, fit));
            }
          }
        }

        const worldPt = projectNdcToPlaneZ0(ndcX, ndcY);
        return {
          x: worldPt.x,
          y: worldPt.y - centerOffsetY * scale,
          scale,
          baseYaw: isWideDistrictDiorama ? 0.16 : 0.14,
        };
      }

      if (preset === 'hidden') {
        const scale = isWideDistrictDiorama ? 0.62 : 0.52;
        const worldPt = projectNdcToPlaneZ0(-0.14, -0.2);
        return {
          x: worldPt.x,
          y: worldPt.y - centerOffsetY * scale,
          scale,
          baseYaw: isWideDistrictDiorama ? -0.22 : -0.18,
        };
      }

      // Default: 'home' hero center-left stage (unclipped, borderless behind side menus & cards)
      const scale = isCentralPlazaTrio ? 1.04 : isWestPlazaArcade ? 1.12 : 0.88;
      const worldPt = projectNdcToPlaneZ0(-0.14, -0.04);
      return {
        x: worldPt.x,
        y: worldPt.y - centerOffsetY * scale,
        scale,
        baseYaw: isWideDistrictDiorama ? -0.22 : -0.18,
      };
    };

    const initialPose = resolveTargetPose(viewPresetRef.current);
    const clonedDisposables: Array<{ dispose: () => void }> = [];
    let currentX = initialPose.x;
    let targetX = initialPose.x;
    let currentY = initialPose.y;
    let targetY = initialPose.y;
    let currentScale = initialPose.scale;
    let targetScale = initialPose.scale;
    let currentBaseYaw = initialPose.baseYaw;
    let targetBaseYaw = initialPose.baseYaw;
    let currentDragYaw = 0;
    let targetDragYaw = 0;

    let isDragging = false;
    let lastX = 0;
    let frameId = 0;
    let timerId = 0;
    let lastTickMs = performance.now();

    const applyTransformAndRender = () => {
      if (disposed) return;
      dioramaRoot.position.set(currentX, currentY, 0);
      dioramaRoot.scale.setScalar(currentScale);
      dioramaRoot.rotation.y = currentBaseYaw + currentDragYaw;
      renderer.render(scene, camera);
    };

    const afterSoftwareDraw = (cb: () => void) => {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          timerId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          timerId = window.setTimeout(cb, 80);
        }
      };
      timerId = window.setTimeout(poll, 5);
    };

    const scheduleNextFrame = (cb: () => void) => {
      if (disposed) return;
      if (isSoftwareGl) {
        afterSoftwareDraw(cb);
      } else {
        frameId = window.requestAnimationFrame(cb);
      }
    };

    const stepMotion = () => {
      frameId = 0;
      timerId = 0;
      if (disposed) return;

      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTickMs) / 1000));
      lastTickMs = now;

      const posLambda = isSoftwareGl ? 10.5 : 7.5;
      const yawLambda = isSoftwareGl ? 11.5 : 8.5;

      currentX = THREE.MathUtils.damp(currentX, targetX, posLambda, dt);
      currentY = THREE.MathUtils.damp(currentY, targetY, posLambda, dt);
      currentScale = THREE.MathUtils.damp(currentScale, targetScale, posLambda, dt);
      currentBaseYaw = THREE.MathUtils.damp(currentBaseYaw, targetBaseYaw, yawLambda, dt);
      currentDragYaw = THREE.MathUtils.damp(currentDragYaw, targetDragYaw, yawLambda, dt);

      const remaining =
        Math.abs(targetX - currentX) +
        Math.abs(targetY - currentY) +
        Math.abs(targetScale - currentScale) +
        Math.abs(targetBaseYaw - currentBaseYaw) +
        Math.abs(targetDragYaw - currentDragYaw);

      if (remaining > 0.0018 || isDragging) {
        applyTransformAndRender();
        scheduleNextFrame(stepMotion);
      } else {
        currentX = targetX;
        currentY = targetY;
        currentScale = targetScale;
        currentBaseYaw = targetBaseYaw;
        currentDragYaw = targetDragYaw;
        applyTransformAndRender();
      }
    };

    const requestRender = () => {
      if (disposed) return;
      if (!frameId && !timerId) {
        lastTickMs = performance.now();
        frameId = window.requestAnimationFrame(stepMotion);
      }
    };
    requestRenderRef.current = requestRender;

    const syncPoseTarget = (resetDrag: boolean) => {
      if (disposed) return;
      const next = resolveTargetPose(viewPresetRef.current);
      targetX = next.x;
      targetY = next.y;
      targetScale = next.scale;
      targetBaseYaw = next.baseYaw;
      if (resetDrag) {
        targetDragYaw = 0;
      }
      requestRender();
    };
    syncPoseTargetRef.current = syncPoseTarget;

    if (isWestPlazaArcade) {
      const template = getCachedWestPlazaArcadeTemplate();
      const instance = template.clone(true);
      billboardMatsRef.current = [];
      dioramaRoot.add(instance);
      applyTransformAndRender();
    } else if (isCentralPlazaTrio) {
      void loadCachedCentralPlazaTrioTemplate().then((template) => {
        if (disposed || !template) return;
        const instance = template.clone(true);
        billboardMatsRef.current = [];
        dioramaRoot.add(instance);
        applyTransformAndRender();
      });
    } else {
      // Load cached 3D Shop Building GLB
      const resolvedGlbPath = customGlbPath || formSpec.glbPath;
      void loadCachedDioramaBuildingGlb(resolvedGlbPath).then((template) => {
        if (disposed || !template) return;
        const instance = template.clone(true);
        const bMats: THREE.MeshStandardMaterial[] = [];

        const defaultBoardTex = createEditorialBillboardTexture(
          brandName,
          brandCategory,
          accentHex,
          formSpec.id,
        );
        clonedDisposables.push(defaultBoardTex);

        instance.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          const rawMat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
            | THREE.MeshStandardMaterial
            | undefined;
          if (!rawMat) return;

          const meshName = mesh.name || '';
          const matName = rawMat.name || '';
          const combined = `${meshName} ${matName}`;

          if (
            meshName === SHOP_BILLBOARD_MESH_SPEC.meshName ||
            matName === SHOP_BILLBOARD_MESH_SPEC.materialName
          ) {
            const boardMat = new THREE.MeshStandardMaterial({
              color: '#FFFFFF',
              map: defaultBoardTex,
              roughness: 0.35,
              metalness: 0.05,
            });
            clonedDisposables.push(boardMat);
            mesh.material = boardMat;
            bMats.push(boardMat);
            return;
          }

          // Warm golden window interior glow just like the video diorama
          if (/upper_window_interior|glass_upper_window|glass_window_upper|glass_storefront_clear|clear_glass/i.test(combined)) {
            const glowMat = rawMat.clone();
            glowMat.color.set('#FFF3D1');
            if ('emissive' in glowMat) {
              glowMat.emissive.set('#FFE4A3');
              glowMat.emissiveIntensity = 0.55;
            }
            glowMat.roughness = 0.2;
            clonedDisposables.push(glowMat);
            mesh.material = glowMat;
          }
        });

        billboardMatsRef.current = bMats;
        dioramaRoot.add(instance);
        applyTransformAndRender();
      });
    }

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture?.(e.pointerId);
      requestRender();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      targetDragYaw = Math.max(-0.95, Math.min(0.95, targetDragYaw + dx * 0.012));
      requestRender();
    };
    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      renderer.domElement.releasePointerCapture?.(e.pointerId);
      requestRender();
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    domEl.addEventListener('pointermove', onPointerMove);
    domEl.addEventListener('pointerup', onPointerUp);
    domEl.addEventListener('pointercancel', onPointerUp);

    const resizeObs =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            updateSize();
            syncPoseTarget(false);
          })
        : null;
    resizeObs?.observe(container);

    return () => {
      disposed = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      if (timerId) window.clearTimeout(timerId);
      resizeObs?.disconnect();
      domEl.removeEventListener('pointerdown', onPointerDown);
      domEl.removeEventListener('pointermove', onPointerMove);
      domEl.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('pointercancel', onPointerUp);
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
      lampPoleGeo.dispose();
      lampPoleMat.dispose();
      lampCapGeo.dispose();
      lampBulbGeo.dispose();
      lampBulbMat.dispose();
      for (const d of clonedDisposables) d.dispose();
      renderer.dispose();
      requestRenderRef.current = null;
      syncPoseTargetRef.current = null;
      billboardMatsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formSpec.id, customGlbPath, customDioramaMode, compact, fullBleed]);

  // Smoothly glide 3D building pose when switching between Home <-> Shop <-> Hidden tabs
  useEffect(() => {
    viewPresetRef.current = viewPreset;
    syncPoseTargetRef.current?.(true);
    const rafId = window.requestAnimationFrame(() => {
      syncPoseTargetRef.current?.(false);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [viewPreset]);

  // Re-paint rooftop billboard texture on demand when brandName or custom logo URL changes
  useEffect(() => {
    const mats = billboardMatsRef.current;
    if (!mats || mats.length === 0) return;

    if (billboardLogoUrl) {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(
        billboardLogoUrl,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          for (const m of mats) {
            m.map = tex;
            m.needsUpdate = true;
          }
          requestRenderRef.current?.();
        },
        undefined,
        () => {
          // Ignore invalid URL and keep editorial canvas billboard
        },
      );
      return;
    }

    const editorialTex = createEditorialBillboardTexture(
      brandName,
      brandCategory,
      accentHex,
      formSpec.id,
    );
    for (const m of mats) {
      m.map = editorialTex;
      m.needsUpdate = true;
    }
    requestRenderRef.current?.();
  }, [brandName, brandCategory, accentHex, billboardLogoUrl, formSpec.id]);

  return (
    <div
      className={
        fullBleed
          ? 'relative w-full h-full select-none'
          : `relative w-full flex flex-col items-center justify-center select-none ${
              compact
                ? 'h-[210px] max-w-[330px]'
                : customDioramaMode === 'west_plaza_arcade' ||
                    customDioramaMode === 'central_plaza_trio'
                  ? 'h-[340px] max-w-[440px]'
                  : 'h-[325px] max-w-[420px]'
            }`
      }
      title="Drag to rotate 3D building diorama"
    >
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
};

