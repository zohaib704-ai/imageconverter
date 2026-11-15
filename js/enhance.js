// enhance.js
window.addEventListener('toolSelected', (e) => {
  if (e.detail.tool !== 'enhance') return;
  const { canvas, ctx, getCurrentImage } = window.app;
  const img = getCurrentImage();
  if (!img) return;

  const panel = document.getElementById('toolPanel');
  panel.innerHTML = `<div class="tool-panel">
    <h3>Enhance Image</h3>
    <div class="range-row"><label>Brightness</label><input type="range" id="brightness" min="0" max="2" step="0.01" value="1"></div>
    <div class="range-row"><label>Contrast</label><input type="range" id="contrast" min="0" max="2" step="0.01" value="1"></div>
    <div class="range-row"><label>Saturation</label><input type="range" id="saturation" min="0" max="2" step="0.01" value="1"></div>
    <button id="downloadEnhanced" class="primary-btn download-btn">Download Enhanced Image</button>
  </div>`;

  const apply = () => {
    const brightness = document.getElementById('brightness').value;
    const contrast = document.getElementById('contrast').value;
    const saturation = document.getElementById('saturation').value;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
    ctx.drawImage(img, 0, 0);
    ctx.filter = 'none';
  };

  ['brightness', 'contrast', 'saturation'].forEach(id => {
    document.getElementById(id).addEventListener('input', apply);
  });

  document.getElementById('downloadEnhanced').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'enhanced.png';
    link.href = canvas.toDataURL();
    link.click();
  });
});
