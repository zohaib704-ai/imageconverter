// lens.js
window.addEventListener('toolSelected', (e) => {
  if (e.detail.tool !== 'lens') return;
  const panel = document.getElementById('toolPanel');
  panel.innerHTML = `<div class="tool-panel">
    <h3>Search with Google Lens</h3>
    <p>Google Lens does not allow direct programmatic image uploads for free web apps. Click the button below to open Google Lens, then upload the image you downloaded or captured here.</p>
    <button id="openLens" class="primary-btn">🔎 Open Google Lens</button>
    <button id="downloadForLens" class="secondary-btn">⬇️ Download Current Image First</button>
  </div>`;

  document.getElementById('openLens').addEventListener('click', () => {
    window.open('https://lens.google.com/upload', '_blank');
  });

  document.getElementById('downloadForLens').addEventListener('click', () => {
    const { canvas } = window.app;
    const link = document.createElement('a');
    link.download = 'for-lens-search.png';
    link.href = canvas.toDataURL();
    link.click();
  });
});
