const STAGES = {
  INTRO: 'intro',
  SORT: 'sort',
  STAMP: 'stamp',
  ROUTE: 'route',
  ENDING: 'ending'
};

const PARCEL_TARGET = [2, 0, 1];
const STAMP_TARGET = [2, 0, 3];
const ROUTE_TARGET = [1, 2, 0];

class GameState {
  constructor(now) {
    this.now = now || (() => Date.now());
    this.resetAll();
  }

  resetAll() {
    this.stage = STAGES.INTRO;
    this.stageStartedAt = this.now();
    this.parcels = [-1, -1, -1];
    this.stamps = [0, 0, 0];
    this.routes = [0, 0, 0];
    this.message = '每到午夜，没人记得的梦会沿着云层漂到这里。';
    this.messageUntil = Infinity;
    this.hint = '';
  }

  begin() {
    if (this.stage !== STAGES.INTRO) return false;
    this.enterStage(STAGES.SORT, '三封梦件失去了地址。观察封蜡和信格，把它们送回对应的梦境。');
    return true;
  }

  enterStage(stage, message) {
    this.stage = stage;
    this.stageStartedAt = this.now();
    this.hint = '';
    this.setMessage(message, 6);
  }

  setMessage(message, seconds) {
    this.message = message;
    this.messageUntil = seconds === Infinity ? Infinity : this.now() + seconds * 1000;
  }

  placeParcel(parcelIndex, slotIndex) {
    if (this.stage !== STAGES.SORT) return { accepted: false, complete: false };
    if (parcelIndex < 0 || parcelIndex > 2 || slotIndex < 0 || slotIndex > 2) {
      return { accepted: false, complete: false };
    }
    if (PARCEL_TARGET[parcelIndex] !== slotIndex) {
      this.setMessage('信格轻轻把梦件推了回来。封蜡的图案还没有找到回声。', 3.2);
      return { accepted: false, complete: false };
    }
    this.parcels[parcelIndex] = slotIndex;
    const complete = this.parcels.every((slot, index) => slot === PARCEL_TARGET[index]);
    if (complete) this.enterStage(STAGES.STAMP, '地址浮现了，但月相邮戳仍是错位的。转动三枚印盘，让金色邮路连成一条线。');
    return { accepted: true, complete };
  }

  rotateStamp(index) {
    if (this.stage !== STAGES.STAMP || index < 0 || index > 2) return false;
    this.stamps[index] = (this.stamps[index] + 1) % 4;
    const complete = this.stamps.every((value, i) => value === STAMP_TARGET[i]);
    if (complete) this.enterStage(STAGES.ROUTE, '邮戳发出微光。最后为三封梦件选择航线，再拉下投递杆。');
    return complete;
  }

  cycleRoute(index) {
    if (this.stage !== STAGES.ROUTE || index < 0 || index > 2) return false;
    this.routes[index] = (this.routes[index] + 1) % 3;
    return this.routes.every((value, i) => value === ROUTE_TARGET[i]);
  }

  dispatch() {
    if (this.stage !== STAGES.ROUTE) return false;
    const ready = this.routes.every((value, i) => value === ROUTE_TARGET[i]);
    if (!ready) {
      this.setMessage('黄铜管道里传来迷路的风声。至少有一封梦件选错了航线。', 3.5);
      return false;
    }
    this.stage = STAGES.ENDING;
    this.stageStartedAt = this.now();
    this.hint = '';
    this.setMessage('三封梦穿过云层：一封去了清晨，一封去了深海，一封回到了某个孩子的枕边。', Infinity);
    return true;
  }

  getHintForStage(stage) {
    if (stage === STAGES.SORT) return '看封蜡的形状：羽毛寻找风口，水滴寻找潮汐，钟摆寻找有刻度的信格。';
    if (stage === STAGES.STAMP) return '从左到右分别转动 2、0、3 次。三段金线会在印盘中央连续起来。';
    if (stage === STAGES.ROUTE) return '从左到右把航线调成“深海、清晨、枕边”，然后拉下投递杆。';
    return '';
  }

  showHint() {
    this.hint = this.getHintForStage(this.stage);
    return this.hint;
  }
}

module.exports = {
  GameState,
  PARCEL_TARGET,
  ROUTE_TARGET,
  STAGES,
  STAMP_TARGET
};
