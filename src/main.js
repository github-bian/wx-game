const { DreamAudio } = require('./audio');
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
  ? { x: 0, y: 0, width: 720, height: 900 }
  : { x: 0, y: 0, width: 960, height: 720 };
const PANEL = PORTRAIT
  ? { x: 0, y: 900, width: 720, height: 380 }
  : { x: 960, y: 0, width: 320, height: 720 };
const OBJECT_LAYOUT = PORTRAIT ? {
  map: [0.16, 0.07, 0.32, 0.23],
  lamp: [0.4, 0.1, 0.26, 0.24],
  window: [0.6, 0.08, 0.31, 0.31],
  log: [0.12, 0.48, 0.28, 0.13],
  letter: [0.39, 0.51, 0.26, 0.1],
  stamp: [0.64, 0.46, 0.24, 0.16]
} : {
  map: [0.13, 0.05, 0.32, 0.31],
  lamp: [0.39, 0.04, 0.25, 0.32],
  window: [0.62, 0.03, 0.29, 0.43],
  log: [0.08, 0.57, 0.23, 0.16],
  letter: [0.35, 0.59, 0.21, 0.12],
  stamp: [0.57, 0.53, 0.23, 0.21]
};

canvas.width = DESIGN_WIDTH * pixelRatio;
canvas.height = DESIGN_HEIGHT * pixelRatio;

const state = new GameState();
const audio = new DreamAudio();
const roomImage = wx.createImage ? wx.createImage() : null;
let roomReady = false;
let hitAreas = [];
let dropAreas = [];
let inventoryAreas = [];
let focus = null;
let logFace = 'front';
let pressedArea = null;
let drag = null;
let lastProgress = 0;
let lastPhase = state.phase;
let sparks = [];

if (roomImage) {
  roomImage.onload = () => { roomReady = true; };
  roomImage.onerror = () => { roomReady = false; };
  roomImage.src = PORTRAIT ? 'assets/felt-post-office-room-portrait.webp' : 'assets/felt-post-office-room.webp';
}

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
  ctx.fillStyle = color || '#f8e9d0';
  ctx.font = `${weight || 500} ${size}px system-ui, -apple-system, "PingFang SC", sans-serif`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

function wrapText(value, x, y, maxWidth, lineHeight, size, color, align, maxLines) {
  const chars = String(value).split('');
  const lines = [];
  let line = '';
  ctx.font = `500 ${size}px system-ui, -apple-system, "PingFang SC", sans-serif`;
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
  const value = Math.sin(index * 91.733 + seed * 17.17) * 43758.5453;
  return value - Math.floor(value);
}

function feltTexture(x, y, width, height, color, seed, count) {
  ctx.save();
  roundedRect(x, y, width, height, Math.min(20, width * 0.08));
  ctx.clip();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < (count || 60); i += 1) {
    const px = x + seeded(i, seed) * width;
    const py = y + seeded(i + 77, seed) * height;
    const len = 2 + seeded(i + 131, seed) * 6;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + len, py + (seeded(i + 201, seed) - 0.5) * 3);
    ctx.stroke();
  }
  ctx.restore();
}

function feltPanel(x, y, width, height, radius, color, edge, seed) {
  ctx.save();
  ctx.shadowColor = 'rgba(5, 8, 20, 0.38)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  fillRounded(x, y, width, height, radius, color);
  ctx.restore();
  strokeRounded(x + 2, y + 2, width - 4, height - 4, radius - 2, edge, 2, [3, 7]);
  feltTexture(x, y, width, height, 'rgba(255,255,255,.7)', seed || 1, Math.round(width * height / 3500));
}

function addHit(id, x, y, width, height, payload, extra) {
  hitAreas.push(Object.assign({ id, x, y, width, height, payload }, extra || {}));
}

function addDrop(id, x, y, width, height) {
  dropAreas.push({ id, x, y, width, height });
}

function contains(area, point) {
  if (area.shape === 'ring') {
    const dx = point.x - area.cx;
    const dy = point.y - area.cy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= area.outer && distance >= area.inner;
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

function roomBox(nx, ny, nw, nh) {
  return {
    x: SCENE.x + nx * SCENE.width,
    y: SCENE.y + ny * SCENE.height,
    width: nw * SCENE.width,
    height: nh * SCENE.height
  };
}

function objectBox(name) {
  const value = OBJECT_LAYOUT[name];
  return roomBox(value[0], value[1], value[2], value[3]);
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

function drawFallbackRoom() {
  const gradient = ctx.createLinearGradient(0, 0, 0, SCENE.height);
  gradient.addColorStop(0, '#17233d');
  gradient.addColorStop(0.62, '#303653');
  gradient.addColorStop(1, '#544051');
  ctx.fillStyle = gradient;
  ctx.fillRect(SCENE.x, SCENE.y, SCENE.width, SCENE.height);
  const back = roomBox(0.08, 0.08, 0.84, 0.72);
  feltPanel(back.x, back.y, back.width, back.height, 24, '#26304a', '#71808b', 4);
  const counter = roomBox(0.04, 0.64, 0.92, 0.3);
  feltPanel(counter.x, counter.y, counter.width, counter.height, 28, '#624652', '#b87d71', 7);
}

function drawStitches(x, y, width, color, count) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i += 1) {
    const sx = x + (i / Math.max(1, count - 1)) * width;
    ctx.beginPath();
    ctx.moveTo(sx - 3, y - 2);
    ctx.lineTo(sx + 3, y + 2);
    ctx.stroke();
  }
}

function drawMoonLamp(time) {
  const box = objectBox('lamp');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  if (state.lampSolved) {
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, box.width * 1.2);
    glow.addColorStop(0, 'rgba(210,177,255,.55)');
    glow.addColorStop(1, 'rgba(134,96,190,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - box.width * 1.2, cy - box.width * 1.2, box.width * 2.4, box.width * 2.4);
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(time * 0.003) * 0.08;
    strokeRounded(box.x, box.y, box.width, box.height, 28, '#e2c8ff', 3, [4, 9]);
    ctx.restore();
  }
  addHit('open-lamp', box.x, box.y, box.width, box.height);
  addDrop('lamp', box.x, box.y, box.width, box.height);
}

function drawEnvelope(x, y, width, height, face, glow) {
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  if (glow) {
    ctx.shadowColor = '#d8b7ff';
    ctx.shadowBlur = 22;
  }
  feltPanel(-width / 2, -height / 2, width, height, Math.max(8, width * 0.07), '#d9c7aa', '#8f6c6f', 13);
  if (face === 'front') {
    ctx.strokeStyle = '#8e7074';
    ctx.lineWidth = Math.max(2, width * 0.018);
    ctx.beginPath();
    ctx.moveTo(-width / 2 + 7, -height / 2 + 8);
    ctx.lineTo(0, height * 0.08);
    ctx.lineTo(width / 2 - 7, -height / 2 + 8);
    ctx.stroke();
    ctx.fillStyle = '#9b6678';
    ctx.beginPath();
    ctx.arc(width * 0.2, height * 0.18, width * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9c7aa';
    ctx.beginPath();
    ctx.moveTo(width * 0.2, height * 0.07);
    ctx.lineTo(width * 0.25, height * 0.18);
    ctx.lineTo(width * 0.2, height * 0.28);
    ctx.lineTo(width * 0.15, height * 0.18);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = state.letterRevealed ? '#6e547c' : 'rgba(117,91,104,.24)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-width * 0.3, -height * 0.2 + i * height * 0.2);
      ctx.bezierCurveTo(-width * 0.1, -height * 0.28 + i * height * 0.2, width * 0.1, -height * 0.08 + i * height * 0.2, width * 0.31, -height * 0.18 + i * height * 0.2);
      ctx.stroke();
    }
    if (state.letterRevealed) text('7 · 1 · 4', 0, height * 0.25, Math.max(14, width * 0.13), '#644d75', 'center', 800);
  }
  ctx.restore();
}

function drawRoom(time) {
  ctx.save();
  roundedRect(SCENE.x, SCENE.y, SCENE.width, SCENE.height, 0);
  ctx.clip();
  if (roomReady) drawCoverImage(roomImage, SCENE.x, SCENE.y, SCENE.width, SCENE.height);
  else drawFallbackRoom();
  const shade = ctx.createLinearGradient(SCENE.x, SCENE.y, SCENE.x, SCENE.y + SCENE.height);
  shade.addColorStop(0, 'rgba(10,14,30,.08)');
  shade.addColorStop(1, 'rgba(15,10,23,.24)');
  ctx.fillStyle = shade;
  ctx.fillRect(SCENE.x, SCENE.y, SCENE.width, SCENE.height);

  drawMoonLamp(time);

  const log = objectBox('log');
  addHit('open-log', log.x, log.y, log.width, log.height);

  const letter = objectBox('letter');
  if (!state.letterCollected) {
    addHit('collect-letter', letter.x, letter.y, letter.width, letter.height);
  } else {
    fillRounded(letter.x - 4, letter.y - 4, letter.width + 8, letter.height + 8, 14, 'rgba(74,50,65,.74)');
    drawStitches(letter.x + 8, letter.y + letter.height * 0.5, letter.width - 16, 'rgba(222,178,155,.36)', 12);
  }

  const stamp = objectBox('stamp');
  addHit('open-stamp', stamp.x, stamp.y, stamp.width, stamp.height);

  const map = objectBox('map');
  if (state.overlaySolved) {
    ctx.save();
    ctx.globalAlpha = 0.88;
    strokeRounded(map.x, map.y, map.width, map.height, 18, '#d9b8ff', 3, [4, 8]);
    for (let i = 0; i < 7; i += 1) {
      const sx = map.x + map.width * (0.16 + seeded(i, 33) * 0.7);
      const sy = map.y + map.height * (0.16 + seeded(i + 9, 44) * 0.68);
      ctx.fillStyle = '#f2d8ff';
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  addHit('open-map', map.x, map.y, map.width, map.height);
  addDrop('map', map.x, map.y, map.width, map.height);

  const windowBox = objectBox('window');
  if (state.windowOpen) {
    ctx.save();
    ctx.shadowColor = '#d9c2ff';
    ctx.shadowBlur = 34;
    fillRounded(windowBox.x, windowBox.y, windowBox.width, windowBox.height, 18, '#171a38');
    const sky = ctx.createLinearGradient(0, windowBox.y, 0, windowBox.y + windowBox.height);
    sky.addColorStop(0, '#6d5c91');
    sky.addColorStop(1, '#172348');
    fillRounded(windowBox.x + 8, windowBox.y + 8, windowBox.width - 16, windowBox.height - 16, 12, sky);
    ctx.restore();
  }
  addHit('window', windowBox.x, windowBox.y, windowBox.width, windowBox.height);
  addDrop('window', windowBox.x, windowBox.y, windowBox.width, windowBox.height);

  drawRoomShimmers(time);
  drawSparks(time);
  ctx.restore();
}

function drawRoomShimmers(time) {
  if (state.phase !== PHASES.PLAY || focus) return;
  const targets = [];
  if (!state.logRead) targets.push(objectBox('log'));
  else if (!state.lampSolved) targets.push(objectBox('lamp'));
  else if (!state.letterCollected) targets.push(objectBox('letter'));
  else if (state.letterRevealed && !state.stampSolved) targets.push(objectBox('stamp'));
  targets.forEach((target, index) => {
    const alpha = 0.35 + Math.sin(time * 0.004 + index) * 0.18;
    strokeRounded(target.x - 7, target.y - 7, target.width + 14, target.height + 14, 18, `rgba(239,211,166,${alpha})`, 2, [3, 8]);
  });
}

function spawnSparks(x, y, color) {
  for (let i = 0; i < 24; i += 1) {
    sparks.push({
      x,
      y,
      vx: (seeded(i, x) - 0.5) * 3.5,
      vy: -1 - seeded(i + 2, y) * 3,
      life: 1,
      color: color || '#e8c8ff'
    });
  }
}

function drawSparks() {
  sparks.forEach((spark) => {
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vy += 0.035;
    spark.life -= 0.018;
    ctx.globalAlpha = Math.max(0, spark.life);
    ctx.fillStyle = spark.color;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, 2 + spark.life * 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  sparks = sparks.filter((spark) => spark.life > 0);
}

function inventoryItems() {
  const items = [];
  if (state.letterCollected && !state.delivered) items.push({ id: 'returned-letter', label: '无名退信' });
  if (state.letterRevealed && !state.keyCombined) items.push({ id: 'seal-half', label: '半枚星封蜡' });
  if (state.stampSolved && !state.overlaySolved) items.push({ id: 'star-overlay', label: '星图薄片' });
  if (state.overlaySolved && !state.keyCombined) items.push({ id: 'star-shard', label: '另一半封蜡' });
  if (state.keyCombined && !state.windowOpen) items.push({ id: 'star-key', label: '星形钥匙' });
  return items;
}

function drawItemIcon(id, x, y, size, lifted) {
  ctx.save();
  ctx.translate(x, y);
  if (lifted) {
    ctx.scale(1.1, 1.1);
    ctx.shadowColor = '#efd8ff';
    ctx.shadowBlur = 20;
  }
  if (id === 'returned-letter') drawEnvelope(-size * 0.45, -size * 0.3, size * 0.9, size * 0.6, state.letterFace, state.letterRevealed);
  else if (id === 'star-overlay') {
    ctx.rotate(state.overlayRotation * Math.PI / 2);
    fillRounded(-size * 0.38, -size * 0.38, size * 0.76, size * 0.76, 8, 'rgba(189,177,198,.82)');
    strokeRounded(-size * 0.38, -size * 0.38, size * 0.76, size * 0.76, 8, '#7f688b', 2, [3, 4]);
    for (let i = 0; i < 7; i += 1) {
      ctx.fillStyle = '#28233b';
      ctx.beginPath();
      ctx.arc((seeded(i, 8) - 0.5) * size * 0.55, (seeded(i + 7, 11) - 0.5) * size * 0.55, size * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'seal-half' || id === 'star-shard') {
    ctx.fillStyle = id === 'seal-half' ? '#a46c82' : '#c49079';
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.42);
    ctx.lineTo(size * 0.12, -size * 0.12);
    ctx.lineTo(size * 0.4, -size * 0.12);
    ctx.lineTo(size * 0.17, size * 0.08);
    ctx.lineTo(size * 0.26, size * 0.38);
    ctx.lineTo(0, size * 0.2);
    ctx.closePath();
    ctx.fill();
    if (id === 'seal-half') ctx.scale(-1, 1);
  } else if (id === 'star-key') {
    ctx.fillStyle = '#d2a57d';
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 ? size * 0.18 : size * 0.38;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    fillRounded(-size * 0.07, size * 0.25, size * 0.14, size * 0.43, 5, '#d2a57d');
  }
  ctx.restore();
}

function drawPanel() {
  const gradient = ctx.createLinearGradient(PANEL.x, PANEL.y, PANEL.x + PANEL.width, PANEL.y + PANEL.height);
  gradient.addColorStop(0, '#24253e');
  gradient.addColorStop(1, '#35283e');
  ctx.fillStyle = gradient;
  ctx.fillRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height);
  feltTexture(PANEL.x, PANEL.y, PANEL.width, PANEL.height, '#8e7894', 91, 110);

  if (PORTRAIT) drawPortraitPanel();
  else drawLandscapePanel();
}

function drawProgress(x, y, gap) {
  for (let i = 0; i < 7; i += 1) {
    ctx.fillStyle = i < state.getProgress() ? '#d8b07f' : '#5b5266';
    ctx.beginPath();
    ctx.arc(x + i * gap, y, i < state.getProgress() ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLandscapePanel() {
  text('梦 境 邮 局', PANEL.x + 26, 48, 25, '#f5e8d4', 'left', 800);
  text('第 01 夜 · 给还记得的人', PANEL.x + 26, 82, 13, '#c8a3b1', 'left', 700);
  drawProgress(PANEL.x + 30, 116, 34);
  strokeRounded(PANEL.x + 22, 146, PANEL.width - 44, 166, 18, 'rgba(205,168,146,.3)', 2, [4, 7]);
  text('夜班记录', PANEL.x + 40, 170, 13, '#d8af8c', 'left', 800);
  wrapText(state.message, PANEL.x + 40, 202, PANEL.width - 80, 24, 15, '#eadfd3', 'left', 5);
  fillRounded(PANEL.x + 32, 330, PANEL.width - 64, 48, 16, '#74586f');
  strokeRounded(PANEL.x + 32, 330, PANEL.width - 64, 48, 16, '#bb8f86', 2, [3, 6]);
  text('轻触提示', PANEL.x + PANEL.width / 2, 355, 16, '#f7e9d2', 'center', 700);
  addHit('hint', PANEL.x + 32, 330, PANEL.width - 64, 48);
  text('物 品', PANEL.x + 30, 420, 13, '#c9a3b2', 'left', 800);
  drawInventory(PANEL.x + 24, 442, PANEL.width - 48, 238, 2);
}

function drawPortraitPanel() {
  text('梦境邮局 · 第 01 夜', PANEL.x + 24, PANEL.y + 35, 20, '#f5e8d4', 'left', 800);
  drawProgress(PANEL.x + 438, PANEL.y + 35, 33);
  wrapText(state.message, PANEL.x + 24, PANEL.y + 74, 540, 25, 15, '#eadfd3', 'left', 3);
  fillRounded(PANEL.x + 575, PANEL.y + 62, 120, 52, 16, '#74586f');
  text('提示', PANEL.x + 635, PANEL.y + 89, 16, '#f7e9d2', 'center', 700);
  addHit('hint', PANEL.x + 575, PANEL.y + 62, 120, 52);
  text('拖动物品到房间，也可以轻触查看或旋转', PANEL.x + 24, PANEL.y + 160, 13, '#bdaab7', 'left');
  drawInventory(PANEL.x + 18, PANEL.y + 184, PANEL.width - 36, 174, 5);
}

function drawInventory(x, y, width, height, columns) {
  const items = inventoryItems();
  inventoryAreas = [];
  if (!items.length) {
    strokeRounded(x, y, width, height, 18, 'rgba(184,157,169,.28)', 2, [5, 8]);
    text('空', x + width / 2, y + height / 2, 15, '#746c7c', 'center', 700);
    return;
  }
  const gap = 10;
  const rows = Math.ceil(items.length / columns);
  const cardWidth = (width - gap * (columns - 1)) / columns;
  const cardHeight = (height - gap * (rows - 1)) / rows;
  items.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const card = { x: x + col * (cardWidth + gap), y: y + row * (cardHeight + gap), width: cardWidth, height: cardHeight };
    const dragging = drag && drag.itemId === item.id;
    feltPanel(card.x, card.y, card.width, card.height, 16, dragging ? '#4d4059' : '#393449', '#806c7f', 110 + index);
    if (!dragging) drawItemIcon(item.id, card.x + card.width / 2, card.y + card.height * 0.43, Math.min(66, card.height * 0.55), false);
    text(item.label, card.x + card.width / 2, card.y + card.height - 18, Math.min(13, cardWidth * 0.12), '#e6d7ca', 'center', 700);
    const area = Object.assign({ id: `item-${item.id}`, payload: item.id }, card);
    inventoryAreas.push(area);
    hitAreas.push(area);
  });
}

function drawIntro() {
  ctx.fillStyle = 'rgba(12,13,29,.68)';
  ctx.fillRect(SCENE.x, SCENE.y, SCENE.width, SCENE.height);
  const width = PORTRAIT ? 620 : 590;
  const height = PORTRAIT ? 460 : 430;
  const x = SCENE.x + (SCENE.width - width) / 2;
  const y = SCENE.y + (SCENE.height - height) / 2;
  feltPanel(x, y, width, height, 30, '#2f2b45', '#b48786', 44);
  text('梦 境 邮 局', x + width / 2, y + 86, PORTRAIT ? 45 : 48, '#f6ead6', 'center', 800);
  text('第 01 夜 · 给还记得的人', x + width / 2, y + 142, 18, '#d6a9b7', 'center', 700);
  drawStitches(x + 100, y + 190, width - 200, '#a98087', 25);
  wrapText('凌晨四点十七分，一封没有收件人的退信回到了柜台。房间记得它要去哪里。', x + width / 2, y + 235, width - 120, 30, 17, '#e5d9cf', 'center', 4);
  fillRounded(x + 90, y + height - 100, width - 180, 62, 20, '#946577');
  strokeRounded(x + 90, y + height - 100, width - 180, 62, 20, '#d5a47e', 2, [4, 7]);
  text('推开夜班室的门', x + width / 2, y + height - 68, 20, '#fff0d8', 'center', 800);
  addHit('start', x + 90, y + height - 100, width - 180, 62);
}

function drawModal(time) {
  if (!focus) return;
  ctx.fillStyle = 'rgba(10,10,24,.72)';
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  const modal = PORTRAIT
    ? { x: 44, y: 100, width: 632, height: 720 }
    : { x: 150, y: 70, width: 660, height: 580 };
  feltPanel(modal.x, modal.y, modal.width, modal.height, 30, '#302c44', '#a47d82', 66);
  fillRounded(modal.x + modal.width - 58, modal.y + 18, 40, 40, 14, '#574a60');
  text('×', modal.x + modal.width - 38, modal.y + 39, 25, '#ead8cd', 'center', 500);
  addHit('close-focus', modal.x + modal.width - 66, modal.y + 10, 56, 56);
  if (focus === 'log') drawLogFocus(modal);
  if (focus === 'lamp') drawLampFocus(modal, time);
  if (focus === 'letter') drawLetterFocus(modal);
  if (focus === 'stamp') drawStampFocus(modal);
  if (focus === 'map') drawMapFocus(modal);
}

function drawLogFocus(modal) {
  text('夜班记录', modal.x + 42, modal.y + 50, 22, '#f2dfca', 'left', 800);
  const page = { x: modal.x + 70, y: modal.y + 100, width: modal.width - 140, height: modal.height - 200 };
  feltPanel(page.x, page.y, page.width, page.height, 20, '#c9b69b', '#806b6c', 73);
  if (logFace === 'front') {
    text('04 : 17', page.x + 44, page.y + 50, 18, '#665967', 'left', 800);
    for (let i = 0; i < 8; i += 1) drawStitches(page.x + 45, page.y + 100 + i * 38, page.width - 90 - (i % 3) * 38, '#8a7573', 18);
    fillRounded(page.x + 70, page.y + page.height - 82, page.width - 140, 48, 15, '#8b6674');
    text('翻到背面', page.x + page.width / 2, page.y + page.height - 57, 16, '#faecd8', 'center', 800);
    addHit('flip-log', page.x + 70, page.y + page.height - 82, page.width - 140, 48);
  } else {
    text('留给下一位夜班员', page.x + page.width / 2, page.y + 54, 17, '#6b5966', 'center', 800);
    const labels = ['下', '右', '左'];
    for (let i = 0; i < 3; i += 1) {
      const cx = page.x + page.width * (0.25 + i * 0.25);
      const cy = page.y + page.height * 0.47;
      ctx.strokeStyle = '#786071';
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.arc(cx, cy, 44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#c9b69b';
      const offsets = [{ x: 0, y: 33 }, { x: 33, y: 0 }, { x: -33, y: 0 }][i];
      ctx.beginPath();
      ctx.arc(cx + offsets.x, cy + offsets.y, 19, 0, Math.PI * 2);
      ctx.fill();
      text(labels[i], cx, cy + 78, 15, '#6b5966', 'center', 800);
    }
    text('三层月环，从外到内', page.x + page.width / 2, page.y + page.height - 64, 14, '#75636a', 'center', 700);
  }
}

function drawLampFocus(modal, time) {
  text(state.lampSolved ? '月灯已经醒来' : '三环月灯', modal.x + 42, modal.y + 50, 22, '#f2dfca', 'left', 800);
  const cx = modal.x + modal.width / 2;
  const cy = modal.y + modal.height * 0.5;
  if (state.lampSolved) {
    const glow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 240);
    glow.addColorStop(0, 'rgba(222,196,255,.55)');
    glow.addColorStop(1, 'rgba(150,100,210,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 250, cy - 250, 500, 500);
  }
  const radii = [154, 112, 72];
  radii.forEach((radius, index) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.lampRings[index] * Math.PI / 2);
    ctx.strokeStyle = ['#9b7182', '#7d7b8c', '#b48b72'][index];
    ctx.lineWidth = index === 0 ? 34 : 30;
    ctx.shadowColor = state.lampSolved ? '#dfc9ff' : '#171528';
    ctx.shadowBlur = state.lampSolved ? 18 : 6;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0.18, Math.PI * 2 - 0.18);
    ctx.stroke();
    ctx.restore();
    addHit(`lamp-ring-${index}`, cx - radius - 24, cy - radius - 24, radius * 2 + 48, radius * 2 + 48, index, {
      shape: 'ring', cx, cy, inner: radius - 25, outer: radius + 25
    });
  });
  ctx.fillStyle = state.lampSolved ? '#eee0ff' : '#d5bd9a';
  ctx.beginPath();
  ctx.arc(cx, cy, 42 + Math.sin(time * 0.004) * 2, 0, Math.PI * 2);
  ctx.fill();
  text(state.lampSolved ? '紫色月光会显出隐藏的针脚' : '轻触每一层软环', cx, modal.y + modal.height - 52, 15, '#c6b2c5', 'center', 700);
}

function drawLetterFocus(modal) {
  text('无名退信', modal.x + 42, modal.y + 50, 22, '#f2dfca', 'left', 800);
  const width = Math.min(430, modal.width - 120);
  const height = width * 0.62;
  const x = modal.x + (modal.width - width) / 2;
  const y = modal.y + 140;
  drawEnvelope(x, y, width, height, state.letterFace, state.lampSolved);
  fillRounded(modal.x + 100, modal.y + modal.height - 104, modal.width - 200, 54, 17, '#806075');
  text(state.letterFace === 'front' ? '翻到背面' : '翻回正面', modal.x + modal.width / 2, modal.y + modal.height - 76, 17, '#faead5', 'center', 800);
  addHit('flip-letter', modal.x + 100, modal.y + modal.height - 104, modal.width - 200, 54);
  if (state.letterFace === 'back' && !state.letterRevealed) text('这些浅针脚需要另一种光', modal.x + modal.width / 2, y + height + 42, 14, '#baa9b6', 'center');
}

function drawStampFocus(modal) {
  text('日期邮戳机', modal.x + 42, modal.y + 50, 22, '#f2dfca', 'left', 800);
  const locked = !state.letterRevealed;
  const dialWidth = 112;
  const gap = 24;
  const total = dialWidth * 3 + gap * 2;
  const startX = modal.x + (modal.width - total) / 2;
  for (let i = 0; i < 3; i += 1) {
    const x = startX + i * (dialWidth + gap);
    const y = modal.y + 150;
    feltPanel(x, y, dialWidth, 170, 22, locked ? '#4c4857' : '#6b5261', '#b98f78', 82 + i);
    text(String(state.stampDials[i]), x + dialWidth / 2, y + 84, 54, locked ? '#817987' : '#f2d39f', 'center', 800);
    text('轻触', x + dialWidth / 2, y + 140, 12, '#b7a8b3', 'center');
    if (!locked && !state.stampSolved) addHit(`stamp-dial-${i}`, x, y, dialWidth, 170, i);
  }
  fillRounded(modal.x + 120, modal.y + 390, modal.width - 240, 72, 22, locked ? '#504b59' : '#996878');
  strokeRounded(modal.x + 120, modal.y + 390, modal.width - 240, 72, 22, '#c79a7d', 3, [4, 7]);
  text(state.stampSolved ? '已压出星图薄片' : locked ? '日期轮没有线索' : '压下手柄', modal.x + modal.width / 2, modal.y + 427, 18, '#f7e5ce', 'center', 800);
  if (!locked && !state.stampSolved) addHit('pull-stamp', modal.x + 120, modal.y + 390, modal.width - 240, 72);
}

function drawMapFocus(modal) {
  text('墙上的旧星图', modal.x + 42, modal.y + 50, 22, '#f2dfca', 'left', 800);
  const board = { x: modal.x + 80, y: modal.y + 110, width: modal.width - 160, height: modal.height - 200 };
  feltPanel(board.x, board.y, board.width, board.height, 24, '#3d4658', '#8c7884', 99);
  ctx.strokeStyle = state.overlaySolved ? '#d9b8ff' : '#8a7f92';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i += 1) {
    const sx = board.x + board.width * (0.08 + seeded(i, 5) * 0.84);
    const sy = board.y + board.height * (0.08 + seeded(i + 19, 7) * 0.84);
    ctx.beginPath();
    ctx.arc(sx, sy, i < 7 && state.overlaySolved ? 6 : 3, 0, Math.PI * 2);
    ctx.fillStyle = i < 7 && state.overlaySolved ? '#edd6ff' : '#a897a6';
    ctx.fill();
    if (i > 0) {
      const px = board.x + board.width * (0.08 + seeded(i - 1, 5) * 0.84);
      const py = board.y + board.height * (0.08 + seeded(i + 18, 7) * 0.84);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
  }
  text(state.overlaySolved ? '七颗星已经被同一片夜空选中' : '星点很多，却没有一条完整的路线', modal.x + modal.width / 2, modal.y + modal.height - 54, 14, '#c2b1bd', 'center', 700);
}

function drawEnding(time) {
  ctx.fillStyle = 'rgba(10,11,27,.7)';
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  const card = PORTRAIT
    ? { x: 55, y: 190, width: 610, height: 620 }
    : { x: 210, y: 100, width: 540, height: 520 };
  feltPanel(card.x, card.y, card.width, card.height, 32, '#302c45', '#b58c83', 141);
  text('今夜投递完成', card.x + card.width / 2, card.y + 92, 34, '#f6ead8', 'center', 800);
  text('04 : 17', card.x + card.width / 2, card.y + 145, 15, '#bd9aaa', 'center', 700);
  const cx = card.x + card.width / 2;
  const cy = card.y + 265 + Math.sin(time * 0.003) * 8;
  drawEnvelope(cx - 110, cy - 70, 220, 140, 'front', true);
  wrapText('收件人一栏慢慢浮现：\n给还记得的人。', cx, card.y + 385, card.width - 120, 31, 18, '#dfd2c9', 'center', 4);
  fillRounded(card.x + 100, card.y + card.height - 82, card.width - 200, 50, 16, '#7e5b72');
  text('重新值一次夜班', cx, card.y + card.height - 56, 16, '#f8e8d2', 'center', 800);
  addHit('restart', card.x + 100, card.y + card.height - 82, card.width - 200, 50);
}

function drawDraggedItem() {
  if (!drag) return;
  drawItemIcon(drag.itemId, drag.x, drag.y, 78, true);
}

function render(time) {
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  hitAreas = [];
  dropAreas = [];
  inventoryAreas = [];
  drawRoom(time);
  drawPanel();
  if (state.phase === PHASES.INTRO) drawIntro();
  if (state.phase === PHASES.PLAY) drawModal(time);
  if (state.phase === PHASES.ENDING) drawEnding(time);
  drawDraggedItem();
}

function handleStateChange() {
  const progress = state.getProgress();
  if (progress > lastProgress) {
    audio.success();
    platform.vibrate(true);
    const center = progress === 1 ? roomBox(0.5, 0.26, 0, 0) : roomBox(0.73, 0.45, 0, 0);
    spawnSparks(center.x, center.y, '#e4c8ff');
  }
  if (state.phase !== lastPhase && state.phase === PHASES.ENDING) {
    platform.saveProgress({ completed: true, completedAt: Date.now(), chapter: 'dream-post-office-01' });
  }
  lastProgress = progress;
  lastPhase = state.phase;
}

function loop(time) {
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
  else if (area.id === 'restart') {
    state.resetAll();
    focus = null;
    logFace = 'front';
    lastProgress = 0;
  } else if (area.id === 'hint') platform.showRewardedHint(() => state.getHint());
  else if (area.id === 'close-focus') focus = null;
  else if (area.id === 'open-log') focus = 'log';
  else if (area.id === 'flip-log') {
    logFace = 'back';
    state.readLog();
    audio.paper();
  } else if (area.id === 'open-lamp') focus = 'lamp';
  else if (area.id.indexOf('lamp-ring-') === 0) {
    state.rotateLamp(area.payload);
    audio.rotate();
  } else if (area.id === 'collect-letter') {
    state.collectLetter();
    focus = 'letter';
    audio.paper();
  } else if (area.id === 'flip-letter') {
    state.flipLetter();
    audio.paper();
  } else if (area.id === 'open-stamp') focus = 'stamp';
  else if (area.id.indexOf('stamp-dial-') === 0) {
    state.turnStampDial(area.payload);
    audio.rotate();
  } else if (area.id === 'pull-stamp') {
    if (state.pullStamp()) focus = null;
  } else if (area.id === 'open-map') focus = 'map';
  else if (area.id === 'window') {
    state.setMessage(state.windowOpen ? '投递窗外的风正在等待那封退信。' : '窗锁是星形的，边缘还留着柔软的封蜡纤维。', 5);
  }
  handleStateChange();
}

function tapInventory(itemId) {
  if (itemId === 'returned-letter') focus = 'letter';
  else if (itemId === 'star-overlay') {
    state.rotateOverlay();
    audio.rotate();
    state.setMessage('星图薄片转过了四分之一圈。', 2.5);
  } else if (itemId === 'seal-half' || itemId === 'star-shard') {
    state.setMessage('它的断面并不完整，也许另一半就在附近。', 3.5);
  } else if (itemId === 'star-key') state.setMessage('一枚柔软却不会弯曲的星形钥匙。', 3.5);
}

function handleDrop(point, itemId) {
  const target = hitTest(point, dropAreas);
  const otherItem = hitTest(point, inventoryAreas.filter((area) => area.payload !== itemId));
  if (otherItem && state.combineItems(itemId, otherItem.payload)) {
    audio.success();
    return;
  }
  if (!target) {
    state.setMessage('这件东西在这里没有回应。', 2.5);
    return;
  }
  if (itemId === 'returned-letter' && target.id === 'lamp') {
    if (state.exposeLetter()) focus = 'letter';
    return;
  }
  if (itemId === 'star-overlay' && target.id === 'map') {
    if (state.placeOverlay()) focus = 'map';
    return;
  }
  if (itemId === 'star-key' && target.id === 'window') {
    state.useKey();
    return;
  }
  if (itemId === 'returned-letter' && target.id === 'window') {
    state.deliverLetter();
    return;
  }
  state.setMessage('形状不合。它们并不属于彼此。', 3);
}

wx.onTouchStart((event) => {
  if (!event.touches || !event.touches.length) return;
  const point = touchPoint(event.touches[0]);
  pressedArea = hitTest(point);
  audio.ensureStarted();
  if (pressedArea && pressedArea.id.indexOf('item-') === 0 && !focus && state.phase === PHASES.PLAY) {
    drag = { itemId: pressedArea.payload, x: point.x, y: point.y, startX: point.x, startY: point.y, moved: false };
  }
});

wx.onTouchMove((event) => {
  if (!drag || !event.touches || !event.touches.length) return;
  const point = touchPoint(event.touches[0]);
  drag.x = clamp(point.x, 35, DESIGN_WIDTH - 35);
  drag.y = clamp(point.y, 35, DESIGN_HEIGHT - 35);
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
    pressedArea = null;
    return;
  }
  const released = hitTest(point);
  if (pressedArea && released && pressedArea.id === released.id) performAction(released);
  pressedArea = null;
});

requestAnimationFrame(loop);
