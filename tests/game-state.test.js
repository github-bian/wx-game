const assert = require('assert');
const {
  GameState,
  PARCEL_TARGET,
  ROUTE_TARGET,
  STAGES,
  STAMP_TARGET
} = require('../src/game-state');

let now = 0;
const game = new GameState(() => now);

assert.strictEqual(game.stage, STAGES.INTRO);
assert.strictEqual(game.begin(), true);
assert.strictEqual(game.stage, STAGES.SORT);

assert.strictEqual(game.placeParcel(0, 0).accepted, false);
PARCEL_TARGET.forEach((slot, parcel) => game.placeParcel(parcel, slot));
assert.strictEqual(game.stage, STAGES.STAMP);

STAMP_TARGET.forEach((turns, index) => {
  for (let i = 0; i < turns; i += 1) game.rotateStamp(index);
});
assert.strictEqual(game.stage, STAGES.ROUTE);

ROUTE_TARGET.forEach((target, index) => {
  for (let i = 0; i < target; i += 1) game.cycleRoute(index);
});
assert.strictEqual(game.dispatch(), true);
assert.strictEqual(game.stage, STAGES.ENDING);

game.resetAll();
assert.strictEqual(game.stage, STAGES.INTRO);
console.log('game-state tests passed');
