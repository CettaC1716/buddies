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

export interface BuddyFaceCustomizationProfile {
  eyeStyle: WardrobeEyeStyleSpec | null;
  browStyle: WardrobeBrowStyleSpec | null;
  lipStyle: WardrobeLipStyleSpec | null;
}

export const DEFAULT_NEUTRAL_FACE_CUSTOMIZATION: BuddyFaceCustomizationProfile = {
  eyeStyle: null,
  browStyle: null,
  lipStyle: null,
};

export interface BlitzFaceUvCalibration {
  centerX: number;
  lipCenterY: number;
  lipHalfW: number;
  lipHalfH: number;
  lipClearRect: { x: number; y: number; w: number; h: number };
  eyeCenterY: number;
  eyeOffsetX: number;
  eyeHalfW: number;
  eyeHalfH: number;
  eyeClearRect: { x: number; y: number; w: number; h: number };
  browCenterY: number;
  browOffsetX: number;
  browHalfW: number;
  browHalfH: number;
  browClearRect: { x: number; y: number; w: number; h: number };
}

/**
 * Exact pixel-verified 1024x1024 UV coordinates measured directly from
 * `Blitz_Mask_Head` textures inside `blitz-male-player.glb` and `blitz-female-player.glb`.
 * Note: glTF `flipY = false` maps the face upside-down in PNG space (lips at lower Y,
 * nose in middle, eyes below nose, eyebrows at highest Y).
 */
export function getBlitzFaceUvCalibration(gender: 'male' | 'female'): BlitzFaceUvCalibration {
  if (gender === 'female') {
    return {
      centerX: 811,
      lipCenterY: 78,
      lipHalfW: 28,
      lipHalfH: 11.5,
      lipClearRect: { x: 774, y: 58, w: 76, h: 38 },
      eyeCenterY: 180,
      eyeOffsetX: 52.5,
      eyeHalfW: 27,
      eyeHalfH: 11.5,
      eyeClearRect: { x: 718, y: 162, w: 188, h: 33 },
      browCenterY: 211,
      browOffsetX: 57,
      browHalfW: 37,
      browHalfH: 7.5,
      browClearRect: { x: 702, y: 195, w: 216, h: 35 },
    };
  }
  return {
    centerX: 815,
    lipCenterY: 62,
    lipHalfW: 24,
    lipHalfH: 7.8,
    lipClearRect: { x: 782, y: 48, w: 66, h: 28 },
    eyeCenterY: 158,
    eyeOffsetX: 52,
    eyeHalfW: 26.5,
    eyeHalfH: 10.5,
    eyeClearRect: { x: 722, y: 140, w: 186, h: 30 },
    browCenterY: 182,
    browOffsetX: 56,
    browHalfW: 39,
    browHalfH: 8.5,
    browClearRect: { x: 706, y: 170, w: 218, h: 30 },
  };
}

function clearFeatureRegionWithSkin(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  skinRgb: [number, number, number],
): void {
  const [r, g, b] = skinRgb;
  const cx = rect.x + rect.w * 0.5;
  const cy = rect.y + rect.h * 0.5;
  ctx.save();
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(rect.x + 2, rect.y + 2, Math.max(1, rect.w - 4), Math.max(1, rect.h - 4));
  // Soft feathered perimeter so erased zone blends invisibly into surrounding face texture
  const grad = ctx.createRadialGradient(
    cx,
    cy,
    Math.min(rect.w, rect.h) * 0.25,
    cx,
    cy,
    Math.max(rect.w, rect.h) * 0.56,
  );
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.96)`);
  grad.addColorStop(0.75, `rgba(${r}, ${g}, ${b}, 0.85)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x - 4, rect.y - 4, rect.w + 8, rect.h + 8);
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

function findHeadFaceMaterials(glbRoot: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const found: THREE.MeshStandardMaterial[] = [];
  const seen = new Set<THREE.Material>();
  glbRoot.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const rawMat of mats) {
      if (!rawMat || seen.has(rawMat)) continue;
      if (/blitz_mask_head/i.test(rawMat.name || '')) {
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

/**
 * Composites selected Eyes (Mata), Eyebrows (Alis), and Lips (Bibir) onto the
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
      }
    : DEFAULT_NEUTRAL_FACE_CUSTOMIZATION;

  if (rig.bodyGroupRef) {
    rig.bodyGroupRef.userData.desiredFaceCustomization = resolved;
  }

  const glbRoot = rig.customGlbController?.glbRoot;
  if (!glbRoot || typeof document === 'undefined') {
    return false;
  }

  const headMaterials = findHeadFaceMaterials(glbRoot);
  if (headMaterials.length === 0) return false;

  const gender = detectGenderFromGlbRoot(glbRoot, genderHint);
  const uv = getBlitzFaceUvCalibration(gender);
  const isNeutral = !resolved.eyeStyle && !resolved.browStyle && !resolved.lipStyle;

  let updated = false;
  for (const mat of headMaterials) {
    const currentMap = mat.map;
    if (!mat.userData.__baseFaceOriginalMap && currentMap) {
      mat.userData.__baseFaceOriginalMap = currentMap;
    }
    const origMap = mat.userData.__baseFaceOriginalMap as THREE.Texture | undefined;
    const srcImage = origMap?.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined;
    if (!origMap || !srcImage) continue;

    // If all 3 features are default starter, cleanly restore the untouched original texture
    if (isNeutral) {
      if (mat.map !== origMap) {
        mat.map = origMap;
        mat.needsUpdate = true;
      }
      updated = true;
      continue;
    }

    // Lazily snapshot original source texture & sample exact skin tone RGB
    if (!mat.userData.__baseFaceSourceCanvas) {
      const w = (srcImage as { width?: number }).width || 1024;
      const h = (srcImage as { height?: number }).height || 1024;
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = w;
      srcCanvas.height = h;
      const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
      if (!sctx) continue;
      sctx.drawImage(srcImage as CanvasImageSource, 0, 0, w, h);
      const pixel = sctx.getImageData(16, 16, 1, 1).data;
      mat.userData.__baseFaceSourceCanvas = srcCanvas;
      mat.userData.__baseFaceSkinRgb = [pixel[0], pixel[1], pixel[2]] as [number, number, number];
    }

    const srcCanvas = mat.userData.__baseFaceSourceCanvas as HTMLCanvasElement;
    const skinRgb = (mat.userData.__baseFaceSkinRgb as [number, number, number]) || [233, 197, 171];

    // Reuse composite canvas + CanvasTexture per material to prevent GPU memory leaks
    if (!mat.userData.__composedFaceCanvas) {
      const compCanvas = document.createElement('canvas');
      compCanvas.width = srcCanvas.width;
      compCanvas.height = srcCanvas.height;
      const compTex = new THREE.CanvasTexture(compCanvas);
      compTex.flipY = origMap.flipY;
      compTex.colorSpace = THREE.SRGBColorSpace;
      compTex.anisotropy = origMap.anisotropy || 4;
      compTex.wrapS = origMap.wrapS;
      compTex.wrapT = origMap.wrapT;
      mat.userData.__composedFaceCanvas = compCanvas;
      mat.userData.__composedFaceTexture = compTex;
    }

    const compCanvas = mat.userData.__composedFaceCanvas as HTMLCanvasElement;
    const compTex = mat.userData.__composedFaceTexture as THREE.CanvasTexture;
    const ctx = compCanvas.getContext('2d');
    if (!ctx) continue;

    const scaleX = compCanvas.width / 1024;
    const scaleY = compCanvas.height / 1024;

    // Start fresh from untouched base face texture (preserves nose, skin tone, untouched features)
    ctx.clearRect(0, 0, compCanvas.width, compCanvas.height);
    ctx.drawImage(srcCanvas, 0, 0);

    ctx.save();
    ctx.scale(scaleX, scaleY);

    // 1. Eyes (Mata) — left & right mirror-symmetric, flipped upright via scale(side, -1)
    if (resolved.eyeStyle) {
      clearFeatureRegionWithSkin(ctx, uv.eyeClearRect, skinRgb);
      for (const side of [-1, 1] as const) {
        ctx.save();
        ctx.translate(uv.centerX + side * uv.eyeOffsetX, uv.eyeCenterY);
        ctx.scale(side, -1);
        drawStylizedEyeOnCanvas(ctx, uv.eyeHalfW, uv.eyeHalfH, resolved.eyeStyle);
        ctx.restore();
      }
    }

    // 2. Eyebrows (Alis) — left & right mirror-symmetric, flipped upright via scale(side, -1)
    if (resolved.browStyle) {
      clearFeatureRegionWithSkin(ctx, uv.browClearRect, skinRgb);
      for (const side of [-1, 1] as const) {
        ctx.save();
        ctx.translate(uv.centerX + side * uv.browOffsetX, uv.browCenterY);
        ctx.scale(side, -1);
        drawStylizedEyebrowOnCanvas(ctx, uv.browHalfW, uv.browHalfH, resolved.browStyle);
        ctx.restore();
      }
    }

    // 3. Lips (Bibir) — centered, flipped upright via scale(1, -1)
    if (resolved.lipStyle) {
      clearFeatureRegionWithSkin(ctx, uv.lipClearRect, skinRgb);
      ctx.save();
      ctx.translate(uv.centerX, uv.lipCenterY);
      ctx.scale(1, -1);
      drawStylizedLipsOnCanvas(ctx, uv.lipHalfW, uv.lipHalfH, resolved.lipStyle);
      ctx.restore();
    }

    ctx.restore();

    compTex.needsUpdate = true;
    if (mat.map !== compTex) {
      mat.map = compTex;
      mat.needsUpdate = true;
    }
    updated = true;
  }

  return updated;
}
