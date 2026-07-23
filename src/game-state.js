const STAGES = {
  INTRO: 'intro',
  SEAL: 'seal',
  BELLS: 'bells',
  DOORS: 'doors',
  ENDING: 'ending',
  FAILED: 'failed'
};

const LIMITS = {
  seal: 90,
  bells: 75,
  doors: 90
};

const SEAL_TARGET = [1, 3, 2, 0];
const BELL_TARGET = [0, 2, 1, 0];
const LAMP_TARGET = [2, 0, 1];
const SECRET_AD_SECONDS = 3;

class GameState {
  constructor(now) {
    this.now = now || (() => Date.now());
    this.resetAll();
  }

  resetAll() {
    this.stage = STAGES.INTRO;
    this.previousStage = STAGES.SEAL;
    this.stageStartedAt = this.now();
    this.pausedSeconds = 0;
    this.danger = 0;
    this.seal = [0, 0, 0, 0];
    this.bellInput = [];
    this.lamps = [0, 0, 0];
    this.shadowRevealed = false;
    this.message = '姐姐失踪后的第七天，我收到了她寄出的最后一盘磁带。';
    this.messageUntil = Infinity;
    this.hint = '';
    this.failedReason = '';
    this.secretAdStartedAt = null;
    this.secretUnlocked = false;
  }

  begin() {
    if (this.stage !== STAGES.INTRO) return;
    this.enterStage(STAGES.SEAL, '纸门封死了。桌上的四块残印，也许能重新组成镇尸符。');
  }

  enterStage(stage, message) {
    this.stage = stage;
    this.previousStage = stage;
    this.stageStartedAt = this.now();
    this.pausedSeconds = 0;
    this.danger = 0;
    this.hint = '';
    this.secretAdStartedAt = null;
    this.secretUnlocked = false;
    this.setMessage(message, 5);
  }

  setMessage(message, seconds) {
    this.message = message;
    this.messageUntil = seconds === Infinity ? Infinity : this.now() + seconds * 1000;
  }

  remainingSeconds() {
    const limit = LIMITS[this.stage];
    if (!limit) return 0;
    const elapsed = Math.max(0, (this.now() - this.stageStartedAt) / 1000 - this.pausedSeconds);
    return Math.max(0, limit - elapsed);
  }

  update() {
    if (this.stage === STAGES.FAILED) {
      if (this.secretAdStartedAt !== null && !this.secretUnlocked
        && this.now() - this.secretAdStartedAt >= SECRET_AD_SECONDS * 1000) {
        this.secretUnlocked = true;
        this.hint = this.getHintForStage(this.previousStage);
      }
      return;
    }
    if (!LIMITS[this.stage]) return;
    const remaining = this.remainingSeconds();
    const limit = LIMITS[this.stage];
    this.danger = Math.max(this.danger, 1 - remaining / limit);
    if (remaining <= 0) this.fail('午夜钟声落下，纸门后的人影已经站在你身后。');
  }

  rotateSeal(index) {
    if (this.stage !== STAGES.SEAL || index < 0 || index > 3) return false;
    this.seal[index] = (this.seal[index] + 1) % 4;
    if (this.seal.every((value, i) => value === SEAL_TARGET[i])) {
      this.enterStage(STAGES.BELLS, '符印亮起，里屋却响起三只镇铃。磁带里传来姐姐的低语：短、长、中、短。');
      return true;
    }
    return false;
  }

  ringBell(index) {
    if (this.stage !== STAGES.BELLS || index < 0 || index > 2) return { complete: false, wrong: false };
    const expected = BELL_TARGET[this.bellInput.length];
    if (index !== expected) {
      this.bellInput = [];
      this.danger = Math.min(1, this.danger + 0.14);
      this.setMessage('铃声错了。门后的指甲声突然更近。', 2.6);
      return { complete: false, wrong: true };
    }
    this.bellInput.push(index);
    if (this.bellInput.length === BELL_TARGET.length) {
      this.enterStage(STAGES.DOORS, '三道纸门同时出现。调整烛影，让地上的三道影子分别落在远、近、中位。');
      return { complete: true, wrong: false };
    }
    return { complete: false, wrong: false };
  }

  cycleLamp(index) {
    if (this.stage !== STAGES.DOORS || index < 0 || index > 2) return false;
    this.lamps[index] = (this.lamps[index] + 1) % 3;
    this.shadowRevealed = this.lamps.every((value, i) => value === LAMP_TARGET[i]);
    if (this.shadowRevealed) this.setMessage('烛影重合。中间纸门上，浮出了姐姐留下的指印。', 4);
    return this.shadowRevealed;
  }

  chooseDoor(index) {
    if (this.stage !== STAGES.DOORS) return false;
    if (!this.shadowRevealed) {
      this.danger = Math.min(1, this.danger + 0.08);
      this.setMessage('纸门纹丝不动。必须先让烛影重合。', 2.5);
      return false;
    }
    if (index === 1) {
      this.stage = STAGES.ENDING;
      this.stageStartedAt = this.now();
      this.setMessage('门后没有出口，只有姐姐的第二盘磁带。纸门在你身后缓缓合拢……', Infinity);
      return true;
    }
    this.danger = Math.min(1, this.danger + 0.22);
    this.shadowRevealed = false;
    this.lamps = [0, 0, 0];
    this.setMessage('门后贴着一张苍白的脸。你猛地退回走廊。', 3);
    return false;
  }

  fail(reason) {
    if (this.stage === STAGES.FAILED || this.stage === STAGES.ENDING) return;
    this.previousStage = this.stage;
    this.stage = STAGES.FAILED;
    this.failedReason = reason;
    this.secretAdStartedAt = null;
    this.secretUnlocked = false;
    this.hint = '';
    this.setMessage(reason, Infinity);
  }

  startSecretAd() {
    if (this.stage !== STAGES.FAILED || this.secretAdStartedAt !== null || this.secretUnlocked) return false;
    this.secretAdStartedAt = this.now();
    return true;
  }

  secretAdRemaining() {
    if (this.secretAdStartedAt === null || this.secretUnlocked) return 0;
    const elapsed = (this.now() - this.secretAdStartedAt) / 1000;
    return Math.max(0, Math.ceil(SECRET_AD_SECONDS - elapsed));
  }

  retryStage(preserveSecret) {
    const stage = this.previousStage;
    const learnedHint = preserveSecret && this.secretUnlocked ? this.getHintForStage(stage) : '';
    if (stage === STAGES.SEAL) this.seal = [0, 0, 0, 0];
    if (stage === STAGES.BELLS) this.bellInput = [];
    if (stage === STAGES.DOORS) {
      this.lamps = [0, 0, 0];
      this.shadowRevealed = false;
    }
    this.enterStage(stage, '磁带倒转。你又回到了刚才那一刻。');
    if (learnedHint) this.hint = learnedHint;
  }

  getHintForStage(stage) {
    if (stage === STAGES.SEAL) return '依次点击四块残印：左上 1 次、右上 3 次、左下 2 次、右下不动。四个缺口最终朝向右、左、下、上。';
    if (stage === STAGES.BELLS) return '按“短、长、中、短”的顺序敲铃，也就是依次点击左、右、中、左。敲错后需要从头开始。';
    if (stage === STAGES.DOORS) return '从左到右把烛台调到第 3、1、2 档。中间纸门发光后，点击中间那扇门即可通关。';
    return '';
  }

  showHint() {
    this.hint = this.getHintForStage(this.stage);
    return this.hint;
  }
}

module.exports = {
  BELL_TARGET,
  GameState,
  LAMP_TARGET,
  SECRET_AD_SECONDS,
  SEAL_TARGET,
  STAGES
};
