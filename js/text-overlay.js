// text-overlay.js
let fabricCanvas = null;

window.addEventListener('toolSelected', (e) => {
  if (e.detail.tool !== 'text') {
    if (fabricCanvas) { fabricCanvas.dispose(); fabricCanvas = null; }
    return;
  }
  const { canvas } = window.app;
  const panel = document.getElementById('toolPanel');
  panel.innerHTML = `<div class="tool-panel">
    <h3>Add Text to Image</h3>
    <input type="text" id="overlayText" placeholder="Enter text…">
    <button id="addTextBtn" class="primary-btn">Add Text</button>
    <button id="downloadTextImage" class="primary-btn download-btn">Download Image</button>
    <div style="margin-top:1rem;"><canvas id="fabricCanvas"></canvas></div>
  </div>`;

  fabricCanvas = new fabric.Canvas('fabricCanvas', {
    width: canvas.width,
    height: canvas.height,
    backgroundColor: '#fff'
  });

  // Load the current image as background
  fabric.Image.fromURL(canvas.toDataURL(), (img) => {
    fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
  });

  document.getElementById('addTextBtn').addEventListener('click', () => {
    const text = document.getElementById('overlayText').value;
    if (!text) return;
    const textObj = new fabric.Text(text, {
      left: 50,
      top: 50,
      fontSize: 40,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2
    });
    fabricCanvas.add(textObj);
    fabricCanvas.setActiveObject(textObj);
  });

  document.getElementById('downloadTextImage').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'text-overlay.png';
    link.href = fabricCanvas.toDataURL();
    link.click();
  });
});
