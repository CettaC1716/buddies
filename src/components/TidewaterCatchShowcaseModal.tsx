import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type {
  CaughtFishItem,
  FishingPhaseState,
  FishingWaterDetection,
  TidewaterMinigameState,
} from '../game/buddiesFishingMarket';

/**
 * ============================================================================
 * TIDEWATER 3D PROCEDURAL FISH STUDIO PORTRAIT & HUD OVERLAYS
 * ============================================================================
 * Directly adapts Tidewater's `FishGeometry.js`, `FishSpecies.js`, `FishPortrait.js`,
 * and `GameHUD.js` into Three.js + React for Buddies Blitz:
 *   1. Superellipse cross-section procedural fish mesh (`prof`, `section`, `outline`)
 *      with dorsal, anal, pectoral, pelvic, and forked/lunate caudal fins + eyes.
 *   2. Live 60 FPS vertex wave animation (swimming tail-flick + gentle flank turn)
 *      in a studio-lit WebGL canvas with water splash droplets.
 *   3. Tidewater Center-Screen `"!"` Bite Callout, Cast Power Arc, and
 *      Needle-in-Band Line Tension & Stamina Fight HUD.
 * ============================================================================
 */

type ProfilePoint = [number, number];

interface SpeciesAnatomyProfile {
  bodyRatio: number;
  secExp: number;
  top: ProfilePoint[];
  bot: ProfilePoint[];
  wid: ProfilePoint[];
  tailSpan: number;
  tailFork: number;
  dorsalHeight: number;
  dorsalFrom: number;
  dorsalTo: number;
  analHeight: number;
  pectoralLen: number;
   dorsalColor: string;
  flankColor: string;
  bellyColor: string;
  accentColor: string;
  stripeCount: number;
}

function evalProfile(pts: ProfilePoint[], u: number): number {
  if (u <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (u <= pts[i][0]) {
      const a = pts[i - 1];
      const b = pts[i];
      const t = (u - a[0]) / Math.max(1e-5, b[0] - a[0]);
      const s = t * t * (3 - 2 * t);
      return a[1] + (b[1] - a[1]) * (0.5 * t + 0.5 * s);
    }
  }
  return pts[pts.length - 1][1];
}

function getAnatomyForSpecies(speciesId: string, fallbackColorHex: string): SpeciesAnatomyProfile {
  switch (speciesId) {
    case 'golden_harbor_tuna':
      return {
        bodyRatio: 0.78,
        secExp: 2.15,
        top: [
          [0, 0.008],
          [0.08, 0.075],
          [0.24, 0.145],
          [0.44, 0.165],
          [0.68, 0.12],
          [0.88, 0.048],
          [1, 0.028],
        ],
        bot: [
          [0, 0.008],
          [0.08, 0.065],
          [0.24, 0.135],
          [0.44, 0.155],
          [0.68, 0.115],
          [0.88, 0.045],
          [1, 0.028],
        ],
        wid: [
          [0, 0.008],
          [0.12, 0.055],
          [0.36, 0.095],
          [0.65, 0.075],
          [0.9, 0.028],
          [1, 0.016],
        ],
        tailSpan: 0.34,
        tailFork: 0.38,
        dorsalHeight: 0.11,
        dorsalFrom: 0.28,
        dorsalTo: 0.78,
        analHeight: 0.09,
        pectoralLen: 0.22,
        dorsalColor: '#1e3a8a',
        flankColor: '#facc15',
        bellyColor: '#fef9c3',
        accentColor: '#f59e0b',
        stripeCount: 0,
      };
    case 'nebula_coelacanth':
      return {
        bodyRatio: 0.76,
        secExp: 2.3,
        top: [
          [0, 0.012],
          [0.08, 0.085],
          [0.25, 0.175],
          [0.48, 0.195],
          [0.72, 0.15],
          [0.9, 0.085],
          [1, 0.06],
        ],
        bot: [
          [0, 0.01],
          [0.08, 0.072],
          [0.25, 0.15],
          [0.48, 0.168],
          [0.72, 0.135],
          [0.9, 0.08],
          [1, 0.055],
        ],
        wid: [
          [0, 0.01],
          [0.15, 0.065],
          [0.4, 0.105],
          [0.7, 0.082],
          [1, 0.035],
        ],
        tailSpan: 0.28,
        tailFork: 0.78,
        dorsalHeight: 0.13,
        dorsalFrom: 0.26,
        dorsalTo: 0.82,
        analHeight: 0.11,
        pectoralLen: 0.2,
        dorsalColor: '#3b0764',
        flankColor: '#a855f7',
        bellyColor: '#e9d5ff',
        accentColor: '#38bdf8',
        stripeCount: 6,
      };
    case 'astral_dragon_arowana':
    case 'volt_fin_arapaima':
      return {
        bodyRatio: 0.82,
        secExp: 2.05,
        top: [
          [0, 0.008],
          [0.08, 0.052],
          [0.25, 0.095],
          [0.5, 0.115],
          [0.75, 0.105],
          [0.92, 0.065],
          [1, 0.042],
        ],
        bot: [
          [0, 0.008],
          [0.08, 0.058],
          [0.25, 0.11],
          [0.5, 0.125],
          [0.75, 0.108],
          [0.92, 0.062],
          [1, 0.04],
        ],
        wid: [
          [0, 0.006],
          [0.15, 0.042],
          [0.45, 0.062],
          [0.75, 0.048],
          [1, 0.022],
        ],
        tailSpan: 0.26,
        tailFork: 0.85,
        dorsalHeight: 0.12,
        dorsalFrom: 0.42,
        dorsalTo: 0.92,
        analHeight: 0.12,
        pectoralLen: 0.21,
        dorsalColor: speciesId === 'astral_dragon_arowana' ? '#b45309' : '#0369a1',
        flankColor: fallbackColorHex,
        bellyColor: '#fef3c7',
        accentColor: '#facc15',
        stripeCount: 5,
      };
    case 'azure_reef_snapper':
    case 'sakura_nishikigoi':
      return {
        bodyRatio: 0.78,
        secExp: 2.1,
        top: [
          [0, 0.006],
          [0.06, 0.058],
          [0.2, 0.135],
          [0.42, 0.175],
          [0.66, 0.14],
          [0.86, 0.072],
          [1, 0.045],
        ],
        bot: [
          [0, 0.006],
          [0.06, 0.048],
          [0.2, 0.11],
          [0.42, 0.145],
          [0.66, 0.118],
          [0.86, 0.065],
          [1, 0.042],
        ],
        wid: [
          [0, 0.006],
          [0.15, 0.052],
          [0.4, 0.078],
          [0.7, 0.055],
          [1, 0.024],
        ],
        tailSpan: 0.29,
        tailFork: 0.48,
        dorsalHeight: 0.105,
        dorsalFrom: 0.26,
        dorsalTo: 0.84,
        analHeight: 0.085,
        pectoralLen: 0.17,
        dorsalColor: speciesId === 'sakura_nishikigoi' ? '#e11d48' : '#0f766e',
        flankColor: fallbackColorHex,
        bellyColor: '#f8fafc',
        accentColor: speciesId === 'sakura_nishikigoi' ? '#fda4af' : '#5eead4',
        stripeCount: 4,
      };
    default:
      return {
        bodyRatio: 0.8,
        secExp: 2.0,
        top: [
          [0, 0.005],
          [0.06, 0.045],
          [0.22, 0.105],
          [0.45, 0.128],
          [0.68, 0.102],
          [0.86, 0.055],
          [1, 0.036],
        ],
        bot: [
          [0, 0.005],
          [0.06, 0.04],
          [0.22, 0.095],
          [0.45, 0.115],
          [0.68, 0.092],
          [0.86, 0.05],
          [1, 0.034],
        ],
        wid: [
          [0, 0.005],
          [0.14, 0.042],
          [0.4, 0.064],
          [0.7, 0.046],
          [1, 0.02],
        ],
        tailSpan: 0.25,
        tailFork: 0.45,
        dorsalHeight: 0.09,
        dorsalFrom: 0.32,
        dorsalTo: 0.78,
        analHeight: 0.075,
        pectoralLen: 0.15,
        dorsalColor: '#0f172a',
        flankColor: fallbackColorHex,
        bellyColor: '#f1f5f9',
        accentColor: '#38bdf8',
        stripeCount: 5,
      };
  }
}

/**
 * Builds a complete 3D procedural fish group using Tidewater's superellipse anatomy
 * (`FishGeometry.js`), complete with vertex-colored scales/stripes, dorsal/anal/caudal/pectoral fins,
 * gill opercle lines, and 3D eyes.
 */
export function buildTidewaterProceduralFishGroup(
  speciesId: string,
  colorHex: string,
): {
  group: THREE.Group;
  updateSwimAnimation: (timeSec: number) => void;
  dispose: () => void;
} {
  const spec = getAnatomyForSpecies(speciesId, colorHex);
  const group = new THREE.Group();

  const rings = 32;
  const radialSegs = 20;
  const bodyLen = spec.bodyRatio;
  const positions: number[] = [];
  const colors: number[] = [];
  const uCoords: number[] = [];
  const indices: number[] = [];

  const colDorsal = new THREE.Color(spec.dorsalColor);
  const colFlank = new THREE.Color(spec.flankColor);
  const colBelly = new THREE.Color(spec.bellyColor);
  const colAccent = new THREE.Color(spec.accentColor);
  const tmpCol = new THREE.Color();

  const exp = 2 / spec.secExp;

  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    // Snout at x = -0.5, tail peduncle at x = -0.5 + bodyLen
    const x = -0.5 + u * bodyLen;
    const T = evalProfile(spec.top, u);
    const B = evalProfile(spec.bot, u);
    const W = evalProfile(spec.wid, u);

    for (let j = 0; j <= radialSegs; j++) {
      const phi = (j / radialSegs) * Math.PI * 2;
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);
      const z = W * Math.sign(sinP) * Math.pow(Math.abs(sinP), exp);
      const y = (cosP >= 0 ? T : B) * Math.sign(cosP) * Math.pow(Math.abs(cosP), exp);

      positions.push(x, y, z);
      uCoords.push(u);

      // Height fraction (-1 belly .. +1 dorsal back)
      const hFrac = cosP;
      if (hFrac > 0.25) {
        tmpCol.lerpColors(colFlank, colDorsal, Math.min(1, (hFrac - 0.25) / 0.75));
      } else if (hFrac < -0.2) {
        tmpCol.lerpColors(colFlank, colBelly, Math.min(1, (-hFrac - 0.2) / 0.8));
      } else {
        tmpCol.copy(colFlank);
      }

      // Lateral iridescent line & vertical bars / spots
      const latDist = Math.abs(hFrac - 0.12);
      if (latDist < 0.12 && u > 0.16 && u < 0.92) {
        tmpCol.lerp(colAccent, (1 - latDist / 0.12) * 0.65);
      }
      if (spec.stripeCount > 0 && u > 0.2 && u < 0.85 && hFrac > -0.25) {
        const barWave = Math.sin(u * Math.PI * 2 * spec.stripeCount);
        if (barWave > 0.45) {
          tmpCol.lerp(colDorsal, (barWave - 0.45) * 0.65);
        }
      }
      // Subtle scale diamond shimmer
      const scaleShimmer =
        Math.sin(u * 95.0) * Math.cos(phi * 14.0) * (1 - Math.abs(hFrac) * 0.5);
      tmpCol.offsetHSL(0, 0, scaleShimmer * 0.035);

      colors.push(tmpCol.r, tmpCol.g, tmpCol.b);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, d, b, b, d, c);
    }
  }

  const bodyGeo = new THREE.BufferGeometry();
  const basePosArray = new Float32Array(positions);
  const animPosAttr = new THREE.BufferAttribute(new Float32Array(positions), 3);
  bodyGeo.setAttribute('position', animPosAttr);
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  bodyGeo.setIndex(indices);
  bodyGeo.computeVertexNormals();

  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.22,
    metalness: 0.28,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(bodyMesh);

  // Forked / Lunate Caudal Tail Fin
  const tailStartX = -0.5 + bodyLen * 0.96;
  const tailEndX = 0.5;
  const tailMidX = tailStartX + (tailEndX - tailStartX) * spec.tailFork;
  const tailShape = new THREE.Shape();
  tailShape.moveTo(tailStartX, 0.025);
  tailShape.quadraticCurveTo(
    (tailStartX + tailEndX) * 0.5,
    spec.tailSpan * 0.95,
    tailEndX,
    spec.tailSpan,
  );
  tailShape.quadraticCurveTo(tailMidX, spec.tailSpan * 0.25, tailMidX, 0);
  tailShape.quadraticCurveTo(tailMidX, -spec.tailSpan * 0.25, tailEndX, -spec.tailSpan);
  tailShape.quadraticCurveTo(
    (tailStartX + tailEndX) * 0.5,
    -spec.tailSpan * 0.95,
    tailStartX,
    -0.025,
  );
  tailShape.closePath();

  const finMat = new THREE.MeshStandardMaterial({
    color: spec.accentColor,
    roughness: 0.35,
    metalness: 0.15,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const tailGeo = new THREE.ShapeGeometry(tailShape, 8);
  const tailMesh = new THREE.Mesh(tailGeo, finMat);
  group.add(tailMesh);

  // Dorsal Fin
  const dStartX = -0.5 + spec.dorsalFrom * bodyLen;
  const dEndX = -0.5 + spec.dorsalTo * bodyLen;
  const dorsalShape = new THREE.Shape();
  dorsalShape.moveTo(dStartX, evalProfile(spec.top, spec.dorsalFrom) * 0.85);
  dorsalShape.quadraticCurveTo(
    dStartX + (dEndX - dStartX) * 0.35,
    evalProfile(spec.top, 0.42) + spec.dorsalHeight,
    dEndX,
    evalProfile(spec.top, spec.dorsalTo) * 0.9,
  );
  dorsalShape.lineTo(dStartX, evalProfile(spec.top, spec.dorsalFrom) * 0.85);
  const dorsalGeo = new THREE.ShapeGeometry(dorsalShape, 6);
  const dorsalMesh = new THREE.Mesh(dorsalGeo, finMat);
  group.add(dorsalMesh);

  // Anal Fin
  const aStartX = -0.5 + 0.58 * bodyLen;
  const aEndX = -0.5 + 0.84 * bodyLen;
  const analShape = new THREE.Shape();
  analShape.moveTo(aStartX, -evalProfile(spec.bot, 0.58) * 0.85);
  analShape.quadraticCurveTo(
    (aStartX + aEndX) * 0.45,
    -evalProfile(spec.bot, 0.68) - spec.analHeight,
    aEndX,
    -evalProfile(spec.bot, 0.84) * 0.88,
  );
  analShape.lineTo(aStartX, -evalProfile(spec.bot, 0.58) * 0.85);
  const analGeo = new THREE.ShapeGeometry(analShape, 6);
  const analMesh = new THREE.Mesh(analGeo, finMat);
  group.add(analMesh);

  // Pectoral Fins (Left & Right)
  const pecShape = new THREE.Shape();
  pecShape.moveTo(0, 0);
  pecShape.quadraticCurveTo(spec.pectoralLen * 0.55, 0.025, spec.pectoralLen, -0.015);
  pecShape.quadraticCurveTo(spec.pectoralLen * 0.45, -0.055, 0, -0.022);
  pecShape.closePath();
  const pecGeo = new THREE.ShapeGeometry(pecShape, 5);
  const pecFlankW = evalProfile(spec.wid, 0.26);
  const pecLeft = new THREE.Mesh(pecGeo, finMat);
  pecLeft.position.set(-0.5 + 0.25 * bodyLen, -0.015, pecFlankW * 0.92);
  pecLeft.rotation.set(0.22, -0.38, -0.18);
  group.add(pecLeft);

  const pecRight = new THREE.Mesh(pecGeo, finMat);
  pecRight.position.set(-0.5 + 0.25 * bodyLen, -0.015, -pecFlankW * 0.92);
  pecRight.rotation.set(-0.22, 0.38, -0.18);
  group.add(pecRight);

  // 3D Eyes (Iris + Pupil on both sides near snout u = 0.12)
  const eyeX = -0.5 + 0.12 * bodyLen;
  const eyeY = evalProfile(spec.top, 0.12) * 0.42;
  const eyeZ = evalProfile(spec.wid, 0.12) * 0.88;
  const irisGeo = new THREE.SphereGeometry(0.022, 12, 12);
  const irisMat = new THREE.MeshStandardMaterial({
    color: '#fde047',
    roughness: 0.2,
    metalness: 0.6,
  });
  const pupilGeo = new THREE.SphereGeometry(0.013, 10, 10);
  const pupilMat = new THREE.MeshBasicMaterial({ color: '#020617' });

  for (const side of [1, -1] as const) {
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.set(eyeX, eyeY, side * eyeZ);
    iris.userData = { eyeDepthBias: -0.014 };
    group.add(iris);

    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(eyeX - 0.003, eyeY, side * (eyeZ + 0.01));
    pupil.userData = { eyeDepthBias: -0.022 };
    group.add(pupil);
  }

  const updateSwimAnimation = (timeSec: number) => {
    const arr = animPosAttr.array as Float32Array;
    for (let k = 0; k < uCoords.length; k++) {
      const u = uCoords[k];
      const idx3 = k * 3;
      const baseZ = basePosArray[idx3 + 2];
      // Tidewater sinusoidal lateral swimming curve increasing quadratically toward the tail
      const waveZ = Math.sin(timeSec * 5.2 - u * 4.8) * 0.045 * (u * u);
      arr[idx3 + 2] = baseZ + waveZ;
    }
    animPosAttr.needsUpdate = true;
    const tailSway = Math.sin(timeSec * 5.2 - 4.6) * 0.048;
    tailMesh.position.z = tailSway;
    tailMesh.rotation.y = Math.cos(timeSec * 5.2 - 4.6) * 0.22;
    pecLeft.rotation.y = -0.38 + Math.sin(timeSec * 6.5) * 0.16;
    pecRight.rotation.y = 0.38 - Math.sin(timeSec * 6.5) * 0.16;
  };

  const dispose = () => {
    bodyGeo.dispose();
    bodyMat.dispose();
    tailGeo.dispose();
    dorsalGeo.dispose();
    analGeo.dispose();
    pecGeo.dispose();
    finMat.dispose();
    irisGeo.dispose();
    irisMat.dispose();
    pupilGeo.dispose();
    pupilMat.dispose();
  };

  return { group, updateSwimAnimation, dispose };
}

export interface ProjectedFishTriangle {
  sx0: number;
  sy0: number;
  sx1: number;
  sy1: number;
  sx2: number;
  sy2: number;
  sortDepth: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
}

const reusableTriPool: ProjectedFishTriangle[] = [];
const reusableSortedRefs: ProjectedFishTriangle[] = [];

function linearToneMapToSrgbByte(linearVal: number): number {
  const v = Math.max(0, linearVal);
  const mapped = (v * 1.18) / (1 + v * 0.22);
  const srgb =
    mapped <= 0.0031308 ? mapped * 12.92 : 1.055 * Math.pow(mapped, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(srgb * 255)));
}

function linearDirectToSrgbByte(linearVal: number): number {
  const v = Math.max(0, Math.min(1, linearVal));
  const srgb = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(srgb * 255)));
}

/**
 * Projects and studio-lights all visible 3D triangles of `fishGroup` in pure CPU math
 * (zero WebGL contexts, zero GPU contention, zero per-frame heap allocations).
 */
export function projectFishGroupTriangles(
  fishGroup: THREE.Group,
  width: number,
  height: number,
  cameraZ = 2.55,
  fovDeg = 23,
): readonly ProjectedFishTriangle[] {
  fishGroup.updateMatrixWorld(true);
  const gmw = fishGroup.matrixWorld.elements;

  const camY = 0.02;
  const camZ = Math.max(0.8, cameraZ);
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const focal = halfH / Math.tan(((fovDeg * Math.PI) / 180) * 0.5);

  // Normalized 3-point studio light directions
  const L1x = -0.4362;
  const L1y = 0.6688;
  const L1z = 0.6019;
  const L2x = 0.7181;
  const L2y = -0.4388;
  const L2z = -0.5398;
  const L3x = 0.0;
  const L3y = -0.7071;
  const L3z = 0.7071;

  let activeCount = 0;

  fishGroup.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    const geo = mesh.geometry;
    const posAttr = geo.getAttribute('position');
    if (!posAttr) return;
    const colAttr = geo.getAttribute('color');
    const indexAttr = geo.getIndex();
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
      | THREE.MeshStandardMaterial
      | THREE.MeshBasicMaterial
      | undefined;
    if (!mat) return;

    const mw = mesh.matrixWorld.elements;
    const isBasic = Boolean((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial);
    const isDoubleSide = mat.side === THREE.DoubleSide;
    const stdMat = mat as THREE.MeshStandardMaterial;
    const useVertColors = Boolean(!isBasic && stdMat.vertexColors && colAttr);
    const matR = mat.color ? mat.color.r : 1;
    const matG = mat.color ? mat.color.g : 1;
    const matB = mat.color ? mat.color.b : 1;
    const roughness = !isBasic && typeof stdMat.roughness === 'number' ? stdMat.roughness : 0.3;
    const alpha = mat.transparent ? (mat.opacity ?? 0.9) : 1;

    let depthBias = 0;
    const rawEyeBias = (mesh.userData as { eyeDepthBias?: number } | undefined)?.eyeDepthBias;
    if (typeof rawEyeBias === 'number') {
      const sagittalWorldZ = gmw[2] * mesh.position.x + gmw[6] * mesh.position.y + gmw[14];
      const isFrontFlankEye = mw[14] >= sagittalWorldZ;
      depthBias = isFrontFlankEye ? rawEyeBias : -rawEyeBias;
    }

    const triCount = indexAttr ? Math.floor(indexAttr.count / 3) : Math.floor(posAttr.count / 3);
    for (let t = 0; t < triCount; t++) {
      const t3 = t * 3;
      const i0 = indexAttr ? indexAttr.getX(t3) : t3;
      const i1 = indexAttr ? indexAttr.getX(t3 + 1) : t3 + 1;
      const i2 = indexAttr ? indexAttr.getX(t3 + 2) : t3 + 2;

      const lx0 = posAttr.getX(i0);
      const ly0 = posAttr.getY(i0);
      const lz0 = posAttr.getZ(i0);
      const x0 = mw[0] * lx0 + mw[4] * ly0 + mw[8] * lz0 + mw[12];
      const y0 = mw[1] * lx0 + mw[5] * ly0 + mw[9] * lz0 + mw[13];
      const z0 = mw[2] * lx0 + mw[6] * ly0 + mw[10] * lz0 + mw[14];

      const lx1 = posAttr.getX(i1);
      const ly1 = posAttr.getY(i1);
      const lz1 = posAttr.getZ(i1);
      const x1 = mw[0] * lx1 + mw[4] * ly1 + mw[8] * lz1 + mw[12];
      const y1 = mw[1] * lx1 + mw[5] * ly1 + mw[9] * lz1 + mw[13];
      const z1 = mw[2] * lx1 + mw[6] * ly1 + mw[10] * lz1 + mw[14];

      const lx2 = posAttr.getX(i2);
      const ly2 = posAttr.getY(i2);
      const lz2 = posAttr.getZ(i2);
      const x2 = mw[0] * lx2 + mw[4] * ly2 + mw[8] * lz2 + mw[12];
      const y2 = mw[1] * lx2 + mw[5] * ly2 + mw[9] * lz2 + mw[13];
      const z2 = mw[2] * lx2 + mw[6] * ly2 + mw[10] * lz2 + mw[14];

      const d0 = camZ - z0;
      const d1 = camZ - z1;
      const d2 = camZ - z2;
      if (d0 < 0.15 || d1 < 0.15 || d2 < 0.15) continue;

      const e1x = x1 - x0;
      const e1y = y1 - y0;
      const e1z = z1 - z0;
      const e2x = x2 - x0;
      const e2y = y2 - y0;
      const e2z = z2 - z0;

      let nx = e1y * e2z - e1z * e2y;
      let ny = e1z * e2x - e1x * e2z;
      let nz = e1x * e2y - e1y * e2x;
      const nLenSq = nx * nx + ny * ny + nz * nz;
      if (nLenSq < 1e-12) continue;
      const invNLen = 1 / Math.sqrt(nLenSq);
      nx *= invNLen;
      ny *= invNLen;
      nz *= invNLen;

      const cxW = (x0 + x1 + x2) * (1 / 3);
      const cyW = (y0 + y1 + y2) * (1 / 3);
      const czW = (z0 + z1 + z2) * (1 / 3);

      let vx = -cxW;
      let vy = camY - cyW;
      let vz = camZ - czW;
      const invVLen = 1 / Math.max(1e-6, Math.sqrt(vx * vx + vy * vy + vz * vz));
      vx *= invVLen;
      vy *= invVLen;
      vz *= invVLen;

      let ndotv = nx * vx + ny * vy + nz * vz;
      if (isDoubleSide) {
        if (ndotv < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
          ndotv = -ndotv;
        }
      } else if (ndotv <= 0) {
        continue;
      }

      let rByte: number;
      let gByte: number;
      let bByte: number;

      if (isBasic) {
        rByte = linearDirectToSrgbByte(matR);
        gByte = linearDirectToSrgbByte(matG);
        bByte = linearDirectToSrgbByte(matB);
      } else {
        let br = matR;
        let bg = matG;
        let bb = matB;
        if (useVertColors && colAttr) {
          br *= (colAttr.getX(i0) + colAttr.getX(i1) + colAttr.getX(i2)) * (1 / 3);
          bg *= (colAttr.getY(i0) + colAttr.getY(i1) + colAttr.getY(i2)) * (1 / 3);
          bb *= (colAttr.getZ(i0) + colAttr.getZ(i1) + colAttr.getZ(i2)) * (1 / 3);
        }

        const diff1 = Math.max(0, nx * L1x + ny * L1y + nz * L1z);
        const diff2 = Math.max(0, nx * L2x + ny * L2y + nz * L2z);
        const diff3 = Math.max(0, nx * L3x + ny * L3y + nz * L3z);

        let hx = L1x + vx;
        let hy = L1y + vy;
        let hz = L1z + vz;
        const invHLen = 1 / Math.max(1e-6, Math.sqrt(hx * hx + hy * hy + hz * hz));
        hx *= invHLen;
        hy *= invHLen;
        hz *= invHLen;
        const ndoth = Math.max(0, nx * hx + ny * hy + nz * hz);
        const spec =
          roughness < 0.28 ? Math.pow(ndoth, 28) * 0.44 : Math.pow(ndoth, 12) * 0.14;
        const oneMinusNdotV = 1 - Math.min(1, ndotv);
        const fresnel =
          oneMinusNdotV * oneMinusNdotV * oneMinusNdotV * (isDoubleSide ? 0.08 : 0.2);

        const linR =
          br * (0.34 + diff1 * 1.18 + diff2 * 0.18 + diff3 * 0.22) +
          spec * 1.0 +
          fresnel * 0.22;
        const linG =
          bg * (0.36 + diff1 * 1.14 + diff2 * 0.48 + diff3 * 0.25) +
          spec * 0.99 +
          fresnel * 0.62;
        const linB =
          bb * (0.4 + diff1 * 1.05 + diff2 * 0.68 + diff3 * 0.32) +
          spec * 0.95 +
          fresnel * 0.92;

        rByte = linearToneMapToSrgbByte(linR);
        gByte = linearToneMapToSrgbByte(linG);
        bByte = linearToneMapToSrgbByte(linB);
      }

      let slot = reusableTriPool[activeCount];
      if (!slot) {
        slot = {
          sx0: 0,
          sy0: 0,
          sx1: 0,
          sy1: 0,
          sx2: 0,
          sy2: 0,
          sortDepth: 0,
          r: 0,
          g: 0,
          b: 0,
          alpha: 1,
        };
        reusableTriPool[activeCount] = slot;
      }

      slot.sx0 = halfW + (x0 / d0) * focal;
      slot.sy0 = halfH - ((y0 - camY) / d0) * focal;
      slot.sx1 = halfW + (x1 / d1) * focal;
      slot.sy1 = halfH - ((y1 - camY) / d1) * focal;
      slot.sx2 = halfW + (x2 / d2) * focal;
      slot.sy2 = halfH - ((y2 - camY) / d2) * focal;
      slot.sortDepth = (d0 + d1 + d2) * (1 / 3) + depthBias;
      slot.r = rByte;
      slot.g = gByte;
      slot.b = bByte;
      slot.alpha = alpha;

      reusableSortedRefs[activeCount] = slot;
      activeCount++;
    }
  });

  reusableSortedRefs.length = activeCount;
  reusableSortedRefs.sort((a, b) => b.sortDepth - a.sortDepth);
  return reusableSortedRefs;
}

/**
 * Renders `fishGroup` onto a standard HTML5 2D canvas context (`CanvasRenderingContext2D`)
 * with perspective projection, 3-point studio lighting, and seam-free triangle rasterization.
 */
export function renderFishGroupTo2dCanvas(
  ctx: CanvasRenderingContext2D,
  fishGroup: THREE.Group,
  width: number,
  height: number,
  cameraZ = 2.55,
  fovDeg = 23,
): number {
  const tris = projectFishGroupTriangles(fishGroup, width, height, cameraZ, fovDeg);
  ctx.clearRect(0, 0, width, height);
  ctx.lineJoin = 'round';

  for (let i = 0; i < tris.length; i++) {
    const tri = tris[i];
    const style =
      tri.alpha < 0.999
        ? `rgba(${tri.r},${tri.g},${tri.b},${tri.alpha.toFixed(2)})`
        : `rgb(${tri.r},${tri.g},${tri.b})`;
    ctx.beginPath();
    ctx.moveTo(tri.sx0, tri.sy0);
    ctx.lineTo(tri.sx1, tri.sy1);
    ctx.lineTo(tri.sx2, tri.sy2);
    ctx.closePath();
    ctx.fillStyle = style;
    ctx.fill();
    if (tri.alpha >= 0.999) {
      ctx.strokeStyle = style;
      ctx.lineWidth = 0.75;
      ctx.stroke();
    }
  }

  return tris.length;
}

interface TidewaterFishingHudAndModalProps {
  nearbyWaterZone: FishingWaterDetection;
  fishingPhase: FishingPhaseState;
  fishingCastPower: number;
  fishingHintMessage: string | null;
  fishingMinigame: TidewaterMinigameState | null;
  isHoldingReel: boolean;
  caughtFishBucketCount: number;
  lastCaughtFishToast: CaughtFishItem | null;
  walletConnected?: boolean;
  onRequestRegisterWallet?: () => void;
  onStartChargeCast: () => void;
  onReleaseChargeCast: () => void;
  onTriggerFishingAction: () => void;
  onSetHoldingReel: (holding: boolean) => void;
  onCancelCast?: () => void;
  onKeepCaughtFish: () => void;
  onReleaseCaughtFish: (fish: CaughtFishItem) => void;
  onSellCaughtFishToKai: (fish: CaughtFishItem) => void;
  onMintCaughtFishAsNft: (fish: CaughtFishItem) => void | Promise<boolean>;
}

export const TidewaterFishingHudAndShowcase: React.FC<TidewaterFishingHudAndModalProps> = ({
  nearbyWaterZone,
  fishingPhase,
  fishingCastPower,
  fishingHintMessage,
  fishingMinigame,
  isHoldingReel,
  caughtFishBucketCount,
  lastCaughtFishToast,
  walletConnected = false,
  onRequestRegisterWallet,
  onStartChargeCast,
  onReleaseChargeCast,
  onTriggerFishingAction,
  onSetHoldingReel,
  onCancelCast,
  onKeepCaughtFish,
  onReleaseCaughtFish,
  onSellCaughtFishToKai,
  onMintCaughtFishAsNft,
}) => {
  const studioCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isMintingShowcaseNft, setIsMintingShowcaseNft] = useState<boolean>(false);
  const [showcaseMintError, setShowcaseMintError] = useState<string | null>(null);

  useEffect(() => {
    setIsMintingShowcaseNft(false);
    setShowcaseMintError(null);
  }, [lastCaughtFishToast?.id]);

  // Global mouse hold-to-reel during 'fighting' and click-to-strike during 'bite' so the player
  // never has to hunt for a UI button while watching the 3D water & bobber!
  useEffect(() => {
    if (fishingPhase !== 'fighting' && fishingPhase !== 'bite') return;
    const onWinPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, input, textarea, [data-fishing-hud-bar]')) return;
      if (e.button === 0) {
        if (fishingPhase === 'bite') {
          onTriggerFishingAction();
        } else if (fishingPhase === 'fighting') {
          onSetHoldingReel(true);
        }
      }
    };
    const onWinPointerUp = () => {
      if (fishingPhase === 'fighting') {
        onSetHoldingReel(false);
      }
    };
    window.addEventListener('pointerdown', onWinPointerDown);
    window.addEventListener('pointerup', onWinPointerUp);
    return () => {
      window.removeEventListener('pointerdown', onWinPointerDown);
      window.removeEventListener('pointerup', onWinPointerUp);
    };
  }, [fishingPhase, onSetHoldingReel, onTriggerFishingAction]);

  // Mount live 60 FPS Studio Fish Portrait when Catch Card is open (zero WebGL contexts)
  const caughtSpeciesId = lastCaughtFishToast?.speciesId ?? null;
  const caughtColorHex = lastCaughtFishToast?.colorHex ?? null;
  useEffect(() => {
    const canvas = studioCanvasRef.current;
    if (!canvas || !caughtSpeciesId) return;

    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const logicalW = 760;
    const logicalH = 310;
    canvas.width = Math.round(logicalW * dpr);
    canvas.height = Math.round(logicalH * dpr);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    const fishModel = buildTidewaterProceduralFishGroup(
      caughtSpeciesId,
      caughtColorHex || '#38bdf8',
    );

    let rafId = 0;
    const startMs = performance.now();
    const animate = (nowMs: number) => {
      if (typeof document === 'undefined' || !document.hidden) {
        const t = (nowMs - startMs) * 0.001;
        fishModel.updateSwimAnimation(t);
        const entrance = 1 - Math.exp(-t * 5.5);
        fishModel.group.position.x = (1 - entrance) * 0.55;
        fishModel.group.rotation.y = Math.sin(t * 0.85) * 0.38;
        fishModel.group.rotation.z = Math.sin(t * 1.7) * 0.04;
        renderFishGroupTo2dCanvas(ctx2d, fishModel.group, logicalW, logicalH, 2.75, 22);
      }
      rafId = window.requestAnimationFrame(animate);
    };
    rafId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(rafId);
      fishModel.dispose();
    };
  }, [caughtSpeciesId, caughtColorHex]);

  const lengthCm =
    lastCaughtFishToast?.lengthCm ??
    Math.round(
      Math.pow(Math.max(100, (lastCaughtFishToast?.weightKg ?? 1) * 1000) / 0.012, 1 / 3),
    );
  const lengthInches = (lengthCm / 2.54).toFixed(1);
  const weightLb = ((lastCaughtFishToast?.weightKg ?? 1) * 2.20462).toFixed(1);

  // Tidewater `.gm-fight` status callout & color (`GameHUD.js` lines 283-289)
  let fightCallText = 'Reel line';
  let fightCallTone: 'normal' | 'good' | 'warn' = 'normal';
  if (fishingMinigame) {
    if (fishingMinigame.tension > 0.88) {
      fightCallText = 'Release tension!';
      fightCallTone = 'warn';
    } else if (fishingMinigame.isSurging) {
      fightCallText = 'Fish pulling hard!';
      fightCallTone = 'warn';
    } else if (fishingMinigame.tension < 0.15) {
      fightCallText = 'Slack line!';
      fightCallTone = 'warn';
    } else if (
      fishingMinigame.tension >= fishingMinigame.greenBand[0] &&
      fishingMinigame.tension <= fishingMinigame.greenBand[1]
    ) {
      fightCallText = 'Optimal tension';
      fightCallTone = 'good';
    }
  }

  return (
    <>
      {/* =====================================================================
          1. TIDEWATER CENTER-SCREEN `.gm-bite` ("!") & `.gm-cast` POWER PILL
          Exact port of `GameHUD.js` lines 42-49
         ===================================================================== */}
      {nearbyWaterZone.canFish && fishingPhase === 'bite' && (
        <div
          onClick={onTriggerFishingAction}
          className="fixed left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-auto cursor-pointer select-none flex flex-col items-center"
        >
          <span
            style={{
              fontSize: '64px',
              fontWeight: 800,
              lineHeight: 1,
              color: '#ffb86b',
              textShadow: '0 0 22px rgba(255, 184, 107, 0.88), 0 3px 8px rgba(0, 0, 0, 0.65)',
            }}
            className="animate-bounce"
          >
            !
          </span>
        </div>
      )}

      {nearbyWaterZone.canFish && fishingPhase === 'charging' && (
        <div
          style={{
            background: 'rgba(170, 215, 235, 0.16)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
          }}
          className="fixed left-1/2 top-[56%] -translate-x-1/2 z-40 w-[160px] h-[6px] rounded-full overflow-hidden pointer-events-none select-none"
        >
          <span
            style={{
              width: `${Math.round(fishingCastPower * 100)}%`,
              background: 'linear-gradient(90deg, #5fe3d4, #ffb86b)',
            }}
            className="block h-full rounded-full transition-all duration-75"
          />
        </div>
      )}

      {/* =====================================================================
          2. TIDEWATER TRANSLUCENT GLASS `.gm-fight` GAUGE & `.tw-prompt` PILL
          Exact port of `GameHUD.js` lines 25-41 & `ui.css` lines 442-472, 782-805
         ===================================================================== */}
      <div
        data-fishing-hud-bar="true"
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex flex-col items-center gap-1.5 select-none"
      >
        {/* Top transient toast pill (`.tw-toast`) if line snapped or early nibble */}
        {fishingHintMessage && (
          <div
            style={{
              background:
                'linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0) 40%), rgba(12, 18, 26, 0.72)',
              border: '1px solid rgba(170, 215, 235, 0.16)',
              backdropFilter: 'blur(18px) saturate(1.6)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 32px -12px rgba(0,0,0,0.55)',
            }}
            className="flex items-center gap-2.5 px-4 py-2 rounded-full text-[13px] font-medium text-[#eef6f8]"
          >
            <span
              style={{
                background: '#5fe3d4',
                boxShadow: '0 0 8px rgba(95, 227, 212, 0.9)',
              }}
              className="w-1.5 h-1.5 rounded-full shrink-0"
            />
            <span>{fishingHintMessage}</span>
          </div>
        )}

        {/* Tidewater `.gm-fight.tw-glass` Needle-in-Band Tension & Fish Stamina Card */}
        {nearbyWaterZone.canFish && fishingPhase === 'fighting' && fishingMinigame && (
          <div
            data-tidewater-minigame-hud="true"
            onPointerDown={() => onSetHoldingReel(true)}
            onPointerUp={() => onSetHoldingReel(false)}
            onPointerCancel={() => onSetHoldingReel(false)}
            onPointerLeave={() => onSetHoldingReel(false)}
            style={{
              background:
                'linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0) 40%), rgba(12, 18, 26, 0.68)',
              border: '1px solid rgba(170, 215, 235, 0.16)',
              backdropFilter: 'blur(18px) saturate(1.6)',
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 1px 2px rgba(0, 0, 0, 0.25), 0 12px 32px -12px rgba(0, 0, 0, 0.55)',
            }}
            className="w-[340px] sm:w-[370px] px-4 py-3 rounded-2xl text-[#eef6f8] cursor-pointer mb-1"
          >
            {/* `.gm-fight-head`: Callout left, Distance right */}
            <div className="flex items-center justify-between mb-2 text-[13px]">
              <span
                style={{
                  color:
                    fightCallTone === 'warn'
                      ? '#ff7a85'
                      : fightCallTone === 'good'
                        ? '#5fe3d4'
                        : '#eef6f8',
                }}
                className="font-semibold tracking-wide"
              >
                {fightCallText}
              </span>
              <span className="font-mono text-[12.5px] text-[#deecf2]/75">
                {fishingMinigame.distanceM.toFixed(1)} m
              </span>
            </div>

            {/* `.gm-tension`: Rounded capsule with `.gm-band`, `.gm-danger`, `.gm-needle` */}
            <div
              style={{ background: 'rgba(170, 215, 235, 0.12)' }}
              className="relative h-3 rounded-full overflow-visible"
            >
              <div className="absolute inset-0 rounded-full overflow-hidden">
                {/* `.gm-band` [30%..85%] */}
                <span
                  style={{
                    left: `${(fishingMinigame.greenBand[0] / 1.05) * 100}%`,
                    width: `${((fishingMinigame.greenBand[1] - fishingMinigame.greenBand[0]) / 1.05) * 100}%`,
                    background: 'rgba(95, 227, 212, 0.28)',
                    borderLeft: '1px solid rgba(95, 227, 212, 0.65)',
                    borderRight: '1px solid rgba(95, 227, 212, 0.65)',
                  }}
                  className="absolute top-0 bottom-0"
                />
                {/* `.gm-danger` right 12% */}
                <span
                  style={{
                    width: '12%',
                    background: 'rgba(255, 122, 133, 0.38)',
                  }}
                  className="absolute top-0 bottom-0 right-0"
                />
              </div>

              {/* `.gm-needle` */}
              <span
                style={{
                  left: `${Math.max(1, Math.min(99, (Math.min(fishingMinigame.tension, 1.05) / 1.05) * 100))}%`,
                  background:
                    fishingMinigame.tension > fishingMinigame.greenBand[1]
                      ? '#ff7a85'
                      : '#eef6f8',
                  boxShadow:
                    fishingMinigame.tension > fishingMinigame.greenBand[1]
                      ? '0 0 10px #ff7a85'
                      : '0 0 8px rgba(255, 255, 255, 0.7)',
                }}
                className="absolute -top-0.5 -bottom-0.5 w-[3px] -ml-[1.5px] rounded-full transition-[left] duration-75"
              />
            </div>

            {/* `.gm-stamina` */}
            <div className="mt-2.5 flex items-center gap-2.5 text-[11.5px] text-[#c8dee8]/60">
              <span>Fish</span>
              <span
                style={{ background: 'rgba(170, 215, 235, 0.12)' }}
                className="flex-1 h-1 rounded-full overflow-hidden"
              >
                <span
                  style={{
                    width: `${Math.max(0, Math.round(fishingMinigame.stamina * 100))}%`,
                    background: '#ffb86b',
                  }}
                  className="block h-full rounded-full transition-all duration-75"
                />
              </span>
            </div>
          </div>
        )}

        {/* Unified Dark Glassmorphic Fishing Action Pill Bar */}
        {nearbyWaterZone.canFish && (
          <div
            style={{
              background: 'rgba(38, 32, 28, 0.88)',
              backdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(255, 255, 255, 0.75)',
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)',
            }}
            className="inline-flex items-center h-[42px] min-w-[210px] max-w-[340px] rounded-full px-1.5 text-white cursor-pointer hover:brightness-110 transition-all select-none gap-1"
          >
            {/* Fishing rod icon badge */}
            <div className="w-[34px] h-[34px] rounded-full bg-white/14 border-[1.5px] border-white/85 flex items-center justify-center overflow-hidden shrink-0 text-[9.5px] font-black tracking-wider text-[#b8ff3c]">
              ROD
            </div>

            {/* Dynamic Fishing Action Label / Button */}
            <button
              type="button"
              data-cast-fishing-rod-btn="true"
              disabled={
                fishingPhase === 'casting' ||
                (fishingPhase === 'idle' && caughtFishBucketCount >= 20)
              }
              onPointerDown={() => {
                if (fishingPhase === 'fighting') {
                  onSetHoldingReel(true);
                } else if (fishingPhase === 'idle' && caughtFishBucketCount < 20) {
                  onStartChargeCast();
                }
              }}
              onPointerUp={() => {
                if (fishingPhase === 'fighting') {
                  onSetHoldingReel(false);
                } else if (fishingPhase === 'charging') {
                  onReleaseChargeCast();
                }
              }}
              onPointerLeave={() => {
                if (fishingPhase === 'fighting') {
                  onSetHoldingReel(false);
                }
              }}
              onPointerCancel={() => {
                if (fishingPhase === 'fighting') {
                  onSetHoldingReel(false);
                }
              }}
              onClick={onTriggerFishingAction}
              className="flex-1 text-center font-mono font-bold text-[14px] text-white tracking-wide px-2 uppercase truncate bg-transparent border-0 cursor-pointer outline-none focus:outline-none"
            >
              {fishingPhase === 'fighting'
                ? isHoldingReel
                  ? 'REELING...'
                  : 'HOLD CLICK / [F]'
                : fishingPhase === 'bite'
                  ? 'STRIKE! [F]'
                  : fishingPhase === 'charging'
                    ? `${Math.round(fishingCastPower * 100)}%`
                    : fishingPhase === 'casting' || fishingPhase === 'nibble'
                      ? 'WAITING...'
                      : caughtFishBucketCount >= 20
                        ? 'COOLER FULL'
                        : 'CAST [F]'}
            </button>

            {/* Cancel or Chevron Button */}
            {(fishingPhase === 'casting' || fishingPhase === 'nibble') && onCancelCast ? (
              <button
                type="button"
                onClick={onCancelCast}
                className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold text-white/90 hover:text-white bg-white/15 hover:bg-white/25 transition-colors cursor-pointer shrink-0 border-0 uppercase"
              >
                CANCEL
              </button>
            ) : (
              <button
                type="button"
                onClick={onTriggerFishingAction}
                title="Action"
                className="w-6 h-6 flex items-center justify-center text-white/90 hover:text-white font-black text-base shrink-0 border-0 bg-transparent cursor-pointer"
              >
                &gt;
              </button>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          3. TIDEWATER FULL-SCREEN `.gm-catch-scrim` & `.gm-catch` STUDIO SHOWCASE
          Exact port of `GameHUD.js` lines 84-143 (No boxy borders!)
         ===================================================================== */}
      {lastCaughtFishToast && (
        <div
          data-caught-fish-toast="true"
          style={{
            background:
              'radial-gradient(70% 60% at 50% 50%, rgba(10, 22, 34, 0.58) 0%, rgba(4, 9, 15, 0.88) 100%)',
            backdropFilter: 'blur(10px) saturate(0.85)',
          }}
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center px-6 py-8 text-center text-[#f4ead6] pointer-events-auto select-none"
        >
          {/* `.gm-catch-top` */}
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {lastCaughtFishToast.isTrophy ? (
                <span
                  style={{
                    color: '#2a1604',
                    background:
                      'linear-gradient(100deg, #f3cf8a 0%, #d9a441 40%, #fff0cf 50%, #d9a441 60%, #f3cf8a 100%)',
                    boxShadow:
                      '0 0 0 2px rgba(42, 22, 4, 0.35) inset, 0 0 26px rgba(217, 164, 65, 0.55)',
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-extrabold uppercase tracking-[0.22em] -rotate-2"
                >
                  ★ Trophy Record
                </span>
              ) : (
                <span
                  style={{
                    color: '#062420',
                    background: '#6fd6c6',
                    boxShadow:
                      '0 0 0 2px rgba(6, 36, 32, 0.3) inset, 0 0 22px rgba(111, 214, 198, 0.45)',
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-extrabold uppercase tracking-[0.22em] -rotate-2"
                >
                  {lastCaughtFishToast.rarity} Catch
                </span>
              )}
            </div>

            <h2
              style={{
                color: '#fbf1dc',
                textShadow: '0 2px 0 rgba(0, 0, 0, 0.35), 0 8px 30px rgba(0, 0, 0, 0.45)',
              }}
              className="text-4xl sm:text-6xl font-bold tracking-tight leading-none m-0"
            >
              {lastCaughtFishToast.speciesName}
            </h2>
            <div className="mt-1.5 italic text-[#f4ead6]/65 text-sm sm:text-base">
              {lastCaughtFishToast.waterZoneLabel}
            </div>
          </div>

          {/* `.gm-catch-stage`: Live 3D Studio Fish Portrait floating in softbox light */}
          <div className="relative w-full max-w-[760px] h-[220px] sm:h-[260px] my-2 flex items-center justify-center">
            <div
              style={{
                background: 'radial-gradient(closest-side, rgba(0, 0, 0, 0.5), transparent)',
              }}
              className="absolute inset-x-[12%] bottom-[6%] h-[16%] rounded-full pointer-events-none"
            />
            <canvas
              ref={studioCanvasRef}
              width={760}
              height={310}
              style={{
                WebkitMaskImage:
                  'linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)',
                maskImage:
                  'linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)',
              }}
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>

          {/* `.gm-catch-bottom`: 3 Warm Translucent Stat Cards (`Length`, `Weight`, `Value`) */}
          <div className="flex flex-col items-center">
            <div className="flex flex-wrap justify-center gap-3 sm:gap-5 mt-1">
              <div
                style={{
                  background:
                    'linear-gradient(180deg, rgba(232, 220, 192, 0.12), rgba(232, 220, 192, 0.05))',
                  boxShadow:
                    'inset 0 0 0 1px rgba(214, 180, 110, 0.38), 0 10px 30px rgba(0, 0, 0, 0.25)',
                }}
                className="min-w-[110px] sm:min-w-[136px] px-4 py-2.5 rounded-md"
              >
                <span className="block text-[10.5px] font-bold uppercase tracking-[0.22em] text-[#debe7d]/90">
                  Length
                </span>
                <b className="block mt-1 font-mono text-2xl sm:text-3xl font-semibold text-[#fbf1dc]">
                  {lengthCm}
                  <small className="text-sm font-medium text-[#f4ead6]/70 ml-1">cm</small>
                </b>
                <i className="block not-italic font-mono text-xs text-[#f4ead6]/50 mt-0.5">
                  {lengthInches} in
                </i>
              </div>

              <div
                style={{
                  background:
                    'linear-gradient(180deg, rgba(232, 220, 192, 0.12), rgba(232, 220, 192, 0.05))',
                  boxShadow:
                    'inset 0 0 0 1px rgba(214, 180, 110, 0.38), 0 10px 30px rgba(0, 0, 0, 0.25)',
                }}
                className="min-w-[110px] sm:min-w-[136px] px-4 py-2.5 rounded-md"
              >
                <span className="block text-[10.5px] font-bold uppercase tracking-[0.22em] text-[#debe7d]/90">
                  Weight
                </span>
                <b className="block mt-1 font-mono text-2xl sm:text-3xl font-semibold text-[#fbf1dc]">
                  {lastCaughtFishToast.weightKg.toFixed(2)}
                  <small className="text-sm font-medium text-[#f4ead6]/70 ml-1">kg</small>
                </b>
                <i className="block not-italic font-mono text-xs text-[#f4ead6]/50 mt-0.5">
                  {weightLb} lb
                </i>
              </div>

              <div
                style={{
                  background:
                    'linear-gradient(180deg, rgba(232, 220, 192, 0.12), rgba(232, 220, 192, 0.05))',
                  boxShadow:
                    'inset 0 0 0 1px rgba(214, 180, 110, 0.38), 0 10px 30px rgba(0, 0, 0, 0.25)',
                }}
                className="min-w-[110px] sm:min-w-[136px] px-4 py-2.5 rounded-md"
              >
                <span className="block text-[10.5px] font-bold uppercase tracking-[0.22em] text-[#debe7d]/90">
                  Kai Sell Value
                </span>
                <b className="block mt-1 font-mono text-2xl sm:text-3xl font-semibold text-[#facc15]">
                  +{lastCaughtFishToast.sellValueLul || lastCaughtFishToast.sellValueCyon}
                  <small className="text-sm font-medium text-[#f4ead6]/70 ml-1">LUL</small>
                </b>
                <i className="block not-italic font-mono text-xs text-[#f4ead6]/50 mt-0.5">
                  Sell to Kai (Swap LUL &rarr; CYON)
                </i>
              </div>
            </div>

            {/* Rounded Pill Action Buttons (`.gm-btn`) */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
              <button
                type="button"
                data-keep-fish-btn="true"
                onClick={onKeepCaughtFish}
                style={{ background: '#5fe3d4', color: '#0b1418' }}
                className="px-5 py-2 rounded-full text-[13px] font-semibold cursor-pointer hover:brightness-110 transition-all"
              >
                Keep in Bag
              </button>

              {!lastCaughtFishToast.isMintedNft && (
                <button
                  type="button"
                  data-showcase-sell-fish-btn="true"
                  onClick={() => onSellCaughtFishToKai(lastCaughtFishToast)}
                  style={{
                    background: 'rgba(250, 204, 21, 0.22)',
                    border: '1px solid rgba(250, 204, 21, 0.72)',
                    color: '#fef9c3',
                  }}
                  className="px-5 py-2 rounded-full text-[13px] font-bold cursor-pointer hover:bg-amber-400/35 transition-all"
                >
                  Sell (+{lastCaughtFishToast.sellValueLul || lastCaughtFishToast.sellValueCyon}{' '}
                  LUL)
                </button>
              )}

              {!lastCaughtFishToast.isMintedNft ? (
                walletConnected ? (
                  <button
                    type="button"
                    data-showcase-mint-fish-btn="true"
                    disabled={isMintingShowcaseNft}
                    onClick={async () => {
                      setShowcaseMintError(null);
                      setIsMintingShowcaseNft(true);
                      try {
                        const ok = await onMintCaughtFishAsNft(lastCaughtFishToast);
                        if (ok === false) {
                          setShowcaseMintError(
                            'Connect your wallet to mint this catch as an NFT.',
                          );
                        }
                      } finally {
                        setIsMintingShowcaseNft(false);
                      }
                    }}
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(216, 180, 254, 0.3), rgba(168, 85, 247, 0.2))',
                      border: '1px solid rgba(216, 180, 254, 0.6)',
                      color: '#f3e8ff',
                    }}
                    className="px-5 py-2 rounded-full text-[13px] font-bold cursor-pointer hover:bg-purple-500/40 disabled:opacity-60 transition-all"
                  >
                    {isMintingShowcaseNft ? 'Minting...' : 'Mint NFT'}
                  </button>
                ) : (
                  <button
                    type="button"
                    data-showcase-guest-register-btn="true"
                    onClick={() => {
                      if (onRequestRegisterWallet) {
                        onRequestRegisterWallet();
                      } else {
                        setShowcaseMintError(
                          'Sign in first to mint Fish NFTs.',
                        );
                      }
                    }}
                    style={{
                      background: 'rgba(184, 255, 60, 0.2)',
                      border: '1px solid rgba(184, 255, 60, 0.65)',
                      color: '#d9f99d',
                    }}
                    className="px-5 py-2 rounded-full text-[13px] font-bold cursor-pointer hover:bg-lime-400/30 transition-all"
                  >
                    Sign in to Mint
                  </button>
                )
              ) : (
                <span className="px-4 py-2 rounded-full text-[12px] font-mono font-bold bg-emerald-500/25 border border-emerald-400/70 text-emerald-200">
                  Minted NFT{' '}
                  {lastCaughtFishToast.nearTxHash && (
                    <a
                      href={`https://testnet.nearblocks.io/txns/${lastCaughtFishToast.nearTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline ml-1 text-[#5fe3d4]"
                    >
                      Receipt
                    </a>
                  )}
                </span>
              )}

              <button
                type="button"
                data-toast-release-fish-btn="true"
                onClick={() => onReleaseCaughtFish(lastCaughtFishToast)}
                style={{
                  background: 'rgba(170, 215, 235, 0.08)',
                  border: '1px solid rgba(170, 215, 235, 0.18)',
                  color: 'rgba(222, 236, 242, 0.76)',
                }}
                className="px-4 py-2 rounded-full text-[13px] font-medium cursor-pointer hover:text-white hover:bg-white/15 transition-all"
              >
                Release
              </button>
            </div>
            {showcaseMintError && (
              <div className="mt-2.5 text-center text-xs font-mono text-rose-300">
                {showcaseMintError}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
