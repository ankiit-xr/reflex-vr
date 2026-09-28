AFRAME.registerComponent('tracked-controller-ray', {
  schema: {
    hand: { default: 'right' }
  },

  init: function () {
    this.origin = new THREE.Vector3();
    this.direction = new THREE.Vector3(0, 0, -1);
    this.rotation = new THREE.Quaternion();
    this.raycaster = this.el.components.raycaster;

    this.el.setAttribute('raycaster', 'useWorldCoordinates', false);
    this.el.setAttribute('raycaster', 'origin', { x: 0, y: 0, z: 0 });
    this.el.setAttribute('raycaster', 'direction', { x: 0, y: 0, z: -1 });
    this.raycaster = this.el.components.raycaster;
  },

  tick: function () {
    if (!this.raycaster) {
      this.raycaster = this.el.components.raycaster;
      if (!this.raycaster) return;
    }

    // Keep the ray local to this controller entity. A-Frame applies the
    // controller's world transform to the raycaster, and the visible line
    // uses these same local coordinates below.
    const data = this.raycaster.data;
    data.origin.x = 0;
    data.origin.y = 0;
    data.origin.z = 0;
    data.direction.x = 0;
    data.direction.y = 0;
    data.direction.z = -1;
  }
});

AFRAME.registerComponent('laser-pointer', {
  init: function () {
    this.raycaster = this.el.components.raycaster;
    this.start = new THREE.Vector3();
    this.end = new THREE.Vector3();
    this.directionVector = new THREE.Vector3();
  },

  tick: function () {
    if (!this.raycaster) {
      this.raycaster = this.el.components.raycaster;
      return;
    }

    // Keep A-Frame's internal line hidden; this component draws the configured
    // ray so UI state can remove the visual cleanly.
    if (this.raycaster.data.showLine) {
      this.el.setAttribute('raycaster', 'showLine', false);
    }

    if (!this.raycaster.data.enabled) {
      this.el.removeAttribute('line');
      return;
    }

    const origin = this.raycaster.data.origin || { x: 0, y: 0, z: 0 };
    const direction = this.raycaster.data.direction || { x: 0, y: 0, z: -1 };
    const intersections = this.raycaster.intersections;
    const length = intersections.length > 0
      ? intersections[0].distance
      : this.raycaster.data.far;

    this.start.set(origin.x, origin.y, origin.z);
    this.directionVector.set(direction.x, direction.y, direction.z);
    this.end.copy(this.start).addScaledVector(this.directionVector, length);
    this.el.setAttribute('line', {
      start: `${this.start.x} ${this.start.y} ${this.start.z}`,
      end: `${this.end.x} ${this.end.y} ${this.end.z}`,
      color: '#00e5ff',
      opacity: 0.6
    });
  }
});
