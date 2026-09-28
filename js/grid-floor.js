AFRAME.registerComponent('grid-floor', {
  init: function () {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Dark base
    ctx.fillStyle = '#04040a';
    ctx.fillRect(0, 0, 512, 512);

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 151, 178, 0.075)';
    ctx.lineWidth = 1;
    const cellSize = 64;
    for (let i = 0; i <= 512; i += cellSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // A few dimmer cross bands retain depth cues without competing with targets.
    ctx.strokeStyle = 'rgba(0, 151, 178, 0.04)';
    ctx.lineWidth = 2;
    for (let i = 32; i < 512; i += 128) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);

    const mesh = this.el.getObject3D('mesh');
    mesh.material.map = texture;
    mesh.material.needsUpdate = true;
  }
});
