AFRAME.registerComponent('target-spawner', {
  schema: {
    maxActiveOrbs: { type: 'number', default: 1 },
    orbLifetime: { type: 'number', default: 2 }
  },

  init: function () {
    this.slots = [
      { x: 0,    y: 1.9, z: -1.3 },
      { x: -0.3, y: 1.7, z: -1.3 },
      { x: 0.3,  y: 1.7, z: -1.3 },
      { x: -0.6, y: 1.5, z: -1.3 },
      { x: 0,    y: 1.5, z: -1.3 },
      { x: 0.6,  y: 1.5, z: -1.3 },
      { x: -0.3, y: 1.3, z: -1.3 },
      { x: 0.3,  y: 1.3, z: -1.3 },
      { x: 0,    y: 1.1, z: -1.3 }
    ];

    const cameraEl = document.querySelector('a-camera');
    const playerWorldPosition = new THREE.Vector3(0, 1.6, 0);
    if (cameraEl) {
      cameraEl.object3D.updateWorldMatrix(true, false);
      cameraEl.object3D.getWorldPosition(playerWorldPosition);
    }
    this.el.object3D.updateWorldMatrix(true, false);
    const playerPosition = this.el.object3D.worldToLocal(playerWorldPosition.clone());

    const centerSlot = this.slots.reduce((closest, slot) => {
      const slotPosition = new THREE.Vector3(slot.x, slot.y, slot.z);
      const closestPosition = new THREE.Vector3(closest.x, closest.y, closest.z);
      return slotPosition.distanceToSquared(playerPosition) < closestPosition.distanceToSquared(playerPosition)
        ? slot
        : closest;
    });
    const originalCenterDistance = new THREE.Vector3(centerSlot.x, centerSlot.y, centerSlot.z)
      .distanceTo(playerPosition);
    // The previous pass used the uncompressed source coordinates here, making
    // the field almost as far away as the original 1.3 m layout.
    const previousTargetFieldRadius = originalCenterDistance * 0.95;
    this.targetFieldRadius = originalCenterDistance * 0.62 * 0.93;

    const maxHorizontalOffset = Math.max(...this.slots.map((slot) => Math.abs(slot.x - playerPosition.x)));
    const spreadFactor = 1.2;
    const maxHorizontalAngle = Math.asin(Math.min(
      1,
      (maxHorizontalOffset * spreadFactor) / previousTargetFieldRadius
    ));
    this.slots = this.slots.map((slot) => {
      const horizontalFraction = maxHorizontalOffset
        ? (slot.x - playerPosition.x) / maxHorizontalOffset
        : 0;
      const horizontalAngle = horizontalFraction * maxHorizontalAngle;
      const verticalOffset = (slot.y - playerPosition.y) * 0.8;
      const horizontalRadius = Math.sqrt(Math.max(
        0,
        this.targetFieldRadius * this.targetFieldRadius - verticalOffset * verticalOffset
      ));

      return {
        x: playerPosition.x + horizontalRadius * Math.sin(horizontalAngle),
        y: playerPosition.y + verticalOffset,
        z: playerPosition.z - horizontalRadius * Math.cos(horizontalAngle)
      };
    });
    this.playerWorldPosition = playerWorldPosition;

    this.activeOrbs = new Map();
    this.previousSlotIndex = null;
    this.running = false;
    this.spawnTimeout = null;
    this.runId = 0;
    this._cleanupTimeouts = new Map();
    this.gridPositions = [
      { col: 1, row: 0 }, { col: 0, row: 0 }, { col: 2, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 },
      { col: 0, row: 2 }, { col: 2, row: 2 }, { col: 1, row: 2 }
    ];
    this.difficultyStages = [
      { name: 'easy', maxOrbs: 1, interval: 1.2, lifetime: 2.0, edgeBias: 1 },
      { name: 'medium', maxOrbs: 2, interval: 0.9, lifetime: 1.6, edgeBias: 1.15 },
      { name: 'hard', maxOrbs: 3, interval: 0.7, lifetime: 1.3, edgeBias: 1.6 },
      { name: 'very-hard', maxOrbs: 3, interval: 0.5, lifetime: 1.1, edgeBias: 2 }
    ];
    this.currentStage = null;

    // Shared geometry/material, reused by every orb instead of creating new ones
    this.orbGeometry = new THREE.SphereGeometry(0.12, 16, 16);
    this.orbMaterial = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00bcd4,
      emissiveIntensity: 0.8,
      metalness: 0.3,
      roughness: 0.2
    });

    this.onGameStateChanged = (e) => {
      if (e.detail.state === 'playing') this.start();
      else this.stop();
    };
    this.el.sceneEl.addEventListener('game-state-changed', this.onGameStateChanged);
  },

  reset: function () {
    this.stop();
    this.data.maxActiveOrbs = 1;
    this.data.orbLifetime = 2;
    this.previousSlotIndex = null;
    this.currentStage = null;
  },

  stop: function () {
    this.running = false;
    this.runId += 1;
    if (this.spawnTimeout !== null) {
      clearTimeout(this.spawnTimeout);
      this.spawnTimeout = null;
    }

    for (const [timeoutId, orb] of this._cleanupTimeouts.entries()) {
      clearTimeout(timeoutId);
      this.removeOrb(orb);
    }
    this._cleanupTimeouts.clear();
    this.clearAllOrbs();
  },

  getStageForElapsed: function (elapsed) {
    if (elapsed < 15) return this.difficultyStages[0];
    if (elapsed < 30) return this.difficultyStages[1];
    if (elapsed < 45) return this.difficultyStages[2];
    return this.difficultyStages[3];
  },

  tick: function () {
    const gameManager = this.getGameManager();
    if (!this.running || !gameManager || gameManager.state !== 'playing') return;
    const timerComponent = this.el.sceneEl.components['game-timer'];
    if (!timerComponent) return;

    const stage = this.getStageForElapsed(timerComponent.elapsed || 0);
    if (stage !== this.currentStage) {
      this.currentStage = stage;
      this.applyStage(stage);
      if (this.spawnTimeout !== null) {
        clearTimeout(this.spawnTimeout);
        this.spawnTimeout = null;
        this.scheduleNextSpawn(this.runId);
      }
    }
  },

  applyStage: function (stage) {
    this.data.maxActiveOrbs = stage.maxOrbs;
    this.data.orbLifetime = stage.lifetime;
  },

  start: function () {
    this.stop();
    this.running = true;
    this.previousSlotIndex = null;
    const timerComponent = this.el.sceneEl.components['game-timer'];
    this.currentStage = this.getStageForElapsed(timerComponent ? timerComponent.elapsed || 0 : 0);
    this.applyStage(this.currentStage);
    const runId = ++this.runId;
    this.spawnAtRandomSlot();
    this.scheduleNextSpawn(runId);
  },

  scheduleNextSpawn: function (runId) {
    if (!this.running || runId !== this.runId) return;
    const timerComponent = this.el.sceneEl.components['game-timer'];
    const stage = this.getStageForElapsed(timerComponent ? timerComponent.elapsed || 0 : 0);
    this.applyStage(stage);
    this.spawnTimeout = setTimeout(() => {
      this.spawnTimeout = null;
      if (!this.running || runId !== this.runId) return;
      this.spawnAtRandomSlot();
      this.scheduleNextSpawn(runId);
    }, stage.interval * 1000);
  },

  getGameManager: function () {
    return this.el.sceneEl.components['game-manager'];
  },

  getFreeSlotIndex: function (stage) {
    let freeIndices = [];
    for (let i = 0; i < this.slots.length; i++) {
      if (!this.activeOrbs.has(i)) freeIndices.push(i);
    }
    if (freeIndices.length === 0) return -1;

    if (this.previousSlotIndex !== null && freeIndices.length > 1) {
      freeIndices = freeIndices.filter((index) => index !== this.previousSlotIndex);
    }

    const previousGridPosition = this.previousSlotIndex === null
      ? null
      : this.gridPositions[this.previousSlotIndex];
    const weightedIndices = freeIndices.map((index) => {
      const gridPosition = this.gridPositions[index];
      const distance = previousGridPosition
        ? Math.hypot(gridPosition.col - previousGridPosition.col, gridPosition.row - previousGridPosition.row)
        : Math.hypot(gridPosition.col - 1, gridPosition.row - 1);
      let weight;
      if (stage.name === 'easy') {
        weight = 1 / Math.pow(distance + 0.25, 2);
      } else if (stage.name === 'medium') {
        weight = 1 / (0.6 + Math.abs(distance - 1.4));
      } else if (stage.name === 'hard') {
        weight = Math.pow(distance + 0.2, 2);
      } else {
        weight = Math.pow(distance + 0.2, 3);
      }

      const isEdge = gridPosition.col === 0 || gridPosition.col === 2 ||
        gridPosition.row === 0 || gridPosition.row === 2;
      if (isEdge) weight *= stage.edgeBias;
      weight *= 0.8 + Math.random() * 0.4;
      return { index, weight };
    });

    const totalWeight = weightedIndices.reduce((sum, candidate) => sum + candidate.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const candidate of weightedIndices) {
      roll -= candidate.weight;
      if (roll <= 0) return candidate.index;
    }
    return weightedIndices[weightedIndices.length - 1].index;
  },

  spawnAtRandomSlot: function () {
    const gameManager = this.getGameManager();
    if (!gameManager || gameManager.state !== 'playing' || !this.running) return;
    const timerComponent = this.el.sceneEl.components['game-timer'];
    const stage = this.getStageForElapsed(timerComponent ? timerComponent.elapsed || 0 : 0);
    this.currentStage = stage;
    this.applyStage(stage);
    if (this.activeOrbs.size >= this.data.maxActiveOrbs) return;

    const slotIndex = this.getFreeSlotIndex(stage);
    if (slotIndex === -1) return;

    const slot = this.slots[slotIndex];
    const orb = document.createElement('a-entity');
    orb.setAttribute('position', `${slot.x} ${slot.y} ${slot.z}`);
    orb.setAttribute('punchable', '');

    // Directly attach the shared Three.js mesh instead of an <a-sphere> tag
    const mesh = new THREE.Mesh(this.orbGeometry, this.orbMaterial.clone());
    mesh.scale.setScalar(0.6);
    orb.setObject3D('mesh', mesh);
    orb.setAttribute('target-orb-visual', '');

    orb.addEventListener('orb-punched', () => {
      this.onOrbResolved(slotIndex, orb);
    });

    this.el.appendChild(orb);
    orb.object3D.lookAt(this.playerWorldPosition);
    this.activeOrbs.set(slotIndex, orb);
    this.previousSlotIndex = slotIndex;

    orb.timeoutId = setTimeout(() => {
      if (!this.running || this.activeOrbs.get(slotIndex) !== orb) return;
      if (orb.parentNode) {
        const punchable = orb.components && orb.components.punchable;
        if (punchable) {
          if (!punchable.registerMiss()) return;
        } else {
          orb.setAttribute('visible', false);
        }
        orb.emit('orb-missed', {}, true);
      }
      this.onOrbResolved(slotIndex, orb);
    }, stage.lifetime * 1000);
  },

  onOrbResolved: function (slotIndex, orb) {
    if (this.activeOrbs.get(slotIndex) !== orb) return;

    clearTimeout(orb.timeoutId);
    this.activeOrbs.delete(slotIndex);

    // Let hit/miss feedback finish before removing the target visual.
    const cleanupTimeoutId = setTimeout(() => {
      this._cleanupTimeouts.delete(cleanupTimeoutId);
      this.removeOrb(orb);
    }, 320);
    this._cleanupTimeouts.set(cleanupTimeoutId, orb);
  },

  clearAllOrbs: function () {
    for (const orb of this.activeOrbs.values()) {
      clearTimeout(orb.timeoutId);
      this.removeOrb(orb);
    }
    this.activeOrbs.clear();
  },

  removeOrb: function (orb) {
    const punchable = orb.components && orb.components.punchable;
    if (punchable) punchable.clearFeedback();

    const mesh = orb.getObject3D('mesh');
    if (mesh && mesh.material && mesh.material !== this.orbMaterial) mesh.material.dispose();
    if (orb.parentNode) orb.parentNode.removeChild(orb);
  },

  remove: function () {
    this.stop();
    this.el.sceneEl.removeEventListener('game-state-changed', this.onGameStateChanged);
    this.orbGeometry.dispose();
    this.orbMaterial.dispose();
  }
});
