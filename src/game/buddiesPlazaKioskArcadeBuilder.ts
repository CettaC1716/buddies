import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  buildBoutiqueGarmentRack,
  buildBoutiqueMannequin,
  buildFashionAccessoriesShelving,
  getFashionBoutiqueAFrameSignTexture,
  type KioskPartHelper,
} from './buddiesFashionKioskBuilder';
import { FASHION_APPAREL_KIOSK_LAYOUT } from './buddiesFashionKioskRules';
import {
  buildRealEstateArchitecturalScaleModel,
  buildRealEstateConsultationDeskZone,
  buildShowroomFurnitureLoungeVignette,
  getInteriorGalleryPrintTextures,
  getMasterFloorplanBlueprintTexture,
  getRealEstateAFrameSignTexture,
} from './buddiesRealEstateKioskBuilder';
import { REAL_ESTATE_FURNITURE_KIOSK_LAYOUT } from './buddiesRealEstateKioskRules';
import {
  addShowroomUrbanHelmet,
  buildSpokeWheelAssembly,
  createElectricScooterBike3D,
  createPushKickScooter3D,
  getShowroomAFrameSignTexture,
  getShowroomBackwallGraphicTexture,
  type ScooterToonPartHelper,
} from './buddiesUrbanScooterBuilder';
import { URBAN_SCOOTER_SHOP_LAYOUT } from './buddiesUrbanScooterRules';
import {
  createCityWindowSpec,
  tagCityWindowMesh,
  type CityWindowKind,
} from './buddiesWindowAuditRules';

export interface ArcadeFlowerClusterSpec {
  matrix: THREE.Matrix4;
  mainHex: string;
  depthHex: string;
}

export interface BuildPlazaKioskArcadeOptions {
  westPlantGroup: THREE.Group;
  isSoftwareGl: boolean;
  sharedClearGlassMat: THREE.Material;
  createMitredPolylineStripGeometry: (
    pts: [number, number][],
    width: number,
    height: number,
    closed?: boolean,
  ) => THREE.BufferGeometry;
  addLobbyPart: (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    pos: [number, number, number],
    rot?: [number, number, number],
    toonStrokeWidth?: number,
    tex?: THREE.Texture,
    bumpScale?: number,
  ) => THREE.Mesh;
  createBlitzStrokeMesh: (
    geo: THREE.BufferGeometry,
    strokeWidth: number,
  ) => THREE.Mesh | null;
  textures: {
    steelRoofTex?: THREE.Texture;
    granitePaverTex?: THREE.Texture;
    verticalTimberTex?: THREE.Texture;
    timberTex?: THREE.Texture;
    concreteTex?: THREE.Texture;
    louverTex?: THREE.Texture;
  };
  createPlazaLeafPetalShrubInstanced?: (
    matrices: THREE.Matrix4[],
    meshName: string,
  ) => THREE.InstancedMesh;
  createPlazaFlowerPetalClusterInstanced?: (
    specs: ArcadeFlowerClusterSpec[],
    meshName: string,
  ) => THREE.InstancedMesh;
}

const ARCADE_CENTER_LOCAL_X = REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.kioskLocalX; // -9.60 (worldX = -100.10)
const ARCADE_CENTER_LOCAL_Y = REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.kioskLocalY; // 2.50
const ARCADE_CENTER_LOCAL_Z = REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.kioskLocalZ; // -4.40

// Bay offsets along arcade local X (-X = South/Left, 0 = Center, +X = North/Right)
const BAY_FASHION_X = -6.75; // worldZ = +2.35
const BAY_REAL_ESTATE_X = 0.0; // worldZ = -4.40
const BAY_SCOOTER_X = 6.75; // worldZ = -11.15

const PILASTER_XS = [-10.16, -3.375, 3.375, 10.16] as const;
const PARAPET_CORNER_X = 10.16;
const ARCADE_HALF_W = 10.58;
const WINDOW_SILL_TOP_Y = 0.96;
const STOREFRONT_TOP_Y = 4.08;
const DOOR_TOP_Y = 3.74;

let _cachedArcadeStuccoTex: THREE.Texture | null = null;
let _cachedArcadeFanCobbleTex: THREE.Texture | null = null;
let _cachedArcadeBronzeSealTex: THREE.Texture | null = null;
let _cachedFashionBoutiqueFasciaTex: THREE.Texture | null = null;
let _cachedRealEstateFasciaTex: THREE.Texture | null = null;
let _cachedUrbanScooterFasciaTex: THREE.Texture | null = null;

function makeCanvas(w: number, h: number): {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
} {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return { canvas, ctx: canvas.getContext('2d') };
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    return { canvas, ctx: canvas.getContext('2d') };
  }
  return {
    canvas: { width: w, height: h } as unknown as HTMLCanvasElement,
    ctx: null,
  };
}

function makeFallbackDataTex(r: number, g: number, b: number): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function getArcadeStuccoTexture(): THREE.Texture {
  if (_cachedArcadeStuccoTex) return _cachedArcadeStuccoTex;
  const { canvas, ctx } = makeCanvas(512, 512);
  if (!ctx) {
    _cachedArcadeStuccoTex = makeFallbackDataTex(235, 224, 202);
    return _cachedArcadeStuccoTex;
  }
  ctx.fillStyle = '#ece2cc';
  ctx.fillRect(0, 0, 512, 512);
  // Soft organic lime-plaster trowel shading (smooth gradients + fine sand stipple)
  for (let i = 0; i < 180; i++) {
    const x = (i * 139 + 29) % 512;
    const y = (i * 211 + 47) % 512;
    const r = 18 + (i % 26);
    const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
    const tint = i % 2 === 0 ? 'rgba(210, 194, 166, 0.11)' : 'rgba(255, 251, 243, 0.11)';
    grad.addColorStop(0, tint);
    grad.addColorStop(1, 'rgba(236, 226, 204, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 1400; i++) {
    const x = (i * 97 + 13) % 512;
    const y = (i * 193 + 31) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(175, 158, 132, 0.08)' : 'rgba(255, 250, 242, 0.10)';
    ctx.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  _cachedArcadeStuccoTex = tex;
  return tex;
}

function getArcadeFanCobblestoneTexture(): THREE.Texture {
  if (_cachedArcadeFanCobbleTex) return _cachedArcadeFanCobbleTex;
  const { canvas, ctx } = makeCanvas(512, 512);
  if (!ctx) {
    _cachedArcadeFanCobbleTex = makeFallbackDataTex(168, 148, 139);
    return _cachedArcadeFanCobbleTex;
  }
  ctx.fillStyle = '#a8948b';
  ctx.fillRect(0, 0, 512, 512);
  const fanCols = ['#b8a399', '#9e8980', '#c2aea4', '#8f7b72'];
  const spacingX = 128;
  const spacingY = 86;
  for (let row = -1; row <= 7; row++) {
    const cy = row * spacingY;
    const xShift = (row % 2) * (spacingX * 0.5);
    for (let col = -1; col <= 5; col++) {
      const cx = col * spacingX + xShift;
      for (let ring = 4; ring >= 1; ring--) {
        const rOuter = ring * 18;
        ctx.beginPath();
        ctx.arc(cx, cy, rOuter, Math.PI * 1.12, Math.PI * 1.88);
        ctx.strokeStyle = fanCols[(row + col + ring + 8) % fanCols.length];
        ctx.lineWidth = 14;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, rOuter + 7, Math.PI * 1.10, Math.PI * 1.90);
        ctx.strokeStyle = '#6e5f58';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
      ctx.strokeStyle = '#6e5f58';
      ctx.lineWidth = 2;
      for (let a = 0; a <= 8; a++) {
        const ang = Math.PI * (1.12 + (a / 8) * 0.76);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * 14, cy + Math.sin(ang) * 14);
        ctx.lineTo(cx + Math.cos(ang) * 76, cy + Math.sin(ang) * 76);
        ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  _cachedArcadeFanCobbleTex = tex;
  return tex;
}

function getArcadeBronzeMedallionTexture(): THREE.Texture {
  if (_cachedArcadeBronzeSealTex) return _cachedArcadeBronzeSealTex;
  const { canvas, ctx } = makeCanvas(256, 256);
  if (!ctx) {
    _cachedArcadeBronzeSealTex = makeFallbackDataTex(140, 109, 70);
    return _cachedArcadeBronzeSealTex;
  }
  ctx.fillStyle = '#735a3c';
  ctx.fillRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fillStyle = '#8c6d46';
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#d4aa4f';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#e0bc68';
  ctx.stroke();

  ctx.fillStyle = '#e6c575';
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(128 + Math.cos(a) * 106, 128 + Math.sin(a) * 106, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#d9b155';
  ctx.beginPath();
  ctx.arc(128, 128, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#59432a';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('PLAZA', 128, 134);

  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  _cachedArcadeBronzeSealTex = tex;
  return tex;
}

export function getFashionBoutiqueFasciaSignTexture(): THREE.Texture {
  if (_cachedFashionBoutiqueFasciaTex) return _cachedFashionBoutiqueFasciaTex;
  const { canvas, ctx } = makeCanvas(512, 128);
  if (!ctx) {
    _cachedFashionBoutiqueFasciaTex = makeFallbackDataTex(76, 36, 48);
    return _cachedFashionBoutiqueFasciaTex;
  }
  ctx.fillStyle = '#4c2430';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#dfbf86';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 492, 108);
  ctx.strokeStyle = '#9e7e4f';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(18, 18, 476, 92);

  // Subtle corner diamond accents matching atelier signboard styling
  ctx.fillStyle = '#dfbf86';
  for (const [dx, dy] of [
    [28, 28],
    [484, 28],
    [28, 100],
    [484, 100],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(dx, dy - 4);
    ctx.lineTo(dx + 4, dy);
    ctx.lineTo(dx, dy + 4);
    ctx.lineTo(dx - 4, dy);
    ctx.closePath();
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#eed4a5';
  ctx.font = '800 26px Georgia, "Plus Jakarta Sans", serif';
  ctx.fillText('FASHION', 256, 45);
  ctx.fillStyle = '#fff9ef';
  ctx.font = '800 39px Georgia, "Plus Jakarta Sans", serif';
  ctx.fillText('BOUTIQUE', 256, 86);

  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  _cachedFashionBoutiqueFasciaTex = tex;
  return tex;
}

function getRealEstateFasciaSignTexture(): THREE.Texture {
  if (_cachedRealEstateFasciaTex) return _cachedRealEstateFasciaTex;
  const { canvas, ctx } = makeCanvas(512, 128);
  if (!ctx) {
    _cachedRealEstateFasciaTex = makeFallbackDataTex(240, 229, 206);
    return _cachedRealEstateFasciaTex;
  }
  ctx.fillStyle = '#efe3cb';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#333840';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 112);
  ctx.strokeStyle = '#8a6c46';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, 476, 92);

  ctx.fillStyle = '#262b32';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 32px Georgia, "Plus Jakarta Sans", serif';
  ctx.fillText('REAL ESTATE &', 256, 48);
  ctx.font = '800 31px Georgia, "Plus Jakarta Sans", serif';
  ctx.fillText('DESIGN STUDIO', 256, 86);

  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  _cachedRealEstateFasciaTex = tex;
  return tex;
}

function getUrbanScooterFasciaSignTexture(): THREE.Texture {
  if (_cachedUrbanScooterFasciaTex) return _cachedUrbanScooterFasciaTex;
  const { canvas, ctx } = makeCanvas(512, 128);
  if (!ctx) {
    _cachedUrbanScooterFasciaTex = makeFallbackDataTex(45, 106, 84);
    return _cachedUrbanScooterFasciaTex;
  }
  ctx.fillStyle = '#2d6a54';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#d6c6a5';
  ctx.lineWidth = 5;
  ctx.strokeRect(10, 10, 492, 108);
  ctx.strokeStyle = '#204d3d';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, 476, 92);

  ctx.fillStyle = '#f8f6f0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 33px "Plus Jakarta Sans", "Barlow", sans-serif';
  ctx.fillText('URBAN SCOOTER', 256, 48);
  ctx.fillStyle = '#e7f5ee';
  ctx.font = '800 30px "Plus Jakarta Sans", "Barlow", sans-serif';
  ctx.fillText('& MOBILITY', 256, 86);

  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  _cachedUrbanScooterFasciaTex = tex;
  return tex;
}

function buildWoodenAFrameSign(
  parent: THREE.Object3D,
  partHelper: KioskPartHelper,
  name: string,
  pos: [number, number, number],
  rotY: number,
  faceTex: THREE.Texture,
  frameColor: string,
  woodTex?: THREE.Texture,
): THREE.Group {
  const signGrp = new THREE.Group();
  signGrp.name = name;
  signGrp.position.set(pos[0], pos[1], pos[2]);
  signGrp.rotation.y = rotY;
  parent.add(signGrp);

  for (const sideZ of [-1, 1]) {
    const tiltRad = sideZ * 0.19;
    const panelZ = sideZ * 0.125;
    partHelper.addPart(
      signGrp,
      new THREE.BoxGeometry(0.68, 0.98, 0.046),
      frameColor,
      [0, 0.54, panelZ],
      [-tiltRad, 0, 0],
      0.007,
      woodTex,
      1.2,
    );
    for (const legX of [-0.29, 0.29]) {
      partHelper.addPart(
        signGrp,
        new THREE.BoxGeometry(0.06, 0.16, 0.046),
        frameColor,
        [legX, 0.075, sideZ * 0.21],
        [-tiltRad, 0, 0],
        0.005,
        woodTex,
        1.0,
      );
    }
    partHelper.addPart(
      signGrp,
      new THREE.PlaneGeometry(0.56, 0.82),
      '#ffffff',
      [0, 0.55, panelZ + sideZ * 0.026],
      sideZ > 0 ? [-tiltRad, 0, 0] : [tiltRad, Math.PI, 0],
      0,
      faceTex,
      0.2,
      false,
    );
  }
  partHelper.addPart(
    signGrp,
    new THREE.BoxGeometry(0.54, 0.024, 0.26),
    '#2b3036',
    [0, 0.26, 0],
    [0, 0, 0],
    0.003,
    undefined,
    0.4,
    false,
  );
  return signGrp;
}

/**
 * Builds the unified 3-Bay Elongated Civic Commercial Arcade (`LobbyPlazaCommercialArcade3D`)
 * matching the 4-view Architectural Model Sheet (`media_1795013971350_b55d20d1.jpg`) 1:1:
 *   - Bay 1 (Left/South, `lx = -6.75`): Fashion & Apparel Outfit Kiosk (semi-circular arched sunburst window + mannequins & racks)
 *   - Bay 2 (Center, `lx = 0.00`): Real Estate & Design Studio (3-pane window, "REAL ESTATE & DESIGN STUDIO" plaque, scale model, desk, prints, lounge chair)
 *   - Bay 3 (Right/North, `lx = +6.75`): Urban Scooter & Mobility (double glass doors, "URBAN SCOOTER & MOBILITY" plaque, charging dock rack + 2 static scooters)
 */
export function buildPlazaCommercialArcade3D(
  opts: BuildPlazaKioskArcadeOptions,
): THREE.Group {
  const COL_STUCCO = '#ebe0ca';
  const COL_SANDSTONE = '#d9cfbc';
  const COL_SANDSTONE_DARK = '#b8ad99';
  const COL_BRICK = '#b97352';
  const COL_BRICK_DARK = '#9c593c';
  const COL_BRICK_LIGHT = '#c78462';
  const COL_SLATE_CORNICE = '#4b5862';
  const COL_SLATE_DARK = '#36414a';
  const COL_BRONZE_FRAME = '#323840';
  const COL_STEEL_DOOR = '#58616b';
  const COL_OAK_FLOOR = '#cfa06e';
  const COL_BENCH_GREEN = '#2f5439';
  const COL_CAST_IRON = '#28302c';
  const COL_LED_WARM = '#ffefc2';

  const arcadeGrp = new THREE.Group();
  arcadeGrp.name = 'LobbyPlazaCommercialArcade3D';
  arcadeGrp.position.set(
    ARCADE_CENTER_LOCAL_X,
    ARCADE_CENTER_LOCAL_Y,
    ARCADE_CENTER_LOCAL_Z,
  );
  arcadeGrp.rotation.y = Math.PI / 2;
  opts.westPlantGroup.add(arcadeGrp);

  const stuccoTex = getArcadeStuccoTexture();
  const fanCobbleTex = getArcadeFanCobblestoneTexture();
  const bronzeSealTex = getArcadeBronzeMedallionTexture();

  const partHelper: KioskPartHelper = {
    addPart(
      parent,
      geo,
      colorHex,
      pos,
      rot = [0, 0, 0],
      toonStrokeWidth = 0.008,
      tex,
      bumpScale = 1.4,
      castShad = true,
    ) {
      const mesh = opts.addLobbyPart(parent, geo, colorHex, pos, rot, 0, tex, bumpScale);
      mesh.castShadow = !opts.isSoftwareGl && castShad;
      if (toonStrokeWidth > 0) {
        const stroke = opts.createBlitzStrokeMesh(geo, toonStrokeWidth);
        if (stroke) mesh.add(stroke);
      }
      return mesh;
    },
  };

  const scooterPartHelper: ScooterToonPartHelper = {
    isSoftwareGl: opts.isSoftwareGl,
    addPart(
      parent,
      geo,
      colorHex,
      pos,
      rot = [0, 0, 0],
      toonStrokeWidth = 0.007,
      tex,
      bumpScale = 1.2,
      castShad = true,
    ) {
      return partHelper.addPart(
        parent,
        geo,
        colorHex,
        pos,
        rot,
        toonStrokeWidth,
        tex,
        bumpScale,
        castShad,
      );
    },
  };

  const addLuminousPart = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    _emissiveHex: string,
    _emissiveIntensity: number,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    tex?: THREE.Texture,
  ): THREE.Mesh =>
    partHelper.addPart(parent, geo, colorHex, pos, rot, 0, tex, 0.4, false);

  let arcadeGlassCounter = 0;
  const addGlassPane = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    windowMeta?: { id: string; kind: CityWindowKind; baseColorHex?: string; row?: number; col?: number },
  ): THREE.Mesh => {
    const gMesh = new THREE.Mesh(geo, opts.sharedClearGlassMat);
    gMesh.position.set(pos[0], pos[1], pos[2]);
    gMesh.rotation.set(rot[0], rot[1], rot[2]);
    gMesh.castShadow = false;
    gMesh.receiveShadow = false;
    const idx = arcadeGlassCounter++;
    tagCityWindowMesh(
      gMesh,
      createCityWindowSpec(
        windowMeta?.id ?? `arcade-glass-${idx}`,
        windowMeta?.kind ?? 'storefront',
        windowMeta?.baseColorHex ?? '#c9e6f4',
        windowMeta?.row ?? 1,
        windowMeta?.col ?? idx,
      ),
    );
    parent.add(gMesh);
    return gMesh;
  };

  // =========================================================================
  // 1. CIVIC FAN-PATTERN COBBLESTONE WALKWAY APRON, CURB & BRONZE SEAL INLAY
  // =========================================================================
  // Continuous monolithic U-shaped cobblestone apron wrapping Front (`z in [+2.50 .. +4.95]`) & Left/Right wings
  const apronShape = new THREE.Shape([
    new THREE.Vector2(-11.35, 2.50),
    new THREE.Vector2(-10.58, 2.50),
    new THREE.Vector2(-10.58, -2.50),
    new THREE.Vector2(10.58, -2.50),
    new THREE.Vector2(10.58, 2.50),
    new THREE.Vector2(11.35, 2.50),
    new THREE.Vector2(11.35, -4.95),
    new THREE.Vector2(-11.35, -4.95),
  ]);
  apronShape.closePath();
  const apronGeo = new THREE.ExtrudeGeometry(apronShape, {
    depth: 0.045,
    bevelEnabled: false,
  });
  apronGeo.rotateX(-Math.PI / 2);
  partHelper.addPart(
    arcadeGrp,
    apronGeo,
    '#ffffff',
    [0, 0, 0],
    [0, 0, 0],
    0,
    fanCobbleTex,
    1.85,
    false,
  );
  // Low chamfered granite border curb wrapping Left, Front, and Right apron edges
  const apronCurbPts: [number, number][] = [
    [-11.35, -2.50],
    [-11.35, 4.95],
    [11.35, 4.95],
    [11.35, -2.50],
  ];
  partHelper.addPart(
    arcadeGrp,
    opts.createMitredPolylineStripGeometry(apronCurbPts, 0.16, 0.06, false),
    COL_SANDSTONE,
    [0, 0.030, 0],
    [0, 0, 0],
    0.008,
    opts.textures.concreteTex,
    1.5,
    false,
  );

  // Circular Bronze Seal Medallion Inlay centered in front of Center Bay 2 (`lx = 0, lz = 3.85`)
  partHelper.addPart(
    arcadeGrp,
    new THREE.CylinderGeometry(0.45, 0.47, 0.028, 24),
    COL_SANDSTONE,
    [0, 0.036, 3.85],
    [0, 0, 0],
    0,
    opts.textures.concreteTex,
    1.2,
    false,
  );
  partHelper.addPart(
    arcadeGrp,
    new THREE.CylinderGeometry(0.39, 0.39, 0.028, 24),
    '#ffffff',
    [0, 0.044, 3.85],
    [0, 0, 0],
    0,
    bronzeSealTex,
    0.4,
    false,
  );

  const makeRoundedArcadeBox = (w: number, h: number, d: number, r = 0.014, seg = 2) =>
    new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w * 0.42, h * 0.42, d * 0.42));

  const addAnchoredDoorPullHandle = (hx: number, hy: number, hz = 2.44) => {
    const pullCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, hy - 0.26, hz - 0.01),
      new THREE.Vector3(hx, hy - 0.25, hz + 0.085),
      new THREE.Vector3(hx, hy, hz + 0.095),
      new THREE.Vector3(hx, hy + 0.25, hz + 0.085),
      new THREE.Vector3(hx, hy + 0.26, hz - 0.01),
    ]);
    partHelper.addPart(
      arcadeGrp,
      new THREE.TubeGeometry(pullCurve, 16, 0.020, 10, false),
      '#e2e8f0',
      [0, 0, 0],
      [0, 0, 0],
      0.003,
      undefined,
      0.4,
      false,
    );
    for (const sy of [hy - 0.25, hy + 0.25]) {
      const collar = new THREE.CylinderGeometry(0.032, 0.032, 0.025, 10);
      collar.rotateX(Math.PI / 2);
      partHelper.addPart(arcadeGrp, collar, '#cbd5e1', [hx, sy, hz + 0.012], [0, 0, 0], 0.002, undefined, 0.4, false);
    }
  };

  const makeMiteredPictureFrameGeo = (outerW: number, outerH: number, rim = 0.06, depth = 0.045) => {
    const hw = outerW * 0.5;
    const hh = outerH * 0.5;
    const ihw = hw - rim;
    const ihh = hh - rim;
    const outer = new THREE.Shape();
    outer.moveTo(-hw, -hh);
    outer.lineTo(hw, -hh);
    outer.lineTo(hw, hh);
    outer.lineTo(-hw, hh);
    outer.closePath();
    const inner = new THREE.Path();
    inner.moveTo(-ihw, -ihh);
    inner.lineTo(-ihw, ihh);
    inner.lineTo(ihw, ihh);
    inner.lineTo(ihw, -ihh);
    inner.closePath();
    outer.holes.push(inner);
    const geo = new THREE.ExtrudeGeometry(outer, {
      depth: depth - 0.012,
      bevelEnabled: true,
      bevelSize: 0.006,
      bevelThickness: 0.006,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -(depth - 0.012) * 0.5);
    geo.computeVertexNormals();
    return geo;
  };

  // Interior warm oak plank floor (`y = 0.04 .. 0.14`, top at `y = 0.14m`) & airy bright ceiling soffit (`y = 4.22m`)
  partHelper.addPart(
    arcadeGrp,
    makeRoundedArcadeBox(20.78, 0.10, 4.64, 0.015),
    COL_OAK_FLOOR,
    [0, 0.09, 0],
    [0, 0, 0],
    0,
    opts.textures.timberTex,
    1.5,
    false,
  );
  partHelper.addPart(
    arcadeGrp,
    makeRoundedArcadeBox(20.78, 0.06, 4.60, 0.012),
    '#f6f2e8',
    [0, 4.22, 0],
    [0, 0, 0],
    0,
    undefined,
    0.4,
    false,
  );
  for (const bayX of [BAY_FASHION_X, BAY_REAL_ESTATE_X, BAY_SCOOTER_X]) {
    for (const dx of [-1.75, 0.0, 1.75]) {
      for (const dz of [-0.95, 0.95]) {
        addLuminousPart(
          arcadeGrp,
          new THREE.CylinderGeometry(0.085, 0.085, 0.024, 10),
          COL_LED_WARM,
          '#ffe59e',
          0.85,
          [bayX + dx, 4.18, dz],
        );
      }
    }
  }

  // Interior bay demising walls separating Bay 1|Bay 2 (`lx = -3.375`) and Bay 2|Bay 3 (`lx = +3.375`)
  for (const px of [-3.375, 3.375]) {
    partHelper.addPart(
      arcadeGrp,
      makeRoundedArcadeBox(0.22, 4.08, 4.64, 0.018),
      '#f2ece0',
      [px, 2.20, 0.01],
      [0, 0, 0],
      0.006,
      stuccoTex,
      1.8,
      false,
    );
  }

  // =========================================================================
  // 2. BUILDING ENVELOPE SHELL (STUCCO WALLS, SIDE PROFILES, REAR WALL & FRIEZE)
  // =========================================================================
  // Rear Wall (`lz = -2.42`, inset cleanly inside North/South side walls to eliminate corner butt overlap)
  partHelper.addPart(
    arcadeGrp,
    makeRoundedArcadeBox(ARCADE_HALF_W * 2 - 0.34, 5.20, 0.16, 0.018),
    COL_STUCCO,
    [0, 2.63, -2.42],
    [0, 0, 0],
    0.011,
    stuccoTex,
    2.2,
  );
  // Warm interior rear gallery wall lining (`lz = -2.31`)
  partHelper.addPart(
    arcadeGrp,
    makeRoundedArcadeBox(20.74, 4.04, 0.06, 0.012),
    '#f4efe4',
    [0, 2.17, -2.31],
    [0, 0, 0],
    0,
    stuccoTex,
    1.8,
    false,
  );

  // North Right Side Wall (`lx = +10.50`, solid distressed cream stucco per Side Profile Elevation View)
  partHelper.addPart(
    arcadeGrp,
    makeRoundedArcadeBox(0.16, 5.22, 4.84, 0.018),
    COL_STUCCO,
    [ARCADE_HALF_W - 0.08, 2.63, 0.0],
    [0, 0, 0],
    0.011,
    stuccoTex,
    2.2,
  );

  // South Left Side Wall (`lx = -10.50`)
  const southX = -(ARCADE_HALF_W - 0.08);
  partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.16, 5.22, 1.66, 0.016), COL_STUCCO, [southX, 2.63, -1.59], [0, 0, 0], 0.010, stuccoTex, 2.2);
  partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.16, 5.22, 1.06, 0.016), COL_STUCCO, [southX, 2.63, 1.89], [0, 0, 0], 0.010, stuccoTex, 2.2);
  partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.16, 0.84, 2.08, 0.014), COL_STUCCO, [southX, 0.45, 0.30], [0, 0, 0], 0.008, stuccoTex, 2.0);
  partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.20, 0.22, 2.12, 0.014), COL_SANDSTONE_DARK, [southX - 0.02, 0.13, 0.30], [0, 0, 0], 0.006, opts.textures.concreteTex);
  partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.16, 1.36, 2.08, 0.014), COL_STUCCO, [southX, 4.55, 0.30], [0, 0, 0], 0.009, stuccoTex, 2.0);
  partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.26, 0.12, 2.26, 0.016), COL_SANDSTONE, [southX - 0.04, WINDOW_SILL_TOP_Y - 0.06, 0.30], [0, 0, 0], 0.007, opts.textures.concreteTex);
  partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.24, 0.11, 2.24, 0.016), COL_SANDSTONE, [southX - 0.03, 3.88, 0.30], [0, 0, 0], 0.007, opts.textures.concreteTex);
  for (const sz of [-0.72, -0.04, 0.64, 1.32]) {
    partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.18, 2.90, 0.08, 0.010), COL_BRONZE_FRAME, [southX - 0.02, 2.41, sz], [0, 0, 0], 0.006);
  }
  partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.18, 0.075, 2.10, 0.010), COL_BRONZE_FRAME, [southX - 0.02, 3.24, 0.30], [0, 0, 0], 0.005);
  addGlassPane(arcadeGrp, new THREE.PlaneGeometry(2.04, 2.86), [southX, 2.41, 0.30], [0, -Math.PI / 2, 0]);

  // Continuous Front Entablature Frieze Band (`y = 4.38 .. 5.24m`, inset inside side walls cleanly)
  partHelper.addPart(
    arcadeGrp,
    makeRoundedArcadeBox(ARCADE_HALF_W * 2 - 0.34, 0.86, 0.24, 0.018),
    COL_STUCCO,
    [0, 4.81, 2.38],
    [0, 0, 0],
    0.010,
    stuccoTex,
    2.2,
  );
  // Classical Sandstone Stringcourse Architrave Beam above Pilasters (`y = 4.30 .. 4.44m`)
  partHelper.addPart(
    arcadeGrp,
    makeRoundedArcadeBox(ARCADE_HALF_W * 2 + 0.24, 0.14, 0.38, 0.018),
    COL_SANDSTONE,
    [0, 4.36, 2.44],
    [0, 0, 0],
    0.008,
    opts.textures.concreteTex,
  );

  // =========================================================================
  // 3. DISTRESSED EXPOSED TERRACOTTA BRICK CORNER QUOINING (ALL 4 CORNERS)
  //    Matches Side Profile Elevation View & Rear Elevation View 1:1
  // =========================================================================
  const addBrickBlock = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    idx: number,
  ) => {
    const col = idx % 3 === 0 ? COL_BRICK_DARK : idx % 3 === 1 ? COL_BRICK : COL_BRICK_LIGHT;
    partHelper.addPart(
      arcadeGrp,
      new THREE.BoxGeometry(w, h, d),
      col,
      [x, y, z],
      [0, 0, 0],
      0.006,
      undefined,
      1.0,
      false,
    );
  };

  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      const cornerX = xSign * ARCADE_HALF_W;
      const cornerZ = zSign * 2.50;
      for (let q = 0; q < 17; q++) {
        const isLongSide = q % 2 === 0;
        const bw = isLongSide ? 0.36 : 0.54;
        const bd = isLongSide ? 0.54 : 0.36;
        const bh = 0.245;
        const by = 0.24 + q * 0.295;
        addBrickBlock(
          cornerX - xSign * (bw * 0.5 - 0.04),
          by,
          cornerZ - zSign * (bd * 0.5 - 0.04),
          bw,
          bh,
          bd,
          q + (xSign > 0 ? 1 : 0),
        );
      }
      // Stepped irregular exposed brick flares inward along Side Profiles (base & upper eaves)
      const flareSteps: [number, number, number][] = [
        [0.24, 0.74, 0.60],
        [0.535, 0.54, 0.50],
        [0.83, 0.34, 0.42],
        [4.66, 0.64, 0.54],
        [4.955, 0.94, 0.64],
      ];
      for (let f = 0; f < flareSteps.length; f++) {
        const [fy, fzRun, fwReach] = flareSteps[f];
        addBrickBlock(
          cornerX + xSign * 0.01,
          fy,
          cornerZ - zSign * (0.48 + fzRun * 0.5),
          0.08,
          0.22,
          fzRun,
          f,
        );
        if (zSign < 0) {
          // Wrap irregular brick peel along Rear Elevation outer ends too
          addBrickBlock(
            cornerX - xSign * (0.48 + fwReach * 0.5),
            fy,
            cornerZ - 0.01,
            fwReach,
            0.22,
            0.08,
            f + 2,
          );
        }
      }
    }
  }

  // =========================================================================
  // 4. 4 FLUTED NEOCLASSICAL SANDSTONE PILASTERS ALONG FRONT FACADE
  // =========================================================================
  for (const px of PILASTER_XS) {
    const pilGrp = new THREE.Group();
    pilGrp.position.set(px, 0, 2.52);
    arcadeGrp.add(pilGrp);
    const isOuter = Math.abs(px) > 5.0;
    const baseW = isOuter ? 0.54 : 0.72;
    const neckW = isOuter ? 0.48 : 0.64;
    const shaftW = isOuter ? 0.44 : 0.58;
    const capW = isOuter ? 0.56 : 0.74;
    // Stepped plinth base (`y = 0.04 .. 0.48`)
    partHelper.addPart(pilGrp, new THREE.BoxGeometry(baseW, 0.34, 0.32), COL_SANDSTONE_DARK, [0, 0.21, 0.02], [0, 0, 0], 0.008, opts.textures.concreteTex);
    partHelper.addPart(pilGrp, new THREE.BoxGeometry(neckW, 0.11, 0.28), COL_SANDSTONE, [0, 0.435, 0.01], [0, 0, 0], 0.007);
    // Tall fluted shaft (`y = 0.49 .. 4.03`, `height = 3.54m`)
    partHelper.addPart(pilGrp, new THREE.BoxGeometry(shaftW, 3.54, 0.24), COL_SANDSTONE, [0, 2.26, 0.0], [0, 0, 0], 0.008, opts.textures.concreteTex);
    // 3 Crisp dark recessed vertical flute channels on front face
    for (const fx of [-0.13, 0.0, 0.13]) {
      partHelper.addPart(pilGrp, new THREE.BoxGeometry(0.055, 3.16, 0.03), COL_SANDSTONE_DARK, [fx, 2.26, 0.112], [0, 0, 0], 0, undefined, 1.0, false);
    }
    // Classical necking + molded capital (`y = 4.03 .. 4.30`)
    partHelper.addPart(pilGrp, new THREE.BoxGeometry(neckW, 0.11, 0.28), COL_SANDSTONE_DARK, [0, 4.085, 0.01], [0, 0, 0], 0.007);
    partHelper.addPart(pilGrp, new THREE.BoxGeometry(capW, 0.16, 0.34), COL_SANDSTONE, [0, 4.22, 0.03], [0, 0, 0], 0.008, opts.textures.concreteTex);
  }

  // =========================================================================
  // 5. BAY 1 (LEFT / SOUTH, `lx = -6.75`): ARCHED SUNBURST FASHION BOUTIQUE
  // =========================================================================
  // Framed Fascia Plaque centered above Bay 1 ("FASHION BOUTIQUE") matching Bay 2 & Bay 3
  const bay1BannerFrame = partHelper.addPart(
    arcadeGrp,
    makeRoundedArcadeBox(4.44, 0.72, 0.10, 0.016),
    COL_BRONZE_FRAME,
    [BAY_FASHION_X, 4.81, 2.52],
    [0, 0, 0],
    0.007,
  );
  bay1BannerFrame.name = 'ArcadeBay1BoutiqueBannerFrame';
  const bay1BannerFace = partHelper.addPart(
    arcadeGrp,
    makeRoundedArcadeBox(4.26, 0.60, 0.04, 0.008),
    '#ffffff',
    [BAY_FASHION_X, 4.81, 2.56],
    [0, 0, 0],
    0,
    getFashionBoutiqueFasciaSignTexture(),
    0.2,
    false,
  );
  bay1BannerFace.name = 'ArcadeBay1BoutiqueBannerFace';

  // Bay 1 extruded cream-stucco facade with genuine waist-height knee wall (`y = 0.04 .. 0.96`),
  // tall arched sunburst window (`R = 2.12m`, spring `y = 2.08`, arch crown `y = 4.20`),
  // and full-height glass entry door (`lx in [-5.10 .. -3.80]`, `y in [0.14 .. 4.04]`).
  const bay1Shape = new THREE.Shape();
  bay1Shape.moveTo(-3.48, 0.04);
  bay1Shape.lineTo(3.12, 0.04);
  bay1Shape.lineTo(3.12, 4.38);
  bay1Shape.lineTo(-3.48, 4.38);
  bay1Shape.closePath();

  // Arched Window Cutout (bay-local X: center `-0.70` -> `-2.82 .. +1.42`, bottom `y = 0.96`, spring `y = 2.08`, arch top `y = 4.20`)
  const archHole = new THREE.Path();
  archHole.moveTo(-2.82, WINDOW_SILL_TOP_Y);
  archHole.lineTo(1.42, WINDOW_SILL_TOP_Y);
  archHole.lineTo(1.42, 2.08);
  archHole.absarc(-0.70, 2.08, 2.12, 0, Math.PI, false);
  archHole.lineTo(-2.82, WINDOW_SILL_TOP_Y);
  bay1Shape.holes.push(archHole);

  // Tall Civic Single Door Cutout (bay-local X: `+1.65 .. +2.95`, `y = 0.14 .. 4.04`)
  const doorHole1 = new THREE.Path();
  doorHole1.moveTo(1.65, 0.14);
  doorHole1.lineTo(2.95, 0.14);
  doorHole1.lineTo(2.95, 4.04);
  doorHole1.lineTo(1.65, 4.04);
  doorHole1.closePath();
  bay1Shape.holes.push(doorHole1);

  const bay1WallGeo = new THREE.ExtrudeGeometry(bay1Shape, {
    depth: 0.22,
    bevelEnabled: false,
    curveSegments: 36,
  });
  bay1WallGeo.translate(0, 0, -0.11);
  partHelper.addPart(arcadeGrp, bay1WallGeo, COL_STUCCO, [BAY_FASHION_X, 0, 2.39], [0, 0, 0], 0.008, stuccoTex, 2.0);

  // Lower facade masonry base plinth + framed sandstone dado relief under Bay 1 arch
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(4.56, 0.22, 0.28), COL_SANDSTONE_DARK, [BAY_FASHION_X - 0.70, 0.15, 2.42], [0, 0, 0], 0.006, opts.textures.concreteTex);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(3.84, 0.42, 0.06), COL_SANDSTONE, [BAY_FASHION_X - 0.70, 0.55, 2.50], [0, 0, 0], 0.005, opts.textures.concreteTex);

  // Molded sandstone outer arch surround (outer R = 2.20 clears y = 4.29 sandstone architrave cleanly) + chamfered sill at y = 0.96
  const archTrimShape = new THREE.Shape();
  archTrimShape.absarc(0, 0, 2.20, 0, Math.PI, false);
  archTrimShape.lineTo(-2.12, 0);
  archTrimShape.absarc(0, 0, 2.12, Math.PI, 0, true);
  archTrimShape.closePath();
  const archTrimGeo = new THREE.ExtrudeGeometry(archTrimShape, { depth: 0.12, bevelEnabled: false, curveSegments: 36 });
  archTrimGeo.translate(0, 0, -0.06);
  partHelper.addPart(arcadeGrp, archTrimGeo, COL_SANDSTONE, [BAY_FASHION_X - 0.70, 2.08, 2.48], [0, 0, 0], 0);

  // Dark bronze arch frame + inner concentric sunburst ring + radial fan-spoke mullions
  const bronzeArchShape = new THREE.Shape();
  bronzeArchShape.absarc(0, 0, 2.12, 0, Math.PI, false);
  bronzeArchShape.lineTo(-2.03, 0);
  bronzeArchShape.absarc(0, 0, 2.03, Math.PI, 0, true);
  bronzeArchShape.closePath();
  const bronzeArchGeo = new THREE.ExtrudeGeometry(bronzeArchShape, { depth: 0.14, bevelEnabled: false, curveSegments: 36 });
  bronzeArchGeo.translate(0, 0, -0.07);
  partHelper.addPart(arcadeGrp, bronzeArchGeo, COL_BRONZE_FRAME, [BAY_FASHION_X - 0.70, 2.08, 2.44], [0, 0, 0], 0);

  const innerSunRing = new THREE.Shape();
  innerSunRing.absarc(0, 0, 1.38, 0, Math.PI, false);
  innerSunRing.lineTo(-1.32, 0);
  innerSunRing.absarc(0, 0, 1.32, Math.PI, 0, true);
  innerSunRing.closePath();
  const innerSunGeo = new THREE.ExtrudeGeometry(innerSunRing, { depth: 0.08, bevelEnabled: false, curveSegments: 32 });
  innerSunGeo.translate(0, 0, -0.04);
  partHelper.addPart(arcadeGrp, innerSunGeo, COL_BRONZE_FRAME, [BAY_FASHION_X - 0.70, 2.08, 2.44], [0, 0, 0], 0);

  // Center sunburst hub + 5 radial fan spokes
  const hubCyl = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12, 1, false, 0, Math.PI);
  hubCyl.rotateX(Math.PI / 2);
  hubCyl.rotateZ(Math.PI / 2);
  partHelper.addPart(arcadeGrp, hubCyl, COL_BRONZE_FRAME, [BAY_FASHION_X - 0.70, 2.08, 2.44], [0, 0, 0], 0.004);
  for (let sp = 1; sp <= 5; sp++) {
    const ang = (sp / 6) * Math.PI;
    const midR = 1.05;
    partHelper.addPart(
      arcadeGrp,
      new THREE.BoxGeometry(2.06, 0.052, 0.08),
      COL_BRONZE_FRAME,
      [BAY_FASHION_X - 0.70 + Math.cos(ang) * midR, 2.08 + Math.sin(ang) * midR, 2.44],
      [0, 0, ang],
      0.003,
      undefined,
      1.0,
      false,
    );
  }
  // Horizontal springline transom bar + vertical mullions (`y = 0.96..2.08`) + moulded stone sill (`y = 0.84..0.96`)
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(4.28, 0.08, 0.12), COL_BRONZE_FRAME, [BAY_FASHION_X - 0.70, 2.08, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(4.46, 0.12, 0.30), COL_SANDSTONE, [BAY_FASHION_X - 0.70, WINDOW_SILL_TOP_Y - 0.06, 2.45], [0, 0, 0], 0.007, opts.textures.concreteTex);
  for (const mx of [-2.80, -1.75, -0.70, 0.35, 1.40]) {
    partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(0.07, 1.14, 0.11), COL_BRONZE_FRAME, [BAY_FASHION_X + mx, 1.52, 2.44], [0, 0, 0], 0.005);
  }
  // Crystal-clear extruded arched glass pane (solid 3D box depth so visible cleanly from all angles)
  const archGlassShape = new THREE.Shape();
  archGlassShape.moveTo(-2.08, -1.12);
  archGlassShape.lineTo(2.08, -1.12);
  archGlassShape.lineTo(2.08, 0);
  archGlassShape.absarc(0, 0, 2.08, 0, Math.PI, false);
  archGlassShape.closePath();
  const archGlassGeo = new THREE.ExtrudeGeometry(archGlassShape, {
    depth: 0.022,
    bevelEnabled: false,
    curveSegments: 20,
  });
  archGlassGeo.translate(0, 0, -0.011);
  addGlassPane(arcadeGrp, archGlassGeo, [BAY_FASHION_X - 0.70, 2.08, 2.435], [0, 0, 0], {
    id: 'arcade-bay1-arch-window',
    kind: 'storefront',
    col: 0,
  });

  // Bay 1 Right Tall Framed Glass Entry Door (`lx in [-5.10 .. -3.80]`, clear 3.60m leaf + transom)
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(0.08, 3.92, 0.12), COL_BRONZE_FRAME, [BAY_FASHION_X + 1.69, 2.10, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(0.08, 3.92, 0.12), COL_BRONZE_FRAME, [BAY_FASHION_X + 2.91, 2.10, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(1.30, 0.09, 0.12), COL_BRONZE_FRAME, [BAY_FASHION_X + 2.30, 4.04, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(1.30, 0.08, 0.12), COL_BRONZE_FRAME, [BAY_FASHION_X + 2.30, DOOR_TOP_Y, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(1.30, 0.08, 0.12), COL_BRONZE_FRAME, [BAY_FASHION_X + 2.30, 0.17, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(1.20, 0.06, 0.10, 0.010), COL_BRONZE_FRAME, [BAY_FASHION_X + 2.30, 2.68, 2.44], [0, 0, 0], 0.004);
  addAnchoredDoorPullHandle(BAY_FASHION_X + 1.80, 1.56, 2.44);
  addGlassPane(arcadeGrp, new THREE.BoxGeometry(1.16, 3.78, 0.022), [BAY_FASHION_X + 2.30, 2.10, 2.44], [0, 0, 0], {
    id: 'arcade-bay1-door-glass',
    kind: 'storefront',
    col: 1,
  });

  // =========================================================================
  // 6. BAY 2 (CENTER, `lx = 0.00`): REAL ESTATE & DESIGN STUDIO
  // =========================================================================
  // Framed Fascia Plaque centered above Bay 2 ("REAL ESTATE & DESIGN STUDIO")
  partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(4.44, 0.72, 0.10, 0.016), COL_BRONZE_FRAME, [BAY_REAL_ESTATE_X, 4.81, 2.52], [0, 0, 0], 0.007);
  partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(4.26, 0.60, 0.04, 0.008), '#ffffff', [BAY_REAL_ESTATE_X, 4.81, 2.56], [0, 0, 0], 0, getRealEstateFasciaSignTexture(), 0.2, false);

  // Stucco header above Bay 2 storefront (`y = 4.06 .. 4.38`)
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(6.24, 0.34, 0.22), COL_STUCCO, [BAY_REAL_ESTATE_X, 4.22, 2.39], [0, 0, 0], 0.007, stuccoTex, 2.0);
  // Waist-height lower stucco knee-wall + sandstone base plinth + 3 dado panels + moulded sill (`x in [-3.00 .. +1.62]` clearing pilaster base `-3.015` and door jamb `1.64`)
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(4.62, 0.22, 0.28), COL_SANDSTONE_DARK, [BAY_REAL_ESTATE_X - 0.69, 0.15, 2.42], [0, 0, 0], 0.006, opts.textures.concreteTex);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(4.60, 0.64, 0.22), COL_STUCCO, [BAY_REAL_ESTATE_X - 0.69, 0.56, 2.39], [0, 0, 0], 0.008, stuccoTex, 2.0);
  for (const dx of [-2.22, -0.70, 0.81]) {
    partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(1.22, 0.40, 0.06), COL_SANDSTONE, [BAY_REAL_ESTATE_X + dx, 0.56, 2.50], [0, 0, 0], 0.005, opts.textures.concreteTex);
  }
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(4.62, 0.12, 0.30), COL_SANDSTONE, [BAY_REAL_ESTATE_X - 0.69, WINDOW_SILL_TOP_Y - 0.06, 2.45], [0, 0, 0], 0.007, opts.textures.concreteTex);

  // Tall dark bronze storefront mullions + horizontal upper transom rail (`y = 3.42m`) + head lintel (`y = 4.08m`)
  for (const mx of [-2.97, -1.46, 0.05, 1.56]) {
    partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(0.085, 3.16, 0.12), COL_BRONZE_FRAME, [BAY_REAL_ESTATE_X + mx, 2.52, 2.44], [0, 0, 0], 0.006);
  }
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(4.60, 0.075, 0.12), COL_BRONZE_FRAME, [BAY_REAL_ESTATE_X - 0.69, 3.42, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(4.60, 0.085, 0.12), COL_BRONZE_FRAME, [BAY_REAL_ESTATE_X - 0.69, STOREFRONT_TOP_Y, 2.44], [0, 0, 0], 0.005);
  addGlassPane(arcadeGrp, new THREE.BoxGeometry(4.48, 3.04, 0.022), [BAY_REAL_ESTATE_X - 0.69, 2.52, 2.435], [0, 0, 0], {
    id: 'arcade-bay2-storefront-glass',
    kind: 'storefront',
    col: 2,
  });

  // Bay 2 Right Tall Glazed Entry Door (`lx in [+1.64 .. +3.02]`, clear 3.60m leaf + transom)
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(0.08, 3.98, 0.12), COL_BRONZE_FRAME, [BAY_REAL_ESTATE_X + 1.68, 2.11, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(0.08, 3.98, 0.12), COL_BRONZE_FRAME, [BAY_REAL_ESTATE_X + 2.98, 2.11, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(1.38, 0.09, 0.12), COL_BRONZE_FRAME, [BAY_REAL_ESTATE_X + 2.33, STOREFRONT_TOP_Y, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(1.38, 0.08, 0.12), COL_BRONZE_FRAME, [BAY_REAL_ESTATE_X + 2.33, DOOR_TOP_Y, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(1.38, 0.08, 0.12), COL_BRONZE_FRAME, [BAY_REAL_ESTATE_X + 2.33, 0.17, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(1.28, 0.06, 0.10, 0.010), COL_BRONZE_FRAME, [BAY_REAL_ESTATE_X + 2.33, 2.68, 2.44], [0, 0, 0], 0.004);
  addAnchoredDoorPullHandle(BAY_REAL_ESTATE_X + 1.80, 1.56, 2.44);
  addGlassPane(arcadeGrp, new THREE.BoxGeometry(1.24, 3.84, 0.022), [BAY_REAL_ESTATE_X + 2.33, 2.11, 2.44], [0, 0, 0], {
    id: 'arcade-bay2-door-glass',
    kind: 'storefront',
    col: 3,
  });

  // =========================================================================
  // 7. BAY 3 (RIGHT / NORTH, `lx = +6.75`): URBAN SCOOTER & MOBILITY
  // =========================================================================
  // Framed Fascia Plaque centered above Bay 3 ("URBAN SCOOTER & MOBILITY")
  partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(4.44, 0.72, 0.10, 0.016), COL_BRONZE_FRAME, [BAY_SCOOTER_X, 4.81, 2.52], [0, 0, 0], 0.007);
  partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(4.26, 0.60, 0.04, 0.008), '#ffffff', [BAY_SCOOTER_X, 4.81, 2.56], [0, 0, 0], 0, getUrbanScooterFasciaSignTexture(), 0.2, false);

  // Stucco header above Bay 3 storefront (`y = 4.06 .. 4.38`, reaching outer pilaster cleanly)
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(6.58, 0.34, 0.22), COL_STUCCO, [BAY_SCOOTER_X + 0.17, 4.22, 2.39], [0, 0, 0], 0.007, stuccoTex, 2.0);
  // Waist-height lower stucco knee walls + sandstone base plinths + dado panels + moulded sills (trimmed cleanly clear of pilasters)
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(1.00, 0.22, 0.28), COL_SANDSTONE_DARK, [BAY_SCOOTER_X - 2.49, 0.15, 2.42], [0, 0, 0], 0.006, opts.textures.concreteTex);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(1.00, 0.64, 0.22), COL_STUCCO, [BAY_SCOOTER_X - 2.49, 0.56, 2.39], [0, 0, 0], 0.008, stuccoTex, 2.0);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(0.76, 0.40, 0.06), COL_SANDSTONE, [BAY_SCOOTER_X - 2.49, 0.56, 2.50], [0, 0, 0], 0.005, opts.textures.concreteTex);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(1.02, 0.12, 0.30), COL_SANDSTONE, [BAY_SCOOTER_X - 2.49, WINDOW_SILL_TOP_Y - 0.06, 2.45], [0, 0, 0], 0.007, opts.textures.concreteTex);

  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(2.94, 0.22, 0.28), COL_SANDSTONE_DARK, [BAY_SCOOTER_X + 1.66, 0.15, 2.42], [0, 0, 0], 0.006, opts.textures.concreteTex);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(2.94, 0.64, 0.22), COL_STUCCO, [BAY_SCOOTER_X + 1.66, 0.56, 2.39], [0, 0, 0], 0.008, stuccoTex, 2.0);
  for (const sdx of [0.85, 2.28]) {
    partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(1.12, 0.40, 0.06), COL_SANDSTONE, [BAY_SCOOTER_X + sdx, 0.56, 2.50], [0, 0, 0], 0.005, opts.textures.concreteTex);
  }
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(2.96, 0.12, 0.30), COL_SANDSTONE, [BAY_SCOOTER_X + 1.66, WINDOW_SILL_TOP_Y - 0.06, 2.45], [0, 0, 0], 0.007, opts.textures.concreteTex);

  // Center double door jambs go floor-to-head; showcase window mullions span `y = 0.96 .. 4.08` above sills
  for (const mx of [-1.94, -0.90, 0.14]) {
    partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(0.085, 3.98, 0.12), COL_BRONZE_FRAME, [BAY_SCOOTER_X + mx, 2.11, 2.44], [0, 0, 0], 0.006);
  }
  for (const mx of [-2.97, 1.56, 3.12]) {
    partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(0.085, 3.16, 0.12), COL_BRONZE_FRAME, [BAY_SCOOTER_X + mx, 2.52, 2.44], [0, 0, 0], 0.006);
  }
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(6.14, 0.085, 0.12), COL_BRONZE_FRAME, [BAY_SCOOTER_X + 0.08, STOREFRONT_TOP_Y, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(6.14, 0.075, 0.12), COL_BRONZE_FRAME, [BAY_SCOOTER_X + 0.08, 3.42, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(2.08, 0.08, 0.12), COL_BRONZE_FRAME, [BAY_SCOOTER_X - 0.90, DOOR_TOP_Y, 2.44], [0, 0, 0], 0.005);
  partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(2.08, 0.08, 0.12), COL_BRONZE_FRAME, [BAY_SCOOTER_X - 0.90, 0.17, 2.44], [0, 0, 0], 0.005);
  // Twin anchored vertical U-pull handles on the tall double doors
  for (const handleX of [-1.03, -0.77]) {
    addAnchoredDoorPullHandle(BAY_SCOOTER_X + handleX, 1.56, 2.44);
  }
  // Separate clean panes so door glass reaches threshold while window glass ends cleanly at y = 0.96
  addGlassPane(arcadeGrp, new THREE.BoxGeometry(1.06, 3.04, 0.022), [BAY_SCOOTER_X - 2.48, 2.52, 2.435], [0, 0, 0], {
    id: 'arcade-bay3-left-glass',
    kind: 'storefront',
    col: 4,
  });
  addGlassPane(arcadeGrp, new THREE.BoxGeometry(2.04, 3.84, 0.022), [BAY_SCOOTER_X - 0.90, 2.11, 2.435], [0, 0, 0], {
    id: 'arcade-bay3-door-glass',
    kind: 'storefront',
    col: 5,
  });
  addGlassPane(arcadeGrp, new THREE.BoxGeometry(2.96, 3.04, 0.022), [BAY_SCOOTER_X + 1.66, 2.52, 2.435], [0, 0, 0], {
    id: 'arcade-bay3-right-glass',
    kind: 'storefront',
    col: 6,
  });

  // =========================================================================
  // 8. STEPPED DARK SLATE-CHARCOAL CORNICE, CLASSICAL BALUSTRADE & 3 SKYLIGHTS
  // =========================================================================
  const cornicePath: [number, number][] = [
    [-(ARCADE_HALF_W + 0.06), -2.56],
    [ARCADE_HALF_W + 0.06, -2.56],
    [ARCADE_HALF_W + 0.06, 2.56],
    [-(ARCADE_HALF_W + 0.06), 2.56],
  ];
  partHelper.addPart(arcadeGrp, opts.createMitredPolylineStripGeometry(cornicePath, 0.28, 0.14, true), COL_SLATE_CORNICE, [0, 5.31, 0], [0, 0, 0], 0.008, opts.textures.steelRoofTex);
  partHelper.addPart(arcadeGrp, opts.createMitredPolylineStripGeometry(cornicePath, 0.50, 0.20, true), COL_SLATE_CORNICE, [0, 5.48, 0], [0, 0, 0], 0.009, opts.textures.steelRoofTex);
  partHelper.addPart(arcadeGrp, opts.createMitredPolylineStripGeometry(cornicePath, 0.66, 0.16, true), COL_SLATE_DARK, [0, 5.66, 0], [0, 0, 0], 0.009, opts.textures.steelRoofTex);

  // Recessed Slate/Gravel Roof Deck (`y = 5.76m`)
  partHelper.addPart(
    arcadeGrp,
    new THREE.BoxGeometry(20.82, 0.12, 4.74),
    '#66707a',
    [0, 5.70, 0],
    [0, 0, 0],
    0.006,
    opts.textures.concreteTex,
    2.4,
  );

  // 3 Raised Clerestory Monitor Skylights centered above Bay 1, Bay 2, Bay 3
  const skyBayXList = [BAY_FASHION_X, BAY_REAL_ESTATE_X, BAY_SCOOTER_X];
  skyBayXList.forEach((skyX, skyIdx) => {
    const skyGrp = new THREE.Group();
    skyGrp.name = 'ArcadeRoofSkylightMonitor';
    skyGrp.position.set(skyX, 5.76, 0.06);
    arcadeGrp.add(skyGrp);
    // Raised concrete/slate skylight curb (`2.36m W x 1.48m D x 0.20m H`)
    partHelper.addPart(skyGrp, makeRoundedArcadeBox(2.36, 0.20, 1.48, 0.024), COL_SLATE_DARK, [0, 0.10, 0], [0, 0, 0], 0.007, opts.textures.steelRoofTex);
    // Warm translucent lightwell core (visible through clerestory panes & illuminated at dusk)
    const skyCoreMesh = addLuminousPart(
      skyGrp,
      makeRoundedArcadeBox(1.98, 0.24, 1.12, 0.018),
      '#f7ebd0',
      '#ffe3a3',
      0.9,
      [0, 0.26, 0],
    );
    tagCityWindowMesh(
      skyCoreMesh,
      createCityWindowSpec(`arcade-skylight-${skyIdx}-core`, 'dormer', '#f7ebd0', 2, skyIdx),
    );
    // Clear 3D clerestory glass wrapping the monitor sides
    addGlassPane(skyGrp, new THREE.BoxGeometry(2.08, 0.24, 0.02), [0, 0.27, 0.63], [0, 0, 0], {
      id: `arcade-skylight-${skyIdx}`,
      kind: 'dormer',
      row: 2,
      col: skyIdx,
    });
    addGlassPane(skyGrp, new THREE.BoxGeometry(2.08, 0.24, 0.02), [0, 0.27, -0.63], [0, 0, 0], {
      id: `arcade-skylight-${skyIdx}`,
      kind: 'dormer',
      row: 2,
      col: skyIdx,
    });
    addGlassPane(skyGrp, new THREE.BoxGeometry(0.02, 0.24, 1.24), [1.04, 0.27, 0], [0, 0, 0], {
      id: `arcade-skylight-${skyIdx}`,
      kind: 'dormer',
      row: 2,
      col: skyIdx,
    });
    addGlassPane(skyGrp, new THREE.BoxGeometry(0.02, 0.24, 1.24), [-1.04, 0.27, 0], [0, 0, 0], {
      id: `arcade-skylight-${skyIdx}`,
      kind: 'dormer',
      row: 2,
      col: skyIdx,
    });
    // Vertical corner & intermediate clerestory mullions
    for (const mx of [-1.06, 0, 1.06]) {
      for (const mz of [-0.64, 0.64]) {
        partHelper.addPart(skyGrp, makeRoundedArcadeBox(0.08, 0.26, 0.08, 0.012), COL_SLATE_DARK, [mx, 0.27, mz], [0, 0, 0], 0.004);
      }
    }
    // Pitched/hipped skylight glass & slate cap (`y = 0.40 .. 0.56m`)
    partHelper.addPart(skyGrp, makeRoundedArcadeBox(2.32, 0.08, 1.42, 0.018), COL_SLATE_CORNICE, [0, 0.41, 0], [0, 0, 0], 0.006);
    const skyCapGlass = partHelper.addPart(
      skyGrp,
      makeRoundedArcadeBox(1.92, 0.07, 1.06, 0.014),
      '#a5cad8',
      [0, 0.47, 0],
      [0, 0, 0],
      0.005,
    );
    tagCityWindowMesh(
      skyCapGlass,
      createCityWindowSpec(`arcade-skylight-${skyIdx}-cap`, 'dormer', '#a5cad8', 2, skyIdx),
    );
    partHelper.addPart(skyGrp, makeRoundedArcadeBox(0.06, 0.08, 1.08, 0.010), COL_SLATE_DARK, [0, 0.48, 0], [0, 0, 0], 0.003);
  });

  // Continuous Perimeter Classical Sandstone Balustrade (`y = 5.74 .. 6.91m`)
  const balustPath: [number, number][] = [
    [-PARAPET_CORNER_X, -2.36],
    [PARAPET_CORNER_X, -2.36],
    [PARAPET_CORNER_X, 2.36],
    [-PARAPET_CORNER_X, 2.36],
  ];
  partHelper.addPart(arcadeGrp, opts.createMitredPolylineStripGeometry(balustPath, 0.34, 0.22, true), COL_SANDSTONE, [0, 5.85, 0], [0, 0, 0], 0.008, opts.textures.concreteTex);
  partHelper.addPart(arcadeGrp, opts.createMitredPolylineStripGeometry(balustPath, 0.38, 0.16, true), COL_SANDSTONE, [0, 6.72, 0], [0, 0, 0], 0.008, opts.textures.concreteTex);

  // 8 Panelled Sandstone Parapet Piers (4 Front + 4 Rear aligned with Pilasters)
  for (const px of PILASTER_XS) {
    for (const pz of [-2.36, 2.36]) {
      partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.68, 1.06, 0.46, 0.024), COL_SANDSTONE, [px, 6.27, pz], [0, 0, 0], 0.008, opts.textures.concreteTex);
      partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.76, 0.11, 0.52, 0.022), COL_SANDSTONE_DARK, [px, 6.855, pz], [0, 0, 0], 0.007);
      partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.40, 0.62, 0.49, 0.014), COL_SANDSTONE_DARK, [px, 6.27, pz], [0, 0, 0], 0, undefined, 1.0, false);
    }
  }

  // Classical Vase-Shaped Stone Balusters along Front, Rear, Left & Right runs
  const balShaftGeo = new THREE.CylinderGeometry(0.056, 0.078, 0.66, 8);
  const balBellyGeo = new THREE.SphereGeometry(0.092, 8, 6);
  const addBaluster = (bx: number, bz: number) => {
    partHelper.addPart(arcadeGrp, balShaftGeo, COL_SANDSTONE, [bx, 6.29, bz], [0, 0, 0], 0.004, undefined, 1.0, false);
    partHelper.addPart(arcadeGrp, balBellyGeo, COL_SANDSTONE, [bx, 6.21, bz], [0, 0, 0], 0.004, undefined, 1.0, false);
  };
  const baySpans: [number, number][] = [
    [-9.74, -3.76],
    [-2.98, 2.98],
    [3.76, 9.74],
  ];
  for (const [xStart, xEnd] of baySpans) {
    const count = 15;
    for (let i = 0; i < count; i++) {
      const bx = xStart + (i / (count - 1)) * (xEnd - xStart);
      addBaluster(bx, 2.36);
      addBaluster(bx, -2.36);
    }
  }
  const sideCount = 11;
  for (let i = 0; i < sideCount; i++) {
    const bz = -2.00 + (i / (sideCount - 1)) * 4.00;
    addBaluster(-PARAPET_CORNER_X, bz);
    addBaluster(PARAPET_CORNER_X, bz);
  }

  // =========================================================================
  // 9. REAR ELEVATION (`lz = -2.50`): 3 STEEL STAFF DOORS, VENTS & CONDUITS
  // =========================================================================
  for (const doorX of [-6.85, 0.05, 6.95]) {
    // Concrete step threshold
    partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(1.42, 0.09, 0.30, 0.014), COL_SANDSTONE_DARK, [doorX, 0.045, -2.62], [0, 0, 0], 0.006, opts.textures.concreteTex, 1.4, false);
    // Tall civic steel frame + door leaf (`3.80m` clear door height for 3.30m visitors)
    partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(1.30, 3.92, 0.10, 0.012), COL_BRONZE_FRAME, [doorX, 2.04, -2.52], [0, 0, 0], 0.007);
    const rearDoorMesh = partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(1.14, 3.80, 0.12, 0.012), COL_STEEL_DOOR, [doorX, 2.02, -2.54], [0, 0, 0], 0.007, opts.textures.concreteTex, 1.4);
    rearDoorMesh.name = 'ArcadeRearStaffDoor';
    partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.88, 1.38, 0.04, 0.008), '#49525c', [doorX, 2.74, -2.59], [0, 0, 0], 0.004, undefined, 1.0, false);
    partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(1.00, 0.30, 0.04, 0.008), '#404852', [doorX, 0.38, -2.59], [0, 0, 0], 0.004, undefined, 1.0, false);
    partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.065, 0.16, 0.025, 0.006), '#94a3b8', [doorX + 0.42, 1.88, -2.60], [0, 0, 0], 0.003, undefined, 0.6, false);
    partHelper.addPart(arcadeGrp, makeRoundedArcadeBox(0.16, 0.042, 0.055, 0.008), '#cbd5e1', [doorX + 0.35, 1.88, -2.62], [0, 0, 0], 0.004, undefined, 0.6, false);
  }
  // 3 Upper louvered HVAC ventilation grilles (`y = 3.68m`) + 2 Lower louvered intake grilles (`y = 0.76m`)
  for (const vx of [-4.45, 2.35, 4.75]) {
    partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(1.16, 0.54, 0.08), '#47505c', [vx, 3.68, -2.53], [0, 0, 0], 0.007, opts.textures.louverTex, 1.0);
  }
  for (const lvx of [-4.45, 4.75]) {
    partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(1.02, 0.48, 0.08), '#47505c', [lvx, 0.76, -2.53], [0, 0, 0], 0.007, opts.textures.louverTex, 1.0);
  }
  // Galvanized rigid electrical utility conduits & twin junction/meter boxes
  partHelper.addPart(arcadeGrp, new THREE.CylinderGeometry(0.026, 0.026, 13.8, 8), '#8a95a3', [-0.10, 4.24, -2.53], [0, 0, Math.PI / 2], 0.004, undefined, 0.6, false);
  for (const [cx, bxOffset] of [
    [-3.15, -0.26],
    [3.55, 0.26],
  ] as [number, number][]) {
    partHelper.addPart(arcadeGrp, new THREE.CylinderGeometry(0.026, 0.026, 4.12, 8), '#8a95a3', [cx, 2.18, -2.53], [0, 0, 0], 0.004, undefined, 0.6, false);
    partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(0.38, 0.50, 0.14), '#94a3b8', [cx + bxOffset, 1.12, -2.56], [0, 0, 0], 0.006, undefined, 0.6, false);
    partHelper.addPart(arcadeGrp, new THREE.CylinderGeometry(0.020, 0.020, 0.86, 6), '#64748b', [cx + bxOffset, 0.45, -2.54], [0, 0, 0], 0.003, undefined, 0.6, false);
  }

  // =========================================================================
  // 10. EXTERIOR WALL LANTERN SCONCES, HANGING FLOWER BASKETS, PLANTERS, BENCH & DOCK
  // =========================================================================
  // 2 Warm Coach Wall Lantern Sconces mounted on Divider Pilasters (`lx = ±3.375`)
  for (const sx of [-3.375, 3.375]) {
    partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(0.11, 0.26, 0.16), COL_CAST_IRON, [sx, 2.86, 2.67], [0, 0, 0], 0.005, undefined, 1.0, false);
    partHelper.addPart(arcadeGrp, new THREE.CylinderGeometry(0.15, 0.10, 0.32, 4), '#ffe896', [sx, 2.86, 2.81], [0, Math.PI / 4, 0], 0.006, undefined, 1.0, false);
    partHelper.addPart(arcadeGrp, new THREE.ConeGeometry(0.18, 0.15, 4), COL_CAST_IRON, [sx, 3.07, 2.81], [0, Math.PI / 4, 0], 0.005, undefined, 1.0, false);
  }

  // Instanced foliage/flower accumulator for planters & hanging flower baskets
  const shrubMatrices: THREE.Matrix4[] = [];
  const flowerSpecs: ArcadeFlowerClusterSpec[] = [];
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const upAxis = new THREE.Vector3(0, 1, 0);
  const pinkPalette: [string, string][] = [
    ['#f48fb8', '#c85a88'],
    ['#ff9ec7', '#d46896'],
    ['#ee79ab', '#bd4c7d'],
  ];

  // Twin Hanging Flower Baskets on Outer Front Pilasters (`lx = -10.16, +10.16`)
  for (const bx of [-10.16, 10.16]) {
    const bz = 3.04;
    // Wrought-iron scroll bracket arm projecting from pilaster
    partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(0.05, 0.05, 0.56), COL_CAST_IRON, [bx, 3.68, 2.82], [0, 0, 0], 0.005, undefined, 1.0, false);
    partHelper.addPart(arcadeGrp, new THREE.BoxGeometry(0.04, 0.04, 0.42), COL_CAST_IRON, [bx, 3.50, 2.76], [0.58, 0, 0], 0.004, undefined, 1.0, false);
    // 3 suspension chains
    for (let c = 0; c < 3; c++) {
      const ang = (c * Math.PI * 2) / 3;
      const dx = Math.cos(ang) * 0.18;
      const dz = Math.sin(ang) * 0.18;
      const ch = partHelper.addPart(arcadeGrp, new THREE.CylinderGeometry(0.008, 0.008, 0.46, 4), '#1e232a', [bx + dx * 0.5, 3.45, bz + dz * 0.5], [0, 0, 0], 0, undefined, 1.0, false);
      ch.quaternion.setFromUnitVectors(upAxis, new THREE.Vector3(dx, -0.42, dz).normalize());
    }
    // Wicker basket cone + rim + dark soil
    partHelper.addPart(arcadeGrp, new THREE.CylinderGeometry(0.24, 0.12, 0.26, 8), '#9c6b3b', [bx, 3.10, bz], [0, 0, 0], 0.007, undefined, 1.0, false);
    partHelper.addPart(arcadeGrp, new THREE.CylinderGeometry(0.26, 0.25, 0.04, 8), '#b07b47', [bx, 3.23, bz], [0, 0, 0], 0.006, undefined, 1.0, false);
    partHelper.addPart(arcadeGrp, new THREE.CylinderGeometry(0.22, 0.21, 0.025, 8), '#4a3525', [bx, 3.235, bz], [0, 0, 0], 0, undefined, 1.0, false);

    if (opts.createPlazaLeafPetalShrubInstanced && opts.createPlazaFlowerPetalClusterInstanced) {
      tmpPos.set(bx, 3.32, bz);
      tmpQuat.setFromAxisAngle(upAxis, bx > 0 ? 0.8 : 2.1);
      tmpScale.set(0.23, 0.19, 0.23);
      shrubMatrices.push(new THREE.Matrix4().compose(tmpPos, tmpQuat, tmpScale));
      for (let t = 0; t < 4; t++) {
        const tAng = (t * Math.PI) / 2 + 0.4;
        tmpPos.set(bx + Math.cos(tAng) * 0.11, 3.28, bz + Math.sin(tAng) * 0.11);
        tmpQuat.setFromAxisAngle(upAxis, tAng + 1.1);
        tmpScale.set(0.15, 0.12, 0.15);
        shrubMatrices.push(new THREE.Matrix4().compose(tmpPos, tmpQuat, tmpScale));
      }
      for (let p = 0; p < 4; p++) {
        const pAng = (p * Math.PI) / 2 + 0.2;
        const [mHex, dHex] = pinkPalette[p % pinkPalette.length];
        tmpPos.set(bx + Math.cos(pAng) * 0.10, 3.40, bz + Math.sin(pAng) * 0.10);
        tmpQuat.setFromAxisAngle(upAxis, pAng + 0.6);
        tmpScale.set(0.11, 0.09, 0.11);
        flowerSpecs.push({ matrix: new THREE.Matrix4().compose(tmpPos, tmpQuat, tmpScale), mainHex: mHex, depthHex: dHex });
      }
    } else {
      partHelper.addPart(arcadeGrp, new THREE.SphereGeometry(0.24, 8, 6), '#2f7a3e', [bx, 3.34, bz], [0, 0, 0], 0.006, undefined, 1.0, false);
      partHelper.addPart(arcadeGrp, new THREE.SphereGeometry(0.11, 6, 6), '#f48fb8', [bx - 0.10, 3.42, bz + 0.06], [0, 0, 0], 0.004, undefined, 1.0, false);
      partHelper.addPart(arcadeGrp, new THREE.SphereGeometry(0.11, 6, 6), '#ff9ec7', [bx + 0.10, 3.42, bz - 0.04], [0, 0, 0], 0.004, undefined, 1.0, false);
    }
  }

  // 2 Panelled Sandstone Square Planters flanking the Left & Right Arcade Front Ends
  for (const px of [-10.55, 10.55]) {
    const pz = 3.45;
    const plGrp = new THREE.Group();
    plGrp.name = px < 0 ? 'ArcadePlanterSouth' : 'ArcadePlanterNorth';
    plGrp.position.set(px, 0.045, pz);
    arcadeGrp.add(plGrp);
    partHelper.addPart(plGrp, new THREE.BoxGeometry(0.90, 0.10, 0.90), COL_SANDSTONE_DARK, [0, 0.05, 0], [0, 0, 0], 0.007, opts.textures.concreteTex);
    partHelper.addPart(plGrp, new THREE.BoxGeometry(0.78, 0.40, 0.78), COL_SANDSTONE, [0, 0.30, 0], [0, 0, 0], 0.007, opts.textures.concreteTex);
    partHelper.addPart(plGrp, new THREE.BoxGeometry(0.54, 0.24, 0.80), COL_SANDSTONE_DARK, [0, 0.30, 0], [0, 0, 0], 0, undefined, 1.0, false);
    partHelper.addPart(plGrp, new THREE.BoxGeometry(0.80, 0.24, 0.54), COL_SANDSTONE_DARK, [0, 0.30, 0], [0, 0, 0], 0, undefined, 1.0, false);
    partHelper.addPart(plGrp, new THREE.BoxGeometry(0.92, 0.08, 0.92), COL_SANDSTONE, [0, 0.54, 0], [0, 0, 0], 0.007, opts.textures.concreteTex);
    partHelper.addPart(plGrp, new THREE.BoxGeometry(0.70, 0.04, 0.70), '#4a3525', [0, 0.58, 0], [0, 0, 0], 0, undefined, 1.0, false);

    if (opts.createPlazaLeafPetalShrubInstanced) {
      tmpPos.set(px, 0.84, pz);
      tmpQuat.setFromAxisAngle(upAxis, px > 0 ? 1.2 : 2.7);
      tmpScale.set(0.36, 0.32, 0.36);
      shrubMatrices.push(new THREE.Matrix4().compose(tmpPos, tmpQuat, tmpScale));
      for (let s = 0; s < 4; s++) {
        const sAng = (s * Math.PI) / 2 + 0.5;
        tmpPos.set(px + Math.cos(sAng) * 0.16, 0.76, pz + Math.sin(sAng) * 0.16);
        tmpQuat.setFromAxisAngle(upAxis, sAng);
        tmpScale.set(0.24, 0.21, 0.24);
        shrubMatrices.push(new THREE.Matrix4().compose(tmpPos, tmpQuat, tmpScale));
      }
    } else {
      partHelper.addPart(plGrp, new THREE.SphereGeometry(0.38, 10, 8), '#2f7a3e', [0, 0.84, 0], [0, 0, 0], 0.008, undefined, 1.0, false);
    }
  }

  if (opts.createPlazaLeafPetalShrubInstanced && shrubMatrices.length > 0) {
    arcadeGrp.add(opts.createPlazaLeafPetalShrubInstanced(shrubMatrices, 'ArcadePlanterAndBasketShrubs'));
  }
  if (opts.createPlazaFlowerPetalClusterInstanced && flowerSpecs.length > 0) {
    arcadeGrp.add(opts.createPlazaFlowerPetalClusterInstanced(flowerSpecs, 'ArcadeHangingBasketFlowers'));
  }

  // 1 Green Slatted Wood & Cast-Iron Civic Bench on Front-Left Cobblestone Walkway (`lx = -7.85, lz = 3.45`)
  // Continuous S-swept TubeGeometry cast-iron end frames cradling RoundedBoxGeometry wood slats (zero floating slats!)
  const benchGrp = new THREE.Group();
  benchGrp.name = 'ArcadeFrontCivicBench';
  benchGrp.position.set(-7.85, 0.045, 3.45);
  arcadeGrp.add(benchGrp);
  for (const bxSide of [-0.74, 0.74]) {
    const legCradleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(bxSide, 0.0, 0.22),
      new THREE.Vector3(bxSide, 0.43, 0.22),
      new THREE.Vector3(bxSide, 0.43, -0.20),
      new THREE.Vector3(bxSide, 0.64, -0.23),
      new THREE.Vector3(bxSide, 0.96, -0.28),
    ]);
    partHelper.addPart(benchGrp, new THREE.TubeGeometry(legCradleCurve, 18, 0.032, 8, false), COL_CAST_IRON, [0, 0, 0], [0, 0, 0], 0.005);

    const armLoopCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(bxSide, 0.64, -0.23),
      new THREE.Vector3(bxSide, 0.65, 0.16),
      new THREE.Vector3(bxSide, 0.43, 0.22),
    ]);
    partHelper.addPart(benchGrp, new THREE.TubeGeometry(armLoopCurve, 12, 0.026, 8, false), COL_CAST_IRON, [0, 0, 0], [0, 0, 0], 0.005);
  }
  const benchSeatSlatGeo = makeRoundedArcadeBox(1.78, 0.045, 0.11, 0.012);
  for (const sz of [-0.14, 0.02, 0.18]) {
    partHelper.addPart(benchGrp, benchSeatSlatGeo, COL_BENCH_GREEN, [0, 0.455, sz], [0, 0, 0], 0.006);
  }
  const benchBackSlatGeo = makeRoundedArcadeBox(1.78, 0.10, 0.045, 0.012);
  for (const by of [0.64, 0.78, 0.92]) {
    partHelper.addPart(benchGrp, benchBackSlatGeo, COL_BENCH_GREEN, [0, by, -0.23 - (by - 0.64) * 0.16], [-0.15, 0, 0], 0.006);
  }

  // Tubular Steel U-Loop Scooter Charging Dock Rack in front of Bay 3 right window (`lx = +8.80, lz = 3.25`)
  const dockGrp = new THREE.Group();
  dockGrp.name = 'ArcadeScooterChargingDockRack';
  dockGrp.position.set(
    BAY_SCOOTER_X + URBAN_SCOOTER_SHOP_LAYOUT.chargingDockLocal.x,
    URBAN_SCOOTER_SHOP_LAYOUT.chargingDockLocal.y,
    URBAN_SCOOTER_SHOP_LAYOUT.chargingDockLocal.z,
  );
  arcadeGrp.add(dockGrp);
  partHelper.addPart(dockGrp, new THREE.BoxGeometry(1.76, 0.036, 0.54), '#2d333b', [0, 0.018, 0], [0, 0, 0], 0.006, opts.textures.steelRoofTex);
  for (const hx of [-0.68, -0.23, 0.23, 0.68]) {
    const hoopCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, 0.03, -0.18),
      new THREE.Vector3(hx, 0.66, -0.18),
      new THREE.Vector3(hx, 0.80, 0.0),
      new THREE.Vector3(hx, 0.66, 0.18),
      new THREE.Vector3(hx, 0.03, 0.18),
    ]);
    partHelper.addPart(dockGrp, new THREE.TubeGeometry(hoopCurve, 16, 0.026, 8, false), '#525b66', [0, 0, 0], [0, 0, 0], 0.005, undefined, 0.5, false);
    addLuminousPart(dockGrp, new THREE.BoxGeometry(0.06, 0.025, 0.04), '#34d399', '#10b981', 0.8, [hx, 0.045, 0.23]);
  }

  // 2 Non-Rideable Static Showcase Scooters docked in front of Bay 3
  for (const disp of URBAN_SCOOTER_SHOP_LAYOUT.frontStaticDisplays) {
    const displaySlotGrp = new THREE.Group();
    displaySlotGrp.name =
      disp.kind === 'electric_scooter_bike'
        ? 'StaticDisplayElectricScooterBike'
        : 'StaticDisplayPushKickScooter';
    displaySlotGrp.position.set(BAY_SCOOTER_X + disp.localX, disp.localY, disp.localZ);
    displaySlotGrp.rotation.y = disp.localRotY;
    displaySlotGrp.userData = {
      isStaticScooterDisplay: true,
      isRideable: false,
      scooterId: disp.id,
      scooterKind: disp.kind,
      currency: disp.currency,
      isNft: disp.isNft,
    };
    arcadeGrp.add(displaySlotGrp);

    const plinthW = disp.plinthHalfWidthLocal * 2;
    const plinthL = disp.plinthHalfLengthLocal * 2;
    const padH = 0.018;
    partHelper.addPart(displaySlotGrp, new THREE.BoxGeometry(plinthW, padH, plinthL), '#2c323b', [0, padH * 0.5, 0], [0, 0, 0], 0.004, opts.textures.steelRoofTex);

    if (disp.kind === 'electric_scooter_bike') {
      const bikeHandle = createElectricScooterBike3D({
        partHelper: scooterPartHelper,
        parked: true,
        steerAngleRad: disp.steerAngleRad,
        includeContactShadow: false,
      });
      bikeHandle.root.position.set(0, padH, 0);
      bikeHandle.root.scale.setScalar(disp.localScale);
      bikeHandle.root.userData = { isStaticScooterDisplay: true, isRideable: false };
      displaySlotGrp.add(bikeHandle.root);
    } else {
      const kickHandle = createPushKickScooter3D({
        partHelper: scooterPartHelper,
        parked: true,
        folded: false,
        steerAngleRad: disp.steerAngleRad,
        includeContactShadow: false,
      });
      kickHandle.root.position.set(0, padH, 0);
      kickHandle.root.scale.setScalar(disp.localScale);
      kickHandle.root.userData = { isStaticScooterDisplay: true, isRideable: false };
      displaySlotGrp.add(kickHandle.root);
    }
  }

  // 3 Wooden / Steel A-Frame Sidewalk Signs (synchronized to Rules layouts!)
  buildWoodenAFrameSign(
    arcadeGrp,
    partHelper,
    'FashionBoutiqueAFrameSidewalkSign',
    [
      BAY_FASHION_X + FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.x,
      FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.y,
      FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.z,
    ],
    FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.rotY,
    getFashionBoutiqueAFrameSignTexture(),
    '#8c5a32',
    opts.textures.timberTex,
  );
  buildWoodenAFrameSign(
    arcadeGrp,
    partHelper,
    'RealEstateAFrameSidewalkSign',
    [
      BAY_REAL_ESTATE_X + REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.x,
      REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.y,
      REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.z,
    ],
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.rotY,
    getRealEstateAFrameSignTexture(),
    '#8c5a32',
    opts.textures.timberTex,
  );
  buildWoodenAFrameSign(
    arcadeGrp,
    partHelper,
    'UrbanScooterAFrameSidewalkSign',
    [
      BAY_SCOOTER_X + URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.x,
      URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.y,
      URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.z,
    ],
    URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.rotY,
    getShowroomAFrameSignTexture(),
    '#2b3036',
    opts.textures.steelRoofTex,
  );

  // =========================================================================
  // 11. BAY INTERIORS (100% VISIBLE BEHIND CRYSTAL-CLEAR STOREFRONT GLASS)
  // =========================================================================
  // --- BAY 1 INTERIOR: FASHION & APPAREL BOUTIQUE (`lx = -6.75`) ---
  const bay1Int = new THREE.Group();
  bay1Int.name = 'ArcadeBay1FashionInterior';
  bay1Int.position.set(BAY_FASHION_X, 0.14, 0);
  arcadeGrp.add(bay1Int);

  for (const [rx, rz] of [
    [-2.05, 1.05],
    [-0.78, 0.98],
  ] as [number, number][]) {
    partHelper.addPart(bay1Int, new THREE.CylinderGeometry(0.54, 0.58, 0.22, 18), COL_SANDSTONE, [rx, 0.11, rz], [0, 0, 0], 0.005, opts.textures.concreteTex);
  }
  const m1 = buildBoutiqueMannequin(bay1Int, partHelper, [-2.05, 0.22, 1.05], 0.12, 'trench_coat', opts.textures.timberTex);
  m1.name = 'FashionMannequinTrenchCoat';
  m1.scale.setScalar(1.90);

  const m2 = buildBoutiqueMannequin(bay1Int, partHelper, [-0.78, 0.22, 0.98], -0.10, 'aline_dress', opts.textures.timberTex);
  m2.name = 'FashionMannequinALineDress';
  m2.scale.setScalar(1.90);

  const mainRack = buildBoutiqueGarmentRack(
    bay1Int,
    partHelper,
    [1.15, 0, 0.45],
    0,
    1.56,
    ['#f5f2eb', '#cbd5e1', '#c69f74', '#475569', '#95a79b', '#dfd6c7', '#d4827a', '#64748b'],
    true,
    true,
    opts.textures.timberTex,
  );
  mainRack.name = 'FashionBoutiqueMainGarmentRack';
  mainRack.scale.setScalar(1.70);

  const sideRack = buildBoutiqueGarmentRack(
    bay1Int,
    partHelper,
    [-1.55, 0, -1.30],
    0,
    1.30,
    ['#f8f6f0', '#94a3b8', '#475569', '#d6ccc2', '#c8a27a'],
    true,
    false,
    opts.textures.timberTex,
  );
  sideRack.name = 'FashionBoutiqueSideGarmentRack';
  sideRack.scale.setScalar(1.70);

  const accShelving = buildFashionAccessoriesShelving(bay1Int, partHelper, [1.05, 0, -1.78], 0, opts.textures);
  accShelving.scale.setScalar(1.70);
  // Potted indoor floor plant in Bay 1 left rear corner
  partHelper.addPart(bay1Int, new THREE.CylinderGeometry(0.26, 0.20, 0.50, 12), '#d8cfbe', [-2.68, 0.25, -1.78], [0, 0, 0], 0.006);
  partHelper.addPart(bay1Int, new THREE.SphereGeometry(0.42, 10, 8), '#438449', [-2.68, 0.90, -1.78], [0, 0, 0], 0.007, undefined, 1.0, false);

  // --- BAY 2 INTERIOR: REAL ESTATE & DESIGN STUDIO (`lx = 0.00`) ---
  const bay2Int = new THREE.Group();
  bay2Int.name = 'ArcadeBay2RealEstateInterior';
  bay2Int.position.set(BAY_REAL_ESTATE_X, 0.14, 0);
  arcadeGrp.add(bay2Int);

  partHelper.addPart(bay2Int, makeRoundedArcadeBox(2.40, 0.20, 1.70, 0.025), '#bfa88a', [-1.55, 0.10, 0.88], [0, 0, 0], 0.005, opts.textures.timberTex);
  const reModel = buildRealEstateArchitecturalScaleModel(bay2Int, partHelper, addLuminousPart, [-1.55, 0.20, 0.88], opts.textures);
  reModel.scale.setScalar(1.70);

  const reDesk = buildRealEstateConsultationDeskZone(bay2Int, partHelper, addLuminousPart, [-0.25, 0, -1.05], opts.textures);
  reDesk.scale.setScalar(1.70);

  const reLounge = buildShowroomFurnitureLoungeVignette(bay2Int, partHelper, addLuminousPart, [1.68, 0, 0.78], opts.textures);
  reLounge.scale.setScalar(1.70);

  // 3 Mitered-Framed Architectural Blueprint & Elevation Drawings on Rear Wall of Bay 2 (`lz = -2.24`, art seated flush inside bezel)
  const masterBlueprintTex = getMasterFloorplanBlueprintTexture();
  const galleryPrints = getInteriorGalleryPrintTextures();
  const bay2Prints: [number, number, number, THREE.Texture][] = [
    [-1.78, 1.62, 1.08, masterBlueprintTex],
    [-0.08, 1.16, 1.08, galleryPrints[0]],
    [1.24, 1.16, 1.08, galleryPrints[1]],
  ];
  for (const [fx, fw, fh, fTex] of bay2Prints) {
    partHelper.addPart(bay2Int, makeMiteredPictureFrameGeo(fw + 0.12, fh + 0.12, 0.06, 0.045), COL_BRONZE_FRAME, [fx, 2.52, -2.24], [0, 0, 0], 0.006);
    partHelper.addPart(bay2Int, new THREE.BoxGeometry(fw + 0.02, fh + 0.02, 0.02), '#e5e0d5', [fx, 2.52, -2.25], [0, 0, 0], 0, undefined, 0.2, false);
    partHelper.addPart(bay2Int, new THREE.PlaneGeometry(fw, fh), '#ffffff', [fx, 2.52, -2.238], [0, 0, 0], 0, fTex, 0.2, false);
  }
  partHelper.addPart(bay2Int, new THREE.CylinderGeometry(0.26, 0.20, 0.50, 12), '#d8cfbe', [2.52, 0.25, -1.78], [0, 0, 0], 0.006);
  partHelper.addPart(bay2Int, new THREE.SphereGeometry(0.42, 10, 8), '#4c8e52', [2.52, 0.92, -1.78], [0, 0, 0], 0.007, undefined, 1.0, false);

  // --- BAY 3 INTERIOR: URBAN SCOOTER & MOBILITY (`lx = +6.75`) ---
  const bay3Int = new THREE.Group();
  bay3Int.name = 'ArcadeBay3ScooterInterior';
  bay3Int.position.set(BAY_SCOOTER_X, 0.14, 0);
  arcadeGrp.add(bay3Int);

  // Backlit E-Mobility Feature Mural on Rear Wall seated flush inside mitered frame (`lz = -2.22`)
  partHelper.addPart(bay3Int, makeMiteredPictureFrameGeo(2.30, 1.28, 0.08, 0.05), '#111827', [-0.90, 2.44, -2.22], [0, 0, 0], 0.006);
  partHelper.addPart(bay3Int, new THREE.BoxGeometry(2.16, 1.14, 0.024), '#1e293b', [-0.90, 2.44, -2.23], [0, 0, 0], 0, undefined, 0.2, false);
  partHelper.addPart(bay3Int, new THREE.PlaneGeometry(2.14, 1.12), '#ffffff', [-0.90, 2.44, -2.216], [0, 0, 0], 0, getShowroomBackwallGraphicTexture(), 0.2, false);

  // Reception & Tech Counter (`lx = -0.25, lz = -0.75`)
  const counterGrp = new THREE.Group();
  counterGrp.position.set(-0.25, 0, -0.75);
  bay3Int.add(counterGrp);
  partHelper.addPart(counterGrp, makeRoundedArcadeBox(1.76, 1.04, 0.70, 0.025), '#2b313c', [0, 0.52, 0], [0, 0, 0], 0.008);
  partHelper.addPart(counterGrp, makeRoundedArcadeBox(1.84, 0.075, 0.78, 0.022), '#c28a54', [0, 1.075, 0], [0, 0, 0], 0.007, opts.textures.timberTex);
  partHelper.addPart(counterGrp, new THREE.BoxGeometry(1.78, 0.035, 0.02), '#14b8a6', [0, 0.99, 0.36], [0, 0, 0], 0, undefined, 1.0, false);
  addShowroomUrbanHelmet(scooterPartHelper, counterGrp, [-0.46, 1.11, 0.02], 0.30, '#f1f5f9', '#14b8a6');
  addShowroomUrbanHelmet(scooterPartHelper, counterGrp, [0.02, 1.11, 0.04], -0.25, '#272d38', '#38bdf8');

  // Indoor Folded Kick Scooter Podium elevated cleanly so scooter displays clearly above the 0.96m window sill (`lx = -2.20, lz = +0.85`)
  const indoorPodium = new THREE.Group();
  indoorPodium.position.set(-2.20, 0, 0.85);
  bay3Int.add(indoorPodium);
  partHelper.addPart(indoorPodium, new THREE.BoxGeometry(1.18, 0.82, 0.72), '#262c36', [0, 0.41, 0], [0, 0, 0], 0.007);
  partHelper.addPart(indoorPodium, new THREE.BoxGeometry(1.24, 0.06, 0.78), '#c28a54', [0, 0.85, 0], [0, 0, 0], 0.006, opts.textures.timberTex);
  const foldedScooter = createPushKickScooter3D({
    partHelper: scooterPartHelper,
    folded: true,
    parked: false,
    includeContactShadow: false,
  });
  foldedScooter.root.position.set(0, 0.88, 0.02);
  foldedScooter.root.rotation.y = Math.PI * 0.42;
  foldedScooter.root.scale.setScalar(1.30);
  indoorPodium.add(foldedScooter.root);

  // Wall-mounted Gear, Helmet & Wheel Display Rack (`lx = +1.85, lz = -1.65`)
  const gearRackGrp = new THREE.Group();
  gearRackGrp.position.set(1.85, 0, -1.65);
  bay3Int.add(gearRackGrp);
  partHelper.addPart(gearRackGrp, new THREE.BoxGeometry(1.56, 0.10, 0.56), '#c28a54', [0, 0.05, 0], [0, 0, 0], 0.007, opts.textures.timberTex);
  for (const ux of [-0.70, 0.70]) {
    partHelper.addPart(gearRackGrp, new THREE.CylinderGeometry(0.028, 0.028, 2.48, 8), '#64748b', [ux, 1.29, 0], [0, 0, 0], 0.004, undefined, 1.0, false);
  }
  for (const sy of [1.00, 1.72, 2.44]) {
    partHelper.addPart(gearRackGrp, new THREE.BoxGeometry(1.54, 0.065, 0.54), '#c28a54', [0, sy, 0], [0, 0, 0], 0.006, opts.textures.timberTex);
  }
  addShowroomUrbanHelmet(scooterPartHelper, gearRackGrp, [-0.36, 1.76, 0.02], 0.14, '#f8fafc', '#14b8a6');
  addShowroomUrbanHelmet(scooterPartHelper, gearRackGrp, [0.34, 1.76, 0.02], -0.18, '#334155', '#14b8a6');
  addShowroomUrbanHelmet(scooterPartHelper, gearRackGrp, [0.0, 2.48, 0.02], 0.05, '#2d6a54', '#e2e8f0');
  for (const wx of [-0.34, 0.34]) {
    const spareWheel = buildSpokeWheelAssembly(scooterPartHelper, 0.24, 0.055, 5, '#1e2229', '#475569', '#94a3b8', 'full_front');
    spareWheel.position.set(wx, 1.29, 0);
    spareWheel.rotation.y = Math.PI / 2;
    gearRackGrp.add(spareWheel);
  }

  return arcadeGrp;
}
