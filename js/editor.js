/* ============================================================
   js/editor.js — All-in-One Image Editor
   ============================================================ */

let editImg = null;
let editState = {
    brightness: 100,
    contrast: 100,
    saturate: 100,
    blur: 0,
    presetFilter: 'none',
    rotation: 0,
    flipH: false,
    flipV: false,
    scale: 1,
    texts: [] // {text, font, size, color, x, y, bold}
};

const canvas = document.getElementById('editCanvas');

function renderCanvas() {
    if (!editImg || !canvas) return;
    const ctx = canvas.getContext('2d');
    const img = editImg;

    const rotated = editState.rotation % 180 !== 0;
    const baseW = rotated ? img.height : img.width;
    const baseH = rotated ? img.width : img.height;

    canvas.width = baseW * editState.scale;
    canvas.height = baseH * editState.scale;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((editState.rotation * Math.PI) / 180);
    ctx.scale(editState.flipH ? -1 : 1, editState.flipV ? -1 : 1);

    const filterStr = [
        `brightness(${editState.brightness}%)`,
        `contrast(${editState.contrast}%)`,
        `saturate(${editState.saturate}%)`,
        `blur(${editState.blur}px)`,
        editState.presetFilter !== 'none' ? editState.presetFilter : ''
    ].filter(Boolean).join(' ');

    ctx.filter = filterStr;

    const drawW = img.width * editState.scale;
    const drawH = img.height * editState.scale;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Text overlays
    editState.texts.forEach(t => {
        ctx.filter = 'none';
        ctx.font = `${t.bold ? '700' : '400'} ${t.size}px ${t.font}, sans-serif`;
        ctx.fillStyle = t.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Outline for readability
        ctx.lineWidth = Math.max(2, t.size / 20);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.strokeText(t.text, canvas.width * (t.x / 100), canvas.height * (t.y / 100));
        ctx.fillText(t.text, canvas.width * (t.x / 100), canvas.height * (t.y / 100));
    });
}

function loadEditImage(file) {
    if (!file || !file.type.startsWith('image/')) {
        showEditError('Please select a valid image file.');
        return;
    }
    if (file.size > 15 * 1024 * 1024) {
        showEditError('File must be under 15MB.');
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            editImg = img;
            resetEditState();
            document.getElementById('editorUpload').style.display = 'none';
            document.getElementById('editorWorkspace').style.display = 'block';
            renderCanvas();
        };
        img.onerror = () => showEditError('Could not load image.');
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function resetEditState() {
    editState = {
        brightness: 100, contrast: 100, saturate: 100, blur: 0,
        presetFilter: 'none', rotation: 0, flipH: false, flipV: false,
        scale: 1, texts: []
    };
    // Reset UI
    ['brightness','contrast','saturate','blur'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = id === 'blur' ? 0 : 100;
    });
    document.getElementById('vBrightness').textContent = '100%';
    document.getElementById('vContrast').textContent = '100%';
    document.getElementById('vSaturate').textContent = '100%';
    document.getElementById('vBlur').textContent = '0px';
    document.getElementById('textInput').value = '';
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    const firstChip = document.querySelector('.filter-chip[data-filter="none"]');
    if (firstChip) firstChip.classList.add('active');
}

function showEditError(msg) {
    const el = document.getElementById('editorError');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

/* -------- Wiring -------- */
document.addEventListener('DOMContentLoaded', () => {
    if (!canvas) return;

    const fileInput = document.getElementById('editorFileInput');
    fileInput.addEventListener('change', e => {
        if (e.target.files[0]) loadEditImage(e.target.files[0]);
    });

    // Tabs
    document.querySelectorAll('.editor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.editor-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.querySelector(`.editor-panel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
        });
    });

    // Enhance sliders
    const bindSlider = (id, key, suffix, labelId) => {
        const el = document.getElementById(id);
        el.addEventListener('input', () => {
            editState[key] = parseFloat(el.value);
            document.getElementById(labelId).textContent = el.value + suffix;
            renderCanvas();
        });
    };
    bindSlider('brightness', 'brightness', '%', 'vBrightness');
    bindSlider('contrast', 'contrast', '%', 'vContrast');
    bindSlider('saturate', 'saturate', '%', 'vSaturate');
    bindSlider('blur', 'blur', 'px', 'vBlur');

    // Auto enhance
    document.getElementById('autoEnhanceBtn').addEventListener('click', () => {
        editState.brightness = 115;
        editState.contrast = 115;
        editState.saturate = 120;
        editState.blur = 0;
        document.getElementById('brightness').value = 115;
        document.getElementById('contrast').value = 115;
        document.getElementById('saturate').value = 120;
        document.getElementById('blur').value = 0;
        document.getElementById('vBrightness').textContent = '115%';
        document.getElementById('vContrast').textContent = '115%';
        document.getElementById('vSaturate').textContent = '120%';
        document.getElementById('vBlur').textContent = '0px';
        renderCanvas();
    });

    // Filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            editState.presetFilter = chip.dataset.filter;
            renderCanvas();
        });
    });

    // Text
    const textPreview = () => {
        const t = {
            text: document.getElementById('textInput').value || '',
            font: document.getElementById('textFont').value,
            size: parseInt(document.getElementById('textSize').value),
            color: document.getElementById('textColor').value,
            x: parseInt(document.getElementById('textX').value),
            y: parseInt(document.getElementById('textY').value),
            bold: document.getElementById('textBold').checked
        };
        editState.texts = t.text ? [t] : [];
        renderCanvas();
    };

    ['textInput','textFont','textSize','textColor','textX','textY','textBold'].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('input', () => {
            document.getElementById('vTextSize').textContent = document.getElementById('textSize').value + 'px';
            document.getElementById('vTextX').textContent = document.getElementById('textX').value + '%';
            document.getElementById('vTextY').textContent = document.getElementById('textY').value + '%';
            textPreview();
        });
    });

    document.getElementById('addTextBtn').addEventListener('click', textPreview);
    document.getElementById('clearTextBtn').addEventListener('click', () => {
        editState.texts = [];
        document.getElementById('textInput').value = '';
        renderCanvas();
    });

    // Transform
    document.getElementById('rotLBtn').addEventListener('click', () => {
        editState.rotation = (editState.rotation - 90 + 360) % 360;
        renderCanvas();
    });
    document.getElementById('rotRBtn').addEventListener('click', () => {
        editState.rotation = (editState.rotation + 90) % 360;
        renderCanvas();
    });
    document.getElementById('flipHBtn').addEventListener('click', () => {
        editState.flipH = !editState.flipH;
        renderCanvas();
    });
    document.getElementById('flipVBtn').addEventListener('click', () => {
        editState.flipV = !editState.flipV;
        renderCanvas();
    });
    document.querySelectorAll('[data-scale]').forEach(btn => {
        btn.addEventListener('click', () => {
            editState.scale = parseInt(btn.dataset.scale);
            document.querySelectorAll('[data-scale]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCanvas();
        });
    });
    // Set 1x active by default
    const oneX = document.querySelector('[data-scale="1"]');
    if (oneX) oneX.classList.add('active');

    // Download
    document.getElementById('downloadEditBtn').addEventListener('click', () => {
        const format = document.getElementById('exportFormat').value;
        const ext = format.split('/')[1];
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `edited-image.${ext === 'jpeg' ? 'jpg' : ext}`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 200);
        }, format, 0.92);
    });

    // Reset
    document.getElementById('resetEditBtn').addEventListener('click', () => {
        resetEditState();
        renderCanvas();
    });

    // Hash-based tab open (e.g., editor.html#text)
    const hash = location.hash.replace('#','');
    if (['enhance','filters','text','transform'].includes(hash)) {
        const tab = document.querySelector(`.editor-tab[data-tab="${hash}"]`);
        if (tab) tab.click();
    }
});
