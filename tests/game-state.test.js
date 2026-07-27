const assert = require('assert');
const {
  CHIME_TARGET,
  GameState,
  MOON_TARGET,
  PHASES,
  SUN_TARGET,
  WATER_TARGET
} = require('../src/game-state');

let now = 0;
const game = new GameState(() => now, {
  threatDurations: {
    [PHASES.MORTUARY]: 100000,
    [PHASES.CORRIDOR]: 100000
  }
});

assert.strictEqual(game.phase, PHASES.INTRO);
assert.strictEqual(game.begin(), true);
assert.strictEqual(game.phase, PHASES.MORTUARY);

assert.strictEqual(game.inspectAltar(), true);
assert.strictEqual(game.hasItem('white-jade'), true);
assert.strictEqual(game.hasItem('oil-lamp'), true);
assert.strictEqual(game.inspectMirror(), true);
assert.strictEqual(game.hasItem('black-jade'), true);
assert.strictEqual(game.getThreatStage().id, 'approaching');

assert.strictEqual(game.useItemOn('oil-lamp', 'sun-device'), true);
assert.strictEqual(game.useItemOn('white-jade', 'shadow-table'), true);
assert.strictEqual(game.useItemOn('black-jade', 'shadow-table'), true);
for (let i = 0; i < SUN_TARGET; i += 1) game.rotateSun();
for (let i = 0; i < MOON_TARGET; i += 1) game.rotateMoon();
assert.strictEqual(game.activateShadowTable(), true);
assert.strictEqual(game.hasItem('taiji-key'), true);
assert.strictEqual(game.useItemOn('taiji-key', 'exit-door'), true);
assert.strictEqual(game.phase, PHASES.CORRIDOR);
assert.deepStrictEqual(game.inventory, ['taiji-core']);

assert.strictEqual(game.inspectEastWindow(), true);
CHIME_TARGET.forEach((index) => game.ringChime(index));
assert.strictEqual(game.corridor.chimesSolved, true);
assert.strictEqual(game.hasItem('wind-ribbon'), true);
assert.strictEqual(game.inspectWaterJar(), true);

assert.strictEqual(game.useItemOn('taiji-core', 'wood-mechanism'), true);
assert.strictEqual(game.useItemOn('thunder-plate', 'wood-mechanism'), true);
assert.strictEqual(game.useItemOn('wind-ribbon', 'wood-mechanism'), true);
assert.strictEqual(game.useItemOn('water-scoop', 'wood-mechanism'), true);
WATER_TARGET.forEach((target, index) => {
  if (target) game.toggleWaterRoute(index);
});
assert.strictEqual(game.activateWoodMechanism(), true);
assert.strictEqual(game.hasItem('wood-seal'), true);
assert.strictEqual(game.useItemOn('wood-seal', 'exit-door'), true);
assert.strictEqual(game.phase, PHASES.ENDING);
assert.strictEqual(game.getProgress(), 11);

const failureGame = new GameState(() => now, {
  threatDurations: {
    [PHASES.MORTUARY]: 1000,
    [PHASES.CORRIDOR]: 1000
  }
});
failureGame.begin();
failureGame.inspectMirror();
now += 1001;
assert.strictEqual(failureGame.update(), true);
assert.strictEqual(failureGame.phase, PHASES.DEAD);
assert.strictEqual(failureGame.retryRoom(), true);
assert.strictEqual(failureGame.phase, PHASES.MORTUARY);
assert.deepStrictEqual(failureGame.inventory, []);

failureGame.phase = PHASES.CORRIDOR;
failureGame.checkpoint = PHASES.CORRIDOR;
failureGame.inventory = ['taiji-core'];
failureGame.startThreat(PHASES.CORRIDOR);
now += 1001;
failureGame.update();
assert.strictEqual(failureGame.phase, PHASES.DEAD);
assert.strictEqual(failureGame.retryRoom(), true);
assert.strictEqual(failureGame.phase, PHASES.CORRIDOR);
assert.deepStrictEqual(failureGame.inventory, ['taiji-core']);

let snapshotNow = 5000;
const snapshotGame = new GameState(() => snapshotNow);
snapshotGame.begin();
snapshotGame.inspectAltar();
snapshotGame.inspectMirror();
snapshotGame.useItemOn('oil-lamp', 'sun-device');
snapshotNow += 12000;
const restoredGame = new GameState(() => snapshotNow);
assert.strictEqual(restoredGame.restoreSnapshot(snapshotGame.getSnapshot()), true);
assert.strictEqual(restoredGame.phase, PHASES.MORTUARY);
assert.deepStrictEqual(restoredGame.inventory, ['white-jade', 'black-jade']);
assert.strictEqual(restoredGame.mortuary.sunLampLit, true);
assert.strictEqual(restoredGame.getThreatRemaining(), snapshotGame.getThreatRemaining());
assert.strictEqual(restoredGame.restoreSnapshot({ version: 99 }), false);

console.log('game-state tests passed');
