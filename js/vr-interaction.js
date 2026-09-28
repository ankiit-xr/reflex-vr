AFRAME.registerComponent('controller-hand-orientation', {
  init: function () {
    this.correctedMesh = null;
    this.onObject3DSet = () => this.correctHandModel();
    this.el.addEventListener('object3dset', this.onObject3DSet);
    this.correctHandModel();
  },

  correctHandModel: function () {
    const handModel = this.el.getObject3D('mesh');
    if (!handModel || handModel === this.correctedMesh) return;

    // The hand model's fingers use local +Y; rotate them onto controller forward (-Z).
    handModel.rotation.x -= Math.PI / 2;
    // Add only a slight visual downward wrist angle; the controller entity and
    // its ray remain unchanged.
    handModel.rotation.x -= THREE.MathUtils.degToRad(10);
    this.correctedMesh = handModel;
  },

  remove: function () {
    this.el.removeEventListener('object3dset', this.onObject3DSet);
  }
});

AFRAME.registerComponent('punchable', {
  init: function () {
    this.controllerPositions = [];
    this.orbPosition = new THREE.Vector3();
    this.controllerPos = new THREE.Vector3();
    this.meshWorldScale = new THREE.Vector3();
    this.isHit = false;
    this.resolutionState = 'active';
    this.feedback = null;

    const leftHand = document.querySelector('#leftHand');
    const rightHand = document.querySelector('#rightHand');
    if (leftHand) this.controllerPositions.push(leftHand);
    if (rightHand) this.controllerPositions.push(rightHand);

  },

  tick: function (time, timeDelta) {
    if (this.resolutionState !== 'active') {
      if (this.feedback) this.updateFeedback(timeDelta);
      return;
    }

    const meshObject = this.el.getObject3D('mesh');
    if (!meshObject) return;

    const geometry = meshObject.geometry;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    this.orbPosition.copy(geometry.boundingSphere.center);
    meshObject.localToWorld(this.orbPosition);
    meshObject.getWorldScale(this.meshWorldScale);
    const worldScale = Math.max(
      Math.abs(this.meshWorldScale.x),
      Math.abs(this.meshWorldScale.y),
      Math.abs(this.meshWorldScale.z)
    );
    const hitRadius = geometry.boundingSphere.radius * worldScale;
    const hitRadiusSquared = hitRadius * hitRadius;

    for (const hand of this.controllerPositions) {
      hand.object3D.getWorldPosition(this.controllerPos);
      if (this.orbPosition.distanceToSquared(this.controllerPos) <= hitRadiusSquared) {
        this.registerHit();
        break;
      }
    }
  },

  registerHit: function () {
    if (this.resolutionState !== 'active') return;
    this.resolutionState = 'hit';
    this.isHit = true;
    this.playHitEffect();
    this.el.emit('orb-punched', {}, true);
  },

  registerMiss: function () {
    if (this.resolutionState !== 'active') return false;
    this.resolutionState = 'miss';
    this.isHit = true;
    this.playMissEffect();
    return true;
  },

  playHitEffect: function () {
    const meshObject = this.el.getObject3D('mesh');
    if (!meshObject) return;

    const material = meshObject.material;
    const originalEmissive = material.emissive ? material.emissive.clone() : null;
    const flashEmissive = new THREE.Color(0x9affff);
    const startScale = meshObject.scale.clone();
    const startOpacity = material.opacity;

    if (!material.transparent) {
      material.transparent = true;
      material.needsUpdate = true;
    }
    if (originalEmissive) material.emissive.copy(flashEmissive);

    this.feedback = {
      type: 'hit',
      elapsed: 0,
      duration: 280,
      meshObject,
      material,
      startScale,
      startOpacity,
      originalEmissive,
      flashEmissive
    };
  },

  playMissEffect: function () {
    const meshObject = this.el.getObject3D('mesh');
    if (!meshObject) return;

    const material = meshObject.material;
    const originalColor = material.color ? material.color.clone() : null;
    const originalEmissive = material.emissive ? material.emissive.clone() : null;
    const missColor = new THREE.Color(0xff2b78);
    const startScale = meshObject.scale.clone();
    const startOpacity = material.opacity;

    if (!material.transparent) {
      material.transparent = true;
      material.needsUpdate = true;
    }
    this.feedback = {
      type: 'miss',
      elapsed: 0,
      duration: 280,
      meshObject,
      material,
      startScale,
      startOpacity,
      originalColor,
      originalEmissive,
      missColor
    };
  },

  updateFeedback: function (timeDelta) {
    const feedback = this.feedback;
    if (!feedback || this.resolutionState !== feedback.type) return;

    feedback.elapsed = Math.min(
      feedback.elapsed + Math.max(0, timeDelta || 0),
      feedback.duration
    );
    const progress = feedback.elapsed / feedback.duration;
    const { meshObject, material, startScale, startOpacity } = feedback;

    if (feedback.type === 'hit') {
      const flashEnd = 0.18;
      const growthEnd = 0.62;
      const fadeStart = 0.78;
      const growthProgress = Math.max(0, Math.min(
        (progress - flashEnd) / (growthEnd - flashEnd),
        1
      ));
      const growthEase = 1 - Math.pow(1 - growthProgress, 3);
      const scale = 1 + growthEase * 0.5;
      const flashFade = growthProgress;
      const fade = Math.max(0, (progress - fadeStart) / (1 - fadeStart));

      meshObject.scale.set(
        startScale.x * scale,
        startScale.y * scale,
        startScale.z * scale
      );
      material.opacity = startOpacity * (1 - fade);
      if (feedback.originalEmissive) {
        material.emissive.copy(feedback.flashEmissive)
          .lerp(feedback.originalEmissive, flashFade);
      }
    } else {
      const colorProgress = Math.min(progress / 0.22, 1);
      const shrinkProgress = Math.min(progress / 0.68, 1);
      const shrinkEase = 1 - Math.pow(1 - shrinkProgress, 2);
      const fade = Math.max(0, (progress - 0.58) / 0.42);
      const scale = 1 - shrinkEase * 0.08;

      meshObject.scale.set(
        startScale.x * scale,
        startScale.y * scale,
        startScale.z * scale
      );
      if (feedback.originalColor) {
        material.color.copy(feedback.originalColor).lerp(feedback.missColor, colorProgress);
      }
      if (feedback.originalEmissive) {
        material.emissive.copy(feedback.missColor).lerp(feedback.originalEmissive, fade);
      }
      material.opacity = startOpacity * (1 - fade);
    }

    if (feedback.elapsed >= feedback.duration) {
      this.feedback = null;
      this.el.setAttribute('visible', false);
    }
  },

  clearFeedback: function () {
    this.resolutionState = 'cleared';
    this.feedback = null;
    this.el.setAttribute('visible', false);
  },

  remove: function () {
    this.resolutionState = 'cleared';
    this.feedback = null;
  }
});
