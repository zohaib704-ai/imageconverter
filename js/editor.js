/* ============================================================
   js/editor.js — Unified editor + camera + clear
   ============================================================ */

/* ============================================================
   STATE
   ============================================================ */
let img = null;
let originalImageData = null;
let fileName = 'image';
let history = [];
let compareHeld = false;

const state = {
    // Enhance
    brightness: 100, contrast: 100, saturate: 100, warmth: 0,
    // Clear
    clarity: 0, denoise: 0,
    // Filter
    filter: 'none',
    // Crop
    preset: '', cw: null, ch: null,
    // Transform
    rotation: 0, flipH: false, flipV: false, scale: 1,
    // Text
    text: '', tsize: 48, tcolor: '#ffffff', tx: 50, ty: 85,
    // Compress
    quality: 80, format: 'image/jpeg'
};

const canvas = document.getElementById('edCanvas');

/* ============================================================
   OPEN / CLOSE
   ============================================================ */
function openEditor() {
    document.getElementById('editorModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeEditor() {
    document.getElementById('editorModal').classList.remove('active');
    document.body.style.overflow = '';
}

/* ============================================================
   LOAD IMAGE
   ============================================================ */
function loadImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 15 * 1024 * 1024) { alert('Max 15MB'); return; }
    fileName = file.name.replace(/\.[^.]+$/, '');

    const reader = new FileReader();
    reader.onload = e => {
        const im = new Image();
        im.onload = () => {
            img = im;
            // Save pristine copy for compare + reset
            const tmp = document.createElement('canvas');
            tmp.width = im.width; tmp.height = im.height;
            tmp.getContext('2d').drawImage(im, 0, 0);
            originalImageData = tmp.getContext('2d').getImageData(0, 0, im.width, im.height);
            openEditor();
            render();
        };
        im.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/* ============================================================
   RENDER
   ============================================================ */
function render(useOriginal = false) {
    if (!img) return;
    const ctx = canvas.getContext('2d');

    const rotated = state.rotation % 180 !== 0;
    let baseW = rotated ? img.height : img.width;
    let baseH = rotated ? img.width : img.height;

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

    // Cap for performance
    const cap = 2400;
    if (outW > cap) { const r = cap / outW; outW = cap; outH *= r; }
    if (outH > cap) { const r = cap / outH; outH = cap; outW *= r; }

    outW = Math.round(outW); outH = Math.round(outH);

    canvas.width = outW;
    canvas.height = outH;

    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((state.rotation * Math.PI) / 180);
    ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);

    // Base filter chain
    const filters = useOriginal ? 'none' : [
        `brightness(${state.brightness}%)`,
        `contrast(${state.contrast}%)`,
        `saturate(${state.saturate}%)`,
        state.warmth > 0 ? `sepia(${state.warmth * 0.6}%)` : '',
        state.warmth < 0 ? `hue-rotate(${state.warmth}deg)` : '',
        state.filter !== 'none' ? state.filter : ''
    ].filter(Boolean).join(' ');

    ctx.filter = filters;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -outW / 2, -outH / 2, outW, outH);
    ctx.restore();

    // --- Clear (sharpen + denoise) as post-process ---
    if (!useOriginal && (state.clarity > 0 || state.denoise > 0)) {
        applyClear(ctx, canvas, state.clarity, state.denoise);
    }

    // --- Text overlay ---
    if (!useOriginal && state.text) {
        ctx.filter = 'none';
        ctx.font = `700 ${state.tsize}px Inter, sans-serif`;
        ctx.fillStyle = state.tcolor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, state.tsize / 18);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        const x = canvas.width * (state.tx / 100);
        const y = canvas.height * (state.ty / 100);
        ctx.strokeText(state.text, x, y);
        ctx.fillText(state.text, x, y);
    }
}

/* ============================================================
   CLEAR: median denoise + unsharp mask
   ============================================================ */
function applyClear(ctx, cvs, clarity, denoise) {
    const w = cvs.width, h = cvs.height;
    if (w * h > 4_000_000) return; // safety

    let data = ctx.getImageData(0, 0, w, h);

    if (denoise > 0) {
        data = medianFilter(data, Math.round(denoise));
    }

    if (clarity > 0) {
        // Unsharp mask: original + (original - blurred) * amount
        const amount = clarity / 100 * 1.5;
        const blurred = boxBlur(data, 1);
        for (let i = 0; i < data.data.length; i += 4) {
            data.data[i]     = clamp(data.data[i]     + (data.data[i]     - blurred.data[i])     * amount);
            data.data[i + 1] = clamp(data.data[i + 1] + (data.data[i + 1] - blurred.data[i + 1]) * amount);
            data.data[i + 2] = clamp(data.data[i + 2] + (data.data[i + 2] - blurred.data[i + 2]) * amount);
        }
    }

    ctx.putImageData(data, 0, 0);
}

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

// Simple 3x3 median — fast enough for moderate sizes
function medianFilter(imageData, strength) {
    const { width: w, height: h, data } = imageData;
    if (strength < 1) return imageData;
    const out = new Uint8ClampedArray(data);
    const radius = Math.min(strength, 3);
    for (let y = radius; y < h - radius; y++) {
        for (let x = radius; x < w - radius; x++) {
            const idx = (y * w + x) * 4;
            const rs = [], gs = [], bs = [];
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const i = ((y + dy) * w + (x + dx)) * 4;
                    rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
                }
            }
            rs.sort((a, b) => a - b); gs.sort((a, b) => a - b); bs.sort((a, b) => a - b);
            const m = Math.floor(rs.length / 2);
            out[idx] = rs[m]; out[idx + 1] = gs[m]; out[idx + 2] = bs[m];
        }
    }
    return new ImageData(out, w, h);
}

// Box blur radius 1 (for unsharp mask)
function boxBlur(imageData, radius) {
    const { width: w, height: h, data } = imageData;
    const out = new Uint8ClampedArray(data.length);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0, count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const ny = y + dy, nx = x + dx;
                    if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
                    const i = (ny * w + nx) * 4;
                    r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
                }
            }
            const idx = (y * w + x) * 4;
            out[idx] = r / count; out[idx + 1] = g / count; out[idx + 2] = b / count; out[idx + 3] = data[idx + 3];
        }
    }
    return new ImageData(out, w, h);
}

/* ============================================================
   AUTO CLEAR
   ============================================================ */
function autoClear() {
    state.brightness = 112;
    state.contrast = 118;
    state.saturate = 115;
    state.clarity = 60;
    state.denoise = 1;

    // Sync sliders
    const sync = (key, val, suffix = '') => {
        const el = document.querySelector(`[data-key="${key}"]`);
        if (el) el.value = val;
        const lbl = document.querySelector(`[data-label="${key}"]`);
        if (lbl) lbl.textContent = val + suffix;
    };
    sync('brightness', 112, '%');
    sync('contrast', 118, '%');
    sync('saturate', 115, '%');
    sync('clarity', 60, '');
    sync('denoise', 1, '');

    render();
}

/* ============================================================
   DOWNLOAD / COMPRESS
   ============================================================ */
function download() {
    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const ext = state.format === 'image/png' ? 'png' : state.format === 'image/webp' ? 'webp' : 'jpg';
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}-edited.${ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 300);
    }, state.format, state.quality / 100);
}

function compressNow() {
    canvas.toBlob(blob => {
        const kb = (blob.size / 1024).toFixed(1);
        document.getElementById('edCompressInfo').innerHTML =
            `✅ Final size: <strong>${kb} KB</strong> · ${canvas.width}×${canvas.height}px`;
    }, state.format, state.quality / 100);
}

/* ============================================================
   WIRING
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

    // ---------- Hero upload/camera buttons ----------
    const fileInput = document.getElementById('heroFileInput');

    const bindUpload = id => {
        const b = document.getElementById(id);
        if (b) b.addEventListener('click', () => fileInput.click());
    };
    bindUpload('heroUploadBtn');
    bindUpload('ctaUploadBtn');

    fileInput.addEventListener('change', e => {
        if (e.target.files[0]) loadImage(e.target.files[0]);
    });

    // ---------- Camera ----------
    const openCamera = async () => {
        document.getElementById('cameraModal').classList.add('active');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            const video = document.getElementById('camVideo');
            video.srcObject = stream;
            video.style.transform = 'scale(1)';
            setCamZoom(1);
        } catch (err) {
            alert('Camera access denied. Please allow camera permissions.');
            document.getElementById('cameraModal').classList.remove('active');
        }
    };

    const closeCamera = () => {
        const modal = document.getElementById('cameraModal');
        modal.classList.remove('active');
        const video = document.getElementById('camVideo');
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(t => t.stop());
            video.srcObject = null;
        }
        document.getElementById('camCanvas').style.display = 'none';
        video.style.display = 'block';
    };

    let camZoom = 1;
    const setCamZoom = z => {
        camZoom = z;
        const video = document.getElementById('camVideo');
        if (video) video.style.transform = `scale(${z})`;
        const badge = document.getElementById('camZoomBadge');
        if (badge) badge.textContent = z.toFixed(1) + '×';
        const slider = document.getElementById('camZoomSlider');
        if (slider) slider.value = z;
        document.querySelectorAll('.zoom-pill').forEach(p =>
            p.classList.toggle('active', parseFloat(p.dataset.zoom) === z));
    };

    ['heroCameraBtn', 'ctaCameraBtn'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.addEventListener('click', openCamera);
    });
    const camClose = document.getElementById('camClose');
    if (camClose) camClose.addEventListener('click', closeCamera);

    document.querySelectorAll('.zoom-pill').forEach(pill => {
        pill.addEventListener('click', () => setCamZoom(parseFloat(pill.dataset.zoom)));
    });
    const slider = document.getElementById('camZoomSlider');
    if (slider) slider.addEventListener('input', () => setCamZoom(parseFloat(slider.value)));

    const shootBtn = document.getElementById('camShoot');
    if (shootBtn) shootBtn.addEventListener('click', () => {
        const video = document.getElementById('camVideo');
        if (!video.videoWidth) return;
        const fullW = video.videoWidth, fullH = video.videoHeight;
        const cropW = fullW / camZoom, cropH = fullH / camZoom;
        const cropX = (fullW - cropW) / 2, cropY = (fullH - cropH) / 2;

        const shotCanvas = document.createElement('canvas');
        shotCanvas.width = cropW; shotCanvas.height = cropH;
        shotCanvas.getContext('2d').drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        shotCanvas.toBlob(blob => {
            const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
            closeCamera();
            loadImage(file);
        }, 'image/jpeg', 0.95);
    });

    // ---------- Editor close/save/undo/compare ----------
    document.querySelectorAll('[data-ed]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.ed;
            if (action === 'close') return closeEditor();
            if (action === 'save') return download();
            if (action === 'undo') return render(); // simple
            if (action === 'clear') return autoClear();
            if (action === 'compress') return compressNow();
            if (action === 'rotl') { state.rotation = (state.rotation - 90 + 360) % 360; return render(); }
            if (action === 'rotr') { state.rotation = (state.rotation + 90) % 360; return render(); }
            if (action === 'fliph') { state.flipH = !state.flipH; return render(); }
            if (action === 'flipv') { state.flipV = !state.flipV; return render(); }
            if (action === 'compare') {
                compareHeld = true;
                render(true);
                const up = () => { compareHeld = false; render(); document.removeEventListener('pointerup', up); };
                document.addEventListener('pointerup', up);
            }
        });
    });

    // ---------- Showcase cards open editor (upload prompt) ----------
    document.querySelectorAll('[data-open="editor"]').forEach(card => {
        card.addEventListener('click', () => fileInput.click());
    });

    // ---------- Tabs ----------
    document.querySelectorAll('.ed-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ed-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.ed-tabpanel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.querySelector(`.ed-tabpanel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
        });
    });

    // ---------- Inputs ----------
    document.querySelectorAll('.ed-tabpanel [data-key]').forEach(input => {
        const key = input.dataset.key;
        const update = () => {
            let v = input.value;
            if (['brightness','contrast','saturate','warmth','clarity','denoise','tsize','tx','ty','quality','scale'].includes(key)) {
                v = parseFloat(v);
            }
            state[key] = v;
            const lbl = document.querySelector(`[data-label="${key}"]`);
            if (lbl) {
                const suffix = key === 'quality' ? '%' : key === 'tsize' ? 'px' : (key === 'tx' || key === 'ty') ? '%' : (key === 'scale') ? '×' : (key === 'brightness' || key === 'contrast' || key === 'saturate') ? '%' : '';
                lbl.textContent = v + suffix;
            }
            render();
        };
        input.addEventListener('input', update);
        input.addEventListener('change', update);
    });

    // ---------- Filter chips ----------
    document.querySelectorAll('.ed-filter').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.ed-filter').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.filter = chip.dataset.filter;
            render();
        });
    });

    // ---------- FAQ accordion ----------
    document.querySelectorAll('.faq-question').forEach(q => {
        q.addEventListener('click', () => {
            const item = q.parentElement;
            const isOpen = item.classList.contains('open');
            document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
            if (!isOpen) item.classList.add('open');
        });
    });

    // Esc to close modals
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (document.getElementById('cameraModal').classList.contains('active')) return closeCamera();
        if (document.getElementById('editorModal').classList.contains('active')) return closeEditor();
    });

   /* ============================================================
   SIMPLE CROP — works with existing inputs, no overlay needed
   ============================================================ */
function applySimpleCrop() {
    if (!img) {
        alert('Upload an image first.');
        return;
    }

    const preset = document.querySelector('[data-key="preset"]')?.value || '';
    const cwInput = document.querySelector('[data-key="cw"]');
    const chInput = document.querySelector('[data-key="ch"]');

    let targetW, targetH;

    if (cwInput?.value && chInput?.value) {
        targetW = parseInt(cwInput.value);
        targetH = parseInt(chInput.value);
    } else if (preset) {
        const [a, b] = preset.split(':').map(Number);
        const ratio = a / b;
        if (img.width / img.height > ratio) {
            targetH = img.height;
            targetW = Math.round(targetH * ratio);
        } else {
            targetW = img.width;
            targetH = Math.round(targetW / ratio);
        }
    } else {
        alert('Choose a ratio OR enter width & height.');
        return;
    }

    // Center-crop the image to targetW × targetH
    const srcX = Math.max(0, Math.round((img.width - targetW) / 2));
    const srcY = Math.max(0, Math.round((img.height - targetH) / 2));
    const finalW = Math.min(targetW, img.width);
    const finalH = Math.min(targetH, img.height);

    const tmp = document.createElement('canvas');
    tmp.width = finalW;
    tmp.height = finalH;
    tmp.getContext('2d').drawImage(img, srcX, srcY, finalW, finalH, 0, 0, finalW, finalH);

    const newImg = new Image();
    newImg.onload = () => {
        img = newImg;
        state.cw = null;
        state.ch = null;
        state.preset = '';
        if (cwInput) cwInput.value = '';
        if (chInput) chInput.value = '';
        const presetSel = document.querySelector('[data-key="preset"]');
        if (presetSel) presetSel.value = '';
        render();
        alert('✅ Cropped to ' + finalW + ' × ' + finalH);
    };
    newImg.src = tmp.toDataURL('image/png');
}

// Hook the button (works whether class is .ed-magic or any button with data-ed="apply-crop")
document.addEventListener('click', e => {
    if (e.target.closest('[data-ed="apply-crop"]')) {
        e.preventDefault();
        applySimpleCrop();
    }
});

/* ============================================================
   OCR — Tesseract.js (free, browser-based)
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('modal-ocr');
    if (!modal) return;

    const drop = modal.querySelector('[data-drop]');
    const fileInput = modal.querySelector('.modal-file');
    const editor = modal.querySelector('.modal-editor');
    let ocrImg = null;

    // Upload handling
    drop.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
        if (!e.target.files[0]) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
                ocrImg = img;
                drop.style.display = 'none';
                editor.style.display = 'grid';
                const canvas = modal.querySelector('.modal-canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
    });

    // OCR start
    document.getElementById('ocrStartBtn').addEventListener('click', async () => {
        if (!ocrImg) return alert('Upload an image first.');
        const lang = document.getElementById('ocrLang').value;
        const progressEl = document.getElementById('ocrProgress');
        progressEl.style.display = 'block';
        progressEl.textContent = 'Loading OCR engine…';

        try {
            const worker = await Tesseract.createWorker(lang, 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        progressEl.textContent = `Reading text… ${Math.round(m.progress * 100)}%`;
                    }
                }
            });

            const { data: { text } } = await worker.recognize(ocrImg);
            await worker.terminate();

            progressEl.style.display = 'none';
            document.getElementById('ocrResultGroup').style.display = 'block';
            document.getElementById('ocrTranslateGroup').style.display = 'block';
            document.getElementById('copyTextBtn').style.display = 'block';
            document.getElementById('ocrResult').value = text.trim() || '(No text found)';
        } catch (err) {
            progressEl.textContent = 'Error: ' + err.message;
        }
    });

    // Translate (free — uses MyMemory API, no key needed)
    document.getElementById('translateLang').addEventListener('change', async e => {
        const targetLang = e.target.value;
        const sourceText = document.getElementById('ocrResult').value;
        if (!targetLang || !sourceText || sourceText === '(No text found)') return;

        const progressEl = document.getElementById('ocrProgress');
        progressEl.style.display = 'block';
        progressEl.textContent = 'Translating…';

        try {
            const res = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(sourceText)}&langpair=auto|${targetLang}`
            );
            const data = await res.json();
            progressEl.style.display = 'none';
            document.getElementById('ocrResult').value =
                data.responseData.translatedText || '(Translation failed)';
        } catch {
            progressEl.textContent = 'Translation failed — check connection.';
        }
    });

    // Copy button
    document.getElementById('copyTextBtn').addEventListener('click', () => {
        const text = document.getElementById('ocrResult').value;
        navigator.clipboard.writeText(text).then(() => {
            document.getElementById('copyTextBtn').textContent = '✅ Copied!';
            setTimeout(() => document.getElementById('copyTextBtn').textContent = '📋 Copy Text', 2000);
        });
    });

    // Wire the launcher card
    const ocrCard = document.querySelector('[data-tool="ocr"]');
    if (ocrCard) ocrCard.addEventListener('click', () => {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
});   
});

/* ============================================================
   CROP — Cropper.js (gallery-style, mobile-friendly)
   ============================================================ */
let cropperInstance = null;

function initCropper() {
    const imgEl = document.getElementById('cropperImage');
    if (!imgEl || !img) return;

    // Load current image into cropper
    imgEl.src = img.src;

    // Destroy old instance
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }

    // Wait for image to load, then init
    imgEl.onload = () => {
        cropperInstance = new Cropper(imgEl, {
            viewMode: 1,           // restrict crop box to canvas
            dragMode: 'move',      // drag to move image
            aspectRatio: NaN,      // free by default
            autoCropArea: 0.8,     // 80% default crop
            responsive: true,
            restore: false,
            guides: true,          // show rule-of-thirds grid
            center: true,
            highlight: false,
            cropBoxMovable: true,  // drag the box
            cropBoxResizable: true,// drag corners/edges
            toggleDragModeOnDblclick: true,
            background: true,
            modal: true,           // dark overlay outside crop
        });
    };

    // Ratio dropdown
    document.getElementById('cropRatio').onchange = function () {
        if (!cropperInstance) return;
        const val = parseFloat(this.value);
        cropperInstance.setAspectRatio(isNaN(val) ? NaN : val);
    };

    // Apply crop button
    document.getElementById('applyCropperBtn').onclick = () => {
        if (!cropperInstance) return;
        const croppedCanvas = cropperInstance.getCroppedCanvas({
            maxWidth: 4096,
            maxHeight: 4096,
            imageSmoothingQuality: 'high'
        });
        if (!croppedCanvas) return;

        croppedCanvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const newImg = new Image();
            newImg.onload = () => {
                img = newImg;
                cropperInstance.destroy();
                cropperInstance = null;
                URL.revokeObjectURL(url);
                render();
                // Switch back to Clear tab so user sees the result
                document.querySelector('.ed-tab[data-tab="clear"]').click();
            };
            newImg.src = url;
        }, 'image/png');
    };
}

// Hook: when Crop tab is clicked, init cropper
document.querySelectorAll('.ed-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        if (tab.dataset.tab === 'crop' && img) {
            setTimeout(initCropper, 80);
        } else {
            if (cropperInstance) {
                cropperInstance.destroy();
                cropperInstance = null;
            }
        }
    });
});

/* ============================================================
   CROP — Cropper.js (gallery style)
   ============================================================ */
let cropperInstance = null;

function initCropper() {
    const imgEl = document.getElementById('cropperImage');
    if (!imgEl || !window.img) return;

    imgEl.src = img.src;

    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }

    imgEl.onload = () => {
        cropperInstance = new Cropper(imgEl, {
            viewMode: 1,
            dragMode: 'move',
            aspectRatio: NaN,
            autoCropArea: 0.8,
            responsive: true,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: true,
            background: true,
            modal: true,
        });
    };

    document.getElementById('cropRatio').onchange = function () {
        if (!cropperInstance) return;
        const val = parseFloat(this.value);
        cropperInstance.setAspectRatio(isNaN(val) ? NaN : val);
    };

    document.getElementById('applyCropperBtn').onclick = () => {
        if (!cropperInstance) return;
        const cropped = cropperInstance.getCroppedCanvas({
            maxWidth: 4096,
            maxHeight: 4096,
            imageSmoothingQuality: 'high'
        });
        if (!cropped) return;

        cropped.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const newImg = new Image();
            newImg.onload = () => {
                img = newImg;
                cropperInstance.destroy();
                cropperInstance = null;
                URL.revokeObjectURL(url);
                render();
                document.querySelector('.ed-tab[data-tab="clear"]').click();
            };
            newImg.src = url;
        }, 'image/png');
    };
}

// Hook the crop tab
document.querySelectorAll('.ed-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        if (tab.dataset.tab === 'crop' && img) {
            setTimeout(initCropper, 100);
        } else if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
        }
    });
});
