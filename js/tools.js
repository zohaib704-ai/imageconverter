/* ============================================================
   js/tools.js — Modal launcher + tool engines
   ============================================================ */

/* ============================================================
   MODAL SYSTEM
   ============================================================ */
function openModal(name) {
    const modal = document.getElementById(`modal-${name}`);
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Camera needs special init
    if (name === 'camera') initCamera();
}

function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';

    // Stop camera if it was open
    const video = modal.querySelector('.camera-video');
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop());
        video.srcObject = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Launcher cards
    document.querySelectorAll('.launch-card[data-tool]').forEach(card => {
        card.addEventListener('click', () => openModal(card.dataset.tool));
    });

    // Close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.closest('.tool-modal')));
    });

    // Click backdrop to close
    document.querySelectorAll('.tool-modal').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) closeModal(modal);
        });
    });

    // Esc key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.tool-modal.active').forEach(closeModal);
        }
    });

    // Initialize every modal's tool
    document.querySelectorAll('.tool-modal').forEach(initToolModal);
});

/* ============================================================
   TOOL MODAL BASE
   ============================================================ */
function initToolModal(modal) {
    const drop = modal.querySelector('[data-drop]');
    const fileInput = modal.querySelector('.modal-file');
    const editor = modal.querySelector('.modal-editor');
    const canvas = modal.querySelector('.modal-canvas');
    if (!drop || !canvas) return;

    const state = {
        img: null,
        fileName: 'image',
        // Adjustments
        brightness: 100, contrast: 100, saturate: 100, sharpen: 0,
        filter: 'none',
        // Text
        text: '', font: 'Inter', size: 48, color: '#ffffff', x: 50, y: 85,
        // Transform
        rotation: 0, flipH: false, flipV: false,
        // Crop
        cw: null, ch: null, preset: '',
        // Compress
        quality: 80, maxSize: 500, format: 'image/jpeg',
        // Upscale
        scale: 1
    };

    // ---- Upload handling ----
    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        state.fileName = file.name.replace(/\.[^.]+$/, '');
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                state.img = img;
                drop.style.display = 'none';
                editor.style.display = 'grid';
                if (modal.id === 'modal-camera') editor.style.display = 'block';
                redraw(modal, state, canvas);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    drop.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
    });

    // Drag & drop
    ['dragover', 'dragenter'].forEach(evt => {
        drop.addEventListener(evt, e => { e.preventDefault(); drop.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
        drop.addEventListener(evt, e => { e.preventDefault(); drop.classList.remove('dragover'); });
    });
    drop.addEventListener('drop', e => {
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    // ---- Sliders / inputs ----
    modal.querySelectorAll('[data-key]').forEach(input => {
        const key = input.dataset.key;
        const update = () => {
            let val = input.type === 'number' ? parseFloat(input.value) : input.value;
            if (['quality','maxSize','brightness','contrast','saturate','sharpen','size','x','y'].includes(key)) {
                val = parseFloat(val);
            }
            state[key] = val;
            const label = modal.querySelector(`[data-label="${key}"]`);
            if (label) label.textContent = input.type === 'range' ? `${val}${key === 'size' ? 'px' : key === 'x' || key === 'y' ? '%' : key === 'quality' ? '%' : key === 'maxSize' ? ' KB' : '%'}` : val;
            redraw(modal, state, canvas);
        };
        input.addEventListener('input', update);
        input.addEventListener('change', update);
    });

    // ---- Filter chips ----
    modal.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            modal.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.filter = chip.dataset.filter;
            redraw(modal, state, canvas);
        });
    });

    // ---- Action buttons ----
    modal.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action === 'compress') return doCompress(modal, state, canvas);
            if (action === 'download') return doDownload(modal, state, canvas);
            if (action === 'auto-enhance') return doAutoEnhance(modal, state, canvas);
            if (action === 'rotl') { state.rotation = (state.rotation - 90 + 360) % 360; return redraw(modal, state, canvas); }
            if (action === 'rotr') { state.rotation = (state.rotation + 90) % 360; return redraw(modal, state, canvas); }
            if (action === 'fliph') { state.flipH = !state.flipH; return redraw(modal, state, canvas); }
            if (action === 'flipv') { state.flipV = !state.flipV; return redraw(modal, state, canvas); }
        });
    });

    // ---- Scale buttons (upscale) ----
    modal.querySelectorAll('[data-scale]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.scale = parseInt(btn.dataset.scale);
            modal.querySelectorAll('[data-scale]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            redraw(modal, state, canvas);
        });
    });

    // ---- Camera buttons ----
    modal.querySelectorAll('.zoom-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            modal.querySelectorAll('.zoom-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const z = parseFloat(pill.dataset.zoom);
            setZoom(modal, z);
        });
    });
    const zoomSlider = modal.querySelector('.zoom-slider');
    if (zoomSlider) {
        zoomSlider.addEventListener('input', () => setZoom(modal, parseFloat(zoomSlider.value)));
    }
    const shootBtn = modal.querySelector('[data-action="shoot"]');
    if (shootBtn) shootBtn.addEventListener('click', () => shootPhoto(modal, state, canvas));
}

/* ============================================================
   REDRAW
   ============================================================ */
function redraw(modal, state, canvas) {
    if (!state.img) return;
    const ctx = canvas.getContext('2d');

    // Base dimensions
    const rotated = state.rotation % 180 !== 0;
    const baseW = rotated ? state.img.height : state.img.width;
    const baseH = rotated ? state.img.width : state.img.height;

    // For crop, apply preset ratio (just preview)
    let outW = baseW * state.scale;
    let outH = baseH * state.scale;

    if (state.preset) {
        const [a, b] = state.preset.split(':').map(Number);
        const ratio = a / b;
        if (outW / outH > ratio) outW = outH * ratio;
        else outH = outW / ratio;
    }
    if (state.cw) outW = parseInt(state.cw);
    if (state.ch) outH = parseInt(state.ch);

    canvas.width = outW;
    canvas.height = outH;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((state.rotation * Math.PI) / 180);
    ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);

    const filters = [
        `brightness(${state.brightness}%)`,
        `contrast(${state.contrast}%)`,
        `saturate(${state.saturate}%)`,
        state.filter !== 'none' ? state.filter : ''
    ].filter(Boolean).join(' ');

    ctx.filter = filters;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(state.img, -outW / 2, -outH / 2, outW, outH);
    ctx.restore();

    // Text overlay
    if (state.text) {
        ctx.filter = 'none';
        ctx.font = `700 ${state.size}px ${state.font}, sans-serif`;
        ctx.fillStyle = state.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, state.size / 18);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        const tx = canvas.width * (state.x / 100);
        const ty = canvas.height * (state.y / 100);
        ctx.strokeText(state.text, tx, ty);
        ctx.fillText(state.text, tx, ty);
    }

    // Show info
    const info = modal.querySelector('[data-info]');
    if (info) {
        const kb = (outW * outH * 4 / 1024).toFixed(0); // rough estimate
        info.textContent = `Output: ${outW}×${outH}px · approx ${kb}KB (raw)`;
    }
}

/* ============================================================
   ACTIONS
   ============================================================ */
function doAutoEnhance(modal, state, canvas) {
    state.brightness = 115;
    state.contrast = 115;
    state.saturate = 120;
    modal.querySelector('[data-key="brightness"]').value = 115;
    modal.querySelector('[data-key="contrast"]').value = 115;
    modal.querySelector('[data-key="saturate"]').value = 120;
    modal.querySelector('[data-label="brightness"]').textContent = '115%';
    modal.querySelector('[data-label="contrast"]').textContent = '115%';
    modal.querySelector('[data-label="saturate"]').textContent = '120%';
    redraw(modal, state, canvas);
}

function doCompress(modal, state, canvas) {
    if (!state.img) return;
    const quality = state.quality / 100;
    // For compression, always render at original size but export small
    canvas.toBlob(blob => {
        const info = modal.querySelector('[data-info]');
        const sizeKB = (blob.size / 1024).toFixed(1);
        info.innerHTML = `✅ Compressed to <strong>${sizeKB} KB</strong> · ${canvas.width}×${canvas.height}px`;
        // Store blob for download
        canvas._blob = blob;
        const dl = modal.querySelector('[data-action="download"]');
        if (dl) dl.style.display = 'block';
    }, state.format, quality);
}

function doDownload(modal, state, canvas) {
    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const ext = state.format === 'image/png' ? 'png' : state.format === 'image/webp' ? 'webp' : 'jpg';
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.fileName || 'image'}-edited.${ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 300);
    }, state.format || 'image/jpeg', 0.92);
}

/* ============================================================
   CAMERA
   ============================================================ */
let cameraStream = null;
let cameraZoom = 1;

async function initCamera() {
    const video = document.querySelector('#modal-camera .camera-video');
    if (!video) return;
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        video.srcObject = cameraStream;
        cameraZoom = 1;
        video.style.transform = 'scale(1)';
        const slider = document.querySelector('#modal-camera .zoom-slider');
        if (slider) slider.value = 1;
        document.querySelector('#modal-camera .zoom-value').textContent = '1.0×';
        document.querySelectorAll('#modal-camera .zoom-pill').forEach(p => p.classList.toggle('active', p.dataset.zoom === '1'));
    } catch (err) {
        alert('Unable to access camera. Check permissions.');
    }
}

function setZoom(modal, z) {
    cameraZoom = z;
    const video = modal.querySelector('.camera-video');
    if (video) video.style.transform = `scale(${z})`;
    modal.querySelector('.zoom-value').textContent = z.toFixed(1) + '×';
    const slider = modal.querySelector('.zoom-slider');
    if (slider && parseFloat(slider.value) !== z) slider.value = z;
    modal.querySelectorAll('.zoom-pill').forEach(p => p.classList.toggle('active', parseFloat(p.dataset.zoom) === z));
}

function shootPhoto(modal, state, canvas) {
    const video = modal.querySelector('.camera-video');
    if (!video || !video.videoWidth) return;

    // Full sensor resolution
    const fullW = video.videoWidth;
    const fullH = video.videoHeight;

    // Zoomed region: if we're showing scale(z), we capture a 1/z region
    const cropW = fullW / cameraZoom;
    const cropH = fullH / cameraZoom;
    const cropX = (fullW - cropW) / 2;
    const cropY = (fullH - cropH) / 2;

    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    // Set state so download works
    state.img = new Image();
    state.img.onload = () => { state.fileName = `photo-${Date.now()}`; };
    state.img.src = canvas.toDataURL('image/jpeg', 0.95);

    // Preview: replace video with captured still
    video.style.display = 'none';
    canvas.style.display = 'block';
    canvas.style.maxWidth = '100%';
    canvas.style.borderRadius = 'var(--r-md)';

    // Show download
    modal.querySelector('[data-action="download"]').style.display = 'inline-block';
    const info = modal.querySelector('.modal-info');
    info.innerHTML = `✅ Captured at ${cameraZoom.toFixed(1)}× zoom · ${Math.round(cropW)}×${Math.round(cropH)}px`;
}
