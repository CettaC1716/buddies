import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { IndividualCommanderBaseState } from './buddiesBlitzRules';
import {
  CITY_RENTAL_LOTS,
  STANDARD_SHOP_FOOTPRINT_SPEC,
  STANDARD_SHOP_SHELL_VARIANTS,
  resolveCityRentalLotsState,
  type CityRentalLotSpec,
  type CityRentalLotStatus,
  type StandardShopShellVariantId,
  type StandardShopShellVariantSpec,
} from './buddiesCityRentalLotsRules';

export interface CityRentalLotNodeController {
  spec: CityRentalLotSpec;
  lotRoot: THREE.Group;
  emptyMarkerGroup: THREE.Group;
  shopBuildingGroup: THREE.Group;
  highlightGroup: THREE.Group;
  hitProxyMesh: THREE.Mesh;
  statusSignMat: THREE.MeshBasicMaterial;
  highlightRingMat: THREE.MeshBasicMaterial;
}

export interface CityRentalLotsVisualController {
  rootGroup: THREE.Group;
  lotNodes: ReadonlyArray<CityRentalLotNodeController>;
  hitProxyMeshes: ReadonlyArray<THREE.Mesh>;
  sync: (params: {
    isSafezoneMode: boolean;
    showOutdoor: boolean;
    blueCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>;
    redCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>;
    rentedSlotIds?: ReadonlySet<string> | ReadonlyArray<string>;
    selectedSlotId?: string | null;
    hoveredSlotId?: string | null;
    previewAllBuildingsFit?: boolean;
    timeSec?: number;
  }) => void;
  dispose: () => void;
}

function createSignboardTexture(
  variant: StandardShopShellVariantSpec,
  shortCode: string,
  disposables: Array<{ dispose: () => void }>,
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(new Uint8Array([24, 32, 44, 255]), 1, 1);
    tex.needsUpdate = true;
    disposables.push(tex);
    return tex as unknown as THREE.CanvasTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = variant.signBgHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = variant.signAccentHex;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    ctx.fillStyle = variant.signAccentHex;
    ctx.font = '900 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`CERRIA SHOWROOM · LOT ${shortCode}`, canvas.width * 0.5, 42);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 32px system-ui, -apple-system, sans-serif';
    const title =
      variant.id === 'timber_atelier'
        ? 'ATELIER & BOUTIQUE'
        : variant.id === 'brick_corner'
          ? 'CORNER SHOWROOM'
          : 'STUDIO GALLERY';
    ctx.fillText(title, canvas.width * 0.5, 86);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  disposables.push(tex);
  return tex;
}

function createLotGroundPlaqueTexture(
  shortCode: string,
  status: CityRentalLotStatus,
  disposables: Array<{ dispose: () => void }>,
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(new Uint8Array([20, 24, 32, 255]), 1, 1);
    tex.needsUpdate = true;
    disposables.push(tex);
    return tex as unknown as THREE.CanvasTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const isRented = status === 'rented';
    ctx.fillStyle = isRented ? '#1e293b' : '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = isRented ? '#38bdf8' : '#b8ff3c';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    ctx.fillStyle = isRented ? '#38bdf8' : '#b8ff3c';
    ctx.font = '900 24px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isRented ? 'RENTED LOT' : 'RENTAL LOT · AVAILABLE',
      canvas.width * 0.5,
      44,
    );

    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 34px system-ui, -apple-system, sans-serif';
    ctx.fillText(`LOT ${shortCode} · 15×15M`, canvas.width * 0.5, 88);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  disposables.push(tex);
  return tex;
}

/**
 * Builds one of the 3 compact standardized shop building shells (9.6m x 9.6m footprint,
 * height ~5.5m-5.8m, prominent storefront glazing + signboard area facing local +Z).
 * The returned group has its origin at the lot center and shifts the building body by
 * `localDepthOffsetTowardRearM = -1.2m` along local Z so the front apron (+3.6m..+7.5m)
 * faces directly toward the nearest road.
 */
function buildStandardShopShellForLot(
  spec: CityRentalLotSpec,
  variantId: StandardShopShellVariantId,
  sharedGeos: {
    plinthGeo: THREE.BufferGeometry;
    mainBodyGeo: THREE.BufferGeometry;
    upperCrownGeo: THREE.BufferGeometry;
    pilasterGeo: THREE.BufferGeometry;
    windowGlassGeo: THREE.BufferGeometry;
    doorFrameGeo: THREE.BufferGeometry;
    doorLeafGeo: THREE.BufferGeometry;
    awningGeo: THREE.BufferGeometry;
    signBackGeo: THREE.BufferGeometry;
    signFaceGeo: THREE.BufferGeometry;
    windowMullionHGeo: THREE.BufferGeometry;
    sideWindowGeo: THREE.BufferGeometry;
  },
  sharedMats: {
    stonePlinthMat: THREE.Material;
    glassMat: THREE.Material;
    darkFrameMat: THREE.Material;
    brassHandleMat: THREE.Material;
  },
  disposables: Array<{ dispose: () => void }>,
): THREE.Group {
  const variant = STANDARD_SHOP_SHELL_VARIANTS[variantId];
  const group = new THREE.Group();
  group.name = `StandardShopShell_${spec.slotId}_${variantId}`;

  const buildingCenterZ = STANDARD_SHOP_FOOTPRINT_SPEC.localDepthOffsetTowardRearM; // -1.2m
  const shellRoot = new THREE.Group();
  shellRoot.position.set(0, 0, buildingCenterZ);
  group.add(shellRoot);

  const wallMat = new THREE.MeshLambertMaterial({ color: variant.wallColorHex });
  const trimMat = new THREE.MeshLambertMaterial({ color: variant.trimColorHex });
  const roofMat = new THREE.MeshLambertMaterial({ color: variant.roofColorHex });
  const awningMat = new THREE.MeshLambertMaterial({ color: variant.awningColorHex });
  const signTex = createSignboardTexture(variant, spec.shortCode, disposables);
  const signFaceMat = new THREE.MeshBasicMaterial({ map: signTex });
  disposables.push(wallMat, trimMat, roofMat, awningMat, signFaceMat);

  // 1. Ground Stone Plinth (9.6m x 0.24m x 9.6m -> exact 40.96% footprint)
  const plinth = new THREE.Mesh(sharedGeos.plinthGeo, sharedMats.stonePlinthMat);
  plinth.position.set(0, 0.12, 0);
  plinth.receiveShadow = true;
  shellRoot.add(plinth);

  // 2. Main Compact 1.5-Story Shop Volume (9.36m x 4.80m x 9.36m)
  const body = new THREE.Mesh(sharedGeos.mainBodyGeo, wallMat);
  body.position.set(0, 2.64, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  shellRoot.add(body);

  // 3. Parapet Roof Crown & Architectural Variant Roofline (height 5.5m - 5.8m)
  const crown = new THREE.Mesh(sharedGeos.upperCrownGeo, roofMat);
  crown.position.set(0, 5.22, 0);
  crown.castShadow = true;
  crown.receiveShadow = true;
  shellRoot.add(crown);

  // Corner & Center Facade Pilasters along Front (+Z = +4.68m)
  for (const px of [-4.48, -1.65, 1.65, 4.48]) {
    const pilaster = new THREE.Mesh(sharedGeos.pilasterGeo, trimMat);
    pilaster.position.set(px, 2.64, 4.66);
    shellRoot.add(pilaster);
  }

  // 4. Left & Right Storefront Display Windows facing the road (+Z)
  for (const wx of [-3.05, 3.05]) {
    const winGlass = new THREE.Mesh(sharedGeos.windowGlassGeo, sharedMats.glassMat);
    winGlass.position.set(wx, 1.88, 4.69);
    shellRoot.add(winGlass);

    const sill = new THREE.Mesh(sharedGeos.windowMullionHGeo, trimMat);
    sill.position.set(wx, 0.72, 4.73);
    shellRoot.add(sill);
  }

  // Side Display Windows (Left -X and Right +X facades)
  for (const xSign of [-1, 1]) {
    const sideGlass = new THREE.Mesh(sharedGeos.sideWindowGeo, sharedMats.glassMat);
    sideGlass.position.set(xSign * 4.69, 2.1, 0.4);
    sideGlass.rotation.y = xSign * (Math.PI * 0.5);
    shellRoot.add(sideGlass);
  }

  // 5. Double Front Entrance Door centered on +Z facade
  const doorFrame = new THREE.Mesh(sharedGeos.doorFrameGeo, sharedMats.darkFrameMat);
  doorFrame.position.set(0, 1.48, 4.68);
  shellRoot.add(doorFrame);

  const doorGlass = new THREE.Mesh(sharedGeos.doorLeafGeo, sharedMats.glassMat);
  doorGlass.position.set(0, 1.46, 4.71);
  shellRoot.add(doorGlass);

  // 6. Storefront Canopy Awning projecting 0.78m from +Z facade (stays well inside +7.5m front border)
  const awning = new THREE.Mesh(sharedGeos.awningGeo, awningMat);
  awning.position.set(0, 3.24, 5.05);
  awning.rotation.x = 0.18;
  awning.castShadow = true;
  shellRoot.add(awning);

  // 7. Prominent Storefront Signboard Fascia above Awning facing the nearest road (+Z)
  const signBack = new THREE.Mesh(sharedGeos.signBackGeo, trimMat);
  signBack.position.set(0, variant.signboardCenterY, 4.74);
  shellRoot.add(signBack);

  const signFace = new THREE.Mesh(sharedGeos.signFaceGeo, signFaceMat);
  signFace.position.set(0, variant.signboardCenterY, 4.825);
  shellRoot.add(signFace);

  return group;
}

/**
 * Builds the 3D scene representation for all 16 city rental lots:
 * - Open front facing the nearest road/sidewalk (NO front fence or gate).
 * - Low manicured hedge/curb boundary markers along the left, right, and rear edges only.
 * - Clean paved walk-in front threshold apron and subtle corner boundary stone markers.
 * - Resting state: EMPTY LAND with a low available-for-rent ground plaque.
 * - While rented (or during fit preview): displays the lot's standard shop building shell.
 * - Interactive 3D hover & selection border highlight ring.
 */
export function buildCityRentalLotsVisuals(): CityRentalLotsVisualController {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'CityRentalLotsSystemRoot';

  const disposables: Array<{ dispose: () => void }> = [];
  const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const regMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  // Shared Geometries for Low Open-Front Lot Boundaries (15.0m x 15.0m lot)
  // Front edge is at local +Z = +7.5m (100% OPEN to sidewalk/road!).
  // Low curb + low trimmed hedge along Rear (-Z = -7.32m), Left (-X = -7.32m), and Right (+X = +7.32m).
  const rearCurbGeo = regGeo(new RoundedBoxGeometry(14.88, 0.14, 0.28, 1, 0.02));
  const rearHedgeGeo = regGeo(new RoundedBoxGeometry(14.52, 0.34, 0.34, 2, 0.06));
  const sideCurbGeo = regGeo(new RoundedBoxGeometry(0.28, 0.14, 14.2, 1, 0.02));
  const sideHedgeGeo = regGeo(new RoundedBoxGeometry(0.34, 0.34, 13.6, 2, 0.06));
  const cornerBollardGeo = regGeo(new RoundedBoxGeometry(0.38, 0.44, 0.38, 2, 0.04));
  const frontThresholdPaverGeo = regGeo(new THREE.PlaneGeometry(14.2, 0.42));
  frontThresholdPaverGeo.rotateX(-Math.PI * 0.5);

  const frontWalkApronGeo = regGeo(new THREE.PlaneGeometry(6.4, 1.55));
  frontWalkApronGeo.rotateX(-Math.PI * 0.5);

  const groundPlaqueBaseGeo = regGeo(new RoundedBoxGeometry(2.68, 0.12, 0.92, 1, 0.02));
  const groundPlaqueFaceGeo = regGeo(new THREE.PlaneGeometry(2.52, 0.8));
  groundPlaqueFaceGeo.rotateX(-Math.PI * 0.5);

  // Highlight ring along the 15.0m x 15.0m perimeter
  const highlightNSGeo = regGeo(new THREE.PlaneGeometry(15.0, 0.28));
  highlightNSGeo.rotateX(-Math.PI * 0.5);
  const highlightEWGeo = regGeo(new THREE.PlaneGeometry(0.28, 14.44));
  highlightEWGeo.rotateX(-Math.PI * 0.5);

  // Invisible hit proxy for raycasting clicks/hovers across the 15.0m x 15.0m lot
  const hitProxyGeo = regGeo(new THREE.PlaneGeometry(15.0, 15.0));
  hitProxyGeo.rotateX(-Math.PI * 0.5);
  const hitProxyMat = regMat(
    new THREE.MeshBasicMaterial({
      visible: false,
      side: THREE.DoubleSide,
    }),
  );

  // Shared Geometries for the Standard 9.6m x 9.6m Shop Building Shell
  const sharedShopGeos = {
    plinthGeo: regGeo(new RoundedBoxGeometry(9.6, 0.24, 9.6, 1, 0.02)),
    mainBodyGeo: regGeo(new RoundedBoxGeometry(9.36, 4.8, 9.36, 2, 0.04)),
    upperCrownGeo: regGeo(new RoundedBoxGeometry(9.56, 0.44, 9.56, 2, 0.03)),
    pilasterGeo: regGeo(new RoundedBoxGeometry(0.36, 4.8, 0.18, 1, 0.02)),
    windowGlassGeo: regGeo(new THREE.PlaneGeometry(2.35, 2.2)),
    windowMullionHGeo: regGeo(new RoundedBoxGeometry(2.48, 0.14, 0.14, 1, 0.015)),
    sideWindowGeo: regGeo(new THREE.PlaneGeometry(3.2, 2.0)),
    doorFrameGeo: regGeo(new RoundedBoxGeometry(2.2, 2.68, 0.14, 1, 0.02)),
    doorLeafGeo: regGeo(new THREE.PlaneGeometry(1.94, 2.52)),
    awningGeo: regGeo(new RoundedBoxGeometry(8.8, 0.14, 0.82, 1, 0.02)),
    signBackGeo: regGeo(new RoundedBoxGeometry(6.6, 1.12, 0.14, 1, 0.02)),
    signFaceGeo: regGeo(new THREE.PlaneGeometry(6.36, 0.96)),
  };

  // Shared Materials
  const stoneCurbMat = regMat(new THREE.MeshLambertMaterial({ color: '#d6d1c4' }));
  const lowHedgeMat = regMat(new THREE.MeshLambertMaterial({ color: '#2f7d44' }));
  const paverApronMat = regMat(
    new THREE.MeshBasicMaterial({
      color: '#cbd5e1',
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const plaqueBaseMat = regMat(new THREE.MeshLambertMaterial({ color: '#1e293b' }));

  const sharedShopMats = {
    stonePlinthMat: regMat(new THREE.MeshLambertMaterial({ color: '#94a3b8' })),
    glassMat: regMat(
      new THREE.MeshLambertMaterial({
        color: '#bae6fd',
        emissive: new THREE.Color('#0c4a6e'),
        emissiveIntensity: 0.35,
      }),
    ),
    darkFrameMat: regMat(new THREE.MeshLambertMaterial({ color: '#1e293b' })),
    brassHandleMat: regMat(new THREE.MeshLambertMaterial({ color: '#facc15' })),
  };

  const lotNodes: CityRentalLotNodeController[] = [];
  const hitProxyMeshes: THREE.Mesh[] = [];

  for (let i = 0; i < CITY_RENTAL_LOTS.length; i++) {
    const spec = CITY_RENTAL_LOTS[i];
    const lotRoot = new THREE.Group();
    lotRoot.name = `CityRentalLot_${spec.slotId}`;
    lotRoot.position.set(spec.x, 0, spec.z);
    lotRoot.rotation.y = spec.facingYaw;
    rootGroup.add(lotRoot);

    // 1. Open-Front Low Boundary Markers (Left, Right, and Rear edges ONLY; Front at +Z is open)
    const boundaryGroup = new THREE.Group();
    boundaryGroup.name = `LotBoundary_${spec.slotId}`;
    lotRoot.add(boundaryGroup);

    const rearCurb = new THREE.Mesh(rearCurbGeo, stoneCurbMat);
    rearCurb.position.set(0, 0.07, -7.34);
    boundaryGroup.add(rearCurb);

    const rearHedge = new THREE.Mesh(rearHedgeGeo, lowHedgeMat);
    rearHedge.position.set(0, 0.24, -7.34);
    boundaryGroup.add(rearHedge);

    for (const xSign of [-1, 1]) {
      const sCurb = new THREE.Mesh(sideCurbGeo, stoneCurbMat);
      sCurb.position.set(xSign * 7.34, 0.07, -0.35);
      boundaryGroup.add(sCurb);

      const sHedge = new THREE.Mesh(sideHedgeGeo, lowHedgeMat);
      sHedge.position.set(xSign * 7.34, 0.24, -0.35);
      boundaryGroup.add(sHedge);

      // Low front corner stone markers framing the wide 14.3m open front entrance
      const frontBollard = new THREE.Mesh(cornerBollardGeo, stoneCurbMat);
      frontBollard.position.set(xSign * 7.31, 0.22, 7.31);
      boundaryGroup.add(frontBollard);

      const rearBollard = new THREE.Mesh(cornerBollardGeo, stoneCurbMat);
      rearBollard.position.set(xSign * 7.31, 0.22, -7.31);
      boundaryGroup.add(rearBollard);
    }

    // Flush Front Threshold Strip & Walk-In Sidewalk Connector Apron at +Z (zero fence!)
    const frontThreshold = new THREE.Mesh(frontThresholdPaverGeo, paverApronMat);
    frontThreshold.position.set(0, 0.022, 7.28);
    boundaryGroup.add(frontThreshold);

    const frontApron = new THREE.Mesh(frontWalkApronGeo, paverApronMat);
    frontApron.position.set(0, 0.02, 8.26);
    boundaryGroup.add(frontApron);

    // 2. Resting Empty Land Presentation ("AVAILABLE · LOT X-0Y") placed near front-right corner
    const emptyMarkerGroup = new THREE.Group();
    emptyMarkerGroup.name = `LotEmptyMarker_${spec.slotId}`;
    lotRoot.add(emptyMarkerGroup);

    const plaqueBase = new THREE.Mesh(groundPlaqueBaseGeo, plaqueBaseMat);
    plaqueBase.position.set(0, 0.06, 5.85);
    emptyMarkerGroup.add(plaqueBase);

    const availTex = createLotGroundPlaqueTexture(spec.shortCode, 'available', disposables);
    const statusSignMat = regMat(new THREE.MeshBasicMaterial({ map: availTex }));
    const plaqueFace = new THREE.Mesh(groundPlaqueFaceGeo, statusSignMat);
    plaqueFace.position.set(0, 0.125, 5.85);
    emptyMarkerGroup.add(plaqueFace);

    // 3. Standardized Compact Shop Building Shell (Hidden in resting empty state, visible when rented)
    const shopBuildingGroup = buildStandardShopShellForLot(
      spec,
      spec.buildingVariantId,
      sharedShopGeos,
      sharedShopMats,
      disposables,
    );
    shopBuildingGroup.visible = false;
    lotRoot.add(shopBuildingGroup);

    // 4. Interactive 3D Selection / Hover Highlight Border Ring
    const highlightGroup = new THREE.Group();
    highlightGroup.name = `LotHighlight_${spec.slotId}`;
    highlightGroup.visible = false;
    lotRoot.add(highlightGroup);

    const highlightRingMat = regMat(
      new THREE.MeshBasicMaterial({
        color: '#b8ff3c',
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );

    for (const zSign of [-1, 1]) {
      const hBar = new THREE.Mesh(highlightNSGeo, highlightRingMat);
      hBar.position.set(0, 0.045, zSign * 7.36);
      highlightGroup.add(hBar);
    }
    for (const xSign of [-1, 1]) {
      const vBar = new THREE.Mesh(highlightEWGeo, highlightRingMat);
      vBar.position.set(xSign * 7.36, 0.045, 0);
      highlightGroup.add(vBar);
    }

    // 5. Raycast Hit Proxy Mesh tagged with userData.cityRentalLotId
    const hitProxyMesh = new THREE.Mesh(hitProxyGeo, hitProxyMat);
    hitProxyMesh.position.set(0, 0.05, 0);
    hitProxyMesh.userData.cityRentalLotId = spec.slotId;
    lotRoot.add(hitProxyMesh);
    hitProxyMeshes.push(hitProxyMesh);

    lotNodes.push({
      spec,
      lotRoot,
      emptyMarkerGroup,
      shopBuildingGroup,
      highlightGroup,
      hitProxyMesh,
      statusSignMat,
      highlightRingMat,
    });
  }

  const sync: CityRentalLotsVisualController['sync'] = (params) => {
    const visibleMode = params.isSafezoneMode && params.showOutdoor;
    rootGroup.visible = visibleMode;
    if (!visibleMode) return;

    const resolvedStates = resolveCityRentalLotsState({
      blueCommanderBases: params.blueCommanderBases,
      redCommanderBases: params.redCommanderBases,
      rentedSlotIds: params.rentedSlotIds,
      previewAllBuildingsFit: params.previewAllBuildingsFit,
    });

    const pulse =
      typeof params.timeSec === 'number'
        ? 0.78 + 0.22 * Math.sin(params.timeSec * 5.2)
        : 0.92;

    for (let i = 0; i < lotNodes.length; i++) {
      const node = lotNodes[i];
      const st = resolvedStates[i];
      node.lotRoot.visible = st.isVisibleInWorld;
      if (!st.isVisibleInWorld) continue;

      node.shopBuildingGroup.visible = st.showShopBuilding;
      node.emptyMarkerGroup.visible = !st.showShopBuilding;

      const isSelected = params.selectedSlotId === node.spec.slotId;
      const isHovered = params.hoveredSlotId === node.spec.slotId;
      node.highlightGroup.visible = isSelected || isHovered;
      if (isSelected) {
        node.highlightRingMat.color.set('#b8ff3c');
        node.highlightRingMat.opacity = pulse;
      } else if (isHovered) {
        node.highlightRingMat.color.set('#38bdf8');
        node.highlightRingMat.opacity = 0.72;
      }
    }
  };

  const dispose = () => {
    for (let i = 0; i < disposables.length; i++) {
      disposables[i].dispose();
    }
    disposables.length = 0;
  };

  return {
    rootGroup,
    lotNodes,
    hitProxyMeshes,
    sync,
    dispose,
  };
}
