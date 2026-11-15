// crop.js
let cropper = null;

window.addEventListener('toolSelected', (e) => {
  if (e.detail.tool !== 'crop') {
    if (cropper) { cropper.destroy(); cropper = null; }
    return;
  }
  const { canvas } = window.app;
  const panel = document.getElementById('toolPanel');
  panel.innerHTML = `<div class="tool-panel">
    <p>Crop your image:</p>
    <img id="cropImage" src="${canvas.toDataURL()}" style="max-width:100%;">
    <button id="downloadCrop" class="primary-btn download-btn">Download Cropped Image</button>
  </div>`;
  const img = document.getElementById('cropImage');
  cropper = new Cropper(img, { aspectRatio: NaN, viewMode: 1 });

  document.getElementById('downloadCrop').addEventListener('click', () => {
    const croppedCanvas = cropper.getCroppedCanvas();
    const link = document.createElement('a');
    link.download = 'cropped.png';
    link.href = croppedCanvas.toDataURL();
    link.click();
  });
});
