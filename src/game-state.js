const PHASES = {
  INTRO: 'intro',
  MORTUARY: 'mortuary',
  CORRIDOR: 'corridor',
  ENDING: 'ending',
  DEAD: 'dead'
};

const SUN_TARGET = 1;
const MOON_TARGET = 3;
const CHIME_TARGET = [2, 0, 1];
const WATER_TARGET = [1, 0, 1];

const DEFAULT_THREAT_DURATIONS = {
  [PHASES.MORTUARY]: 180000,
  [PHASES.CORRIDOR]: 210000
};

class GameState {
  constructor(now, options) {
    this.now = now || (() => Date.now());
    this.threatDurations = Object.assign({}, DEFAULT_THREAT_DURATIONS, options && options.threatDurations);
    this.resetAll();
  }

  resetAll() {
    this.phase = PHASES.INTRO;
    this.checkpoint = PHASES.MORTUARY;
    this.inventory = [];
    this.hintLevel = 0;
    this.message = '子时已过，镇夜司六门尽锁。棺中的守门尸正在醒来。';
    this.messageUntil = Infinity;
    this.deathReason = '';
    this.deadRoom = null;
    this.resetThreat();
    this.resetMortuary();
    this.resetCorridor();
  }

  resetMortuary() {
    this.mortuary = {
      altarSearched: false,
      mirrorOpened: false,
      sunLampLit: false,
      whitePlaced: false,
      blackPlaced: false,
      sunAngle: 0,
      moonAngle: 0,
      shadowSolved: false,
      barricaded: false,
      doorOpened: false
    };
  }

  resetCorridor() {
    this.corridor = {
      plateTaken: false,
      waterTaken: false,
      chimeInput: [],
      chimesSolved: false,
      coreInserted: false,
      plateInserted: false,
      ribbonInserted: false,
      waterSupplied: false,
      waterRoute: [0, 0, 0],
      mechanismSolved: false,
      barricaded: false,
      doorOpened: false
    };
  }

  getSnapshot() {
    return {
      version: 1,
      phase: this.phase,
      checkpoint: this.checkpoint,
      inventory: this.inventory.slice(),
      hintLevel: this.hintLevel,
      message: this.message,
      messageUntil: this.messageUntil === Infinity ? null : this.messageUntil,
      deathReason: this.deathReason,
      deadRoom: this.deadRoom,
      threatRoom: this.threatRoom,
      threatStartedAt: this.threatStartedAt,
      threatEndAt: this.threatEndAt,
      mortuary: Object.assign({}, this.mortuary),
      corridor: Object.assign({}, this.corridor, { waterRoute: this.corridor.waterRoute.slice() })
    };
  }

  restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.version !== 1 || !Object.values(PHASES).includes(snapshot.phase)) return false;
    if (!snapshot.mortuary || !snapshot.corridor || !Array.isArray(snapshot.inventory)) return false;
    this.phase = snapshot.phase;
    this.checkpoint = snapshot.checkpoint === PHASES.CORRIDOR ? PHASES.CORRIDOR : PHASES.MORTUARY;
    this.inventory = snapshot.inventory.filter((itemId) => typeof itemId === 'string');
    this.hintLevel = Number.isFinite(snapshot.hintLevel) ? snapshot.hintLevel : 0;
    this.message = typeof snapshot.message === 'string' ? snapshot.message : this.message;
    this.messageUntil = snapshot.messageUntil === null || !Number.isFinite(snapshot.messageUntil)
      ? Infinity
      : snapshot.messageUntil;
    this.deathReason = typeof snapshot.deathReason === 'string' ? snapshot.deathReason : '';
    this.deadRoom = snapshot.deadRoom === PHASES.MORTUARY || snapshot.deadRoom === PHASES.CORRIDOR
      ? snapshot.deadRoom
      : null;
    this.threatRoom = snapshot.threatRoom === PHASES.MORTUARY || snapshot.threatRoom === PHASES.CORRIDOR
      ? snapshot.threatRoom
      : null;
    this.threatStartedAt = Number.isFinite(snapshot.threatStartedAt) ? snapshot.threatStartedAt : null;
    this.threatEndAt = Number.isFinite(snapshot.threatEndAt) ? snapshot.threatEndAt : null;
    this.mortuary = Object.assign({}, this.mortuary, snapshot.mortuary);
    this.corridor = Object.assign({}, this.corridor, snapshot.corridor, {
      waterRoute: Array.isArray(snapshot.corridor.waterRoute) && snapshot.corridor.waterRoute.length === 3
        ? snapshot.corridor.waterRoute.map((value) => value ? 1 : 0)
        : [0, 0, 0]
    });
    this.update();
    return true;
  }

  begin() {
    if (this.phase !== PHASES.INTRO) return false;
    this.phase = PHASES.MORTUARY;
    this.checkpoint = PHASES.MORTUARY;
    this.setMessage('先辨阴阳，再寻出路。供桌、铜镜与日月照影台都留下了线索。', 8);
    return true;
  }

  setMessage(message, seconds) {
    this.message = message;
    this.messageUntil = seconds === Infinity ? Infinity : this.now() + seconds * 1000;
  }

  addItem(itemId) {
    if (!this.inventory.includes(itemId)) this.inventory.push(itemId);
  }

  removeItem(itemId) {
    const index = this.inventory.indexOf(itemId);
    if (index >= 0) this.inventory.splice(index, 1);
  }

  hasItem(itemId) {
    return this.inventory.includes(itemId);
  }

  inspectAltar() {
    if (this.phase !== PHASES.MORTUARY || this.mortuary.altarSearched) return false;
    this.mortuary.altarSearched = true;
    this.addItem('white-jade');
    this.addItem('oil-lamp');
    this.setMessage('供桌暗格里有半枚白玉鱼和一盏尚有灯油的旧灯。白为阳，却无法独自成形。', 7);
    return true;
  }

  inspectMirror() {
    if (this.phase !== PHASES.MORTUARY || this.mortuary.mirrorOpened) return false;
    this.mortuary.mirrorOpened = true;
    this.addItem('black-jade');
    this.startThreat(PHASES.MORTUARY);
    this.setMessage('铜镜背面藏着半枚黑玉鱼。玉片离位的一刻，棺盖内传来抓挠声。', 7);
    return true;
  }

  rotateSun() {
    if (this.phase !== PHASES.MORTUARY || this.mortuary.shadowSolved) return false;
    this.mortuary.sunAngle = (this.mortuary.sunAngle + 1) % 4;
    return true;
  }

  rotateMoon() {
    if (this.phase !== PHASES.MORTUARY || this.mortuary.shadowSolved) return false;
    this.mortuary.moonAngle = (this.mortuary.moonAngle + 1) % 4;
    return true;
  }

  activateShadowTable() {
    if (this.phase !== PHASES.MORTUARY || this.mortuary.shadowSolved) return false;
    const ready = this.mortuary.sunLampLit && this.mortuary.whitePlaced && this.mortuary.blackPlaced;
    if (!ready) {
      this.setMessage('照影台还不完整。日灯、白玉与黑玉缺一不可。', 4);
      return false;
    }
    if (this.mortuary.sunAngle !== SUN_TARGET || this.mortuary.moonAngle !== MOON_TARGET) {
      this.penalizeThreat(12000, '光影没有合成完整太极，棺盖被撞得更响了。');
      return false;
    }
    this.mortuary.shadowSolved = true;
    this.addItem('taiji-key');
    this.setMessage('阳光照白玉，月影收黑玉。两仪合一，棺台暗格吐出太极铜钥。', 8);
    return true;
  }

  barricade() {
    if (!this.isRoomPhase() || !this.threatEndAt) return false;
    const room = this.phase === PHASES.MORTUARY ? this.mortuary : this.corridor;
    if (room.barricaded) return false;
    room.barricaded = true;
    this.threatEndAt += 30000;
    this.setMessage(this.phase === PHASES.MORTUARY ? '你把供桌推到棺前，暂时压住了棺盖。' : '你放下竹架挡住回廊，脚步声暂时远了一些。', 5);
    return true;
  }

  inspectEastWindow() {
    if (this.phase !== PHASES.CORRIDOR || this.corridor.plateTaken) return false;
    this.corridor.plateTaken = true;
    this.addItem('thunder-plate');
    this.setMessage('东方窗格里卡着一块三爻木片。下方阳线最先发动，木纹旁刻着雷形。', 7);
    return true;
  }

  inspectWaterJar() {
    if (this.phase !== PHASES.CORRIDOR || this.corridor.waterTaken) return false;
    this.corridor.waterTaken = true;
    this.addItem('water-scoop');
    this.setMessage('破缸仍在向下渗水。引水瓢能把水送进根系，但金属管道会伤木。', 7);
    return true;
  }

  ringChime(index) {
    if (this.phase !== PHASES.CORRIDOR || this.corridor.chimesSolved || index < 0 || index > 2) return false;
    if (!this.threatEndAt) this.startThreat(PHASES.CORRIDOR);
    this.corridor.chimeInput.push(index);
    if (this.corridor.chimeInput.length < CHIME_TARGET.length) {
      this.setMessage('风铃余音沿回廊传开。竹帘摆动的长短决定下一声。', 3);
      return false;
    }
    const solved = this.corridor.chimeInput.every((value, position) => value === CHIME_TARGET[position]);
    this.corridor.chimeInput = [];
    if (!solved) {
      this.penalizeThreat(18000, '风铃次序错误。远处的僵尸被声音吸引，脚步明显加快。');
      return false;
    }
    this.corridor.chimesSolved = true;
    this.addItem('wind-ribbon');
    this.setMessage('短、长、中三声与竹帘摆动重合。巽风丝带从铃架后垂落。', 7);
    return true;
  }

  toggleWaterRoute(index) {
    if (this.phase !== PHASES.CORRIDOR || this.corridor.mechanismSolved || index < 0 || index > 2) return false;
    this.corridor.waterRoute[index] = this.corridor.waterRoute[index] ? 0 : 1;
    return true;
  }

  activateWoodMechanism() {
    if (this.phase !== PHASES.CORRIDOR || this.corridor.mechanismSolved) return false;
    const partsReady = this.corridor.coreInserted
      && this.corridor.plateInserted
      && this.corridor.ribbonInserted
      && this.corridor.waterSupplied;
    if (!partsReady) {
      this.setMessage('风雷木枢尚缺轴芯、震卦木片、巽风丝带或引水。', 4);
      return false;
    }
    if (!this.corridor.waterRoute.every((value, index) => value === WATER_TARGET[index])) {
      this.penalizeThreat(15000, '水流经过了金属管道，根系立刻回缩。金克木，这条路不对。');
      return false;
    }
    this.corridor.mechanismSolved = true;
    this.addItem('wood-seal');
    this.setMessage('震雷启动，巽风贯穿，水避金路而入木。枯根生出青藤，托起青木门印。', 9);
    return true;
  }

  useItemOn(itemId, targetId) {
    if (!this.hasItem(itemId)) return false;

    if (this.phase === PHASES.MORTUARY) {
      if (itemId === 'oil-lamp' && targetId === 'sun-device' && !this.mortuary.sunLampLit) {
        this.removeItem(itemId);
        this.mortuary.sunLampLit = true;
        this.setMessage('旧灯嵌入日轮，暖光亮起。阳面已经就位。', 5);
        return true;
      }
      if (itemId === 'white-jade' && targetId === 'shadow-table' && !this.mortuary.whitePlaced) {
        this.removeItem(itemId);
        this.mortuary.whitePlaced = true;
        this.setMessage('白玉鱼落入阳槽，仍需黑玉与月影相应。', 4);
        return true;
      }
      if (itemId === 'black-jade' && targetId === 'shadow-table' && !this.mortuary.blackPlaced) {
        this.removeItem(itemId);
        this.mortuary.blackPlaced = true;
        this.setMessage('黑玉鱼落入阴槽。阴阳具备，只差调整光影。', 4);
        return true;
      }
      if (itemId === 'taiji-key' && targetId === 'exit-door' && this.mortuary.shadowSolved) {
        this.removeItem(itemId);
        this.mortuary.doorOpened = true;
        this.phase = PHASES.CORRIDOR;
        this.checkpoint = PHASES.CORRIDOR;
        this.resetThreat();
        this.addItem('taiji-core');
        this.setMessage('铜钥化作门轴留在掌中。门后是青木风廊，竹铃正在无风自响。', 8);
        return true;
      }
    }

    if (this.phase === PHASES.CORRIDOR) {
      const insertMap = {
        'taiji-core': 'coreInserted',
        'thunder-plate': 'plateInserted',
        'wind-ribbon': 'ribbonInserted',
        'water-scoop': 'waterSupplied'
      };
      const flag = insertMap[itemId];
      if (flag && targetId === 'wood-mechanism' && !this.corridor[flag]) {
        this.removeItem(itemId);
        this.corridor[flag] = true;
        this.setMessage({
          coreInserted: '太极轴芯固定了木枢中央的阴阳转轴。',
          plateInserted: '震卦木片进入东侧槽位，雷形节点开始闪动。',
          ribbonInserted: '巽风丝带穿过风槽，木枢内部出现气流声。',
          waterSupplied: '引水瓢将水送入地面水盘，现在需要避开金属管道。'
        }[flag], 5);
        return true;
      }
      if (itemId === 'wood-seal' && targetId === 'exit-door' && this.corridor.mechanismSolved) {
        this.removeItem(itemId);
        this.corridor.doorOpened = true;
        this.phase = PHASES.ENDING;
        this.resetThreat();
        this.setMessage('青木门印嵌入门心。第一重五行锁已经解除，离火丹房在门后亮起。', Infinity);
        return true;
      }
    }

    this.setMessage('物件与这里的结构没有形成对应关系。', 3);
    return false;
  }

  startThreat(room) {
    if (this.threatEndAt || (room !== PHASES.MORTUARY && room !== PHASES.CORRIDOR)) return false;
    this.threatRoom = room;
    this.threatStartedAt = this.now();
    this.threatEndAt = this.threatStartedAt + this.threatDurations[room];
    return true;
  }

  resetThreat() {
    this.threatRoom = null;
    this.threatStartedAt = null;
    this.threatEndAt = null;
  }

  penalizeThreat(milliseconds, message) {
    if (this.threatEndAt) this.threatEndAt -= milliseconds;
    if (message) this.setMessage(message, 5);
    this.update();
  }

  getThreatRemaining() {
    if (!this.threatEndAt) return Infinity;
    return Math.max(0, this.threatEndAt - this.now());
  }

  getThreatRatio() {
    if (!this.threatEndAt || !this.threatRoom) return 0;
    const duration = this.threatDurations[this.threatRoom];
    return Math.max(0, Math.min(1, 1 - this.getThreatRemaining() / duration));
  }

  getThreatStage() {
    if (!this.threatEndAt) return { id: 'quiet', label: '寂静', level: 0 };
    const ratio = this.getThreatRatio();
    if (ratio < 0.35) return { id: 'approaching', label: '接近', level: 1 };
    if (ratio < 0.65) return { id: 'banging', label: '撞门', level: 2 };
    if (ratio < 0.9) return { id: 'breaking', label: '破门', level: 3 };
    return { id: 'breaching', label: '闯入', level: 4 };
  }

  update() {
    if (this.messageUntil !== Infinity && this.now() >= this.messageUntil) {
      this.message = this.phase === PHASES.MORTUARY
        ? '日月照影台、供桌与铜镜仍在等待对应的线索。'
        : this.phase === PHASES.CORRIDOR
          ? '风雷木枢连接着风铃、水路与右侧青门。'
          : this.message;
      this.messageUntil = Infinity;
    }
    if (!this.isRoomPhase() || !this.threatEndAt || this.now() < this.threatEndAt) return false;
    this.deadRoom = this.phase;
    this.deathReason = this.phase === PHASES.MORTUARY
      ? '棺中守门尸掀开棺盖，在东门开启前抓住了你。'
      : '风铃引来的僵尸冲过回廊，你没能及时取得青木门印。';
    this.phase = PHASES.DEAD;
    this.resetThreat();
    this.setMessage(this.deathReason, Infinity);
    return true;
  }

  retryRoom() {
    if (this.phase !== PHASES.DEAD || !this.deadRoom) return false;
    const room = this.deadRoom;
    this.deathReason = '';
    this.deadRoom = null;
    this.hintLevel = 0;
    this.resetThreat();
    if (room === PHASES.MORTUARY) {
      this.inventory = [];
      this.resetMortuary();
      this.resetCorridor();
      this.phase = PHASES.MORTUARY;
      this.checkpoint = PHASES.MORTUARY;
      this.setMessage('你在棺盖第一次震动前惊醒。房间恢复了原状，但你记得刚才的线索。', 7);
    } else {
      this.inventory = ['taiji-core'];
      this.resetCorridor();
      this.phase = PHASES.CORRIDOR;
      this.checkpoint = PHASES.CORRIDOR;
      this.setMessage('你重新踏入青木风廊。太极轴芯仍在手中，风铃尚未惊动尸群。', 7);
    }
    return true;
  }

  isRoomPhase() {
    return this.phase === PHASES.MORTUARY || this.phase === PHASES.CORRIDOR;
  }

  getProgress() {
    const flags = [
      this.mortuary.altarSearched,
      this.mortuary.mirrorOpened,
      this.mortuary.sunLampLit,
      this.mortuary.whitePlaced && this.mortuary.blackPlaced,
      this.mortuary.shadowSolved,
      this.mortuary.doorOpened,
      this.corridor.plateTaken,
      this.corridor.chimesSolved,
      this.corridor.coreInserted && this.corridor.plateInserted && this.corridor.ribbonInserted && this.corridor.waterSupplied,
      this.corridor.mechanismSolved,
      this.corridor.doorOpened
    ];
    return flags.filter(Boolean).length;
  }

  getHint() {
    this.hintLevel += 1;
    let hint = '';
    if (this.phase === PHASES.MORTUARY) {
      if (!this.mortuary.altarSearched) hint = '先检查前景供桌，阴阳机关需要两枚互补之物。';
      else if (!this.mortuary.mirrorOpened) hint = '冷月镜旁的铜镜背面并不平整。';
      else if (!this.mortuary.sunLampLit) hint = '把供桌取得的旧灯拖到左侧日轮装置。';
      else if (!this.mortuary.whitePlaced || !this.mortuary.blackPlaced) hint = '将黑白两枚玉鱼拖入中央照影台。';
      else if (!this.mortuary.shadowSolved) hint = this.hintLevel % 2
        ? '阳光应从东方照入，月影则从相反方向收拢。'
        : '日轮转一次，月镜转三次，再启动照影台。';
      else hint = '把太极铜钥拖到中后方木门。';
    } else if (this.phase === PHASES.CORRIDOR) {
      if (!this.corridor.plateTaken) hint = '东方窗格藏着代表震雷的三爻木片。';
      else if (!this.corridor.chimesSolved) hint = this.hintLevel % 2
        ? '观察竹帘三段摆幅，从短到长并不是正确顺序。'
        : '依次敲右、左、中三枚风铃。';
      else if (!this.corridor.waterTaken) hint = '破裂水缸旁有可取水的旧瓢。';
      else if (!(this.corridor.coreInserted && this.corridor.plateInserted && this.corridor.ribbonInserted && this.corridor.waterSupplied)) hint = '把轴芯、震卦木片、巽风丝带和引水瓢都拖到中央木枢。';
      else if (!this.corridor.mechanismSolved) hint = this.hintLevel % 2
        ? '水生木，但金克木。不要让水经过中央金属管。'
        : '打开左右水路，关闭中间金属水路，再启动木枢。';
      else hint = '把青木门印拖到右侧青门。';
    } else hint = '当前没有需要提示的谜题。';
    this.setMessage(hint, 8);
    return hint;
  }
}

module.exports = {
  CHIME_TARGET,
  DEFAULT_THREAT_DURATIONS,
  GameState,
  MOON_TARGET,
  PHASES,
  SUN_TARGET,
  WATER_TARGET
};
