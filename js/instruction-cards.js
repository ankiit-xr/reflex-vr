// Shared, lightweight Three.js compositions for the four world-space tutorial cards.
const INSTRUCTION_CARD = Object.freeze({
  width: 0.72,
  height: 0.72,
  halfWidth: 0.36,
  halfHeight: 0.36
});

const instructionCardResources = (() => {
  const cyan = new THREE.Color('#00dff5');
  const magenta = new THREE.Color('#e83bc5');
  const ice = new THREE.Color('#d8faff');
  const makeMaterial = (color, opacity = 1, blending = THREE.NormalBlending) => new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    blending,
    depthWrite: opacity >= 1,
    toneMapped: false,
    side: THREE.DoubleSide
  });

  return {
    box: new THREE.BoxGeometry(1, 1, 1),
    plane: new THREE.PlaneGeometry(1, 1),
    sphere: new THREE.SphereGeometry(1, 16, 12),
    torus: new THREE.TorusGeometry(1, 0.024, 4, 32),
    backing: makeMaterial('#071322', 0.74),
    backingInset: makeMaterial('#10243a', 0.24),
    cyan: makeMaterial(cyan, 0.9, THREE.AdditiveBlending),
    cyanSoft: makeMaterial(cyan, 0.3, THREE.AdditiveBlending),
    magenta: makeMaterial(magenta, 0.82, THREE.AdditiveBlending),
    magentaSoft: makeMaterial(magenta, 0.28, THREE.AdditiveBlending),
    ice: makeMaterial(ice, 0.82, THREE.AdditiveBlending),
    grid: makeMaterial(cyan, 0.13),
    orbCyan: makeMaterial(cyan),
    orbMagenta: makeMaterial(magenta),
    orbCyanGlow: makeMaterial(cyan, 0.2, THREE.AdditiveBlending),
    orbMagentaGlow: makeMaterial(magenta, 0.18, THREE.AdditiveBlending)
  };
})();

AFRAME.registerComponent('instruction-card', {
  schema: {
    number: { default: '01' },
    heading: { default: 'LOOK' },
    body: { default: '' },
    accent: { default: '#e83bc5' },
    illustration: { default: 'look' }
  },

  init: function () {
    this.group = new THREE.Group();
    this.el.setObject3D('instruction-card', this.group);
    this.primaryBars = [];
    this.secondaryBars = [];
    this.gridBars = [];
    this.accent = this.data.accent.toLowerCase() === '#00dff5'
      ? instructionCardResources.cyan
      : instructionCardResources.magenta;
    this.secondary = this.accent === instructionCardResources.cyan
      ? instructionCardResources.magenta
      : instructionCardResources.cyan;

    this.buildBackingAndFrame();
    this.buildIllustration();
    this.buildTechnicalDetails();
    this.addBatchedBars(this.primaryBars, this.accent);
    this.addBatchedBars(this.secondaryBars, this.secondary);
    this.addBatchedBars(this.gridBars, instructionCardResources.grid);
    this.addCardText();
  },

  buildBackingAndFrame: function () {
    const r = instructionCardResources;
    const backing = new THREE.Mesh(r.plane, r.backing);
    backing.scale.set(INSTRUCTION_CARD.width, INSTRUCTION_CARD.height, 1);
    backing.position.z = 0.001;
    this.group.add(backing);

    const inset = new THREE.Mesh(r.plane, r.backingInset);
    inset.scale.set(0.67, 0.64, 1);
    inset.position.set(0, -0.015, 0.002);
    this.group.add(inset);

    // Repeated segmented rails with clipped corners leave breathing room around copy.
    const p = this.primaryBars;
    const s = this.secondaryBars;
    const railY = 0.346;
    [-0.23, 0.23].forEach((x) => {
      p.push({ x, y: railY, w: 0.2, h: 0.004, z: 0.012 });
      p.push({ x, y: -railY, w: 0.2, h: 0.004, z: 0.012 });
    });
    [-0.345, 0.345].forEach((x) => {
      [-0.245, 0.245].forEach((y) => p.push({ x, y, w: 0.004, h: 0.15, z: 0.012 }));
    });
    [-1, 1].forEach((sx) => [-1, 1].forEach((sy) => {
      s.push({ x: sx * 0.325, y: sy * 0.326, w: 0.075, h: 0.004, angle: sy * sx * Math.PI / 4, z: 0.013 });
    }));
    s.push({ x: 0, y: railY, w: 0.045, h: 0.006, z: 0.013 });
    s.push({ x: 0, y: -railY, w: 0.06, h: 0.004, z: 0.013 });
  },

  buildTechnicalDetails: function () {
    const p = this.primaryBars;
    const s = this.secondaryBars;
    const grid = this.gridBars;

    // A fine, dim grid stays behind each illustration and away from the text blocks.
    [-0.2, -0.1, 0, 0.1, 0.2].forEach((x) => grid.push({ x, y: -0.025, w: 0.0015, h: 0.29, z: 0.006 }));
    [-0.13, -0.06, 0.01, 0.08, 0.15].forEach((y) => grid.push({ x: 0, y, w: 0.58, h: 0.0015, z: 0.006 }));

    // Small repeated status marks and narrow technical seams.
    [-0.295, -0.28, -0.265].forEach((x, index) => s.push({ x, y: 0.305, w: 0.006, h: index === 1 ? 0.022 : 0.012, z: 0.014 }));
    [-0.11, 0, 0.11].forEach((x) => p.push({ x, y: -0.337, w: 0.055, h: 0.0025, z: 0.014 }));
    p.push({ x: -0.325, y: 0.08, w: 0.0025, h: 0.055, z: 0.014 });
    p.push({ x: 0.325, y: -0.08, w: 0.0025, h: 0.055, z: 0.014 });
  },

  buildIllustration: function () {
    if (this.data.illustration === 'look') this.buildLookIllustration();
    if (this.data.illustration === 'react') this.buildReactIllustration();
    if (this.data.illustration === 'score') this.buildScoreIllustration();
    if (this.data.illustration === 'sharp') this.buildSharpIllustration();
  },

  buildLookIllustration: function () {
    this.addTarget(0, -0.015, 0.035, 0.047, false);
    [0.083, 0.112, 0.145].forEach((radius, index) => {
      this.addRing(index === 1 ? this.secondary : instructionCardResources.cyan, 0, -0.015, radius, 0.026 + index * 0.001);
    });
    this.addRadialTicks(0, -0.015, 0.163, 12, instructionCardResources.cyan);
    this.addIndicator(-0.18, 0.105, instructionCardResources.magenta);
    this.addIndicator(0.18, 0.07, instructionCardResources.cyan);
    this.addIndicator(0.15, -0.135, instructionCardResources.magenta);
  },

  buildReactIllustration: function () {
    const r = instructionCardResources;
    // A compact pointing-hand silhouette built from shared low-poly boxes.
    this.addSolidBox(-0.16, 0.005, 0.045, 0.064, 0.018, r.cyan);
    this.addSolidBox(-0.091, 0.018, 0.105, 0.016, 0.016, r.ice);
    this.addSolidBox(-0.139, -0.042, 0.06, 0.014, 0.015, r.cyan, -0.28);
    this.addSolidBox(-0.175, 0.052, 0.018, 0.038, 0.015, r.cyan);
    this.addSolidBox(-0.15, 0.056, 0.018, 0.03, 0.015, r.cyan);
    this.addSolidBox(-0.12, 0.052, 0.018, 0.026, 0.015, r.cyan);

    this.primaryBars.push({ x: 0.005, y: 0.02, w: 0.065, h: 0.0035, z: 0.025 });
    this.primaryBars.push({ x: 0.037, y: 0.02, w: 0.018, h: 0.0035, angle: Math.PI / 4, z: 0.026 });
    this.primaryBars.push({ x: 0.037, y: 0.02, w: 0.018, h: 0.0035, angle: -Math.PI / 4, z: 0.026 });
    [-0.09, -0.065, -0.04].forEach((x, i) => this.secondaryBars.push({ x, y: -0.067 - i * 0.014, w: 0.048, h: 0.0025, z: 0.02 }));

    this.addTarget(0.145, 0.02, 0.04, 0.036, true);
    this.addRing(r.cyan, 0.145, 0.02, 0.078, 0.025);
    this.addRing(r.magenta, 0.145, 0.02, 0.102, 0.024);
    this.addRadialTicks(0.145, 0.02, 0.116, 8, r.cyan);
  },

  buildScoreIllustration: function () {
    const r = instructionCardResources;
    this.addTarget(-0.025, -0.008, 0.028, 0.035, true);
    this.addRing(r.magenta, -0.025, -0.008, 0.066, 0.027);
    this.addRing(r.cyan, -0.025, -0.008, 0.093, 0.025);
    this.addRadialTicks(-0.025, -0.008, 0.109, 10, r.magenta);
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      const radius = i % 2 ? 0.132 : 0.146;
      this.secondaryBars.push({
        x: -0.025 + Math.cos(angle) * radius,
        y: -0.008 + Math.sin(angle) * radius,
        w: 0.018,
        h: 0.003,
        angle,
        z: 0.029
      });
    }
    this.addIndicator(0.16, 0.13, r.cyan);
    this.addIndicator(0.19, -0.08, r.magenta);
    this.addText('+1', 0.125, 0.075, 0.032, '#00e5ff', 'center', 'center', 0.13);
  },

  buildSharpIllustration: function () {
    const r = instructionCardResources;
    const targets = [
      { x: -0.145, y: 0.055, z: 0.018, radius: 0.026, magenta: false },
      { x: 0.005, y: -0.015, z: 0.035, radius: 0.037, magenta: true },
      { x: 0.145, y: 0.075, z: 0.052, radius: 0.023, magenta: false }
    ];
    targets.forEach((target) => {
      this.addTarget(target.x, target.y, target.z, target.radius, target.magenta);
      this.addRing(target.magenta ? r.magenta : r.cyan, target.x, target.y, target.radius * 1.7, target.z - 0.002);
    });
    [-0.18, -0.155, -0.13].forEach((x, index) => this.primaryBars.push({
      x,
      y: -0.095 - index * 0.018,
      w: 0.07,
      h: 0.0025,
      z: 0.022
    }));
    this.addRadialTicks(-0.145, 0.055, 0.052, 4, r.cyan);
    this.addRadialTicks(0.145, 0.075, 0.048, 4, r.magenta);
    this.addIndicator(-0.055, 0.125, r.cyan);
    this.addIndicator(0.075, -0.13, r.magenta);
  },

  addTarget: function (x, y, z, radius, magenta) {
    const r = instructionCardResources;
    const glow = new THREE.Mesh(r.sphere, magenta ? r.orbMagentaGlow : r.orbCyanGlow);
    glow.position.set(x, y, z);
    glow.scale.setScalar(radius * 1.7);
    this.group.add(glow);
    const orb = new THREE.Mesh(r.sphere, magenta ? r.orbMagenta : r.orbCyan);
    orb.position.set(x, y, z + 0.002);
    orb.scale.setScalar(radius);
    this.group.add(orb);
  },

  addRing: function (material, x, y, radius, z) {
    const ring = new THREE.Mesh(instructionCardResources.torus, material);
    ring.position.set(x, y, z);
    ring.scale.setScalar(radius);
    this.group.add(ring);
  },

  addSolidBox: function (x, y, w, h, d, material, angle = 0) {
    const mesh = new THREE.Mesh(instructionCardResources.box, material);
    mesh.position.set(x, y, 0.027);
    mesh.rotation.z = angle;
    mesh.scale.set(w, h, d);
    this.group.add(mesh);
  },

  addIndicator: function (x, y, material) {
    const indicator = new THREE.Mesh(instructionCardResources.sphere, material);
    indicator.position.set(x, y, 0.027);
    indicator.scale.setScalar(0.006);
    this.group.add(indicator);
  },

  addRadialTicks: function (x, y, radius, count, material) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count;
      const primary = material === this.accent ? this.primaryBars : this.secondaryBars;
      primary.push({
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        w: 0.014,
        h: 0.0025,
        angle,
        z: 0.021
      });
    }
  },

  addBatchedBars: function (specs, material) {
    if (!specs.length) return;
    const mesh = new THREE.InstancedMesh(instructionCardResources.box, material, specs.length);
    const transform = new THREE.Object3D();
    specs.forEach((spec, index) => {
      transform.position.set(spec.x, spec.y, spec.z || 0.016);
      transform.rotation.set(0, 0, spec.angle || 0);
      transform.scale.set(spec.w, spec.h, spec.d || 0.003);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.group.add(mesh);
  },

  addText: function (value, x, y, size, color, align, anchor, maxWidth, lineHeight = 1.15) {
    const text = document.createElement('a-entity');
    text.setAttribute('position', `${x} ${y} 0.035`);
    text.setAttribute('troika-text',
      `value: ${value}; font: #ethnocentricFont; font-size: ${size}; color: ${color}; align: ${align}; anchor: ${anchor}; max-width: ${maxWidth}; white-space: normal; line-height: ${lineHeight}`);
    this.el.appendChild(text);
    return text;
  },

  addCardText: function () {
    const headingSize = this.data.heading.length > 7 ? 0.052 : 0.067;
    this.addText(this.data.number, -0.297, 0.306, 0.022, this.data.accent, 'left', 'left', 0.09);
    this.addText(this.data.heading, 0, 0.235, headingSize, this.data.accent, 'center', 'center', 0.62);
    const bodySize = this.data.illustration === 'sharp' ? 0.036 :
      (this.data.illustration === 'score' ? 0.037 : 0.039);
    this.addText(this.data.body, 0, -0.25, bodySize, '#eafaff', 'center', 'center', 0.6, 1.3);
  },

  remove: function () {
    this.el.removeObject3D('instruction-card');
  }
});
