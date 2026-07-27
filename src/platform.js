function saveProgress(value) {
  try {
    wx.setStorageSync('five-phase-locks-progress', value);
  } catch (error) {
    // Storage failure should never stop the game loop.
  }
}

function saveSession(value) {
  try {
    wx.setStorageSync('five-phase-locks-session-v1', value);
  } catch (error) {
    // Session persistence is optional; gameplay should continue if storage is unavailable.
  }
}

function loadSession() {
  try {
    return wx.getStorageSync ? wx.getStorageSync('five-phase-locks-session-v1') : null;
  } catch (error) {
    return null;
  }
}

function vibrate(short) {
  try {
    if (short && wx.vibrateShort) wx.vibrateShort({ type: 'medium' });
    else if (wx.vibrateLong) wx.vibrateLong();
  } catch (error) {
    // Vibration is optional on unsupported devices.
  }
}

function showRewardedHint(onComplete) {
  // MVP: replace with wx.createRewardedVideoAd before release.
  onComplete();
}

module.exports = {
  loadSession,
  saveProgress,
  saveSession,
  showRewardedHint,
  vibrate
};
