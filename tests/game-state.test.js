const assert = require('assert');
const { GameState, SECRET_AD_SECONDS, STAGES } = require('../src/game-state');

let now = 0;
const game = new GameState(() => now);

assert.strictEqual(game.stage, STAGES.INTRO);
game.begin();
assert.strictEqual(game.stage, STAGES.SEAL);

[1, 3, 2, 0].forEach((rotations, index) => {
  for (let i = 0; i < rotations; i += 1) game.rotateSeal(index);
});
assert.strictEqual(game.stage, STAGES.BELLS);

assert.strictEqual(game.ringBell(2).wrong, true);
assert.ok(game.danger > 0);
[0, 2, 1, 0].forEach((bell) => game.ringBell(bell));
assert.strictEqual(game.stage, STAGES.DOORS);

[2, 0, 1].forEach((target, index) => {
  for (let i = 0; i < target; i += 1) game.cycleLamp(index);
});
assert.strictEqual(game.shadowRevealed, true);
assert.strictEqual(game.chooseDoor(1), true);
assert.strictEqual(game.stage, STAGES.ENDING);

game.resetAll();
game.begin();
assert.ok(game.showHint().includes('缺口'));
game.fail('test');
game.retryStage();
assert.strictEqual(game.stage, STAGES.SEAL);

game.resetAll();
game.begin();
now = 91000;
game.update();
assert.strictEqual(game.stage, STAGES.FAILED);
assert.strictEqual(game.startSecretAd(), true);
assert.strictEqual(game.startSecretAd(), false);
assert.strictEqual(game.secretAdRemaining(), SECRET_AD_SECONDS);
now += 2000;
game.update();
assert.strictEqual(game.secretUnlocked, false);
assert.strictEqual(game.secretAdRemaining(), 1);
now += 1000;
game.update();
assert.strictEqual(game.secretUnlocked, true);
assert.ok(game.hint.includes('左上 1 次'));
game.retryStage(true);
assert.strictEqual(game.stage, STAGES.SEAL);
assert.ok(game.hint.includes('左上 1 次'));

console.log('game-state tests passed');
