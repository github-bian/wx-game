class HorrorAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.started = false;
    this.heartbeatTimer = null;
    this.danger = 0;
  }

  ensureStarted() {
    if (this.started) return;
    if (!wx.createWebAudioContext) return;
    this.context = wx.createWebAudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.context.destination);
    this.started = true;
    this.startDrone();
    this.scheduleHeartbeat();
  }

  startDrone() {
    if (!this.context) return;
    const low = this.context.createOscillator();
    const fifth = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    low.type = 'sine';
    fifth.type = 'triangle';
    low.frequency.value = 43.65;
    fifth.frequency.value = 65.41;
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    gain.gain.value = 0.09;
    low.connect(filter);
    fifth.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    low.start();
    fifth.start();
  }

  setDanger(value) {
    this.danger = Math.max(0, Math.min(1, value));
  }

  scheduleHeartbeat() {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    const interval = 1200 - this.danger * 720;
    this.heartbeatTimer = setTimeout(() => {
      this.heartbeat();
      this.scheduleHeartbeat();
    }, interval);
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

  heartbeat() {
    this.tone(58, 0.16, 0.22 + this.danger * 0.2, 'sine');
    setTimeout(() => this.tone(52, 0.18, 0.15 + this.danger * 0.16, 'sine'), 145);
  }

  bell(index) {
    const frequencies = [392, 523.25, 659.25];
    this.tone(frequencies[index] || 440, 1.15, 0.45, 'sine');
    this.tone((frequencies[index] || 440) * 2.01, 0.7, 0.12, 'triangle');
  }

  click() {
    this.tone(180, 0.08, 0.18, 'triangle');
  }

  success() {
    [261.63, 329.63, 392].forEach((note, index) => {
      setTimeout(() => this.tone(note, 0.7, 0.22, 'sine'), index * 150);
    });
  }

  scare() {
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(90, now);
    oscillator.frequency.exponentialRampToValueAtTime(28, now + 0.8);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.85);
  }
}

module.exports = { HorrorAudio };
