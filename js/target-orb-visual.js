// Lightweight, decorative layers attached beside (not inside) the gameplay mesh.
const targetOrbVisualResources = (() => {
  const cyan = new THREE.Color('#00e5ff');
  return {
    sphere: new THREE.SphereGeometry(0.12, 12, 10),
    detailBox: new THREE.BoxGeometry(1, 1, 1),
    particleSphere: new THREE.SphereGeometry(1, 6, 4),
    glowMaterial: new THREE.MeshBasicMaterial({
      color: cyan, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false
    }),
    shellMaterial: new THREE.MeshBasicMaterial({
      color: cyan, transparent: true, opacity: 0.22, wireframe: true,
      depthWrite: false, toneMapped: false
    }),
    cyanDetail: new THREE.MeshBasicMaterial({ color: cyan, toneMapped: false }),
    particleSoft: new THREE.MeshBasicMaterial({
      color: cyan, transparent: true, opacity: 0.48, depthWrite: false, toneMapped: false
    }),
    particleBright: new THREE.MeshBasicMaterial({
      color: cyan, transparent: true, opacity: 0.78, depthWrite: false, toneMapped: false
    })
  };
})();

AFRAME.registerComponent('target-orb-visual', {
  init: function () {
    const r = targetOrbVisualResources;
    this.visual = new THREE.Group();
    this.visual.scale.setScalar(0.6);
    this.el.setObject3D('target-orb-visual', this.visual);

    const glow = new THREE.Mesh(r.sphere, r.glowMaterial);
    glow.scale.setScalar(1.1);
    glow.renderOrder = -1;
    this.visual.add(glow);

    const shell = new THREE.Mesh(r.sphere, r.shellMaterial);
    shell.scale.setScalar(1.025);
    this.visual.add(shell);

    this.addReticleDetails();
    this.particleTransform = new THREE.Object3D();
    this.addParticles();
    this.elapsed = Math.random() * Math.PI * 2;
  },

  addReticleDetails: function () {
    const r = targetOrbVisualResources;
    const bars = [];
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      const radius = 0.148;
      bars.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        angle,
        length: i % 2 === 0 ? 0.025 : 0.014
      });
    }
    const mesh = new THREE.InstancedMesh(r.detailBox, r.cyanDetail, bars.length);
    const transform = new THREE.Object3D();
    bars.forEach((bar, index) => {
      transform.position.set(bar.x, bar.y, 0);
      transform.rotation.z = bar.angle;
      transform.scale.set(bar.length, 0.0035, 0.0035);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.visual.add(mesh);

    const centerMarker = new THREE.Mesh(r.particleSphere, r.cyanDetail);
    centerMarker.scale.setScalar(0.012);
    centerMarker.position.set(0.155, 0, 0.005);
    this.visual.add(centerMarker);
  },

  addParticles: function () {
    const r = targetOrbVisualResources;
    const count = 10;
    this.particles = [
      new THREE.InstancedMesh(r.particleSphere, r.particleSoft, 5),
      new THREE.InstancedMesh(r.particleSphere, r.particleBright, 5)
    ];
    this.particleState = [];
    const transform = this.particleTransform;
    for (let i = 0; i < count; i += 1) {
      const state = {
        phase: (Math.PI * 2 * i) / count + Math.random() * 0.3,
        radius: 0.13 + Math.random() * 0.02,
        height: (Math.random() - 0.5) * 0.09,
        speed: 0.22 + Math.random() * 0.18,
        size: 0.007 + Math.random() * 0.007,
        layer: i % 2,
        instance: Math.floor(i / 2)
      };
      this.particleState.push(state);
      this.particles[state.layer].setColorAt(state.instance, r.particleSoft.color);
      transform.position.set(Math.cos(state.phase) * state.radius, state.height, Math.sin(state.phase) * state.radius);
      transform.scale.setScalar(state.size);
      transform.updateMatrix();
      this.particles[state.layer].setMatrixAt(state.instance, transform.matrix);
    }
    this.particles.forEach((particles) => {
      particles.instanceMatrix.needsUpdate = true;
      this.visual.add(particles);
    });
  },

  tick: function (time, timeDelta) {
    const dt = Math.min(Math.max(timeDelta || 0, 0), 50) / 1000;
    this.elapsed += dt;

    const transform = this.particleTransform;
    this.particleState.forEach((particle) => {
      const angle = particle.phase + this.elapsed * particle.speed;
      transform.position.set(
        Math.cos(angle) * particle.radius,
        particle.height + Math.sin(angle * 0.7) * 0.012,
        Math.sin(angle) * particle.radius
      );
      transform.scale.setScalar(particle.size);
      transform.updateMatrix();
      this.particles[particle.layer].setMatrixAt(particle.instance, transform.matrix);
    });
    this.particles.forEach((particles) => { particles.instanceMatrix.needsUpdate = true; });
  },

  remove: function () {
    this.el.removeObject3D('target-orb-visual');
  }
});
