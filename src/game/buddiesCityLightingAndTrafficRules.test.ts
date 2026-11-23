import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  CITY_TRAFFIC_SIGNAL_POLE_SPECS,
  CITY_TRAFFIC_SIGN_SPECS,
  PLAZA_TRAFFIC_SIGNAL_SPEC,
  createInitialPlazaTrafficSignalState,
  evaluateCityTramConsistState,
  sampleCityTramTrackAtDistance,
} from './buddiesBlitzRules';
import { DEFAULT_ARENA_MAP_LAYOUT } from './buddiesBlitzWorldBuilder';
import {
  evaluateBlitzGrassMask,
  evaluateHaltePlatformSdf,
  evaluateRoadNetworkSdf,
  isPointOnInnerTramSidewalk,
  isPointOnOuterTramSidewalk,
  isPointOnZebraCrosswalk,
} from './buddiesPlanetCurvature';
import { buildCityLightingAndTrafficSystem } from './buddiesCityLightingAndTrafficBuilder';
import {
  CITY_BUILDING_GLOW_MANIFEST,
  CITY_LAMP_MANIFEST,
  CITY_TRAFFIC_TRACKS,
  EXISTING_CITY_LAMP_POOL_ANCHORS,
  computeCityIlluminationLevels,
  createInitialTrafficFleetState,
  evaluateLanternBillboardDistanceScale,
  evaluateLanternCoreAndSpriteState,
  evaluateSmoothRadialGlowFalloff,
  isInsideBuildingOrPropFootprint,
  isInsideCentralParkExclusionZone,
  isValidCityLampPlacement,
  sampleTrafficTrackAtDistance,
  stepCityTrafficFleet,
  type CityLampDistrict,
  type LampTier,
  type TrafficLoopId,
} from './buddiesCityLightingAndTrafficRules';

test('4-tier lamp manifest spans all districts without overlapping roads, water, props, signs, poles, or Central Park', () => {
  assert.ok(CITY_LAMP_MANIFEST.length >= 60, `Expected >= 60 city lamps, got ${CITY_LAMP_MANIFEST.length}`);

  const tierCounts: Record<LampTier, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const districtsPresent = new Set<CityLampDistrict>();
  const seenIds = new Set<string>();
  const lampById = new Map<string, (typeof CITY_LAMP_MANIFEST)[number]>();

  for (let i = 0; i < CITY_LAMP_MANIFEST.length; i++) {
    const lamp = CITY_LAMP_MANIFEST[i];
    assert.ok(!seenIds.has(lamp.id), `Duplicate lamp id ${lamp.id}`);
    seenIds.add(lamp.id);
    lampById.set(lamp.id, lamp);

    tierCounts[lamp.tier]++;
    districtsPresent.add(lamp.district);

    if (lamp.tier === 4) {
      assert.equal(lamp.hasFlowerBaskets, true, `Tier 4 lamp ${lamp.id} should carry flower baskets`);
    } else {
      assert.equal(lamp.hasFlowerBaskets, false, `Non-Tier-4 lamp ${lamp.id} should not carry baskets`);
    }

    assert.equal(
      isInsideCentralParkExclusionZone(lamp.x, lamp.z),
      false,
      `Lamp ${lamp.id} (${lamp.x}, ${lamp.z}) encroached Central Park exclusion zone`,
    );
    // Strict inner urban plaza box
    const insideParkCore =
      (lamp.x >= -10.2 && lamp.x <= 53.8 && Math.abs(lamp.z) <= 22.1) ||
      (lamp.x >= 53.8 && lamp.x <= 57.8 && Math.abs(lamp.z) <= 11.4);
    assert.equal(insideParkCore, false, `Lamp ${lamp.id} spawned inside Central Urban Plaza interior`);

    assert.equal(
      isInsideBuildingOrPropFootprint(lamp.x, lamp.z),
      false,
      `Lamp ${lamp.id} overlapped building/ride/halte footprint`,
    );
    assert.equal(
      isPointOnZebraCrosswalk(lamp.x, lamp.z),
      false,
      `Lamp ${lamp.id} overlapped zebra crosswalk`,
    );
    assert.equal(
      lamp.x >= -76.9 && lamp.x <= -73.85 && Math.abs(lamp.z) < 12.2,
      false,
      `Lamp ${lamp.id} obstructed Central Plaza lower staircase landing`,
    );
    assert.equal(
      isValidCityLampPlacement(lamp.x, lamp.z),
      true,
      `Lamp ${lamp.id} (${lamp.x}, ${lamp.z}) failed placement validation (roadSdf=${evaluateRoadNetworkSdf(lamp.x, lamp.z).toFixed(2)})`,
    );

    // Zero stray residential posts in empty grass plots
    assert.equal(
      lamp.id.includes('res_blue1') || lamp.id.includes('res_red0'),
      false,
      `Stray empty-lot lamp ${lamp.id} must be removed`,
    );

    // Strict Tier 3 Sidewalk & Grass Verge Rule:
    // ZERO Tier 3 poles on paved urban sidewalks; placed off-sidewalk in grass/soil verges
    // (or Harbor concrete apron where no grass verge exists), with 'corner' strictly at corners.
    const onPlazaSidewalk = lamp.x >= -76.65 && lamp.x <= -73.85 && Math.abs(lamp.z) <= 38.2;
    if (lamp.tier === 3) {
      assert.ok(
        lamp.lampVariant === 'single' || lamp.lampVariant === 'corner',
        `Tier 3 lamp ${lamp.id} must define lampVariant ('single' | 'corner')`,
      );
      assert.equal(onPlazaSidewalk, false, `Tier 3 lamp ${lamp.id} must NOT sit on West Plaza sidewalk`);
      assert.equal(
        isPointOnOuterTramSidewalk(lamp.x, lamp.z),
        false,
        `Tier 3 lamp ${lamp.id} must NOT sit on Outer Tram sidewalk`,
      );
      assert.equal(
        isPointOnInnerTramSidewalk(lamp.x, lamp.z),
        false,
        `Tier 3 lamp ${lamp.id} must NOT sit on Inner Tram sidewalk`,
      );
      assert.ok(
        evaluateHaltePlatformSdf(lamp.x, lamp.z) >= 0.45,
        `Tier 3 lamp ${lamp.id} (${lamp.x}, ${lamp.z}) too close to sidewalk/platform`,
      );
      assert.equal(lamp.y, 0, `Tier 3 lamp ${lamp.id} must stand at ground level y=0`);

      const onHarborConcreteApron = lamp.district === 'harbor_dock' || (lamp.x >= 76.0 && Math.abs(lamp.z) <= 46.0);
      if (!onHarborConcreteApron) {
        const gMask = evaluateBlitzGrassMask(lamp.x, lamp.z);
        assert.ok(
          gMask > 0.4,
          `Tier 3 lamp ${lamp.id} (${lamp.x}, ${lamp.z}) must sit on grass/soil verge (grass=${gMask.toFixed(2)})`,
        );
      }

      const expectedCornerIds = new Set([
        'lamp_t3_casino_connector',
        'lamp_t3_outer_sw_corner',
        'lamp_t3_outer_n_5',
        'lamp_t3_outer_s_5',
        'lamp_t3_inner_nw_c',
        'lamp_t3_inner_ne_c',
        'lamp_t3_inner_se_c',
        'lamp_t3_inner_sw_c',
        'lamp_t3_scurve_wn',
        'lamp_t3_scurve_ws',
        'lamp_t3_scurve_en',
        'lamp_t3_scurve_es',
      ]);
      if (expectedCornerIds.has(lamp.id)) {
        assert.equal(lamp.lampVariant, 'corner', `Corner lamp ${lamp.id} must use 'corner' variant`);
        assert.equal(lamp.poolRadius, 10.8);
      } else {
        assert.equal(lamp.lampVariant, 'single', `Straight lamp ${lamp.id} must use 'single' variant`);
        assert.equal(lamp.poolRadius, 9.2);
      }
    } else if (
      (onPlazaSidewalk || isPointOnOuterTramSidewalk(lamp.x, lamp.z) || isPointOnInnerTramSidewalk(lamp.x, lamp.z)) &&
      lamp.district !== 'harbor_dock' &&
      lamp.district !== 'se_beach'
    ) {
      const rSdf = evaluateRoadNetworkSdf(lamp.x, lamp.z);
      assert.ok(rSdf <= 0.65, `Sidewalk lamp ${lamp.id} (${lamp.x}, ${lamp.z}) must sit on curb strip <= 0.65m (got ${rSdf.toFixed(2)}m)`);
    }

    for (const prop of DEFAULT_ARENA_MAP_LAYOUT.props) {
      const d = Math.hypot(lamp.x - prop.x, lamp.z - prop.z);
      assert.ok(d >= 2.2, `Lamp ${lamp.id} too close (${d.toFixed(2)}m) to prop ${prop.id}`);
    }
    for (const pole of CITY_TRAFFIC_SIGNAL_POLE_SPECS) {
      const d = Math.hypot(lamp.x - pole.x, lamp.z - pole.z);
      assert.ok(d >= 2.5, `Lamp ${lamp.id} too close (${d.toFixed(2)}m) to signal pole`);
    }
    for (const sign of CITY_TRAFFIC_SIGN_SPECS) {
      const d = Math.hypot(lamp.x - sign.x, lamp.z - sign.z);
      assert.ok(d >= 3.0, `Lamp ${lamp.id} too close (${d.toFixed(2)}m) to traffic sign ${sign.id}`);
    }
    for (const ex of EXISTING_CITY_LAMP_POOL_ANCHORS) {
      const d = Math.hypot(lamp.x - ex.x, lamp.z - ex.z);
      assert.ok(d >= 3.5, `Lamp ${lamp.id} too close (${d.toFixed(2)}m) to existing lamp ${ex.id}`);
    }

    for (let j = i + 1; j < CITY_LAMP_MANIFEST.length; j++) {
      const other = CITY_LAMP_MANIFEST[j];
      const d = Math.hypot(lamp.x - other.x, lamp.z - other.z);
      assert.ok(d >= 4.5, `Lamps ${lamp.id} and ${other.id} too close (${d.toFixed(2)}m < 4.5m)`);
    }
  }

  // Residential collector streetlamps and Outer N/S Boulevard lamps must be North-South mirrored
  for (const id of ['w30', '0w', '0e', 'e30', 'e60'] as const) {
    const sLamp = lampById.get(`lamp_t3_res_s_${id}`);
    const nLamp = lampById.get(`lamp_t3_res_n_${id}`);
    assert.ok(sLamp && nLamp, `Missing N/S mirrored residential lamp pair ${id}`);
    assert.equal(sLamp.x, nLamp.x);
    assert.equal(sLamp.z, -nLamp.z);
  }
  for (const idx of [1, 2, 3, 4, 5] as const) {
    const nLamp = lampById.get(`lamp_t3_outer_n_${idx}`);
    const sLamp = lampById.get(`lamp_t3_outer_s_${idx}`);
    assert.ok(nLamp && sLamp, `Missing N/S mirrored outer boulevard pair ${idx}`);
    assert.equal(nLamp.x, sLamp.x);
    assert.equal(nLamp.z, -sLamp.z);
  }

  assert.ok(tierCounts[1] >= 16, 'Expected substantial Tier 1 pathway bollards');
  assert.ok(tierCounts[2] >= 12, 'Expected Tier 2 brick pedestal lanterns');
  assert.ok(tierCounts[3] >= 24, 'Expected Tier 3 modernized LED streetlamps');
  assert.ok(tierCounts[4] >= 8, 'Expected Tier 4 grand Victorian chandelier posts');
  assert.ok(districtsPresent.size >= 9, `Expected city-wide coverage across >=9 districts, got ${districtsPresent.size}`);
  assert.ok(EXISTING_CITY_LAMP_POOL_ANCHORS.length >= 14);
  assert.ok(CITY_BUILDING_GLOW_MANIFEST.length >= 26);
});

test('city illumination levels track dusk, night, dawn, rain, fog, and weatherEnvState.cityLightsScale', () => {
  const noon = computeCityIlluminationLevels(null, 'day');
  assert.equal(noon.streetLampBrightness01, 0);
  assert.equal(noon.windowGlow01, 0);
  assert.equal(noon.groundPoolOpacity01, 0);
  assert.equal(noon.headlightOn, false);
  assert.equal(noon.headlightStrength01, 0);

  const dusk = computeCityIlluminationLevels(null, 'dusk');
  assert.ok(dusk.streetLampBrightness01 > 0.5);
  assert.ok(dusk.windowGlow01 > 0.5);
  assert.ok(dusk.groundPoolOpacity01 > 0.4);
  assert.equal(dusk.headlightOn, true);

  const night = computeCityIlluminationLevels(null, 'night');
  assert.ok(night.streetLampBrightness01 > dusk.streetLampBrightness01);
  assert.ok(night.groundPoolOpacity01 > dusk.groundPoolOpacity01);
  assert.equal(night.headlightOn, true);

  const dawn = computeCityIlluminationLevels(null, 'dawn');
  assert.ok(dawn.streetLampBrightness01 > 0.4);
  assert.equal(dawn.headlightOn, true);

  // Heavy rain or dense fog turns lamps, windows, and vehicle headlights on even during daytime
  const heavyRain = computeCityIlluminationLevels(
    { phase: 'day', nightFactor01: 0, duskDawnFactor01: 0, rainFactor01: 0.92, fogFactor01: 0.3, cityLightsScale: 1.0 },
    'day',
  );
  assert.ok(heavyRain.streetLampBrightness01 > 0.45);
  assert.ok(heavyRain.windowGlow01 > 0.35);
  assert.equal(heavyRain.headlightOn, true);

  const denseFog = computeCityIlluminationLevels(
    { phase: 'day', nightFactor01: 0, duskDawnFactor01: 0, rainFactor01: 0, fogFactor01: 0.85, cityLightsScale: 1.0 },
    'day',
  );
  assert.ok(denseFog.streetLampBrightness01 > 0.35);
  assert.equal(denseFog.headlightOn, true);

  // Shared @dynamiccuaca cityLightsScale scales brightness smoothly without exceeding clamps
  const scaledBright = computeCityIlluminationLevels(
    { nightFactor01: 1.0, cityLightsScale: 2.0 },
    'day',
  );
  assert.ok(scaledBright.streetLampBrightness01 > night.streetLampBrightness01 * 1.5);
  assert.ok(scaledBright.windowGlow01 > night.windowGlow01 * 1.5);

  // Phase override when weatherEnvState omits duskDawnFactor01
  const dynamicDusk = computeCityIlluminationLevels({ phase: 'dusk', nightFactor01: 0.5 }, 'day');
  assert.ok(dynamicDusk.duskDawnFactor01 >= 0.8);
});

test('all 6 autonomous traffic tracks stay 100% on asphalt and separate cleanly from tram rails', () => {
  const loopIds = Object.keys(CITY_TRAFFIC_TRACKS) as TrafficLoopId[];
  assert.equal(loopIds.length, 6);

  for (const id of loopIds) {
    const track = CITY_TRAFFIC_TRACKS[id];
    assert.ok(track.totalLength >= 150, `Track ${id} unexpectedly short: ${track.totalLength}`);

    const sampleCount = 360;
    for (let i = 0; i < sampleCount; i++) {
      const d = (i / sampleCount) * track.totalLength;
      const sample = sampleTrafficTrackAtDistance(track, d);
      const roadSdf = evaluateRoadNetworkSdf(sample.x, sample.z);
      assert.ok(
        roadSdf <= -0.9,
        `Track ${id} drifted off asphalt at d=${d.toFixed(1)} (${sample.x.toFixed(2)}, ${sample.z.toFixed(2)}), roadSdf=${roadSdf.toFixed(2)}`,
      );

      // Ring car lanes must never overlap the inner rounded-rect tram track centerline (|x|=65, |z|=47, R=3)
      if (id === 'ring_cw' || id === 'ring_ccw') {
        const qx = Math.abs(sample.x) - 62.0;
        const qz = Math.abs(sample.z) - 44.0;
        const signedRoundedSdf =
          Math.hypot(Math.max(0, qx), Math.max(0, qz)) +
          Math.min(0, Math.max(qx, qz)) -
          3.0;
        const distOutsideTramTrack = Math.abs(signedRoundedSdf);
        assert.ok(
          distOutsideTramTrack >= 4.1,
          `Ring car lane ${id} too close (${distOutsideTramTrack.toFixed(2)}m) to tram track at (${sample.x.toFixed(2)}, ${sample.z.toFixed(2)})`,
        );
      }
    }

    // Verify smooth loop wrap continuity
    const sStart = sampleTrafficTrackAtDistance(track, 0.01);
    const sEnd = sampleTrafficTrackAtDistance(track, track.totalLength - 0.01);
    assert.ok(
      Math.hypot(sStart.x - sEnd.x, sStart.z - sEnd.z) < 0.1,
      `Track ${id} has positional discontinuity across loop wrap`,
    );
  }
});

test('traffic vehicles obey Plaza & East traffic signals, yield to City Tram, hold safe headway, and stop for pedestrians', () => {
  const baseFleet = createInitialTrafficFleetState();
  assert.equal(baseFleet.length, 16);

  // Move tram far out of the way (East Harbor far corner) when testing Plaza signal alone
  const parkTramFarAway = evaluateCityTramConsistState(240.0);

  // 1. Signal Red-Stop Compliance on Central Plaza North Stop Bar (`z = -5.40`, ring_cw NB)
  const cwTrack = CITY_TRAFFIC_TRACKS.ring_cw;
  let targetDist = 0;
  for (let d = 0; d < cwTrack.totalLength; d += 0.25) {
    const s = sampleTrafficTrackAtDistance(cwTrack, d);
    // Find point around x = -69.32, z = +7.5 moving northbound (forwardZ < -0.9)
    if (s.x < -68 && s.z > 7.0 && s.z < 8.0 && s.forwardZ < -0.9) {
      targetDist = d;
      break;
    }
  }
  assert.ok(targetDist > 0, 'Could not locate ring_cw northbound approach to Plaza North stop bar');

  const signalVehicle = {
    ...baseFleet[0],
    loopId: 'ring_cw' as const,
    distanceMeters: targetDist,
    speedMps: 11.2,
    x: sampleTrafficTrackAtDistance(cwTrack, targetDist).x,
    z: sampleTrafficTrackAtDistance(cwTrack, targetDist).z,
    yaw: sampleTrafficTrackAtDistance(cwTrack, targetDist).yaw,
    forwardX: sampleTrafficTrackAtDistance(cwTrack, targetDist).forwardX,
    forwardZ: sampleTrafficTrackAtDistance(cwTrack, targetDist).forwardZ,
  };

  const plazaRedSignal = createInitialPlazaTrafficSignalState('tram_red', 0);
  const plazaGreenSignal = createInitialPlazaTrafficSignalState('tram_green', 0);

  for (let step = 0; step < 90; step++) {
    stepCityTrafficFleet([signalVehicle], 1 / 30, {
      tramState: parkTramFarAway,
      plazaSignalState: plazaRedSignal,
      eastSignalState: plazaGreenSignal,
    });
  }

  const noseZAtStop = signalVehicle.z + signalVehicle.forwardZ * signalVehicle.halfLength;
  assert.ok(signalVehicle.speedMps <= 0.1, `Expected stopped car at red signal, speed=${signalVehicle.speedMps}`);
  assert.ok(
    noseZAtStop >= PLAZA_TRAFFIC_SIGNAL_SPEC.northStopBarZ - 0.45,
    `Vehicle overshot Plaza north stop bar (-5.40): noseZ=${noseZAtStop.toFixed(2)}`,
  );
  assert.equal(signalVehicle.stoppedReason, 'signal');
  assert.equal(signalVehicle.isBraking, true);
  assert.ok(signalVehicle.brakeLightIntensity01 > 0.65);

  // Once signal turns green (`tram_green`), vehicle accelerates smoothly
  for (let step = 0; step < 45; step++) {
    stepCityTrafficFleet([signalVehicle], 1 / 30, {
      tramState: parkTramFarAway,
      plazaSignalState: plazaGreenSignal,
      eastSignalState: plazaGreenSignal,
    });
  }
  assert.ok(signalVehicle.speedMps > 5.0, 'Vehicle should accelerate cleanly once signal turns green');
  assert.equal(signalVehicle.isBraking, false);

  // 2. City Tram Consist Yielding at Inner Crossing
  const scurveTrack = CITY_TRAFFIC_TRACKS.scurve_central;
  const tramLoopLen = sampleCityTramTrackAtDistance(0).totalTrackLength;
  // Place tram directly on the east track near (x=65, z=-13.4) where scurve_central crosses eastbound
  let tramAtEastDist = 0;
  let bestTramDelta = Infinity;
  for (let d = 0; d < tramLoopLen; d += 0.5) {
    const ts = sampleCityTramTrackAtDistance(d);
    if (ts.x > 62) {
      const delta = Math.abs(ts.z - (-13.4));
      if (delta < bestTramDelta) {
        bestTramDelta = delta;
        tramAtEastDist = d;
      }
    }
  }
  assert.ok(bestTramDelta < 1.0, 'Could not find tram east crossing point');
  const tramBlockingEast = evaluateCityTramConsistState(tramAtEastDist);

  // Place an S-curve car approaching (x=65, z=-13.4) from west (around x=58.8, z=-13.4, facing +X)
  let scApproachDist = 0;
  let bestDelta = Infinity;
  for (let d = 0; d < scurveTrack.totalLength; d += 0.25) {
    const s = sampleTrafficTrackAtDistance(scurveTrack, d);
    if (s.x > 55 && s.x < 62 && Math.abs(s.z + 13.4) < 1.5 && s.forwardX > 0.7) {
      const delta = Math.abs(s.x - 58.8);
      if (delta < bestDelta) {
        bestDelta = delta;
        scApproachDist = d;
      }
    }
  }
  assert.ok(bestDelta < 1.0, 'Could not find scurve_central eastbound crossing point');
  const sCarSample = sampleTrafficTrackAtDistance(scurveTrack, scApproachDist);
  const tramYieldCar = {
    ...baseFleet[1],
    loopId: 'scurve_central' as const,
    distanceMeters: scApproachDist,
    speedMps: 9.0,
    x: sCarSample.x,
    z: sCarSample.z,
    yaw: sCarSample.yaw,
    forwardX: sCarSample.forwardX,
    forwardZ: sCarSample.forwardZ,
  };
  for (let step = 0; step < 30; step++) {
    stepCityTrafficFleet([tramYieldCar], 1 / 30, {
      tramState: tramBlockingEast,
      plazaSignalState: plazaGreenSignal,
      eastSignalState: plazaGreenSignal,
    });
  }
  assert.equal(tramYieldCar.stoppedReason, 'tram', 'Vehicle crossing tram rails must yield to nearby tram consist');
  assert.ok(tramYieldCar.speedMps <= 0.1, `Expected tram-yielding car stopped, got ${tramYieldCar.speedMps}`);

  // 3. Same-Loop Safe Following Headway
  const leadTrack = CITY_TRAFFIC_TRACKS.residential_south;
  const leadCarDist = 45.0;
  const followCarDist = 30.0;
  const leadSample = sampleTrafficTrackAtDistance(leadTrack, leadCarDist);
  const followSample = sampleTrafficTrackAtDistance(leadTrack, followCarDist);
  const leadCar = {
    ...baseFleet[0],
    id: 'lead',
    loopId: 'residential_south' as const,
    distanceMeters: leadCarDist,
    speedMps: 0,
    x: leadSample.x,
    z: leadSample.z,
    yaw: leadSample.yaw,
    forwardX: leadSample.forwardX,
    forwardZ: leadSample.forwardZ,
  };
  const followCar = {
    ...baseFleet[1],
    id: 'follow',
    loopId: 'residential_south' as const,
    distanceMeters: followCarDist,
    speedMps: 10.5,
    x: followSample.x,
    z: followSample.z,
    yaw: followSample.yaw,
    forwardX: followSample.forwardX,
    forwardZ: followSample.forwardZ,
  };
  // Place pedestrian directly in front of leadCar so leadCar remains stopped
  const blockingPed = {
    x: leadSample.x + leadSample.forwardX * (leadCar.halfLength + 1.5),
    z: leadSample.z + leadSample.forwardZ * (leadCar.halfLength + 1.5),
  };
  for (let step = 0; step < 150; step++) {
    stepCityTrafficFleet([leadCar, followCar], 1 / 30, {
      tramState: parkTramFarAway,
      plazaSignalState: plazaGreenSignal,
      eastSignalState: plazaGreenSignal,
      pedestrians: [blockingPed],
    });
  }
  assert.equal(leadCar.stoppedReason, 'pedestrian');
  assert.equal(followCar.stoppedReason, 'headway');
  assert.ok(followCar.speedMps <= 0.1);
  const bumperGap =
    leadCar.distanceMeters -
    followCar.distanceMeters -
    (leadCar.halfLength + followCar.halfLength);
  assert.ok(bumperGap >= 2.8, `Expected safe following gap >= 2.8m, got ${bumperGap.toFixed(2)}m`);

  // 4. Player Pose Yielding & East Harbor Stop-Bar Compliance
  const playerBlock = {
    x: followCar.x + followCar.forwardX * (followCar.halfLength + 1.4),
    z: followCar.z + followCar.forwardZ * (followCar.halfLength + 1.4),
    alive: true,
  };
  followCar.speedMps = 6.0;
  for (let step = 0; step < 30; step++) {
    stepCityTrafficFleet([followCar], 1 / 30, {
      tramState: parkTramFarAway,
      plazaSignalState: plazaGreenSignal,
      eastSignalState: plazaGreenSignal,
      playerPose: playerBlock,
    });
  }
  assert.equal(followCar.stoppedReason, 'pedestrian');
  assert.ok(followCar.speedMps <= 0.1);

  let eastApproachDist = 0;
  for (let d = 0; d < cwTrack.totalLength; d += 0.25) {
    const s = sampleTrafficTrackAtDistance(cwTrack, d);
    if (s.x > 68 && s.z > -16.5 && s.z < -15.5 && s.forwardZ > 0.9) {
      eastApproachDist = d;
      break;
    }
  }
  assert.ok(eastApproachDist > 0, 'Could not find ring_cw southbound approach to East stop bar');
  const eastSample = sampleTrafficTrackAtDistance(cwTrack, eastApproachDist);
  const eastCar = {
    ...baseFleet[0],
    loopId: 'ring_cw' as const,
    distanceMeters: eastApproachDist,
    speedMps: 11.2,
    x: eastSample.x,
    z: eastSample.z,
    yaw: eastSample.yaw,
    forwardX: eastSample.forwardX,
    forwardZ: eastSample.forwardZ,
  };
  for (let step = 0; step < 90; step++) {
    stepCityTrafficFleet([eastCar], 1 / 30, {
      tramState: parkTramFarAway,
      plazaSignalState: plazaGreenSignal,
      eastSignalState: plazaRedSignal,
    });
  }
  assert.equal(eastCar.stoppedReason, 'signal');
  assert.ok(eastCar.speedMps <= 0.1);
  assert.ok(eastCar.z + eastCar.forwardZ * eastCar.halfLength <= PLAZA_TRAFFIC_SIGNAL_SPEC.eastStopBarZ + 0.45);
});

test('3D GPU-instanced city lighting builder removes all CityTraffic_* meshes, uses zero PointLights, sets frustumCulled bounding volumes, hides night FX in noon, activates on night/rain/fog, and disposes cleanly', () => {
  const scene = new THREE.Scene();
  const handle = buildCityLightingAndTrafficSystem(scene, undefined, false);

  assert.equal(handle.stats.pointLightCount, 0);
  assert.equal(handle.stats.lampCount, CITY_LAMP_MANIFEST.length);
  assert.equal(handle.stats.trafficVehicleCount, 0);
  assert.equal(handle.getVehicleCollisionBoxes().length, 0);
  assert.equal(handle.getFleetState().length, 0);

  let foundPointLights = 0;
  let instancedCount = 0;
  const trafficObjects: string[] = [];
  const instancedNames = new Set<string>();
  handle.rootGroup.traverse((obj) => {
    if (obj.name.startsWith('CityTraffic_')) {
      trafficObjects.push(obj.name);
    }
    if ((obj as THREE.Light).isLight && obj.type === 'PointLight') {
      foundPointLights++;
    }
    if ((obj as THREE.InstancedMesh).isInstancedMesh) {
      const im = obj as THREE.InstancedMesh;
      instancedCount++;
      instancedNames.add(im.name);
      assert.equal(im.frustumCulled, true, `InstancedMesh ${im.name} should have frustumCulled=true`);
      assert.ok(im.boundingSphere && Number.isFinite(im.boundingSphere.radius) && im.boundingSphere.radius > 0);
    }
  });
  assert.deepEqual(trafficObjects, [], 'Must have zero CityTraffic_* objects in rootGroup');
  assert.equal(foundPointLights, 0, 'Must never add THREE.PointLight instances');
  assert.equal(instancedCount, handle.stats.instancedMeshCount);
  assert.equal(instancedCount, 34, `Expected 34 city lighting instanced batches, got ${instancedCount}`);

  for (const requiredName of [
    'CityLamp_Tier1_Metal',
    'CityLamp_Tier1_Bulb',
    'CityLamp_Tier1_Glass',
    'CityLamp_Tier2_Brick',
    'CityLamp_Tier2_Stone',
    'CityLamp_Tier2_Iron',
    'CityLamp_Tier2_Bulb',
    'CityLamp_Tier2_Glass',
    'CityLamp_Tier2_Pier_Iron',
    'CityLamp_Tier2_Pier_Bulb',
    'CityLamp_Tier2_Pier_Glass',
    'CityLamp_Tier3_Single_Metal',
    'CityLamp_Tier3_Single_Bulb',
    'CityLamp_Tier3_Single_Glass',
    'CityLamp_Tier3_Corner_Metal',
    'CityLamp_Tier3_Corner_Bulb',
    'CityLamp_Tier3_Corner_Glass',
    'CityLamp_Tier4_Granite',
    'CityLamp_Tier4_Iron',
    'CityLamp_Tier4_Bulb',
    'CityLamp_Tier4_Glass',
    'CityLamp_Tier4_Wicker',
    'CityLamp_Tier4_Ivy',
    'CityLamp_Tier4_Blooms',
    'CityLamp_GroundLightPools',
    'CityLamp_LanternHalos',
    'CityBuilding_NightGlowPanes',
  ]) {
    assert.ok(instancedNames.has(requiredName), `Missing expected lighting batch ${requiredName}`);
  }

  // Verify CityLamp_LanternHalos uses a camera-facing 4-vertex billboard quad (ZERO crossed planar quads)
  const haloInstMesh = handle.rootGroup.getObjectByName('CityLamp_LanternHalos') as THREE.InstancedMesh;
  assert.equal(
    haloInstMesh.geometry.getAttribute('position').count,
    4,
    'Lantern halos must be a single 4-vertex camera-facing billboard quad, not crossed planar quads',
  );
  const haloShaderMat = haloInstMesh.material as THREE.ShaderMaterial;
  assert.equal(haloShaderMat.isShaderMaterial, true, 'Lantern halos must use camera-facing billboard ShaderMaterial');
  assert.equal(haloShaderMat.blending, THREE.AdditiveBlending);
  assert.equal(haloShaderMat.depthWrite, false);
  assert.equal(haloShaderMat.transparent, true);
  assert.equal(haloShaderMat.fog, true);

  // Verify modernized Tier 3 geometry height (~4.62m), dual halos per corner lamp, and shifted ground pools
  const t3SingleMesh = handle.rootGroup.getObjectByName('CityLamp_Tier3_Single_Metal') as THREE.InstancedMesh;
  const t3CornerMesh = handle.rootGroup.getObjectByName('CityLamp_Tier3_Corner_Metal') as THREE.InstancedMesh;
  t3SingleMesh.geometry.computeBoundingBox();
  t3CornerMesh.geometry.computeBoundingBox();
  const singleBox = t3SingleMesh.geometry.boundingBox!;
  const cornerBox = t3CornerMesh.geometry.boundingBox!;
  assert.ok(singleBox.max.y >= 4.55 && singleBox.max.y <= 4.75, `Tier 3 single height ${singleBox.max.y}`);
  assert.ok(cornerBox.max.y >= 4.55 && cornerBox.max.y <= 4.75, `Tier 3 corner height ${cornerBox.max.y}`);
  const tier3SingleCount = CITY_LAMP_MANIFEST.filter((l) => l.tier === 3 && l.lampVariant === 'single').length;
  const tier3CornerCount = CITY_LAMP_MANIFEST.filter((l) => l.tier === 3 && l.lampVariant === 'corner').length;
  assert.equal(t3SingleMesh.count, tier3SingleCount);
  assert.equal(t3CornerMesh.count, tier3CornerCount);

  const expectedHalos =
    CITY_LAMP_MANIFEST.filter((l) => l.tier === 1).length +
    CITY_LAMP_MANIFEST.filter((l) => l.tier === 2).length +
    tier3SingleCount +
    tier3CornerCount * 2 +
    CITY_LAMP_MANIFEST.filter((l) => l.tier === 4).length * 5 +
    EXISTING_CITY_LAMP_POOL_ANCHORS.length;
  assert.equal(handle.stats.lanternHaloCount, expectedHalos);

  // Verify Tier 3 ground pool matrices are shifted outward onto sidewalk+road rather than centered on pole base
  const poolMesh = handle.rootGroup.getObjectByName('CityLamp_GroundLightPools') as THREE.InstancedMesh;
  const firstT3Idx = CITY_LAMP_MANIFEST.findIndex((l) => l.tier === 3);
  const firstT3 = CITY_LAMP_MANIFEST[firstT3Idx];
  const poolMat4 = new THREE.Matrix4();
  const poolPos = new THREE.Vector3();
  poolMesh.getMatrixAt(firstT3Idx, poolMat4);
  poolPos.setFromMatrixPosition(poolMat4);
  assert.ok(
    Math.hypot(poolPos.x - firstT3.x, poolPos.z - firstT3.z) >= 1.9,
    `Tier 3 ground pool must be shifted outward from pole base (${poolPos.x.toFixed(2)}, ${poolPos.z.toFixed(2)})`,
  );

  const tramState = evaluateCityTramConsistState(328.0);
  const greenSignal = createInitialPlazaTrafficSignalState('tram_green', 0);
  const byName = (name: string) => handle.rootGroup.getObjectByName(name)!;

  // Clear daytime update (nightFactor01 <= 0.05): pools, halos, and building windows stay hidden
  handle.update({
    dt: 1 / 60,
    timeSec: 1.0,
    tramState,
    plazaSignalState: greenSignal,
    eastSignalState: greenSignal,
    fallbackPreset: 'day',
  });
  assert.equal(byName('CityLamp_GroundLightPools').visible, false);
  assert.equal(byName('CityLamp_LanternHalos').visible, false);
  assert.equal(haloShaderMat.uniforms.uOpacity.value, 0);
  assert.equal(byName('CityBuilding_NightGlowPanes').visible, false);

  handle.update({
    dt: 1 / 60,
    timeSec: 1.5,
    tramState,
    plazaSignalState: greenSignal,
    eastSignalState: greenSignal,
    fallbackPreset: 'day',
    weatherEnvState: { phase: 'day', nightFactor01: 0.05, duskDawnFactor01: 0, rainFactor01: 0, fogFactor01: 0 },
  });
  assert.equal(byName('CityLamp_GroundLightPools').visible, false);
  assert.equal(byName('CityLamp_LanternHalos').visible, false);
  assert.equal(haloShaderMat.uniforms.uOpacity.value, 0);
  assert.equal(byName('CityBuilding_NightGlowPanes').visible, false);

  // Nighttime update via shared @dynamiccuaca contract: activates pools, halos, and windows
  handle.update({
    dt: 1 / 60,
    timeSec: 2.0,
    tramState,
    plazaSignalState: greenSignal,
    eastSignalState: greenSignal,
    fallbackPreset: 'day',
    weatherEnvState: { phase: 'night', nightFactor01: 1.0, cityLightsScale: 1.25 },
  });
  assert.equal(byName('CityLamp_GroundLightPools').visible, true);
  assert.equal(byName('CityLamp_LanternHalos').visible, true);
  assert.ok(haloShaderMat.uniforms.uOpacity.value > 0.5);
  assert.equal(byName('CityBuilding_NightGlowPanes').visible, true);

  // Daytime heavy rain activates city illumination batches automatically
  handle.update({
    dt: 1 / 60,
    timeSec: 3.0,
    tramState,
    plazaSignalState: greenSignal,
    eastSignalState: greenSignal,
    fallbackPreset: 'day',
    weatherEnvState: { phase: 'day', nightFactor01: 0, duskDawnFactor01: 0, rainFactor01: 0.92, fogFactor01: 0, cityLightsScale: 1.0 },
  });
  assert.equal(byName('CityLamp_GroundLightPools').visible, true);
  assert.equal(byName('CityLamp_LanternHalos').visible, true);
  assert.equal(byName('CityBuilding_NightGlowPanes').visible, true);

  // Daytime dense fog activates city illumination batches automatically
  handle.update({
    dt: 1 / 60,
    timeSec: 4.0,
    tramState,
    plazaSignalState: greenSignal,
    eastSignalState: greenSignal,
    fallbackPreset: 'day',
    weatherEnvState: { phase: 'day', nightFactor01: 0, duskDawnFactor01: 0, rainFactor01: 0, fogFactor01: 0.85, cityLightsScale: 1.0 },
  });
  assert.equal(byName('CityLamp_GroundLightPools').visible, true);
  assert.equal(byName('CityLamp_LanternHalos').visible, true);
  assert.equal(byName('CityBuilding_NightGlowPanes').visible, true);

  // Clear noon hides night FX again
  handle.update({
    dt: 1 / 60,
    timeSec: 5.0,
    tramState,
    plazaSignalState: greenSignal,
    eastSignalState: greenSignal,
    fallbackPreset: 'day',
  });
  assert.equal(byName('CityLamp_GroundLightPools').visible, false);
  assert.equal(byName('CityLamp_LanternHalos').visible, false);
  assert.equal(haloShaderMat.uniforms.uOpacity.value, 0);
  assert.equal(byName('CityBuilding_NightGlowPanes').visible, false);

  assert.equal(handle.getVehicleCollisionBoxes().length, 0);

  handle.dispose();
  assert.equal(scene.children.includes(handle.rootGroup), false);
});

test('radial lantern glow curves, camera-distance scaling, and daytime cutoff ramp smoothly without edge clipping', () => {
  // Smooth Gaussian + raised-cosine falloff hits 1.0 at center and strictly 0.0 at edge r >= 0.96
  assert.equal(evaluateSmoothRadialGlowFalloff(0), 1);
  const r25 = evaluateSmoothRadialGlowFalloff(0.25);
  const r50 = evaluateSmoothRadialGlowFalloff(0.5);
  const r75 = evaluateSmoothRadialGlowFalloff(0.75);
  assert.ok(r25 < 1 && r25 > r50 && r50 > r75 && r75 > 0);
  assert.equal(evaluateSmoothRadialGlowFalloff(0.96), 0);
  assert.equal(evaluateSmoothRadialGlowFalloff(1.0), 0);

  // Close-ups stay compact with zero Z-nudge and damped core alpha; distant lamps grow gently for readability
  const close = evaluateLanternBillboardDistanceScale(0.94, 2.5);
  const mid = evaluateLanternBillboardDistanceScale(0.94, 15.0);
  const far = evaluateLanternBillboardDistanceScale(0.94, 80.0);
  assert.ok(close.scaleMultiplier <= 0.88);
  assert.equal(close.farDepthNudge, 0);
  assert.ok(close.closeAlphaDamp < 0.85);
  assert.ok(mid.scaleMultiplier > close.scaleMultiplier && mid.scaleMultiplier < far.scaleMultiplier);
  assert.ok(far.scaleMultiplier >= 2.25 && far.farDepthNudge > 0.2);

  // Daytime <= 0.05 stays unlit; > 0.05 ramps smoothly with high filament-to-glass contrast
  for (const dayDrive of [0, 0.02, 0.05]) {
    const st = evaluateLanternCoreAndSpriteState(dayDrive);
    assert.equal(st.active, false);
    assert.equal(st.billboardOpacity, 0);
    assert.ok(st.glassEmissiveIntensity <= 0.05);
    assert.ok(st.bulbEmissiveIntensity <= 0.2);
  }
  const duskStart = evaluateLanternCoreAndSpriteState(0.12);
  const duskMid = evaluateLanternCoreAndSpriteState(0.5);
  const fullNight = evaluateLanternCoreAndSpriteState(1.0);
  assert.equal(duskStart.active, true);
  assert.ok(duskStart.billboardOpacity > 0 && duskStart.billboardOpacity < duskMid.billboardOpacity);
  assert.ok(duskMid.billboardOpacity < fullNight.billboardOpacity);
  assert.ok(fullNight.filamentEmissiveIntensity > fullNight.bulbEmissiveIntensity);
  assert.ok(fullNight.bulbEmissiveIntensity > fullNight.glassEmissiveIntensity);

  // Existing beach lamp anchors place billboard sprite cleanly at arm tip (x = 76.48)
  const beachAnchor = EXISTING_CITY_LAMP_POOL_ANCHORS.find((a) => a.id === 'existing_beach_lamp_1');
  assert.ok(beachAnchor);
  assert.ok(Math.abs(beachAnchor.x + (beachAnchor.lanternXOffset ?? 0) - 76.48) < 1e-6);
});

test('Relocated Tier 4 lamp_t4_plaza_center_n cleanly replaces smaller NE terrace lamp at (-80.35, -12.4)', () => {
  const lampN = CITY_LAMP_MANIFEST.find((l) => l.id === 'lamp_t4_plaza_center_n');
  assert.ok(lampN);
  assert.equal(lampN.tier, 4);
  assert.equal(lampN.x, -80.35);
  assert.equal(lampN.z, -12.4);
  assert.equal(lampN.y, 2.5);

  assert.equal(
    EXISTING_CITY_LAMP_POOL_ANCHORS.some((a) => a.id === 'existing_plaza_e2'),
    false,
    'Old smaller lamp light pool anchor existing_plaza_e2 must be removed',
  );
  assert.equal(
    CITY_LAMP_MANIFEST.some((l) => l.id === 'lamp_t4_plaza_center_n' && l.x === -80.35 && l.z === -12.4),
    true,
    'Relocated Tier 4 lamp must be active in CITY_LAMP_MANIFEST at (-80.35, -12.4)',
  );

  // Both civic step lanterns are mounted lantern-only atop the stone balustrade end-piers (no brick pier)
  const pierW = CITY_LAMP_MANIFEST.find((l) => l.id === 'lamp_t2_civic_step_w');
  const pierE = CITY_LAMP_MANIFEST.find((l) => l.id === 'lamp_t2_civic_step_e');
  assert.ok(pierW && pierE);
  assert.equal(pierW.lampVariant, 'pier_lantern');
  assert.equal(pierE.lampVariant, 'pier_lantern');
  assert.equal(pierW.z, pierE.z);
  assert.ok(Math.abs((pierW.x + pierE.x) * 0.5 - -93.55) < 1e-4);
  assert.ok(pierW.y > 3.7 && pierE.y > 3.7);
});

test('Pier-mounted Tier 2 lanterns render lantern-only batch without brick pedestal meshes', () => {
  const scene = new THREE.Scene();
  const handle = buildCityLightingAndTrafficSystem(scene, undefined, false);
  const t2BrickMesh = handle.rootGroup.getObjectByName('CityLamp_Tier2_Brick') as THREE.InstancedMesh;
  const t2PierIronMesh = handle.rootGroup.getObjectByName('CityLamp_Tier2_Pier_Iron') as THREE.InstancedMesh;
  assert.ok(t2BrickMesh);
  assert.ok(t2PierIronMesh);
  assert.equal(
    t2BrickMesh.count,
    CITY_LAMP_MANIFEST.filter((l) => l.tier === 2 && l.lampVariant !== 'pier_lantern').length,
  );
  assert.equal(
    t2PierIronMesh.count,
    CITY_LAMP_MANIFEST.filter((l) => l.tier === 2 && l.lampVariant === 'pier_lantern').length,
  );
  handle.dispose();

  for (const id of ['existing_plaza_w1', 'existing_plaza_w2', 'existing_plaza_w4', 'existing_plaza_e1', 'existing_plaza_e4']) {
    const a = EXISTING_CITY_LAMP_POOL_ANCHORS.find((entry) => entry.id === id);
    assert.ok(a && a.lanternYOffset === 5.97, `Upgraded promenade bronze lamp ${id} should align lanternYOffset at 5.97m`);
  }
  for (const id of ['existing_civic_planter_w', 'existing_civic_planter_e']) {
    const a = EXISTING_CITY_LAMP_POOL_ANCHORS.find((entry) => entry.id === id);
    assert.ok(a && a.lanternYOffset === 4.96, `Upgraded civic planter bronze lamp ${id} should align lanternYOffset at 4.96m`);
  }
});


