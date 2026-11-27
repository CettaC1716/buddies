import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildAdjacentWindowObstacle,
  computeAuditedFacadeWindowTransform,
  createCityWindowSpec,
  rotateOutwardAxisDeg,
  rotateVectorYDeg,
  tagCityWindowInstancedMesh,
  tagCityWindowMesh,
  validateFacadeWindowBounds,
  wallNormalToVector,
  type BlockRotationDeg,
  type FacadeWallBounds,
  type WallNormalAxis,
} from './buddiesWindowAuditRules';

const ALL_AXES: readonly WallNormalAxis[] = ['+X', '-X', '+Z', '-Z'];
const ALL_ROTATIONS: readonly BlockRotationDeg[] = [0, 90, 180, 270];

test('computeAuditedFacadeWindowTransform computes depth*0.5+flushClearance across all 4 walls, 4 local outward conventions, and 0/90/180/270 rotations without sign inversion', () => {
  const wallAnchors: Record<WallNormalAxis, readonly [number, number, number]> = {
    '+X': [4.2, 2.5, 1.0],
    '-X': [-4.2, 2.5, -1.0],
    '+Z': [1.25, 2.5, 3.6],
    '-Z': [-1.25, 2.5, -3.6],
  };

  for (const wallNormal of ALL_AXES) {
    const anchor = wallAnchors[wallNormal];
    const [nx, , nz] = wallNormalToVector(wallNormal);
    for (const localOutwardAxis of ALL_AXES) {
      const [lx, , lz] = wallNormalToVector(localOutwardAxis);
      for (const deg of ALL_ROTATIONS) {
        const res = computeAuditedFacadeWindowTransform({
          wallFacePos: anchor,
          wallNormal,
          depth: 0.08,
          flushClearance: 0.005,
          localOutwardAxis,
          blockRotationDeg: deg,
          buildingOrigin: [10, 0, -20],
          frameDepth: 0.08,
          glassDepth: 0.03,
          mullionDepth: 0.04,
          sillLip: 0.05,
        });

        // 1. Flush offset exact formula: depth * 0.5 + flushClearance
        assert.ok(Math.abs(res.flushOffset - 0.045) < 1e-9);
        assert.ok(Math.abs(res.frontFaceOffset - 0.085) < 1e-9);
        assert.ok(Math.abs(res.backFaceOffset - 0.005) < 1e-9);
        assert.ok(res.extrusions.glassCenterOutward > 0);
        assert.ok(res.extrusions.mullionFrontOutward > res.extrusions.glassFrontOutward);
        assert.ok(res.extrusions.sillFrontOutward > res.extrusions.frameFrontOutward);

        // 2. Local position moves outward from wall surface along wallNormal
        assert.ok(Math.abs(res.localPosition[0] - (anchor[0] + nx * 0.045)) < 1e-9);
        assert.ok(Math.abs(res.localPosition[1] - anchor[1]) < 1e-9);
        assert.ok(Math.abs(res.localPosition[2] - (anchor[2] + nz * 0.045)) < 1e-9);

        // 3. Verify Three.js scene graph hierarchy reproduces exact outward normal & world position
        const block = new THREE.Group();
        block.position.set(10, 0, -20);
        block.rotation.y = (deg * Math.PI) / 180;

        const win = new THREE.Group();
        win.position.set(...res.localPosition);
        win.rotation.y = res.localRotationY;
        block.add(win);
        block.updateMatrixWorld(true);

        const worldOrigin = new THREE.Vector3();
        win.getWorldPosition(worldOrigin);
        assert.ok(Math.abs(worldOrigin.x - res.blockPosition[0]) < 1e-5);
        assert.ok(Math.abs(worldOrigin.y - res.blockPosition[1]) < 1e-5);
        assert.ok(Math.abs(worldOrigin.z - res.blockPosition[2]) < 1e-5);

        const tipLocal = new THREE.Vector3(lx, 0, lz);
        const tipWorld = win.localToWorld(tipLocal.clone()).sub(worldOrigin);
        assert.ok(Math.abs(tipWorld.x - res.blockOutwardNormal[0]) < 1e-5);
        assert.ok(Math.abs(tipWorld.z - res.blockOutwardNormal[2]) < 1e-5);

        const expectedWorldAxis = rotateOutwardAxisDeg(wallNormal, deg);
        assert.equal(res.blockNormalAxis, expectedWorldAxis);
        const [rx, , rz] = rotateVectorYDeg(nx, 0, nz, deg);
        assert.ok(Math.abs(tipWorld.x - rx) < 1e-5);
        assert.ok(Math.abs(tipWorld.z - rz) < 1e-5);
      }
    }
  }
});

test('validateFacadeWindowBounds detects buried panes, floating panes, Z-fighting, pillar/doorway/neighbor/cornice overlaps, and low awnings', () => {
  const hostWall: FacadeWallBounds = {
    wallFaceCoord: 2.14,
    uMin: -2.94,
    uMax: 2.94,
    vMin: 0.24,
    vMax: 4.58,
    cornerMargin: 0.34,
    corniceMargin: 0.14,
    plinthMargin: 0.10,
  };

  // Valid baseline window
  const valid = validateFacadeWindowBounds({
    id: 'manor-clean-win',
    uCenter: -1.86,
    vCenter: 1.48,
    width: 0.64,
    height: 0.84,
    frameWidth: 0.78,
    frameHeight: 0.96,
    sillWidth: 0.90,
    sillHeight: 0.10,
    shutterWidth: 0.28,
    shutterHeight: 0.92,
    shutterGap: 0.02,
    depth: 0.08,
    flushOffset: 0.044,
    wall: hostWall,
    obstacles: [
      { id: 'front-door', kind: 'doorway', uMin: -0.75, uMax: 0.75, vMin: 0.24, vMax: 2.85 },
      buildAdjacentWindowObstacle('right-twin', 1.86, 1.48, 0.78, 0.96, 0.28, 0.02),
    ],
  });
  assert.equal(valid.valid, true, JSON.stringify(valid.issues));

  // Buried inside wall
  const buried = validateFacadeWindowBounds({
    id: 'buried',
    uCenter: -1.86,
    vCenter: 1.48,
    width: 0.8,
    height: 1.0,
    depth: 0.10,
    flushOffset: -0.06,
    wall: hostWall,
  });
  assert.equal(buried.valid, false);
  assert.ok(buried.issues.some((i) => i.code === 'WINDOW_BURIED_IN_WALL'));

  // Floating off wall
  const floating = validateFacadeWindowBounds({
    id: 'floating',
    uCenter: -1.86,
    vCenter: 1.48,
    width: 0.8,
    height: 1.0,
    depth: 0.06,
    flushOffset: 0.12,
    wall: hostWall,
  });
  assert.equal(floating.valid, false);
  assert.ok(floating.issues.some((i) => i.code === 'WINDOW_FLOATING_OUTSIDE_WALL'));

  // Zero-thickness plane / Z-fight risk
  const zeroPlane = validateFacadeWindowBounds({
    id: 'zero-plane',
    uCenter: -1.86,
    vCenter: 1.48,
    width: 0.8,
    height: 1.0,
    depth: 0,
    flushOffset: 0.001,
    wall: hostWall,
  });
  assert.equal(zeroPlane.valid, false);
  assert.ok(zeroPlane.issues.some((i) => i.code === 'ZERO_THICKNESS_PANE'));

  // Shutter clips corner quoin + door + twin window overlap
  const clipped = validateFacadeWindowBounds({
    id: 'clipped-shutter',
    uCenter: -2.02,
    vCenter: 1.48,
    width: 0.64,
    height: 0.84,
    frameWidth: 0.78,
    frameHeight: 0.96,
    shutterWidth: 0.28,
    shutterGap: 0.02,
    depth: 0.08,
    flushOffset: 0.044,
    wall: hostWall,
    obstacles: [
      { id: 'quoin-left', kind: 'quoin', uMin: -2.94, uMax: -2.60, vMin: 0.24, vMax: 4.58 },
      { id: 'neighbor', kind: 'adjacent_window', uMin: -1.45, uMax: -0.95, vMin: 1.0, vMax: 2.0 },
    ],
  });
  assert.equal(clipped.valid, false);
  assert.ok(clipped.issues.some((i) => i.code === 'OUT_OF_WALL_HORIZONTAL_BOUNDS'));
  assert.ok(clipped.issues.some((i) => i.code === 'CLIPS_CORNER_OR_PILASTER'));
  assert.ok(clipped.issues.some((i) => i.code === 'CLIPS_ADJACENT_WINDOW'));

  // Awning cuts arched crown
  const awningClip = validateFacadeWindowBounds({
    id: 'arched-awning',
    uCenter: 0,
    vCenter: 2.6,
    width: 0.9,
    height: 1.1,
    frameHeight: 1.2,
    archCrownHeight: 0.45,
    awningWidth: 1.1,
    awningBottomY: 3.3,
    awningTopY: 3.68,
    depth: 0.08,
    flushOffset: 0.044,
    wall: { ...hostWall, vMax: 5.5 },
  });
  assert.equal(awningClip.valid, false);
  assert.ok(awningClip.issues.some((i) => i.code === 'AWNING_CLIPS_ARCH_CROWN'));
});

test('cityWindowSpec helpers attach deterministic metadata to single and instanced meshes', () => {
  const specA = createCityWindowSpec('boutique-2f-front-0', 'upper_floor', '#89adc2', 2, 0);
  const specA2 = createCityWindowSpec('boutique-2f-front-0', 'upper_floor', '#89adc2', 2, 0);
  const specB = createCityWindowSpec('boutique-2f-front-1', 'upper_floor', '#89adc2', 2, 1);

  assert.deepEqual(specA, specA2);
  assert.notEqual(specA.seed, specB.seed);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.0, 0.04),
    new THREE.MeshStandardMaterial({ color: specA.baseColorHex }),
  );
  tagCityWindowMesh(mesh, specA);
  assert.deepEqual(mesh.userData.cityWindowSpec, specA);

  const inst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 0.04),
    new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    2,
  );
  tagCityWindowInstancedMesh(inst, specA, [specA, specB]);
  assert.deepEqual(inst.userData.cityWindowSpec, specA);
  assert.equal(inst.userData.cityWindowInstancedSpecs.length, 2);
});

test('fixed architectural window layouts pass validateFacadeWindowBounds across PlazaManor, Hangar, HQ, Barracks, Boutique, and CozyBites', () => {
  // 1. PlazaManor Front windows (±1.92) clear terracotta corner quoins (±2.62) & portico pediment (±1.24)
  for (const zCenter of [-1.92, 1.92]) {
    for (const vCenter of [1.38, 3.22]) {
      const check = validateFacadeWindowBounds({
        id: `plaza-manor-front-${vCenter}-${zCenter}`,
        uCenter: zCenter,
        vCenter,
        width: 0.64,
        height: 0.84,
        frameWidth: 0.76,
        frameHeight: 0.96,
        sillWidth: 0.84,
        sillHeight: 0.08,
        shutterWidth: 0.26,
        shutterHeight: 0.92,
        shutterGap: 0.02,
        depth: 0.082,
        flushOffset: 0.017,
        wall: {
          wallFaceCoord: 2.14,
          uMin: -2.94,
          uMax: 2.94,
          vMin: 0.38,
          vMax: 4.10,
          cornerMargin: 0.32,
          corniceMargin: 0.05,
        },
        obstacles: [
          { id: 'portico', kind: 'roof_cornice', uMin: -1.24, uMax: 1.24, vMin: 0.38, vMax: 4.32 },
          { id: 'quoin-n', kind: 'quoin', uMin: -2.94, uMax: -2.62, vMin: 0.38, vMax: 4.10 },
          { id: 'quoin-s', kind: 'quoin', uMin: 2.62, uMax: 2.94, vMin: 0.38, vMax: 4.10 },
        ],
      });
      assert.equal(check.valid, true, JSON.stringify(check.issues));
    }
  }

  // 2. BoutiqueTower 2F Wing terrace door clears corner quoins [1.47, 1.95] and arched windows clear awnings
  const terraceDoorCheck = validateFacadeWindowBounds({
    id: 'boutique-2f-terrace-door',
    uCenter: 1.11,
    vCenter: 5.53,
    width: 0.50,
    height: 1.48,
    frameWidth: 0.66,
    frameHeight: 2.02,
    depth: 0.08,
    flushOffset: 0.042,
    wall: {
      wallFaceCoord: 1.25,
      uMin: 0.75,
      uMax: 1.95,
      vMin: 4.35,
      vMax: 8.18,
      cornerMargin: 0.0,
      corniceMargin: 0.12,
    },
    obstacles: [
      { id: 'wing-quoin', kind: 'quoin', uMin: 1.47, uMax: 1.95, vMin: 4.35, vMax: 8.18 },
    ],
  });
  assert.equal(terraceDoorCheck.valid, true, JSON.stringify(terraceDoorCheck.issues));

  const wingArchedAwningCheck = validateFacadeWindowBounds({
    id: 'boutique-2f-wing-awning-win',
    uCenter: 2.80,
    vCenter: 6.59,
    width: 1.12,
    height: 1.18,
    frameWidth: 1.30,
    frameHeight: 1.18,
    archCrownHeight: 0.56,
    awningWidth: 1.40,
    awningBottomY: 7.78,
    awningTopY: 8.00,
    depth: 0.09,
    flushOffset: 0.045,
    wall: {
      wallFaceCoord: 1.95,
      uMin: 1.25,
      uMax: 4.35,
      vMin: 4.35,
      vMax: 8.06,
      cornerMargin: 0.48,
      corniceMargin: 0.04,
    },
  });
  assert.equal(wingArchedAwningCheck.valid, true, JSON.stringify(wingArchedAwningCheck.issues));

  // 3. Lv3 Hangar front ribbon & left side windows clear structural piers & concrete wing wall
  const hangarRibbonCheck = validateFacadeWindowBounds({
    id: 'hangar-l2-front-ribbon',
    uCenter: -0.69,
    vCenter: 3.68,
    width: 3.20,
    height: 0.80,
    frameWidth: 3.32,
    frameHeight: 0.98,
    depth: 0.16,
    flushOffset: 0.08,
    wall: {
      wallFaceCoord: 3.26,
      uMin: -3.46,
      uMax: 3.46,
      vMin: 0.50,
      vMax: 4.46,
    },
    obstacles: [
      { id: 'pier-right', kind: 'pilaster', uMin: -2.70, uMax: -2.42, vMin: 0.50, vMax: 4.48 },
      { id: 'pier-center', kind: 'pilaster', uMin: 1.04, uMax: 1.32, vMin: 0.50, vMax: 4.48 },
    ],
  });
  assert.equal(hangarRibbonCheck.valid, true, JSON.stringify(hangarRibbonCheck.issues));

  const hangarLeftLowerCheck = validateFacadeWindowBounds({
    id: 'hangar-l1-left-win',
    uCenter: -0.66,
    vCenter: 1.24,
    width: 0.72,
    height: 1.30,
    frameWidth: 0.80,
    frameHeight: 1.50,
    depth: 0.16,
    flushOffset: 0.08,
    wall: {
      wallFaceCoord: 3.46,
      uMin: -3.26,
      uMax: 3.26,
      vMin: 0.49,
      vMax: 4.46,
    },
    obstacles: [
      { id: 'wing-wall', kind: 'wing_wall', uMin: -3.50, uMax: -2.02, vMin: 0.49, vMax: 3.02 },
      { id: 'koushi-panel', kind: 'adjacent_window', uMin: -1.90, uMax: -1.14, vMin: 0.47, vMax: 2.09 },
      { id: 'center-pier', kind: 'pilaster', uMin: -0.14, uMax: 0.14, vMin: 0.50, vMax: 4.48 },
    ],
  });
  assert.equal(hangarLeftLowerCheck.valid, true, JSON.stringify(hangarLeftLowerCheck.issues));
});

function withStubDocument<T>(run: () => Promise<T>): Promise<T> {
  const origDocument = (globalThis as { document?: unknown }).document;
  const noop = () => {};
  const stubCtx = new Proxy(
    {
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      measureText: () => ({ width: 100 }),
    },
    {
      get(target, prop) {
        if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
        return noop;
      },
      set() {
        return true;
      },
    },
  );
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ width: 256, height: 256, getContext: () => stubCtx }),
  };
  return run().finally(() => {
    (globalThis as { document?: unknown }).document = origDocument;
  });
}

test('buildGrandCasino3D tags instanced and lobby door glass cleanly, clears East Foyer vault, and flushes West Foyer', async () => {
  const { buildGrandCasino3D } = await import('./buddiesGrandCasinoBuilder');
  const { GRAND_CASINO_MASTERPLAN } = await import('./buddiesGrandCasinoRules');
  const {
    bakeStaticGroupMeshes,
    createBlitzStrokeMesh,
    upgradeMeshToBlitzWorldMaterial,
  } = await import('./buddiesBlitzShadersAndAssets');

  await withStubDocument(async () => {
    const windUniforms = {
      uTime: { value: 0 },
      uWindPhase: { value: 0 },
      uWindDirection: { value: new THREE.Vector2(0.7071, 0.7071) },
      uWindStrength: { value: 0.32 },
      uWindGust: { value: 0.15 },
      uLightDirection: { value: new THREE.Vector3(0.4, 0.85, 0.3).normalize() },
      uLightColor: { value: new THREE.Color('#fff4c8') },
      uShadowColor: { value: new THREE.Color('#3b6e52') },
    };
    const glassMat = new THREE.MeshStandardMaterial({ color: '#c4e0f0' });
    const casino = buildGrandCasino3D({
      windUniforms,
      isSoftwareGl: false,
      sharedGlassMat: glassMat,
      tagFrostedGlassGeometry: (geo) => geo,
      upgradeMeshToBlitzWorldMaterial,
      createBlitzStrokeMesh,
      bakeStaticGroupMeshes,
      createLeafPetalShrubInstanced: (matrices, meshName) => {
        const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), matrices.length);
        inst.name = meshName;
        return inst;
      },
      createFlowerPetalClusterInstanced: (specs, meshName) => {
        const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), specs.length);
        inst.name = meshName;
        return inst;
      },
    });

    let upperInst: THREE.InstancedMesh | null = null;
    let civicInst: THREE.InstancedMesh | null = null;
    let dormerInst: THREE.InstancedMesh | null = null;
    let lobbyDoorMesh: THREE.Mesh | null = null;

    casino.group.traverse((obj) => {
      if (obj instanceof THREE.InstancedMesh) {
        if (obj.name === 'GrandCasinoUpperWindowsInstanced') upperInst = obj;
        if (obj.name === 'GrandCasinoCivicWindowsInstanced') civicInst = obj;
        if (obj.name === 'GrandCasinoDormerWindowsInstanced') dormerInst = obj;
      } else if (obj instanceof THREE.Mesh && obj.name === 'GrandCasinoLobbyDoorGlass') {
        lobbyDoorMesh = obj;
      }
    });

    assert.ok(upperInst, 'GrandCasinoUpperWindowsInstanced missing');
    assert.ok(civicInst, 'GrandCasinoCivicWindowsInstanced missing');
    assert.ok(dormerInst, 'GrandCasinoDormerWindowsInstanced missing');
    assert.ok(lobbyDoorMesh, 'GrandCasinoLobbyDoorGlass missing');

    assert.equal((upperInst as THREE.InstancedMesh).userData.cityWindowSpec.kind, 'upper_floor');
    assert.equal((civicInst as THREE.InstancedMesh).userData.cityWindowSpec.kind, 'civic');
    assert.equal((dormerInst as THREE.InstancedMesh).userData.cityWindowSpec.kind, 'dormer');
    assert.equal((lobbyDoorMesh as THREE.Mesh).userData.cityWindowSpec.kind, 'civic');

    const cz = GRAND_CASINO_MASTERPLAN.centerZ;
    const foyerEastX = GRAND_CASINO_MASTERPLAN.mainBuilding.foyerEastMaxX;
    const westFoyerOutX = GRAND_CASINO_MASTERPLAN.mainBuilding.foyerWestMinX - 0.125;

    // Verify East Foyer upper windows sit outside Porte-Cochere cornice (|z - cz| > 4.43)
    const mat4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    let eastFoyerUpperCount = 0;
    let westFoyerCenterCount = 0;
    const instUpper = upperInst as THREE.InstancedMesh;
    for (let i = 0; i < instUpper.count; i++) {
      instUpper.getMatrixAt(i, mat4);
      pos.setFromMatrixPosition(mat4);
      if (pos.x > foyerEastX && Math.abs(pos.z - cz) > 4.4) {
        eastFoyerUpperCount += 1;
        assert.ok(Math.abs(pos.z - cz) > 4.6, `East foyer upper win ${pos.z} too close to Porte-Cochere vault`);
        assert.ok(Math.abs(pos.z - cz) < 6.7, `East foyer upper win ${pos.z} clips corner quoins`);
      }
      if (Math.abs(pos.z - cz) < 0.5 && pos.x < -97.8) {
        westFoyerCenterCount += 1;
        assert.ok(pos.x < westFoyerOutX, `West foyer center upper glass (${pos.x}) buried inside wall ${westFoyerOutX}`);
      }
    }
    assert.equal(eastFoyerUpperCount, 2, 'Expected 2 flanking East Foyer Upper Piano Nobile windows');
    assert.equal(westFoyerCenterCount, 1, 'Expected West Foyer center upper window flush outside wall');

    casino.dispose();
    glassMat.dispose();
  });
});

test('buildCentralBotanicalPark3D exposes unbaked cityWindowSpec 3D glass meshes on BoutiqueTower and mounts the owner CozyBites GLB', async () => {
  const { buildCentralBotanicalPark3D } = await import('./buddiesCentralParkBuilder');
  const {
    bakeStaticGroupMeshes,
    createBlitzStrokeMesh,
    getSharedFallbackFoliageMaskTexture,
    getWaterBasinRippleTexture,
    getWaterCascadeSheetTexture,
    upgradeMeshToBlitzWorldMaterial,
  } = await import('./buddiesBlitzShadersAndAssets');

  await withStubDocument(async () => {
    const windUniforms = {
      uTime: { value: 0 },
      uWindPhase: { value: 0 },
      uWindDirection: { value: new THREE.Vector2(0.7071, 0.7071) },
      uWindStrength: { value: 0.32 },
      uWindGust: { value: 0.15 },
      uLightDirection: { value: new THREE.Vector3(0.4, 0.85, 0.3).normalize() },
      uLightColor: { value: new THREE.Color('#fff4c8') },
      uShadowColor: { value: new THREE.Color('#3b6e52') },
    };

    const park = buildCentralBotanicalPark3D({
      windUniforms,
      isSoftwareGl: false,
      leafMaskTexture: getSharedFallbackFoliageMaskTexture(),
      waterCascadeTex: getWaterCascadeSheetTexture(),
      waterRippleTex: getWaterBasinRippleTexture(),
      upgradeMeshToBlitzWorldMaterial,
      createBlitzStrokeMesh,
      bakeStaticGroupMeshes,
    });

    const taggedWindows: THREE.Mesh[] = [];
    const kinds = new Set<string>();
    const ids = new Set<string>();

    park.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData?.cityWindowSpec) {
        taggedWindows.push(obj);
        const spec = obj.userData.cityWindowSpec;
        kinds.add(spec.kind);
        ids.add(spec.id);
        obj.geometry.computeBoundingBox();
        const bb = obj.geometry.boundingBox!;
        const sizeX = bb.max.x - bb.min.x;
        const sizeY = bb.max.y - bb.min.y;
        const sizeZ = bb.max.z - bb.min.z;
        const minThickness = Math.min(sizeX, sizeY, sizeZ);
        assert.ok(minThickness >= 0.02, `Window ${spec.id} must have 3D thickness >= 0.02m, got ${minThickness}`);
      }
    });

    assert.ok(taggedWindows.length >= 40, `Expected >= 40 tagged Urban Plaza window meshes, got ${taggedWindows.length}`);
    assert.ok(kinds.has('storefront'));
    assert.ok(kinds.has('upper_floor'));
    // No 'dormer' assertion here anymore: the park's only dormer-kind pane
    // was the procedural Cozy Bites pavilion's roof skylight, and that
    // pavilion is now the owner GLB mount asserted below. The skylight
    // stays covered by the direct buildCozyBitesCafePavilion3D tests.
    assert.ok(ids.has('boutique-2f-terrace-door'));
    // The Cozy Bites & Sips pavilion exterior is now the owner-supplied
    // Bites & Sips GLB (loaded as-is, like the rental shop GLBs): in the
    // built park it carries no cityWindowSpec tags and no unbaked glass
    // host. The procedural pavilion's glass stays covered by the direct
    // buildCozyBitesCafePavilion3D tests below, since that builder
    // remains the GLB load-failure fallback.
    assert.ok(
      park.group.getObjectByName('UrbanPlazaCozyBitesCafeGlb3D'),
      'UrbanPlazaCozyBitesCafeGlb3D mount must exist in the park',
    );
    // The Beauty Salon exterior is now the owner-supplied Glow Studio GLB
    // (loaded as-is, like the rental shop GLBs): in the built park it carries
    // no cityWindowSpec tags and no unbaked glass host. The procedural
    // salon's glass stays covered by the direct buildBeautySalonStudio3D
    // tests below, since that builder remains the GLB load-failure fallback.
    assert.ok(
      park.group.getObjectByName('UrbanPlazaBeautySalonGlb3D'),
      'UrbanPlazaBeautySalonGlb3D mount must exist in the park',
    );

    const boutiqueGlassHost = park.group.getObjectByName('UrbanPlazaBoutiqueTowerGlassHost');
    assert.ok(boutiqueGlassHost, 'UrbanPlazaBoutiqueTowerGlassHost must remain unbaked in animatedGroup');
    let boutiqueBayGlassCount = 0;
    boutiqueGlassHost.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.name.startsWith('Boutique1FDisplayGlass_')) {
        const mat = obj.material as THREE.MeshStandardMaterial;
        assert.equal(obj.userData?.cityWindowSpec?.kind, 'storefront');
        assert.equal(mat.transparent, true, `${obj.name} must be transparent to reveal interior mannequins`);
        assert.ok(mat.opacity <= 0.35, `${obj.name} opacity must stay clear`);
        assert.equal(mat.depthWrite, false, `${obj.name} must keep depthWrite=false for crisp see-through vitrines`);
        boutiqueBayGlassCount++;
      }
    });
    assert.equal(boutiqueBayGlassCount, 8, 'Expected 8 transparent 1F display bay glass panes on BoutiqueTower');

    park.dispose();
  });
});

function createMockUrbanPlazaContext(): {
  ctx: import('./buddiesUrbanPlazaBuildingsBuilder').UrbanPlazaBuildingsContext;
  staticGroup: THREE.Group;
  animatedGroup: THREE.Group;
  dispose: () => void;
} {
  const staticGroup = new THREE.Group();
  const animatedGroup = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const dummyTex = new THREE.DataTexture(new Uint8Array([220, 210, 195, 255]), 1, 1);
  dummyTex.needsUpdate = true;
  texs.push(dummyTex);

  const ctx: import('./buddiesUrbanPlazaBuildingsBuilder').UrbanPlazaBuildingsContext = {
    staticGroup,
    animatedGroup,
    windUniforms: {
      uTime: { value: 0 },
      uWindPhase: { value: 0 },
      uWindDirection: { value: new THREE.Vector2(0.7071, 0.7071) },
      uWindStrength: { value: 0.32 },
      uWindGust: { value: 0.15 },
      uLightDirection: { value: new THREE.Vector3(0.4, 0.85, 0.3).normalize() },
      uLightColor: { value: new THREE.Color('#fff4c8') },
      uShadowColor: { value: new THREE.Color('#3b6e52') },
    },
    isSoftwareGl: true,
    addPart(parent, geo, colorHex, pos = [0, 0, 0], rot = [0, 0, 0], opts = {}) {
      geos.push(geo);
      const mat = new THREE.MeshStandardMaterial({ color: colorHex, map: opts.map ?? null });
      mats.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.rotation.set(rot[0], rot[1], rot[2]);
      if (opts.scale) mesh.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
      parent.add(mesh);
      return mesh;
    },
    applyPlanarUvs: (geo) => geo,
    applyNormalizedDiscUvs: (geo) => geo,
    scaleGeometryUvs: (geo) => geo,
    registerGeo: (geo) => {
      geos.push(geo);
      return geo;
    },
    registerMat: (mat) => {
      mats.push(mat);
      return mat;
    },
    registerTex: (tex) => {
      texs.push(tex);
      return tex;
    },
    textures: {
      stoneTex: dummyTex,
      fieldstoneTex: dummyTex,
      timberTex: dummyTex,
      cobbleTex: dummyTex,
      pondWaterTex: dummyTex,
      brickTex: dummyTex,
    },
    wisteriaCollectors: { matrices: [], colors: [] },
    pondReedCollectors: { matrices: [], colors: [] },
    shrubCollectors: { matrices: [], colors: [] },
  };
  return {
    ctx,
    staticGroup,
    animatedGroup,
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      texs.forEach((t) => t.dispose());
    },
  };
}

function getMeshLocalBoxInGroup(mesh: THREE.Mesh, rootGroup: THREE.Object3D): THREE.Box3 {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!.clone();
  const rootInv = rootGroup.matrixWorld.clone().invert();
  const relMat = new THREE.Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld);
  return bb.applyMatrix4(relMat);
}

function getObjectBoundsInGroup(obj: THREE.Object3D, rootGroup: THREE.Object3D): THREE.Box3 {
  const combined = new THREE.Box3();
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      combined.union(getMeshLocalBoxInGroup(child, rootGroup));
    }
  });
  return combined;
}

test('Boutique Tower 1F and CozyBites Cafe Pavilion seal all corners and connect all storefront mullions/jambs cleanly', async () => {
  const { buildBoutiqueRooftopTower3D, buildCozyBitesCafePavilion3D } = await import(
    './buddiesUrbanPlazaBuildingsBuilder'
  );

  await withStubDocument(async () => {
    const mock = createMockUrbanPlazaContext();
    try {
      buildBoutiqueRooftopTower3D(mock.ctx);
      buildCozyBitesCafePavilion3D(mock.ctx);
      mock.staticGroup.updateMatrixWorld(true);
      mock.animatedGroup.updateMatrixWorld(true);

      // 1. Boutique Tower 1F corner piers + 8 display bays
      const boutiqueGrp = mock.staticGroup.getObjectByName('UrbanPlazaBoutiqueTower3D')!;
      const boutiqueGlassHost = mock.animatedGroup.getObjectByName('UrbanPlazaBoutiqueTowerGlassHost')!;
      assert.ok(boutiqueGrp, 'UrbanPlazaBoutiqueTower3D must exist');
      assert.ok(boutiqueGlassHost, 'UrbanPlazaBoutiqueTowerGlassHost must exist');

      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          const pierName = `Boutique1FCornerPier_${sx > 0 ? 'E' : 'W'}_${sz > 0 ? 'S' : 'N'}`;
          const pier = boutiqueGrp.getObjectByName(pierName) as THREE.Mesh;
          assert.ok(pier, `Missing ${pierName}`);
          const bb = getMeshLocalBoxInGroup(pier, boutiqueGrp);
          const minAbsX = sx > 0 ? bb.min.x : -bb.max.x;
          const maxAbsX = sx > 0 ? bb.max.x : -bb.min.x;
          const minAbsZ = sz > 0 ? bb.min.z : -bb.max.z;
          const maxAbsZ = sz > 0 ? bb.max.z : -bb.min.z;
          // Connects solidly into core (±4.12, ±3.72) & corner pilasters (±4.32, ±3.92) without outer protrusion (>4.64, >4.24)
          assert.ok(minAbsX <= 4.09, `${pierName} inner X (${minAbsX}) must overlap 4.12 core by >= 0.03m`);
          assert.ok(maxAbsX >= 4.35 && maxAbsX <= 4.64, `${pierName} outer X (${maxAbsX}) must embed inside pilaster without protruding`);
          assert.ok(minAbsZ <= 3.69, `${pierName} inner Z (${minAbsZ}) must overlap 3.72 core by >= 0.03m`);
          assert.ok(maxAbsZ >= 3.95 && maxAbsZ <= 4.24, `${pierName} outer Z (${maxAbsZ}) must embed inside pilaster without protruding`);
        }
      }

      const expectedBoutiqueBays: ReadonlyArray<{
        idx: number;
        axis: 'x' | 'z';
        minBound: number;
        maxBound: number;
      }> = [
        { idx: 0, axis: 'x', minBound: -4.32, maxBound: -1.41 },
        { idx: 1, axis: 'x', minBound: 1.41, maxBound: 4.32 },
        { idx: 2, axis: 'z', minBound: -3.92, maxBound: -0.16 },
        { idx: 3, axis: 'z', minBound: 0.16, maxBound: 3.92 },
        { idx: 4, axis: 'z', minBound: -3.92, maxBound: -0.16 },
        { idx: 5, axis: 'z', minBound: 0.16, maxBound: 3.92 },
        { idx: 6, axis: 'x', minBound: -4.32, maxBound: -1.41 },
        { idx: 7, axis: 'x', minBound: 1.41, maxBound: 4.32 },
      ];
      for (const spec of expectedBoutiqueBays) {
        const bayGrp = boutiqueGrp.getObjectByName(`Boutique1FDisplayBay_${spec.idx}`)!;
        assert.ok(bayGrp, `Missing Boutique1FDisplayBay_${spec.idx}`);
        const jambs = bayGrp.children.filter((c) => c.name === 'Boutique1FDisplayJamb') as THREE.Mesh[];
        assert.equal(jambs.length, 2, `Bay ${spec.idx} must have 2 full-depth side jambs`);
        for (const jamb of jambs) {
          const jLocal = getMeshLocalBoxInGroup(jamb, bayGrp);
          assert.ok(jLocal.min.z <= -0.025, `Boutique bay ${spec.idx} jamb must reach core wall (min.z=${jLocal.min.z})`);
          assert.ok(jLocal.max.z >= 0.455, `Boutique bay ${spec.idx} jamb must reach outer mullions (max.z=${jLocal.max.z})`);
          assert.ok(jLocal.min.y <= 0.80 && jLocal.max.y >= 4.04, `Boutique bay ${spec.idx} jamb must seal sill-to-header`);
        }
        const transom = bayGrp.getObjectByName('Boutique1FDisplayTransom') as THREE.Mesh;
        const header = bayGrp.getObjectByName('Boutique1FDisplayHeader') as THREE.Mesh;
        const tBb = getMeshLocalBoxInGroup(transom, boutiqueGrp);
        const hBb = getMeshLocalBoxInGroup(header, boutiqueGrp);
        for (const [label, bb] of [['transom', tBb], ['header', hBb]] as const) {
          const lo = spec.axis === 'x' ? bb.min.x : bb.min.z;
          const hi = spec.axis === 'x' ? bb.max.x : bb.max.z;
          assert.ok(lo <= spec.minBound - 0.03, `Boutique bay ${spec.idx} ${label} low (${lo}) must embed >= 0.03m past ${spec.minBound}`);
          assert.ok(hi >= spec.maxBound + 0.03, `Boutique bay ${spec.idx} ${label} high (${hi}) must embed >= 0.03m past ${spec.maxBound}`);
        }

        // Front clear glass must sit strictly IN FRONT of interior mannequins & behind outer mullions
        const backdropMesh = bayGrp.getObjectByName('Boutique1FDisplayBackdrop') as THREE.Mesh;
        const mLeft = bayGrp.getObjectByName('BoutiqueMannequin_Left')!;
        const mRight = bayGrp.getObjectByName('BoutiqueMannequin_Right')!;
        const glassMesh = boutiqueGlassHost.getObjectByName(`Boutique1FDisplayGlass_${spec.idx}`) as THREE.Mesh;
        assert.ok(backdropMesh, `Boutique bay ${spec.idx} missing Boutique1FDisplayBackdrop`);
        assert.ok(mLeft && mRight, `Boutique bay ${spec.idx} missing mannequins`);
        assert.ok(glassMesh, `Boutique bay ${spec.idx} missing Boutique1FDisplayGlass_${spec.idx}`);

        const glassMat = glassMesh.material as THREE.MeshStandardMaterial;
        assert.equal(glassMat.transparent, true);
        assert.ok(glassMat.opacity <= 0.35);
        assert.equal(glassMat.depthWrite, false);

        const backdropBb = getMeshLocalBoxInGroup(backdropMesh, bayGrp);
        const leftBb = getObjectBoundsInGroup(mLeft, bayGrp);
        const rightBb = getObjectBoundsInGroup(mRight, bayGrp);
        const glassBb = getMeshLocalBoxInGroup(glassMesh, bayGrp);
        const transomBayBb = getMeshLocalBoxInGroup(transom, bayGrp);

        assert.ok(backdropBb.max.z < leftBb.min.z && backdropBb.max.z < rightBb.min.z,
          `Boutique bay ${spec.idx} mannequins must sit cleanly in front of alcove backdrop`);
        assert.ok(leftBb.max.z < glassBb.min.z && rightBb.max.z < glassBb.min.z,
          `Boutique bay ${spec.idx} mannequins (maxZ=${Math.max(leftBb.max.z, rightBb.max.z)}) must sit strictly behind front glass (minZ=${glassBb.min.z})`);
        assert.ok(glassBb.max.z <= transomBayBb.max.z,
          `Boutique bay ${spec.idx} glass (maxZ=${glassBb.max.z}) must sit behind/flush within outer mullions (maxZ=${transomBayBb.max.z})`);
      }

      // 2. CozyBites Cafe Pavilion corner piers + West front piers + 7 showcase bays
      const cafeGrp = mock.staticGroup.getObjectByName('UrbanPlazaCozyBitesCafe3D')!;
      const cafeGlassHost = mock.animatedGroup.getObjectByName('UrbanPlazaCozyBitesCafeGlassHost')!;
      assert.ok(cafeGrp, 'UrbanPlazaCozyBitesCafe3D must exist');
      assert.ok(cafeGlassHost, 'UrbanPlazaCozyBitesCafeGlassHost must exist');

      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          const pierName = `CozyBitesCornerPier_${sx > 0 ? 'S' : 'N'}_${sz > 0 ? 'W' : 'E'}`;
          const pier = cafeGrp.getObjectByName(pierName) as THREE.Mesh;
          assert.ok(pier, `Missing ${pierName}`);
          const bb = getMeshLocalBoxInGroup(pier, cafeGrp);
          const minAbsX = sx > 0 ? bb.min.x : -bb.max.x;
          const maxAbsX = sx > 0 ? bb.max.x : -bb.min.x;
          const minAbsZ = sz > 0 ? bb.min.z : -bb.max.z;
          const maxAbsZ = sz > 0 ? bb.max.z : -bb.min.z;
          // Bridges core (±3.74, ±3.24) into corner pilasters (±3.80, ±3.30) without protruding past ±4.10 / ±3.60
          assert.ok(minAbsX <= 3.71, `${pierName} inner X (${minAbsX}) must overlap 3.74 core`);
          assert.ok(maxAbsX >= 3.83 && maxAbsX <= 4.10, `${pierName} outer X (${maxAbsX}) must seal inside pilaster without protruding`);
          assert.ok(minAbsZ <= 3.21, `${pierName} inner Z (${minAbsZ}) must overlap 3.24 core`);
          assert.ok(maxAbsZ >= 3.33 && maxAbsZ <= 3.60, `${pierName} outer Z (${maxAbsZ}) must seal inside pilaster without protruding`);
        }
      }
      for (const partName of [
        'CozyBitesWestCenterPier',
        'CozyBitesWestRightWall',
        'CozyBitesWestDoorBacking',
        'CozyBitesWestUpperHeader',
      ]) {
        assert.ok(cafeGrp.getObjectByName(partName), `Missing ${partName}`);
      }

      const expectedCafeBays: ReadonlyArray<{
        idx: number;
        axis: 'x' | 'z';
        minBound: number;
        maxBound: number;
      }> = [
        { idx: 0, axis: 'x', minBound: -3.80, maxBound: -0.52 },
        { idx: 1, axis: 'z', minBound: -3.30, maxBound: -0.18 },
        { idx: 2, axis: 'z', minBound: 0.18, maxBound: 3.30 },
        { idx: 3, axis: 'z', minBound: -3.30, maxBound: -0.18 },
        { idx: 4, axis: 'z', minBound: 0.18, maxBound: 3.30 },
        { idx: 5, axis: 'x', minBound: -3.80, maxBound: -0.18 },
        { idx: 6, axis: 'x', minBound: 0.18, maxBound: 3.80 },
      ];
      for (const spec of expectedCafeBays) {
        const bayGrp = cafeGrp.getObjectByName(`CozyBitesShowcaseBay_${spec.idx}`)!;
        assert.ok(bayGrp, `Missing CozyBitesShowcaseBay_${spec.idx}`);
        const jambs = bayGrp.children.filter((c) => c.name === 'CozyBitesShowcaseJamb') as THREE.Mesh[];
        assert.equal(jambs.length, 2, `CozyBites bay ${spec.idx} must have 2 full-depth side jambs`);
        for (const jamb of jambs) {
          const jLocal = getMeshLocalBoxInGroup(jamb, bayGrp);
          assert.ok(jLocal.min.z <= -0.035, `CozyBites bay ${spec.idx} jamb must seal to core wall (min.z=${jLocal.min.z})`);
          assert.ok(jLocal.max.z >= 0.375, `CozyBites bay ${spec.idx} jamb must seal to outer mullions (max.z=${jLocal.max.z})`);
          assert.ok(jLocal.min.y <= 0.98 && jLocal.max.y >= 4.12, `CozyBites bay ${spec.idx} jamb must close sill-to-lintel`);
        }
        const transom = bayGrp.getObjectByName('CozyBitesShowcaseTransom') as THREE.Mesh;
        const lintel = bayGrp.getObjectByName('CozyBitesShowcaseLintel') as THREE.Mesh;
        const tBb = getMeshLocalBoxInGroup(transom, cafeGrp);
        const lBb = getMeshLocalBoxInGroup(lintel, cafeGrp);
        for (const [label, bb] of [['transom', tBb], ['lintel', lBb]] as const) {
          const lo = spec.axis === 'x' ? bb.min.x : bb.min.z;
          const hi = spec.axis === 'x' ? bb.max.x : bb.max.z;
          assert.ok(lo <= spec.minBound - 0.03, `CozyBites bay ${spec.idx} ${label} low (${lo}) must embed >= 0.03m past ${spec.minBound}`);
          assert.ok(hi >= spec.maxBound + 0.03, `CozyBites bay ${spec.idx} ${label} high (${hi}) must embed >= 0.03m past ${spec.maxBound}`);
          const cornerClamp = spec.axis === 'x' ? 4.10 : 3.60;
          assert.ok(lo >= -cornerClamp && hi <= cornerClamp, `CozyBites bay ${spec.idx} ${label} must not protrude past outer corner`);
        }

        // Front clear glass must sit strictly IN FRONT of interior pastry counter/stands & behind outer mullions
        const backdropMesh = bayGrp.getObjectByName('CozyBitesShowcaseBackdrop') as THREE.Mesh;
        const displayGrp = bayGrp.getObjectByName('CozyBitesShowcaseDisplay')!;
        const glassMesh = cafeGlassHost.getObjectByName(`CozyBitesShowcaseGlass_${spec.idx}`) as THREE.Mesh;
        assert.ok(backdropMesh, `CozyBites bay ${spec.idx} missing CozyBitesShowcaseBackdrop`);
        assert.ok(displayGrp, `CozyBites bay ${spec.idx} missing CozyBitesShowcaseDisplay`);
        assert.ok(glassMesh, `CozyBites bay ${spec.idx} missing CozyBitesShowcaseGlass_${spec.idx}`);

        const glassMat = glassMesh.material as THREE.MeshStandardMaterial;
        assert.equal(glassMat.transparent, true);
        assert.ok(glassMat.opacity <= 0.35);
        assert.equal(glassMat.depthWrite, false);

        const backdropBb = getMeshLocalBoxInGroup(backdropMesh, bayGrp);
        const displayBb = getObjectBoundsInGroup(displayGrp, bayGrp);
        const glassBb = getMeshLocalBoxInGroup(glassMesh, bayGrp);
        const transomBayBb = getMeshLocalBoxInGroup(transom, bayGrp);

        assert.ok(backdropBb.max.z < displayBb.min.z,
          `CozyBites bay ${spec.idx} pastry display (minZ=${displayBb.min.z}) must sit cleanly in front of alcove backdrop (maxZ=${backdropBb.max.z})`);
        assert.ok(displayBb.max.z < glassBb.min.z,
          `CozyBites bay ${spec.idx} pastry display (maxZ=${displayBb.max.z}) must sit strictly behind front glass (minZ=${glassBb.min.z})`);
        assert.ok(glassBb.max.z <= transomBayBb.max.z,
          `CozyBites bay ${spec.idx} glass (maxZ=${glassBb.max.z}) must sit behind/flush within outer mullions (maxZ=${transomBayBb.max.z})`);
      }
    } finally {
      mock.dispose();
    }
  });
});

test('Plaza Commercial Arcade mounts matching bronze-framed Fashion Boutique fascia banner on Bay 1', async () => {
  const { buildPlazaCommercialArcade3D, getFashionBoutiqueFasciaSignTexture } = await import(
    './buddiesPlazaKioskArcadeBuilder'
  );

  const drawnTexts: string[] = [];
  const origDocument = (globalThis as { document?: unknown }).document;
  const noop = () => {};
  const spyCtx = new Proxy(
    {
      fillText: (text: string) => {
        drawnTexts.push(String(text));
      },
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      measureText: () => ({ width: 100 }),
    },
    {
      get(target, prop) {
        if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
        return noop;
      },
      set() {
        return true;
      },
    },
  );
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ width: 512, height: 128, getContext: () => spyCtx }),
  };

  try {
    const tex = getFashionBoutiqueFasciaSignTexture();
    assert.ok(tex, 'getFashionBoutiqueFasciaSignTexture must return a valid texture');
    assert.ok(drawnTexts.some((t) => t.toUpperCase().includes('BOUTIQUE')), 'Bay 1 banner texture must prominently include BOUTIQUE');

    const westPlantGroup = new THREE.Group();
    const sharedClearGlassMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.32 });
    const arcadeGrp = buildPlazaCommercialArcade3D({
      westPlantGroup,
      isSoftwareGl: true,
      sharedClearGlassMat,
      createMitredPolylineStripGeometry: (pts, width, height) => new THREE.BoxGeometry(Math.max(0.1, width), Math.max(0.1, height), Math.max(0.1, pts.length * 0.1)),
      addLobbyPart: (parent, geo, colorHex, pos, rot = [0, 0, 0], _stroke, texArg) => {
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colorHex, map: texArg ?? null }));
        mesh.position.set(pos[0], pos[1], pos[2]);
        mesh.rotation.set(rot[0], rot[1], rot[2]);
        parent.add(mesh);
        return mesh;
      },
      createBlitzStrokeMesh: () => null,
      textures: {},
    });

    const frame = arcadeGrp.getObjectByName('ArcadeBay1BoutiqueBannerFrame') as THREE.Mesh;
    const face = arcadeGrp.getObjectByName('ArcadeBay1BoutiqueBannerFace') as THREE.Mesh;
    assert.ok(frame, 'ArcadeBay1BoutiqueBannerFrame missing');
    assert.ok(face, 'ArcadeBay1BoutiqueBannerFace missing');
    assert.ok(Math.abs(frame.position.x - -6.75) < 1e-6);
    assert.ok(Math.abs(frame.position.y - 4.81) < 1e-6);
    assert.ok(Math.abs(frame.position.z - 2.52) < 1e-6);
    assert.ok(Math.abs(face.position.x - -6.75) < 1e-6);
    assert.ok(Math.abs(face.position.y - 4.81) < 1e-6);
    assert.ok(Math.abs(face.position.z - 2.56) < 1e-6);

    frame.geometry.computeBoundingBox();
    face.geometry.computeBoundingBox();
    const frameSize = new THREE.Vector3();
    const faceSize = new THREE.Vector3();
    frame.geometry.boundingBox!.getSize(frameSize);
    face.geometry.boundingBox!.getSize(faceSize);
    assert.ok(Math.abs(frameSize.x - 4.44) < 0.02 && Math.abs(frameSize.y - 0.72) < 0.02);
    assert.ok(Math.abs(faceSize.x - 4.26) < 0.02 && Math.abs(faceSize.y - 0.60) < 0.02);
    assert.equal((face.material as THREE.MeshStandardMaterial).map, tex);

    sharedClearGlassMat.dispose();
  } finally {
    (globalThis as { document?: unknown }).document = origDocument;
  }
});

test('buildBeautySalonStudio3D creates curved-corner GLOW STUDIO / BEAUTY & GLOW salon with interior, signage, and finite 3D glass', async () => {
  const { buildBeautySalonStudio3D } = await import('./buddiesBeautySalonBuilder');
  const { updateCityWindowNightLighting } = await import('./buddiesNightLightingRules');

  const drawnTexts: string[] = [];
  const origDocument = (globalThis as { document?: unknown }).document;
  const noop = () => {};
  const spyCtx = new Proxy(
    {
      fillText: (text: string) => {
        drawnTexts.push(String(text));
      },
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      measureText: () => ({ width: 100 }),
    },
    {
      get(target, prop) {
        if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
        return noop;
      },
      set() {
        return true;
      },
    },
  );
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ width: 512, height: 256, getContext: () => spyCtx }),
  };

  try {
    const mock = createMockUrbanPlazaContext();
    try {
      buildBeautySalonStudio3D(mock.ctx);
      mock.staticGroup.updateMatrixWorld(true);
      mock.animatedGroup.updateMatrixWorld(true);

      const salonGrp = mock.staticGroup.getObjectByName('UrbanPlazaBeautySalon3D');
      const glassHost = mock.animatedGroup.getObjectByName('UrbanPlazaBeautySalonGlassHost');
      assert.ok(salonGrp, 'UrbanPlazaBeautySalon3D must exist');
      assert.ok(glassHost, 'UrbanPlazaBeautySalonGlassHost must exist');
      assert.ok(salonGrp.getObjectByName('BeautySalonInterior'), 'BeautySalonInterior must exist inside salon');

      // Verify all requested brand texts were drawn onto signage textures
      assert.ok(drawnTexts.some((t) => t.includes('GLOW STUDIO')), 'Missing GLOW STUDIO signage');
      assert.ok(drawnTexts.some((t) => t.includes('BEAUTY & GLOW')), 'Missing BEAUTY & GLOW parapet signage');
      assert.ok(drawnTexts.some((t) => t.includes('BEAUTY & CARE')), 'Missing BEAUTY & CARE parapet signage');

      // Verify all geometries are finite and valid
      let staticMeshCount = 0;
      salonGrp.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          staticMeshCount++;
          for (const attrName of ['position', 'normal', 'uv'] as const) {
            const attr = obj.geometry.getAttribute(attrName);
            if (attr) {
              const arr = attr.array as ArrayLike<number>;
              for (let i = 0; i < arr.length; i++) {
                assert.equal(Number.isFinite(arr[i]), true, `Non-finite ${attrName} on BeautySalon mesh`);
              }
            }
          }
        }
      });
      assert.ok(staticMeshCount >= 80, `Expected rich architectural & interior mesh count, got ${staticMeshCount}`);

      // Verify 16 tagged 3D window/door glass meshes (8 storefront + 8 upper_floor) and night lighting compatibility
      const windowSpecs: Array<{ id: string; kind: string }> = [];
      glassHost.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.userData?.cityWindowSpec) {
          windowSpecs.push(obj.userData.cityWindowSpec);
          obj.geometry.computeBoundingBox();
          const bb = obj.geometry.boundingBox!;
          const minThickness = Math.min(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
          assert.ok(minThickness >= 0.02, `Salon window ${obj.userData.cityWindowSpec.id} must be >= 0.02m thick`);
        }
      });
      assert.equal(windowSpecs.filter((s) => s.kind === 'storefront').length, 8);
      assert.equal(windowSpecs.filter((s) => s.kind === 'upper_floor').length, 26);

      const updatedCount = updateCityWindowNightLighting(mock.animatedGroup, 0.9, 2.5);
      assert.ok(updatedCount >= 24);
    } finally {
      mock.dispose();
    }
  } finally {
    (globalThis as { document?: unknown }).document = origDocument;
  }
});

test('BoutiqueTower, CozyBitesCafe, and BeautySalon clear storefront glass share zero-draw-call night curtain shaders & LED coves', async () => {
  const { buildBoutiqueRooftopTower3D, buildCozyBitesCafePavilion3D } = await import(
    './buddiesUrbanPlazaBuildingsBuilder'
  );
  const { buildBeautySalonStudio3D } = await import('./buddiesBeautySalonBuilder');
  const { updateCityWindowNightLighting } = await import('./buddiesNightLightingRules');

  await withStubDocument(async () => {
    const mock = createMockUrbanPlazaContext();
    try {
      buildBoutiqueRooftopTower3D(mock.ctx);
      buildCozyBitesCafePavilion3D(mock.ctx);
      buildBeautySalonStudio3D(mock.ctx);

      const boutiqueStatic = mock.staticGroup.getObjectByName('UrbanPlazaBoutiqueTower3D')!;
      const boutiqueGlassHost = mock.animatedGroup.getObjectByName('UrbanPlazaBoutiqueTowerGlassHost')!;
      const cafeStatic = mock.staticGroup.getObjectByName('UrbanPlazaCozyBitesCafe3D')!;
      const cafeGlassHost = mock.animatedGroup.getObjectByName('UrbanPlazaCozyBitesCafeGlassHost')!;
      const salonGlassHost = mock.animatedGroup.getObjectByName('UrbanPlazaBeautySalonGlassHost')!;

      let boutiqueLedCount = 0;
      boutiqueStatic.traverse((obj) => {
        if (obj.name === 'Boutique1FDisplayLedCove') boutiqueLedCount++;
      });
      assert.equal(boutiqueLedCount, 8, 'Expected 8 1F vitrine LED cove strips in BoutiqueTower');

      let cafeLedCount = 0;
      cafeStatic.traverse((obj) => {
        if (obj.name === 'CozyBitesShowcaseLedCove') cafeLedCount++;
      });
      assert.equal(cafeLedCount, 7, 'Expected 7 1F showcase LED cove strips in CozyBitesCafe');

      const sharedGlassMats = new Set<THREE.Material>();
      for (const host of [boutiqueGlassHost, cafeGlassHost, salonGlassHost]) {
        host.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.userData?.cityWindowSpec?.kind === 'storefront') {
            const mat = obj.material as THREE.MeshStandardMaterial;
            assert.equal(mat.transparent, true);
            assert.equal(mat.depthWrite, false);
            assert.ok(mat.opacity <= 0.35);
            assert.equal(mat.userData.preserveSharedMaterial, true);
            assert.equal(mat.userData.cityClearStorefrontGlassHooked, true);
            assert.ok(mat.userData.cityGlassNightUniform);
            sharedGlassMats.add(mat);
          }
        });
      }
      assert.ok(sharedGlassMats.size <= 3, `Expected shared clear glass materials across storefronts, got ${sharedGlassMats.size}`);

      updateCityWindowNightLighting(mock.animatedGroup, 0.02, 0);
      for (const mat of sharedGlassMats) {
        assert.equal(mat.userData.cityGlassNightUniform.value, 0.02);
      }
      updateCityWindowNightLighting(mock.animatedGroup, 1.0, 3.0);
      for (const mat of sharedGlassMats) {
        assert.equal(mat.userData.cityGlassNightUniform.value, 1.0);
      }
    } finally {
      mock.dispose();
    }
  });
});
