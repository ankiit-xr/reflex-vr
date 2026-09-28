AFRAME.registerComponent('score-manager', {
  init: function () {
    this.reset();

    // Listen for hits bubbling up from any orb
    this.el.addEventListener('orb-punched', () => {
      if (this.isGameOver()) return;
      this.score += 1;
      this.hits += 1;
      this.updateAccuracy();
      console.log('Score:', this.score);
    });

    this.el.addEventListener('orb-missed', () => {
      if (this.isGameOver()) return;
      this.misses += 1;
      this.updateAccuracy();
    });
  },

  reset: function () {
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.accuracy = 100;
  },

  isGameOver: function () {
    const gameManager = this.el.sceneEl.components['game-manager'];
    return gameManager && gameManager.state === 'gameover';
  },

  updateAccuracy: function () {
    const resolvedTargets = this.hits + this.misses;
    this.accuracy = resolvedTargets === 0 ? 100 : (this.hits / resolvedTargets) * 100;
  }
});
