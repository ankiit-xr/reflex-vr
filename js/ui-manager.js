AFRAME.registerGeometry('rounded-rect', {
  schema: {
    width: { default: 1, min: 0.001 },
    height: { default: 1, min: 0.001 },
    radius: { default: 0.08, min: 0 },
    segments: { type: 'int', default: 8, min: 1, max: 24 }
  },

  init: function (data) {
    const halfWidth = data.width * 0.5;
    const halfHeight = data.height * 0.5;
    const radius = Math.min(data.radius, halfWidth, halfHeight);
    const shape = new THREE.Shape();
    shape.moveTo(-halfWidth + radius, -halfHeight);
    shape.lineTo(halfWidth - radius, -halfHeight);
    shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius);
    shape.lineTo(halfWidth, halfHeight - radius);
    shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
    shape.lineTo(-halfWidth + radius, halfHeight);
    shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius);
    shape.lineTo(-halfWidth, -halfHeight + radius);
    shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight);
    this.geometry = new THREE.ShapeGeometry(shape, data.segments);
  }
});

// One world-space padding rule is shared by every primary action button.
const PRIMARY_BUTTON_LAYOUT = Object.freeze({
  horizontalPadding: 0.095,
  verticalPadding: 0.045,
  cornerRadius: 0.056,
  outlineThickness: 0.0084
});

AFRAME.registerComponent('primary-button-layout', {
  schema: {
    label: { type: 'selector' },
    accessory: { type: 'selector' }
  },

  init: function () {
    this.outline = null;
    this.originalPositions = new Map();
    this.suppressedRaycastMeshes = new Map();
    this.retryCount = 0;
    this.tryLayout = this.tryLayout.bind(this);
    this.layoutTimer = setInterval(this.tryLayout, 50);
    this.tryLayout();
  },

  getTroikaMetrics: function (element) {
    if (!element) return null;
    let textObject = null;
    element.object3D?.traverse((object) => {
      if (!textObject && object.textRenderInfo?.visibleBounds) textObject = object;
    });
    if (textObject) {
      const bounds = textObject.textRenderInfo.visibleBounds;
      if (bounds && bounds.length >= 4 && bounds.every(Number.isFinite)) {
        return { minX: bounds[0], minY: bounds[1], maxX: bounds[2], maxY: bounds[3] };
      }
    }
    return null;
  },

  makeContentRayTransparent: function () {
    // Raycaster intersections on child text entities do not deliver
    // non-bubbling mouseenter/mouseleave to the clickable button parent.
    // Keep the button's own rounded mesh (and its matching outline) raycastable
    // so hover and click resolve on the same .clickable entity.
    const buttonMesh = this.el.getObject3D('mesh');
    const contentElements = [this.data.label, this.data.accessory].filter(Boolean);
    contentElements.forEach((element) => {
      element.object3D?.traverse((object) => {
        if (!object.isMesh || object === buttonMesh || this.suppressedRaycastMeshes.has(object)) return;
        this.suppressedRaycastMeshes.set(object, object.raycast);
        object.raycast = function () {};
      });
    });
  },

  getAccessoryMetrics: function (element) {
    if (!element) return null;
    if (!element.object3D) return null;
    this.el.object3D.updateWorldMatrix(true, false);
    element.object3D.updateWorldMatrix(true, true);
    const worldBounds = new THREE.Box3().setFromObject(element.object3D);
    if (worldBounds.isEmpty()) return null;

    // Convert the actual rendered bounds (including the a-text width scale and
    // the 70% panel transform) back to the button's local space exactly once.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const corner = new THREE.Vector3();
    for (let ix = 0; ix < 2; ix++) {
      for (let iy = 0; iy < 2; iy++) {
        for (let iz = 0; iz < 2; iz++) {
          corner.set(
            ix ? worldBounds.max.x : worldBounds.min.x,
            iy ? worldBounds.max.y : worldBounds.min.y,
            iz ? worldBounds.max.z : worldBounds.min.z
          );
          this.el.object3D.worldToLocal(corner);
          minX = Math.min(minX, corner.x);
          maxX = Math.max(maxX, corner.x);
          minY = Math.min(minY, corner.y);
          maxY = Math.max(maxY, corner.y);
        }
      }
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
    return { minX, minY, maxX, maxY };
  },

  createOutline: function (width, height, radius, thickness) {
    const roundedPath = (w, h, r, reverse = false) => {
      const hw = w / 2, hh = h / 2;
      const shape = new THREE.Shape();
      if (!reverse) {
        shape.moveTo(-hw + r, -hh);
        shape.lineTo(hw - r, -hh);
        shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
        shape.lineTo(hw, hh - r);
        shape.quadraticCurveTo(hw, hh, hw - r, hh);
        shape.lineTo(-hw + r, hh);
        shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
        shape.lineTo(-hw, -hh + r);
        shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
      } else {
        // Reverse winding for the inner cutout of the border ring.
        shape.moveTo(-hw + r, hh);
        shape.lineTo(hw - r, hh);
        shape.quadraticCurveTo(hw, hh, hw, hh - r);
        shape.lineTo(hw, -hh + r);
        shape.quadraticCurveTo(hw, -hh, hw - r, -hh);
        shape.lineTo(-hw + r, -hh);
        shape.quadraticCurveTo(-hw, -hh, -hw, -hh + r);
        shape.lineTo(-hw, hh - r);
        shape.quadraticCurveTo(-hw, hh, -hw + r, hh);
      }
      return shape;
    };
    const ring = roundedPath(width, height, radius);
    const innerWidth = Math.max(0.01, width - thickness * 2);
    const innerHeight = Math.max(0.01, height - thickness * 2);
    ring.holes.push(roundedPath(innerWidth, innerHeight, Math.max(0, radius - thickness), true));
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(ring, 8),
      new THREE.MeshBasicMaterial({ color: '#ff2fd6', side: THREE.DoubleSide, toneMapped: false })
    );
    mesh.name = 'primary-button-rounded-outline';
    mesh.el = this.el;
    mesh.position.z = 0.009;
    return mesh;
  },

  tryLayout: function () {
    if (this.outline || !this.data.label) {
      if (this.layoutTimer) clearInterval(this.layoutTimer);
      this.layoutTimer = null;
      return;
    }
    this.makeContentRayTransparent();
    const label = this.data.label;
    const labelBounds = this.getTroikaMetrics(label);
    if (!labelBounds) {
      this.retryCount++;
      if (this.retryCount > 200) {
        clearInterval(this.layoutTimer);
        this.layoutTimer = null;
      }
      return;
    }

    const accessory = this.data.accessory;
    const accessoryBounds = this.getAccessoryMetrics(accessory);
    if (accessory && !accessoryBounds) return;
    const labelPosition = label.object3D.position;
    const accessoryPosition = accessory?.object3D.position;
    const originalLabel = this.originalPositions.has(label)
      ? this.originalPositions.get(label)
      : { x: labelPosition.x, y: labelPosition.y };
    if (!this.originalPositions.has(label)) this.originalPositions.set(label, originalLabel);
    const originalLabelX = originalLabel.x;
    let minX = originalLabelX + labelBounds.minX;
    let maxX = originalLabelX + labelBounds.maxX;
    let minY = labelBounds.minY;
    let maxY = labelBounds.maxY;

    let originalAccessory = { x: 0, y: 0 };
    if (accessory && accessoryBounds && accessoryPosition) {
      originalAccessory = this.originalPositions.has(accessory)
        ? this.originalPositions.get(accessory)
        : { x: accessoryPosition.x, y: accessoryPosition.y };
      if (!this.originalPositions.has(accessory)) this.originalPositions.set(accessory, originalAccessory);
      minX = Math.min(minX, accessoryBounds.minX);
      maxX = Math.max(maxX, accessoryBounds.maxX);
      minY = Math.min(minY, accessoryBounds.minY);
      maxY = Math.max(maxY, accessoryBounds.maxY);
    }

    const groupCenterX = (minX + maxX) / 2;
    const groupCenterY = (minY + maxY) / 2;
    labelPosition.x = originalLabelX - groupCenterX;
    labelPosition.y = originalLabel.y - groupCenterY;
    if (accessory && accessoryPosition && accessoryBounds) {
      accessoryPosition.x = originalAccessory.x - groupCenterX;
      accessoryPosition.y = originalAccessory.y - groupCenterY;
    }

    const scale = new THREE.Vector3();
    this.el.object3D.updateWorldMatrix(true, false);
    this.el.object3D.getWorldScale(scale);
    const worldScaleX = Math.max(0.001, Math.abs(scale.x));
    const worldScaleY = Math.max(0.001, Math.abs(scale.y));
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const width = contentWidth + (PRIMARY_BUTTON_LAYOUT.horizontalPadding * 2) / worldScaleX;
    const height = contentHeight + (PRIMARY_BUTTON_LAYOUT.verticalPadding * 2) / worldScaleY;
    const radius = Math.min(PRIMARY_BUTTON_LAYOUT.cornerRadius / worldScaleX, height / 2, width / 2);
    const borderThickness = PRIMARY_BUTTON_LAYOUT.outlineThickness / worldScaleX;

    this.el.setAttribute('geometry', {
      primitive: 'rounded-rect', width, height, radius
    });
    if (this.outline) {
      this.el.object3D.remove(this.outline);
      this.outline.geometry.dispose();
      this.outline.material.dispose();
    }
    this.outline = this.createOutline(width, height, radius, borderThickness);
    this.el.object3D.add(this.outline);
    clearInterval(this.layoutTimer);
    this.layoutTimer = null;
  },

  remove: function () {
    if (this.layoutTimer) clearInterval(this.layoutTimer);
    if (this.outline) {
      this.el.object3D.remove(this.outline);
      this.outline.geometry.dispose();
      this.outline.material.dispose();
    }
    this.suppressedRaycastMeshes?.forEach((raycast, mesh) => {
      mesh.raycast = raycast;
    });
    this.suppressedRaycastMeshes?.clear();
  }
});

AFRAME.registerComponent('ui-manager', {
  init: function () {
    this.welcomeScreen = document.querySelector('#welcomeScreen');
    this.startButton = document.querySelector('#startButton');
    this.instructionsScreen = document.querySelector('#instructionsScreen');
    this.instructionStartButton = document.querySelector('#instructionStartButton');
    this.countdownDisplay = document.querySelector('#countdownDisplay');
    this.countdownImageAssets = {
      'assets/ui/countdown_3.png': '#countdown3Texture',
      'assets/ui/countdown_2.png': '#countdown2Texture',
      'assets/ui/countdown_1.png': '#countdown1Texture',
      'assets/ui/countdown_GO.png': '#countdownGoTexture'
    };
    this.gameplayHud = document.querySelector('#reactionWall');
    this.gameOverPanel = document.querySelector('#gameOverPanel');
    this.gameOverPanelBackground = document.querySelector('#gameOverPanelBackground');
    this.gameOverGridTexture = null;
    this.welcomePanelBackground = document.querySelector('#welcomePanelBackground');
    this.instructionsPanelBackground = document.querySelector('#instructionsPanelBackground');
    this.spatialPanelGridTextures = new WeakMap();
    this.playAgainButton = document.querySelector('#playAgainButton');
    this.resultScoreText = document.querySelector('#resultScoreText');
    this.resultAccuracyText = document.querySelector('#resultAccuracyText');
    this.hands = [document.querySelector('#leftHand'), document.querySelector('#rightHand')];
    this.startingCountdown = false;
    this.startPressTimeout = null;
    this.playAgainStartTimeout = null;
    this.pendingCountdownStart = null;

    const sceneEl = this.el.sceneEl;
    this.syncPrimaryButtonClickability(sceneEl.components['game-manager']?.state || 'welcome');
    this.tracePlayAgainInput = (label, event) => {
      const detail = event.detail || {};
      const intersection = detail.intersection || detail.intersections?.[0];
      const object = intersection && intersection.object;
      const targetButton = event.target && (event.target.id === 'playAgainButton' || event.target.id === 'instructionStartButton')
        ? event.target
        : null;
      console.log(`[PLAY AGAIN DEBUG] ${label}`, {
        event: event.type,
        target: event.target && event.target.id,
        currentTarget: event.currentTarget && event.currentTarget.id,
        eventPhase: event.eventPhase,
        bubbles: event.bubbles,
        ray: detail.el && detail.el.id,
        intersectedEl: detail.intersectedEl && detail.intersectedEl.id,
        intersectionEntity: (intersection && intersection.el) || (object && object.el && object.el.id),
        intersectionObject: object && object.name,
        intersectedEntities: (detail.els || []).map((element) => element.id),
        cursorIntersectedEl: event.currentTarget?.components?.cursor?.intersectedEl?.id || null,
        cursorDownEl: event.currentTarget?.components?.cursor?.cursorDownEl?.id || null,
        raycasterIntersectedEls: event.currentTarget?.components?.raycaster?.intersectedEls?.map((element) => element.id) || [],
        targetVisible: targetButton ? targetButton.object3D.visible : undefined,
        targetScale: targetButton ? targetButton.getAttribute('scale') : undefined,
        ancestorVisibility: targetButton ? (() => {
          const ancestors = [];
          for (let node = targetButton; node && node !== sceneEl; node = node.parentElement) {
            ancestors.push({ id: node.id || node.tagName.toLowerCase(), visible: node.object3D?.visible });
          }
          return ancestors;
        })() : undefined,
        gameState: sceneEl.components['game-manager']?.state
      });
    };
    const diagnosticEvents = [
      'raycaster-intersection', 'raycaster-intersection-cleared',
      'raycaster-intersected', 'raycaster-intersected-cleared',
      'mouseenter', 'mouseleave', 'triggerdown', 'triggerup',
      'mousedown', 'mouseup', 'click'
    ];
    [this.instructionStartButton, this.playAgainButton].forEach((button) => {
      diagnosticEvents.forEach((eventName) => {
        button.addEventListener(eventName, (event) => {
          this.tracePlayAgainInput(`${button.id} ${eventName}`, event);
        });
      });
    });
    this.hands.forEach((hand) => {
      if (!hand) return;
      ['triggerdown', 'triggerup', 'mousedown', 'mouseup', 'click',
        'raycaster-intersection', 'raycaster-intersection-cleared'].forEach((eventName) => {
        hand.addEventListener(eventName, (event) => {
          this.tracePlayAgainInput(`${hand.id} ${eventName}`, event);
        });
      });
      ['triggerdown', 'triggerup'].forEach((eventName) => {
        hand.addEventListener(eventName, (event) => {
          this.tracePlayAgainInput(`${hand.id} ${eventName} capture-before-cursor`, event);
          queueMicrotask(() => console.log(`[PLAY AGAIN DEBUG] ${hand.id} ${eventName} after-dispatch`, {
            cursorIntersectedEl: hand.components.cursor?.intersectedEl?.id || null,
            cursorDownEl: hand.components.cursor?.cursorDownEl?.id || null,
            raycasterIntersectedEls: hand.components.raycaster?.intersectedEls?.map((element) => element.id) || [],
            playAgainVisible: this.playAgainButton.object3D.visible,
            gameOverPanelVisible: this.playAgainButton.parentElement?.object3D?.visible,
            gameState: sceneEl.components['game-manager']?.state
          }));
        }, true);
      });
    });

    const applySpatialPanelGrids = () => {
      this.applySpatialPanelGrid(this.welcomePanelBackground);
      this.applySpatialPanelGrid(this.instructionsPanelBackground);
    };
    if (sceneEl.hasLoaded) applySpatialPanelGrids();
    else sceneEl.addEventListener('loaded', applySpatialPanelGrids, { once: true });

    this.hoverAudioButtons = new Set();
    this.onStartButtonRayEnter = () => this.playButtonHoverSound(this.startButton);
    this.onStartButtonRayLeave = () => this.clearButtonHoverSound(this.startButton);
    this.startButton.addEventListener('raycaster-intersected', this.onStartButtonRayEnter);
    this.startButton.addEventListener('raycaster-intersected-cleared', this.onStartButtonRayLeave);

    this.startButton.addEventListener('mouseenter', () => {
      this.playButtonHoverSound(this.startButton);
      this.startButton.setAttribute('material', 'color', '#70205f');
      this.startButton.setAttribute('material', 'opacity', 1);
      this.startButton.setAttribute('scale', '1.035 1.08 1');
    });

    this.startButton.addEventListener('mouseleave', () => {
      this.clearButtonHoverSound(this.startButton);
      this.startButton.setAttribute('material', 'color', '#210a30');
      this.startButton.setAttribute('material', 'opacity', 0.98);
      this.startButton.setAttribute('scale', '1 1 1');
    });

    this.startButton.addEventListener('click', () => {
      const gameManager = this.el.sceneEl.components['game-manager'];
      gameManager.showInstructions();
    });

    this.instructionStartButton.addEventListener('mouseenter', () => {
      if (this.startingCountdown) return;
      this.playButtonHoverSound(this.instructionStartButton);
      this.instructionStartButton.setAttribute('material', 'color', '#70205f');
      this.instructionStartButton.setAttribute('material', 'opacity', 1);
      this.instructionStartButton.setAttribute('scale', '1.035 1.08 1');
    });

    this.instructionStartButton.addEventListener('mouseleave', () => {
      if (this.startingCountdown) return;
      this.clearButtonHoverSound(this.instructionStartButton);
      this.instructionStartButton.setAttribute('material', 'color', '#210a30');
      this.instructionStartButton.setAttribute('material', 'opacity', 0.98);
      this.instructionStartButton.setAttribute('scale', '1 1 1');
    });

    this.instructionStartButton.addEventListener('click', () => {
      if (this.startingCountdown) return;
      this.startingCountdown = true;
      this.queueCountdownStart('instructions');
    });

    this.playAgainHoverRays = new Set();
    this.playAgainIsHovered = false;
    this.setPlayAgainHover = (hovered) => {
      if (this.startingCountdown && hovered) return;
      console.log('[PLAY AGAIN DEBUG] hover-visual', { hovered, state: this.el.sceneEl.components['game-manager']?.state, startingCountdown: this.startingCountdown });
      this.playAgainButton.setAttribute('material', 'color', hovered ? '#70205f' : '#210a30');
      this.playAgainButton.setAttribute('material', 'opacity', hovered ? 1 : 0.98);
      this.playAgainButton.setAttribute('scale', hovered ? '1.035 1.08 1' : '1 1 1');
    };
    this.onPlayAgainRayEnter = (event) => {
      const ray = event.detail && event.detail.el;
      if (ray) this.playAgainHoverRays.add(ray);
      if (!this.playAgainIsHovered) this.playButtonHoverSound(this.playAgainButton);
      this.playAgainIsHovered = true;
      console.log('[PLAY AGAIN DEBUG] hover-enter', { target: event.target && event.target.id, state: this.el.sceneEl.components['game-manager']?.state });
      this.setPlayAgainHover(true);
    };
    this.onPlayAgainRayLeave = (event) => {
      const ray = event.detail && event.detail.el;
      if (ray) this.playAgainHoverRays.delete(ray);
      this.playAgainIsHovered = this.playAgainHoverRays.size > 0;
      if (!this.playAgainIsHovered) this.clearButtonHoverSound(this.playAgainButton);
      console.log('[PLAY AGAIN DEBUG] hover-exit', { target: event.target && event.target.id, state: this.el.sceneEl.components['game-manager']?.state });
      this.setPlayAgainHover(this.playAgainHoverRays.size > 0);
    };
    this.playAgainButton.addEventListener('raycaster-intersected', this.onPlayAgainRayEnter);
    this.playAgainButton.addEventListener('raycaster-intersected-cleared', this.onPlayAgainRayLeave);

    this.playAgainButton.addEventListener('mousedown', () => {
      if (this.startingCountdown) return;
      this.playAgainButton.setAttribute('material', 'color', '#ffffff');
      this.playAgainButton.setAttribute('scale', '0.97 0.9 1');
    });

    this.onPlayAgainAction = () => {
      console.log('[PLAY AGAIN DEBUG] ACTION HANDLER ENTERED', { target: this.playAgainButton.id, state: this.el.sceneEl.components['game-manager']?.state, startingCountdown: this.startingCountdown });
      if (this.startingCountdown) {
        console.log('[PLAY AGAIN DEBUG] click-blocked-starting', { state: this.el.sceneEl.components['game-manager']?.state });
        return;
      }
      const gameManager = this.el.sceneEl.components['game-manager'];
      if (!gameManager || gameManager.state !== 'gameover') {
        console.log('[PLAY AGAIN DEBUG] click-blocked-state', { state: gameManager?.state });
        return;
      }

      this.startingCountdown = true;
      const scene = this.el.sceneEl;
      const timer = scene.components['game-timer'];
      const score = scene.components['score-manager'];
      const spawner = document.querySelector('#environment').components['target-spawner'];

      // Leave Game Over immediately, then prepare the next run while the
      // dedicated delay preserves time for the click cue to be heard.
      console.log('[PLAY AGAIN DEBUG] before-restart-transition', { state: gameManager.state, startingCountdown: this.startingCountdown });
      gameManager.setState('restart-pending');
      console.log('[PLAY AGAIN DEBUG] state-after-restart-pending', { state: gameManager.state, startingCountdown: this.startingCountdown });
      console.log('[PLAY AGAIN DEBUG] timer-reset', { state: gameManager.state });
      if (timer) timer.reset();
      console.log('[PLAY AGAIN DEBUG] score-reset', { state: gameManager.state });
      if (score) score.reset();
      console.log('[PLAY AGAIN DEBUG] spawner-reset', { state: gameManager.state });
      if (spawner) spawner.reset();
      if (this.playAgainStartTimeout !== null) {
        console.log('[PLAY AGAIN DEBUG] timeout-cleared', { state: gameManager.state });
        clearTimeout(this.playAgainStartTimeout);
      }
      console.log('[PLAY AGAIN DEBUG] delay-start', { state: gameManager.state });
      this.playAgainStartTimeout = setTimeout(() => {
        this.playAgainStartTimeout = null;
        console.log('[PLAY AGAIN DEBUG] delay-complete', { state: gameManager.state, startingCountdown: this.startingCountdown });
        if (gameManager.state === 'restart-pending') {
          console.log('[PLAY AGAIN DEBUG] startCountdown-called', { state: gameManager.state });
          gameManager.startCountdown();
        }
      }, 300);
      console.log('[PLAY AGAIN DEBUG] timeout-created', { state: gameManager.state, timeout: this.playAgainStartTimeout });
    };
    this.onPlayAgainPhysicalClick = (event) => {
      const target = event.target;
      const clickedButton = target && typeof target.closest === 'function'
        ? target.closest('.clickable')
        : null;
      console.log('[PLAY AGAIN DEBUG] physical-click-event', {
        target: target && target.id,
        clickable: clickedButton && clickedButton.id,
        state: this.el.sceneEl.components['game-manager']?.state
      });
      if (clickedButton === this.playAgainButton) this.onPlayAgainAction();
    };
    // Match the scene-level capture path used by the generic click sound.
    // Controller click events can be observed here even when a button-level
    // listener does not receive the event through its target/bubble path.
    this.el.sceneEl.addEventListener('click', this.onPlayAgainPhysicalClick, true);

    this.onPlayAgainKeyDown = (event) => {
      if (event.key !== 'p' && event.key !== 'P' && event.code !== 'KeyP') return;
      const gameManager = this.el.sceneEl.components['game-manager'];
      if (!gameManager || gameManager.state !== 'gameover') return;
      console.log('[PLAY AGAIN DEBUG] P-KEY TEST', { state: gameManager.state, startingCountdown: this.startingCountdown });
      this.onPlayAgainAction();
    };
    document.addEventListener('keydown', this.onPlayAgainKeyDown);

    this.el.sceneEl.addEventListener('game-state-changed', (e) => {
      this.syncPrimaryButtonClickability(e.detail.state);
      if (e.detail.state !== 'instructions') {
        this.pendingCountdownStart = null;
        if (this.startPressTimeout !== null) {
          clearTimeout(this.startPressTimeout);
          this.startPressTimeout = null;
        }
      }
      if (e.detail.state !== 'gameover' && e.detail.state !== 'restart-pending' &&
          this.playAgainStartTimeout !== null) {
        console.log('[PLAY AGAIN DEBUG] timeout-cleared', { state: e.detail.state, timeout: this.playAgainStartTimeout });
        clearTimeout(this.playAgainStartTimeout);
        this.playAgainStartTimeout = null;
      }
      if (e.detail.state !== 'gameover') {
        if (e.detail.state === 'restart-pending') {
          console.log('[PLAY AGAIN DEBUG] restart-pending-ui-cleanup', { state: e.detail.state, timeout: this.playAgainStartTimeout });
        }
        this.playAgainHoverRays.clear();
        this.playAgainIsHovered = false;
        this.clearButtonHoverSound(this.playAgainButton);
        this.setPlayAgainHover(false);
      }
      if (e.detail.state !== 'countdown') {
        this.countdownDisplay.removeAttribute('animation__scalein');
        this.countdownDisplay.removeAttribute('animation__fadeout');
        this.countdownDisplay.setAttribute('visible', false);
        this.countdownDisplay.setAttribute('scale', '1 1 1');
        this.countdownDisplay.setAttribute('material', 'opacity', 1);
      }
      if (e.detail.state === 'instructions') {
        this.startingCountdown = false;
        this.welcomeScreen.setAttribute('visible', false);
        this.instructionsScreen.setAttribute('visible', true);
        this.gameplayHud.setAttribute('visible', false);
      }
      if (e.detail.state === 'countdown') {
        this.instructionsScreen.setAttribute('visible', false);
        this.countdownDisplay.setAttribute('visible', true);
        this.gameplayHud.setAttribute('visible', false);
      }
      if (e.detail.state === 'playing') {
        this.gameplayHud.setAttribute('visible', true);
        this.startingCountdown = false;
      }
      if (e.detail.state === 'gameover') {
        this.startingCountdown = false;
        this.showGameOverPanel();
      } else {
        this.gameOverPanel.setAttribute('visible', false);
      }
    });

    this.el.sceneEl.addEventListener('countdown-display', (e) => {
      this.showCountdownImage(e.detail);
    });
  },

  syncPrimaryButtonClickability: function (state) {
    const activeButtonId = {
      welcome: 'startButton',
      instructions: 'instructionStartButton',
      gameover: 'playAgainButton'
    }[state];
    [this.startButton, this.instructionStartButton, this.playAgainButton].forEach((button) => {
      button.classList.toggle('clickable', button.id === activeButtonId);
    });
  },

  playButtonHoverSound: function (button) {
    if (!button || !button.classList.contains('clickable') || this.hoverAudioButtons.has(button)) return;
    if (!this.isButtonAudioEligible(button)) return;
    this.hoverAudioButtons.add(button);
    const audio = this.el.sceneEl.components['countdown-voiceover'];
    if (!audio) return;

    const syncMenuMusic = () => {
      const gameManager = this.el.sceneEl.components['game-manager'];
      const state = gameManager && gameManager.state;
      if ((state === 'welcome' || state === 'instructions') && audio.idleMusicAllowed) {
        audio.syncMusicForState(state);
      }
    };
    syncMenuMusic();
    if (audio.playCue('button-hover', 0.16, 1)) return;

    // A first Welcome hover can precede the browser's first permitted audio
    // gesture. Reuse the audio manager's resume/preload path and retry only
    // while this same active button is still hovered.
    audio.unlockFromUserGesture().then(() => {
      syncMenuMusic();
      if (this.hoverAudioButtons.has(button) && this.isButtonAudioEligible(button)) {
        audio.playCue('button-hover', 0.16, 1);
      }
    });
  },

  isButtonAudioEligible: function (button) {
    if (!button || !button.classList.contains('clickable')) return false;
    for (let ancestor = button; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.object3D && !ancestor.object3D.visible) return false;
      if (ancestor === this.el.sceneEl) break;
    }
    return true;
  },

  clearButtonHoverSound: function (button) {
    if (button) this.hoverAudioButtons.delete(button);
  },

  queueCountdownStart: function (expectedState) {
    const gameManager = this.el.sceneEl.components['game-manager'];
    if (!gameManager || gameManager.state !== expectedState) return;

    // Replace any stale request so a previous timer cannot block this run.
    if (this.startPressTimeout !== null) {
      clearTimeout(this.startPressTimeout);
      this.startPressTimeout = null;
    }
    const pending = {
      expectedState,
      gameManager
    };
    this.pendingCountdownStart = pending;
    this.scheduleCountdownStart(pending);
  },

  scheduleCountdownStart: function (pending) {
    if (this.pendingCountdownStart !== pending) return;
    this.startPressTimeout = setTimeout(() => {
      this.startPressTimeout = null;
      if (this.pendingCountdownStart !== pending ||
          pending.gameManager.state !== pending.expectedState) return;
      this.pendingCountdownStart = null;
      pending.gameManager.startCountdown();
    }, 300);
  },

  showGameOverPanel: function () {
    const scoreComponent = this.el.sceneEl.components['score-manager'];
    if (scoreComponent) {
      this.resultScoreText.setAttribute(
        'troika-text',
        'value',
        String(scoreComponent.score).padStart(3, '0')
      );
      this.resultAccuracyText.setAttribute(
        'troika-text',
        'value',
        `${Math.round(scoreComponent.accuracy)}%`
      );
    }

    this.applyGameOverPanelGrid();

    const welcomeScreen = document.querySelector('#welcomeScreen');
    const panelParent = this.gameOverPanel.object3D.parent;
    if (welcomeScreen && panelParent) {
      welcomeScreen.object3D.updateWorldMatrix(true, false);
      panelParent.updateWorldMatrix(true, false);
      const worldPosition = new THREE.Vector3();
      const wallRotation = new THREE.Quaternion();
      welcomeScreen.object3D.getWorldPosition(worldPosition);
      const reactionWall = document.querySelector('#reactionWall');
      reactionWall?.object3D.updateWorldMatrix(true, false);
      reactionWall?.object3D.getWorldQuaternion(wallRotation);

      const wallNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(wallRotation);
      wallNormal.y = 0;
      wallNormal.normalize();

      this.gameOverPanel.object3D.position.copy(panelParent.worldToLocal(worldPosition));
      const panelYaw = Math.atan2(wallNormal.x, wallNormal.z);
      const worldRotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        panelYaw
      );
      const parentWorldRotation = panelParent.getWorldQuaternion(new THREE.Quaternion()).invert();
      this.gameOverPanel.object3D.quaternion.copy(parentWorldRotation.multiply(worldRotation));
      this.gameOverPanel.object3D.updateMatrixWorld(true);
    }

    this.gameOverPanel.setAttribute('visible', true);
  },

  applyGameOverPanelGrid: function () {
    if (this.gameOverGridTexture) return;
    const mesh = this.gameOverPanelBackground.getObject3D('mesh');
    if (!mesh || !mesh.material) return;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 336;
    const context = canvas.getContext('2d');
    const cornerRadius = 22;
    context.beginPath();
    context.moveTo(cornerRadius, 0);
    context.lineTo(canvas.width - cornerRadius, 0);
    context.quadraticCurveTo(canvas.width, 0, canvas.width, cornerRadius);
    context.lineTo(canvas.width, canvas.height - cornerRadius);
    context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - cornerRadius, canvas.height);
    context.lineTo(cornerRadius, canvas.height);
    context.quadraticCurveTo(0, canvas.height, 0, canvas.height - cornerRadius);
    context.lineTo(0, cornerRadius);
    context.quadraticCurveTo(0, 0, cornerRadius, 0);
    context.closePath();
    context.fillStyle = '#06112b';
    context.fill();
    context.save();
    context.clip();
    context.strokeStyle = '#14213c';
    context.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 16) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 16) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }
    context.restore();

    this.gameOverGridTexture = new THREE.CanvasTexture(canvas);
    mesh.material.map = this.gameOverGridTexture;
    mesh.material.color.set('#ffffff');
    mesh.material.needsUpdate = true;
  },

  applySpatialPanelGrid: function (background) {
    if (!background || this.spatialPanelGridTextures.has(background)) return;
    const mesh = background.getObject3D('mesh');
    if (!mesh || !mesh.material) return;

    const width = background.getAttribute('width') || 2;
    const height = background.getAttribute('height') || 1.5;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.max(1, Math.round(canvas.width * height / width));
    const context = canvas.getContext('2d');
    background.object3D.updateWorldMatrix(true, false);
    const worldScale = background.object3D.getWorldScale(new THREE.Vector3()).y;
    const physicalRadius = 0.12 * 0.7;
    const cornerRadius = Math.round(canvas.height * physicalRadius / (height * worldScale));
    context.beginPath();
    context.moveTo(cornerRadius, 0);
    context.lineTo(canvas.width - cornerRadius, 0);
    context.quadraticCurveTo(canvas.width, 0, canvas.width, cornerRadius);
    context.lineTo(canvas.width, canvas.height - cornerRadius);
    context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - cornerRadius, canvas.height);
    context.lineTo(cornerRadius, canvas.height);
    context.quadraticCurveTo(0, canvas.height, 0, canvas.height - cornerRadius);
    context.lineTo(0, cornerRadius);
    context.quadraticCurveTo(0, 0, cornerRadius, 0);
    context.closePath();
    context.fillStyle = '#06112b';
    context.fill();
    context.save();
    context.clip();
    context.strokeStyle = '#14213c';
    context.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 16) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 16) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }
    context.restore();

    const texture = new THREE.CanvasTexture(canvas);
    mesh.material.map = texture;
    mesh.material.color.set('#ffffff');
    mesh.material.needsUpdate = true;
    this.spatialPanelGridTextures.set(background, texture);
  },

  showCountdownImage: function (step) {
    // Hide and reset the previous image before replacing its source so a
    // finishing fade animation cannot affect the next countdown state.
    this.countdownDisplay.setAttribute('visible', false);
    this.countdownDisplay.removeAttribute('animation__scalein');
    this.countdownDisplay.removeAttribute('animation__fadeout');
    this.countdownDisplay.setAttribute('material', 'opacity', 0);
    this.countdownDisplay.setAttribute('scale', '1 1 1');

    this.countdownDisplay.setAttribute('src', this.countdownImageAssets[step.src] || step.src);
    this.countdownDisplay.setAttribute('width', step.width);
    this.countdownDisplay.setAttribute('height', step.height);
    this.countdownDisplay.setAttribute('material', 'opacity', 1);
    this.countdownDisplay.setAttribute('scale', '0.8 0.8 0.8');
    this.countdownDisplay.setAttribute('visible', true);
    this.countdownDisplay.setAttribute('animation__scalein', {
      property: 'scale',
      from: '0.8 0.8 0.8',
      to: '1 1 1',
      dur: 260,
      easing: 'easeOutBack'
    });
    this.countdownDisplay.setAttribute('animation__fadeout', {
      property: 'material.opacity',
      from: 1,
      to: 0,
      delay: step.fadeDelay,
      dur: step.duration - step.fadeDelay,
      easing: 'linear'
    });

    const countdownVoiceover = this.el.sceneEl.components['countdown-voiceover'];
    if (countdownVoiceover) countdownVoiceover.playForImage(step.src);
  },

  tick: function () {
    const scene = this.el.sceneEl;
    const hasVisibleInteractiveUI = Array.from(scene.querySelectorAll('.clickable'))
      .some((element) => this.isVisible(element, scene));

    this.hands.forEach((hand) => {
      if (hand && hand.components.raycaster) {
        if (hand.components.raycaster.data.enabled !== hasVisibleInteractiveUI) {
          hand.setAttribute('raycaster', 'enabled', hasVisibleInteractiveUI);
        }
      }
    });
  },

  isVisible: function (element, scene) {
    let current = element;
    while (current && current !== scene) {
      if (current.getAttribute('visible') === false ||
          (current.object3D && !current.object3D.visible)) {
        return false;
      }
      current = current.parentElement;
    }
    return current === scene;
  },

  remove: function () {
    if (this.onPlayAgainPhysicalClick) {
      this.el.sceneEl.removeEventListener('click', this.onPlayAgainPhysicalClick, true);
    }
    if (this.onPlayAgainKeyDown) {
      document.removeEventListener('keydown', this.onPlayAgainKeyDown);
    }
    if (this.playAgainStartTimeout !== null) {
      clearTimeout(this.playAgainStartTimeout);
      this.playAgainStartTimeout = null;
    }
  }
});
