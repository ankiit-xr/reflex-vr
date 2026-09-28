AFRAME.registerComponent('env-neon', {
  schema: {
    color: { type: 'color', default: '#00c9e8' }
  },

  init: function () {
    this.applied = false;
    this.applyToMesh = this.applyToMesh.bind(this);
    this.el.addEventListener('object3dset', this.applyToMesh);
    this.el.addEventListener('loaded', this.applyToMesh);
    this.applyToMesh();
  },

  applyToMesh: function () {
    if (this.applied) return;
    const mesh = this.el.getObject3D('mesh');
    if (!mesh || !mesh.material || !mesh.geometry) return;

    // Keep the source strip as the crisp, bright core.
    mesh.material = mesh.material.clone();
    if (mesh.material.emissive) {
      mesh.material.emissive.set(this.data.color);
      mesh.material.emissiveIntensity = 1.35;
      mesh.material.needsUpdate = true;
    }

    // One low-opacity additive shell per selected strip; widen its cross-section
    // while preserving the strip's long axis to avoid a broad transparent panel.
    const glowGeometry = mesh.geometry.clone();
    glowGeometry.computeBoundingBox();
    const size = new THREE.Vector3();
    glowGeometry.boundingBox.getSize(size);
    const longAxis = size.x >= size.y && size.x >= size.z ? 'x'
      : size.y >= size.z ? 'y' : 'z';
    const expansion = { x: 2.2, y: 2.2, z: 2.2 };
    expansion[longAxis] = 1.035;
    glowGeometry.scale(expansion.x, expansion.y, expansion.z);

    const glow = new THREE.Mesh(glowGeometry, new THREE.MeshBasicMaterial({
      color: this.data.color,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    }));
    glow.position.copy(mesh.position);
    glow.quaternion.copy(mesh.quaternion);
    glow.scale.copy(mesh.scale);
    glow.renderOrder = 1;
    this.el.object3D.add(glow);
    this.glow = glow;
    this.applied = true;
  },

  remove: function () {
    this.el.removeEventListener('object3dset', this.applyToMesh);
    this.el.removeEventListener('loaded', this.applyToMesh);
    if (this.glow) {
      this.el.object3D.remove(this.glow);
      this.glow.geometry.dispose();
      this.glow.material.dispose();
    }
  }
});
