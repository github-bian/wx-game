const { GameAudio } = require('./audio');
const { GameState, PHASES } = require('./game-state');
const platform = require('./platform');

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const system = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
const pixelRatio = Math.min(system.pixelRatio || 1, 2);
const PORTRAIT = system.windowHeight > system.windowWidth;
const DESIGN_WIDTH = PORTRAIT ? 720 : 1280;
const DESIGN_HEIGHT = PORTRAIT ? 1280 : 720;
const SCENE = PORTRAIT
  ? { x: 0, y: 0, width: 720, height: 560 }
  : { x: 0, y: 0, width: 960, height: 720 };
const PANEL = PORTRAIT
  ? { x: 0, y: 560, width: 720, height: 720 }
  : { x: 960, y: 0, width: 320, height: 720 };
const ROOM_VIEW = PORTRAIT
  ? { x: 0, y: 95, width: 720, height: 465 }
  : { x: 0, y: 90, width: 960, height: 540 };

canvas.width = DESIGN_WIDTH * pixelRatio;
canvas.height = DESIGN_HEIGHT * pixelRatio;

const state = new GameState();
state.restoreSnapshot(platform.loadSession());
const audio = new GameAudio();
if (wx.onHide) wx.onHide(() => audio.suspend());
if (wx.onShow) wx.onShow(() => audio.resume());
const images = {};
const imageReady = {};
let hitAreas = [];
let dropAreas = [];
let inventoryAreas = [];
let focus = null;
let pressedArea = null;
let drag = null;
let sparks = [];
let lastProgress = state.getProgress();
let lastPhase = state.phase;
let lastThreatLevel = state.getThreatStage().level;

function persistSession() {
  platform.saveSession(state.getSnapshot());
}

const ROOM_LAYOUTS = {
  [PHASES.MORTUARY]: {
    altar: [0.31, 0.82, 0.38, 0.18],
    sun: [0.18, 0.22, 0.19, 0.42],
    moon: [0.73, 0.22, 0.18, 0.42],
    coffin: [0.38, 0.4, 0.32, 0.27],
    shadow: [0.42, 0.68, 0.24, 0.14],
    exit: [0.42, 0.1, 0.18, 0.44],
    barricade: [0.09, 0.66, 0.19, 0.24]
  },
  [PHASES.CORRIDOR]: {
    eastWindow: [0.16, 0.1, 0.12, 0.38],
    chimes: [0.02, 0.08, 0.13, 0.42],
    waterJar: [0.0, 0.55, 0.22, 0.4],
    mechanism: [0.27, 0.08, 0.51, 0.8],
    exit: [0.83, 0.11, 0.15, 0.53],
    barricade: [0.77, 0.62, 0.18, 0.3]
  }
};

const ITEM_META = {
  'white-jade': { label: '白玉鱼', color: '#eee0bd' },
  'black-jade': { label: '黑玉鱼', color: '#252837' },
  'oil-lamp': { label: '旧油灯', color: '#d49a55' },
  'taiji-key': { label: '太极铜钥', color: '#c79d5f' },
  'taiji-core': { label: '太极轴芯', color: '#b98d52' },
  'thunder-plate': { label: '震卦木片', color: '#5c8a68' },
  'wind-ribbon': { label: '巽风丝带', color: '#7ba98b' },
  'water-scoop': { label: '引水瓢', color: '#6096a6' },
  'wood-seal': { label: '青木门印', color: '#62a66e' }
};

function loadImage(id, path) {
  if (!wx.createImage) return;
  const image = wx.createImage();
  imageReady[id] = false;
  image.onload = () => { imageReady[id] = true; };
  image.onerror = () => { imageReady[id] = false; };
  image.src = path;
  images[id] = image;
}

loadImage('key-art', 'assets/taoist-escape/01-key-art.webp');
loadImage('mortuary', 'assets/taoist-escape/02-yinyang-mortuary-room.webp');
loadImage('corridor', 'assets/taoist-escape/03-wood-wind-corridor.webp');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRounded(x, y, width, height, radius, color) {
  roundedRect(x, y, width, height, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRounded(x, y, width, height, radius, color, lineWidth, dash) {
  roundedRect(x, y, width, height, radius);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dash || []);
  ctx.stroke();
  ctx.setLineDash([]);
}

function text(value, x, y, size, color, align, weight) {
  ctx.fillStyle = color || '#eadfca';
  ctx.font = `${weight || 500} ${size}px "Noto Serif SC", "Songti SC", "STSong", serif`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

function wrapText(value, x, y, maxWidth, lineHeight, size, color, align, maxLines) {
  const chars = String(value).split('');
  const lines = [];
  let line = '';
  ctx.font = `500 ${size}px "Noto Serif SC", "Songti SC", serif`;
  chars.forEach((char) => {
    const next = line + char;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = char;
    } else line = next;
  });
  if (line) lines.push(line);
  lines.slice(0, maxLines || 5).forEach((item, index) => text(item, x, y + index * lineHeight, size, color, align));
}

function seeded(index, seed) {
  const value = Math.sin(index * 83.17 + seed * 21.31) * 41758.331;
  return value - Math.floor(value);
}

function paperTexture(x, y, width, height, seed, count) {
  ctx.save();
  roundedRect(x, y, width, height, Math.min(18, width * 0.06));
  ctx.clip();
  ctx.globalAlpha = 0.11;
  ctx.strokeStyle = '#fff3d0';
  ctx.lineWidth = 1;
  for (let i = 0; i < (count || 50); i += 1) {
    const px = x + seeded(i, seed) * width;
    const py = y + seeded(i + 89, seed) * height;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 3 + seeded(i + 170, seed) * 8, py + (seeded(i + 210, seed) - 0.5) * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function lacquerPanel(x, y, width, height, radius, color, edge, seed) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.5)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 7;
  fillRounded(x, y, width, height, radius, color);
  ctx.restore();
  strokeRounded(x + 2, y + 2, width - 4, height - 4, radius - 2, edge, 2, [3, 7]);
  paperTexture(x, y, width, height, seed || 1, Math.max(20, Math.round(width * height / 5000)));
}

function addHit(id, x, y, width, height, payload, extra) {
  hitAreas.push(Object.assign({ id, x, y, width, height, payload }, extra || {}));
}

function addDrop(id, x, y, width, height) {
  dropAreas.push({ id, x, y, width, height });
}

function contains(area, point) {
  if (area.shape === 'circle') {
    const dx = point.x - area.cx;
    const dy = point.y - area.cy;
    return Math.sqrt(dx * dx + dy * dy) <= area.radius;
  }
  return point.x >= area.x && point.x <= area.x + area.width
    && point.y >= area.y && point.y <= area.y + area.height;
}

function hitTest(point, areas) {
  const source = areas || hitAreas;
  for (let i = source.length - 1; i >= 0; i -= 1) {
    if (contains(source[i], point)) return source[i];
  }
  return null;
}

function roomBox(name) {
  const phase = getVisualPhase();
  const layout = ROOM_LAYOUTS[phase] && ROOM_LAYOUTS[phase][name];
  if (!layout) return { x: 0, y: 0, width: 0, height: 0 };
  return {
    x: ROOM_VIEW.x + layout[0] * ROOM_VIEW.width,
    y: ROOM_VIEW.y + layout[1] * ROOM_VIEW.height,
    width: layout[2] * ROOM_VIEW.width,
    height: layout[3] * ROOM_VIEW.height
  };
}

function getVisualPhase() {
  if (state.phase === PHASES.DEAD) return state.deadRoom || state.checkpoint;
  if (state.phase === PHASES.ENDING) return PHASES.CORRIDOR;
  return state.phase;
}

function drawCoverImage(image, x, y, width, height) {
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;
  if (sourceRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / targetRatio;
    sy = (image.height - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
}

function drawContainImage(image, x, y, width, height) {
  const ratio = Math.min(width / image.width, height / image.height);
  const dw = image.width * ratio;
  const dh = image.height * ratio;
  ctx.drawImage(image, x + (width - dw) / 2, y + (height - dh) / 2, dw, dh);
}

function drawFallbackRoom() {
  const gradient = ctx.createLinearGradient(0, ROOM_VIEW.y, 0, ROOM_VIEW.y + ROOM_VIEW.height);
  gradient.addColorStop(0, '#111922');
  gradient.addColorStop(1, '#33231f');
  ctx.fillStyle = gradient;
  ctx.fillRect(ROOM_VIEW.x, ROOM_VIEW.y, ROOM_VIEW.width, ROOM_VIEW.height);
}

function drawTrigram(lines, x, y, width, color) {
  const gap = width * 0.12;
  const lineHeight = Math.max(5, width * 0.08);
  lines.forEach((solid, index) => {
    const py = y + (2 - index) * (lineHeight + 8);
    ctx.fillStyle = color;
    if (solid) fillRounded(x - width / 2, py, width, lineHeight, lineHeight / 2, color);
    else {
      const half = (width - gap) / 2;
      fillRounded(x - width / 2, py, half, lineHeight, lineHeight / 2, color);
      fillRounded(x + gap / 2, py, half, lineHeight, lineHeight / 2, color);
    }
  });
}

function drawTaiji(x, y, radius, rotation, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation || 0);
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.fillStyle = '#e9dfc6';
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f2530';
  ctx.beginPath();
  ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -radius / 2, radius / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#e9dfc6';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, radius / 2, radius / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#1f2530';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -radius / 2, radius * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = '#1f2530';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, radius / 2, radius * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = '#e9dfc6';
  ctx.fill();
  ctx.restore();
}

function drawDirectionArrow(cx, cy, angle, radius, color) {
  const direction = angle * Math.PI / 2;
  const x = cx + Math.cos(direction) * radius;
  const y = cy + Math.sin(direction) * radius;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(direction);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-8, -8);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRoomFrame() {
  const gradient = ctx.createLinearGradient(0, 0, 0, SCENE.height);
  gradient.addColorStop(0, '#111318');
  gradient.addColorStop(1, '#251d1a');
  ctx.fillStyle = gradient;
  ctx.fillRect(SCENE.x, SCENE.y, SCENE.width, SCENE.height);
  strokeRounded(ROOM_VIEW.x + 4, ROOM_VIEW.y + 4, ROOM_VIEW.width - 8, ROOM_VIEW.height - 8, 8, '#81684b', 3);
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.fillRect(SCENE.x, 0, SCENE.width, ROOM_VIEW.y);
  ctx.fillRect(SCENE.x, ROOM_VIEW.y + ROOM_VIEW.height, SCENE.width, SCENE.height - ROOM_VIEW.y - ROOM_VIEW.height);
}

function drawRoomScene(time, interactive) {
  drawRoomFrame();
  const phase = getVisualPhase();
  const imageId = phase === PHASES.CORRIDOR ? 'corridor' : 'mortuary';
  if (imageReady[imageId]) drawContainImage(images[imageId], ROOM_VIEW.x, ROOM_VIEW.y, ROOM_VIEW.width, ROOM_VIEW.height);
  else drawFallbackRoom();

  ctx.save();
  roundedRect(ROOM_VIEW.x, ROOM_VIEW.y, ROOM_VIEW.width, ROOM_VIEW.height, 6);
  ctx.clip();
  const shade = ctx.createLinearGradient(ROOM_VIEW.x, ROOM_VIEW.y, ROOM_VIEW.x, ROOM_VIEW.y + ROOM_VIEW.height);
  shade.addColorStop(0, 'rgba(3,5,8,.03)');
  shade.addColorStop(1, 'rgba(7,4,3,.18)');
  ctx.fillStyle = shade;
  ctx.fillRect(ROOM_VIEW.x, ROOM_VIEW.y, ROOM_VIEW.width, ROOM_VIEW.height);
  if (phase === PHASES.MORTUARY) drawMortuaryOverlays(time, interactive);
  if (phase === PHASES.CORRIDOR) drawCorridorOverlays(time, interactive);
  drawThreatInRoom(time);
  drawSparks();
  ctx.restore();

  drawRoomCaption(phase);
}

function drawRoomCaption(phase) {
  const roomName = phase === PHASES.MORTUARY ? '序章 · 阴阳义庄' : '第一关 · 青木风廊';
  const knowledge = phase === PHASES.MORTUARY ? '阴阳互补 · 光影显隐' : '震雷启动 · 巽风贯穿 · 水生木';
  const y = PORTRAIT ? 40 : 42;
  text(roomName, 26, y, PORTRAIT ? 23 : 21, '#ead7b4', 'left', 800);
  text(knowledge, 26, y + 31, 13, '#a98d6e', 'left', 600);
}

function drawMortuaryOverlays(time, interactive) {
  const altar = roomBox('altar');
  const sun = roomBox('sun');
  const moon = roomBox('moon');
  const coffin = roomBox('coffin');
  const shadow = roomBox('shadow');
  const exit = roomBox('exit');
  const barricade = roomBox('barricade');

  if (interactive) {
    addHit('inspect-altar', altar.x, altar.y, altar.width, altar.height);
    addHit('inspect-mirror', moon.x, moon.y, moon.width, moon.height);
    addHit('open-shadow', shadow.x, shadow.y, shadow.width, shadow.height);
    addHit('inspect-coffin', coffin.x, coffin.y, coffin.width, coffin.height);
    addHit('inspect-exit', exit.x, exit.y, exit.width, exit.height);
    addHit('barricade', barricade.x, barricade.y, barricade.width, barricade.height);
    addDrop('sun-device', sun.x, sun.y, sun.width, sun.height);
    addDrop('shadow-table', shadow.x, shadow.y, shadow.width, shadow.height);
    addDrop('exit-door', exit.x, exit.y, exit.width, exit.height);
  }

  if (state.mortuary.sunLampLit) {
    const glow = ctx.createRadialGradient(sun.x + sun.width / 2, sun.y + sun.height / 2, 10, sun.x + sun.width / 2, sun.y + sun.height / 2, sun.width);
    glow.addColorStop(0, 'rgba(255,190,80,.45)');
    glow.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - sun.width / 2, sun.y - sun.height / 2, sun.width * 2, sun.height * 2);
  }

  if (state.mortuary.whitePlaced || state.mortuary.blackPlaced) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    if (state.mortuary.whitePlaced) {
      ctx.fillStyle = '#e9dfc6';
      ctx.beginPath();
      ctx.arc(shadow.x + shadow.width * 0.43, shadow.y + shadow.height * 0.55, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.mortuary.blackPlaced) {
      ctx.fillStyle = '#202631';
      ctx.beginPath();
      ctx.arc(shadow.x + shadow.width * 0.57, shadow.y + shadow.height * 0.55, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (state.mortuary.shadowSolved) {
    ctx.save();
    ctx.shadowColor = '#d8b56d';
    ctx.shadowBlur = 30;
    drawTaiji(shadow.x + shadow.width / 2, shadow.y + shadow.height / 2, Math.min(shadow.width, shadow.height) * 0.23, time * 0.0004, 0.9);
    ctx.restore();
  }

  if (interactive) drawSuggestedHotspot(time, !state.mortuary.altarSearched ? altar
    : !state.mortuary.mirrorOpened ? moon
      : !state.mortuary.sunLampLit ? sun
        : !state.mortuary.shadowSolved ? shadow : exit);
}

function drawCorridorOverlays(time, interactive) {
  const east = roomBox('eastWindow');
  const chimes = roomBox('chimes');
  const jar = roomBox('waterJar');
  const mechanism = roomBox('mechanism');
  const exit = roomBox('exit');
  const barricade = roomBox('barricade');

  if (interactive) {
    addHit('inspect-east-window', east.x, east.y, east.width, east.height);
    addHit('open-chimes', chimes.x, chimes.y, chimes.width, chimes.height);
    addHit('inspect-water-jar', jar.x, jar.y, jar.width, jar.height);
    addHit('open-mechanism', mechanism.x, mechanism.y, mechanism.width, mechanism.height);
    addHit('inspect-exit', exit.x, exit.y, exit.width, exit.height);
    addHit('barricade', barricade.x, barricade.y, barricade.width, barricade.height);
    addDrop('wood-mechanism', mechanism.x, mechanism.y, mechanism.width, mechanism.height);
    addDrop('exit-door', exit.x, exit.y, exit.width, exit.height);
  }

  const inserted = [state.corridor.coreInserted, state.corridor.plateInserted, state.corridor.ribbonInserted, state.corridor.waterSupplied].filter(Boolean).length;
  if (inserted) {
    ctx.save();
    ctx.globalAlpha = 0.2 + inserted * 0.1;
    strokeRounded(mechanism.x + 10, mechanism.y + 10, mechanism.width - 20, mechanism.height - 20, 30, '#85b991', 4, [4, 8]);
    ctx.restore();
  }
  if (state.corridor.mechanismSolved) {
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(time * 0.004) * 0.12;
    ctx.strokeStyle = '#7dcc88';
    ctx.lineWidth = 8;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(mechanism.x + mechanism.width * 0.48, mechanism.y + mechanism.height * 0.4);
      ctx.bezierCurveTo(
        mechanism.x + mechanism.width * seeded(i, 18),
        mechanism.y + mechanism.height * seeded(i + 7, 29),
        exit.x - 40,
        exit.y + exit.height * seeded(i + 12, 37),
        exit.x + exit.width * 0.45,
        exit.y + exit.height * 0.5
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  if (interactive) drawSuggestedHotspot(time, !state.corridor.plateTaken ? east
    : !state.corridor.chimesSolved ? chimes
      : !state.corridor.waterTaken ? jar
        : !state.corridor.mechanismSolved ? mechanism : exit);
}

function drawSuggestedHotspot(time, box) {
  if (!box || focus || state.phase === PHASES.DEAD || state.phase === PHASES.ENDING) return;
  const alpha = 0.3 + Math.sin(time * 0.004) * 0.14;
  strokeRounded(box.x - 5, box.y - 5, box.width + 10, box.height + 10, 18, `rgba(222,190,120,${alpha})`, 2, [3, 8]);
}

function drawThreatInRoom(time) {
  const threat = state.getThreatStage();
  if (!threat.level || !state.isRoomPhase()) return;
  const box = state.phase === PHASES.MORTUARY ? roomBox('coffin') : roomBox('exit');
  ctx.save();
  const shake = threat.level >= 2 ? Math.sin(time * 0.04) * threat.level * 1.2 : 0;
  ctx.translate(shake, 0);
  if (state.phase === PHASES.MORTUARY) {
    ctx.strokeStyle = `rgba(175,45,35,${0.18 + threat.level * 0.12})`;
    ctx.lineWidth = 3 + threat.level;
    ctx.beginPath();
    ctx.moveTo(box.x + box.width * 0.15, box.y + box.height * 0.55);
    ctx.lineTo(box.x + box.width * 0.38, box.y + box.height * 0.36);
    ctx.lineTo(box.x + box.width * 0.52, box.y + box.height * 0.62);
    ctx.lineTo(box.x + box.width * 0.82, box.y + box.height * 0.38);
    ctx.stroke();
    if (threat.level >= 3) {
      ctx.fillStyle = 'rgba(130,145,130,.75)';
      fillRounded(box.x + box.width * 0.48, box.y + box.height * 0.18, 12, box.height * 0.48, 5, ctx.fillStyle);
      for (let i = 0; i < 4; i += 1) {
        ctx.strokeStyle = '#b9b59a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(box.x + box.width * 0.49, box.y + box.height * (0.22 + i * 0.07));
        ctx.lineTo(box.x + box.width * (0.56 + i * 0.015), box.y + box.height * (0.16 + i * 0.04));
        ctx.stroke();
      }
    }
  } else {
    const ratio = state.getThreatRatio();
    const zx = ROOM_VIEW.x + ROOM_VIEW.width * (1.04 - ratio * 0.28);
    const zy = ROOM_VIEW.y + ROOM_VIEW.height * 0.46;
    ctx.globalAlpha = 0.18 + threat.level * 0.14;
    ctx.fillStyle = '#11191a';
    ctx.beginPath();
    ctx.arc(zx, zy - 40, 22, 0, Math.PI * 2);
    ctx.fill();
    fillRounded(zx - 20, zy - 23, 40, 98, 15, '#11191a');
    ctx.strokeStyle = '#11191a';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(zx - 14, zy + 10);
    ctx.lineTo(zx - 48, zy - 2);
    ctx.moveTo(zx + 14, zy + 10);
    ctx.lineTo(zx + 50, zy - 4);
    ctx.stroke();
  }
  ctx.restore();
}

function spawnSparks(x, y, color) {
  for (let i = 0; i < 22; i += 1) {
    sparks.push({
      x,
      y,
      vx: (seeded(i, x) - 0.5) * 3.4,
      vy: -1 - seeded(i + 3, y) * 2.7,
      life: 1,
      color: color || '#d7b26b'
    });
  }
}

function drawSparks() {
  sparks.forEach((spark) => {
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vy += 0.035;
    spark.life -= 0.02;
    ctx.globalAlpha = Math.max(0, spark.life);
    ctx.fillStyle = spark.color;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, 1.5 + spark.life * 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  sparks = sparks.filter((spark) => spark.life > 0);
}

function drawPanel(time) {
  const gradient = ctx.createLinearGradient(PANEL.x, PANEL.y, PANEL.x + PANEL.width, PANEL.y + PANEL.height);
  gradient.addColorStop(0, '#1d1b1b');
  gradient.addColorStop(1, '#33241f');
  ctx.fillStyle = gradient;
  ctx.fillRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height);
  paperTexture(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 91, 100);
  if (PORTRAIT) drawPortraitPanel(time);
  else drawLandscapePanel(time);
}

function drawProgress(x, y, gap) {
  const progress = state.getProgress();
  for (let i = 0; i < 11; i += 1) {
    ctx.fillStyle = i < progress ? '#caa15f' : '#4a4140';
    ctx.beginPath();
    ctx.arc(x + i * gap, y, i < progress ? 5.5 : 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawThreatPanel(x, y, width, height, compact) {
  const threat = state.getThreatStage();
  strokeRounded(x, y, width, height, 16, threat.level >= 3 ? '#9d4033' : '#61514a', 2, [4, 7]);
  text('尸近', x + 16, y + (compact ? 22 : 25), compact ? 12 : 13, '#aa8b75', 'left', 800);
  text(threat.label, x + width - 16, y + (compact ? 22 : 25), compact ? 13 : 15, threat.level >= 3 ? '#e17a5e' : '#d4b58d', 'right', 800);
  const ratio = state.getThreatRatio();
  const lineY = y + height - (compact ? 15 : 18);
  ctx.strokeStyle = '#59423b';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 16, lineY);
  ctx.lineTo(x + width - 16, lineY);
  ctx.stroke();
  if (ratio > 0) {
    const end = x + 16 + (width - 32) * ratio;
    ctx.strokeStyle = threat.level >= 3 ? '#b44837' : '#8f6548';
    ctx.beginPath();
    ctx.moveTo(x + 16, lineY);
    ctx.lineTo(end, lineY);
    ctx.stroke();
    for (let i = 0; i < threat.level * 2; i += 1) {
      const cx = x + width - 18 - seeded(i, 14) * width * 0.35;
      const cy = y + 5 + seeded(i + 11, 19) * (height - 16);
      ctx.strokeStyle = `rgba(180,55,40,${0.25 + threat.level * 0.12})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - 12, cy + 7);
      ctx.lineTo(cx - 5, cy + 15);
      ctx.stroke();
    }
  }
}

function drawLandscapePanel(time) {
  text('镇 夜 司', PANEL.x + 24, 38, 25, '#ead7b4', 'left', 900);
  text('五 行 锁 · H5试炼', PANEL.x + 24, 70, 12, '#9e8065', 'left', 700);
  drawProgress(PANEL.x + 28, 104, 24);
  drawThreatPanel(PANEL.x + 22, 128, PANEL.width - 44, 66, false);

  strokeRounded(PANEL.x + 22, 212, PANEL.width - 44, 150, 18, 'rgba(160,122,82,.35)', 2, [4, 7]);
  text('夜巡录', PANEL.x + 38, 235, 13, '#c69a68', 'left', 800);
  wrapText(state.message, PANEL.x + 38, 267, PANEL.width - 76, 23, 14, '#e2d6c4', 'left', 4);

  fillRounded(PANEL.x + 28, 380, 126, 45, 14, '#6b4438');
  strokeRounded(PANEL.x + 28, 380, 126, 45, 14, '#a47455', 2, [3, 6]);
  text('观 · 提示', PANEL.x + 91, 403, 14, '#f0dcc0', 'center', 800);
  addHit('hint', PANEL.x + 28, 380, 126, 45);
  fillRounded(PANEL.x + 166, 380, 126, 45, 14, '#3f5046');
  strokeRounded(PANEL.x + 166, 380, 126, 45, 14, '#708c76', 2, [3, 6]);
  text('文化图鉴', PANEL.x + 229, 403, 14, '#d7e0cf', 'center', 800);
  addHit('codex', PANEL.x + 166, 380, 126, 45);

  text('随身物', PANEL.x + 28, 458, 13, '#a88a72', 'left', 800);
  drawInventory(PANEL.x + 22, 478, PANEL.width - 44, 216, 2);
}

function drawPortraitPanel(time) {
  text('镇夜司 · 五行锁', PANEL.x + 22, PANEL.y + 32, 22, '#ead7b4', 'left', 900);
  drawProgress(PANEL.x + 390, PANEL.y + 32, 27);
  drawThreatPanel(PANEL.x + 22, PANEL.y + 58, 210, 62, true);
  wrapText(state.message, PANEL.x + 252, PANEL.y + 72, 330, 22, 14, '#e2d6c4', 'left', 3);
  fillRounded(PANEL.x + 594, PANEL.y + 60, 104, 48, 14, '#6b4438');
  text('提示', PANEL.x + 646, PANEL.y + 85, 14, '#f0dcc0', 'center', 800);
  addHit('hint', PANEL.x + 594, PANEL.y + 60, 104, 48);
  fillRounded(PANEL.x + 594, PANEL.y + 119, 104, 42, 13, '#3f5046');
  text('图鉴', PANEL.x + 646, PANEL.y + 141, 13, '#d7e0cf', 'center', 800);
  addHit('codex', PANEL.x + 594, PANEL.y + 119, 104, 42);
  text('拖动物品到场景设备或房门', PANEL.x + 22, PANEL.y + 160, 13, '#9f8979', 'left');
  drawInventory(PANEL.x + 18, PANEL.y + 184, PANEL.width - 36, PANEL.height - 204, 5);
}

function drawInventory(x, y, width, height, columns) {
  const items = state.inventory.slice();
  inventoryAreas = [];
  if (!items.length) {
    strokeRounded(x, y, width, height, 16, 'rgba(150,118,90,.28)', 2, [5, 8]);
    text('空', x + width / 2, y + height / 2, 15, '#655b57', 'center', 700);
    return;
  }
  const gap = 9;
  const rows = Math.ceil(items.length / columns);
  const cardWidth = (width - gap * (columns - 1)) / columns;
  const cardHeight = Math.min((height - gap * (rows - 1)) / rows, PORTRAIT ? 142 : 100);
  items.forEach((itemId, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const card = { x: x + col * (cardWidth + gap), y: y + row * (cardHeight + gap), width: cardWidth, height: cardHeight };
    const dragging = drag && drag.itemId === itemId;
    lacquerPanel(card.x, card.y, card.width, card.height, 14, dragging ? '#403331' : '#302b2a', '#665145', 120 + index);
    if (!dragging) drawItemIcon(itemId, card.x + card.width / 2, card.y + card.height * 0.43, Math.min(55, card.height * 0.5), false);
    text(ITEM_META[itemId].label, card.x + card.width / 2, card.y + card.height - 15, Math.min(12, card.width * 0.12), '#dccbb5', 'center', 700);
    const area = Object.assign({ id: `item-${itemId}`, payload: itemId }, card);
    inventoryAreas.push(area);
    hitAreas.push(area);
  });
}

function drawItemIcon(itemId, x, y, size, lifted) {
  const meta = ITEM_META[itemId];
  ctx.save();
  ctx.translate(x, y);
  if (lifted) {
    ctx.scale(1.12, 1.12);
    ctx.shadowColor = '#e0b867';
    ctx.shadowBlur = 18;
  }
  if (itemId === 'white-jade' || itemId === 'black-jade') {
    ctx.fillStyle = meta.color;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.36, -Math.PI / 2, Math.PI / 2);
    ctx.arc(0, size * 0.18, size * 0.18, Math.PI / 2, -Math.PI / 2, true);
    ctx.closePath();
    ctx.fill();
  } else if (itemId === 'oil-lamp') {
    fillRounded(-size * 0.27, -size * 0.05, size * 0.54, size * 0.34, 8, '#9b623c');
    ctx.fillStyle = '#f0b34d';
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.48);
    ctx.bezierCurveTo(size * 0.22, -size * 0.2, size * 0.16, size * 0.02, 0, size * 0.08);
    ctx.bezierCurveTo(-size * 0.16, size * 0.02, -size * 0.22, -size * 0.2, 0, -size * 0.48);
    ctx.fill();
  } else if (itemId === 'taiji-key' || itemId === 'taiji-core') {
    drawTaiji(0, -size * 0.12, size * 0.3, 0, 1);
    if (itemId === 'taiji-key') {
      fillRounded(-size * 0.07, size * 0.15, size * 0.14, size * 0.45, 5, meta.color);
      ctx.fillStyle = meta.color;
      ctx.fillRect(0, size * 0.45, size * 0.22, size * 0.1);
    }
  } else if (itemId === 'thunder-plate') {
    fillRounded(-size * 0.38, -size * 0.48, size * 0.76, size * 0.96, 10, '#526b4e');
    drawTrigram([1, 0, 0], 0, -size * 0.18, size * 0.5, '#d2c18f');
  } else if (itemId === 'wind-ribbon') {
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = size * 0.18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-size * 0.2, -size * 0.42);
    ctx.bezierCurveTo(size * 0.36, -size * 0.15, -size * 0.36, size * 0.12, size * 0.22, size * 0.44);
    ctx.stroke();
  } else if (itemId === 'water-scoop') {
    ctx.strokeStyle = '#9d7448';
    ctx.lineWidth = size * 0.12;
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, size * 0.05);
    ctx.lineTo(size * 0.38, size * 0.45);
    ctx.stroke();
    ctx.fillStyle = meta.color;
    ctx.beginPath();
    ctx.ellipse(-size * 0.15, -size * 0.08, size * 0.32, size * 0.23, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (itemId === 'wood-seal') {
    ctx.fillStyle = meta.color;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = -Math.PI / 2 + i * Math.PI / 4;
      const radius = i % 2 ? size * 0.28 : size * 0.45;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    drawTrigram([1, 0, 0], 0, -size * 0.12, size * 0.42, '#dbe5c8');
  }
  ctx.restore();
}

function drawIntro() {
  if (imageReady['key-art']) drawCoverImage(images['key-art'], 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  else {
    ctx.fillStyle = '#11151a';
    ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  }
  ctx.fillStyle = 'rgba(5,7,10,.44)';
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  const card = PORTRAIT
    ? { x: 55, y: 270, width: 610, height: 520 }
    : { x: 150, y: 120, width: 590, height: 480 };
  lacquerPanel(card.x, card.y, card.width, card.height, 28, 'rgba(28,25,24,.94)', '#9d7048', 38);
  text('镇 夜 司', card.x + card.width / 2, card.y + 82, PORTRAIT ? 44 : 48, '#f0dfbd', 'center', 900);
  text('五 行 锁', card.x + card.width / 2, card.y + 138, 24, '#bc895c', 'center', 800);
  drawTaiji(card.x + card.width / 2, card.y + 203, 34, 0, 0.92);
  wrapText('子时封禁失衡，六门尽锁。\n学习阴阳五行，在守门尸破门前取得下一把钥匙。', card.x + card.width / 2, card.y + 274, card.width - 110, 30, 17, '#ded0bb', 'center', 4);
  fillRounded(card.x + 88, card.y + card.height - 94, card.width - 176, 58, 18, '#744638');
  strokeRounded(card.x + 88, card.y + card.height - 94, card.width - 176, 58, 18, '#b77b52', 2, [4, 7]);
  text('进入镇夜司', card.x + card.width / 2, card.y + card.height - 64, 19, '#f1dfbf', 'center', 900);
  addHit('start', card.x + 88, card.y + card.height - 94, card.width - 176, 58);
}

function modalRect() {
  return PORTRAIT
    ? { x: 40, y: 70, width: 640, height: 650 }
    : { x: 120, y: 68, width: 720, height: 584 };
}

function drawModal(time) {
  if (!focus || !state.isRoomPhase()) return;
  ctx.fillStyle = 'rgba(5,6,8,.72)';
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  const modal = modalRect();
  lacquerPanel(modal.x, modal.y, modal.width, modal.height, 28, '#262120', '#8b6348', 66);
  fillRounded(modal.x + modal.width - 58, modal.y + 18, 40, 40, 12, '#573b32');
  text('×', modal.x + modal.width - 38, modal.y + 39, 24, '#ead9bd', 'center', 600);
  addHit('close-focus', modal.x + modal.width - 66, modal.y + 10, 56, 56);
  if (focus === 'shadow') drawShadowFocus(modal, time);
  if (focus === 'chimes') drawChimesFocus(modal, time);
  if (focus === 'mechanism') drawMechanismFocus(modal, time);
  if (focus === 'codex') drawCodexFocus(modal);
}

function drawShadowFocus(modal, time) {
  text('日月照影台', modal.x + 38, modal.y + 46, 22, '#ead8ba', 'left', 900);
  const leftX = modal.x + modal.width * 0.31;
  const rightX = modal.x + modal.width * 0.69;
  const cy = modal.y + modal.height * 0.46;
  const radius = Math.min(105, modal.width * 0.17);

  ctx.save();
  ctx.shadowColor = state.mortuary.sunLampLit ? '#f2aa4c' : '#151515';
  ctx.shadowBlur = state.mortuary.sunLampLit ? 26 : 6;
  ctx.fillStyle = state.mortuary.sunLampLit ? '#d7903f' : '#51443c';
  ctx.beginPath();
  ctx.arc(leftX, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b98a59';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.restore();
  drawDirectionArrow(leftX, cy, state.mortuary.sunAngle, radius * 0.68, '#f6dfab');

  ctx.save();
  ctx.shadowColor = '#a8c9e3';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#364653';
  ctx.beginPath();
  ctx.arc(rightX, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#88a7bb';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.restore();
  drawDirectionArrow(rightX, cy, state.mortuary.moonAngle, radius * 0.68, '#d6e7ed');

  text('日轮', leftX, cy + radius + 32, 16, '#d7ae78', 'center', 800);
  text('月镜', rightX, cy + radius + 32, 16, '#a9c5d2', 'center', 800);
  addHit('rotate-sun', leftX - radius, cy - radius, radius * 2, radius * 2, null, { shape: 'circle', cx: leftX, cy, radius });
  addHit('rotate-moon', rightX - radius, cy - radius, radius * 2, radius * 2, null, { shape: 'circle', cx: rightX, cy, radius });

  const status = [
    state.mortuary.sunLampLit ? '日灯已亮' : '日灯缺火',
    state.mortuary.whitePlaced ? '白玉已入阳槽' : '白玉未归位',
    state.mortuary.blackPlaced ? '黑玉已入阴槽' : '黑玉未归位'
  ];
  text(status.join(' · '), modal.x + modal.width / 2, modal.y + modal.height - 112, 13, '#a99582', 'center', 700);
  fillRounded(modal.x + 125, modal.y + modal.height - 82, modal.width - 250, 52, 16, state.mortuary.shadowSolved ? '#3f5848' : '#744638');
  text(state.mortuary.shadowSolved ? '两仪已合' : '合影启匣', modal.x + modal.width / 2, modal.y + modal.height - 55, 17, '#efdfc3', 'center', 900);
  if (!state.mortuary.shadowSolved) addHit('activate-shadow', modal.x + 125, modal.y + modal.height - 82, modal.width - 250, 52);
}

function drawChimesFocus(modal, time) {
  text('东南竹铃', modal.x + 38, modal.y + 46, 22, '#ead8ba', 'left', 900);
  text('巽为风。观察竹帘摆幅，听三枚铃的长短。', modal.x + modal.width / 2, modal.y + 92, 14, '#a9947c', 'center', 700);
  const centers = [0.27, 0.5, 0.73].map((ratio) => modal.x + modal.width * ratio);
  const top = modal.y + 150;
  const lengths = [170, 135, 205];
  centers.forEach((cx, index) => {
    const sway = Math.sin(time * 0.004 + index * 1.5) * 5;
    ctx.strokeStyle = '#786446';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + sway, top + lengths[index]);
    ctx.stroke();
    ctx.fillStyle = ['#8f7350', '#b08a58', '#6f8b71'][index];
    ctx.beginPath();
    ctx.arc(cx + sway, top + lengths[index] + 22, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d1b47c';
    ctx.lineWidth = 4;
    ctx.stroke();
    text(['左', '中', '右'][index], cx + sway, top + lengths[index] + 22, 14, '#f1dfbd', 'center', 800);
    addHit(`chime-${index}`, cx - 60, top + 80, 120, 190, index);
  });
  const input = state.corridor.chimeInput;
  text(input.length ? `已听：${input.map((i) => ['左', '中', '右'][i]).join(' → ')}` : '依次轻触三枚风铃', modal.x + modal.width / 2, modal.y + modal.height - 72, 15, state.corridor.chimesSolved ? '#81b38a' : '#c8b49a', 'center', 800);
  if (state.corridor.chimesSolved) text('风序正确，巽风丝带已经取得。', modal.x + modal.width / 2, modal.y + modal.height - 42, 14, '#7fb78b', 'center', 800);
}

function drawMechanismFocus(modal, time) {
  text('风雷木枢', modal.x + 38, modal.y + 46, 22, '#ead8ba', 'left', 900);
  const slots = [
    ['轴芯', state.corridor.coreInserted],
    ['震木', state.corridor.plateInserted],
    ['巽风', state.corridor.ribbonInserted],
    ['引水', state.corridor.waterSupplied]
  ];
  const slotY = modal.y + 102;
  slots.forEach((slot, index) => {
    const w = 112;
    const gap = 14;
    const total = w * 4 + gap * 3;
    const x = modal.x + (modal.width - total) / 2 + index * (w + gap);
    lacquerPanel(x, slotY, w, 64, 13, slot[1] ? '#3f5a48' : '#332d2a', slot[1] ? '#75a17c' : '#655043', 190 + index);
    text(slot[0], x + w / 2, slotY + 33, 14, slot[1] ? '#dce8ce' : '#897a6d', 'center', 800);
  });

  const cx = modal.x + modal.width / 2;
  const cy = modal.y + 295;
  ctx.fillStyle = '#3f4a3e';
  ctx.beginPath();
  ctx.arc(cx, cy, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8b7954';
  ctx.lineWidth = 8;
  ctx.stroke();
  drawTrigram([1, 0, 0], cx, cy - 28, 92, '#d5c38d');

  const routeY = modal.y + 435;
  text('水生木，金克木。选择允许水流通过的管道。', cx, routeY - 40, 14, '#a9947c', 'center', 700);
  for (let i = 0; i < 3; i += 1) {
    const x = cx - 150 + i * 150;
    const on = state.corridor.waterRoute[i];
    const metal = i === 1;
    fillRounded(x - 54, routeY, 108, 58, 15, on ? (metal ? '#7b5550' : '#3c6d67') : '#332d2a');
    strokeRounded(x - 54, routeY, 108, 58, 15, metal ? '#a0a2a0' : '#6f856e', 3);
    text(metal ? '金管' : ['左木渠', '', '右木渠'][i], x, routeY + 30, 14, on ? '#e3e5d6' : '#8b7d70', 'center', 800);
    addHit(`water-route-${i}`, x - 54, routeY, 108, 58, i);
  }

  fillRounded(modal.x + 135, modal.y + modal.height - 68, modal.width - 270, 46, 15, state.corridor.mechanismSolved ? '#3f5a48' : '#744638');
  text(state.corridor.mechanismSolved ? '青藤已生' : '启动木枢', cx, modal.y + modal.height - 44, 16, '#efdfc3', 'center', 900);
  if (!state.corridor.mechanismSolved) addHit('activate-mechanism', modal.x + 135, modal.y + modal.height - 68, modal.width - 270, 46);
}

function drawCodexFocus(modal) {
  text('五行锁录', modal.x + 38, modal.y + 46, 22, '#ead8ba', 'left', 900);
  const entries = [];
  if (state.mortuary.shadowSolved || state.phase === PHASES.CORRIDOR || state.phase === PHASES.ENDING) entries.push({
    title: '阴阳',
    body: '阴阳不是善恶之分，而是相对、互补并可转化的两种状态。义庄机关需要光与影、黑与白共同完成。',
    color: '#c6b78f'
  });
  if (state.corridor.chimesSolved || state.corridor.mechanismSolved || state.phase === PHASES.ENDING) entries.push({
    title: '震与巽',
    body: '震为雷，主发动，方位在东；巽为风，主进入与流动，方位在东南。风雷合用才能启动木枢。',
    color: '#7da682'
  });
  if (state.corridor.mechanismSolved || state.phase === PHASES.ENDING) entries.push({
    title: '水生木 · 金克木',
    body: '五行关系不是装饰。水能滋养木，金能砍伐木，因此引水必须避开金属管道。',
    color: '#6ca1aa'
  });
  if (!entries.length) {
    text('完成文化谜题后，知识条目会记录在这里。', modal.x + modal.width / 2, modal.y + modal.height / 2, 16, '#8f8074', 'center', 700);
    return;
  }
  entries.forEach((entry, index) => {
    const y = modal.y + 92 + index * 145;
    lacquerPanel(modal.x + 52, y, modal.width - 104, 122, 16, '#302a27', entry.color, 240 + index);
    text(entry.title, modal.x + 76, y + 27, 17, entry.color, 'left', 900);
    wrapText(entry.body, modal.x + 76, y + 57, modal.width - 152, 22, 14, '#d7cbb9', 'left', 3);
  });
}

function drawDead() {
  ctx.fillStyle = 'rgba(9,7,7,.82)';
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  const card = PORTRAIT
    ? { x: 62, y: 270, width: 596, height: 500 }
    : { x: 250, y: 125, width: 500, height: 470 };
  lacquerPanel(card.x, card.y, card.width, card.height, 28, '#261b19', '#8d382d', 302);
  text('尸 已 破 门', card.x + card.width / 2, card.y + 78, 34, '#df8067', 'center', 900);
  ctx.fillStyle = '#171b18';
  ctx.beginPath();
  ctx.arc(card.x + card.width / 2, card.y + 190, 46, 0, Math.PI * 2);
  ctx.fill();
  fillRounded(card.x + card.width / 2 - 42, card.y + 225, 84, 105, 24, '#171b18');
  wrapText(state.deathReason, card.x + card.width / 2, card.y + 353, card.width - 90, 25, 15, '#d6c6b4', 'center', 3);
  fillRounded(card.x + 92, card.y + card.height - 78, card.width - 184, 50, 16, '#704136');
  text('从本房间重试', card.x + card.width / 2, card.y + card.height - 52, 16, '#f0ddbf', 'center', 900);
  addHit('retry-room', card.x + 92, card.y + card.height - 78, card.width - 184, 50);
}

function drawEnding() {
  ctx.fillStyle = 'rgba(6,8,7,.7)';
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  const card = PORTRAIT
    ? { x: 52, y: 220, width: 616, height: 590 }
    : { x: 205, y: 95, width: 550, height: 535 };
  lacquerPanel(card.x, card.y, card.width, card.height, 30, '#20251f', '#6e9a72', 340);
  text('青 木 门 已 开', card.x + card.width / 2, card.y + 78, 32, '#cfe0b8', 'center', 900);
  drawTrigram([1, 0, 0], card.x + card.width / 2, card.y + 155, 120, '#c7d9a8');
  wrapText('震雷启动，巽风贯穿，水避金路而生木。\n第一重五行锁解除，离火丹房在门后亮起。', card.x + card.width / 2, card.y + 290, card.width - 100, 29, 17, '#d7d1bd', 'center', 4);
  text('H5 第一版 · 两房间垂直切片完成', card.x + card.width / 2, card.y + 402, 14, '#8fad92', 'center', 800);
  fillRounded(card.x + 96, card.y + card.height - 80, card.width - 192, 50, 16, '#49634f');
  text('重新开始试炼', card.x + card.width / 2, card.y + card.height - 54, 16, '#edf0dd', 'center', 900);
  addHit('restart', card.x + 96, card.y + card.height - 80, card.width - 192, 50);
}

function drawDraggedItem() {
  if (!drag) return;
  drawItemIcon(drag.itemId, drag.x, drag.y, 72, true);
}

function render(time) {
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  hitAreas = [];
  dropAreas = [];
  inventoryAreas = [];

  if (state.phase === PHASES.INTRO) drawIntro();
  else {
    if (state.phase === PHASES.MORTUARY || state.phase === PHASES.CORRIDOR || state.phase === PHASES.DEAD || state.phase === PHASES.ENDING) {
      drawRoomScene(time, state.isRoomPhase());
      drawPanel(time);
    }
    if (state.isRoomPhase()) drawModal(time);
    if (state.phase === PHASES.DEAD) drawDead();
    if (state.phase === PHASES.ENDING) drawEnding();
  }
  drawDraggedItem();
}

function handleStateChange() {
  const progress = state.getProgress();
  if (progress > lastProgress) {
    audio.success();
    platform.vibrate(true);
    spawnSparks(ROOM_VIEW.x + ROOM_VIEW.width * 0.55, ROOM_VIEW.y + ROOM_VIEW.height * 0.48, state.phase === PHASES.CORRIDOR ? '#82c48d' : '#d7b26b');
  }
  const threat = state.getThreatStage();
  if (threat.level > lastThreatLevel) {
    audio.rotate();
    platform.vibrate(threat.level < 3);
  }
  if (state.phase !== lastPhase) {
    focus = null;
    drag = null;
    if (state.phase === PHASES.ENDING) {
      platform.saveProgress({ completed: true, completedAt: Date.now(), chapter: 'five-phase-locks-mvp' });
    }
    persistSession();
  }
  lastProgress = progress;
  lastThreatLevel = threat.level;
  lastPhase = state.phase;
}

function loop(time) {
  state.update();
  handleStateChange();
  render(time || Date.now());
  requestAnimationFrame(loop);
}

function touchPoint(touch) {
  const clientX = touch.clientX === undefined ? touch.x : touch.clientX;
  const clientY = touch.clientY === undefined ? touch.y : touch.clientY;
  return {
    x: clientX / system.windowWidth * DESIGN_WIDTH,
    y: clientY / system.windowHeight * DESIGN_HEIGHT
  };
}

function performAction(area) {
  if (!area) return;
  audio.ensureStarted();
  audio.click();
  if (area.id === 'start') state.begin();
  else if (area.id === 'restart') state.resetAll();
  else if (area.id === 'retry-room') state.retryRoom();
  else if (area.id === 'hint') platform.showRewardedHint(() => state.getHint());
  else if (area.id === 'codex') focus = 'codex';
  else if (area.id === 'close-focus') focus = null;
  else if (area.id === 'inspect-altar') state.inspectAltar();
  else if (area.id === 'inspect-mirror') state.inspectMirror();
  else if (area.id === 'inspect-coffin') state.setMessage(state.threatEndAt ? '棺盖正在松动。你可以推动前景木凳压住它一次。' : '棺内暂时没有动静，但铜镜后的封物似乎与它相连。', 5);
  else if (area.id === 'inspect-exit') state.setMessage(state.phase === PHASES.MORTUARY ? '东门中央是太极形锁孔。' : '青门没有钥匙孔，只留下一枚震卦门印槽。', 5);
  else if (area.id === 'barricade') state.barricade();
  else if (area.id === 'open-shadow') focus = 'shadow';
  else if (area.id === 'rotate-sun') { state.rotateSun(); audio.rotate(); }
  else if (area.id === 'rotate-moon') { state.rotateMoon(); audio.rotate(); }
  else if (area.id === 'activate-shadow') state.activateShadowTable();
  else if (area.id === 'inspect-east-window') state.inspectEastWindow();
  else if (area.id === 'inspect-water-jar') state.inspectWaterJar();
  else if (area.id === 'open-chimes') focus = 'chimes';
  else if (area.id.indexOf('chime-') === 0) { state.ringChime(area.payload); audio.paper(); }
  else if (area.id === 'open-mechanism') focus = 'mechanism';
  else if (area.id.indexOf('water-route-') === 0) { state.toggleWaterRoute(area.payload); audio.rotate(); }
  else if (area.id === 'activate-mechanism') state.activateWoodMechanism();
  handleStateChange();
  persistSession();
}

function tapInventory(itemId) {
  const descriptions = {
    'white-jade': '半枚白玉鱼，温润而明，象征阳面。',
    'black-jade': '半枚黑玉鱼，触手冰冷，象征阴面。',
    'oil-lamp': '一盏仍有灯油的旧灯，适合嵌入日轮装置。',
    'taiji-key': '黑白光影形成的太极铜钥，对应东门锁孔。',
    'taiji-core': '铜钥开门后留下的圆形轴芯，可固定新的机关。',
    'thunder-plate': '下阳上阴的震卦木片，雷主发动，方位在东。',
    'wind-ribbon': '随正确铃序落下的巽风丝带，风主进入与流动。',
    'water-scoop': '从破缸取水的木瓢。水能生木，但要避开金路。',
    'wood-seal': '根系托出的青木门印，正好对应右侧青门。'
  };
  state.setMessage(descriptions[itemId] || '一件尚未理解用途的物品。', 6);
}

function handleDrop(point, itemId) {
  const target = hitTest(point, dropAreas);
  if (!target) {
    state.setMessage('物品在这里没有产生变化。', 3);
    persistSession();
    return;
  }
  const success = state.useItemOn(itemId, target.id);
  if (success) {
    audio.paper();
    if (target.id === 'wood-mechanism') focus = 'mechanism';
    if (target.id === 'shadow-table') focus = 'shadow';
  }
  persistSession();
}

wx.onTouchStart((event) => {
  if (!event.touches || !event.touches.length) return;
  const point = touchPoint(event.touches[0]);
  pressedArea = hitTest(point);
  audio.ensureStarted();
  if (pressedArea && pressedArea.id.indexOf('item-') === 0 && !focus && state.isRoomPhase()) {
    drag = { itemId: pressedArea.payload, x: point.x, y: point.y, startX: point.x, startY: point.y, moved: false };
  }
});

wx.onTouchMove((event) => {
  if (!drag || !event.touches || !event.touches.length) return;
  const point = touchPoint(event.touches[0]);
  drag.x = clamp(point.x, 32, DESIGN_WIDTH - 32);
  drag.y = clamp(point.y, 32, DESIGN_HEIGHT - 32);
  if (Math.abs(point.x - drag.startX) + Math.abs(point.y - drag.startY) > 14) drag.moved = true;
});

wx.onTouchEnd((event) => {
  const touch = event.changedTouches && event.changedTouches.length ? event.changedTouches[0] : null;
  if (!touch) return;
  const point = touchPoint(touch);
  if (drag) {
    const current = drag;
    drag = null;
    if (current.moved) handleDrop(point, current.itemId);
    else tapInventory(current.itemId);
    handleStateChange();
    persistSession();
    pressedArea = null;
    return;
  }
  const released = hitTest(point);
  if (pressedArea && released && pressedArea.id === released.id) performAction(released);
  pressedArea = null;
});

requestAnimationFrame(loop);
