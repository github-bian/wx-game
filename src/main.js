const { GameState, STAGES } = require('./game-state');
const { HorrorAudio } = require('./audio');
const platform = require('./platform');

const DESIGN_WIDTH = 750;
const DESIGN_HEIGHT = 1334;
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const system = wx.getWindowInfo();
const pixelRatio = system.pixelRatio || 1;
canvas.width = system.windowWidth * pixelRatio;
canvas.height = system.windowHeight * pixelRatio;

const state = new GameState();
const audio = new HorrorAudio();
let hitAreas = [];
let lastStage = state.stage;
let flash = 0;
let shake = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
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
  ctx.fillStyle = color || '#f4e8ce';
  ctx.font = `${weight || 400} ${size}px sans-serif`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

function wrapText(value, x, y, maxWidth, lineHeight, size, color, align) {
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
  lines.slice(0, 4).forEach((row, index) => text(row, x, y + index * lineHeight, size, color, align));
  return Math.min(lines.length, 4);
}

function addHit(id, x, y, width, height, payload) {
  hitAreas.push({ id, x, y, width, height, payload });
}

function drawNoise(time) {
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.fillStyle = '#dcefdc';
  for (let i = 0; i < 70; i += 1) {
    const x = (i * 97 + time * 0.03) % DESIGN_WIDTH;
    const y = (i * 173 + Math.sin(i * 9.1) * 80 + time * 0.015) % DESIGN_HEIGHT;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
}

function drawVignette(danger) {
  const gradient = ctx.createRadialGradient(375, 600, 180, 375, 650, 720);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.66, 'rgba(0,0,0,0.2)');
  gradient.addColorStop(1, `rgba(${Math.round(35 + danger * 45)},0,0,${0.7 + danger * 0.2})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
}

function drawRoomBase(time, variant) {
  const flicker = 0.92 + Math.sin(time * 0.007) * 0.04 + Math.sin(time * 0.021) * 0.02;
  const background = ctx.createLinearGradient(0, 0, 0, DESIGN_HEIGHT);
  background.addColorStop(0, variant === 'corridor' ? '#071418' : '#0a1718');
  background.addColorStop(0.58, variant === 'bells' ? '#14201d' : '#171b18');
  background.addColorStop(1, '#050606');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

  ctx.fillStyle = '#17201d';
  ctx.fillRect(35, 120, 42, 990);
  ctx.fillRect(673, 120, 42, 990);
  ctx.fillStyle = '#273028';
  ctx.fillRect(20, 110, 710, 32);
  ctx.fillRect(20, 1075, 710, 28);

  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = '#9ab9a2';
  ctx.lineWidth = 2;
  for (let y = 170; y < 1040; y += 78) {
    ctx.beginPath();
    ctx.moveTo(75, y);
    ctx.lineTo(675, y + Math.sin(y) * 8);
    ctx.stroke();
  }
  ctx.restore();

  const moon = ctx.createRadialGradient(120, 230, 10, 120, 230, 260);
  moon.addColorStop(0, `rgba(117,188,184,${0.18 * flicker})`);
  moon.addColorStop(1, 'rgba(20,70,75,0)');
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, 420, 580);

  for (let i = 0; i < 5; i += 1) {
    const x = 95 + i * 142;
    ctx.fillStyle = 'rgba(114,22,18,0.45)';
    ctx.fillRect(x, 145, 4, 95 + (i % 2) * 45);
  }
}

function drawLantern(x, y, time, dim) {
  const flicker = 0.75 + Math.sin(time * 0.012 + x) * 0.18;
  const glow = ctx.createRadialGradient(x, y, 2, x, y, dim || 105);
  glow.addColorStop(0, `rgba(255,192,93,${0.35 * flicker})`);
  glow.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 130, y - 130, 260, 260);
  ctx.fillStyle = '#5e1712';
  fillRounded(x - 25, y - 42, 50, 72, 12, '#6f2018');
  ctx.strokeStyle = '#b9844f';
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 18, y - 32, 36, 50);
  ctx.fillStyle = `rgba(255,208,118,${0.75 * flicker})`;
  ctx.fillRect(x - 12, y - 25, 24, 38);
}

function drawDangerFigure(time, danger) {
  if (danger < 0.46) return;
  const progress = (danger - 0.46) / 0.54;
  const x = 742 - progress * 125 + Math.sin(time * 0.004) * 4;
  const y = 655;
  ctx.save();
  ctx.globalAlpha = clamp(progress * 0.82, 0, 0.78);
  ctx.fillStyle = '#020303';
  ctx.beginPath();
  ctx.ellipse(x, y - 170, 42, 55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 38, y - 125, 76, 270);
  ctx.fillStyle = '#a80d0d';
  ctx.fillRect(x - 24, y - 178, 12, 5);
  ctx.fillRect(x + 12, y - 178, 12, 5);
  ctx.restore();
}

function drawHeader(titleValue, chapter) {
  fillRounded(34, 35, 682, 92, 18, 'rgba(4,7,7,0.72)');
  strokeRounded(34, 35, 682, 92, 18, 'rgba(152,104,63,0.5)', 2);
  text(chapter, 62, 65, 22, '#9f8d73', 'left');
  text(titleValue, 62, 99, 31, '#f0dfbd', 'left', 600);
  if (state.stage !== STAGES.INTRO && state.stage !== STAGES.ENDING && state.stage !== STAGES.FAILED) {
    const remaining = Math.ceil(state.remainingSeconds());
    text(`${remaining}s`, 530, 81, 30, remaining < 20 ? '#ff655c' : '#d8c7a4', 'right', 600);
    fillRounded(552, 54, 132, 54, 14, 'rgba(93,28,21,0.65)');
    text('求助', 618, 82, 24, '#f0d7a5', 'center', 600);
    addHit('hint', 552, 54, 132, 54);
  }
}

function drawMessagePanel() {
  if (!state.message || (state.messageUntil !== Infinity && Date.now() > state.messageUntil)) return;
  fillRounded(38, 1122, 674, 166, 22, 'rgba(3,6,6,0.9)');
  strokeRounded(38, 1122, 674, 166, 22, 'rgba(148,94,55,0.68)', 2);
  text('磁带记录', 66, 1153, 19, '#aa8362', 'left', 600);
  wrapText(state.message, 66, 1194, 618, 31, 24, '#efe1c6', 'left');
}

function drawHint() {
  if (!state.hint) return;
  fillRounded(65, 960, 620, 132, 18, 'rgba(91,61,22,0.92)');
  text('提示', 95, 993, 21, '#ffd27c', 'left', 600);
  wrapText(state.hint, 95, 1031, 560, 29, 22, '#fff0cf', 'left');
}

function drawIntro(time) {
  drawRoomBase(time, 'hall');
  drawLantern(140, 300, time, 170);
  drawLantern(610, 300, time + 400, 170);
  ctx.fillStyle = '#221817';
  ctx.fillRect(150, 560, 450, 270);
  ctx.fillStyle = '#49221b';
  ctx.fillRect(175, 590, 400, 45);
  ctx.strokeStyle = '#7d5b3f';
  ctx.lineWidth = 3;
  ctx.strokeRect(205, 660, 340, 130);

  const shadow = ctx.createLinearGradient(0, 260, 0, 980);
  shadow.addColorStop(0, 'rgba(0,0,0,0.08)');
  shadow.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 250, DESIGN_WIDTH, 820);

  text('镇 夜 局', 375, 350, 74, '#d8c09a', 'center', 700);
  text('纸 门', 375, 433, 39, '#a5362d', 'center', 600);
  text('姐姐失踪后的第七夜', 375, 507, 24, '#9f9a8a', 'center');
  fillRounded(155, 890, 440, 88, 20, 'rgba(113,33,25,0.92)');
  strokeRounded(155, 890, 440, 88, 20, '#c47b51', 2);
  text('播放最后一盘磁带', 375, 935, 29, '#ffe8bf', 'center', 600);
  addHit('start', 155, 890, 440, 88);
  text('建议开启声音 · 佩戴耳机', 375, 1032, 19, '#777f77', 'center');
}

function drawSealPiece(x, y, index, rotation, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation * Math.PI / 2);
  const glow = state.seal.every((value, i) => value === [1, 3, 2, 0][i]);
  if (glow) {
    ctx.shadowColor = '#ffbc68';
    ctx.shadowBlur = 24;
  }
  fillRounded(-83, -83, 166, 166, 12, '#d1ad68');
  strokeRounded(-83, -83, 166, 166, 12, '#6f261d', 7);
  ctx.strokeStyle = '#7a211e';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-50, -15);
  ctx.lineTo(5, -15);
  ctx.lineTo(5, -58);
  ctx.lineTo(48, -58);
  ctx.moveTo(-45, 28);
  ctx.lineTo(42, 28);
  ctx.moveTo(-5, -12);
  ctx.lineTo(-5, 65);
  ctx.stroke();
  ctx.fillStyle = '#201613';
  ctx.beginPath();
  ctx.arc(0, -77, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  addHit(`seal-${index}`, x - 92, y - 92, 184, 184, index);
}

function drawSealScene(time) {
  drawRoomBase(time, 'hall');
  drawLantern(115, 330, time, 135);
  drawLantern(635, 330, time + 190, 135);
  ctx.fillStyle = '#231915';
  ctx.fillRect(78, 820, 594, 230);
  ctx.fillStyle = '#4b2b20';
  ctx.fillRect(55, 810, 640, 38);
  ctx.fillStyle = '#120e0c';
  ctx.fillRect(84, 848, 18, 250);
  ctx.fillRect(648, 848, 18, 250);
  drawSealPiece(270, 650, 0, state.seal[0], time);
  drawSealPiece(480, 650, 1, state.seal[1], time);
  drawSealPiece(270, 870, 2, state.seal[2], time);
  drawSealPiece(480, 870, 3, state.seal[3], time);
  drawDangerFigure(time, state.danger);
  drawHeader('残符归位', '第一幕 · 封门祖堂');
}

function drawBell(x, y, index, time) {
  const pulse = state.bellInput.length && state.bellInput[state.bellInput.length - 1] === index
    ? 1 + Math.sin(time * 0.03) * 0.05
    : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#54402e';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, -190);
  ctx.lineTo(0, -110);
  ctx.stroke();
  const gradient = ctx.createLinearGradient(-75, -100, 80, 90);
  gradient.addColorStop(0, '#4b3924');
  gradient.addColorStop(0.45, '#b08343');
  gradient.addColorStop(1, '#3e2c1d');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-30, -105);
  ctx.quadraticCurveTo(-75, -45, -86, 65);
  ctx.quadraticCurveTo(0, 108, 86, 65);
  ctx.quadraticCurveTo(75, -45, 30, -105);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#c19958';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#271a10';
  ctx.beginPath();
  ctx.arc(0, 77, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  addHit(`bell-${index}`, x - 100, y - 120, 200, 240, index);
}

function drawBellScene(time) {
  drawRoomBase(time, 'bells');
  ctx.fillStyle = '#111918';
  ctx.fillRect(100, 295, 550, 620);
  ctx.strokeStyle = '#3a4a42';
  ctx.lineWidth = 8;
  ctx.strokeRect(100, 295, 550, 620);
  drawBell(170, 620, 0, time);
  drawBell(375, 590, 1, time);
  drawBell(580, 620, 2, time);
  text('短', 170, 795, 24, '#968870', 'center');
  text('中', 375, 795, 24, '#968870', 'center');
  text('长', 580, 795, 24, '#968870', 'center');
  for (let i = 0; i < 4; i += 1) {
    ctx.fillStyle = i < state.bellInput.length ? '#c98d46' : '#2d3834';
    ctx.beginPath();
    ctx.arc(312 + i * 42, 920, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  drawDangerFigure(time, state.danger);
  drawHeader('三铃镇尸', '第二幕 · 暗室铃音');
}

function drawDoor(x, y, index, revealed) {
  const selected = revealed && index === 1;
  ctx.save();
  if (selected) {
    ctx.shadowColor = '#e1b46f';
    ctx.shadowBlur = 35;
  }
  ctx.fillStyle = '#2a1c17';
  ctx.fillRect(x, y, 166, 430);
  ctx.fillStyle = selected ? '#d7c394' : '#a99b79';
  ctx.fillRect(x + 16, y + 18, 134, 388);
  ctx.strokeStyle = '#5f3025';
  ctx.lineWidth = 6;
  ctx.strokeRect(x + 16, y + 18, 134, 388);
  ctx.beginPath();
  ctx.moveTo(x + 83, y + 18);
  ctx.lineTo(x + 83, y + 406);
  ctx.stroke();
  ctx.strokeStyle = selected ? '#8b1d1c' : '#514a3d';
  ctx.lineWidth = 5;
  ctx.beginPath();
  if (index === 0) {
    ctx.arc(x + 83, y + 190, 36, 0, Math.PI * 2);
  } else if (index === 1) {
    ctx.moveTo(x + 83, y + 145);
    ctx.lineTo(x + 120, y + 218);
    ctx.lineTo(x + 46, y + 218);
    ctx.closePath();
  } else {
    ctx.rect(x + 49, y + 160, 68, 68);
  }
  ctx.stroke();
  if (selected) {
    ctx.fillStyle = '#7e1d1b';
    ctx.beginPath();
    ctx.arc(x + 83, y + 290, 19, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  addHit(`door-${index}`, x, y, 166, 430, index);
}

function drawLampControl(x, y, index, value, time) {
  const positions = [-32, 0, 32];
  const flameX = x + positions[value];
  ctx.strokeStyle = '#77634a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 48, y + 30);
  ctx.lineTo(x + 48, y + 30);
  ctx.stroke();
  ctx.fillStyle = '#7c502d';
  ctx.fillRect(flameX - 13, y - 12, 26, 42);
  const glow = ctx.createRadialGradient(flameX, y - 28, 2, flameX, y - 28, 68);
  glow.addColorStop(0, `rgba(255,217,130,${0.7 + Math.sin(time * 0.02 + index) * 0.1})`);
  glow.addColorStop(1, 'rgba(255,100,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(flameX - 70, y - 98, 140, 140);
  ctx.fillStyle = '#f2b650';
  ctx.beginPath();
  ctx.moveTo(flameX, y - 50);
  ctx.quadraticCurveTo(flameX + 15, y - 25, flameX, y - 14);
  ctx.quadraticCurveTo(flameX - 15, y - 25, flameX, y - 50);
  ctx.fill();
  text(`${value + 1}`, x, y + 68, 19, '#a99878', 'center');
  addHit(`lamp-${index}`, x - 68, y - 95, 136, 190, index);
}

function drawDoorScene(time) {
  drawRoomBase(time, 'corridor');
  const floor = ctx.createLinearGradient(0, 600, 0, 1120);
  floor.addColorStop(0, '#151915');
  floor.addColorStop(1, '#070807');
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.moveTo(70, 980);
  ctx.lineTo(680, 980);
  ctx.lineTo(750, 1120);
  ctx.lineTo(0, 1120);
  ctx.closePath();
  ctx.fill();
  drawDoor(92, 370, 0, state.shadowRevealed);
  drawDoor(292, 370, 1, state.shadowRevealed);
  drawDoor(492, 370, 2, state.shadowRevealed);
  drawLampControl(175, 930, 0, state.lamps[0], time);
  drawLampControl(375, 930, 1, state.lamps[1], time);
  drawLampControl(575, 930, 2, state.lamps[2], time);
  drawDangerFigure(time, state.danger);
  drawHeader('纸门照影', '第三幕 · 无尽长廊');
}

function drawFailure(time) {
  ctx.fillStyle = 'rgba(2,4,4,0.78)';
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  fillRounded(66, 268, 618, 760, 30, 'rgba(11,13,12,0.97)');
  strokeRounded(66, 268, 618, 760, 30, '#7d372d', 3);
  ctx.fillStyle = '#8d2923';
  ctx.fillRect(96, 268, 558, 8);
  text('时间到了', 375, 342, 48, '#f0dfbd', 'center', 700);
  wrapText(state.failedReason, 375, 405, 520, 34, 23, '#a99d89', 'center');

  if (state.secretAdStartedAt !== null && !state.secretUnlocked) {
    fillRounded(120, 525, 510, 270, 24, 'rgba(64,42,19,0.72)');
    text('广告播放中', 375, 575, 25, '#e4c58a', 'center', 600);
    text(`${state.secretAdRemaining()}s`, 375, 665, 82, '#ffcb65', 'center', 700);
    text('看完即可解锁本关通关秘籍', 375, 747, 21, '#b9a983', 'center');
    text('请勿退出', 375, 866, 21, '#776e60', 'center');
    return;
  }

  if (state.secretUnlocked) {
    fillRounded(105, 505, 540, 292, 24, 'rgba(88,61,22,0.82)');
    text('本关通关秘籍', 375, 552, 27, '#ffd174', 'center', 700);
    wrapText(state.hint, 375, 610, 470, 35, 23, '#fff0d1', 'center');
    fillRounded(112, 845, 526, 86, 19, '#7b261f');
    text('带着秘籍再试一次', 375, 889, 27, '#ffe6be', 'center', 600);
    addHit('retry-with-secret', 112, 845, 526, 86);
    return;
  }

  text('要不要再试一次？', 375, 527, 27, '#d6c5a6', 'center', 600);
  fillRounded(112, 604, 526, 86, 19, '#7b261f');
  text('再试一次', 375, 648, 28, '#ffe6be', 'center', 600);
  addHit('retry', 112, 604, 526, 86);
  fillRounded(112, 720, 526, 102, 19, 'rgba(112,78,31,0.95)');
  text('看广告 3 秒', 375, 752, 27, '#ffdb8c', 'center', 700);
  text('立即获取本关通关秘籍', 375, 791, 21, '#efe2c2', 'center');
  addHit('secret-ad', 112, 720, 526, 102);
}

function drawFailedBackdrop(time) {
  if (state.previousStage === STAGES.SEAL) drawSealScene(time);
  if (state.previousStage === STAGES.BELLS) drawBellScene(time);
  if (state.previousStage === STAGES.DOORS) drawDoorScene(time);
  hitAreas = [];
}

function drawEnding(time) {
  drawRoomBase(time, 'hall');
  drawLantern(375, 420, time, 280);
  ctx.fillStyle = 'rgba(0,0,0,0.64)';
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  text('第一夜 · 完', 375, 390, 58, '#ddc69d', 'center', 700);
  text('你找到了姐姐的第二盘磁带', 375, 478, 25, '#9fa298', 'center');
  fillRounded(95, 580, 560, 245, 22, 'rgba(8,10,9,0.88)');
  wrapText(state.message, 375, 635, 490, 38, 25, '#e7d8be', 'center');
  text('第二夜：赶尸客栈', 375, 777, 23, '#a94336', 'center', 600);
  fillRounded(150, 920, 450, 84, 20, '#6f241d');
  text('重新体验', 375, 963, 27, '#ffe7bf', 'center', 600);
  addHit('restart', 150, 920, 450, 84);
}

function render(time) {
  const scaleX = canvas.width / DESIGN_WIDTH;
  const scaleY = canvas.height / DESIGN_HEIGHT;
  const shakeX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const shakeY = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  ctx.setTransform(scaleX, 0, 0, scaleY, shakeX, shakeY);
  ctx.clearRect(-20, -20, DESIGN_WIDTH + 40, DESIGN_HEIGHT + 40);
  hitAreas = [];

  if (state.stage === STAGES.INTRO) drawIntro(time);
  if (state.stage === STAGES.SEAL) drawSealScene(time);
  if (state.stage === STAGES.BELLS) drawBellScene(time);
  if (state.stage === STAGES.DOORS) drawDoorScene(time);
  if (state.stage === STAGES.FAILED) {
    drawFailedBackdrop(time);
    drawFailure(time);
  }
  if (state.stage === STAGES.ENDING) drawEnding(time);

  if ([STAGES.SEAL, STAGES.BELLS, STAGES.DOORS].includes(state.stage)) {
    drawHint();
    drawMessagePanel();
    drawVignette(state.danger);
  }
  drawNoise(time);

  if (flash > 0) {
    ctx.fillStyle = `rgba(190,20,12,${flash})`;
    ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    flash = Math.max(0, flash - 0.04);
  }
  shake *= 0.88;
}

function handleStageChange() {
  if (state.stage === lastStage) return;
  if (state.stage === STAGES.FAILED) {
    audio.scare();
    platform.vibrate(false);
    flash = 0.55;
    shake = 18;
  } else if (state.stage === STAGES.ENDING) {
    audio.success();
    platform.saveProgress({ completed: true, completedAt: Date.now() });
  } else if ([STAGES.BELLS, STAGES.DOORS].includes(state.stage)) {
    audio.success();
    platform.vibrate(true);
  }
  lastStage = state.stage;
}

function loop(time) {
  const secretWasUnlocked = state.secretUnlocked;
  state.update();
  if (!secretWasUnlocked && state.secretUnlocked) {
    audio.success();
    platform.vibrate(true);
  }
  audio.setDanger(state.danger);
  handleStageChange();
  render(time || Date.now());
  requestAnimationFrame(loop);
}

function touchPoint(touch) {
  return {
    x: touch.clientX / system.windowWidth * DESIGN_WIDTH,
    y: touch.clientY / system.windowHeight * DESIGN_HEIGHT
  };
}

function hitTest(point) {
  for (let i = hitAreas.length - 1; i >= 0; i -= 1) {
    const area = hitAreas[i];
    if (point.x >= area.x && point.x <= area.x + area.width && point.y >= area.y && point.y <= area.y + area.height) return area;
  }
  return null;
}

function performAction(area) {
  if (!area) return;
  audio.ensureStarted();
  audio.click();
  if (area.id === 'start') state.begin();
  else if (area.id === 'hint') {
    platform.showRewardedHint(() => state.showHint());
  } else if (area.id.indexOf('seal-') === 0) {
    const complete = state.rotateSeal(area.payload);
    if (complete) audio.success();
  } else if (area.id.indexOf('bell-') === 0) {
    audio.bell(area.payload);
    const result = state.ringBell(area.payload);
    if (result.wrong) {
      flash = 0.22;
      shake = 8;
      platform.vibrate(true);
    }
  } else if (area.id.indexOf('lamp-') === 0) {
    const revealed = state.cycleLamp(area.payload);
    if (revealed) audio.success();
  } else if (area.id.indexOf('door-') === 0) {
    const escaped = state.chooseDoor(area.payload);
    if (!escaped && state.shadowRevealed === false) {
      audio.scare();
      flash = 0.35;
      shake = 12;
    }
  } else if (area.id === 'retry') {
    state.retryStage();
  } else if (area.id === 'secret-ad') {
    state.startSecretAd();
  } else if (area.id === 'retry-with-secret') {
    state.retryStage(true);
  } else if (area.id === 'restart') {
    state.resetAll();
  }
  handleStageChange();
}

wx.onTouchStart((event) => {
  if (!event.touches || !event.touches.length) return;
  performAction(hitTest(touchPoint(event.touches[0])));
});

if (wx.onHide) {
  wx.onHide(() => {
    if (audio.context && audio.context.suspend) audio.context.suspend();
  });
}

if (wx.onShow) {
  wx.onShow(() => {
    if (audio.context && audio.context.resume) audio.context.resume();
  });
}

requestAnimationFrame(loop);
