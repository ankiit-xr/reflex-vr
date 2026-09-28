AFRAME.registerComponent('particles', {
  init: function () {
    const count = 36;
    const positions = new Float32Array(count * 3);
    const opacities = new Float32Array(count);
    const sizes = new Float32Array(count);
    const shapes = new Float32Array(count);
    const rotations = new Float32Array(count);

    this.state = [];
    for (let i = 0; i < count; i++) {
      const particle = this.randomParticle(i < Math.round(count * 0.4));
      this.state.push(particle);
      this.writePosition(positions, i, this.state[i]);
      opacities[i] = 0;
      sizes[i] = particle.size;
      shapes[i] = particle.isTriangle ? 1 : 0;
      rotations[i] = particle.rotation;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aShape', new THREE.BufferAttribute(shapes, 1));
    geometry.setAttribute('aRotation', new THREE.BufferAttribute(rotations, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xff2fd6) } },
      vertexShader: `
        attribute float aOpacity;
        attribute float aSize;
        attribute float aShape;
        attribute float aRotation;
        varying float vOpacity;
        varying float vShape;
        varying float vRotation;
        void main() {
          vOpacity = aOpacity;
          vShape = aShape;
          vRotation = aRotation;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 5.0 + aSize;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vOpacity;
        varying float vShape;
        varying float vRotation;
        void main() {
          vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
          float edgeAlpha = 1.0;
          if (vShape > 0.5) {
            float c = cos(vRotation);
            float s = sin(vRotation);
            point = mat2(c, -s, s, c) * point;
            float triangleEdge = min(point.y + 0.52, 0.94 - abs(point.x) * 1.68 - point.y);
            if (abs(point.x) > 0.87 || triangleEdge < 0.0) discard;
            edgeAlpha = smoothstep(0.0, 0.12, triangleEdge);
          } else {
            float dist = length(point);
            if (dist > 1.0) discard;
            edgeAlpha = 1.0 - smoothstep(0.86, 1.0, dist);
          }
          gl_FragColor = vec4(uColor, vOpacity * edgeAlpha);
        }
      `,
      transparent: true,
      depthWrite: false
    });

    this.points = new THREE.Points(geometry, material);
    this.el.setObject3D('particles', this.points);
  },

  // Keep particles in side margins, slightly inboard of the walls and clear of the HUD wall.
  randomX: function () {
    const side = Math.random() < 0.5 ? -1 : 1;
    return side * (1.7 + Math.random() * 0.65);
  },

  randomParticle: function (isTriangle = Math.random() < 0.4) {
    return {
      baseX: this.randomX(),
      baseY: Math.random() * 2.5 + 0.2,
      baseZ: -Math.random() * 3.4 - 2.4, // side lanes from z=-5.8 through z=-2.4
      driftSpeed: 0.35 + Math.random() * 0.25, // tunnel movement, toward the player
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      freqX: 0.15 + Math.random() * 0.15,
      freqY: 0.1 + Math.random() * 0.1,
      amplitude: 0.08 + Math.random() * 0.08,
      isTriangle,
      size: Math.random() * 1.2,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.18,
      age: Math.random() * 6,
      lifespan: 6 + Math.random() * 6
    };
  },

  writePosition: function (positions, i, p) {
    positions[i * 3] = p.baseX;
    positions[i * 3 + 1] = p.baseY;
    positions[i * 3 + 2] = p.baseZ;
  },

  tick: function (time, timeDelta) {
    const dt = timeDelta / 1000;
    const positions = this.points.geometry.attributes.position.array;
    const opacities = this.points.geometry.attributes.aOpacity.array;
    const t = time / 1000;
    let shapeAttributesChanged = false;

    for (let i = 0; i < this.state.length; i++) {
      let p = this.state[i];
      p.age += dt;
      p.rotation += p.rotationSpeed * dt;

      // Continuous side-lane drift toward the player, wrapping before the HUD wall.
      p.baseZ += p.driftSpeed * dt;
      if (p.baseZ > 3) {
        p.baseZ = -5.8;
        p.baseX = this.randomX(); // fresh horizontal position on each loop
      }

      if (p.age >= p.lifespan) {
        const fresh = this.randomParticle();
        fresh.baseZ = p.baseZ; // keep tunnel position continuous, don't jump
        fresh.age = 0;
        this.state[i] = fresh;
        p = fresh;
        this.points.geometry.attributes.aShape.array[i] = p.isTriangle ? 1 : 0;
        this.points.geometry.attributes.aSize.array[i] = p.size;
        shapeAttributesChanged = true;
      }

      positions[i * 3]     = p.baseX + Math.sin(t * p.freqX + p.phaseX) * p.amplitude;
      positions[i * 3 + 1] = p.baseY + Math.sin(t * p.freqY + p.phaseY) * p.amplitude * 0.6;
      positions[i * 3 + 2] = p.baseZ;
      this.points.geometry.attributes.aRotation.array[i] = p.rotation;

      const lifeRatio = p.age / p.lifespan;
      let opacity;
      if (lifeRatio < 0.2) {
        opacity = lifeRatio / 0.2;
      } else if (lifeRatio > 0.8) {
        opacity = (1 - lifeRatio) / 0.2;
      } else {
        opacity = 1;
      }
      opacities[i] = opacity * 0.28;
    }

    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.aOpacity.needsUpdate = true;
    if (shapeAttributesChanged) {
      this.points.geometry.attributes.aShape.needsUpdate = true;
      this.points.geometry.attributes.aSize.needsUpdate = true;
    }
    this.points.geometry.attributes.aRotation.needsUpdate = true;
  }
});
