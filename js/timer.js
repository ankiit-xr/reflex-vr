AFRAME.registerComponent('game-timer', {
  schema: {
    duration: { type: 'number', default: 60 }
  },

  init: function () {
    this.reset();

    this.el.addEventListener('game-state-changed', (e) => {
      this.isRunning = e.detail.state === 'playing' || e.detail.state === 'time-warning';
    });
  },

  reset: function () {
    this.timeRemaining = this.data.duration;
    this.elapsed = 0;
    this.isRunning = false;
    this.lastLoggedSecond = this.timeRemaining;
    this.endWarningPlayed = false;
  },

  tick: function (time, timeDelta) {
    if (!this.isRunning) return;

    const previousTimeRemaining = this.timeRemaining;
    this.timeRemaining -= timeDelta / 1000;
    this.elapsed = this.data.duration - this.timeRemaining;

    const gameManager = this.el.sceneEl.components['game-manager'];
    const isGameplayActive = gameManager &&
      (gameManager.state === 'playing' || gameManager.state === 'time-warning');
    if (!this.endWarningPlayed && isGameplayActive && previousTimeRemaining > 10 &&
        this.timeRemaining <= 10 && this.timeRemaining > 0) {
      this.endWarningPlayed = true;
      const countdownVoiceover = this.el.sceneEl.components['countdown-voiceover'];
      if (countdownVoiceover) countdownVoiceover.playCue('countdown-end');
    }

    const currentSecond = Math.ceil(this.timeRemaining);
    if (currentSecond !== this.lastLoggedSecond) {
      this.lastLoggedSecond = currentSecond;
      console.log('Time remaining:', currentSecond);
    }

    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.isRunning = false;
      console.log('Time is up!');
      this.el.sceneEl.components['game-manager'].endGame();
    }
  }
});
