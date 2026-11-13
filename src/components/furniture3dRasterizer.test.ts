import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  prepareStudioFurnitureGroup,
  rasterizeTexturedGroupToBuffer,
} from './furniture3dRasterizer';
import { buildOriginalBuddiesCatalogFurnitureMesh } from '../game/buddiesInteriorAssets';

function countNonWhiteOpaquePixels(pixels: Uint8ClampedArray): {
  opaqueCount: number;
  nonWhiteCount: number;
  uniqueColors: number;
} {
  let opaqueCount = 0;
  let nonWhiteCount = 0;
  const colorSet = new Set<number>();

  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a > 20) {
      opaqueCount++;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      if (r < 245 || g < 245 || b < 245) {
        nonWhiteCount++;
      }
      colorSet.add(((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2));
    }
  }

  return { opaqueCount, nonWhiteCount, uniqueColors: colorSet.size };
}

test('skips BackSide ShaderMaterial outline shells so inner colored wood mesh remains visible', () => {
  const grp = new THREE.Group();
  const innerGeo = new THREE.BoxGeometry(1, 1, 1);
  const innerMat = new THREE.MeshStandardMaterial({ color: '#b8763e', roughness: 0.6 });
  grp.add(new THREE.Mesh(innerGeo, innerMat));

  // Un-extruded BackSide ShaderMaterial (mirrors createBlitzStrokeMesh without GPU vertex extrusion)
  const strokeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
  });
  grp.add(new THREE.Mesh(innerGeo, strokeMat));

  const wrapper = prepareStudioFurnitureGroup(grp, 1.48);
  wrapper.rotation.set(0.24, 0.62, 0);

  const w = 96;
  const h = 64;
  const pixels = new Uint8ClampedArray(w * h * 4);
  rasterizeTexturedGroupToBuffer(wrapper, pixels, w, h, 2.9, 24);

  const stats = countNonWhiteOpaquePixels(pixels);
  assert.ok(stats.opaqueCount > 200, 'should draw box pixels');
  assert.equal(
    stats.nonWhiteCount,
    stats.opaqueCount,
    'all box pixels should have warm wood color instead of white ShaderMaterial overwrite',
  );
});

test('samples UV CanvasTexture/DataTexture maps with RepeatWrapping for visible grain contrast', () => {
  const texW = 16;
  const texH = 16;
  const texData = new Uint8Array(texW * texH * 4);
  for (let y = 0; y < texH; y++) {
    for (let x = 0; x < texW; x++) {
      const idx = (y * texW + x) * 4;
      const isDarkBand = (y & 2) === 0;
      texData[idx] = isDarkBand ? 120 : 210;
      texData[idx + 1] = isDarkBand ? 78 : 165;
      texData[idx + 2] = isDarkBand ? 38 : 104;
      texData[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(texData, texW, texH, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  // Material base color is #ffffff (exactly like BUDDIES_SLOT_MATERIALS.joinery!)
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: tex,
    roughness: 0.48,
  });
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 1), mat));

  const wrapper = prepareStudioFurnitureGroup(grp, 1.48);
  wrapper.rotation.set(0.35, 0.55, 0);

  const w = 120;
  const h = 80;
  const pixels = new Uint8ClampedArray(w * h * 4);
  rasterizeTexturedGroupToBuffer(wrapper, pixels, w, h, 2.8, 24);

  const stats = countNonWhiteOpaquePixels(pixels);
  assert.ok(stats.opaqueCount > 400, 'should rasterize textured table mesh');
  assert.ok(
    stats.nonWhiteCount > stats.opaqueCount * 0.9,
    `textured wood should not wash out to pure white (${stats.nonWhiteCount}/${stats.opaqueCount})`,
  );
  assert.ok(
    stats.uniqueColors >= 6,
    `wood grain texture should produce distinct tonal shades (got ${stats.uniqueColors})`,
  );
});

test('renders wireframe hologram meshes with crisp colored lines', () => {
  const grp = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#00f5d4', wireframe: true }),
  );
  grp.add(sphere);

  const wrapper = prepareStudioFurnitureGroup(grp, 1.48);
  const w = 120;
  const h = 80;
  const pixels = new Uint8ClampedArray(w * h * 4);
  rasterizeTexturedGroupToBuffer(wrapper, pixels, w, h, 2.9, 24);

  let cyanPixels = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] > 200 && pixels[i + 1] > 200 && pixels[i + 2] > 180 && pixels[i] < 60) {
      cyanPixels++;
    }
  }
  assert.ok(cyanPixels > 120, `expected cyan wireframe pixels, got ${cyanPixels}`);
});

test('renders all procedural catalog furniture items with rich non-white colors', () => {
  const furnitureIds = [
    'tatami_tea_table',
    'sakura_bonsai_pot',
    'shoji_floor_lamp',
    'tactical_sofa_lounge',
    'arcade_blitz_cab',
    'nft_golden_katana_rack',
    'nft_holo_command_globe',
  ];

  for (const id of furnitureIds) {
    const meshGroup = buildOriginalBuddiesCatalogFurnitureMesh(id);
    const wrapper = prepareStudioFurnitureGroup(meshGroup, 1.48);
    wrapper.rotation.set(0.24, 0.62, 0);

    const w = 160;
    const h = 100;
    const pixels = new Uint8ClampedArray(w * h * 4);
    const drawn = rasterizeTexturedGroupToBuffer(wrapper, pixels, w, h, 2.9, 24);
    const stats = countNonWhiteOpaquePixels(pixels);

    assert.ok(drawn > 10, `${id} should emit projected triangles`);
    assert.ok(stats.opaqueCount > 150, `${id} should fill visible pixels (got ${stats.opaqueCount})`);
    assert.ok(
      stats.nonWhiteCount > stats.opaqueCount * 0.65,
      `${id} must show colored/shaded surfaces instead of stark white (${stats.nonWhiteCount}/${stats.opaqueCount})`,
    );
  }
});
