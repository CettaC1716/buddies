import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CASINO_BLACKJACK_TABLES,
  CASINO_CASHIER_BOOTH,
  CASINO_INTERIOR_BOUNDS,
  CASINO_INTERIOR_COLLIDERS,
  CASINO_INTERIOR_SEAT_SPOTS,
  CASINO_LUXURY_BAR,
  CASINO_ORIGIN_Y,
  CASINO_ROULETTE_TABLE,
  CASINO_SLOT_PLACEMENTS,
  CASINO_STATION_TARGETS,
  GRAND_CASINO_DOOR_TRIGGER,
  clampCasinoInteriorPosition,
  computeCasinoSeatStandUpPosition,
  detectNearestCasinoStation,
  evaluateGrandCasinoDoorProximity,
  getCasinoGameKindForSeat,
  resolveNearestCasinoPromptOrSeat,
} from './buddiesGrandCasinoRules';

test('activates the outdoor entrance interaction triangle only outside warzone & indoor modes', () => {
  const nearLobby = evaluateGrandCasinoDoorProximity(
    GRAND_CASINO_DOOR_TRIGGER.x,
    GRAND_CASINO_DOOR_TRIGGER.z,
    'lobby',
    'none',
  );
  assert.equal(nearLobby.isNear, true);
  assert.equal(nearLobby.distanceM, 0);

  const nearWarzone = evaluateGrandCasinoDoorProximity(
    GRAND_CASINO_DOOR_TRIGGER.x,
    GRAND_CASINO_DOOR_TRIGGER.z,
    'warzone',
    'none',
  );
  assert.equal(nearWarzone.isNear, false);

  const alreadyInside = evaluateGrandCasinoDoorProximity(
    GRAND_CASINO_DOOR_TRIGGER.x,
    GRAND_CASINO_DOOR_TRIGGER.z,
    'lobby',
    'casino_interior',
  );
  assert.equal(alreadyInside.isNear, false);
});

test('matches the 1:1 luxury single-story hall counts (20 slots, 3 blackjack tables, 32 seats)', () => {
  assert.equal(CASINO_ORIGIN_Y, 285.0);
  assert.equal(CASINO_SLOT_PLACEMENTS.length, 20);
  assert.equal(CASINO_BLACKJACK_TABLES.length, 3);
  assert.equal(CASINO_INTERIOR_SEAT_SPOTS.length, 32);
  assert.ok(CASINO_INTERIOR_COLLIDERS.length >= 38);
});

test('clamps interior walking coordinates inside the hall perimeter walls', () => {
  const clampedMin = clampCasinoInteriorPosition(-50, -50);
  assert.ok(clampedMin.x > CASINO_INTERIOR_BOUNDS.minX);
  assert.ok(clampedMin.z > CASINO_INTERIOR_BOUNDS.minZ);

  const clampedMax = clampCasinoInteriorPosition(50, 50);
  assert.ok(clampedMax.x < CASINO_INTERIOR_BOUNDS.maxX);
  assert.ok(clampedMax.z < CASINO_INTERIOR_BOUNDS.maxZ);
});

test('computes safe aisle stand-up positions away from slots and tables', () => {
  const slotSeat = CASINO_INTERIOR_SEAT_SPOTS[0];
  const standPos = computeCasinoSeatStandUpPosition(slotSeat);
  assert.ok(standPos.x > slotSeat.x);
  assert.ok(Math.abs(Math.hypot(standPos.x - slotSeat.x, standPos.z - slotSeat.z) - 0.66) < 0.01);
});

test('detects all 6 interactive casino station zones and arbitrates seats cleanly', () => {
  assert.equal(
    detectNearestCasinoStation(
      CASINO_STATION_TARGETS.exitDoor.x,
      CASINO_STATION_TARGETS.exitDoor.z,
    ).kind,
    'exit_door',
  );

  assert.equal(
    detectNearestCasinoStation(
      CASINO_CASHIER_BOOTH.x,
      CASINO_STATION_TARGETS.cashierCage.interactZ,
    ).kind,
    'cashier_cage',
  );

  assert.equal(
    detectNearestCasinoStation(
      CASINO_LUXURY_BAR.x,
      CASINO_STATION_TARGETS.luxuryBar.interactZ,
    ).kind,
    'luxury_bar',
  );

  // Standing players only reach service stations; game stations are detected
  // in seated mode (includeGames = true), matching the sit-to-play design.
  assert.equal(
    detectNearestCasinoStation(
      CASINO_ROULETTE_TABLE.x,
      CASINO_ROULETTE_TABLE.z + 1.0,
    ).kind,
    null,
  );

  assert.equal(
    detectNearestCasinoStation(
      CASINO_ROULETTE_TABLE.x,
      CASINO_ROULETTE_TABLE.z + 1.0,
      true,
    ).kind,
    'roulette_table',
  );

  assert.equal(
    detectNearestCasinoStation(
      CASINO_BLACKJACK_TABLES[0].x,
      CASINO_BLACKJACK_TABLES[0].z - 0.9,
      true,
    ).kind,
    'blackjack_table',
  );

  assert.equal(
    detectNearestCasinoStation(
      CASINO_STATION_TARGETS.slotNorthBank.interactX,
      CASINO_STATION_TARGETS.slotNorthBank.interactZ,
      true,
    ).kind,
    'slot_machine',
  );

  const seatWinner = resolveNearestCasinoPromptOrSeat(
    CASINO_INTERIOR_SEAT_SPOTS[20].x,
    CASINO_INTERIOR_SEAT_SPOTS[20].z,
  );
  assert.equal(seatWinner.target, 'seat');
  assert.equal(seatWinner.seatSpot?.id, CASINO_INTERIOR_SEAT_SPOTS[20].id);

  // The roulette stool is the activation path for roulette: sitting there
  // resolves to the roulette game.
  const rouletteSeat = CASINO_INTERIOR_SEAT_SPOTS[29];
  assert.equal(rouletteSeat.chairKind, 'roulette_stool');
  const rouletteWinner = resolveNearestCasinoPromptOrSeat(rouletteSeat.x, rouletteSeat.z);
  assert.equal(rouletteWinner.target, 'seat');
  assert.equal(rouletteWinner.seatSpot?.id, rouletteSeat.id);
  assert.equal(getCasinoGameKindForSeat(rouletteSeat.chairKind), 'roulette_table');
});
