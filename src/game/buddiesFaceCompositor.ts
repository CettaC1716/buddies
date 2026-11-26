import * as THREE from 'three';
import type { BuddyCharacterRig } from './buddiesBlitzShadersAndAssets';

export type FaceEyeShapeVariant = 'classic' | 'almond' | 'doll' | 'cat_wing' | 'idol';
export type FaceBrowShapeVariant = 'natural' | 'soft_straight' | 'sleek_arch' | 'bold_blade' | 'feathered' | 'sharp_angle';
export type FaceLipShapeVariant = 'natural' | 'soft_matte' | 'satin_bow' | 'gloss_plump' | 'velvet_full' | 'gradient_tint';

export interface WardrobeEyeStyleSpec {
  shape: FaceEyeShapeVariant;
  irisOuterHex: string;
  irisInnerHex: string;
  pupilHex: string;
  linerHex: string;
  linerThickness: number;
  wingLength: number;
  lashCount: number;
  irisScale: number;
  starHighlight?: boolean;
  eyeshadowHex?: string;
}

export interface WardrobeBrowStyleSpec {
  shape: FaceBrowShapeVariant;
  colorHex: string;
  highlightHex: string;
  thickness: number;
  archLift: number;
  tailDrop: number;
  softness: number;
}

export interface WardrobeLipStyleSpec {
  shape: FaceLipShapeVariant;
  baseHex: string;
  innerHex: string;
  lineHex: string;
  glossAlpha: number;
  fullness: number;
  widthScale: number;
}

export interface BeautyUvLayerSpec {
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FaceTuningParams {
  lipScale?: number;
  lipOffsetY?: number;
  eyeSpacing?: number;
  eyeTiltDeg?: number;
  eyeScale?: number;
  browOffsetY?: number;
  browTiltDeg?: number;
  noseStyleId?: string | null;
  headScale?: number;
}

export interface BuddyFaceCustomizationProfile {
  eyeStyle: WardrobeEyeStyleSpec | null;
  browStyle: WardrobeBrowStyleSpec | null;
  lipStyle: WardrobeLipStyleSpec | null;
  eyeOverlay?: BeautyUvLayerSpec | null;
  browOverlay?: BeautyUvLayerSpec | null;
  lipOverlay?: BeautyUvLayerSpec | null;
  eyeshadowOverlay?: BeautyUvLayerSpec | null;
  blushOverlay?: BeautyUvLayerSpec | null;
  facepaintOverlay?: BeautyUvLayerSpec | null;
  beardOverlay?: BeautyUvLayerSpec | null;
  faceoverlayOverlay?: BeautyUvLayerSpec | null;
  underwearOverlay?: BeautyUvLayerSpec | null;
  corewearOverlay?: BeautyUvLayerSpec | null;
  hideBaseUnderwear?: boolean;
  tuning?: FaceTuningParams | null;
}

export const DEFAULT_NEUTRAL_FACE_CUSTOMIZATION: BuddyFaceCustomizationProfile = {
  eyeStyle: null,
  browStyle: null,
  lipStyle: null,
  eyeOverlay: null,
  browOverlay: null,
  lipOverlay: null,
  eyeshadowOverlay: null,
  blushOverlay: null,
  facepaintOverlay: null,
  beardOverlay: null,
  faceoverlayOverlay: null,
  underwearOverlay: null,
  corewearOverlay: null,
  hideBaseUnderwear: false,
  tuning: null,
};

export const DEFAULT_NATURAL_LIP_STYLE: WardrobeLipStyleSpec = {
  shape: 'natural',
  baseHex: '#c98882',
  innerHex: '#a96864',
  lineHex: '#7d4644',
  glossAlpha: 0.18,
  fullness: 0.95,
  widthScale: 0.96,
};

export const DEFAULT_NATURAL_EYE_STYLE: WardrobeEyeStyleSpec = {
  shape: 'classic',
  irisOuterHex: '#3a2b25',
  irisInnerHex: '#8b6555',
  pupilHex: '#140f0c',
  linerHex: '#281c18',
  linerThickness: 0.92,
  wingLength: 0.22,
  lashCount: 0,
  irisScale: 0.95,
};

export const DEFAULT_NATURAL_BROW_STYLE: WardrobeBrowStyleSpec = {
  shape: 'natural',
  colorHex: '#3d2e26',
  highlightHex: '#6b5449',
  thickness: 0.88,
  archLift: 0.72,
  tailDrop: 0.44,
  softness: 0.82,
};

export interface BlitzFaceUvRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BlitzFaceUvCalibration {
  centerX: number;
  lipCenterY: number;
  lipHalfW: number;
  lipHalfH: number;
  lipClearRect: BlitzFaceUvRect;
  eyeCenterY: number;
  eyeOffsetX: number;
  eyeHalfW: number;
  eyeHalfH: number;
  eyeClearRect: BlitzFaceUvRect;
  eyeLeftClearRect: BlitzFaceUvRect;
  eyeRightClearRect: BlitzFaceUvRect;
  browCenterY: number;
  browOffsetX: number;
  browHalfW: number;
  browHalfH: number;
  browClearRect: BlitzFaceUvRect;
  browLeftClearRect: BlitzFaceUvRect;
  browRightClearRect: BlitzFaceUvRect;
  noseCenterY: number;
  noseHalfW: number;
  noseHalfH: number;
  noseClearRect: BlitzFaceUvRect;
}

/**
 * Exact pixel-verified 1024x1024 UV coordinates measured directly from
 * `Blitz_Mask_Head` textures inside `blitz-male-player.glb`, `blitz-female-03.glb`,
 * and `blitz-female-player.glb`.
 * Note: glTF `flipY = false` maps the face upside-down in PNG space (lips at lower Y,
 * nose in middle, eyes below nose, eyebrows at highest Y — so +Y is UP toward forehead).
 */
export function getBlitzFaceUvCalibration(gender: 'male' | 'female'): BlitzFaceUvCalibration {
  if (gender === 'female') {
    return {
      centerX: 812,
      lipCenterY: 76,
      lipHalfW: 29,
      lipHalfH: 12.5,
      lipClearRect: { x: 774, y: 55, w: 76, h: 42 },
      eyeCenterY: 177,
      eyeOffsetX: 51.5,
      eyeHalfW: 28,
      eyeHalfH: 12,
      eyeClearRect: { x: 716, y: 156, w: 192, h: 40 },
      eyeLeftClearRect: { x: 716, y: 156, w: 88, h: 40 },
      eyeRightClearRect: { x: 820, y: 156, w: 88, h: 40 },
      browCenterY: 210,
      browOffsetX: 57,
      browHalfW: 37,
      browHalfH: 7.5,
      browClearRect: { x: 704, y: 196, w: 216, h: 32 },
      browLeftClearRect: { x: 704, y: 196, w: 94, h: 32 },
      browRightClearRect: { x: 826, y: 196, w: 94, h: 32 },
      noseCenterY: 136,
      noseHalfW: 25,
      noseHalfH: 27,
      noseClearRect: { x: 778, y: 97, w: 68, h: 59 },
    };
  }
  return {
    centerX: 815,
    lipCenterY: 62,
    lipHalfW: 24,
    lipHalfH: 8,
    lipClearRect: { x: 780, y: 46, w: 70, h: 30 },
    eyeCenterY: 156,
    eyeOffsetX: 48,
    eyeHalfW: 27,
    eyeHalfH: 10.5,
    eyeClearRect: { x: 724, y: 141, w: 182, h: 26 },
    eyeLeftClearRect: { x: 724, y: 141, w: 84, h: 26 },
    eyeRightClearRect: { x: 822, y: 141, w: 84, h: 26 },
    browCenterY: 181,
    browOffsetX: 55,
    browHalfW: 39,
    browHalfH: 8.5,
    browClearRect: { x: 710, y: 167, w: 210, h: 31 },
    browLeftClearRect: { x: 710, y: 167, w: 96, h: 31 },
    browRightClearRect: { x: 824, y: 167, w: 96, h: 31 },
    noseCenterY: 124,
    noseHalfW: 24,
    noseHalfH: 26,
    noseClearRect: { x: 782, y: 84, w: 66, h: 56 },
  };
}

function clearFeatureRegionWithSkin(
  ctx: CanvasRenderingContext2D,
  rect: BlitzFaceUvRect,
  skinRgb: [number, number, number],
): void {
  const [r, g, b] = skinRgb;
  const cx = rect.x + rect.w * 0.5;
  const cy = rect.y + rect.h * 0.5;
  const rx = rect.w * 0.52;
  const ry = rect.h * 0.52;
  ctx.save();
  // Elliptical soft-feathered skin clear so erased zone never shows boxy corners or cuts across adjacent features
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const grad = ctx.createRadialGradient(0, 0, 0.58, 0, 0, 1.06);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
  grad.addColorStop(0.78, `rgba(${r}, ${g}, ${b}, 0.96)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 1.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draws a stylized semi-anime eye in UPRIGHT local space:
 * origin `(0, 0)` = eye center, `+x` = outer corner (temple), `-x` = inner corner (nose bridge),
 * `-y` = upper eyelid, `+y` = lower eyelid.
 */
export function drawStylizedEyeOnCanvas(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  spec: WardrobeEyeStyleSpec,
): void {
  const openH =
    spec.shape === 'doll' || spec.shape === 'idol'
      ? halfH * 1.12
      : spec.shape === 'cat_wing'
        ? halfH * 0.94
        : halfH;
  const outerLift =
    spec.shape === 'cat_wing' ? -openH * 0.34 : spec.shape === 'almond' ? -openH * 0.14 : -openH * 0.08;
  const innerDrop = openH * 0.14;

  // Optional subtle upper eyeshadow wash
  if (spec.eyeshadowHex) {
    ctx.save();
    const shadowGrad = ctx.createRadialGradient(0, -openH * 0.2, halfW * 0.15, 0, -openH * 0.25, halfW * 1.25);
    shadowGrad.addColorStop(0, spec.eyeshadowHex);
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.36;
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(halfW * 0.08, -openH * 0.35, halfW * 1.12, openH * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Build eye aperture path (clipped sclera + iris)
  const traceEyePath = () => {
    ctx.beginPath();
    ctx.moveTo(-halfW * 0.96, innerDrop);
    ctx.bezierCurveTo(
      -halfW * 0.55,
      -openH * 1.02,
      halfW * 0.42,
      -openH * 1.08 + outerLift * 0.4,
      halfW * 0.98,
      outerLift,
    );
    ctx.bezierCurveTo(
      halfW * 0.54,
      openH * 0.88 + outerLift * 0.2,
      -halfW * 0.42,
      openH * 0.92,
      -halfW * 0.96,
      innerDrop,
    );
    ctx.closePath();
  };

  // Soft upper eyelid crease above the eye
  ctx.save();
  ctx.strokeStyle = 'rgba(116, 78, 62, 0.46)';
  ctx.lineWidth = Math.max(1.1, openH * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-halfW * 0.72, -openH * 0.78);
  ctx.quadraticCurveTo(0, -openH * 1.46, halfW * 0.82, -openH * 0.88 + outerLift * 0.6);
  ctx.stroke();
  ctx.restore();

  // Sclera & Iris clipped inside aperture
  ctx.save();
  traceEyePath();
  ctx.clip();

  // Sclera base with soft top lid shadow gradient
  const scleraGrad = ctx.createLinearGradient(0, -openH, 0, openH);
  scleraGrad.addColorStop(0, '#cfd4de');
  scleraGrad.addColorStop(0.28, '#f7f8fb');
  scleraGrad.addColorStop(1, '#eceef4');
  ctx.fillStyle = scleraGrad;
  ctx.fillRect(-halfW * 1.2, -openH * 1.3, halfW * 2.4, openH * 2.6);

  // Subtle pink inner tear-duct caruncle
  ctx.fillStyle = 'rgba(205, 134, 134, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-halfW * 0.85, innerDrop, halfW * 0.18, openH * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iris body
  const irisR = openH * 0.86 * spec.irisScale;
  const irisCx = -halfW * 0.02;
  const irisCy = -openH * 0.04;

  const irisGrad = ctx.createRadialGradient(
    irisCx,
    irisCy + irisR * 0.22,
    irisR * 0.14,
    irisCx,
    irisCy,
    irisR,
  );
  irisGrad.addColorStop(0, spec.irisInnerHex);
  irisGrad.addColorStop(0.68, spec.irisOuterHex);
  irisGrad.addColorStop(1, '#121318');
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(irisCx, irisCy, irisR, 0, Math.PI * 2);
  ctx.fill();

  // Lower luminous iris bounce crescent (gives anime life/glow)
  ctx.save();
  ctx.globalAlpha = 0.58;
  ctx.fillStyle = spec.irisInnerHex;
  ctx.beginPath();
  ctx.arc(irisCx, irisCy + irisR * 0.26, irisR * 0.52, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.fill();
  ctx.restore();

  // Dark limbal ring around iris
  ctx.strokeStyle = 'rgba(14, 15, 22, 0.85)';
  ctx.lineWidth = Math.max(1.2, irisR * 0.14);
  ctx.beginPath();
  ctx.arc(irisCx, irisCy, irisR * 0.94, 0, Math.PI * 2);
  ctx.stroke();

  // Deep pupil
  ctx.fillStyle = spec.pupilHex;
  ctx.beginPath();
  ctx.arc(irisCx, irisCy, irisR * 0.44, 0, Math.PI * 2);
  ctx.fill();

  // Upper lash cast shadow across top of iris
  const lidShade = ctx.createLinearGradient(0, -openH, 0, 0);
  lidShade.addColorStop(0, 'rgba(12, 12, 20, 0.62)');
  lidShade.addColorStop(1, 'rgba(12, 12, 20, 0)');
  ctx.fillStyle = lidShade;
  ctx.fillRect(-halfW, -openH, halfW * 2, openH);

  // Dual crisp specular catchlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(irisCx - irisR * 0.34, irisCy - irisR * 0.32, irisR * 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(irisCx + irisR * 0.34, irisCy + irisR * 0.26, irisR * 0.12, 0, Math.PI * 2);
  ctx.fill();

  if (spec.starHighlight) {
    ctx.globalAlpha = 0.92;
    const sx = irisCx + irisR * 0.28;
    const sy = irisCy - irisR * 0.26;
    const sr = irisR * 0.22;
    ctx.beginPath();
    ctx.moveTo(sx, sy - sr);
    ctx.lineTo(sx + sr * 0.28, sy - sr * 0.28);
    ctx.lineTo(sx + sr, sy);
    ctx.lineTo(sx + sr * 0.28, sy + sr * 0.28);
    ctx.lineTo(sx, sy + sr);
    ctx.lineTo(sx - sr * 0.28, sy + sr * 0.28);
    ctx.lineTo(sx - sr, sy);
    ctx.lineTo(sx - sr * 0.28, sy - sr * 0.28);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Upper lash line & optional winged eyeliner
  ctx.save();
  ctx.strokeStyle = spec.linerHex;
  ctx.lineWidth = Math.max(1.8, openH * 0.24 * spec.linerThickness);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-halfW * 0.94, innerDrop - openH * 0.04);
  ctx.bezierCurveTo(
    -halfW * 0.54,
    -openH * 1.04,
    halfW * 0.44,
    -openH * 1.12 + outerLift * 0.4,
    halfW * (0.98 + spec.wingLength * 0.28),
    outerLift - spec.wingLength * openH * 0.32,
  );
  ctx.stroke();

  // Individual outer lash flicks for doll / cat / idol styles
  if (spec.lashCount > 0) {
    ctx.lineWidth = Math.max(1.0, openH * 0.1);
    for (let i = 0; i < spec.lashCount; i += 1) {
      const t = 0.35 + (i / Math.max(1, spec.lashCount - 1)) * 0.6;
      const bx = -halfW * 0.2 + t * halfW * 1.14;
      const by = -openH * (0.85 - Math.abs(t - 0.55) * 0.55) + outerLift * t;
      const len = openH * (0.28 + t * 0.22);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + len * (0.35 + t * 0.55), by - len * 0.72);
      ctx.stroke();
    }
  }

  // Soft lower lash contour
  ctx.strokeStyle = 'rgba(42, 30, 28, 0.55)';
  ctx.lineWidth = Math.max(0.9, openH * 0.09);
  ctx.beginPath();
  ctx.moveTo(-halfW * 0.72, innerDrop + openH * 0.28);
  ctx.quadraticCurveTo(0, openH * 0.88, halfW * 0.86, outerLift + openH * 0.22);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws a sculpted eyebrow in UPRIGHT local space:
 * `-x` = inner brow (near nose), `+x` = outer brow tail (near temple),
 * `-y` = upward arch, `+y` = downward toward eye.
 */
export function drawStylizedEyebrowOnCanvas(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  spec: WardrobeBrowStyleSpec,
): void {
  const thick = halfH * spec.thickness;
  const archX = halfW * (spec.shape === 'soft_straight' ? 0.42 : 0.28);
  const archY = -halfH * spec.archLift;
  const tailY = halfH * spec.tailDrop;

  ctx.save();
  // Soft undertone brow shadow for natural feathered look
  const browGrad = ctx.createLinearGradient(-halfW, 0, halfW, 0);
  browGrad.addColorStop(0, spec.highlightHex);
  browGrad.addColorStop(0.22, spec.colorHex);
  browGrad.addColorStop(0.84, spec.colorHex);
  browGrad.addColorStop(1, spec.highlightHex);

  if (spec.softness > 0) {
    ctx.save();
    ctx.globalAlpha = 0.24 * spec.softness;
    ctx.fillStyle = spec.colorHex;
    ctx.beginPath();
    ctx.moveTo(-halfW * 0.98, halfH * 0.25);
    ctx.quadraticCurveTo(archX, archY - thick * 0.9, halfW * 1.02, tailY);
    ctx.quadraticCurveTo(archX, archY + thick * 0.85, -halfW * 0.94, halfH * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Primary sculpted brow body
  ctx.fillStyle = browGrad;
  ctx.beginPath();
  // Inner head (rounded soft start)
  ctx.moveTo(-halfW * 0.94, halfH * 0.14);
  // Top edge rising to arch
  ctx.bezierCurveTo(
    -halfW * 0.45,
    -thick * 0.72,
    archX - halfW * 0.12,
    archY - thick * 0.78,
    archX + halfW * 0.12,
    archY - thick * 0.58,
  );
  // Taper smoothly to outer tail tip
  ctx.quadraticCurveTo(halfW * 0.72, archY * 0.45 + tailY * 0.55 - thick * 0.22, halfW * 0.98, tailY);
  // Bottom edge back from tail to inner head
  ctx.quadraticCurveTo(
    archX + halfW * 0.18,
    archY + thick * 0.34,
    archX - halfW * 0.16,
    archY + thick * 0.44,
  );
  ctx.quadraticCurveTo(-halfW * 0.52, thick * 0.58, -halfW * 0.92, halfH * 0.48);
  ctx.closePath();
  ctx.fill();

  // Fine directional brow hair strokes for close-up realism
  ctx.strokeStyle = spec.highlightHex;
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = Math.max(0.8, thick * 0.14);
  ctx.lineCap = 'round';
  const strokes = spec.shape === 'feathered' || spec.shape === 'bold_blade' ? 9 : 5;
  for (let i = 0; i < strokes; i += 1) {
    const t = i / Math.max(1, strokes - 1);
    const sx = -halfW * 0.8 + t * halfW * 1.45;
    const sy = halfH * 0.25 * (1 - t) + archY * Math.sin(t * Math.PI) * 0.7 + tailY * t * 0.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy + thick * 0.24);
    ctx.lineTo(sx + halfW * 0.15, sy - thick * 0.28);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws stylized lips in UPRIGHT local space:
 * origin `(0, 0)` = mouth center, `-y` = upper lip (cupid's bow), `+y` = lower lip.
 */
export function drawStylizedLipsOnCanvas(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  spec: WardrobeLipStyleSpec,
): void {
  const w = halfW * spec.widthScale;
  const h = halfH * spec.fullness;

  ctx.save();
  // Upper lip shape with sculpted cupid's bow
  const upperGrad = ctx.createLinearGradient(0, -h, 0, h * 0.15);
  upperGrad.addColorStop(0, spec.baseHex);
  upperGrad.addColorStop(1, spec.innerHex);
  ctx.fillStyle = upperGrad;
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.bezierCurveTo(-w * 0.62, -h * 0.28, -w * 0.36, -h * 0.96, -w * 0.18, -h * 0.88);
  ctx.quadraticCurveTo(0, -h * 0.58, w * 0.18, -h * 0.88);
  ctx.bezierCurveTo(w * 0.36, -h * 0.96, w * 0.62, -h * 0.28, w, 0);
  ctx.quadraticCurveTo(0, h * 0.14, -w, 0);
  ctx.closePath();
  ctx.fill();

  // Lower lip shape (plump pillowed curve)
  const lowerGrad = ctx.createLinearGradient(0, 0, 0, h);
  lowerGrad.addColorStop(0, spec.innerHex);
  lowerGrad.addColorStop(0.55, spec.baseHex);
  lowerGrad.addColorStop(1, spec.shape === 'gradient_tint' ? 'rgba(236, 198, 174, 0.25)' : spec.baseHex);
  ctx.fillStyle = lowerGrad;
  ctx.beginPath();
  ctx.moveTo(-w * 0.94, 0);
  ctx.quadraticCurveTo(0, h * 0.14, w * 0.94, 0);
  ctx.bezierCurveTo(w * 0.62, h * 0.92, w * 0.28, h * 1.06, 0, h * 1.02);
  ctx.bezierCurveTo(-w * 0.28, h * 1.06, -w * 0.62, h * 0.92, -w * 0.94, 0);
  ctx.closePath();
  ctx.fill();

  // Soft gradient inner lip tint for Korean gradient style
  if (spec.shape === 'gradient_tint') {
    const innerGrad = ctx.createRadialGradient(0, h * 0.04, w * 0.08, 0, h * 0.04, w * 0.62);
    innerGrad.addColorStop(0, spec.innerHex);
    innerGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.06, w * 0.58, h * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle mouth parting crease line
  ctx.strokeStyle = spec.lineHex;
  ctx.lineWidth = Math.max(1.0, h * 0.13);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-w * 0.92, 0);
  ctx.quadraticCurveTo(-w * 0.28, h * 0.1, 0, h * 0.06);
  ctx.quadraticCurveTo(w * 0.28, h * 0.1, w * 0.92, 0);
  ctx.stroke();

  // Specular lip gloss / satin sheen highlights
  if (spec.glossAlpha > 0.02) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.85, spec.glossAlpha)})`;
    ctx.beginPath();
    ctx.ellipse(-w * 0.18, h * 0.44, w * 0.22, h * 0.15, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.7, spec.glossAlpha * 0.72)})`;
    ctx.beginPath();
    ctx.ellipse(w * 0.22, h * 0.4, w * 0.12, h * 0.1, 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Subtle cupid's bow rim highlight
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.45, spec.glossAlpha * 0.45)})`;
    ctx.beginPath();
    ctx.ellipse(-w * 0.16, -h * 0.56, w * 0.11, h * 0.08, -0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draws airbrushed, anatomically calibrated nose contour & shade presets in UPRIGHT local space
 * aligned strictly to the 3D `Blitz_BaseDoll` nose wireframe topology (without altering 3D mesh geometry):
 * - `-1.0 * halfH` = glabella / bridge root between inner eyes
 * - `-0.30 * halfH` = mid nasal bridge (sidewalls sit out at `±0.54..0.78 * halfW`, NOT on the front ridge!)
 * - `+0.52 * halfH` = exact 3D nose tip apex
 * - `+0.84 * halfH` = exact 3D nostril pockets (`±0.28..0.34 * halfW`) & under-tip columella shadow
 * - `±0.78..0.92 * halfW` at `+0.50..0.76 * halfH` = outer alar wing creases
 */
export function drawStylizedNoseOnCanvas(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  styleId: string,
  skinRgb: [number, number, number],
  isPreview = false,
): void {
  const key = styleId.replace(/^face_nose_/, '');
  if ((!key || key === 'default') && !isPreview) return;

  const [sr, sg, sb] = skinRgb;
  // Warm realistic bronze/terracotta skin contour (never cold/muddy gray)
  const cnR = Math.max(0, sr - 44);
  const cnG = Math.max(0, sg - 66);
  const cnB = Math.max(0, sb - 74);
  // Warm umber shadow reserved strictly for tiny nostril pockets & underside columella occlusion
  const dpR = Math.max(0, sr - 84);
  const dpG = Math.max(0, sg - 100);
  const dpB = Math.max(0, sb - 104);
  // Healthy warm peach/rose tip tint
  const blR = Math.min(255, sr + 14);
  const blG = Math.max(0, sg - 34);
  const blB = Math.max(0, sb - 38);
  // Silky warm ivory skin highlight
  const hiR = Math.min(255, sr + 24);
  const hiG = Math.min(255, sg + 22);
  const hiB = Math.min(255, sb + 18);

  // Subtle boost in small 2D circular preview icons while staying ultra-natural on the 3D face
  const boost = isPreview ? 1.45 : 1.0;

  const airbrush = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    r: number,
    g: number,
    b: number,
    peakAlpha: number,
    rot = 0,
  ) => {
    if (rx <= 0.1 || ry <= 0.1 || peakAlpha <= 0.001) return;
    const a = Math.min(0.85, peakAlpha * boost);
    ctx.save();
    ctx.translate(cx, cy);
    if (rot !== 0) ctx.rotate(rot);
    ctx.scale(rx, ry);
    // Gaussian-like multi-stop falloff so no contour edge ever reads as a stripe or smudge
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
    grad.addColorStop(0.32, `rgba(${r}, ${g}, ${b}, ${a * 0.72})`);
    grad.addColorStop(0.66, `rgba(${r}, ${g}, ${b}, ${a * 0.22})`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawAnatomicalBase = (
    nostrilX: number,
    nostrilY: number,
    nostrilRx: number,
    nostrilRy: number,
    nostrilAlpha: number,
    undersideAlpha: number,
    wingAlpha: number,
  ) => {
    // Soft ambient occlusion directly beneath the 3D nose tip / columella
    airbrush(0, nostrilY + halfH * 0.04, halfW * 0.42, halfH * 0.14, cnR, cnG, cnB, undersideAlpha);
    // Tiny feathered nostril pockets tucked cleanly under the 3D nose underside
    for (const side of [-1, 1] as const) {
      airbrush(
        side * nostrilX,
        nostrilY,
        nostrilRx * 1.6,
        nostrilRy * 1.5,
        cnR,
        cnG,
        cnB,
        nostrilAlpha * 0.48,
        side * -0.22,
      );
      airbrush(
        side * nostrilX,
        nostrilY,
        nostrilRx,
        nostrilRy,
        dpR,
        dpG,
        dpB,
        nostrilAlpha,
        side * -0.22,
      );
      if (wingAlpha > 0) {
        // Gentle curved alar wing shadow hugging the outer 3D nostril flare (`±0.80 * halfW`)
        airbrush(
          side * halfW * 0.8,
          halfH * 0.64,
          halfW * 0.18,
          halfH * 0.22,
          cnR,
          cnG,
          cnB,
          wingAlpha,
          side * 0.28,
        );
      }
    }
  };

  ctx.save();

  if (!key || key === 'default') {
    // Preview-only natural clean shading
    drawAnatomicalBase(halfW * 0.28, halfH * 0.82, halfW * 0.12, halfH * 0.065, 0.28, 0.18, 0.08);
    airbrush(0, halfH * 0.5, halfW * 0.2, halfH * 0.14, hiR, hiG, hiB, 0.24);
  } else if (key === 'button') {
    // 1. Petite Button — optical illusion of a shorter, rounded, upturned cute button nose
    // Minimal bridge contour so the nose reads short & soft; gentle rosy tip + compact under-tip shadow
    for (const side of [-1, 1] as const) {
      airbrush(side * halfW * 0.58, halfH * 0.22, halfW * 0.24, halfH * 0.34, cnR, cnG, cnB, 0.11, side * 0.15);
    }
    // Soft warm rosy glow over the rounded 3D tip apex
    airbrush(0, halfH * 0.54, halfW * 0.54, halfH * 0.28, blR, blG, blB, 0.22);
    // Compact delicate nostrils & soft under-tip curve
    drawAnatomicalBase(halfW * 0.26, halfH * 0.83, halfW * 0.11, halfH * 0.06, 0.32, 0.22, 0.1);
    // Soft button highlight concentrated strictly on the rounded tip apex
    airbrush(0, halfH * 0.48, halfW * 0.22, halfH * 0.14, hiR, hiG, hiB, 0.36);
  } else if (key === 'anime_sculpted') {
    // 2. Anime Sculpted — clean, slender, sharp anime nose with minimalist shadows & refined ridge glow
    for (const side of [-1, 1] as const) {
      // Soft tapered sidewall contour hugging the outer 3D slope (slightly softer on right for anime light direction)
      const sideAlpha = side === -1 ? 0.16 : 0.11;
      airbrush(side * halfW * 0.54, -halfH * 0.06, halfW * 0.22, halfH * 0.58, cnR, cnG, cnB, sideAlpha, side * 0.08);
    }
    // Delicate V-shaped anime underside shadow & subtle tucked nostrils
    drawAnatomicalBase(halfW * 0.22, halfH * 0.84, halfW * 0.09, halfH * 0.05, 0.28, 0.24, 0.04);
    // Slim clean highlight down the narrow dorsal ridge to a crisp soft tip point
    airbrush(0, halfH * 0.04, halfW * 0.12, halfH * 0.44, hiR, hiG, hiB, 0.26);
    airbrush(0, halfH * 0.52, halfW * 0.14, halfH * 0.1, hiR, hiG, hiB, 0.4);
  } else if (key === 'korean_petite') {
    // 3. Korean Petite — K-beauty hourglass contour (flares softly into inner brows, pinches mid-bridge, dainty tip)
    for (const side of [-1, 1] as const) {
      // Inner brow-to-bridge hollow (`glabella` triangle)
      airbrush(side * halfW * 0.72, -halfH * 0.72, halfW * 0.28, halfH * 0.36, cnR, cnG, cnB, 0.16, side * -0.34);
      // Soft hourglass sidewall tapering cleanly along the 3D slope
      airbrush(side * halfW * 0.54, -halfH * 0.04, halfW * 0.22, halfH * 0.46, cnR, cnG, cnB, 0.14, side * 0.1);
      // Subtle tip-narrowing contour just above the wings so the tip looks dainty
      airbrush(side * halfW * 0.56, halfH * 0.56, halfW * 0.2, halfH * 0.2, cnR, cnG, cnB, 0.12, side * 0.28);
    }
    airbrush(0, halfH * 0.54, halfW * 0.44, halfH * 0.22, blR, blG, blB, 0.16);
    drawAnatomicalBase(halfW * 0.26, halfH * 0.84, halfW * 0.11, halfH * 0.06, 0.34, 0.24, 0.12);
    // Signature K-beauty two-point dewy highlight (mid-bridge + tip apex)
    airbrush(0, -halfH * 0.16, halfW * 0.13, halfH * 0.24, hiR, hiG, hiB, 0.3);
    airbrush(0, halfH * 0.52, halfW * 0.18, halfH * 0.12, hiR, hiG, hiB, 0.4);
  } else if (key === 'straight_elegant') {
    // 4. Straight Elegant — optical illusion of a tall, straight classical bridge running cleanly to the brow root
    for (const side of [-1, 1] as const) {
      // Smooth continuous sidewall shade from glabella down to the alar flare
      airbrush(side * halfW * 0.64, -halfH * 0.62, halfW * 0.26, halfH * 0.42, cnR, cnG, cnB, 0.15, side * -0.18);
      airbrush(side * halfW * 0.56, halfH * 0.08, halfW * 0.22, halfH * 0.56, cnR, cnG, cnB, 0.16, side * 0.04);
    }
    drawAnatomicalBase(halfW * 0.28, halfH * 0.84, halfW * 0.12, halfH * 0.06, 0.34, 0.24, 0.14);
    // Smooth unbroken dorsal highlight along the entire straight bridge to the tip
    airbrush(0, -halfH * 0.12, halfW * 0.13, halfH * 0.66, hiR, hiG, hiB, 0.3);
    airbrush(0, halfH * 0.5, halfW * 0.15, halfH * 0.13, hiR, hiG, hiB, 0.34);
  } else if (key === 'defined_bridge') {
    // 5. Defined Bridge — sculpted editorial/masculine contour hugging the real 3D sidewalls & brow hollows (zero harsh lines!)
    for (const side of [-1, 1] as const) {
      // Brow-to-nose orbital hollow seamlessly blending toward inner brows
      airbrush(side * halfW * 0.78, -halfH * 0.74, halfW * 0.32, halfH * 0.4, cnR, cnG, cnB, 0.22, side * -0.32);
      // Natural 3D sidewall shadow positioned strictly on the sloped side planes (`±0.64 * halfW`), NOT on top of the ridge
      airbrush(side * halfW * 0.64, -halfH * 0.04, halfW * 0.26, halfH * 0.6, cnR, cnG, cnB, 0.22, side * 0.08);
      // Soft lower lateral contour blending into the cheeks
      airbrush(side * halfW * 0.76, halfH * 0.48, halfW * 0.22, halfH * 0.26, cnR, cnG, cnB, 0.16, side * 0.22);
    }
    drawAnatomicalBase(halfW * 0.3, halfH * 0.84, halfW * 0.13, halfH * 0.068, 0.38, 0.26, 0.18);
    // Clean diffused dorsal ridge highlight lifting the 3D nasal bone
    airbrush(0, -halfH * 0.16, halfW * 0.15, halfH * 0.64, hiR, hiG, hiB, 0.32);
    airbrush(0, halfH * 0.52, halfW * 0.18, halfH * 0.13, hiR, hiG, hiB, 0.34);
  }

  ctx.restore();
}

function findBaseSkinMaterials(glbRoot: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const found: THREE.MeshStandardMaterial[] = [];
  const seen = new Set<THREE.Material>();
  glbRoot.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const rawMat of mats) {
      if (!rawMat || seen.has(rawMat)) continue;
      if (/blitz_mask_/i.test(rawMat.name || '')) {
        seen.add(rawMat);
        found.push(rawMat as THREE.MeshStandardMaterial);
      }
    }
  });
  return found;
}

function detectGenderFromGlbRoot(glbRoot: THREE.Object3D, hint?: 'male' | 'female'): 'male' | 'female' {
  if (hint) return hint;
  let detected: 'male' | 'female' = 'male';
  glbRoot.traverse((obj) => {
    if (/basedoll_female/i.test(obj.name || '')) {
      detected = 'female';
    }
  });
  return detected;
}

const beautyOverlayImageCache = new Map<string, HTMLImageElement | null>();
const beautyOverlayPromiseCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadBeautyOverlayImage(url: string): Promise<HTMLImageElement | null> {
  if (beautyOverlayImageCache.has(url)) {
    return Promise.resolve(beautyOverlayImageCache.get(url) ?? null);
  }
  const existing = beautyOverlayPromiseCache.get(url);
  if (existing) return existing;
  if (typeof Image === 'undefined') {
    return Promise.resolve(null);
  }
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      beautyOverlayImageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      beautyOverlayImageCache.set(url, null);
      resolve(null);
    };
    img.src = url;
  });
  beautyOverlayPromiseCache.set(url, promise);
  return promise;
}

function drawUvOverlayLayer(
  ctx: CanvasRenderingContext2D,
  layer: BeautyUvLayerSpec | null | undefined,
): boolean {
  if (!layer || !layer.url) return false;
  const img = beautyOverlayImageCache.get(layer.url);
  if (!img) return false;
  ctx.drawImage(img, layer.x, layer.y, layer.w, layer.h);
  return true;
}

/**
 * Draws a centered single-feature WebP overlay (such as Lips) with smooth
 * scale & vertical offset tuning around the overlay's own anatomical center.
 */
function drawTunedSingleOverlay(
  ctx: CanvasRenderingContext2D,
  layer: BeautyUvLayerSpec | null | undefined,
  scale: number,
  offsetY: number,
): boolean {
  if (!layer || !layer.url) return false;
  const img = beautyOverlayImageCache.get(layer.url);
  if (!img) return false;
  if (Math.abs(scale - 1.0) < 0.001 && Math.abs(offsetY) < 0.01) {
    ctx.drawImage(img, layer.x, layer.y, layer.w, layer.h);
    return true;
  }
  const cx = layer.x + layer.w * 0.5;
  const cy = layer.y + layer.h * 0.5;
  ctx.save();
  ctx.translate(cx, cy + offsetY);
  ctx.scale(scale, scale);
  ctx.drawImage(img, -layer.w * 0.5, -layer.h * 0.5, layer.w, layer.h);
  ctx.restore();
  return true;
}

/**
 * Draws a symmetric left/right paired WebP overlay (Eyes, Eyeshadow, or Brows) by
 * splitting cleanly along `centerX` and transforming each half independently around
 * its anatomical pivot `(centerX ± pivotOffsetX, pivotY)`.
 * Note: In glTF flipY=false space (+Y = UP toward forehead), `ctx.rotate(side * tiltRad)`
 * lifts outer corners UP when `tiltRad > 0` and lowers them DOWN when `tiltRad < 0`.
 */
function drawTunedPairedOverlay(
  ctx: CanvasRenderingContext2D,
  layer: BeautyUvLayerSpec | null | undefined,
  centerX: number,
  pivotOffsetX: number,
  pivotY: number,
  spacing: number,
  tiltRad: number,
  scale: number,
  offsetY: number,
): boolean {
  if (!layer || !layer.url) return false;
  const img = beautyOverlayImageCache.get(layer.url);
  if (!img) return false;
  if (
    Math.abs(spacing) < 0.01 &&
    Math.abs(tiltRad) < 0.0005 &&
    Math.abs(scale - 1.0) < 0.001 &&
    Math.abs(offsetY) < 0.01
  ) {
    ctx.drawImage(img, layer.x, layer.y, layer.w, layer.h);
    return true;
  }

  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  if (!imgW || !imgH || layer.w <= 2) {
    ctx.drawImage(img, layer.x, layer.y, layer.w, layer.h);
    return true;
  }

  const clampedCenter = Math.max(layer.x + 1, Math.min(layer.x + layer.w - 1, centerX));
  const splitRatio = (clampedCenter - layer.x) / layer.w;
  const splitPx = imgW * splitRatio;

  // Left half (side = -1)
  {
    const pivotX = centerX - pivotOffsetX;
    const destW = clampedCenter - layer.x;
    ctx.save();
    ctx.translate(pivotX - spacing, pivotY + offsetY);
    if (tiltRad !== 0) ctx.rotate(-tiltRad);
    if (scale !== 1.0) ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, splitPx, imgH, layer.x - pivotX, layer.y - pivotY, destW, layer.h);
    ctx.restore();
  }

  // Right half (side = +1)
  {
    const pivotX = centerX + pivotOffsetX;
    const destW = layer.x + layer.w - clampedCenter;
    ctx.save();
    ctx.translate(pivotX + spacing, pivotY + offsetY);
    if (tiltRad !== 0) ctx.rotate(tiltRad);
    if (scale !== 1.0) ctx.scale(scale, scale);
    ctx.drawImage(
      img,
      splitPx,
      0,
      imgW - splitPx,
      imgH,
      clampedCenter - pivotX,
      layer.y - pivotY,
      destW,
      layer.h,
    );
    ctx.restore();
  }

  return true;
}

interface DefaultFeaturePatchSet {
  gender: 'male' | 'female';
  eyeL: HTMLCanvasElement;
  eyeR: HTMLCanvasElement;
  browL: HTMLCanvasElement;
  browR: HTMLCanvasElement;
  lip: HTMLCanvasElement;
}

/**
 * Extracts a transparent, chroma-skin-keyed crop of a baked facial feature from `srcCanvas`
 * so tuning the default GLB face preserves 100% of the hand-painted GLB art and blends
 * seamlessly over freckles, blush, and eyeshadow with zero rectangular seams.
 */
function extractSkinKeyedPatch(
  srcCanvas: HTMLCanvasElement,
  rect: BlitzFaceUvRect,
  skinRgb: [number, number, number],
  scaleX: number,
  scaleY: number,
): HTMLCanvasElement {
  const sx = Math.max(0, Math.round(rect.x * scaleX));
  const sy = Math.max(0, Math.round(rect.y * scaleY));
  const sw = Math.max(2, Math.round(rect.w * scaleX));
  const sh = Math.max(2, Math.round(rect.h * scaleY));
  const patch = document.createElement('canvas');
  patch.width = sw;
  patch.height = sh;
  const pctx = patch.getContext('2d', { willReadFrequently: true });
  if (!pctx) return patch;

  pctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  const imgData = pctx.getImageData(0, 0, sw, sh);
  const d = imgData.data;
  const [sr, sg, sb] = skinRgb;
  const feather = Math.max(2, Math.round(3 * Math.min(scaleX, scaleY)));

  for (let py = 0; py < sh; py += 1) {
    const edgeY = Math.min(py + 1, sh - py) / feather;
    const wy = edgeY >= 1 ? 1 : edgeY * edgeY * (3 - 2 * edgeY);
    for (let px = 0; px < sw; px += 1) {
      const edgeX = Math.min(px + 1, sw - px) / feather;
      const wx = edgeX >= 1 ? 1 : edgeX * edgeX * (3 - 2 * edgeX);
      const idx = (py * sw + px) * 4;
      const dr = d[idx] - sr;
      const dg = d[idx + 1] - sg;
      const db = d[idx + 2] - sb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      // Smoothstep away pure uniform skin (dist <= 9 -> alpha 0, dist >= 26 -> alpha 1)
      const t = Math.max(0, Math.min(1, (dist - 9) / 17));
      const skinAlpha = t * t * (3 - 2 * t);
      d[idx + 3] = Math.round(255 * skinAlpha * wx * wy);
    }
  }
  pctx.putImageData(imgData, 0, 0);
  return patch;
}

function getOrBuildDefaultFeaturePatches(
  glbRoot: THREE.Object3D,
  srcCanvas: HTMLCanvasElement,
  uv: BlitzFaceUvCalibration,
  gender: 'male' | 'female',
  skinRgb: [number, number, number],
  scaleX: number,
  scaleY: number,
): DefaultFeaturePatchSet {
  const existing = glbRoot.userData.__defaultFeaturePatches as DefaultFeaturePatchSet | undefined;
  if (existing && existing.gender === gender) {
    return existing;
  }
  const built: DefaultFeaturePatchSet = {
    gender,
    eyeL: extractSkinKeyedPatch(srcCanvas, uv.eyeLeftClearRect, skinRgb, scaleX, scaleY),
    eyeR: extractSkinKeyedPatch(srcCanvas, uv.eyeRightClearRect, skinRgb, scaleX, scaleY),
    browL: extractSkinKeyedPatch(srcCanvas, uv.browLeftClearRect, skinRgb, scaleX, scaleY),
    browR: extractSkinKeyedPatch(srcCanvas, uv.browRightClearRect, skinRgb, scaleX, scaleY),
    lip: extractSkinKeyedPatch(srcCanvas, uv.lipClearRect, skinRgb, scaleX, scaleY),
  };
  glbRoot.userData.__defaultFeaturePatches = built;
  return built;
}

/**
 * Composites selected Eyes (Mata), Eyebrows (Alis), Lips (Bibir), Sculpted Nose (Hidung),
 * real-time precision face tuning (for BOTH WebP overlays and default GLB features),
 * and Makeup / Eyeshadow / Blush / Face Paint / Beard WebP overlays onto the
 * `Blitz_Mask_Head` texture of a BuddyCharacterRig in real time (zero GLB reload,
 * non-destructive snapshot of the original texture, shared between Wardrobe Studio
 * and the live open-world city avatar).
 */
export function applyBuddyRigFaceCustomization(
  rig: BuddyCharacterRig,
  profile: BuddyFaceCustomizationProfile | null | undefined,
  genderHint?: 'male' | 'female',
): boolean {
  const resolved: BuddyFaceCustomizationProfile = profile
    ? {
        eyeStyle: profile.eyeStyle ?? null,
        browStyle: profile.browStyle ?? null,
        lipStyle: profile.lipStyle ?? null,
        eyeOverlay: profile.eyeOverlay ?? null,
        browOverlay: profile.browOverlay ?? null,
        lipOverlay: profile.lipOverlay ?? null,
        eyeshadowOverlay: profile.eyeshadowOverlay ?? null,
        blushOverlay: profile.blushOverlay ?? null,
        facepaintOverlay: profile.facepaintOverlay ?? null,
        beardOverlay: profile.beardOverlay ?? null,
        faceoverlayOverlay: profile.faceoverlayOverlay ?? null,
        underwearOverlay: profile.underwearOverlay ?? null,
        corewearOverlay: profile.corewearOverlay ?? null,
        hideBaseUnderwear: Boolean(profile.hideBaseUnderwear),
        tuning: profile.tuning ?? null,
      }
    : DEFAULT_NEUTRAL_FACE_CUSTOMIZATION;

  if (rig.bodyGroupRef) {
    rig.bodyGroupRef.userData.desiredFaceCustomization = resolved;
  }

  const glbRoot = rig.customGlbController?.glbRoot;
  if (!glbRoot || typeof document === 'undefined') {
    return false;
  }

  const t = resolved.tuning;

  // Always apply head bone scaling unconditionally so resetting back to 1.00x takes immediate effect
  const headBone = rig.customGlbController?.bones.get('Head');
  if (headBone) {
    const rawHeadScale = t?.headScale;
    const targetScale =
      typeof rawHeadScale === 'number' && Number.isFinite(rawHeadScale)
        ? Math.max(0.78, Math.min(1.06, rawHeadScale))
        : 1.0;
    headBone.scale.setScalar(targetScale);
  }

  const skinMaterials = findBaseSkinMaterials(glbRoot);
  if (skinMaterials.length === 0) return false;

  const gender = detectGenderFromGlbRoot(glbRoot, genderHint);
  const uv = getBlitzFaceUvCalibration(gender);
  const overlayLayers = [
    resolved.underwearOverlay,
    resolved.corewearOverlay,
    resolved.blushOverlay,
    resolved.eyeshadowOverlay,
    resolved.faceoverlayOverlay,
    resolved.facepaintOverlay,
    resolved.browOverlay,
    resolved.eyeOverlay,
    resolved.lipOverlay,
    resolved.beardOverlay,
  ].filter((l): l is BeautyUvLayerSpec => Boolean(l && l.url));

  const eyeSpacing =
    typeof t?.eyeSpacing === 'number' && Number.isFinite(t.eyeSpacing)
      ? Math.max(-5, Math.min(10, t.eyeSpacing))
      : 0;
  const eyeTiltDeg =
    typeof t?.eyeTiltDeg === 'number' && Number.isFinite(t.eyeTiltDeg)
      ? Math.max(-8, Math.min(10, t.eyeTiltDeg))
      : 0;
  const eyeScale =
    typeof t?.eyeScale === 'number' && Number.isFinite(t.eyeScale)
      ? Math.max(0.82, Math.min(1.22, t.eyeScale))
      : 1.0;
  const browOffsetY =
    typeof t?.browOffsetY === 'number' && Number.isFinite(t.browOffsetY)
      ? Math.max(-7, Math.min(6, t.browOffsetY))
      : 0;
  const browTiltDeg =
    typeof t?.browTiltDeg === 'number' && Number.isFinite(t.browTiltDeg)
      ? Math.max(-10, Math.min(12, t.browTiltDeg))
      : 0;
  const lipScale =
    typeof t?.lipScale === 'number' && Number.isFinite(t.lipScale)
      ? Math.max(0.72, Math.min(1.18, t.lipScale))
      : 1.0;
  const lipOffsetY =
    typeof t?.lipOffsetY === 'number' && Number.isFinite(t.lipOffsetY)
      ? Math.max(-6, Math.min(6, t.lipOffsetY))
      : 0;

  const hasEyeTuning =
    Math.abs(eyeSpacing) > 0.01 || Math.abs(eyeTiltDeg) > 0.01 || Math.abs(eyeScale - 1.0) > 0.005;
  const browFollowSpacing = eyeSpacing * 0.4;
  const hasBrowTuning =
    Math.abs(browOffsetY) > 0.01 ||
    Math.abs(browTiltDeg) > 0.01 ||
    Math.abs(browFollowSpacing) > 0.01;
  const hasLipTuning = Math.abs(lipScale - 1.0) > 0.005 || Math.abs(lipOffsetY) > 0.01;
  const hasCustomNose = Boolean(t?.noseStyleId && t.noseStyleId !== 'face_nose_default');
  const hasTextureTuning = hasEyeTuning || hasBrowTuning || hasLipTuning || hasCustomNose;

  const isNeutralTexture =
    !resolved.eyeStyle &&
    !resolved.browStyle &&
    !resolved.lipStyle &&
    overlayLayers.length === 0 &&
    !hasTextureTuning &&
    !resolved.hideBaseUnderwear;

  // Trigger async load for any uncached overlay WebP and re-composite when ready
  const pendingUrls = overlayLayers
    .map((l) => l.url)
    .filter((u) => !beautyOverlayImageCache.has(u));
  if (pendingUrls.length > 0 && rig.bodyGroupRef) {
    const seq = ((rig.bodyGroupRef.userData.__faceOverlaySeq as number | undefined) ?? 0) + 1;
    rig.bodyGroupRef.userData.__faceOverlaySeq = seq;
    void Promise.all(pendingUrls.map((u) => loadBeautyOverlayImage(u))).then(() => {
      if (rig.bodyGroupRef?.userData.__faceOverlaySeq !== seq) return;
      applyBuddyRigFaceCustomization(rig, resolved, genderHint);
    });
  }

  // Snapshot original base texture per material so restoring neutral is 100% lossless
  let primaryOrigMap: THREE.Texture | undefined;
  for (const mat of skinMaterials) {
    if (!mat.userData.__baseFaceOriginalMap && mat.map) {
      mat.userData.__baseFaceOriginalMap = mat.map;
    }
    const origMap = mat.userData.__baseFaceOriginalMap as THREE.Texture | undefined;
    if (!primaryOrigMap && origMap?.image) {
      primaryOrigMap = origMap;
    }
  }

  if (isNeutralTexture) {
    let restored = false;
    for (const mat of skinMaterials) {
      const origMap = mat.userData.__baseFaceOriginalMap as THREE.Texture | undefined;
      if (!origMap) continue;
      if (mat.map !== origMap) {
        mat.map = origMap;
        mat.needsUpdate = true;
      }
      restored = true;
    }
    return restored;
  }

  const srcImage = primaryOrigMap?.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | undefined;
  if (!primaryOrigMap || !srcImage) return false;

  // Lazily snapshot original shared 1024x1024 skin atlas & sample exact skin tone RGB once per glbRoot
  if (!glbRoot.userData.__baseSkinSourceCanvas) {
    const w = (srcImage as { width?: number }).width || 1024;
    const h = (srcImage as { height?: number }).height || 1024;
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = w;
    srcCanvas.height = h;
    const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
    if (!sctx) return false;
    sctx.drawImage(srcImage as CanvasImageSource, 0, 0, w, h);
    const pixel = sctx.getImageData(16, 16, 1, 1).data;
    glbRoot.userData.__baseSkinSourceCanvas = srcCanvas;
    glbRoot.userData.__baseSkinToneRgb = [pixel[0], pixel[1], pixel[2]] as [number, number, number];
  }

  const srcCanvas = glbRoot.userData.__baseSkinSourceCanvas as HTMLCanvasElement;
  const skinRgb = (glbRoot.userData.__baseSkinToneRgb as [number, number, number]) || [233, 197, 171];

  // Reuse ONE shared composite canvas + CanvasTexture across all 11 blitz_Mask_* materials
  if (!glbRoot.userData.__composedSkinCanvas) {
    const compCanvas = document.createElement('canvas');
    compCanvas.width = srcCanvas.width;
    compCanvas.height = srcCanvas.height;
    const compTex = new THREE.CanvasTexture(compCanvas);
    compTex.flipY = primaryOrigMap.flipY;
    compTex.colorSpace = THREE.SRGBColorSpace;
    compTex.anisotropy = primaryOrigMap.anisotropy || 4;
    compTex.wrapS = primaryOrigMap.wrapS;
    compTex.wrapT = primaryOrigMap.wrapT;
    glbRoot.userData.__composedSkinCanvas = compCanvas;
    glbRoot.userData.__composedSkinTexture = compTex;
  }

  const compCanvas = glbRoot.userData.__composedSkinCanvas as HTMLCanvasElement;
  const compTex = glbRoot.userData.__composedSkinTexture as THREE.CanvasTexture;
  const ctx = compCanvas.getContext('2d');
  if (!ctx) return false;

  const scaleX = compCanvas.width / 1024;
  const scaleY = compCanvas.height / 1024;

  // Start fresh from untouched base skin atlas (preserves untouched features & body shading)
  ctx.clearRect(0, 0, compCanvas.width, compCanvas.height);
  ctx.drawImage(srcCanvas, 0, 0);

  ctx.save();
  ctx.scale(scaleX, scaleY);

  // -1. Clear baked-in white underwear on the base skin atlas when player removes underwear
  //     ("Bare / None") or equips custom underwear/corewear so white straps/panties never peek through.
  //     Both atlases keep the face in top-right (x >= 650, y <= 260), cleanly separated from body UVs.
  if (
    resolved.hideBaseUnderwear ||
    Boolean(resolved.underwearOverlay?.url) ||
    Boolean(resolved.corewearOverlay?.url)
  ) {
    ctx.fillStyle = `rgb(${skinRgb[0]}, ${skinRgb[1]}, ${skinRgb[2]})`;
    if (gender === 'female') {
      ctx.fillRect(0, 368, 616, 482);
    } else {
      ctx.fillRect(0, 380, 600, 260);
    }
  }

  // Body 2D Underwear & Corewear
  drawUvOverlayLayer(ctx, resolved.underwearOverlay);
  drawUvOverlayLayer(ctx, resolved.corewearOverlay);

  // 0. Clear baked base facial features FIRST (before any nose/blush/eyeshadow/facepaint)
  //    using split left/right eye & brow clear rects so the center nose bridge is NEVER wiped!
  const hasCustomEyeOverlay = Boolean(
    resolved.eyeOverlay && beautyOverlayImageCache.get(resolved.eyeOverlay.url),
  );
  const hasCustomBrowOverlay = Boolean(
    resolved.browOverlay && beautyOverlayImageCache.get(resolved.browOverlay.url),
  );
  const hasCustomLipOverlay = Boolean(
    resolved.lipOverlay && beautyOverlayImageCache.get(resolved.lipOverlay.url),
  );

  const needDefaultEyePatch = !hasCustomEyeOverlay && !resolved.eyeStyle && hasEyeTuning;
  const needDefaultBrowPatch = !hasCustomBrowOverlay && !resolved.browStyle && hasBrowTuning;
  const needDefaultLipPatch = !hasCustomLipOverlay && !resolved.lipStyle && hasLipTuning;

  const defaultPatches =
    needDefaultEyePatch || needDefaultBrowPatch || needDefaultLipPatch
      ? getOrBuildDefaultFeaturePatches(glbRoot, srcCanvas, uv, gender, skinRgb, scaleX, scaleY)
      : null;

  if (hasCustomEyeOverlay || resolved.eyeStyle || needDefaultEyePatch) {
    clearFeatureRegionWithSkin(ctx, uv.eyeLeftClearRect, skinRgb);
    clearFeatureRegionWithSkin(ctx, uv.eyeRightClearRect, skinRgb);
  }
  if (hasCustomBrowOverlay || resolved.browStyle || needDefaultBrowPatch) {
    clearFeatureRegionWithSkin(ctx, uv.browLeftClearRect, skinRgb);
    clearFeatureRegionWithSkin(ctx, uv.browRightClearRect, skinRgb);
  }
  if (hasCustomLipOverlay || resolved.lipStyle || needDefaultLipPatch) {
    clearFeatureRegionWithSkin(ctx, uv.lipClearRect, skinRgb);
  }
  if (hasCustomNose) {
    clearFeatureRegionWithSkin(ctx, uv.noseClearRect, skinRgb);
  }

  // 1. Sculpted Nose (Hidung) — rendered BEFORE blush/freckles so freckles sit naturally over the nose
  if (hasCustomNose && t?.noseStyleId) {
    ctx.save();
    ctx.translate(uv.centerX, uv.noseCenterY);
    ctx.scale(1, -1);
    drawStylizedNoseOnCanvas(ctx, uv.noseHalfW, uv.noseHalfH, t.noseStyleId, skinRgb);
    ctx.restore();
  }

  const eyeTiltRad = (eyeTiltDeg * Math.PI) / 180;
  const browTiltRad = (browTiltDeg * Math.PI) / 180;

  // 2. Skin-layer Makeup (Blush, Eye-tracked Eyeshadow, Face Overlay, Face Paint / Freckles)
  drawUvOverlayLayer(ctx, resolved.blushOverlay);
  drawTunedPairedOverlay(
    ctx,
    resolved.eyeshadowOverlay,
    uv.centerX,
    uv.eyeOffsetX,
    uv.eyeCenterY,
    eyeSpacing,
    eyeTiltRad,
    eyeScale,
    0,
  );
  drawUvOverlayLayer(ctx, resolved.faceoverlayOverlay);
  drawUvOverlayLayer(ctx, resolved.facepaintOverlay);

  // 3. Eyes (Mata) — tuned WebP overlay, tuned procedural vector, or chroma-keyed default GLB eye patch
  if (hasCustomEyeOverlay) {
    drawTunedPairedOverlay(
      ctx,
      resolved.eyeOverlay,
      uv.centerX,
      uv.eyeOffsetX,
      uv.eyeCenterY,
      eyeSpacing,
      eyeTiltRad,
      eyeScale,
      0,
    );
  } else if (resolved.eyeStyle) {
    for (const side of [-1, 1] as const) {
      ctx.save();
      ctx.translate(uv.centerX + side * (uv.eyeOffsetX + eyeSpacing), uv.eyeCenterY);
      if (eyeTiltRad !== 0) {
        ctx.rotate(side * eyeTiltRad);
      }
      ctx.scale(side, -1);
      drawStylizedEyeOnCanvas(ctx, uv.eyeHalfW * eyeScale, uv.eyeHalfH * eyeScale, resolved.eyeStyle);
      ctx.restore();
    }
  } else if (needDefaultEyePatch && defaultPatches) {
    const patches = [
      { side: -1 as const, patch: defaultPatches.eyeL, rect: uv.eyeLeftClearRect },
      { side: 1 as const, patch: defaultPatches.eyeR, rect: uv.eyeRightClearRect },
    ];
    for (const { side, patch, rect } of patches) {
      const pivotX = uv.centerX + side * uv.eyeOffsetX;
      const pivotY = uv.eyeCenterY;
      ctx.save();
      ctx.translate(pivotX + side * eyeSpacing, pivotY);
      if (eyeTiltRad !== 0) ctx.rotate(side * eyeTiltRad);
      if (eyeScale !== 1.0) ctx.scale(eyeScale, eyeScale);
      ctx.drawImage(patch, rect.x - pivotX, rect.y - pivotY, rect.w, rect.h);
      ctx.restore();
    }
  }

  // 4. Eyebrows (Alis) — tuned WebP overlay, tuned procedural vector, or chroma-keyed default GLB brow patch
  //    Subtly tracks eye spacing (`browFollowSpacing`) so brows remain harmoniously framed over wider/closer eyes
  if (hasCustomBrowOverlay) {
    drawTunedPairedOverlay(
      ctx,
      resolved.browOverlay,
      uv.centerX,
      uv.browOffsetX,
      uv.browCenterY,
      browFollowSpacing,
      browTiltRad,
      1.0,
      browOffsetY,
    );
  } else if (resolved.browStyle) {
    for (const side of [-1, 1] as const) {
      ctx.save();
      ctx.translate(
        uv.centerX + side * (uv.browOffsetX + browFollowSpacing),
        uv.browCenterY + browOffsetY,
      );
      if (browTiltRad !== 0) {
        ctx.rotate(side * browTiltRad);
      }
      ctx.scale(side, -1);
      drawStylizedEyebrowOnCanvas(ctx, uv.browHalfW, uv.browHalfH, resolved.browStyle);
      ctx.restore();
    }
  } else if (needDefaultBrowPatch && defaultPatches) {
    const patches = [
      { side: -1 as const, patch: defaultPatches.browL, rect: uv.browLeftClearRect },
      { side: 1 as const, patch: defaultPatches.browR, rect: uv.browRightClearRect },
    ];
    for (const { side, patch, rect } of patches) {
      const pivotX = uv.centerX + side * uv.browOffsetX;
      const pivotY = uv.browCenterY;
      ctx.save();
      ctx.translate(pivotX + side * browFollowSpacing, pivotY + browOffsetY);
      if (browTiltRad !== 0) ctx.rotate(side * browTiltRad);
      ctx.drawImage(patch, rect.x - pivotX, rect.y - pivotY, rect.w, rect.h);
      ctx.restore();
    }
  }

  // 5. Lips (Bibir) — tuned WebP overlay, tuned procedural vector, or chroma-keyed default GLB lip patch
  if (hasCustomLipOverlay) {
    drawTunedSingleOverlay(ctx, resolved.lipOverlay, lipScale, lipOffsetY);
  } else if (resolved.lipStyle) {
    ctx.save();
    ctx.translate(uv.centerX, uv.lipCenterY + lipOffsetY);
    ctx.scale(1, -1);
    drawStylizedLipsOnCanvas(ctx, uv.lipHalfW * lipScale, uv.lipHalfH * lipScale, resolved.lipStyle);
    ctx.restore();
  } else if (needDefaultLipPatch && defaultPatches) {
    const rect = uv.lipClearRect;
    const pivotX = uv.centerX;
    const pivotY = uv.lipCenterY;
    ctx.save();
    ctx.translate(pivotX, pivotY + lipOffsetY);
    if (lipScale !== 1.0) ctx.scale(lipScale, lipScale);
    ctx.drawImage(defaultPatches.lip, rect.x - pivotX, rect.y - pivotY, rect.w, rect.h);
    ctx.restore();
  }

  // 6. Beard (Male facial hair overlay)
  drawUvOverlayLayer(ctx, resolved.beardOverlay);

  ctx.restore();

  compTex.needsUpdate = true;
  let updated = false;
  for (const mat of skinMaterials) {
    let matChanged = false;
    if (mat.map !== compTex) {
      mat.map = compTex;
      matChanged = true;
    }
    if (mat.color && mat.color.getHex() !== 0xffffff) {
      mat.color.setHex(0xffffff);
      matChanged = true;
    }
    if (matChanged) {
      mat.needsUpdate = true;
    }
    updated = true;
  }

  return updated;
}
