// main.js
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const imagePreview = document.getElementById('imagePreview');
const toolTabs = document.getElementById('toolTabs');
const toolPanel = document.getElementById('toolPanel');

let currentImage = null; // Image object
let currentFile = null;

uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  currentFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      currentImage = img;
      // Draw to canvas
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      canvas.hidden = false;
      imagePreview.hidden = true;
      toolTabs.hidden = false;
      // Notify other modules
      window.dispatchEvent(new CustomEvent('imageLoaded', { detail: { img, canvas } }));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// Tool tab switching
toolTabs.addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  document.querySelectorAll('.tool-tabs button').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  const tool = e.target.dataset.tool;
  window.dispatchEvent(new CustomEvent('toolSelected', { detail: { tool } }));
});

// Expose helpers globally for modules
window.app = { canvas, ctx, getCurrentImage: () => currentImage, getCurrentFile: () => currentFile };
