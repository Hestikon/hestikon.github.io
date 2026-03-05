/* ZERNO AESTHETIC */

console.log(
    "%c ZERNO %c OMG! %c",
    "background: #f6e691; color: #333; font-weight: bold; padding: 3px 10px; border: 1px solid #333; border-radius: 3px 0 0 3px;",
    "background: #333; color: #f6e691; padding: 3px 10px; border: 1px solid #333; border-radius: 0 3px 3px 0;",
    ""
);

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const upload = document.getElementById('upload');
const grainInput = document.getElementById('grain');
const optimizeCheck = document.getElementById('optimizeWeight');
const statsBox = document.getElementById('stats');
const canvasWrap = document.getElementById('canvasWrap');

// UI Elements
const aboutBtn = document.getElementById('aboutBtn');
const modalOverlay = document.getElementById('modalOverlay');
const closeModalCross = document.getElementById('closeModalCross');

let originalImg = null;
let originalSize = 0;

// --- Offscreen canvas для безопасной обработки ---
const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

// 1. Загрузка файла
upload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    originalSize = (file.size / 1024).toFixed(1);
    statsBox.innerHTML = 'status: loading...';

    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            offscreen.width = img.width;
            offscreen.height = img.height;
            originalImg = img;
            canvasWrap.style.display = "flex";
            process();
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

// 2. Обработка изображения
[grainInput, optimizeCheck].forEach(el => el.addEventListener('input', process));

function process() {
    if (!originalImg) return;

    // Рисуем оригинал на offscreen, чтобы не читать грязный canvas
    offCtx.filter = 'none';
    offCtx.drawImage(originalImg, 0, 0);

    // Умное размытие на отдельном проходе через offscreen
    if (optimizeCheck.checked) {
        offCtx.filter = 'blur(0.35px) saturate(1.03)';
        // Временный буфер, чтобы избежать drawImage(canvas, canvas)
        const tmp = document.createElement('canvas');
        tmp.width = offscreen.width;
        tmp.height = offscreen.height;
        tmp.getContext('2d').drawImage(offscreen, 0, 0);
        offCtx.drawImage(tmp, 0, 0);
        offCtx.filter = 'none';
    }

    const imgData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
    const data = imgData.data;
    const val = parseInt(grainInput.value);

    // Генерация монохромного зерна (Luma-Injection)
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() + Math.random() + Math.random() - 1.5) * val * 2.8;
        data[i]     = Math.min(255, Math.max(0, data[i]     + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    offCtx.putImageData(imgData, 0, 0);

    // Копируем результат на видимый canvas
    ctx.drawImage(offscreen, 0, 0);

    // Точный расчёт размера через toBlob
    const q = optimizeCheck.checked ? Math.max(0.25, 0.88 - (val / 160)) : 0.95;
    offscreen.toBlob((blob) => {
        const newSize = (blob.size / 1024).toFixed(1);
        const ratio = (100 - (newSize / originalSize * 100)).toFixed(0);
        updateUI(newSize, ratio);
    }, 'image/jpeg', q);
}

function updateUI(newSize, ratio) {
    const color = ratio < 0 ? "#cc0000" : (ratio > 50 ? "#228B22" : "inherit");
    statsBox.innerHTML = `
        ORIGINAL: ${originalSize} KB<br>
        OPTIMIZED: ${newSize} KB<br>
        SAVED: <b style="color: ${color}">${ratio < 0 ? '+' : ''}${Math.abs(ratio)}%</b>
    `;
}

// 3. Скачивание
document.getElementById('download').onclick = () => {
    if (!originalImg) return;
    const val = parseInt(grainInput.value);
    const q = optimizeCheck.checked ? Math.max(0.25, 0.88 - (val / 160)) : 0.95;

    offscreen.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `zerno_${Date.now()}.jpg`;
        link.href = url;
        link.click();
        // Освобождаем память
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/jpeg', q);
};

// 4. Логика вкладок
function openTab(evt, tabName) {
    for (let content of document.getElementsByClassName("tab-content")) {
        content.classList.remove("active");
    }
    for (let btn of document.getElementsByClassName("tab-btn")) {
        btn.classList.remove("active");
    }
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}

// 5. Логика модального окна
const toggleModal = (show) => {
    modalOverlay.style.display = show ? 'flex' : 'none';
    if (show) {
        const storyBtn = document.querySelector('.tab-btn[onclick*="story"]');
        if (storyBtn) storyBtn.click();
    }
};

aboutBtn.onclick = () => toggleModal(true);
closeModalCross.onclick = () => toggleModal(false);
window.onclick = (e) => { if (e.target === modalOverlay) toggleModal(false); };
document.addEventListener('keydown', (e) => { if (e.key === "Escape") toggleModal(false); });
