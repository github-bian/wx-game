class DreamAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.started = false;
  }

  ensureStarted() {
    if (this.started || !wx.createWebAudioContext) return;
    this.context = wx.createWebAudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.context.destination);
    this.started = true;
    this.startAmbience();
  }

  startAmbience() {
    if (!this.context) return;
    const low = this.context.createOscillator();
    const high = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    low.type = 'sine';
    high.type = 'sine';
    low.frequency.value = 55;
    high.frequency.value = 82.41;
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    gain.gain.value = 0.035;
    low.connect(filter);
    high.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    low.start();
    high.start();
  }

  tone(frequency, duration, volume, type) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  click() {
    this.tone(330, 0.09, 0.11, 'triangle');
  }

  paper() {
    this.tone(740, 0.08, 0.07, 'sine');
    setTimeout(() => this.tone(520, 0.12, 0.05, 'triangle'), 55);
  }

  rotate() {
    this.tone(220, 0.12, 0.1, 'triangle');
    setTimeout(() => this.tone(277.18, 0.13, 0.07, 'sine'), 70);
  }

  success() {
    [392, 493.88, 587.33, 783.99].forEach((note, index) => {
      setTimeout(() => this.tone(note, 0.62, 0.12, 'sine'), index * 125);
    });
  }
}

module.exports = { DreamAudio };
