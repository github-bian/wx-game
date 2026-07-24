const PHASES = {
  INTRO: 'intro',
  PLAY: 'play',
  ENDING: 'ending'
};

const LAMP_TARGET = [1, 0, 2];
const STAMP_TARGET = [7, 1, 4];
const OVERLAY_TARGET = 3;

class GameState {
  constructor(now) {
    this.now = now || (() => Date.now());
    this.resetAll();
  }

  resetAll() {
    this.phase = PHASES.INTRO;
    this.startedAt = this.now();
    this.logRead = false;
    this.letterCollected = false;
    this.letterFace = 'front';
    this.lampRings = [0, 0, 0];
    this.lampSolved = false;
    this.letterRevealed = false;
    this.stampDials = [0, 0, 0];
    this.stampSolved = false;
    this.overlayRotation = 0;
    this.overlaySolved = false;
    this.keyCombined = false;
    this.windowOpen = false;
    this.delivered = false;
    this.message = '凌晨四点十七分，邮局收到一封没有收件人的退信。';
    this.messageUntil = Infinity;
    this.hintLevel = 0;
  }

  begin() {
    if (this.phase !== PHASES.INTRO) return false;
    this.phase = PHASES.PLAY;
    this.startedAt = this.now();
    this.setMessage('夜班记录停在昨天。房间里有些东西，似乎仍记得那封信。', 7);
    return true;
  }

  setMessage(message, seconds) {
    this.message = message;
    this.messageUntil = seconds === Infinity ? Infinity : this.now() + seconds * 1000;
  }

  readLog() {
    if (this.phase !== PHASES.PLAY) return false;
    if (!this.logRead) {
      this.logRead = true;
      this.setMessage('记录背面缝着三枚月相：缺口依次指向下、右、左。', 6);
    }
    return true;
  }

  collectLetter() {
    if (this.phase !== PHASES.PLAY || this.letterCollected) return false;
    this.letterCollected = true;
    this.setMessage('退信很轻。封口处少了半枚星形封蜡，背面像是写过什么。', 6);
    return true;
  }

  flipLetter() {
    if (!this.letterCollected || this.delivered) return false;
    this.letterFace = this.letterFace === 'front' ? 'back' : 'front';
    this.setMessage(this.letterFace === 'back' ? '纸背只有几道几乎看不见的针脚。' : '信封正面仍没有收件人。', 3.5);
    return true;
  }

  rotateLamp(index, delta) {
    if (this.phase !== PHASES.PLAY || this.lampSolved || index < 0 || index > 2) return false;
    const step = delta === -1 ? -1 : 1;
    this.lampRings[index] = (this.lampRings[index] + step + 4) % 4;
    if (this.lampRings.every((value, ring) => value === LAMP_TARGET[ring])) {
      this.lampSolved = true;
      this.setMessage('月灯亮了。紫色的光落在柜台上，毛毡纤维间浮起细小星尘。', 7);
      return true;
    }
    return false;
  }

  exposeLetter() {
    if (!this.letterCollected || !this.lampSolved || this.letterFace !== 'back') {
      this.setMessage(!this.lampSolved ? '普通灯光照不出纸背的字。' : '也许该让信的另一面朝向月光。', 4);
      return false;
    }
    if (!this.letterRevealed) {
      this.letterRevealed = true;
      this.setMessage('隐墨显出一枚旧邮戳：7 · 1 · 4。缺失的半枚星封蜡也松了下来。', 7);
    }
    return true;
  }

  turnStampDial(index, delta) {
    if (!this.letterRevealed || this.stampSolved || index < 0 || index > 2) return false;
    const step = delta === -1 ? -1 : 1;
    this.stampDials[index] = (this.stampDials[index] + step + 10) % 10;
    return true;
  }

  pullStamp() {
    if (!this.letterRevealed || this.stampSolved) return false;
    if (!this.stampDials.every((value, index) => value === STAMP_TARGET[index])) {
      this.setMessage('压柄弹了回来。三个日期轮没有咬合。', 3.5);
      return false;
    }
    this.stampSolved = true;
    this.setMessage('邮戳压出一张布满孔洞的星图薄片。它不像邮票，更像一扇小窗。', 7);
    return true;
  }

  rotateOverlay(delta) {
    if (!this.stampSolved || this.overlaySolved) return false;
    const step = delta === -1 ? -1 : 1;
    this.overlayRotation = (this.overlayRotation + step + 4) % 4;
    return true;
  }

  placeOverlay() {
    if (!this.stampSolved || this.overlaySolved) return false;
    if (this.overlayRotation !== OVERLAY_TARGET) {
      this.setMessage('孔洞与墙上的星点错开了。薄片还需要换一个方向。', 4);
      return false;
    }
    this.overlaySolved = true;
    this.setMessage('孔洞套住七颗星。暗格里滚出另一半星形封蜡。', 7);
    return true;
  }

  combineItems(first, second) {
    if (!this.letterRevealed || !this.overlaySolved || this.keyCombined) return false;
    const pair = [first, second].sort().join(':');
    if (pair !== ['seal-half', 'star-shard'].sort().join(':')) return false;
    this.keyCombined = true;
    this.setMessage('两半封蜡在掌心合拢，背面伸出一枚柔软的星形钥匙。', 7);
    return true;
  }

  useKey() {
    if (!this.keyCombined || this.windowOpen) return false;
    this.windowOpen = true;
    this.setMessage('投递窗向夜空打开。远处有一盏灯，像有人仍在等这封信。', 7);
    return true;
  }

  deliverLetter() {
    if (!this.windowOpen || !this.letterCollected || this.delivered) return false;
    this.delivered = true;
    this.phase = PHASES.ENDING;
    this.setMessage('退信穿过云层。收件人一栏慢慢浮现：给还记得的人。', Infinity);
    return true;
  }

  getProgress() {
    const flags = [this.lampSolved, this.letterRevealed, this.stampSolved, this.overlaySolved, this.keyCombined, this.windowOpen, this.delivered];
    return flags.filter(Boolean).length;
  }

  getHint() {
    this.hintLevel += 1;
    let hint = '';
    if (!this.logRead) hint = '先看看柜台左侧的夜班记录，纸张也有背面。';
    else if (!this.lampSolved) hint = this.hintLevel % 2 ? '记录背面的月相不是装饰；试着转动月灯的三层软环。' : '从外到内，让缺口指向：下、右、左。';
    else if (!this.letterCollected) hint = '柜台上的退信可以拿起来。';
    else if (!this.letterRevealed) hint = this.letterFace === 'back' ? '把信背拖到已经点亮的月灯上。' : '先点开物品栏中的退信，把它翻到背面。';
    else if (!this.stampSolved) hint = '隐墨中的旧日期属于桌上的邮戳机：7 · 1 · 4。';
    else if (!this.overlaySolved) hint = '旋转新得到的星图薄片，再把它拖到墙上的星图处。';
    else if (!this.keyCombined) hint = '把物品栏中的两半星形封蜡拖到一起。';
    else if (!this.windowOpen) hint = '星形钥匙属于右上方关闭的投递窗。';
    else if (!this.delivered) hint = '把最初那封退信拖进已经打开的投递窗。';
    else hint = '今晚的投递已经完成。';
    this.setMessage(hint, 8);
    return hint;
  }
}

module.exports = {
  GameState,
  LAMP_TARGET,
  OVERLAY_TARGET,
  PHASES,
  STAMP_TARGET
};
