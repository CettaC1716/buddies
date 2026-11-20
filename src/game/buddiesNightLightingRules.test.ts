import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  attachClearStorefrontGlassNightShader,
  computeDeterministicWindowSeed,
  computeManifestWindowIntensityScale,
  computeManifestWindowPhaseOffset,
  evaluateStaggeredNightWindowGlow,
  evaluateStorefrontDisplayGlow,
  getCityWindowNightLightingRegistrySize,
  invalidateCityWindowNightLightingCache,
  tagCityWindowInstancedMesh,
  tagCityWindowMesh,
  updateCityWindowNightLighting,
} from './buddiesNightLightingRules';
import { buildFashionAndApparelKiosk3D } from './buddiesFashionKioskBuilder';
import { buildRealEstateAndFurnitureKiosk3D } from './buddiesRealEstateKioskBuilder';
import {
  buildCurvedBakeryDisplayCase,
  createDefaultCafeAssetStyler,
  createFrostedConservatoryGlassMaterial,
  createUnifiedPlazaAndConservatoryGlassMaterial,
} from './buddiesLShapedCafeAssets';
import { CITY_BUILDING_GLOW_MANIFEST } from './buddiesCityLightingAndTrafficRules';

function makeStripGeo(pts: [number, number][], width: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(Math.max(0.1, pts.length * 0.2), 0.1, width);
}

describe('Dynamic Night Window & Storefront Lighting Rules (Workstream 2)', () => {
  it('computes deterministic non-negative integer window seeds and manifest phases', () => {
    const a = computeDeterministicWindowSeed('tower_south_win', 2, 1);
    const b = computeDeterministicWindowSeed('tower_south_win', 2, 1);
    const c = computeDeterministicWindowSeed('tower_south_win', 2, 2);
    const d = computeDeterministicWindowSeed('tower_south_win', 3, 1);
    const e = computeDeterministicWindowSeed('tower_north_win', 2, 1);

    assert.equal(a, b);
    assert.ok(Number.isInteger(a) && a >= 0);
    assert.notEqual(a, c);
    assert.notEqual(a, d);
    assert.notEqual(a, e);

    const p1 = computeManifestWindowPhaseOffset('glow_civic_front_win_w');
    const p2 = computeManifestWindowPhaseOffset('glow_civic_front_win_w');
    const p3 = computeManifestWindowPhaseOffset('glow_civic_front_win_e');
    assert.equal(p1, p2);
    assert.ok(p1 >= 0 && p1 < Math.PI * 2);
    assert.notEqual(p1, p3);
    const s1 = computeManifestWindowIntensityScale('glow_civic_front_win_w', 0.98);
    assert.ok(s1 >= 0.8 && s1 <= 1.2);
  });

  it('guarantees zero emissive blow-out during daytime (nightFactor01 <= 0.05)', () => {
    const kinds = ['upper_floor', 'civic', 'dormer'] as const;
    for (const night of [0, 0.01, 0.03, 0.05]) {
      for (const kind of kinds) {
        for (let i = 0; i < 60; i++) {
          const seed = computeDeterministicWindowSeed(`day_win_${kind}`, Math.floor(i / 6), i % 6);
          const ev = evaluateStaggeredNightWindowGlow(seed, night, i * 1.3, kind);
          assert.equal(ev.emissiveIntensity, 0, `Expected zero daytime emissive for ${kind} at night=${night}`);
          assert.equal(ev.emissiveHex, '#000000');
          assert.equal(ev.isLit, false);
          assert.equal(ev.roomState, 'off');
          assert.ok(ev.tintHex.startsWith('#') && ev.tintHex.length === 7);
        }
      }
      const shopEval = evaluateStorefrontDisplayGlow(12345, night, 10, false);
      assert.equal(shopEval.emissiveIntensity, 0);
      assert.equal(shopEval.isNightActive, false);
    }
  });

  it('produces staggered dusk fade-in and realistic ~65-80% night occupancy across all room states', () => {
    const seeds = Array.from({ length: 240 }, (_, idx) =>
      computeDeterministicWindowSeed('apt_block', Math.floor(idx / 10), idx % 10),
    );

    const stateCounts = new Map<string, number>();
    let litCountNight = 0;
    for (const seed of seeds) {
      const ev = evaluateStaggeredNightWindowGlow(seed, 1.0, 12.5, 'upper_floor');
      stateCounts.set(ev.roomState, (stateCounts.get(ev.roomState) ?? 0) + 1);
      if (ev.isLit) {
        litCountNight++;
        assert.ok(ev.emissiveIntensity >= 0.22 && ev.emissiveIntensity <= 1.05);
      } else {
        assert.equal(ev.emissiveIntensity, 0);
      }
    }

    const occupancy = litCountNight / seeds.length;
    assert.ok(
      occupancy >= 0.65 && occupancy <= 0.80,
      `Expected realistic 65-80% night occupancy, got ${(occupancy * 100).toFixed(1)}%`,
    );
    assert.ok((stateCounts.get('on') ?? 0) > 0, 'Expected "on" rooms');
    assert.ok((stateCounts.get('warm-amber') ?? 0) > 0, 'Expected "warm-amber" rooms');
    assert.ok((stateCounts.get('dim') ?? 0) > 0, 'Expected "dim" rooms');
    assert.ok((stateCounts.get('off') ?? 0) > 0, 'Expected "off" rooms');

    // Verify smooth staggered turn-on during dusk ramp
    const duskStops = [0.05, 0.14, 0.26, 0.42, 0.65, 1.0];
    let prevLit = -1;
    let prevSumIntensity = -1;
    for (const stop of duskStops) {
      let litAtStop = 0;
      let sumIntensity = 0;
      for (const seed of seeds) {
        const ev = evaluateStaggeredNightWindowGlow(seed, stop, 0, 'upper_floor');
        if (ev.isLit) litAtStop++;
        sumIntensity += ev.emissiveIntensity;
      }
      assert.ok(litAtStop >= prevLit, `Lit count should grow monotonically at night=${stop}`);
      assert.ok(sumIntensity >= prevSumIntensity, `Total emissive should grow monotonically at night=${stop}`);
      prevLit = litAtStop;
      prevSumIntensity = sumIntensity;
    }
    assert.ok(prevLit > 0 && prevLit < seeds.length, 'Mix of lit and off windows at night');
  });

  it('keeps storefront and conservatory glass balanced without washing out interiors', () => {
    const shopNight = evaluateStorefrontDisplayGlow(42, 1.0, 5.0, false);
    assert.equal(shopNight.isNightActive, true);
    assert.ok(shopNight.emissiveIntensity > 0 && shopNight.emissiveIntensity <= 0.10);
    assert.ok(shopNight.glassOpacity <= 0.34, 'Clear storefront glass must remain highly transparent');

    const conservatoryNight = evaluateStorefrontDisplayGlow(42, 1.0, 5.0, true);
    assert.ok(conservatoryNight.emissiveIntensity > 0 && conservatoryNight.emissiveIntensity <= 0.20);
    assert.ok(conservatoryNight.glassOpacity <= 0.48);
  });

  it('updates MeshStandardMaterial, ShaderMaterial, and InstancedMesh windows cleanly with zero per-frame allocations', () => {
    const root = new THREE.Group();

    // Shared MeshStandardMaterial across two upper-floor seeds -> split once at init
    const sharedWinMat = new THREE.MeshStandardMaterial({ color: '#c4e4fa' });
    const winMeshA = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.5), sharedWinMat);
    const seedOn = Array.from({ length: 100 }, (_, i) => i + 1).find(
      (s) => evaluateStaggeredNightWindowGlow(s, 1.0, 0).roomState === 'on',
    )!;
    const seedOff = Array.from({ length: 100 }, (_, i) => i + 1).find(
      (s) => evaluateStaggeredNightWindowGlow(s, 1.0, 0).roomState === 'off',
    )!;
    tagCityWindowMesh(winMeshA, { id: 'win_a', kind: 'upper_floor', seed: seedOn });
    const winMeshB = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.5), sharedWinMat);
    tagCityWindowMesh(winMeshB, { id: 'win_b', kind: 'upper_floor', seed: seedOff });

    // Upgrade shader style (`uEmissive` + `uBaseColor`)
    const worldShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uEmissive: { value: new THREE.Color('#000000') },
        uBaseColor: { value: new THREE.Color('#a9d5f2') },
        uLightDirection: { value: new THREE.Vector3(0.4, 0.9, 0.3) },
        uLightColor: { value: new THREE.Color('#ffffff') },
      },
    });
    const winMeshShader = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.5), worldShaderMat);
    tagCityWindowMesh(winMeshShader, { id: 'win_shader', kind: 'civic', seed: seedOn });

    // Unified glass shader (`cityGlassNightUniform`)
    const unifiedGlassMat = createUnifiedPlazaAndConservatoryGlassMaterial();
    const cafeGlassMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), unifiedGlassMat);

    // InstancedMesh Casino / Plaza block
    const instMat = new THREE.MeshStandardMaterial({ color: '#c4e4fa' });
    const instMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 2), instMat, 2);
    tagCityWindowInstancedMesh(instMesh, [
      { id: 'inst_on', kind: 'upper_floor', seed: seedOn, baseColorHex: '#c4e4fa' },
      { id: 'inst_off', kind: 'upper_floor', seed: seedOff, baseColorHex: '#c4e4fa' },
    ]);

    root.add(winMeshA, winMeshB, winMeshShader, cafeGlassMesh, instMesh);

    // Daytime warmup
    const updatedDay = updateCityWindowNightLighting(root, 0.02, 0.0);
    assert.ok(updatedDay >= 4);
    assert.ok(getCityWindowNightLightingRegistrySize(root) >= 5);

    const matA = winMeshA.material as THREE.MeshStandardMaterial;
    const matB = winMeshB.material as THREE.MeshStandardMaterial;
    assert.notEqual(matA, matB, 'Distinct upper_floor seeds should clone shared material once');
    assert.equal(matA.emissiveIntensity, 0);
    assert.equal(matB.emissiveIntensity, 0);
    assert.equal(worldShaderMat.uniforms.uEmissive.value.r, 0);
    assert.equal(unifiedGlassMat.userData.cityGlassNightUniform.value, 0.02);

    // Verify zero instance color squaring on initialization
    const dayCol0 = new THREE.Color();
    instMesh.getColorAt(0, dayCol0);
    const expectedDay = new THREE.Color('#c4e4fa');
    assert.ok(Math.abs(dayCol0.r - expectedDay.r) < 1e-3 && Math.abs(dayCol0.b - expectedDay.b) < 1e-3);

    // Night update
    updateCityWindowNightLighting(root, 1.0, 2.0);
    assert.ok(matA.emissiveIntensity > 0.5, 'Lit room must glow brightly at night');
    assert.equal(matB.emissiveIntensity, 0, 'Unlit room must stay dark at night');
    assert.ok(worldShaderMat.uniforms.uEmissive.value.r > 0.3, 'ShaderMaterial uEmissive should glow');
    assert.equal(unifiedGlassMat.userData.cityGlassNightUniform.value, 1.0);

    const nightColOn = new THREE.Color();
    const nightColOff = new THREE.Color();
    instMesh.getColorAt(0, nightColOn);
    instMesh.getColorAt(1, nightColOff);
    assert.ok(nightColOn.r > nightColOff.r * 2.0, 'InstancedMesh should light active panes vs dark ones');

    // Capture references after warmup and assert strictly zero reference replacement across 120 frames
    const emissiveObjRefA = matA.emissive;
    const colorObjRefA = matA.color;
    const shaderEmissiveRef = worldShaderMat.uniforms.uEmissive.value;
    const instColorRef = instMesh.instanceColor;
    const instArrayRef = instMesh.instanceColor?.array;

    for (let f = 0; f < 120; f++) {
      updateCityWindowNightLighting(root, 0.5 + 0.45 * Math.sin(f * 0.05), f * 0.016);
      assert.equal(winMeshA.material, matA);
      assert.equal(matA.emissive, emissiveObjRefA);
      assert.equal(matA.color, colorObjRefA);
      assert.equal(worldShaderMat.uniforms.uEmissive.value, shaderEmissiveRef);
      assert.equal(instMesh.instanceColor, instColorRef);
      assert.equal(instMesh.instanceColor?.array, instArrayRef);
    }

    invalidateCityWindowNightLightingCache(root);
  });

  it('tags Fashion & Real Estate kiosk storefront glass with frame-fitted bounds & balanced day/night response', () => {
    const westPlantGroup = new THREE.Group();
    const sharedClearGlassMat = new THREE.MeshStandardMaterial({
      color: '#d6f4ff',
      transparent: true,
      opacity: 0.30,
    });
    const commonOpts = {
      westPlantGroup,
      isSoftwareGl: true,
      sharedClearGlassMat,
      createMitredPolylineStripGeometry: makeStripGeo,
      addLobbyPart: (
        parent: THREE.Object3D,
        geo: THREE.BufferGeometry,
        colorHex: string,
        pos: [number, number, number],
        rot: [number, number, number] = [0, 0, 0],
      ) => {
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colorHex }));
        mesh.position.set(pos[0], pos[1], pos[2]);
        mesh.rotation.set(rot[0], rot[1], rot[2]);
        parent.add(mesh);
        return mesh;
      },
      createBlitzStrokeMesh: () => null,
      textures: {},
    };

    const fashionGrp = buildFashionAndApparelKiosk3D(commonOpts);
    const realEstateGrp = buildRealEstateAndFurnitureKiosk3D(commonOpts);

    for (const [label, grp, expectedMinPanes] of [
      ['FashionKiosk', fashionGrp, 7],
      ['RealEstateKiosk', realEstateGrp, 6],
    ] as const) {
      let glassPaneCount = 0;
      grp.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.userData?.cityWindowSpec) {
          glassPaneCount++;
          assert.equal(obj.userData.cityWindowSpec.kind, 'storefront');
          assert.equal(obj.material, sharedClearGlassMat, `${label} must share clear glass material`);
          const geo = obj.geometry as THREE.PlaneGeometry;
          const w = geo.parameters?.width ?? 0;
          if (Math.abs(obj.position.z - 1.54) < 0.01 && obj.position.x < -1.0) {
            // Front-left bay spans [-2.04 .. -0.775] = 1.265m clear inside corner post & mullion
            const halfW = w * 0.5;
            assert.ok(
              obj.position.x - halfW >= -2.04 && obj.position.x + halfW <= -0.775,
              `${label} front-left pane exceeds mullion bounds`,
            );
          }
          if (Math.abs(obj.position.x - 2.14) < 0.01) {
            // Side bays must fit inside 0.87m / 0.905m clear gaps between mullions
            assert.ok(w <= 0.895, `${label} north side pane ${w} exceeds bay clearance`);
          }
        }
      });
      assert.equal(glassPaneCount, expectedMinPanes);

      updateCityWindowNightLighting(grp, 0.03, 0);
      assert.equal(sharedClearGlassMat.emissiveIntensity, 0, `${label} daytime glass emissive must be 0`);
      updateCityWindowNightLighting(grp, 1.0, 3);
      assert.ok(
        sharedClearGlassMat.emissiveIntensity > 0 && sharedClearGlassMat.emissiveIntensity <= 0.10,
        `${label} night storefront glass glow must remain subtle without washing out interiors`,
      );
    }
  });

  it('preserves zero draw-call bloat and updates night uniforms on L-Shaped Cafe glass assets', () => {
    const styler = createDefaultCafeAssetStyler();
    const bakeryCase = buildCurvedBakeryDisplayCase(styler);
    const glassMesh = bakeryCase.getObjectByName('CafeBakeryDisplayCaseGlass') as THREE.Mesh | undefined;
    assert.ok(glassMesh);
    assert.equal(glassMesh?.userData?.cityWindowSpec?.kind, 'storefront');

    const frostedMat = createFrostedConservatoryGlassMaterial();
    assert.ok(frostedMat.userData.cityGlassNightUniform);
    const unifiedMat = createUnifiedPlazaAndConservatoryGlassMaterial();
    assert.ok(unifiedMat.userData.cityGlassNightUniform);
    assert.equal(unifiedMat.userData.preserveSharedMaterial, true);

    const testGroup = new THREE.Group();
    testGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unifiedMat));
    updateCityWindowNightLighting(testGroup, 0.88, 4.2);
    assert.equal(unifiedMat.userData.cityGlassNightUniform.value, 0.88);
  });

  it('eliminates misaligned/floating/blocking/duplicate glow panes in CITY_BUILDING_GLOW_MANIFEST', () => {
    assert.ok(CITY_BUILDING_GLOW_MANIFEST.length >= 30);
    const ids = new Set<string>();
    const forbiddenBuildings = new Set([
      'glasshouse_cafe',
      'taman_ria_bumper',
      'taman_ria_stalls',
      'urban_plaza_cafe',
      'urban_plaza_boutique',
      'grand_casino',
    ]);

    for (const pane of CITY_BUILDING_GLOW_MANIFEST) {
      assert.ok(!ids.has(pane.id), `Duplicate manifest id ${pane.id}`);
      ids.add(pane.id);
      assert.ok(!forbiddenBuildings.has(pane.building), `Conflicting/duplicate manifest entry left for ${pane.building}`);
      assert.equal(
        pane.phaseOffset,
        computeManifestWindowPhaseOffset(pane.id),
        `Expected deterministic phaseOffset for ${pane.id}`,
      );
      assert.ok(pane.phaseOffset >= 0 && pane.phaseOffset < Math.PI * 2);

      // Model Estate House rear panes must sit proud of outer wall faces
      if (pane.id.startsWith('glow_model_house_rear_clerestory_')) {
        assert.ok(pane.z > 94.502, `${pane.id} must clear rear clerestory glass 94.502`);
      }
      if (pane.id.startsWith('glow_model_house_rear_transom_')) {
        assert.ok(pane.z > 94.767, `${pane.id} must clear rear transom glass 94.767`);
      }
    }

    // Halte windbreak route glass coordinates
    const halteCentral = CITY_BUILDING_GLOW_MANIFEST.find((p) => p.id === 'glow_halte_central');
    assert.ok(halteCentral && Math.abs(halteCentral.x - -56.842) < 0.02 && Math.abs(halteCentral.y - 2.28) < 0.02);

    // Municipal clock glow diagonal must fit strictly inside dial circle radius (0.58 * 1.42 = 0.8236)
    const civicClock = CITY_BUILDING_GLOW_MANIFEST.find((p) => p.id === 'glow_civic_clock_front');
    assert.ok(civicClock && Math.hypot(civicClock.width * 0.5, civicClock.height * 0.5) < 0.58 * 1.42);
  });

  it('equips shared clear storefront glass with zero-draw-call night curtain & Fresnel reflection shader', () => {
    const clearMat = new THREE.MeshStandardMaterial({
      color: '#d6f4ff',
      transparent: true,
      opacity: 0.30,
      depthWrite: false,
    });
    attachClearStorefrontGlassNightShader(clearMat, { yMin: 0.82, yMax: 4.07 });

    assert.equal(clearMat.userData.preserveSharedMaterial, true);
    assert.equal(clearMat.userData.cityClearStorefrontGlassHooked, true);
    assert.equal(clearMat.userData.cityGlassNightUniform?.value, 0.0);
    assert.equal(clearMat.customProgramCacheKey(), 'city-clear-storefront-glass-v1');

    // Mock Three.js shader compilation hook
    const mockShader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
      fragmentShader: '#include <common>\nvoid main() {\n#include <opaque_fragment>\n}',
    };
    clearMat.onBeforeCompile(mockShader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    assert.equal(mockShader.uniforms.uNightFactor01, clearMat.userData.cityGlassNightUniform);
    assert.equal(mockShader.uniforms.uSfYMin.value, 0.82);
    assert.equal(mockShader.uniforms.uSfYMax.value, 4.07);
    assert.ok(mockShader.vertexShader.includes('vSfGlassWorldPos'));
    assert.ok(mockShader.fragmentShader.includes('sfTopCurtain'));
    assert.ok(mockShader.fragmentShader.includes('sfFresnel'));
    assert.ok(mockShader.fragmentShader.includes('sfNightFade'));

    const group = new THREE.Group();
    const paneA = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.024), clearMat);
    const paneB = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.024), clearMat);
    tagCityWindowMesh(paneA, { id: 'storefront-a', kind: 'storefront', seed: 101 });
    tagCityWindowMesh(paneB, { id: 'storefront-b', kind: 'storefront', seed: 202 });
    group.add(paneA, paneB);

    updateCityWindowNightLighting(group, 0.03, 0.0);
    assert.equal(clearMat.userData.cityGlassNightUniform.value, 0.03);
    assert.equal(paneA.material, clearMat);
    assert.equal(paneB.material, clearMat);

    updateCityWindowNightLighting(group, 1.0, 4.5);
    assert.equal(clearMat.userData.cityGlassNightUniform.value, 1.0);
    assert.equal(paneA.material, clearMat);
    assert.equal(paneB.material, clearMat);
    assert.equal(clearMat.transparent, true);
    assert.equal(clearMat.depthWrite, false);

    invalidateCityWindowNightLightingCache(group);
    clearMat.dispose();
  });
});
