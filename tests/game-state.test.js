const assert = require('assert');
const {
  GameState,
  LAMP_TARGET,
  OVERLAY_TARGET,
  PHASES,
  STAMP_TARGET
} = require('../src/game-state');

let now = 0;
const game = new GameState(() => now);

assert.strictEqual(game.phase, PHASES.INTRO);
assert.strictEqual(game.begin(), true);
assert.strictEqual(game.phase, PHASES.PLAY);
assert.strictEqual(game.readLog(), true);
assert.strictEqual(game.collectLetter(), true);
assert.strictEqual(game.flipLetter(), true);
assert.strictEqual(game.exposeLetter(), false, 'the unlit lamp cannot reveal ink');

LAMP_TARGET.forEach((turns, index) => {
  for (let i = 0; i < turns; i += 1) game.rotateLamp(index);
});
assert.strictEqual(game.lampSolved, true);
assert.strictEqual(game.exposeLetter(), true);
assert.strictEqual(game.letterRevealed, true);

STAMP_TARGET.forEach((target, index) => {
  for (let i = 0; i < target; i += 1) game.turnStampDial(index);
});
assert.strictEqual(game.pullStamp(), true);
assert.strictEqual(game.stampSolved, true);

for (let i = 0; i < OVERLAY_TARGET; i += 1) game.rotateOverlay();
assert.strictEqual(game.placeOverlay(), true);
assert.strictEqual(game.overlaySolved, true);
assert.strictEqual(game.combineItems('seal-half', 'star-shard'), true);
assert.strictEqual(game.useKey(), true);
assert.strictEqual(game.deliverLetter(), true);
assert.strictEqual(game.phase, PHASES.ENDING);
assert.strictEqual(game.getProgress(), 7);

game.resetAll();
assert.strictEqual(game.phase, PHASES.INTRO);
assert.strictEqual(game.delivered, false);
console.log('game-state tests passed');
