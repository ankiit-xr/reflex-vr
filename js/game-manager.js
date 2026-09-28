AFRAME.registerComponent('game-manager', {
  init: function () {
    this.state = 'welcome'; // welcome | instructions | restart-pending | countdown | playing | time-warning | gameover | results
    this.countdownTimeouts = new Set();
    this.countdownRunId = 0;
    console.log('Game state:', this.state);
  },

  showInstructions: function () {
    if (this.state !== 'welcome') return;
    this.setState('instructions');
  },

  startCountdown: function () {
    console.log('[PLAY AGAIN DEBUG] startCountdown-entered', { state: this.state });
    if (this.state !== 'instructions' && this.state !== 'gameover' &&
        this.state !== 'restart-pending') return;

    this.cancelCountdown();
    const runId = this.countdownRunId;
    const scene = this.el.sceneEl;
    const timer = scene.components['game-timer'];
    const score = scene.components['score-manager'];
    const spawner = document.querySelector('#environment').components['target-spawner'];

    if (timer) timer.reset();
    if (score) score.reset();
    if (spawner) spawner.reset();

    this.setState('countdown');
    console.log('[PLAY AGAIN DEBUG] countdown-initialized', { state: this.state, runId });
    const sequence = [
      { src: 'assets/ui/countdown_3.png', width: 0.85, height: 0.85, duration: 1000, fadeDelay: 720 },
      { src: 'assets/ui/countdown_2.png', width: 0.85, height: 0.85, duration: 1000, fadeDelay: 720 },
      { src: 'assets/ui/countdown_1.png', width: 0.85, height: 0.85, duration: 1000, fadeDelay: 720 },
      { src: 'assets/ui/countdown_GO.png', width: 1.19956, height: 0.85, duration: 650, fadeDelay: 400 }
    ];
    let sequenceIndex = 0;

    const showNextImage = () => {
      if (runId !== this.countdownRunId || this.state !== 'countdown') return;
      if (sequenceIndex >= sequence.length) {
        this.startPlaying();
        return;
      }

      const step = sequence[sequenceIndex++];
      this.el.emit('countdown-display', step);
      const timeoutId = setTimeout(() => {
        this.countdownTimeouts.delete(timeoutId);
        showNextImage();
      }, step.duration);
      this.countdownTimeouts.add(timeoutId);
    };

    showNextImage();
  },

  cancelCountdown: function () {
    this.countdownRunId += 1;
    this.countdownTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.countdownTimeouts.clear();
  },

  startPlaying: function () {
    this.setState('playing');
  },

  endGame: function () {
    this.cancelCountdown();
    if (this.state === 'gameover') return;
    this.setState('gameover');
  },

  setState: function (newState) {
    if (newState !== 'countdown') this.cancelCountdown();
    this.state = newState;
    console.log('Game state:', newState);
    this.el.emit('game-state-changed', { state: newState });
  },

  remove: function () {
    this.cancelCountdown();
  }
});
