/* DIAFILM
  --------------------------------------------------
  Soviet film strip emulator.
  Part of the Kasseta family of tools.
  --------------------------------------------------
*/

console.log(
    "%c DIAFILM %c Curated by human for humans %c",
    "background: #e8b84b; color: #221214; font-weight: bold; padding: 3px 10px; border: 1px solid #5a3030; border-radius: 3px 0 0 3px;",
    "background: #221214; color: #e8b84b; padding: 3px 10px; border: 1px solid #5a3030; border-radius: 0 3px 3px 0;",
    ""
);

const canvas  = document.getElementById('canvas');
const ctx     = canvas.getContext('2d', { willReadFrequently: true });
const upload  = document.getElementById('upload');
const warmthInput   = document.getElementById('warmth');
const scratchesInput= document.getElementById('scratches');
const vignetteInput = document.getElementById('vignette');
const frameCheck    = document.getElementById('showFrame');
const optimizeCheck = document.getElementById('optimizeWeight');
const captionInput  = document.getElementById('captionText');
const statsBox      = document.getElementById('stats');
const canvasWrap    = document.getElementById('canvasWrap');
const aboutBtn      = document.getElementById('aboutBtn');
const modalOverlay  = document.getElementById('modalOverlay');
const closeModalCross = document.getElementById('closeModalCross');

let originalImg  = null;
let originalSize = 0;

const offscreen = document.createElement('canvas');
const offCtx    = offscreen.getContext('2d', { willReadFrequently: true });

// 1. Загрузка
upload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    originalSize = (file.size / 1024).toFixed(1);
    statsBox.innerHTML = 'status: loading...';

    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            canvas.width  = img.width;
            canvas.height = img.height;
            offscreen.width  = img.width;
            offscreen.height = img.height;
            originalImg = img;
            canvasWrap.style.display = 'flex';
            process();
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

// 2. Слушатели — мгновенный отклик
[warmthInput, scratchesInput, vignetteInput, frameCheck, optimizeCheck]
    .forEach(el => el.addEventListener('input', process));

captionInput.addEventListener('input', process);

// 3. Обработка
function process() {
    if (!originalImg) return;

    const W = offscreen.width;
    const H = offscreen.height;

    offCtx.filter = 'none';
    offCtx.drawImage(originalImg, 0, 0);

    // Лёгкое размытие для оптимизации
    if (optimizeCheck.checked) {
        offCtx.filter = 'blur(0.35px) saturate(1.03)';
        const tmp = document.createElement('canvas');
        tmp.width = W; tmp.height = H;
        tmp.getContext('2d').drawImage(offscreen, 0, 0);
        offCtx.drawImage(tmp, 0, 0);
        offCtx.filter = 'none';
    }

    const imgData = offCtx.getImageData(0, 0, W, H);
    const data    = imgData.data;
    const warmth  = parseInt(warmthInput.value);

    // --- ЗЕРНО (фиксированное) ---
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() + Math.random() + Math.random() - 1.5) * 20;
        data[i]     = clamp(data[i]     + noise);
        data[i + 1] = clamp(data[i + 1] + noise);
        data[i + 2] = clamp(data[i + 2] + noise);
    }

    // --- ТЁПЛЫЙ ТОН ---
    if (warmth > 0) {
        const rShift =  warmth * 0.45;
        const gShift =  warmth * 0.12;
        const bShift =  warmth * 0.55;
        for (let i = 0; i < data.length; i += 4) {
            data[i]     = clamp(data[i]     + rShift);
            data[i + 1] = clamp(data[i + 1] + gShift);
            data[i + 2] = clamp(data[i + 2] - bShift);
        }
    }

    offCtx.putImageData(imgData, 0, 0);

    // --- ВИНЬЕТКА ---
    const vigStr = parseInt(vignetteInput.value) / 100;
    if (vigStr > 0) {
        const grad = offCtx.createRadialGradient(
            W / 2, H / 2, Math.min(W, H) * 0.25,
            W / 2, H / 2, Math.max(W, H) * 0.78
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${vigStr * 0.8})`);
        offCtx.fillStyle = grad;
        offCtx.fillRect(0, 0, W, H);
    }

    // --- ЦАРАПИНЫ И ПЫЛЬ ---
    const scratchVal = parseInt(scratchesInput.value);
    if (scratchVal > 0) {
        drawScratches(offCtx, W, H, scratchVal);
        drawDust(offCtx, W, H, scratchVal);
    }

    // --- РАМКА + ПЕРФОРАЦИЯ ---
    if (frameCheck.checked) {
        drawFilmFrame(offCtx, W, H);
    }

    // --- ПОДПИСЬ ---
    const caption = captionInput.value.trim();
    if (caption) {
        drawCaption(offCtx, W, H, caption, frameCheck.checked);
    }

    ctx.drawImage(offscreen, 0, 0);

    // Расчёт веса
    const q = optimizeCheck.checked ? Math.max(0.25, 0.85 - (scratchVal / 200)) : 0.92;
    offscreen.toBlob((blob) => {
        const newSize = (blob.size / 1024).toFixed(1);
        const ratio   = (100 - (newSize / originalSize * 100)).toFixed(0);
        updateUI(newSize, ratio);
    }, 'image/jpeg', q);
}

// --- ВСПОМОГАТЕЛЬНЫЕ ---

function clamp(v) { return Math.min(255, Math.max(0, v)); }

function drawScratches(ctx, W, H, intensity) {
    const count = Math.floor(intensity / 10);
    ctx.save();
    for (let i = 0; i < count; i++) {
        const x       = Math.random() * W;
        const opacity = 0.04 + Math.random() * 0.18;
        const lw      = 0.3 + Math.random() * 0.7;
        const startY  = Math.random() * H * 0.2;
        const endY    = H * 0.7 + Math.random() * H * 0.3;
        const dx      = (Math.random() - 0.5) * 4;

        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.bezierCurveTo(
            x + dx * 0.3, startY + (endY - startY) * 0.33,
            x + dx * 0.7, startY + (endY - startY) * 0.66,
            x + dx,       endY
        );
        ctx.strokeStyle = Math.random() > 0.5
            ? `rgba(255,240,200,${opacity})`
            : `rgba(10,5,0,${opacity})`;
        ctx.lineWidth = lw;
        ctx.stroke();
    }
    ctx.restore();
}

function drawDust(ctx, W, H, intensity) {
    const count = Math.floor(intensity * 0.5);
    ctx.save();
    for (let i = 0; i < count; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const r = 0.4 + Math.random() * 1.8;
        const o = 0.08 + Math.random() * 0.25;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = Math.random() > 0.4
            ? `rgba(20,10,5,${o})`
            : `rgba(255,235,180,${o * 0.5})`;
        ctx.fill();
    }
    ctx.restore();
}

function drawFilmFrame(ctx, W, H) {
    const bw = Math.round(Math.min(W, H) * 0.048); // ширина полосы
    const ph = Math.round(bw * 0.7);   // высота перфорации
    const pw = Math.round(bw * 0.45);  // ширина перфорации
    const pr = Math.round(pw * 0.25);  // радиус скругления
    const gap = Math.round(ph * 1.6);  // шаг между отверстиями

    ctx.save();

    // Тёмные полосы сверху и снизу
    ctx.fillStyle = 'rgba(8,4,4,0.92)';
    ctx.fillRect(0, 0, W, bw);
    ctx.fillRect(0, H - bw, W, bw);

    // Тонкая внутренняя линия рамки
    ctx.strokeStyle = 'rgba(160,120,60,0.25)';
    ctx.lineWidth = 1;
    const inset = bw + 2;
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);

    // Перфорация — верхняя полоса
    const cx = Math.round((bw - ph) / 2);  // центрирование по высоте полосы
    const startX = Math.round(gap / 2);
    const countH = Math.ceil(W / gap) + 1;

    for (let i = 0; i < countH; i++) {
        const x = startX + i * gap - pw / 2;
        if (x + pw > W) break;

        // Верхняя перфорация
        roundRect(ctx, x, cx, pw, ph, pr);
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(80,50,30,0.4)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Нижняя перфорация (зеркально)
        roundRect(ctx, x, H - cx - ph, pw, ph, pr);
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(80,50,30,0.4)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    ctx.restore();
}

// Вспомогалка для скруглённых прямоугольников
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawCaption(ctx, W, H, text, hasFrame) {
    const bw       = hasFrame ? Math.round(Math.min(W, H) * 0.048) : 0;
    const fontSize = Math.round(Math.min(W, H) * 0.038);
    const padding  = Math.round(fontSize * 0.6);

    // Подложка под текст
    const boxH  = fontSize + padding * 2;
    const boxY  = H - bw - boxH;

    ctx.save();

    // Полупрозрачная тёмная полоса
    ctx.fillStyle = 'rgba(6,3,3,0.78)';
    ctx.fillRect(0, boxY, W, boxH);

    // Тонкая линия сверху подложки
    ctx.strokeStyle = 'rgba(160,120,60,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, boxY);
    ctx.lineTo(W, boxY);
    ctx.stroke();

    // Текст
    ctx.font = `${fontSize}px "Courier New", monospace`;
    ctx.fillStyle = 'rgba(235,215,160,0.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Обрезаем длинный текст если не влезает
    const maxWidth = W - padding * 4;
    ctx.fillText(text, W / 2, boxY + boxH / 2, maxWidth);

    ctx.restore();
}

function updateUI(newSize, ratio) {
    const color = ratio < 0 ? '#8b3030' : (ratio > 50 ? '#4a6741' : 'inherit');
    statsBox.innerHTML = `
        ORIGINAL: ${originalSize} KB<br>
        DEVELOPED: ${newSize} KB<br>
        SAVED: <b style="color:${color}">${ratio < 0 ? '+' : ''}${Math.abs(ratio)}%</b>
    `;
}

// 4. Скачивание
document.getElementById('download').onclick = () => {
    if (!originalImg) return;
    const scratchVal = parseInt(scratchesInput.value);
    const q = optimizeCheck.checked ? Math.max(0.25, 0.85 - (scratchVal / 200)) : 0.92;

    offscreen.toBlob((blob) => {
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `diafilm_${Date.now()}.jpg`;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/jpeg', q);
};

// 5. Вкладки
function openTab(evt, tabName) {
    for (let c of document.getElementsByClassName('tab-content')) c.classList.remove('active');
    for (let b of document.getElementsByClassName('tab-btn'))     b.classList.remove('active');
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

// 6. Модальное окно
const toggleModal = (show) => {
    modalOverlay.style.display = show ? 'flex' : 'none';
    if (show) {
        const btn = document.querySelector('.tab-btn[onclick*="story"]');
        if (btn) btn.click();
    }
};

aboutBtn.onclick       = () => toggleModal(true);
closeModalCross.onclick= () => toggleModal(false);
window.onclick         = (e) => { if (e.target === modalOverlay) toggleModal(false); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleModal(false); });
