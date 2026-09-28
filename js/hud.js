AFRAME.registerComponent('hud', {
  init: function () {
    this.timeLabel = document.querySelector('#timeLabel');
    this.timerText = document.querySelector('#timerText');
    this.scoreText = document.querySelector('#scoreText');
    this.accuracyText = document.querySelector('#accuracyText');
    this.lastTime = null;
    this.lastTimeColor = null;
    this.lastScore = null;
    this.lastAccuracy = null;
  },

  tick: function () {
    const timerComponent = this.el.sceneEl.components['game-timer'];
    const scoreComponent = this.el.sceneEl.components['score-manager'];
    if (!timerComponent || !scoreComponent) return;

    const displaySeconds = Math.ceil(timerComponent.timeRemaining);
    if (displaySeconds !== this.lastTime) {
      this.lastTime = displaySeconds;
      this.timerText.setAttribute('troika-text', 'value', String(displaySeconds).padStart(2, '0'));
    }

    const timeColor = displaySeconds <= 10 ? '#ff2fd6' : '#00e5ff';
    if (timeColor !== this.lastTimeColor) {
      this.lastTimeColor = timeColor;
      this.timerText.setAttribute('troika-text', 'color', timeColor);
      this.timeLabel.setAttribute('troika-text', 'color', timeColor === '#ff2fd6' ? timeColor : '#eafaff');
    }

    if (scoreComponent.score !== this.lastScore) {
      this.lastScore = scoreComponent.score;
      this.scoreText.setAttribute('troika-text', 'value', String(scoreComponent.score).padStart(3, '0'));
    }

    if (scoreComponent.accuracy !== this.lastAccuracy) {
      this.lastAccuracy = scoreComponent.accuracy;
      this.accuracyText.setAttribute('troika-text', 'value', `${Math.round(scoreComponent.accuracy)}%`);
    }
  }
});
