const targetPlacementMarkerResources = (() => ({
  geometry: new THREE.TorusGeometry(0.045, 0.004, 5, 24),
  material: new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false
  })
}))();

AFRAME.registerComponent('target-placement-markers', {
  init: function () {
    this.markerGroups = [];
    this.visible = false;
    this.onGameStateChanged = (event) => {
      this.setMarkersVisible(event.detail.state === 'playing');
    };
    this.el.sceneEl.addEventListener('game-state-changed', this.onGameStateChanged);

    this.createMarkers = () => {
      if (this.markerGroups.length) return;
      const spawner = this.el.components['target-spawner'];
      if (!spawner || !Array.isArray(spawner.slots)) return;

      const resources = targetPlacementMarkerResources;
      spawner.slots.forEach((slot) => {
        const marker = new THREE.Group();
        marker.position.set(slot.x, slot.y, slot.z);
        marker.visible = this.visible;

        const ring = new THREE.Mesh(resources.geometry, resources.material);
        ring.renderOrder = 1;
        marker.add(ring);
        this.el.object3D.add(marker);
        marker.lookAt(spawner.playerWorldPosition);
        this.markerGroups.push(marker);
      });
    };

    if (this.el.sceneEl.hasLoaded) this.createMarkers();
    else this.el.sceneEl.addEventListener('loaded', this.createMarkers, { once: true });
  },

  setMarkersVisible: function (visible) {
    this.visible = visible;
    this.markerGroups.forEach((marker) => { marker.visible = visible; });
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('game-state-changed', this.onGameStateChanged);
    this.el.sceneEl.removeEventListener('loaded', this.createMarkers);
    this.markerGroups.forEach((marker) => this.el.object3D.remove(marker));
    this.markerGroups.length = 0;
    targetPlacementMarkerResources.geometry.dispose();
    targetPlacementMarkerResources.material.dispose();
  }
});
