// camera.js
const cameraBtn = document.getElementById('cameraBtn');
const cameraPreview = document.getElementById('cameraPreview');
const captureBtn = document.getElementById('captureBtn');

cameraBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    cameraPreview.srcObject = stream;
    cameraPreview.hidden = false;
    captureBtn.hidden = false;
    cameraPreview.play();
  } catch (err) {
    alert('Camera access denied or unavailable: ' + err.message);
  }
});

captureBtn.addEventListener('click', () => {
  const { canvas, ctx } = window.app;
  canvas.width = cameraPreview.videoWidth;
  canvas.height = cameraPreview.videoHeight;
  ctx.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);
  canvas.hidden = false;
  // Stop stream
  const stream = cameraPreview.srcObject;
  if (stream) stream.getTracks().forEach(t => t.stop());
  cameraPreview.hidden = true;
  captureBtn.hidden = true;
  document.getElementById('toolTabs').hidden = false;
  // Create a fake "file" for compression
  canvas.toBlob(blob => {
    window.app.getCurrentFile = () => new File([blob], 'capture.png', { type: 'image/png' });
    window.app.getCurrentImage = () => {
      const img = new Image();
      img.src = canvas.toDataURL();
      return img;
    };
  });
});
