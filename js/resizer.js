/* ============================================================
   js/resizer.js  —  Home page only: image compression tool
   ============================================================ */

// Global variables
let currentStream = null;
let originalImageData = null;

/* ---------------- Camera Functions ---------------- */
async function openCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });

        const video = document.getElementById('cameraVideo');
        video.srcObject = stream;
        currentStream = stream;

        document.getElementById('cameraModal').classList.add('active');
    } catch (err) {
        console.error('Error accessing camera:', err);
        showError('Unable to access camera. Please check permissions.');
    }
}

function closeCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    document.getElementById('cameraModal').classList.remove('active');
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const context = canvas.getContext('2d');

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(blob => {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        handleImageFile(file);
        closeCamera();
    }, 'image/jpeg', 0.95);
}

/* ---------------- Main Image Handler ---------------- */
function handleImageFile(file) {
    hideMessages();
    hideResults();

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showError('Please select a valid image file (JPG, PNG, GIF, or WEBP).');
        return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        showError('File size must be less than 10MB.');
        return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            // Store original image data
            originalImageData = {
                src: e.target.result,
                width: img.width,
                height: img.height,
                file: file
            };

            // Display preview
            displayImagePreview(originalImageData);

            // Enable process button
            document.getElementById('processBtn').disabled = false;

            // Show tools section
            document.getElementById('toolsSection').style.display = 'block';

            showSuccess('Image loaded successfully! Adjust settings and click "Compress Image".');
        };
        img.onerror = function () {
            showError('Error loading image. Please try another file.');
        };
        img.src = e.target.result;
    };

    reader.onerror = function () {
        showError('Error reading file. Please try again.');
    };

    reader.readAsDataURL(file);
}

/* ---------------- Display Image Preview ---------------- */
function displayImagePreview(imageData) {
    const previewSection = document.getElementById('previewSection');
    const imagePreview = document.getElementById('imagePreview');
    const previewSize = document.getElementById('previewSize');
    const previewDimensions = document.getElementById('previewDimensions');
    const previewFormat = document.getElementById('previewFormat');

    imagePreview.src = imageData.src;
    previewSize.textContent = formatFileSize(imageData.file.size);
    previewDimensions.textContent = `${imageData.width} × ${imageData.height}`;
    previewFormat.textContent = getFileExtension(imageData.file.name).toUpperCase();

    previewSection.classList.add('active');

    // Set default dimensions (50% of original)
    const width = Math.round(imageData.width * 0.5);
    const height = Math.round(imageData.height * 0.5);

    document.getElementById('width').value = width;
    document.getElementById('height').value = height;

    // Scroll to preview
    setTimeout(() => {
        previewSection.scrollIntoView({ behavior: 'smooth' });
    }, 300);
}

/* ---------------- Compression ---------------- */
async function compressImage() {
    if (!originalImageData) return;

    const processBtn = document.getElementById('processBtn');
    const loading = document.getElementById('loading');
    const progress = document.getElementById('progress');

    processBtn.disabled = true;
    processBtn.textContent = 'Processing...';
    loading.style.display = 'block';
    hideMessages();

    try {
        // Get settings
        const maxSizeKB = parseInt(document.getElementById('maxSize').value);
        const quality = parseInt(document.getElementById('quality').value) / 100;
        let width = parseInt(document.getElementById('width').value) || originalImageData.width;
        let height = parseInt(document.getElementById('height').value) || originalImageData.height;
        const format = document.getElementById('format').value;

        // Validate dimensions
        if (width < 10 || height < 10) {
            throw new Error('Dimensions too small. Minimum 10x10 pixels.');
        }

        if (width > 10000 || height > 10000) {
            throw new Error('Dimensions too large. Maximum 10000x10000 pixels.');
        }

        progress.style.width = '30%';

        // Create compressed image
        const blob = await compressImageToBlob(originalImageData.src, width, height, format, quality);

        progress.style.width = '80%';

        // Display results
        displayCompressionResults(blob, width, height, format);
        progress.style.width = '100%';

    } catch (error) {
        console.error('Compression error:', error);
        showError(error.message || 'Error compressing image. Please try different settings.');
    } finally {
        processBtn.disabled = false;
        processBtn.textContent = 'Compress Image';
        setTimeout(() => {
            loading.style.display = 'none';
            progress.style.width = '0%';
        }, 1000);
    }
}

/* ---------------- Image Compression Helper ---------------- */
function compressImageToBlob(src, width, height, format, quality) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = width;
            canvas.height = height;

            // Use high-quality image rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Draw and compress image
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob with compression
            canvas.toBlob(resolve, `image/${format}`, quality);
        };
        img.onerror = reject;
        img.src = src;
    });
}

/* ---------------- Display Compression Results ---------------- */
function displayCompressionResults(blob, width, height, format) {
    const resultsSection = document.getElementById('resultsSection');
    const originalImage = document.getElementById('originalImage');
    const compressedImage = document.getElementById('compressedImage');
    const originalSize = document.getElementById('originalSize');
    const compressedSize = document.getElementById('compressedSize');
    const originalDimensions = document.getElementById('originalDimensions');
    const compressedDimensions = document.getElementById('compressedDimensions');
    const originalFormat = document.getElementById('originalFormat');
    const compressedFormat = document.getElementById('compressedFormat');
    const reductionPercent = document.getElementById('reductionPercent');
    const downloadBtn = document.getElementById('downloadBtn');

    // Display original image info
    originalImage.src = originalImageData.src;
    originalSize.textContent = formatFileSize(originalImageData.file.size);
    originalDimensions.textContent = `${originalImageData.width} × ${originalImageData.height}`;
    originalFormat.textContent = getFileExtension(originalImageData.file.name).toUpperCase();

    // Display compressed image
    const compressedUrl = URL.createObjectURL(blob);
    compressedImage.src = compressedUrl;
    compressedSize.textContent = formatFileSize(blob.size);
    compressedDimensions.textContent = `${width} × ${height}`;
    compressedFormat.textContent = format.toUpperCase();

    // Calculate reduction
    const originalSizeKB = originalImageData.file.size / 1024;
    const compressedSizeKB = blob.size / 1024;
    const reduction = ((originalSizeKB - compressedSizeKB) / originalSizeKB * 100);

    if (reduction > 0) {
        reductionPercent.textContent = `${reduction.toFixed(1)}% smaller`;
        reductionPercent.className = 'reduction';
        showSuccess(`Success! Image reduced by ${reduction.toFixed(1)}%`);
    } else {
        reductionPercent.textContent = `${Math.abs(reduction).toFixed(1)}% larger`;
        reductionPercent.className = 'increase';
        showError('Image size increased. Try lower quality settings or smaller dimensions.');
    }

    // Set up download
    downloadBtn.onclick = function () {
        const link = document.createElement('a');
        link.download = `compressed-image.${format}`;
        link.href = compressedUrl;
        link.click();

        // Clean up URL after download
        setTimeout(() => {
            URL.revokeObjectURL(compressedUrl);
        }, 100);
    };

    // Show results
    resultsSection.classList.add('active');

    // Scroll to results
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }, 300);
}

/* ---------------- Utility Functions ---------------- */
function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (!errorElement) return;
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function showSuccess(message) {
    const successElement = document.getElementById('successMessage');
    if (!successElement) return;
    successElement.textContent = message;
    successElement.style.display = 'block';
}

function hideMessages() {
    const err = document.getElementById('errorMessage');
    const ok = document.getElementById('successMessage');
    if (err) err.style.display = 'none';
    if (ok) ok.style.display = 'none';
}

function hideResults() {
    const results = document.getElementById('resultsSection');
    if (results) results.classList.remove('active');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

/* ---------------- Wiring up the Home Page ---------------- */
document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('fileInput');
    const processBtn = document.getElementById('processBtn');
    const quality = document.getElementById('quality');
    const maxSize = document.getElementById('maxSize');
    const widthInput = document.getElementById('width');
    const heightInput = document.getElementById('height');
    const maintainAspect = document.getElementById('maintainAspect');

    // Bail out if this isn't the home page
    if (!fileInput || !processBtn) return;

    // File input handler
    fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
            handleImageFile(e.target.files[0]);
        }
    });

    // Compression button
    processBtn.addEventListener('click', compressImage);

    // Real-time updates for sliders
    quality.addEventListener('input', function (e) {
        document.getElementById('qualityValue').textContent = e.target.value + '%';
    });

    maxSize.addEventListener('input', function (e) {
        document.getElementById('maxSizeValue').textContent = e.target.value + ' KB';
    });

    // Maintain aspect ratio
    widthInput.addEventListener('input', function (e) {
        if (maintainAspect.checked && originalImageData) {
            const ratio = originalImageData.height / originalImageData.width;
            heightInput.value = Math.round(e.target.value * ratio);
        }
    });

    heightInput.addEventListener('input', function (e) {
        if (maintainAspect.checked && originalImageData) {
            const ratio = originalImageData.width / originalImageData.height;
            widthInput.value = Math.round(e.target.value * ratio);
        }
    });
});