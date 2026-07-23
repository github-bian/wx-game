const { DreamAudio } = require('./audio');
const { GameState, STAGES } = require('./game-state');
const platform = require('./platform');

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const system = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
const pixelRatio = system.pixelRatio || 1;
const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;
const SCENE_WIDTH = 1000;
const SIDEBAR_X = 1000;

canvas.width = system.windowWidth * pixelRatio;
canvas.height = system.windowHeight * pixelRatio;

const state = new GameState();
const audio = new DreamAudio();
let hitAreas = [];
let slotAreas = [];
let lastStage = state.stage;
let drag = null;
let hallReady = false;

const hallImage = wx.createImage ? wx.createImage() : null;
if (hallImage) {
  hallImage.onload = () => { hallReady = true; };
  hallImage.onerror = () => { hallReady = false; };
  hallImage.src = 'assets/dream-post-office-hall.webp';
}

const PARCEL_STARTS = [
  { x: 130, y: 515 },
  { x: 405, y: 515 },
  { x: 680, y: 515 }
];

const SLOT_LAYOUTS = [
  { x: 92, y: 175, width: 210, height: 230 },
  { x: 370, y: 175, width: 210, height: 230 },
  { x: 648, y: 175, width: 210, height: 230 }
];

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

function strokeRounded(x, y, width, height, radius, color, lineWidth) {
  roundedRect(x, y, width, height, radius);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function text(value, x, y, size, color, align, weight) {
  ctx.fillStyle = color || '#fff1d5';
  ctx.font = `${weight || 400} ${size}px sans-serif`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

function wrapText(value, x, y, maxWidth, lineHeight, size, color, align, maxLines) {
  const chars = String(value).split('');
  const lines = [];
  let line = '';
  ctx.font = `400 ${size}px sans-serif`;
  chars.forEach((char) => {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  lines.slice(0, maxLines || 5).forEach((item, index) => text(item, x, y + index * lineHeight, size, color, align));
}

function addHit(id, x, y, width, height, payload) {
  hitAreas.push({ id, x, y, width, height, payload });
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

function drawFallbackBackdrop() {
  const gradient = ctx.createLinearGradient(0, 0, 0, DESIGN_HEIGHT);
  gradient.addColorStop(0, '#17234b');
  gradient.addColorStop(0.55, '#233a56');
  gradient.addColorStop(1, '#6f4b61');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SCENE_WIDTH, DESIGN_HEIGHT);
  ctx.fillStyle = '#2b3658';
  ctx.fillRect(60, 80, 160, 540);
  ctx.fillRect(780, 80, 160, 540);
  ctx.fillStyle = '#b87978';
  ctx.beginPath();
  ctx.arc(500, 240, 125, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#18264a';
  ctx.beginPath();
  ctx.arc(548, 205, 125, 0, Math.PI * 2);
  ctx.fill();
}

function drawBackdrop(time) {
  if (hallReady) drawCoverImage(hallImage, 0, 0, SCENE_WIDTH, DESIGN_HEIGHT);
  else drawFallbackBackdrop();
  const shade = ctx.createLinearGradient(0, 0, SCENE_WIDTH, 0);
  shade.addColorStop(0, 'rgba(14,20,45,0.25)');
  shade.addColorStop(0.52, 'rgba(14,20,45,0.08)');
  shade.addColorStop(1, 'rgba(14,20,45,0.48)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, SCENE_WIDTH, DESIGN_HEIGHT);
  ctx.save();
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 80; i += 1) {
    const x = (i * 79 + time * 0.008) % SCENE_WIDTH;
    const y = (i * 149 + Math.sin(i * 4.2) * 60) % DESIGN_HEIGHT;
    ctx.fillStyle = i % 2 ? '#ffe2a8' : '#8ec1c1';
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.restore();
}

function drawSidebar() {
  const panel = ctx.createLinearGradient(SIDEBAR_X, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  panel.addColorStop(0, '#171c3e');
  panel.addColorStop(1, '#302243');
  ctx.fillStyle = panel;
  ctx.fillRect(SIDEBAR_X, 0, DESIGN_WIDTH - SIDEBAR_X, DESIGN_HEIGHT);
  ctx.fillStyle = '#d69a7e';
  ctx.fillRect(SIDEBAR_X, 0, 3, DESIGN_HEIGHT);

  text('梦 境 邮 局', 1030, 52, 26, '#fff0cf', 'left', 800);
  text('DREAM POST OFFICE', 1030, 84, 12, '#c59daf', 'left', 600);

  const stageInfo = {
    [STAGES.INTRO]: ['第零夜', '无人签收的梦'],
    [STAGES.SORT]: ['第一幕', '失去地址的信'],
    [STAGES.STAMP]: ['第二幕', '错位的月相邮戳'],
    [STAGES.ROUTE]: ['第三幕', '云层投递台'],
    [STAGES.ENDING]: ['投递完成', '所有梦都有去处']
  }[state.stage];
  text(stageInfo[0], 1030, 135, 14, '#dca28d', 'left', 700);
  wrapText(stageInfo[1], 1030, 167, 220, 27, 21, '#f6e6ce', 'left', 2);

  const progressStages = [STAGES.SORT, STAGES.STAMP, STAGES.ROUTE];
  const currentIndex = progressStages.indexOf(state.stage);
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = state.stage === STAGES.ENDING || (currentIndex >= 0 && i <= currentIndex) ? '#e9b477' : '#545472';
    ctx.beginPath();
    ctx.arc(1040 + i * 34, 225, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  if (![STAGES.INTRO, STAGES.ENDING].includes(state.stage)) {
    fillRounded(1028, 266, 224, 48, 14, '#865b78');
    text('打开梦中提示', 1140, 291, 17, '#fff1d6', 'center', 700);
    addHit('hint', 1028, 266, 224, 48);
  }

  ctx.strokeStyle = 'rgba(224,176,125,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(1030, 340);
  ctx.lineTo(1250, 340);
  ctx.stroke();

  text('夜班投递簿', 1030, 374, 14, '#dba28c', 'left', 700);
  wrapText(state.message, 1030, 408, 220, 25, 16, '#eee0d0', 'left', 7);

  if (state.hint) {
    fillRounded(1025, 545, 230, 138, 16, 'rgba(108,86,116,0.8)');
    text('提示', 1044, 570, 14, '#ffd59b', 'left', 800);
    wrapText(state.hint, 1044, 598, 193, 22, 14, '#fff0d7', 'left', 4);
  } else {
    text('移动、旋转并观察。', 1030, 616, 14, '#988ea7', 'left');
    text('答案藏在物体关系里。', 1030, 642, 14, '#988ea7', 'left');
  }
}

function drawSymbol(kind, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(3, size * 0.08);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 0) {
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, size * 0.38);
    ctx.quadraticCurveTo(size * 0.42, -size * 0.18, size * 0.18, -size * 0.46);
    ctx.quadraticCurveTo(-size * 0.1, -size * 0.23, -size * 0.3, size * 0.38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 0.18, size * 0.22);
    ctx.lineTo(size * 0.2, -size * 0.2);
    ctx.stroke();
  } else if (kind === 1) {
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.46);
    ctx.bezierCurveTo(size * 0.36, -size * 0.05, size * 0.34, size * 0.42, 0, size * 0.46);
    ctx.bezierCurveTo(-size * 0.34, size * 0.42, -size * 0.36, -size * 0.05, 0, -size * 0.46);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.28);
    ctx.lineTo(0, size * 0.04);
    ctx.lineTo(size * 0.2, size * 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnvelope(x, y, width, height, index, lifted) {
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  if (lifted) {
    ctx.scale(1.05, 1.05);
    ctx.shadowColor = '#ffe0a2';
    ctx.shadowBlur = 20;
  }
  fillRounded(-width / 2, -height / 2, width, height, 12, ['#ead5b1', '#cbdad2', '#e7c7cf'][index]);
  strokeRounded(-width / 2, -height / 2, width, height, 12, ['#ab6978', '#4f8385', '#8568a0'][index], 4);
  ctx.strokeStyle = 'rgba(105,72,86,0.65)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-width / 2 + 7, -height / 2 + 6);
  ctx.lineTo(0, 9);
  ctx.lineTo(width / 2 - 7, -height / 2 + 6);
  ctx.stroke();
  ctx.fillStyle = ['#b96879', '#4e8d91', '#896ca4'][index];
  ctx.beginPath();
  ctx.arc(0, 18, 23, 0, Math.PI * 2);
  ctx.fill();
  drawSymbol(index, 0, 18, 27, '#fff0d5');
  ctx.restore();
}

function drawIntro() {
  fillRounded(210, 126, 580, 442, 28, 'rgba(22,27,60,0.91)');
  strokeRounded(210, 126, 580, 442, 28, '#e1ad77', 4);
  text('梦 境 邮 局', 500, 218, 56, '#fff0cf', 'center', 800);
  text('第零夜 · 无人签收的梦', 500, 278, 22, '#d8a6b7', 'center', 600);
  ctx.strokeStyle = '#d2a06f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(320, 330);
  ctx.lineTo(680, 330);
  ctx.stroke();
  text('每到午夜，没人记得的梦会沿云层漂到这里。', 500, 382, 19, '#eadccc', 'center');
  fillRounded(315, 444, 370, 72, 20, '#b66f79');
  strokeRounded(315, 444, 370, 72, 20, '#f1c186', 3);
  text('开始今晚的分拣', 500, 481, 24, '#fff4dc', 'center', 800);
  addHit('start', 315, 444, 370, 72);
}

function drawSlot(slot, index, occupied) {
  const clueKinds = [1, 2, 0];
  fillRounded(slot.x, slot.y, slot.width, slot.height, 18, occupied ? 'rgba(242,213,166,0.46)' : 'rgba(21,29,62,0.83)');
  strokeRounded(slot.x, slot.y, slot.width, slot.height, 18, occupied ? '#ffd28f' : ['#4e888c', '#a36b80', '#776c9c'][index], occupied ? 5 : 4);
  drawSymbol(clueKinds[index], slot.x + slot.width / 2, slot.y + 62, 52, '#f2c58a');
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = 'rgba(240,203,153,0.2)';
    ctx.fillRect(slot.x + 22, slot.y + 112 + i * 30, slot.width - 44, 2);
  }
  text(['潮汐信格', '刻度信格', '风口信格'][index], slot.x + slot.width / 2, slot.y + 207, 17, '#ead9ca', 'center', 700);
  slotAreas.push({ id: `slot-${index}`, ...slot, payload: index });
}

function parcelPosition(index) {
  if (drag && drag.index === index) return { x: drag.x, y: drag.y };
  const slotIndex = state.parcels[index];
  if (slotIndex >= 0) {
    const slot = SLOT_LAYOUTS[slotIndex];
    return { x: slot.x + 20, y: slot.y + 92 };
  }
  return PARCEL_STARTS[index];
}

function drawSortScene(time) {
  fillRounded(250, 42, 500, 56, 16, 'rgba(21,27,60,0.82)');
  text('把三封梦件拖入会回应它的信格', 500, 70, 21, '#fff0d5', 'center', 700);
  SLOT_LAYOUTS.forEach((slot, index) => drawSlot(slot, index, state.parcels.some((value) => value === index)));
  for (let i = 0; i < 3; i += 1) {
    const position = parcelPosition(i);
    const placed = state.parcels[i] >= 0;
    const lifted = drag && drag.index === i;
    ctx.save();
    if (!placed && !lifted) {
      ctx.translate(position.x + 85, position.y + 55);
      ctx.rotate(Math.sin(time * 0.002 + i) * 0.025);
      ctx.translate(-(position.x + 85), -(position.y + 55));
    }
    drawEnvelope(position.x, position.y, 170, 110, i, lifted);
    ctx.restore();
    if (!placed) addHit(`parcel-${i}`, position.x, position.y, 170, 110, i);
  }
}

function drawStampDisc(x, y, index, rotation, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation * Math.PI / 2);
  ctx.scale(1 + Math.sin(time * 0.004 + index) * 0.006, 1 + Math.sin(time * 0.004 + index) * 0.006);
  ctx.fillStyle = 'rgba(29,39,78,0.94)';
  ctx.beginPath();
  ctx.arc(0, 0, 105, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d8a66d';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = '#a97083';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 76, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i += 1) {
    const angle = i * Math.PI / 4;
    ctx.fillStyle = i % 2 ? '#6da19f' : '#d28f82';
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 87, Math.sin(angle) * 87, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#ffe1a1';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(-87, 0);
  ctx.bezierCurveTo(-35, index === 1 ? -40 : 38, 32, index === 2 ? -35 : 32, 87, 0);
  ctx.stroke();
  drawSymbol(index, 0, 0, 52, '#f2ca8e');
  ctx.restore();
  addHit(`stamp-${index}`, x - 120, y - 120, 240, 240, index);
}

function drawStampScene(time) {
  fillRounded(250, 42, 500, 56, 16, 'rgba(21,27,60,0.82)');
  text('点击印盘旋转，让三段金色邮路连续', 500, 70, 21, '#fff0d5', 'center', 700);
  ctx.strokeStyle = 'rgba(255,219,154,0.26)';
  ctx.lineWidth = 35;
  ctx.beginPath();
  ctx.moveTo(90, 350);
  ctx.lineTo(910, 350);
  ctx.stroke();
  [225, 500, 775].forEach((x, index) => drawStampDisc(x, 350, index, state.stamps[index], time));
  text('每一次旋转，都会改变梦醒来的方向', 500, 535, 18, '#d5c2cb', 'center');
}

function drawRouteIcon(value, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#ffe2ad';
  ctx.fillStyle = '#ffe2ad';
  ctx.lineWidth = 5;
  if (value === 0) {
    ctx.beginPath();
    ctx.arc(0, 5, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d99086';
    ctx.fillRect(-size * 0.4, 18, size * 0.8, 8);
    ctx.fillRect(-size * 0.3, 35, size * 0.6, 7);
  } else if (value === 1) {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.34, Math.PI, Math.PI * 2);
    ctx.stroke();
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 13, -5);
      ctx.lineTo(i * 18, -30);
      ctx.stroke();
    }
  } else {
    fillRounded(-size * 0.4, -size * 0.2, size * 0.8, size * 0.5, 12, '#efd0a5');
    ctx.fillStyle = '#966b86';
    ctx.beginPath();
    ctx.arc(0, -size * 0.2, size * 0.2, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#fff0b9';
    ctx.beginPath();
    ctx.arc(0, 5, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRouteCard(x, y, index, value) {
  const labels = ['枕边', '深海', '清晨'];
  fillRounded(x, y, 235, 320, 24, 'rgba(25,33,72,0.92)');
  strokeRounded(x, y, 235, 320, 24, '#c38c79', 4);
  text(`梦件 ${index + 1}`, x + 117, y + 42, 18, '#d7a8b7', 'center', 700);
  drawRouteIcon(value, x + 117, y + 145, 98);
  text(labels[value], x + 117, y + 235, 28, '#fff0cf', 'center', 800);
  text('点击切换航线', x + 117, y + 286, 15, '#aeb5ca', 'center');
  addHit(`route-${index}`, x, y, 235, 320, index);
}

function drawRouteScene(time) {
  fillRounded(250, 42, 500, 56, 16, 'rgba(21,27,60,0.82)');
  text('选择航线，再拉下投递杆', 500, 70, 21, '#fff0d5', 'center', 700);
  [90, 382, 674].forEach((x, index) => drawRouteCard(x, 155, index, state.routes[index]));
  const pulse = (Math.sin(time * 0.006) + 1) / 2;
  ctx.save();
  ctx.shadowColor = '#ffd58e';
  ctx.shadowBlur = 8 + pulse * 18;
  fillRounded(315, 545, 370, 72, 20, '#b56c77');
  strokeRounded(315, 545, 370, 72, 20, '#f0bd82', 3);
  ctx.restore();
  text('拉下投递杆', 500, 582, 24, '#fff2d7', 'center', 800);
  addHit('dispatch', 315, 545, 370, 72);
}

function drawEnding(time) {
  fillRounded(210, 126, 580, 442, 28, 'rgba(22,27,60,0.91)');
  strokeRounded(210, 126, 580, 442, 28, '#e1ad77', 4);
  text('今夜投递完成', 500, 215, 43, '#fff0cf', 'center', 800);
  text('三封梦都找到了醒来以前的去处', 500, 268, 20, '#d7acba', 'center');
  for (let i = 0; i < 3; i += 1) {
    const x = 310 + i * 190;
    const y = 355 + Math.sin(time * 0.003 + i) * 10;
    drawEnvelope(x, y, 145, 92, i, false);
  }
  text('下一夜：退回寄件人的月亮', 500, 475, 18, '#e0a28d', 'center', 700);
  fillRounded(330, 505, 340, 54, 16, '#845775');
  text('重新值一次夜班', 500, 533, 19, '#fff0d5', 'center', 700);
  addHit('restart', 330, 505, 340, 54);
}

function render(time) {
  const scaleX = canvas.width / DESIGN_WIDTH;
  const scaleY = canvas.height / DESIGN_HEIGHT;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  ctx.clearRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  hitAreas = [];
  slotAreas = [];
  drawBackdrop(time);
  if (state.stage === STAGES.INTRO) drawIntro(time);
  if (state.stage === STAGES.SORT) drawSortScene(time);
  if (state.stage === STAGES.STAMP) drawStampScene(time);
  if (state.stage === STAGES.ROUTE) drawRouteScene(time);
  if (state.stage === STAGES.ENDING) drawEnding(time);
  drawSidebar();
}

function handleStageChange() {
  if (state.stage === lastStage) return;
  audio.success();
  platform.vibrate(true);
  if (state.stage === STAGES.ENDING) {
    platform.saveProgress({ completed: true, completedAt: Date.now(), chapter: 'dream-post-office-00' });
  }
  drag = null;
  lastStage = state.stage;
}

function loop(time) {
  handleStageChange();
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

function contains(area, point) {
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

function performAction(area) {
  if (!area) return;
  audio.ensureStarted();
  audio.click();
  if (area.id === 'start') state.begin();
  else if (area.id === 'hint') platform.showRewardedHint(() => state.showHint());
  else if (area.id.indexOf('stamp-') === 0) {
    audio.rotate();
    state.rotateStamp(area.payload);
  } else if (area.id.indexOf('route-') === 0) {
    audio.paper();
    state.cycleRoute(area.payload);
  } else if (area.id === 'dispatch') state.dispatch();
  else if (area.id === 'restart') state.resetAll();
  handleStageChange();
}

wx.onTouchStart((event) => {
  if (!event.touches || !event.touches.length) return;
  const point = touchPoint(event.touches[0]);
  const area = hitTest(point);
  audio.ensureStarted();
  if (state.stage === STAGES.SORT && area && area.id.indexOf('parcel-') === 0) {
    const start = parcelPosition(area.payload);
    drag = {
      index: area.payload,
      offsetX: point.x - start.x,
      offsetY: point.y - start.y,
      x: start.x,
      y: start.y
    };
    audio.paper();
  }
});

wx.onTouchMove((event) => {
  if (!drag || !event.touches || !event.touches.length) return;
  const point = touchPoint(event.touches[0]);
  drag.x = clamp(point.x - drag.offsetX, 15, SCENE_WIDTH - 185);
  drag.y = clamp(point.y - drag.offsetY, 105, DESIGN_HEIGHT - 125);
});

wx.onTouchEnd((event) => {
  const touch = event.changedTouches && event.changedTouches.length ? event.changedTouches[0] : null;
  if (!touch) return;
  const point = touchPoint(touch);
  if (drag) {
    const parcelIndex = drag.index;
    const slot = hitTest(point, slotAreas);
    drag = null;
    if (slot) {
      const result = state.placeParcel(parcelIndex, slot.payload);
      if (result.accepted) audio.success(); else audio.paper();
      handleStageChange();
    }
    return;
  }
  performAction(hitTest(point));
});

requestAnimationFrame(loop);
