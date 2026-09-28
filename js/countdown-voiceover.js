AFRAME.registerComponent('countdown-voiceover', {
  init: function () {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.context = null;
    this.buffers = {};
    this.activeSources = new Set();
    this.musicTracks = { 'bg-music-idle': null, 'bg-music-ingame': null };
    this.musicFadeStarted = false;
    this.idleMusicAllowed = true;
    this.gameOverCuePlayed = false;
    this.imageCues = {
      'countdown_3.png': 'countdown-3',
      'countdown_2.png': 'countdown-2',
      'countdown_1.png': 'countdown-1',
      'countdown_GO.png': 'countdown-GO'
    };

    if (!AudioContextClass) {
      console.warn('Countdown voiceover is unavailable: Web Audio is not supported.');
      this.assetsReady = Promise.resolve();
      return;
    }

    this.context = new AudioContextClass();
    const cues = {
      'countdown-3': 'assets/audio/countdown-3.mp3',
      'countdown-2': 'assets/audio/countdown-2.mp3',
      'countdown-1': 'assets/audio/countdown-1.mp3',
      'countdown-GO': 'assets/audio/countdown-GO.mp3',
      'countdown-end': 'assets/audio/countdown-end.mp3',
      'target-hit': 'assets/audio/target-hit.mp3',
      'target-miss': 'assets/audio/target-miss.mp3',
      'game-over': 'assets/audio/game-over.mp3',
      'button-press': 'assets/audio/button-press.mp3',
      'button-hover': 'assets/audio/button-hover.mp3',
      'bg-music-idle': 'assets/audio/bg-music-idle.mp3',
      'bg-music-ingame': 'assets/audio/bg-music-ingame.mp3'
    };

    this.assetsReady = Promise.all(Object.entries(cues).map(([name, url]) =>
      fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
          return response.arrayBuffer();
        })
        .then((data) => this.context.decodeAudioData(data))
        .then((buffer) => { this.buffers[name] = buffer; })
        .catch((error) => {
          console.warn(`Countdown voiceover cue could not be loaded (${name}).`, error);
        })
    ));

    this.onGameStateChanged = (event) => {
      if (event.detail.state === 'countdown') {
        this.gameOverCuePlayed = false;
        this.stopAll('button-press');
        this.syncMusicForState('countdown');
        return;
      }

      this.stopAll();
      this.syncMusicForState(event.detail.state);
      if (event.detail.state === 'gameover' && !this.gameOverCuePlayed) {
        this.gameOverCuePlayed = true;
        this.playCue('game-over', 0.72, 1);
      }
    };
    this.el.addEventListener('game-state-changed', this.onGameStateChanged);

    this.onOrbPunched = () => {
      const gameManager = this.el.sceneEl.components['game-manager'];
      if (gameManager && gameManager.state === 'playing') {
        this.playCue('target-hit', 0.72, 3);
      }
    };
    this.onOrbMissed = () => {
      const gameManager = this.el.sceneEl.components['game-manager'];
      if (gameManager && gameManager.state === 'playing') {
        this.playCue('target-miss', 0.24, 3);
      }
    };
    this.onUIButtonClick = (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== 'function' || !target.closest('.clickable')) return;
      const clickedButton = target.closest('.clickable');
      if (clickedButton.id === 'playAgainButton' || clickedButton.id === 'instructionStartButton') {
        const intersection = event.detail && event.detail.intersection;
        const object = intersection && intersection.object;
        console.log('[PLAY AGAIN DEBUG] click-sound-event', {
          target: target.id,
          clickable: clickedButton.id,
          currentTarget: event.currentTarget && event.currentTarget.id,
          eventPhase: event.eventPhase,
          bubbles: event.bubbles,
          intersectedEl: event.detail && event.detail.intersectedEl && event.detail.intersectedEl.id,
          intersectionEntity: (intersection && intersection.el) || (object && object.el && object.el.id),
          intersectionObject: object && object.name
        });
      }
      // Resume synchronously from the controller click gesture, then play the
      // shared cue once its preloaded buffer is ready.
      if (clickedButton.id === 'instructionStartButton' || clickedButton.id === 'playAgainButton') {
        this.idleMusicAllowed = false;
        this.stopMusic('bg-music-idle');
        this.stopMusic('bg-music-ingame');
      }
      this.unlockFromUserGesture().then(() => {
        if (clickedButton.id === 'startButton') {
          const gameManager = this.el.sceneEl.components['game-manager'];
          this.syncMusicForState(gameManager ? gameManager.state : 'welcome');
        }
        const played = this.playCue('button-press', 0.24, 2);
        if (clickedButton.id === 'playAgainButton') {
          console.log('[PLAY AGAIN DEBUG] click-sound-triggered', { played, state: this.el.sceneEl.components['game-manager']?.state });
        }
      });
    };
    this.el.addEventListener('orb-punched', this.onOrbPunched);
    this.el.addEventListener('orb-missed', this.onOrbMissed);
    this.el.addEventListener('click', this.onUIButtonClick, true);

    this.assetsReady.then(() => {
      const gameManager = this.el.sceneEl.components['game-manager'];
      this.syncMusicForState(gameManager ? gameManager.state : 'welcome');
    });
  },

  unlockFromUserGesture: function () {
    let resume = Promise.resolve();
    if (this.context && this.context.state === 'suspended') {
      // Call resume before returning so the browser sees the START GAME gesture.
      resume = this.context.resume().catch((error) => {
        console.warn('Countdown voiceover audio context could not resume.', error);
      });
    }
    return Promise.all([resume, this.assetsReady]);
  },

  playForImage: function (imageSource) {
    this.stopCountdownCues();
    const filename = imageSource.split('/').pop();
    const cueName = this.imageCues[filename];
    this.playCue(cueName);
  },

  syncMusicForState: function (state) {
    if (state === 'welcome' || state === 'instructions') {
      this.musicFadeStarted = false;
      this.stopMusic('bg-music-ingame');
      if (this.idleMusicAllowed) this.startMusic('bg-music-idle', 0.70);
      return;
    }

    this.idleMusicAllowed = false;
    this.stopMusic('bg-music-idle');
    if (state === 'playing') {
      this.musicFadeStarted = false;
      this.startMusic('bg-music-ingame', 0.70);
      return;
    }

    this.musicFadeStarted = false;
    this.stopMusic('bg-music-ingame');
  },

  startMusic: function (name, volume) {
    if (!this.context || this.context.state !== 'running' || this.musicTracks[name]) return false;
    const buffer = this.buffers[name];
    if (!buffer) return false;

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const track = { source, gain, volume };
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    gain.connect(this.context.destination);
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    this.musicTracks[name] = track;
    source.onended = () => {
      if (this.musicTracks[name] !== track) return;
      this.musicTracks[name] = null;
      try { source.disconnect(); } catch (error) { /* Already disconnected. */ }
      try { gain.disconnect(); } catch (error) { /* Already disconnected. */ }
    };
    source.start(0);
    return true;
  },

  stopMusic: function (name) {
    const track = this.musicTracks[name];
    if (!track) return;
    this.musicTracks[name] = null;
    track.source.onended = null;
    const now = this.context ? this.context.currentTime : 0;
    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(0, now);
    try { track.source.stop(now); } catch (error) { /* Already ended. */ }
    try { track.source.disconnect(); } catch (error) { /* Already disconnected. */ }
    try { track.gain.disconnect(); } catch (error) { /* Already disconnected. */ }
  },

  tick: function () {
    if (this.musicFadeStarted || !this.musicTracks['bg-music-ingame']) return;
    const gameManager = this.el.sceneEl.components['game-manager'];
    const timer = this.el.sceneEl.components['game-timer'];
    if (!gameManager || gameManager.state !== 'playing' || !timer || timer.timeRemaining > 3) return;

    const track = this.musicTracks['bg-music-ingame'];
    if (!track) return;
    this.musicFadeStarted = true;
    const now = this.context.currentTime;
    const remaining = Math.max(0, timer.timeRemaining);
    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(track.volume, now);
    track.gain.gain.linearRampToValueAtTime(0, now + remaining);
  },

  playCue: function (cueName, volume = 1, maxVoices = 1) {
    if (!this.context || this.context.state !== 'running') return false;
    const buffer = this.buffers[cueName];
    if (!buffer) return false;

    const cueSources = Array.from(this.activeSources)
      .filter((source) => source.cueName === cueName);
    if (cueSources.length >= maxVoices) this.stopSource(cueSources[0]);

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.cueName = cueName;
    source.gainNode = gain;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.context.destination);
    this.activeSources.add(source);
    source.onended = () => this.releaseSource(source);
    source.start(0);
    return true;
  },

  releaseSource: function (source) {
    this.activeSources.delete(source);
    try { source.disconnect(); } catch (error) { /* Already disconnected. */ }
    if (source.gainNode) {
      try { source.gainNode.disconnect(); } catch (error) { /* Already disconnected. */ }
    }
  },

  stopSource: function (source) {
    source.onended = null;
    try { source.stop(); } catch (error) { /* Already ended. */ }
    this.releaseSource(source);
  },

  stopCountdownCues: function () {
    const countdownCues = new Set([
      'countdown-3', 'countdown-2', 'countdown-1', 'countdown-GO', 'countdown-end'
    ]);
    Array.from(this.activeSources).forEach((source) => {
      if (countdownCues.has(source.cueName)) this.stopSource(source);
    });
  },

  stopAll: function (exceptCueName = null) {
    Array.from(this.activeSources).forEach((source) => {
      if (source.cueName !== exceptCueName) this.stopSource(source);
    });
  },

  remove: function () {
    this.stopAll();
    this.stopMusic('bg-music-idle');
    this.stopMusic('bg-music-ingame');
    this.el.removeEventListener('game-state-changed', this.onGameStateChanged);
    this.el.removeEventListener('orb-punched', this.onOrbPunched);
    this.el.removeEventListener('orb-missed', this.onOrbMissed);
    this.el.removeEventListener('click', this.onUIButtonClick, true);
    if (this.context && this.context.state !== 'closed') this.context.close();
  }
});
