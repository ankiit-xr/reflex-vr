AFRAME.registerComponent('environment-details', {
  init: function () {
    // Batched box modules add layered detail with a small, fixed draw-call cost.
    const specs = {
      structure: { color: '#1a2638', roughness: 0.72, metalness: 0.38 },
      recess: { color: '#091321', roughness: 0.88, metalness: 0.16 },
      panel: { color: '#202d40', roughness: 0.68, metalness: 0.34 },
      grille: { color: '#344357', roughness: 0.78, metalness: 0.32 },
      conduit: { color: '#273448', roughness: 0.65, metalness: 0.4 },
      cyanMark: { color: '#075064', roughness: 0.55, metalness: 0.28 },
      magentaMark: { color: '#49253f', roughness: 0.62, metalness: 0.25 }
    };
    const batches = Object.fromEntries(Object.keys(specs).map((key) => [key, []]));
    this.statusIndicators = [];
    const add = (kind, x, y, z, sx, sy, sz) => {
      batches[kind].push({ x, y, z, sx, sy, sz });
    };
    const addStatus = (x, y, z, color, phase, rate) => {
      this.statusIndicators.push({
        x, y, z,
        sx: 0.016,
        sy: 0.045,
        sz: 0.045,
        baseColor: new THREE.Color(color),
        phase,
        rate
      });
    };

    // Three large modular bays per side. Existing columns and recessed wall
    // sections form each bay's outer frame; these layers sit toward the room.
    const bayCenters = [-5.05, -1.75, 1.55];
    for (const side of [-1, 1]) {
      const inwardX = side * 2.49;
      const faceX = side * 2.405;
      bayCenters.forEach((z, bay) => {
        add('recess', inwardX, 1.5, z, 0.075, 1.42, 1.72);
        add('panel', faceX, 1.5, z, 0.055, 1.2, 1.48);

        // Layered perimeter plates and short brackets tie each module to its bay.
        for (const dz of [-0.78, 0.78]) {
          add('structure', side * 2.36, 1.5, z + dz, 0.08, 1.48, 0.075);
        }
        for (const y of [0.78, 2.22]) {
          add('structure', side * 2.36, y, z, 0.08, 0.075, 1.62);
        }
        add('structure', side * 2.32, 0.94, z - 0.52, 0.12, 0.09, 0.26);
        add('structure', side * 2.32, 2.06, z + 0.52, 0.12, 0.09, 0.26);

        if (bay === 0) {
          // Deep vent recess with seven low-profile horizontal slats.
          add('recess', side * 2.315, 1.48, z, 0.018, 0.62, 1.02);
          for (let row = 0; row < 7; row++) {
            add('grille', side * 2.292, 1.21 + row * 0.09, z, 0.022, 0.025, 0.86);
          }
          add('cyanMark', side * 2.285, 1.91, z + 0.43, 0.012, 0.14, 0.025);
        } else if (bay === 1) {
          // Dark technical housing, divided into abstract unlit control blocks.
          add('recess', side * 2.315, 1.55, z, 0.02, 0.72, 0.96);
          add('panel', side * 2.285, 1.72, z, 0.028, 0.34, 0.78);
          add('grille', side * 2.265, 1.22, z - 0.18, 0.018, 0.035, 0.52);
          add('grille', side * 2.265, 1.22, z - 0.06, 0.018, 0.035, 0.52);
          add('grille', side * 2.265, 1.22, z + 0.06, 0.018, 0.035, 0.52);
          add('cyanMark', side * 2.26, 1.94, z + 0.31, 0.015, 0.035, 0.035);
          add('cyanMark', side * 2.26, 1.94, z + 0.20, 0.015, 0.035, 0.035);
        } else {
          // Split mechanical bay: vent lower section, service housing above.
          add('recess', side * 2.315, 1.18, z, 0.02, 0.48, 0.98);
          for (let row = 0; row < 5; row++) {
            add('grille', side * 2.29, 1.02 + row * 0.075, z, 0.02, 0.022, 0.82);
          }
          add('panel', side * 2.315, 1.88, z + 0.12, 0.06, 0.43, 0.8);
          add('structure', side * 2.27, 1.88, z + 0.55, 0.04, 0.46, 0.05);
          add(bay === 2 ? 'magentaMark' : 'cyanMark', side * 2.26, 2.16, z + 0.46, 0.014, 0.06, 0.035);
        }
      });

      // Small, non-text equipment indicators; each gets its own slow phase.
      const phases = side < 0 ? [0.2, 1.6, 3.3, 4.7, 5.8] : [0.9, 2.4, 3.8, 5.2, 6.1];
      const panelIndicatorZ = [-1.96, -1.75, -1.54];
      panelIndicatorZ.forEach((z, i) => {
        addStatus(side * 2.245, 1.78, z, side < 0 ? '#31cbe5' : '#d65ab8', phases[i], 0.48 + i * 0.035);
      });
      [-5.34, -5.05, -4.76].forEach((z, i) => {
        addStatus(side * 2.245, 2.06, z, '#31cbe5', phases[(i + 2) % phases.length], 0.42 + i * 0.04);
      });
      [1.25, 1.47].forEach((z, i) => {
        addStatus(side * 2.245, 2.13, z, i === 0 && side > 0 ? '#d65ab8' : '#31cbe5', phases[(i + 3) % phases.length], 0.46 + i * 0.03);
      });

      // Conduits run with the frames and are secured by repeated brackets.
      for (const z of [-6.7, -3.4, -0.1, 2.6]) {
        add('conduit', side * 2.54, 1.5, z + 0.22, 0.052, 2.46, 0.06);
        for (const y of [0.55, 1.5, 2.45]) {
          add('structure', side * 2.48, y, z + 0.22, 0.16, 0.06, 0.13);
        }
        // Short elbow and junction housing connect the upright run to the header.
        add('conduit', side * 2.62, 2.68, z + 0.22, 0.2, 0.07, 0.07);
        add('panel', side * 2.63, 2.52, z + 0.22, 0.22, 0.18, 0.24);
      }

      // A ceiling/wall junction conduit follows the room's long axis.
      add('conduit', side * 2.69, 2.68, -2.5, 0.07, 0.07, 9.2);
      for (const z of [-6.7, -3.4, -0.1, 2.6]) {
        add('structure', side * 2.69, 2.68, z, 0.18, 0.12, 0.1);
      }

      // Recessed ceiling service panels remain at the edges, leaving a dark center.
      for (const z of [-5.05, -1.75, 1.55]) {
        add('recess', side * 1.98, 2.93, z, 1.02, 0.035, 1.55);
        add('structure', side * 1.98, 2.89, z - 0.72, 0.94, 0.025, 0.045);
        add('structure', side * 1.98, 2.89, z + 0.72, 0.94, 0.025, 0.045);
        for (let slot = 0; slot < 5; slot++) {
          add('grille', side * (1.66 + slot * 0.16), 2.885, z, 0.025, 0.02, 0.78);
        }
      }

      // Floor service plates stay within the outer side lanes, away from targets.
      for (const z of [-7.8, -4.8, -1.8, 1.2, 4.2]) {
        add('recess', side * 2.43, 0.012, z, 0.86, 0.025, 2.5);
        add('structure', side * 2.43, 0.029, z - 1.19, 0.72, 0.012, 0.035);
        add('structure', side * 2.43, 0.029, z + 1.19, 0.72, 0.012, 0.035);
      }
    }

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const dummy = new THREE.Object3D();
    this.meshes = [];
    for (const [key, spec] of Object.entries(specs)) {
      const items = batches[key];
      if (!items.length) continue;
      const material = new THREE.MeshStandardMaterial({
        color: spec.color,
        roughness: spec.roughness,
        metalness: spec.metalness
      });
      const mesh = new THREE.InstancedMesh(geometry, material, items.length);
      mesh.name = `environment-details-${key}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      items.forEach((item, index) => {
        dummy.position.set(item.x, item.y, item.z);
        dummy.quaternion.identity();
        dummy.scale.set(item.sx, item.sy, item.sz);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.el.object3D.add(mesh);
      this.meshes.push(mesh);
    }

    if (this.statusIndicators.length) {
      const ledMaterial = new THREE.MeshBasicMaterial({
        color: '#ffffff',
        toneMapped: false
      });
      const ledMesh = new THREE.InstancedMesh(geometry, ledMaterial, this.statusIndicators.length);
      ledMesh.name = 'environment-status-indicators';
      ledMesh.castShadow = false;
      ledMesh.receiveShadow = false;
      this.statusIndicators.forEach((indicator, index) => {
        dummy.position.set(indicator.x, indicator.y, indicator.z);
        dummy.scale.set(indicator.sx, indicator.sy, indicator.sz);
        dummy.updateMatrix();
        ledMesh.setMatrixAt(index, dummy.matrix);
        ledMesh.setColorAt(index, indicator.baseColor.clone().multiplyScalar(0.55));
      });
      ledMesh.instanceMatrix.needsUpdate = true;
      if (ledMesh.instanceColor) ledMesh.instanceColor.needsUpdate = true;
      this.el.object3D.add(ledMesh);
      this.meshes.push(ledMesh);
      this.ledMesh = ledMesh;
      this.ledColor = new THREE.Color();
      this.lastStatusUpdate = -Infinity;
    }
  },

  tick: function (time) {
    if (!this.ledMesh || time - this.lastStatusUpdate < 100) return;
    this.lastStatusUpdate = time;
    this.statusIndicators.forEach((indicator, index) => {
      const wave = (Math.sin(time * 0.001 * indicator.rate + indicator.phase) + 1) * 0.5;
      const brightness = 0.42 + wave * 0.34;
      this.ledColor.copy(indicator.baseColor).multiplyScalar(brightness);
      this.ledMesh.setColorAt(index, this.ledColor);
    });
    this.ledMesh.instanceColor.needsUpdate = true;
  },

  remove: function () {
    if (!this.meshes) return;
    this.meshes.forEach((mesh) => {
      this.el.object3D.remove(mesh);
      mesh.material.dispose();
    });
  }
});
