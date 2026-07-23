(function bootstrapDreamPostOffice() {
  const canvas = document.getElementById('game');
  const shell = document.getElementById('game-shell');
  const fullscreen = document.getElementById('fullscreen');
  const handlers = { start: null, move: null, end: null };
  const logicalWidth = 1280;
  const logicalHeight = 720;

  function pointer(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      clientX: (event.clientX - rect.left) / rect.width * logicalWidth,
      clientY: (event.clientY - rect.top) / rect.height * logicalHeight
    };
  }

  window.wx = {
    createCanvas: () => canvas,
    createImage: () => new Image(),
    getWindowInfo: () => ({ windowWidth: logicalWidth, windowHeight: logicalHeight, pixelRatio: Math.min(window.devicePixelRatio || 1, 2) }),
    getSystemInfoSync: () => ({ windowWidth: logicalWidth, windowHeight: logicalHeight, pixelRatio: Math.min(window.devicePixelRatio || 1, 2) }),
    createWebAudioContext: () => new (window.AudioContext || window.webkitAudioContext)(),
    onTouchStart: (handler) => { handlers.start = handler; },
    onTouchMove: (handler) => { handlers.move = handler; },
    onTouchEnd: (handler) => { handlers.end = handler; },
    onHide: () => {},
    onShow: () => {},
    vibrateShort: () => { if (navigator.vibrate) navigator.vibrate(20); },
    vibrateLong: () => { if (navigator.vibrate) navigator.vibrate(45); },
    setStorageSync: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    getStorageSync: (key) => {
      try { return JSON.parse(localStorage.getItem(key)); } catch (error) { return null; }
    }
  };

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    if (handlers.start) handlers.start({ touches: [pointer(event)] });
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!event.buttons) return;
    event.preventDefault();
    if (handlers.move) handlers.move({ touches: [pointer(event)] });
  });
  canvas.addEventListener('pointerup', (event) => {
    event.preventDefault();
    if (handlers.end) handlers.end({ changedTouches: [pointer(event)] });
  });
  canvas.addEventListener('pointercancel', (event) => {
    if (handlers.end) handlers.end({ changedTouches: [pointer(event)] });
  });

  fullscreen.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await shell.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) {
      // Fullscreen is optional; the game remains playable without it.
    }
  });
})();
