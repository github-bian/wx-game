(function bootstrapFivePhaseLocks() {
  const canvas = document.getElementById('game');
  const shell = document.getElementById('game-shell');
  const fullscreen = document.getElementById('fullscreen');
  const handlers = { start: null, move: null, end: null };
  const lifecycleHandlers = { hide: [], show: [] };
  let activePointerId = null;

  function shellInfo() {
    const rect = shell.getBoundingClientRect();
    return {
      windowWidth: rect.width,
      windowHeight: rect.height,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2)
    };
  }

  function pointer(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      clientX: event.clientX - rect.left,
      clientY: event.clientY - rect.top
    };
  }

  window.wx = {
    createCanvas: () => canvas,
    createImage: () => new Image(),
    getWindowInfo: shellInfo,
    getSystemInfoSync: shellInfo,
    createWebAudioContext: () => new (window.AudioContext || window.webkitAudioContext)(),
    onTouchStart: (handler) => { handlers.start = handler; },
    onTouchMove: (handler) => { handlers.move = handler; },
    onTouchEnd: (handler) => { handlers.end = handler; },
    onHide: (handler) => { if (typeof handler === 'function') lifecycleHandlers.hide.push(handler); },
    onShow: (handler) => { if (typeof handler === 'function') lifecycleHandlers.show.push(handler); },
    vibrateShort: () => { if (navigator.vibrate) navigator.vibrate(18); },
    vibrateLong: () => { if (navigator.vibrate) navigator.vibrate(42); },
    setStorageSync: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    getStorageSync: (key) => {
      try { return JSON.parse(localStorage.getItem(key)); } catch (error) { return null; }
    }
  };

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    activePointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    if (handlers.start) handlers.start({ touches: [pointer(event)] });
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointerId) return;
    event.preventDefault();
    if (!event.buttons) {
      activePointerId = null;
      if (handlers.end) handlers.end({ changedTouches: [pointer(event)] });
      return;
    }
    if (handlers.move) handlers.move({ touches: [pointer(event)] });
  });

  function endPointer(event) {
    if (event.pointerId !== activePointerId) return;
    activePointerId = null;
    event.preventDefault();
    if (handlers.end) handlers.end({ changedTouches: [pointer(event)] });
  }

  window.addEventListener('pointerup', endPointer, true);
  window.addEventListener('pointercancel', endPointer, true);

  document.addEventListener('visibilitychange', () => {
    const type = document.hidden ? 'hide' : 'show';
    lifecycleHandlers[type].forEach((handler) => handler());
  });

  fullscreen.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await shell.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) {
      // Fullscreen is optional; the game remains playable without it.
    }
  });

  let lastOrientation = window.matchMedia('(orientation: portrait)').matches;
  window.addEventListener('resize', () => {
    const portrait = window.matchMedia('(orientation: portrait)').matches;
    if (portrait !== lastOrientation) window.setTimeout(() => window.location.reload(), 120);
    lastOrientation = portrait;
  });
})();
