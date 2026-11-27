import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { IndividualCommanderBaseState } from './buddiesBlitzRules';
import {
  CITY_RENTAL_LOTS,
  COMMERCIAL_SIDEWALK_STRIPS,
  SHOP_BILLBOARD_MESH_SPEC,
  SHOP_BUILDING_FORMS,
  STANDARD_SHOP_FOOTPRINT_SPEC,
  resolveCityRentalLotsState,
  type CityRentalLotSpec,
  type CityRentalLotStatus,
  type ShopBuildingFormId,
  type ShopBuildingFormSpec,
} from './buddiesCityRentalLotsRules';

export interface CityRentalLotNodeController {
  spec: CityRentalLotSpec;
  lotRoot: THREE.Group;
  emptyMarkerGroup: THREE.Group;
  claimKioskMesh: THREE.Group;
  lotPavingMesh: THREE.Mesh;
  shopBuildingGroup: THREE.Group;
  glbBuildingMount: THREE.Group;
  loadedGlbFormId: ShopBuildingFormId | null;
  appliedBillboardLogoUrl: string | null;
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
    lotStatusBySlotId?: Readonly<Record<string, CityRentalLotStatus>>;
    placedBuildingBySlotId?: Readonly<Record<string, ShopBuildingFormId | null | undefined>>;
    billboardLogoUrlBySlotId?: Readonly<Record<string, string | null | undefined>>;
    selectedSlotId?: string | null;
    hoveredSlotId?: string | null;
    previewAllBuildingsFit?: boolean;
    timeSec?: number;
  }) => void;
  dispose: () => void;
}

function createNeutralBillboardTexture(
  disposables: Array<{ dispose: () => void }>,
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(new Uint8Array([229, 231, 235, 255]), 1, 1);
    tex.needsUpdate = true;
    disposables.push(tex);
    return tex as unknown as THREE.CanvasTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = SHOP_BILLBOARD_MESH_SPEC.textureWidthPx;
  canvas.height = SHOP_BILLBOARD_MESH_SPEC.textureHeightPx;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = SHOP_BILLBOARD_MESH_SPEC.defaultColorHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
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
 * Builds the procedural fallback shell shown while a shop building GLB streams in
 * (compact 9.6m x 9.6m stand-in, height ~5.5m-5.8m, storefront glazing + signboard
 * area facing local +Z). The real catalog buildings are complete packages up to
 * 14m x 14m placed CENTRED on the lot (package standard, 27 Nov 2026), so the
 * group origin is the lot center and `localDepthOffsetTowardRearM` is 0.
 */
function buildStandardShopShellForLot(
  spec: CityRentalLotSpec,
  variantId: ShopBuildingFormId,
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
  const variant: ShopBuildingFormSpec = SHOP_BUILDING_FORMS[variantId];
  const group = new THREE.Group();
  group.name = `StandardShopShell_${spec.slotId}_${variantId}`;

  const buildingCenterZ = STANDARD_SHOP_FOOTPRINT_SPEC.localDepthOffsetTowardRearM; // 0m — centred (package standard)
  const shellRoot = new THREE.Group();
  shellRoot.position.set(0, 0, buildingCenterZ);
  group.add(shellRoot);

  const wallMat = new THREE.MeshLambertMaterial({ color: variant.palette.wallHex });
  const trimMat = new THREE.MeshLambertMaterial({ color: variant.palette.trimHex });
  const roofMat = new THREE.MeshLambertMaterial({ color: variant.palette.roofHex });
  const awningMat = new THREE.MeshLambertMaterial({ color: variant.palette.accentHex });
  const signTex = createNeutralBillboardTexture(disposables);
  const signFaceMat = new THREE.MeshBasicMaterial({ map: signTex });
  signFaceMat.name = SHOP_BILLBOARD_MESH_SPEC.materialName;
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

  // 7. Rooftop Billboard Face (separate named mesh + replaceable texture material)
  const signBack = new THREE.Mesh(sharedGeos.signBackGeo, trimMat);
  signBack.position.set(0, variant.billboard.centerYM * 0.55, 4.74);
  shellRoot.add(signBack);

  const signFace = new THREE.Mesh(sharedGeos.signFaceGeo, signFaceMat);
  signFace.name = SHOP_BILLBOARD_MESH_SPEC.meshName;
  signFace.position.set(0, variant.billboard.centerYM * 0.55, 4.825);
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
export function buildCityRentalLotsVisuals(options?: {
  createKioskMesh?: () => THREE.Group;
}): CityRentalLotsVisualController {
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

  // Amendment 3: Per-building-form lot ground paving (14.4m x 14.4m inside 15m lot boundary; hidden when unbuilt so lot stays plain grass)
  const lotPavingGeo = regGeo(new THREE.PlaneGeometry(14.4, 14.4));
  lotPavingGeo.rotateX(-Math.PI * 0.5);

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

  // Shared Materials (Amendment 3 paving materials below)

  // Amendment 3: Building-form styled lot paving materials (applied on placement, reverted to grass on removal/expiry)
  const createBuildingFormPavingMat = (
    baseHex: string,
    groutHex: string,
    accentHex: string,
    tileCount: number,
  ): THREE.MeshLambertMaterial => {
    if (typeof document === 'undefined') {
      return regMat(new THREE.MeshLambertMaterial({ color: baseHex }));
    }
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, 256, 256);
      const step = 256 / tileCount;
      ctx.strokeStyle = groutHex;
      ctx.lineWidth = 3;
      for (let gx = 0; gx <= tileCount; gx++) {
        ctx.beginPath();
        ctx.moveTo(gx * step, 0);
        ctx.lineTo(gx * step, 256);
        ctx.stroke();
      }
      for (let gy = 0; gy <= tileCount; gy++) {
        ctx.beginPath();
        ctx.moveTo(0, gy * step);
        ctx.lineTo(256, gy * step);
        ctx.stroke();
      }
      ctx.fillStyle = accentHex;
      ctx.globalAlpha = 0.24;
      for (let gx = 0; gx < tileCount; gx++) {
        for (let gy = 0; gy < tileCount; gy++) {
          if ((gx + gy) % 2 === 0) {
            ctx.fillRect(gx * step + 2, gy * step + 2, step - 4, step - 4);
          }
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.colorSpace = THREE.SRGBColorSpace;
    disposables.push(tex);
    return regMat(
      new THREE.MeshLambertMaterial({
        map: tex,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
  };

  const lotPavingMatByForm: Record<ShopBuildingFormId, THREE.MeshLambertMaterial> = {
    glass_corner_3story: createBuildingFormPavingMat('#cbd5e1', '#94a3b8', '#e2e8f0', 4),
    canopy_storefront_2story: createBuildingFormPavingMat('#dfd3c3', '#b8a99a', '#f0e6d8', 4),
    brick_rooftop_deck: createBuildingFormPavingMat('#b8b2a6', '#78716c', '#d6d3d1', 6),
  };

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

    // 1. Flat White Ground Boundary Lines flush with terrain (NO 3D green hedges, NO protruding apron slabs)
    const boundaryGroup = new THREE.Group();
    boundaryGroup.name = `LotBoundary_${spec.slotId}`;
    lotRoot.add(boundaryGroup);

    const whiteLineMat = regMat(
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    const whiteLineNSGeo = regGeo(new THREE.PlaneGeometry(15.0, 0.18));
    whiteLineNSGeo.rotateX(-Math.PI * 0.5);
    const whiteLineEWGeo = regGeo(new THREE.PlaneGeometry(0.18, 15.0));
    whiteLineEWGeo.rotateX(-Math.PI * 0.5);
    const frontWhiteSegmentGeo = regGeo(new THREE.PlaneGeometry(4.4, 0.18));
    frontWhiteSegmentGeo.rotateX(-Math.PI * 0.5);

    // Rear white line (-Z = -7.41)
    const rearLine = new THREE.Mesh(whiteLineNSGeo, whiteLineMat);
    rearLine.position.set(0, 0.025, -7.41);
    boundaryGroup.add(rearLine);

    // Left & Right white lines (-X = -7.41, +X = +7.41)
    for (const xSign of [-1, 1]) {
      const sideLine = new THREE.Mesh(whiteLineEWGeo, whiteLineMat);
      sideLine.position.set(xSign * 7.41, 0.025, 0);
      boundaryGroup.add(sideLine);

      // Front white corner returns leaving a 6.2m open vehicle entrance in the middle (+Z = +7.41)
      const frontSeg = new THREE.Mesh(frontWhiteSegmentGeo, whiteLineMat);
      frontSeg.position.set(xSign * 5.25, 0.025, 7.41);
      boundaryGroup.add(frontSeg);
    }

    // 2. Resting Empty Land Presentation: Original Self-Service Tactical Claim Kiosk at exact center (0, 0, 0) of each kavling
    const emptyMarkerGroup = new THREE.Group();
    emptyMarkerGroup.name = `LotEmptyMarker_${spec.slotId}`;
    lotRoot.add(emptyMarkerGroup);

    const claimKioskMesh = options?.createKioskMesh
      ? options.createKioskMesh()
      : new THREE.Group();
    claimKioskMesh.name = `LotClaimKiosk_${spec.slotId}`;
    claimKioskMesh.position.set(0, 0, 0);
    emptyMarkerGroup.add(claimKioskMesh);

    const availTex = createLotGroundPlaqueTexture(spec.shortCode, 'available', disposables);
    const statusSignMat = regMat(new THREE.MeshBasicMaterial({ map: availTex }));
    // Subtle flat lot code marker on ground in front of the original kiosk when no custom mesh is passed
    if (!options?.createKioskMesh) {
      const plaqueFace = new THREE.Mesh(groundPlaqueFaceGeo, statusSignMat);
      plaqueFace.position.set(0, 0.03, 1.35);
      emptyMarkerGroup.add(plaqueFace);
    }

    // 3. Standardized Compact Shop Building Shell (fallback while real GLB streams in)
    const shopBuildingGroup = buildStandardShopShellForLot(
      spec,
      spec.buildingVariantId,
      sharedShopGeos,
      sharedShopMats,
      disposables,
    );
    shopBuildingGroup.visible = false;
    lotRoot.add(shopBuildingGroup);

    // 3B. Real Game-Ready GLB Building Mount (loaded on demand when a building is placed on a rented lot)
    const glbBuildingMount = new THREE.Group();
    glbBuildingMount.name = `ShopGlbMount_${spec.slotId}`;
    glbBuildingMount.position.set(0, 0, STANDARD_SHOP_FOOTPRINT_SPEC.localDepthOffsetTowardRearM);
    glbBuildingMount.visible = false;
    lotRoot.add(glbBuildingMount);

    // 3C. Amendment 3: Per-building-form Ground Paving (covers inner lot grass ONLY while a building is placed; reverts to plain grass on removal/expiry)
    const lotPavingMesh = new THREE.Mesh(lotPavingGeo, lotPavingMatByForm.glass_corner_3story);
    lotPavingMesh.name = `LotBuildingPaving_${spec.slotId}`;
    lotPavingMesh.position.set(0, 0.018, 0);
    lotPavingMesh.receiveShadow = true;
    lotPavingMesh.visible = false;
    lotRoot.add(lotPavingMesh);

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
      claimKioskMesh,
      lotPavingMesh,
      shopBuildingGroup,
      glbBuildingMount,
      loadedGlbFormId: null,
      appliedBillboardLogoUrl: null,
      highlightGroup,
      hitProxyMesh,
      statusSignMat,
      highlightRingMat,
    });
  }

  // Amendment 2: 2.0m Commercial Avenue Sidewalks running full block length + street furniture
  const sidewalkGroup = new THREE.Group();
  sidewalkGroup.name = 'CommercialAvenueSidewalks';
  rootGroup.add(sidewalkGroup);

  const sidewalkSlabMat = regMat(new THREE.MeshLambertMaterial({ color: '#d8d4ca' }));
  const lampPostMat = regMat(new THREE.MeshLambertMaterial({ color: '#272c36' }));
  const lampGlobeMat = regMat(new THREE.MeshBasicMaterial({ color: '#fef3c7' }));
  const benchWoodMat = regMat(new THREE.MeshLambertMaterial({ color: '#9c6b3b' }));
  const planterPotMat = regMat(new THREE.MeshLambertMaterial({ color: '#5b6472' }));
  const planterFoliageMat = regMat(new THREE.MeshLambertMaterial({ color: '#2f855a' }));

  const lampPoleGeo = regGeo(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 8));
  const lampHeadGeo = regGeo(new THREE.SphereGeometry(0.2, 8, 8));
  const benchSeatGeo = regGeo(new RoundedBoxGeometry(0.55, 0.12, 1.5, 1, 0.02));
  const planterBoxGeo = regGeo(new RoundedBoxGeometry(0.65, 0.48, 0.65, 1, 0.03));
  const planterBushGeo = regGeo(new THREE.SphereGeometry(0.42, 8, 8));
  const bikeRackLoopGeo = regGeo(new THREE.TorusGeometry(0.28, 0.035, 6, 12, Math.PI));

  for (const strip of COMMERCIAL_SIDEWALK_STRIPS) {
    const isNorth = strip.maxZ < 0;
    const zSign = isNorth ? -1 : 1;
    // Split each avenue sidewalk into 3 clean segments with 6.2m vehicle driveway cutouts centered on each lot (|z| = 70.5 & 89.5)
    const segBoundsAbs: Array<[number, number]> = [
      [60.3, 67.4],
      [73.6, 86.4],
      [92.6, 104.1],
    ];
    for (const [a, b] of segBoundsAbs) {
      const segLen = b - a;
      const segCenterZ = zSign * ((a + b) * 0.5);
      const slabGeo = regGeo(new THREE.BoxGeometry(strip.widthM, 0.09, segLen));
      const slab = new THREE.Mesh(slabGeo, sidewalkSlabMat);
      slab.position.set(strip.centerX, 0.045, segCenterZ);
      slab.receiveShadow = true;
      sidewalkGroup.add(slab);
    }

    // Place streetlamps, hardwood bench, planters, and bike racks strictly on the solid sidewalk segments (never blocking vehicle cutouts!)
    const curbOffset = strip.sideOfAvenue === 'east' ? -0.58 : 0.58;
    const fx = strip.centerX + curbOffset;
    const solidFurnitureZ = [zSign * 63.8, zSign * 80.0, zSign * 98.4];
    for (let zi = 0; zi < solidFurnitureZ.length; zi++) {
      const fz = solidFurnitureZ[zi];
      const pole = new THREE.Mesh(lampPoleGeo, lampPostMat);
      pole.position.set(fx, 1.85, fz);
      sidewalkGroup.add(pole);

      const globe = new THREE.Mesh(lampHeadGeo, lampGlobeMat);
      globe.position.set(fx, 3.7, fz);
      sidewalkGroup.add(globe);

      const planter = new THREE.Mesh(planterBoxGeo, planterPotMat);
      planter.position.set(fx, 0.33, fz + zSign * 1.9);
      sidewalkGroup.add(planter);

      const bush = new THREE.Mesh(planterBushGeo, planterFoliageMat);
      bush.position.set(fx, 0.72, fz + zSign * 1.9);
      sidewalkGroup.add(bush);

      if (zi === 1) {
        const bench = new THREE.Mesh(benchSeatGeo, benchWoodMat);
        bench.position.set(fx, 0.45, fz - zSign * 2.4);
        sidewalkGroup.add(bench);

        for (let r = 0; r < 2; r++) {
          const rack = new THREE.Mesh(bikeRackLoopGeo, lampPostMat);
          rack.position.set(fx, 0.12, fz + zSign * (3.8 + r * 0.65));
          sidewalkGroup.add(rack);
        }
      }
    }
  }

  // Rear promenade wrapping sidewalks along |z| = 103.1 so city sidewalks wrap all 4 sides of every commercial block
  const rearWrapSlabGeo = regGeo(new THREE.BoxGeometry(49.6, 0.09, 2.0));
  for (const bx of [-30.0, 30.0]) {
    for (const zSign of [-1, 1]) {
      const rearWrap = new THREE.Mesh(rearWrapSlabGeo, sidewalkSlabMat);
      rearWrap.position.set(bx, 0.045, zSign * 103.1);
      rearWrap.receiveShadow = true;
      sidewalkGroup.add(rearWrap);
    }
  }

  // Real GLB cache + per-lot replaceable rooftop billboard texture loader
  const gltfLoader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();
  const glbTemplateCache = new Map<ShopBuildingFormId, Promise<THREE.Group | null>>();
  const neutralBillboardTex = createNeutralBillboardTexture(disposables);
  let disposed = false;

  const loadShopGlbTemplate = (formId: ShopBuildingFormId): Promise<THREE.Group | null> => {
    const cached = glbTemplateCache.get(formId);
    if (cached) return cached;
    const spec = SHOP_BUILDING_FORMS[formId];
    const p = new Promise<THREE.Group | null>((resolve) => {
      if (typeof window === 'undefined') {
        resolve(null);
        return;
      }
      gltfLoader.load(
        spec.glbPath,
        (gltf) => resolve(gltf.scene),
        undefined,
        () => resolve(null),
      );
    });
    glbTemplateCache.set(formId, p);
    return p;
  };

  const applyBillboardLogoToObject = (root: THREE.Object3D, logoUrl: string | null) => {
    const applyTex = (tex: THREE.Texture) => {
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | undefined;
        if (
          mesh.name === SHOP_BILLBOARD_MESH_SPEC.meshName ||
          mat?.name === SHOP_BILLBOARD_MESH_SPEC.materialName
        ) {
          if (mat && 'map' in mat) {
            mat.map = tex;
            mat.needsUpdate = true;
          }
        }
      });
    };

    if (!logoUrl) {
      applyTex(neutralBillboardTex);
      return;
    }

    textureLoader.load(
      logoUrl,
      (loadedTex) => {
        if (disposed) {
          loadedTex.dispose();
          return;
        }
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        loadedTex.needsUpdate = true;
        disposables.push(loadedTex);
        applyTex(loadedTex);
      },
      undefined,
      () => applyTex(neutralBillboardTex),
    );
  };

  const sync: CityRentalLotsVisualController['sync'] = (params) => {
    const visibleMode = params.isSafezoneMode && params.showOutdoor;
    rootGroup.visible = visibleMode;
    if (!visibleMode) return;

    const resolvedStates = resolveCityRentalLotsState({
      blueCommanderBases: params.blueCommanderBases,
      redCommanderBases: params.redCommanderBases,
      rentedSlotIds: params.rentedSlotIds,
      lotStatusBySlotId: params.lotStatusBySlotId,
      placedBuildingBySlotId: params.placedBuildingBySlotId,
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

      const targetForm = st.showShopBuilding ? st.placedBuildingFormId : null;
      const targetLogoUrl = params.billboardLogoUrlBySlotId?.[node.spec.slotId] ?? null;

      if (targetForm) {
        node.lotPavingMesh.material = lotPavingMatByForm[targetForm];
        node.lotPavingMesh.visible = true;
        if (node.loadedGlbFormId !== targetForm) {
          node.loadedGlbFormId = targetForm;
          node.appliedBillboardLogoUrl = null;
          node.glbBuildingMount.clear();
          node.glbBuildingMount.visible = false;
          node.shopBuildingGroup.visible = true;
          void loadShopGlbTemplate(targetForm).then((template) => {
            if (!template || disposed || node.loadedGlbFormId !== targetForm) return;
            const clone = template.clone(true);
            // Clone billboard material per placed building so logo textures NEVER leak to other lots
            clone.traverse((obj) => {
              const mesh = obj as THREE.Mesh;
              if (
                mesh.isMesh &&
                (mesh.name === SHOP_BILLBOARD_MESH_SPEC.meshName ||
                  (mesh.material as THREE.Material | undefined)?.name ===
                    SHOP_BILLBOARD_MESH_SPEC.materialName)
              ) {
                const clonedMat = (mesh.material as THREE.Material).clone();
                disposables.push(clonedMat);
                mesh.material = clonedMat;
              }
            });
            node.glbBuildingMount.clear();
            node.glbBuildingMount.add(clone);
            node.glbBuildingMount.visible = true;
            node.shopBuildingGroup.visible = false;
            node.appliedBillboardLogoUrl = targetLogoUrl;
            applyBillboardLogoToObject(clone, targetLogoUrl);
          });
        } else if (node.appliedBillboardLogoUrl !== targetLogoUrl) {
          node.appliedBillboardLogoUrl = targetLogoUrl;
          applyBillboardLogoToObject(
            node.glbBuildingMount.visible ? node.glbBuildingMount : node.shopBuildingGroup,
            targetLogoUrl,
          );
        }
      } else {
        node.lotPavingMesh.visible = false;
        node.shopBuildingGroup.visible = false;
        node.glbBuildingMount.visible = false;
        if (node.loadedGlbFormId !== null) {
          node.loadedGlbFormId = null;
          node.glbBuildingMount.clear();
        }
      }

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
    disposed = true;
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
