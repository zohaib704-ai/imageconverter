/* ============================================================
   js/ocr.js — Read text from images (OCR) + Translate
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('modal-ocr');
    if (!modal) return;

    const drop = document.getElementById('ocrDrop');
    const fileInput = document.getElementById('ocrFile');
    const editor = document.getElementById('ocrEditor');
    const canvas = document.getElementById('ocrCanvas');
    let ocrImg = null;

    const openModal = () => {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };
    const closeModal = () => {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    };

    // Open from showcase card
    document.getElementById('ocrCardBtn')?.addEventListener('click', openModal);

    // Close
    document.getElementById('ocrClose')?.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    // Upload
    drop?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', e => {
        if (!e.target.files[0]) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
                ocrImg = img;
                drop.style.display = 'none';
                editor.style.display = 'grid';
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
    });

    // Extract text
    document.getElementById('ocrStartBtn')?.addEventListener('click', async () => {
        if (!ocrImg) return alert('Upload an image first.');
        const lang = document.getElementById('ocrLang').value;
        const progressEl = document.getElementById('ocrProgress');
        progressEl.style.display = 'block';
        progressEl.textContent = 'Loading OCR engine (first time may take ~10s)…';

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

    // Translate (free, no API key — MyMemory)
    document.getElementById('translateLang')?.addEventListener('change', async e => {
        const target = e.target.value;
        const src = document.getElementById('ocrResult').value;
        if (!target || !src || src === '(No text found)') return;

        const progressEl = document.getElementById('ocrProgress');
        progressEl.style.display = 'block';
        progressEl.textContent = 'Translating…';

        try {
            const res = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(src.slice(0, 500))}&langpair=auto|${target}`
            );
            const data = await res.json();
            progressEl.style.display = 'none';
            document.getElementById('ocrResult').value =
                data.responseData?.translatedText || '(Translation failed)';
        } catch {
            progressEl.textContent = 'Translation failed — check your connection.';
        }
    });

    // Copy
    document.getElementById('copyTextBtn')?.addEventListener('click', () => {
        const text = document.getElementById('ocrResult').value;
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('copyTextBtn');
            btn.textContent = '✅ Copied!';
            setTimeout(() => btn.textContent = '📋 Copy Text', 2000);
        });
    });
});
