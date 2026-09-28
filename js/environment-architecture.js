/* Static, reusable architecture for the industrial neon tunnel. */
AFRAME.registerComponent('architectural-tunnel', {
  init: function () {
    this.objects = [];
    const scene = this.el.object3D;
    const addBoxBatch = (name, color, roughness, metalness, boxes) => {
      if (!boxes.length) return;
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      const mesh = new THREE.InstancedMesh(geometry, material, boxes.length);
      mesh.name = name;
      const dummy = new THREE.Object3D();
      boxes.forEach((box, i) => {
        dummy.position.set(box.x, box.y, box.z);
        dummy.rotation.set(box.rx || 0, box.ry || 0, box.rz || 0);
        dummy.scale.set(box.w, box.h, box.d);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
      this.objects.push(mesh);
    };

    // The five arch modules share precisely one geometry and one physical scale.
    // Their 2.6 m rhythm spans the 10.4 m between the rear and reaction walls.
    const archPoints = [
      [-2.70, 0.14], [-2.70, 2.22], [-2.68, 2.36], [-2.61, 2.49],
      [-2.49, 2.61], [-2.36, 2.68], [-2.22, 2.70], [2.22, 2.70],
      [2.36, 2.68], [2.49, 2.61], [2.61, 2.49], [2.68, 2.36], [2.70, 2.22],
      [2.70, 0.14]
    ].map(([x, y]) => new THREE.Vector3(x, y, 0));
    const archCurve = new THREE.CatmullRomCurve3(archPoints, false, 'centripetal');
    const structuralGeometry = new THREE.TubeGeometry(archCurve, 96, 0.105, 8, false);
    const coreGeometry = new THREE.TubeGeometry(archCurve, 96, 0.043, 8, false);
    const glowGeometry = new THREE.TubeGeometry(archCurve, 96, 0.145, 8, false);
    const structureMaterial = new THREE.MeshStandardMaterial({ color: '#111b2c', roughness: 0.62, metalness: 0.58 });
    const coreMaterials = [
      new THREE.MeshBasicMaterial({ color: '#00d9ff', toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: '#ec26ce', toneMapped: false })
    ];
    const glowMaterials = [
      new THREE.MeshBasicMaterial({ color: '#00cfff', transparent: true, opacity: 0.105, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: '#df20c5', transparent: true, opacity: 0.095, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    ];
    const frameDepths = [2.55, -0.05, -2.65, -5.25, -7.85];
    frameDepths.forEach((z, index) => {
      const frame = new THREE.Group();
      frame.name = `same-size-architectural-arch-${index + 1}`;
      frame.position.z = z;
      const colorIndex = index === 1 || index === 3 ? 1 : 0;
      const backing = new THREE.Mesh(structuralGeometry, structureMaterial);
      backing.position.z = -0.045;
      frame.add(backing);
      const glow = new THREE.Mesh(glowGeometry, glowMaterials[colorIndex]);
      glow.position.z = 0.012;
      frame.add(glow);
      const core = new THREE.Mesh(coreGeometry, coreMaterials[colorIndex]);
      core.position.z = 0.018;
      frame.add(core);
      scene.add(frame);
      this.objects.push(frame);
    });
    this.objects.push({ dispose: () => {
      structuralGeometry.dispose(); coreGeometry.dispose(); glowGeometry.dispose();
      structureMaterial.dispose(); coreMaterials.forEach((m) => m.dispose());
      glowMaterials.forEach((m) => m.dispose());
    } });

    const frameDepthsForDetails = [-7.85, -5.25, -2.65, -0.05, 2.55];
    const structure = [];
    const darkPanel = [];
    const metal = [];
    const vent = [];
    const add = (list, x, y, z, w, h, d, rx, ry, rz) => list.push({ x, y, z, w, h, d, rx, ry, rz });

    // Repeated wall posts, shadowed recesses, service plates and brackets.
    for (const side of [-1, 1]) {
      for (let bay = 0; bay < 4; bay++) {
        const z = -6.55 + bay * 2.72;
        add(structure, side * 2.88, 1.5, z, 0.18, 2.92, 0.16);
        add(structure, side * 2.73, 1.5, z, 0.08, 2.62, 0.25);
        add(darkPanel, side * 2.62, 1.52, z + 1.05, 0.08, 1.6, 1.22);
        add(metal, side * 2.55, 1.50, z + 1.05, 0.045, 1.43, 1.02);
        add(structure, side * 2.51, 0.70, z + 1.05, 0.12, 0.065, 1.12);
        add(structure, side * 2.51, 2.31, z + 1.05, 0.12, 0.065, 1.12);
        // Narrow horizontal louvers in two of every four bays.
        if (bay === 0 || bay === 2) {
          for (let row = 0; row < 5; row++) {
            add(vent, side * 2.485, 1.02 + row * 0.14, z + 1.05, 0.022, 0.035, 0.76);
          }
        }
        // A small service box and paired brackets provide depth without screens/text.
        add(darkPanel, side * 2.50, 1.88, z + 0.34, 0.035, 0.32, 0.56);
        add(metal, side * 2.47, 1.66, z + 0.34, 0.028, 0.035, 0.34);
        add(structure, side * 2.47, 0.52, z + 0.20, 0.10, 0.08, 0.28);
        add(structure, side * 2.47, 2.47, z + 0.20, 0.10, 0.08, 0.28);
      }
      // Two depth-running upper service pipes sit at the wall/ceiling junction.
      [2.50, 2.67].forEach((y, i) => {
        const pipe = new THREE.Mesh(
          new THREE.CylinderGeometry(i === 0 ? 0.072 : 0.042, i === 0 ? 0.072 : 0.042, 10.1, 10),
          new THREE.MeshStandardMaterial({ color: i === 0 ? '#27364a' : '#172438', roughness: 0.4, metalness: 0.72 })
        );
        pipe.name = `longitudinal-upper-conduit-${side}-${i}`;
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(side * (i === 0 ? 2.72 : 2.86), y, -2.35);
        scene.add(pipe);
        this.objects.push(pipe);
        for (const z of [-6.6, -4.0, -1.4, 1.2]) {
          const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.055, 10), new THREE.MeshStandardMaterial({ color: '#35445a', roughness: 0.42, metalness: 0.7 }));
          clamp.rotation.x = Math.PI / 2;
          clamp.position.set(pipe.position.x, y, z);
          scene.add(clamp);
          this.objects.push(clamp);
        }
      });
      // Repeated ceiling modules remain at the edges, keeping the central view dark.
      for (const z of frameDepthsForDetails) {
        add(darkPanel, side * 1.73, 2.965, z, 1.46, 0.045, 1.84);
        add(structure, side * 1.73, 2.925, z - 0.82, 1.34, 0.04, 0.055);
        add(structure, side * 1.73, 2.925, z + 0.82, 1.34, 0.04, 0.055);
        for (let slot = 0; slot < 4; slot++) {
          add(vent, side * (1.28 + slot * 0.28), 2.91, z, 0.10, 0.018, 0.72);
        }
      }
    }

    // Rear closure: matching structural bays and a same-size arch just inside the wall.
    add(darkPanel, 0, 1.5, 2.91, 5.7, 2.82, 0.06);
    for (const x of [-2.78, -1.85, 1.85, 2.78]) {
      add(structure, x, 1.5, 2.84, 0.15, 2.94, 0.18);
    }
    for (const y of [0.18, 0.48, 2.52, 2.82]) {
      add(structure, 0, y, 2.84, 5.76, 0.09, 0.18);
    }
    for (const x of [-2.28, -1.45, 1.45, 2.28]) {
      add(darkPanel, x, 1.52, 2.86, 0.66, 1.7, 0.035);
      add(metal, x, 1.52, 2.82, 0.025, 1.34, 0.02);
    }

    addBoxBatch('tunnel-structural-bays', '#152238', 0.62, 0.62, structure);
    addBoxBatch('tunnel-recessed-service-panels', '#081321', 0.82, 0.38, darkPanel);
    addBoxBatch('tunnel-raised-metal-modules', '#26374d', 0.46, 0.68, metal);
    addBoxBatch('tunnel-vent-louvers', '#31445a', 0.66, 0.58, vent);

    // Separate longitudinal floor-edge accents; the arch geometry never crosses the floor.
    [-2.78, 2.78].forEach((x, i) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 10.45), new THREE.MeshBasicMaterial({ color: i === 0 ? '#00bedd' : '#d92ab9', toneMapped: false }));
      strip.position.set(x, 0.025, -2.38);
      scene.add(strip);
      this.objects.push(strip);
    });
  },

  remove: function () {
    if (!this.objects) return;
    this.objects.forEach((object) => {
      if (object.dispose) { object.dispose(); return; }
      this.el.object3D.remove(object);
      object.traverse((child) => {
        if (child.geometry && child.geometry !== this.sharedGeometry) child.geometry.dispose?.();
      });
      if (object.material) object.material.dispose();
    });
  }
});

AFRAME.registerComponent('industrial-floor', {
  init: function () {
    // World-space plate batches sit just above the existing floor, with varied
    // engineered tile widths/lengths and dark gaps instead of a bright grid.
    const plates = [];
    const vents = [];
    const floorGaps = [];
    const rowLengths = [1.35, 0.9, 1.55, 1.05, 1.25, 1.45, 1.0, 1.45];
    let z = 3.05;
    let row = 0;
    while (z > -8.05) {
      const d = rowLengths[row % rowLengths.length];
      const centerZ = z - d / 2;
      const cuts = row % 2 === 0 ? [-2.76, -1.04, 0.58, 2.76] : [-2.76, -0.72, 1.18, 2.76];
      for (let col = 0; col < cuts.length - 1; col++) {
        const x0 = cuts[col], x1 = cuts[col + 1];
        const inset = 0.022;
        const w = x1 - x0 - inset * 2;
        const tileX = (x0 + x1) / 2;
        plates.push({ x: tileX, z: centerZ, w, d: d - 0.035 });
        if (col < cuts.length - 2) {
          floorGaps.push({ x: x1, z: centerZ, length: d - 0.035, axis: 'z' });
        }
        if ((row + col * 2) % 7 === 1 && Math.abs(tileX) > 1.65) {
          for (let slat = 0; slat < 5; slat++) {
            vents.push({ x: tileX, y: 0.039, z: centerZ - 0.22 + slat * 0.11, w: Math.min(w * 0.58, 0.48), h: 0.008, d: 0.025 });
          }
        }
      }
      z -= d;
      if (z > -8.05) floorGaps.push({ x: 0, z, length: 5.52, axis: 'x' });
      row++;
    }

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const dummy = new THREE.Object3D();
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#101a2a', roughness: 0.56, metalness: 0.52 }), plates.length);
    mesh.name = 'industrial-floor-varied-metal-plates';
    plates.forEach((p, i) => {
      dummy.position.set(p.x, 0.021, p.z);
      dummy.scale.set(p.w, 0.035, p.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const shade = 0.82 + ((i * 17) % 9) * 0.025;
      mesh.setColorAt(i, new THREE.Color('#101a2a').multiplyScalar(shade));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    this.el.sceneEl.object3D.add(mesh);

    const ventMesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#07101d', roughness: 0.78, metalness: 0.35 }), vents.length);
    ventMesh.name = 'industrial-floor-recessed-vent-slats';
    vents.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(p.w, p.h, p.d);
      dummy.updateMatrix();
      ventMesh.setMatrixAt(i, dummy.matrix);
    });
    ventMesh.instanceMatrix.needsUpdate = true;
    this.el.sceneEl.object3D.add(ventMesh);
    const floorGlowGeometry = geometry;
    const floorCore = new THREE.InstancedMesh(
      floorGlowGeometry,
      new THREE.MeshBasicMaterial({ color: '#0089a4', toneMapped: false }),
      floorGaps.length
    );
    const floorGlow = new THREE.InstancedMesh(
      floorGlowGeometry,
      new THREE.MeshBasicMaterial({
        color: '#00c9e8',
        transparent: true,
        opacity: 0.10,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      }),
      floorGaps.length
    );
    floorCore.name = 'industrial-floor-recessed-cyan-gap-lights';
    floorGlow.name = 'industrial-floor-recessed-cyan-gap-glow';
    floorGaps.forEach((gap, i) => {
      const alongX = gap.axis === 'x';
      dummy.position.set(gap.x, 0.0018, gap.z);
      dummy.scale.set(alongX ? gap.length : 0.012, 0.0012, alongX ? 0.010 : gap.length);
      dummy.updateMatrix();
      floorCore.setMatrixAt(i, dummy.matrix);
      dummy.scale.set(alongX ? gap.length * 1.035 : 0.0264, 0.00264, alongX ? 0.022 : gap.length * 1.035);
      dummy.updateMatrix();
      floorGlow.setMatrixAt(i, dummy.matrix);
    });
    floorCore.instanceMatrix.needsUpdate = true;
    floorGlow.instanceMatrix.needsUpdate = true;
    this.el.sceneEl.object3D.add(floorCore);
    this.el.sceneEl.object3D.add(floorGlow);
    this.meshes = [mesh, ventMesh, floorCore, floorGlow];
    this.geometry = geometry;
  },
  remove: function () {
    this.meshes?.forEach((mesh) => {
      this.el.sceneEl.object3D.remove(mesh);
      mesh.material.dispose();
    });
    this.geometry?.dispose();
  }
});
