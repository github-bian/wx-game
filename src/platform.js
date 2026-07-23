function saveProgress(value) {
  try {
    wx.setStorageSync('dream-post-office-progress', value);
  } catch (error) {
    // Storage failure should never stop the game loop.
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
  saveProgress,
  showRewardedHint,
  vibrate
};
