import * as THREE from 'three';
import { FASHION_APPAREL_KIOSK_LAYOUT } from './buddiesFashionKioskRules';

export interface FashionKioskBuilderOptions {
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
}

interface KioskPartHelper {
  addPart(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    pos: [number, number, number],
    rot?: [number, number, number],
    toonStrokeWidth?: number,
    tex?: THREE.Texture,
    bumpScale?: number,
    castShad?: boolean,
  ): THREE.Mesh;
}

let _cachedFashionAFrameSignTex: THREE.Texture | null = null;

function createCanvas2D(w: number, h: number): {
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
  const data = new Uint8Array([r, g, b, 255]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural Wooden A-Frame Sidewalk Sign Face (`FASHION & APPAREL BOUTIQUE`)
 * matching Quadrant 2 & Quadrant 4 of `screen_aad784ba.png`.
 */
function getFashionBoutiqueAFrameSignTexture(): THREE.Texture {
  if (_cachedFashionAFrameSignTex) return _cachedFashionAFrameSignTex;
  const { canvas, ctx } = createCanvas2D(256, 360);
  if (!ctx) {
    _cachedFashionAFrameSignTex = makeFallbackDataTex(239, 232, 217);
    return _cachedFashionAFrameSignTex;
  }

  // Warm cream editorial boutique signboard background
  ctx.fillStyle = '#efe8d8';
  ctx.fillRect(0, 0, 256, 360);

  // Crisp double architectural hairline border
  ctx.strokeStyle = '#262b32';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 228, 332);
  ctx.strokeStyle = '#8b6542';
  ctx.lineWidth = 2;
  ctx.strokeRect(23, 23, 210, 314);

  // Minimalist atelier coat-hanger emblem at top
  ctx.strokeStyle = '#8b5e34';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(128, 56, 9, Math.PI * 0.9, Math.PI * 2.25, false);
  ctx.lineTo(128, 72);
  ctx.stroke();

  ctx.strokeStyle = '#1f242b';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(128, 72);
  ctx.lineTo(84, 98);
  ctx.lineTo(172, 98);
  ctx.closePath();
  ctx.stroke();

  // Editorial boutique typography ("FASHION & APPAREL BOUTIQUE")
  ctx.fillStyle = '#1f242b';
  ctx.textAlign = 'center';
  ctx.font = '800 33px "Plus Jakarta Sans", "Barlow", sans-serif';
  ctx.fillText('FASHION', 128, 156);

  // Divider rules + ampersand
  ctx.strokeStyle = '#8b6542';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(46, 186);
  ctx.lineTo(102, 186);
  ctx.moveTo(154, 186);
  ctx.lineTo(210, 186);
  ctx.stroke();

  ctx.fillStyle = '#8b5e34';
  ctx.font = '700 22px Georgia, serif';
  ctx.fillText('&', 128, 193);

  ctx.fillStyle = '#1f242b';
  ctx.font = '800 29px "Plus Jakarta Sans", "Barlow", sans-serif';
  ctx.fillText('APPAREL', 128, 236);
  ctx.font = '800 28px "Plus Jakarta Sans", "Barlow", sans-serif';
  ctx.fillText('BOUTIQUE', 128, 276);

  ctx.fillStyle = '#64748b';
  ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('TAILORED • READY TO WEAR', 128, 316);

  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  _cachedFashionAFrameSignTex = tex;
  return tex;
}

type MannequinOutfitVariant = 'trench_coat' | 'aline_dress' | 'tailored_midi';

/**
 * Builds a composite 10–14 part sculptural boutique mannequin on a brushed-steel tripod stand
 * matching Quadrant 1, Quadrant 2, and Quadrant 4 of `screen_aad784ba.png`.
 */
function buildBoutiqueMannequin(
  parent: THREE.Object3D,
  partHelper: KioskPartHelper,
  pos: [number, number, number],
  rotY: number,
  variant: MannequinOutfitVariant,
  woodTex?: THREE.Texture,
): THREE.Group {
  const mGrp = new THREE.Group();
  mGrp.position.set(pos[0], pos[1], pos[2]);
  mGrp.rotation.y = rotY;
  parent.add(mGrp);

  const COL_CHROME = '#cbd5e1';
  const COL_STEEL_DARK = '#333942';
  const COL_FORM_IVORY = '#f2ece1';
  const COL_OAK = '#b8834e';

  // 1. Brushed-steel circular base + 3 angled tripod struts + vertical chrome post
  partHelper.addPart(
    mGrp,
    new THREE.CylinderGeometry(0.19, 0.21, 0.024, 16),
    COL_STEEL_DARK,
    [0, 0.012, 0],
    [0, 0, 0],
    0.005,
    undefined,
    0.4,
    false,
  );
  for (let i = 0; i < 3; i++) {
    const ang = (i * Math.PI * 2) / 3 + 0.52;
    const sx = Math.cos(ang) * 0.095;
    const sz = Math.sin(ang) * 0.095;
    partHelper.addPart(
      mGrp,
      new THREE.BoxGeometry(0.022, 0.024, 0.18),
      COL_CHROME,
      [sx, 0.055, sz],
      [0.36, -ang + Math.PI / 2, 0],
      0.004,
      undefined,
      0.4,
      false,
    );
  }
  partHelper.addPart(
    mGrp,
    new THREE.CylinderGeometry(0.018, 0.020, 0.72, 10),
    COL_CHROME,
    [0, 0.37, 0],
    [0, 0, 0],
    0.004,
    undefined,
    0.4,
    false,
  );

  // 2. Sculpted ivory mannequin upper neck & turned oak finial cap (`y in [1.46 .. 1.66]`)
  partHelper.addPart(
    mGrp,
    new THREE.CylinderGeometry(0.052, 0.068, 0.13, 12),
    COL_FORM_IVORY,
    [0, 1.52, 0],
    [0, 0, 0],
    0.005,
  );
  partHelper.addPart(
    mGrp,
    new THREE.CylinderGeometry(0.056, 0.056, 0.032, 12),
    COL_OAK,
    [0, 1.595, 0],
    [0, 0, 0],
    0.004,
    woodTex,
  );

  if (variant === 'trench_coat') {
    // Front-Left Window Mannequin: Tailored Camel Trench Coat over Charcoal Inner Turtleneck
    const COL_COAT = '#caa070';
    const COL_BELT = '#9c7144';
    const COL_INNER = '#272c35';

    // Sculpted long trench coat silhouette (`y in [0.50 .. 1.46]`)
    const coatPts = [
      new THREE.Vector2(0.00, 0.50),
      new THREE.Vector2(0.24, 0.50),
      new THREE.Vector2(0.21, 0.78),
      new THREE.Vector2(0.155, 1.05),
      new THREE.Vector2(0.185, 1.30),
      new THREE.Vector2(0.205, 1.44),
      new THREE.Vector2(0.075, 1.46),
      new THREE.Vector2(0.00, 1.46),
    ];
    const coatGeo = new THREE.LatheGeometry(coatPts, 18);
    coatGeo.scale(1.06, 1.0, 0.68);
    partHelper.addPart(mGrp, coatGeo, COL_COAT, [0, 0, 0], [0, 0, 0], 0.008);

    // Charcoal inner turtleneck V-insert at chest (`z = +0.11`)
    partHelper.addPart(
      mGrp,
      new THREE.CylinderGeometry(0.075, 0.095, 0.30, 12),
      COL_INNER,
      [0, 1.35, 0.025],
      [0, 0, 0],
      0.005,
    );

    // Structured notched trench lapels (left & right angled panels on chest)
    for (const side of [-1, 1]) {
      partHelper.addPart(
        mGrp,
        new THREE.BoxGeometry(0.075, 0.34, 0.026),
        '#d6ae7e',
        [side * 0.068, 1.28, 0.125],
        [-0.08, side * 0.14, side * -0.22],
        0.005,
      );
      // Tailored coat sleeves with turned cuffs
      partHelper.addPart(
        mGrp,
        new THREE.CylinderGeometry(0.056, 0.048, 0.56, 10),
        COL_COAT,
        [side * 0.235, 1.16, 0.01],
        [0.05, 0, side * -0.14],
        0.006,
      );
      partHelper.addPart(
        mGrp,
        new THREE.CylinderGeometry(0.054, 0.054, 0.045, 10),
        COL_BELT,
        [side * 0.272, 0.91, 0.024],
        [0.05, 0, side * -0.14],
        0.004,
      );
    }

    // Cinched trench waist belt + brass buckle + double-breasted dark horn buttons
    const beltGeo = new THREE.CylinderGeometry(0.168, 0.168, 0.048, 16);
    beltGeo.scale(1.06, 1, 0.70);
    partHelper.addPart(mGrp, beltGeo, COL_BELT, [0, 1.05, 0], [0, 0, 0], 0.005);
    partHelper.addPart(
      mGrp,
      new THREE.BoxGeometry(0.048, 0.056, 0.024),
      '#d4af37',
      [0, 1.05, 0.122],
      [0, 0, 0],
      0.003,
      undefined,
      0.3,
      false,
    );
    for (const by of [0.88, 0.97, 1.13]) {
      for (const bx of [-0.042, 0.042]) {
        partHelper.addPart(
          mGrp,
          new THREE.CylinderGeometry(0.012, 0.012, 0.014, 8),
          COL_INNER,
          [bx, by, 0.132],
          [Math.PI / 2, 0, 0],
          0,
          undefined,
          0.3,
          false,
        );
      }
    }
  } else if (variant === 'aline_dress') {
    // Front-Center Window Mannequin: Sleek Charcoal-Slate Sleeveless A-Line Boutique Dress
    const COL_DRESS = '#474f5b';
    const COL_WAIST = '#232830';

    // Ivory clavicle/shoulder bust visible above sleeveless dress neckline
    const bustGeo = new THREE.CylinderGeometry(0.072, 0.155, 0.15, 14);
    bustGeo.scale(1.05, 1, 0.66);
    partHelper.addPart(mGrp, bustGeo, COL_FORM_IVORY, [0, 1.41, 0], [0, 0, 0], 0.005);

    // Sculpted sleeveless bodice + flared A-line dress skirt (`y in [0.64 .. 1.38]`)
    const dressPts = [
      new THREE.Vector2(0.00, 0.64),
      new THREE.Vector2(0.26, 0.64),
      new THREE.Vector2(0.21, 0.86),
      new THREE.Vector2(0.135, 1.08),
      new THREE.Vector2(0.168, 1.26),
      new THREE.Vector2(0.152, 1.37),
      new THREE.Vector2(0.00, 1.37),
    ];
    const dressGeo = new THREE.LatheGeometry(dressPts, 20);
    dressGeo.scale(1.04, 1.0, 0.72);
    partHelper.addPart(mGrp, dressGeo, COL_DRESS, [0, 0, 0], [0, 0, 0], 0.008);

    // Shoulder straps & cinched satin waist ribbon
    for (const side of [-1, 1]) {
      partHelper.addPart(
        mGrp,
        new THREE.BoxGeometry(0.042, 0.14, 0.11),
        COL_DRESS,
        [side * 0.115, 1.39, 0],
        [0, 0, side * 0.12],
        0.004,
      );
    }
    const ribbonGeo = new THREE.CylinderGeometry(0.144, 0.144, 0.042, 16);
    ribbonGeo.scale(1.05, 1, 0.74);
    partHelper.addPart(mGrp, ribbonGeo, COL_WAIST, [0, 1.08, 0], [0, 0, 0], 0.004);
  } else {
    // Corner / Side-Window Mannequin: Tailored Dove-Slate Midi Blazer-Dress Ensemble
    const COL_MIDI = '#5b6472';
    const COL_BLOUSE = '#f5efe4';
    const COL_BELT_DARK = '#2a3038';

    const midiPts = [
      new THREE.Vector2(0.00, 0.56),
      new THREE.Vector2(0.24, 0.56),
      new THREE.Vector2(0.19, 0.84),
      new THREE.Vector2(0.145, 1.07),
      new THREE.Vector2(0.180, 1.30),
      new THREE.Vector2(0.195, 1.43),
      new THREE.Vector2(0.072, 1.45),
      new THREE.Vector2(0.00, 1.45),
    ];
    const midiGeo = new THREE.LatheGeometry(midiPts, 18);
    midiGeo.scale(1.04, 1.0, 0.70);
    partHelper.addPart(mGrp, midiGeo, COL_MIDI, [0, 0, 0], [0, 0, 0], 0.008);

    // Silk cream V-neck blouse insert + tailored 3/4 sleeves + belt
    partHelper.addPart(
      mGrp,
      new THREE.CylinderGeometry(0.068, 0.088, 0.26, 12),
      COL_BLOUSE,
      [0, 1.35, 0.025],
      [0, 0, 0],
      0.004,
    );
    for (const side of [-1, 1]) {
      partHelper.addPart(
        mGrp,
        new THREE.CylinderGeometry(0.052, 0.045, 0.46, 10),
        COL_MIDI,
        [side * 0.225, 1.20, 0.01],
        [0.04, 0, side * -0.13],
        0.006,
      );
    }
    const beltGeo = new THREE.CylinderGeometry(0.154, 0.154, 0.040, 16);
    beltGeo.scale(1.05, 1, 0.72);
    partHelper.addPart(mGrp, beltGeo, COL_BELT_DARK, [0, 1.07, 0], [0, 0, 0], 0.004);
  }

  return mGrp;
}

/**
 * Builds a structured luxury leather handbag / tote bag (`4–6 parts`) with arched handles & brass clasp.
 */
function buildStructuredHandbag(
  parent: THREE.Object3D,
  partHelper: KioskPartHelper,
  pos: [number, number, number],
  rotY: number,
  bodyColorHex: string,
  trimColorHex: string,
  scale = 1.0,
): THREE.Group {
  const bGrp = new THREE.Group();
  bGrp.position.set(pos[0], pos[1], pos[2]);
  bGrp.rotation.y = rotY;
  bGrp.scale.setScalar(scale);
  parent.add(bGrp);

  // Tapered structured leather bag body (lower base + upper gusset + front flap)
  partHelper.addPart(
    bGrp,
    new THREE.BoxGeometry(0.28, 0.21, 0.13),
    bodyColorHex,
    [0, 0.105, 0],
    [0, 0, 0],
    0.006,
  );
  partHelper.addPart(
    bGrp,
    new THREE.BoxGeometry(0.25, 0.09, 0.025),
    trimColorHex,
    [0, 0.165, 0.062],
    [0.05, 0, 0],
    0.004,
  );
  // Twin arched leather top handles (`TorusGeometry` half-rings)
  const handleGeo = new THREE.TorusGeometry(0.062, 0.011, 8, 14, Math.PI);
  for (const hz of [-0.036, 0.036]) {
    partHelper.addPart(
      bGrp,
      handleGeo,
      trimColorHex,
      [0, 0.21, hz],
      [0, 0, 0],
      0.003,
      undefined,
      0.4,
      false,
    );
  }
  // Brushed brass front turn-lock clasp
  partHelper.addPart(
    bGrp,
    new THREE.BoxGeometry(0.036, 0.032, 0.02),
    '#d4af37',
    [0, 0.13, 0.072],
    [0, 0, 0],
    0.003,
    undefined,
    0.3,
    false,
  );

  return bGrp;
}

/**
 * Builds a brushed-steel boutique hanging garment rail with curated shirts/coats/jackets on wooden hangers,
 * optional lower display plinth, and optional top warm-oak handbag shelf (`screen_aad784ba.png`).
 */
function buildBoutiqueGarmentRack(
  parent: THREE.Object3D,
  partHelper: KioskPartHelper,
  pos: [number, number, number],
  rotY: number,
  railWidth: number,
  garmentColors: readonly string[],
  withTopBagShelf: boolean,
  withLowerShoePlinth: boolean,
  woodTex?: THREE.Texture,
): THREE.Group {
  const rGrp = new THREE.Group();
  rGrp.position.set(pos[0], pos[1], pos[2]);
  rGrp.rotation.y = rotY;
  parent.add(rGrp);

  const COL_STEEL_FRAME = '#383f49';
  const COL_CHROME_RAIL = '#cbd5e1';
  const COL_HANGER_OAK = '#c28a54';
  const halfW = railWidth * 0.5;

  // Twin side steel base skids + vertical tubular uprights + top chrome hanging bar
  for (const sx of [-halfW, halfW]) {
    partHelper.addPart(
      rGrp,
      new THREE.BoxGeometry(0.045, 0.036, 0.48),
      COL_STEEL_FRAME,
      [sx, 0.018, 0],
      [0, 0, 0],
      0.005,
    );
    partHelper.addPart(
      rGrp,
      new THREE.CylinderGeometry(0.020, 0.022, 1.42, 10),
      COL_STEEL_FRAME,
      [sx, 0.72, 0],
      [0, 0, 0],
      0.005,
    );
  }
  partHelper.addPart(
    rGrp,
    new THREE.CylinderGeometry(0.018, 0.018, railWidth + 0.04, 10),
    COL_CHROME_RAIL,
    [0, 1.38, 0],
    [0, 0, Math.PI / 2],
    0.004,
  );

  if (withLowerShoePlinth) {
    partHelper.addPart(
      rGrp,
      new THREE.BoxGeometry(railWidth - 0.06, 0.14, 0.42),
      '#e5ded1',
      [0, 0.09, 0],
      [0, 0, 0],
      0.006,
    );
  }

  if (withTopBagShelf) {
    partHelper.addPart(
      rGrp,
      new THREE.BoxGeometry(railWidth + 0.10, 0.045, 0.42),
      COL_HANGER_OAK,
      [0, 1.46, 0],
      [0, 0, 0],
      0.007,
      woodTex,
    );
    buildStructuredHandbag(
      rGrp,
      partHelper,
      [-railWidth * 0.24, 1.483, 0.02],
      0.08,
      '#b9895a',
      '#7c522b',
      0.94,
    );
    buildStructuredHandbag(
      rGrp,
      partHelper,
      [railWidth * 0.22, 1.483, -0.01],
      -0.12,
      '#dfd6c7',
      '#6b533b',
      0.88,
    );
  }

  // Curated row of hanging shirts, blouses, blazers & coats along the chrome rail
  const count = garmentColors.length;
  const usableSpan = railWidth - 0.22;
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) - 0.5 : 0;
    const gx = t * usableSpan;
    const gColor = garmentColors[i];
    const garmentLen = 0.68 + ((i * 37) % 3) * 0.09; // Alternating shirt / blazer / coat lengths
    const gGrp = new THREE.Group();
    gGrp.position.set(gx, 1.38, 0);
    gGrp.rotation.y = Math.PI / 2 + (i % 2 === 0 ? 0.06 : -0.06);
    rGrp.add(gGrp);

    // Chrome hanger hook + angled wooden coat hanger bar
    partHelper.addPart(
      gGrp,
      new THREE.CylinderGeometry(0.006, 0.006, 0.075, 6),
      COL_CHROME_RAIL,
      [0, -0.03, 0],
      [0, 0, 0],
      0,
      undefined,
      0.3,
      false,
    );
    partHelper.addPart(
      gGrp,
      new THREE.BoxGeometry(0.34, 0.026, 0.022),
      COL_HANGER_OAK,
      [0, -0.075, 0],
      [0, 0, 0],
      0.004,
      woodTex,
      0.8,
      false,
    );

    // Sculpted draped garment body + shoulder yoke + draped sleeves
    partHelper.addPart(
      gGrp,
      new THREE.BoxGeometry(0.36, garmentLen, 0.068),
      gColor,
      [0, -0.09 - garmentLen * 0.5, 0],
      [0, 0, 0],
      0.006,
    );
    for (const sSide of [-1, 1]) {
      partHelper.addPart(
        gGrp,
        new THREE.CylinderGeometry(0.036, 0.030, garmentLen * 0.76, 8),
        gColor,
        [sSide * 0.19, -0.11 - garmentLen * 0.38, 0],
        [0, 0, sSide * -0.08],
        0.004,
      );
    }
  }

  return rGrp;
}

/**
 * Builds the complete 3D **Modern Fashion & Apparel Boutique Kiosk**
 * ("Kios Toko Baju & Butik Pakaian Modern" — `screen_aad784ba.png` & `screenshot_12_60bb245f.png`).
 *
 * Architectural & Interior Fidelity across all 4 Model Sheet Quadrants:
 *  1. Front Elevation View (`+Z` facing East onto Central Plaza):
 *     Stepped Granite Plaza Paver Base, Dark Charcoal Steel Frame, Cantilevered Canopy Roof +
 *     Integrated LED Spotlights, 2 Tempered Display Glass bays + Right Glass Entrance Door,
 *     2 front window Fashion Mannequin Displays (tailored camel trench coat & charcoal A-line dress),
 *     left vertical timber slat feature wall, and indoor hanging garment display racks.
 *  2. Side Profile Elevation View (`+X` North Panoramic Glass Wall):
 *     3 Panoramic Side Glazing Panels, corner/side Fashion Mannequin Display, side-facing
 *     hanging garment rail with top handbag shelf, 4-tier warm oak Apparel & Accessories Display
 *     (handbags, boutique hat, folded knitwear) with Timber Cladding Accents, and outdoor wooden
 *     A-Frame Sidewalk Sign ("FASHION & APPAREL BOUTIQUE").
 *  3. Rear Elevation View (`-Z` West Wall):
 *     Solid Vertical Timber Cladding, Rear Staff Door, Exterior Ventilation Grille, and
 *     Electrical Utility Conduits + twin junction boxes.
 */
export function buildFashionAndApparelKiosk3D(
  opts: FashionKioskBuilderOptions,
): THREE.Group {
  const COL_STEEL = '#2b3036';
  const COL_STEEL_DARK = '#1e2228';
  const COL_TIMBER = '#c28a54';
  const COL_TIMBER_DARK = '#8c5a32';
  const COL_OAK_LIGHT = '#d8ad7c';
  const COL_GRANITE_OUTER = '#c8c5bc';
  const COL_GRANITE_INNER = '#e6e0d4';
  const COL_WARM_WALL = '#f5efe4';
  const COL_LED_WARM = '#ffefc2';

  const kioskGrp = new THREE.Group();
  kioskGrp.name = 'LobbyFashionAndApparelKiosk';
  kioskGrp.position.set(
    FASHION_APPAREL_KIOSK_LAYOUT.kioskLocalX,
    FASHION_APPAREL_KIOSK_LAYOUT.kioskLocalY,
    FASHION_APPAREL_KIOSK_LAYOUT.kioskLocalZ,
  );
  kioskGrp.rotation.y = FASHION_APPAREL_KIOSK_LAYOUT.kioskRotY;
  kioskGrp.scale.setScalar(FASHION_APPAREL_KIOSK_LAYOUT.kioskScale);
  opts.westPlantGroup.add(kioskGrp);

  const partHelper: KioskPartHelper = {
    addPart(
      parent,
      geo,
      colorHex,
      pos,
      rot = [0, 0, 0],
      toonStrokeWidth = 0.008,
      tex,
      bumpScale = 1.35,
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

  const addLuminousPart = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    emissiveHex: string,
    emissiveIntensity: number,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    tex?: THREE.Texture,
  ): THREE.Mesh => {
    const mesh = partHelper.addPart(parent, geo, colorHex, pos, rot, 0, tex, 0.4, false);
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat && 'emissive' in mat && mat.emissive instanceof THREE.Color) {
      mat.emissive.set(emissiveHex);
      mat.emissiveIntensity = emissiveIntensity;
    }
    return mesh;
  };

  const addGlassPane = (
    parent: THREE.Object3D,
    w: number,
    h: number,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
  ): THREE.Mesh => {
    const gMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), opts.sharedClearGlassMat);
    gMesh.position.set(pos[0], pos[1], pos[2]);
    gMesh.rotation.set(rot[0], rot[1], rot[2]);
    gMesh.castShadow = false;
    gMesh.receiveShadow = false;
    parent.add(gMesh);
    return gMesh;
  };

  // =========================================================================
  // 1. STEPPED GRANITE PLAZA PAVER BASE & MITRED DARK CHARCOAL STEEL PLINTH
  //    (Strictly disjoint Y heights so zero coplanar faces ever Z-fight)
  // =========================================================================
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(
      FASHION_APPAREL_KIOSK_LAYOUT.granitePaverBaseWidthLocal,
      0.070,
      FASHION_APPAREL_KIOSK_LAYOUT.granitePaverBaseDepthLocal,
    ),
    COL_GRANITE_OUTER,
    [0, 0.040, 0.14],
    [0, 0, 0],
    0.009,
    opts.textures.granitePaverTex,
    1.5,
    false,
  );

  const perimeterCurbPath: [number, number][] = [
    [-2.13, -1.53],
    [2.13, -1.53],
    [2.13, 1.53],
    [-2.13, 1.53],
  ];
  partHelper.addPart(
    kioskGrp,
    opts.createMitredPolylineStripGeometry(perimeterCurbPath, 0.22, 0.14, true),
    COL_STEEL,
    [0, 0.146, 0],
    [0, 0, 0],
    0.010,
    opts.textures.steelRoofTex,
  );

  // Warm Boutique Travertine Floor (`y in [0.080 .. 0.220]`, top at `y = 0.220`)
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(4.02, 0.14, 2.82),
    COL_GRANITE_INNER,
    [0, 0.150, 0],
    [0, 0, 0],
    0,
    opts.textures.granitePaverTex,
    1.1,
    false,
  );

  // 4 Corner Structural Dark Charcoal Steel Columns + Upper Mitred Steel Architrave Ring
  for (const cx of [-2.14, 2.14]) {
    for (const cz of [-1.54, 1.54]) {
      partHelper.addPart(
        kioskGrp,
        new THREE.BoxGeometry(0.20, 2.58, 0.20),
        COL_STEEL,
        [cx, 1.51, cz],
        [0, 0, 0],
        0.011,
        opts.textures.steelRoofTex,
      );
    }
  }
  const topRingPath: [number, number][] = [
    [-2.14, -1.54],
    [2.14, -1.54],
    [2.14, 1.54],
    [-2.14, 1.54],
  ];
  partHelper.addPart(
    kioskGrp,
    opts.createMitredPolylineStripGeometry(topRingPath, 0.18, 0.14, true),
    COL_STEEL,
    [0, 2.74, 0],
    [0, 0, 0],
    0.010,
    opts.textures.steelRoofTex,
  );

  // Warm Interior Ceiling Soffit Panel with 6 Recessed Boutique Downlights
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(4.04, 0.04, 2.84),
    '#f6f2e8',
    [0, 2.68, 0],
    [0, 0, 0],
    0,
    undefined,
    0.4,
    false,
  );
  for (const lx of [-1.25, 0.0, 1.25]) {
    for (const lz of [-0.55, 0.65]) {
      addLuminousPart(
        kioskGrp,
        new THREE.CylinderGeometry(0.065, 0.065, 0.02, 10),
        COL_LED_WARM,
        '#ffe59e',
        0.85,
        [lx, 2.655, lz],
      );
    }
  }

  // =========================================================================
  // 2. FRONT ELEVATION (`+Z = +1.54`, QUADRANT 1):
  //    2 Tempered Display Glass Bays (Left & Center) + Right Glass Entrance Door
  // =========================================================================
  for (const mx of [-0.72, 0.72]) {
    partHelper.addPart(
      kioskGrp,
      new THREE.BoxGeometry(0.11, 2.52, 0.14),
      COL_STEEL,
      [mx, 1.48, 1.54],
      [0, 0, 0],
      0.009,
      opts.textures.steelRoofTex,
    );
  }
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(2.86, 0.06, 0.12),
    COL_STEEL,
    [-0.71, 0.245, 1.54],
    [0, 0, 0],
    0.007,
  );
  addGlassPane(kioskGrp, 1.30, 2.38, [-1.43, 1.47, 1.54], [0, 0, 0]);
  addGlassPane(kioskGrp, 1.32, 2.38, [0.0, 1.47, 1.54], [0, 0, 0]);

  // Right Bay Framed Glass Entrance Door (`x in [+0.78 .. +2.04]`) + Brushed Steel Pull Handle
  partHelper.addPart(kioskGrp, new THREE.BoxGeometry(0.08, 2.40, 0.09), '#383f49', [0.82, 1.42, 1.54], [0, 0, 0], 0.007);
  partHelper.addPart(kioskGrp, new THREE.BoxGeometry(0.08, 2.40, 0.09), '#383f49', [2.00, 1.42, 1.54], [0, 0, 0], 0.007);
  partHelper.addPart(kioskGrp, new THREE.BoxGeometry(1.24, 0.09, 0.09), '#383f49', [1.41, 2.58, 1.54], [0, 0, 0], 0.007);
  partHelper.addPart(kioskGrp, new THREE.BoxGeometry(1.24, 0.08, 0.09), '#383f49', [1.41, 0.25, 1.54], [0, 0, 0], 0.007);
  addGlassPane(kioskGrp, 1.10, 2.24, [1.41, 1.42, 1.54], [0, 0, 0]);

  partHelper.addPart(
    kioskGrp,
    new THREE.CylinderGeometry(0.018, 0.018, 0.44, 10),
    '#e2e8f0',
    [0.93, 1.24, 1.60],
    [0, 0, 0],
    0.004,
    undefined,
    0.4,
    false,
  );
  for (const hy of [1.06, 1.42]) {
    partHelper.addPart(
      kioskGrp,
      new THREE.BoxGeometry(0.03, 0.03, 0.07),
      '#cbd5e1',
      [0.93, hy, 1.57],
      [0, 0, 0],
      0.003,
      undefined,
      0.4,
      false,
    );
  }

  // =========================================================================
  // 3. SIDE ELEVATIONS (`+X` NORTH 3-BAY PANORAMIC GLASS WALL & `-X` SOUTH GLAZING + TIMBER):
  //    Matches Quadrant 2 (Side Profile) & Quadrant 4 (3/4 Isometric View)
  // =========================================================================
  // North Side (`+X = +2.14`): 3 Full-Height Panoramic Side Glazing Panels (`z = -0.98, 0.0, +0.98`)
  // showcasing the corner mannequin, garment rack, and rear 4-tier timber shelving!
  for (const mz of [-0.49, 0.49]) {
    partHelper.addPart(
      kioskGrp,
      new THREE.BoxGeometry(0.14, 2.52, 0.11),
      COL_STEEL,
      [2.14, 1.48, mz],
      [0, 0, 0],
      0.009,
      opts.textures.steelRoofTex,
    );
  }
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.12, 0.06, 2.88),
    COL_STEEL,
    [2.14, 0.245, 0.0],
    [0, 0, 0],
    0.007,
  );
  addGlassPane(kioskGrp, 0.90, 2.38, [2.14, 1.47, 0.98], [0, Math.PI / 2, 0]);
  addGlassPane(kioskGrp, 0.90, 2.38, [2.14, 1.47, 0.0], [0, Math.PI / 2, 0]);
  addGlassPane(kioskGrp, 0.90, 2.38, [2.14, 1.47, -0.98], [0, Math.PI / 2, 0]);

  // South Side (`-X = -2.14`): Front Display Glass Bay (`z in [+0.18 .. +1.44]`) +
  // Vertical Timber Cladding Feature Wall (`z in [-1.44 .. +0.12]`, visible behind trench mannequin in Quadrant 1!)
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.14, 2.52, 0.11),
    COL_STEEL,
    [-2.14, 1.48, 0.14],
    [0, 0, 0],
    0.009,
    opts.textures.steelRoofTex,
  );
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.12, 0.06, 1.26),
    COL_STEEL,
    [-2.14, 0.245, 0.82],
    [0, 0, 0],
    0.007,
  );
  addGlassPane(kioskGrp, 1.24, 2.38, [-2.14, 1.47, 0.82], [0, -Math.PI / 2, 0]);
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.16, 2.48, 1.54),
    COL_TIMBER,
    [-2.10, 1.46, -0.68],
    [0, 0, 0],
    0.010,
    opts.textures.verticalTimberTex,
    1.5,
  );

  // =========================================================================
  // 4. REAR ELEVATION (`-Z = -1.52`, QUADRANT 3):
  //    Solid Vertical Timber Cladding, Rear Staff Door, Exterior Ventilation Grille & Conduits
  // =========================================================================
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(4.06, 2.52, 0.16),
    COL_TIMBER,
    [0, 1.48, -1.52],
    [0, 0, 0],
    0.012,
    opts.textures.verticalTimberTex,
    1.6,
  );
  // Warm Interior Gallery Drywall Partition (`z = -1.39`) + subtle interior fitting-room door architrave (`x = 0.36`, Quadrant 1)
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(3.96, 2.44, 0.06),
    COL_WARM_WALL,
    [0, 1.44, -1.39],
    [0, 0, 0],
    0.006,
    opts.textures.concreteTex,
    0.5,
    false,
  );
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.84, 1.98, 0.03),
    '#e7e0d2',
    [0.36, 1.21, -1.345],
    [0, 0, 0],
    0.005,
    undefined,
    0.3,
    false,
  );

  // Rear Staff Door (`x = -1.02` -> right side when viewing Rear Elevation)
  partHelper.addPart(kioskGrp, new THREE.BoxGeometry(1.16, 2.16, 0.04), COL_STEEL, [-1.02, 1.30, -1.62], [0, 0, 0], 0.010);
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(1.02, 2.04, 0.04),
    '#cfd4dc',
    [-1.02, 1.30, -1.66],
    [0, 0, 0],
    0.008,
    opts.textures.concreteTex,
    1.6,
  );
  partHelper.addPart(kioskGrp, new THREE.BoxGeometry(0.15, 0.045, 0.06), COL_STEEL, [-0.62, 1.22, -1.70], [0, 0, 0], 0.005);

  // Exterior Ventilation Grille (`x = +1.18` -> lower-left when viewing Rear Elevation)
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.84, 0.72, 0.06),
    '#47505c',
    [1.18, 0.68, -1.63],
    [0, 0, 0],
    0.010,
    opts.textures.louverTex,
    1.0,
  );

  // Surface-Mounted Electrical Utility Conduits & Twin Junction Boxes (Quadrant 3)
  partHelper.addPart(
    kioskGrp,
    new THREE.CylinderGeometry(0.024, 0.024, 2.34, 8),
    '#64748b',
    [0.32, 1.48, -1.63],
    [0, 0, 0],
    0.005,
    undefined,
    0.6,
    false,
  );
  partHelper.addPart(
    kioskGrp,
    new THREE.CylinderGeometry(0.020, 0.020, 0.78, 8),
    '#64748b',
    [0.71, 0.34, -1.63],
    [0, 0, Math.PI / 2],
    0.005,
    undefined,
    0.6,
    false,
  );
  for (const jbx of [0.06, 0.32]) {
    partHelper.addPart(
      kioskGrp,
      new THREE.BoxGeometry(0.16, 0.22, 0.08),
      '#94a3b8',
      [jbx, 0.46, -1.63],
      [0, 0, 0],
      0.006,
      undefined,
      0.6,
      false,
    );
    partHelper.addPart(
      kioskGrp,
      new THREE.CylinderGeometry(0.018, 0.018, 0.30, 6),
      '#475569',
      [jbx, 0.21, -1.63],
      [0, 0, 0],
      0,
      undefined,
      0.6,
      false,
    );
  }

  // =========================================================================
  // 5. CANTILEVERED SLOPED CANOPY ROOF & INTEGRATED WARM LED SPOTLIGHTS
  // =========================================================================
  const roofGrp = new THREE.Group();
  roofGrp.position.set(0, 2.84, 0.14);
  roofGrp.rotation.x = -0.055; // Higher at front (+Z), sloping gently down toward rear (-Z)
  kioskGrp.add(roofGrp);

  partHelper.addPart(
    roofGrp,
    new THREE.BoxGeometry(5.16, 0.18, 4.18),
    COL_STEEL,
    [0, 0.04, 0],
    [0, 0, 0],
    0.013,
    opts.textures.steelRoofTex,
    2.2,
  );
  partHelper.addPart(roofGrp, new THREE.BoxGeometry(5.26, 0.06, 4.28), COL_STEEL_DARK, [0, 0.15, 0], [0, 0, 0], 0.010);
  partHelper.addPart(roofGrp, new THREE.BoxGeometry(4.92, 0.04, 3.94), '#3b4048', [0, -0.06, 0], [0, 0, 0], 0.008);

  for (const sx of [-1.85, -0.62, 0.62, 1.85]) {
    for (const sz of [1.72, -1.72]) {
      addLuminousPart(
        roofGrp,
        new THREE.CylinderGeometry(0.075, 0.075, 0.028, 10),
        COL_LED_WARM,
        '#ffe59e',
        0.95,
        [sx, -0.082, sz],
      );
    }
  }
  for (const szSide of [-0.58, 0.58]) {
    for (const sxSide of [-2.26, 2.26]) {
      addLuminousPart(
        roofGrp,
        new THREE.CylinderGeometry(0.070, 0.070, 0.028, 10),
        COL_LED_WARM,
        '#ffe59e',
        0.95,
        [sxSide, -0.082, szSide],
      );
    }
  }

  // =========================================================================
  // 6. INTERIOR BOUTIQUE MERCHANDISING — 3 SCULPTED FASHION MANNEQUINS
  //    (Quadrant 1 Front Windows + Quadrant 2 / Quadrant 4 Corner Showcase)
  // =========================================================================
  // Interior Vertical Timber Accent Feature Panel behind left window mannequin (`x = -1.78, z = -0.58`)
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.42, 2.38, 1.42),
    COL_OAK_LIGHT,
    [-1.78, 1.41, -0.58],
    [0, 0, 0],
    0.008,
    opts.textures.verticalTimberTex,
    1.2,
  );

  // Mannequin #1 (Front-Left Window): Tailored Camel Trench Coat over Charcoal Inner Top
  const mannequinLeft = buildBoutiqueMannequin(
    kioskGrp,
    partHelper,
    [-1.38, 0.22, 0.78],
    0.14,
    'trench_coat',
    opts.textures.timberTex,
  );
  mannequinLeft.name = 'FashionMannequinTrenchCoat';

  // Mannequin #2 (Front-Center Window): Sleek Charcoal-Slate Sleeveless A-Line Dress
  const mannequinCenter = buildBoutiqueMannequin(
    kioskGrp,
    partHelper,
    [-0.14, 0.22, 0.76],
    -0.10,
    'aline_dress',
    opts.textures.timberTex,
  );
  mannequinCenter.name = 'FashionMannequinALineDress';

  // Mannequin #3 (Front-Right / North-East Corner Window): Tailored Dove-Slate Midi Ensemble
  const mannequinCorner = buildBoutiqueMannequin(
    kioskGrp,
    partHelper,
    [1.36, 0.22, 0.96],
    0.68,
    'tailored_midi',
    opts.textures.timberTex,
  );
  mannequinCorner.name = 'FashionMannequinTailoredMidi';

  // =========================================================================
  // 7. INTERIOR BOUTIQUE MERCHANDISING — HANGING GARMENT DISPLAY RACKS
  //    (Rear-Center Rack facing `+Z` Front & Side Panoramic Rack facing `+X`)
  // =========================================================================
  const frontFacingRack = buildBoutiqueGarmentRack(
    kioskGrp,
    partHelper,
    [-0.78, 0.22, -0.46],
    0,
    1.46,
    ['#f5f2eb', '#cbd5e1', '#c69f74', '#475569', '#95a79b', '#dfd6c7', '#64748b', '#e8e0d5'],
    false,
    true,
    opts.textures.timberTex,
  );
  frontFacingRack.name = 'FashionBoutiqueMainGarmentRack';

  const sideFacingRack = buildBoutiqueGarmentRack(
    kioskGrp,
    partHelper,
    [1.46, 0.22, 0.02],
    Math.PI / 2,
    0.92,
    ['#f8f6f0', '#94a3b8', '#475569', '#d6ccc2', '#c8a27a', '#cbd5e1'],
    true,
    true,
    opts.textures.timberTex,
  );
  sideFacingRack.name = 'FashionBoutiqueSideGarmentRack';

  // =========================================================================
  // 8. INTERIOR BOUTIQUE MERCHANDISING — 4-TIER OAK APPAREL & ACCESSORIES DISPLAY
  //    (`x = 1.58, y = 0.22, z = -0.96`, visible through `+X` Rear Glazing & Front Door)
  // =========================================================================
  const shelfGrp = new THREE.Group();
  shelfGrp.name = 'FashionApparelAccessoriesDisplay';
  shelfGrp.position.set(1.58, 0.22, -0.96);
  shelfGrp.rotation.y = Math.PI / 2; // Faces `+X` Panoramic Side Glass (Quadrant 2 & Quadrant 4)
  kioskGrp.add(shelfGrp);

  // Lower closed oak credenza base (`y in [0.0 .. 0.48]`)
  partHelper.addPart(
    shelfGrp,
    new THREE.BoxGeometry(0.84, 0.48, 0.44),
    COL_OAK_LIGHT,
    [0, 0.24, 0],
    [0, 0, 0],
    0.008,
    opts.textures.timberTex,
  );
  // Warm vertical timber backing panel + twin tall oak side gables (`y in [0.48 .. 1.92]`)
  partHelper.addPart(
    shelfGrp,
    new THREE.BoxGeometry(0.84, 1.44, 0.045),
    COL_TIMBER,
    [0, 1.20, -0.198],
    [0, 0, 0],
    0.007,
    opts.textures.verticalTimberTex,
  );
  for (const gx of [-0.40, 0.40]) {
    partHelper.addPart(
      shelfGrp,
      new THREE.BoxGeometry(0.04, 1.44, 0.44),
      COL_OAK_LIGHT,
      [gx, 1.20, 0],
      [0, 0, 0],
      0.007,
      opts.textures.timberTex,
    );
  }
  // 3 Horizontal oak display shelves + top crown shelf (`y = 0.94, 1.40, 1.90`)
  for (const sy of [0.94, 1.40, 1.90]) {
    partHelper.addPart(
      shelfGrp,
      new THREE.BoxGeometry(0.84, 0.04, 0.44),
      COL_OAK_LIGHT,
      [0, sy, 0],
      [0, 0, 0],
      0.006,
      opts.textures.timberTex,
    );
  }

  // Tier 4 (Top Crown `y = 1.92`): Structured Taupe Leather Tote Bag
  buildStructuredHandbag(
    shelfGrp,
    partHelper,
    [0.0, 1.92, 0.02],
    0.05,
    '#a68a6d',
    '#6b4e35',
    1.02,
  );

  // Tier 3 (Upper Cubby `y = 1.42`): Sculpted Wide-Brim Boutique Wool Hat + Grosgrain Ribbon
  const hatGrp = new THREE.Group();
  hatGrp.position.set(0.0, 1.42, 0.03);
  shelfGrp.add(hatGrp);
  partHelper.addPart(
    hatGrp,
    new THREE.CylinderGeometry(0.22, 0.23, 0.022, 18),
    '#dfd5c5',
    [0, 0.015, 0],
    [0, 0, 0],
    0.005,
  );
  partHelper.addPart(
    hatGrp,
    new THREE.CylinderGeometry(0.115, 0.132, 0.13, 16),
    '#dfd5c5',
    [0, 0.085, 0],
    [0, 0, 0],
    0.005,
  );
  partHelper.addPart(
    hatGrp,
    new THREE.CylinderGeometry(0.134, 0.135, 0.032, 16),
    '#2b3038',
    [0, 0.042, 0],
    [0, 0, 0],
    0.003,
  );

  // Tier 2 (Middle Cubby `y = 0.96`): Neat Stacks of Folded Cashmere & Merino Knitwear
  const knitStackColorsLeft = ['#cbd5e1', '#f1ece1', '#525b68'];
  for (let k = 0; k < knitStackColorsLeft.length; k++) {
    partHelper.addPart(
      shelfGrp,
      new THREE.BoxGeometry(0.30, 0.065, 0.28),
      knitStackColorsLeft[k],
      [-0.17, 0.995 + k * 0.068, 0.02],
      [0, k * 0.04, 0],
      0.005,
    );
  }
  const knitStackColorsRight = ['#c8a27a', '#94a3b8'];
  for (let k = 0; k < knitStackColorsRight.length; k++) {
    partHelper.addPart(
      shelfGrp,
      new THREE.BoxGeometry(0.28, 0.065, 0.26),
      knitStackColorsRight[k],
      [0.18, 0.995 + k * 0.068, 0.02],
      [0, -k * 0.05, 0],
      0.005,
    );
  }

  // Tier 1 (Lower Cubby `y = 0.48`): Structured Cognac Shoulder Bag
  buildStructuredHandbag(
    shelfGrp,
    partHelper,
    [0.0, 0.48, 0.03],
    -0.06,
    '#9c6638',
    '#5c3818',
    0.96,
  );

  // =========================================================================
  // 9. OUTDOOR WOODEN A-FRAME SIDEWALK SIGN ("FASHION & APPAREL BOUTIQUE")
  //    Planted on the front-right Granite Plaza Paver Base (`x = 1.88, y = 0.075, z = 1.94`)
  //    Matches Quadrant 2 Side Profile & Quadrant 4 3/4 Isometric View
  // =========================================================================
  const signGrp = new THREE.Group();
  signGrp.name = 'FashionBoutiqueAFrameSidewalkSign';
  signGrp.position.set(
    FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.x,
    FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.y,
    FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.z,
  );
  signGrp.rotation.y = FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.rotY;
  kioskGrp.add(signGrp);

  const signFaceTex = getFashionBoutiqueAFrameSignTexture();
  for (const sideZ of [-1, 1]) {
    const tiltRad = sideZ * 0.19;
    const panelZ = sideZ * 0.115;
    partHelper.addPart(
      signGrp,
      new THREE.BoxGeometry(0.60, 0.86, 0.042),
      COL_TIMBER_DARK,
      [0, 0.48, panelZ],
      [-tiltRad, 0, 0],
      0.007,
      opts.textures.timberTex,
      1.2,
    );
    for (const legX of [-0.26, 0.26]) {
      partHelper.addPart(
        signGrp,
        new THREE.BoxGeometry(0.055, 0.14, 0.042),
        COL_TIMBER_DARK,
        [legX, 0.068, sideZ * 0.19],
        [-tiltRad, 0, 0],
        0.005,
        opts.textures.timberTex,
        1.0,
      );
    }
    partHelper.addPart(
      signGrp,
      new THREE.PlaneGeometry(0.50, 0.72),
      '#ffffff',
      [0, 0.49, panelZ + sideZ * 0.024],
      sideZ > 0 ? [-tiltRad, 0, 0] : [tiltRad, Math.PI, 0],
      0,
      signFaceTex,
      0.2,
      false,
    );
  }
  partHelper.addPart(
    signGrp,
    new THREE.BoxGeometry(0.50, 0.02, 0.24),
    COL_STEEL,
    [0, 0.24, 0],
    [0, 0, 0],
    0.003,
    undefined,
    0.4,
    false,
  );

  return kioskGrp;
}
