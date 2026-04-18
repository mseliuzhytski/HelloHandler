

pdfjsLib.GlobalWorkerOptions.workerSrc = "pdf.worker.min.js";

let condFileOpen = false;

///         Verticsal Label Scroll          ///

const thumb = document.querySelector('.scroll-thumb');
const bar = document.querySelector('.scroll-bar');
const content = document.querySelector('.cs-1');

///         Horizontal Label Scroll         ///      

const thumbH = document.querySelector('.scroll-thumb-h');
const barH = document.querySelector('.scroll-bar-h');
const contentH = document.querySelector('.l-c');

///         Preview Label           ///

const previewCanvas = document.getElementById("pdfPreview");
const overlayCanvas = document.getElementById("overlay");
const overlayCtx = overlayCanvas.getContext("2d");

let scalePrevW = 0;
let scalePrevH = 0;

let crop = {
    x: 0,
    y: 0,
    w: contentH.offsetWidth,
    h: 30
};

let normalized = {
  x: 1,
  y: 1,
  w: 0,
  h: 0
};


///         Verticsal Label Scroll          ///

let isDragging = false;
let startY, startTop;

thumb.addEventListener('mousedown', (e) => {
    isDragging = true;
    startY = e.clientY;
    startTop = thumb.offsetTop;
    document.body.style.userSelect = 'none';
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
});

document.addEventListener('mousemove', (e) => {
    if(!condFileOpen) return;
    if (!isDragging) return;

    const delta = e.clientY - startY;
    let newTop = startTop + delta;

    const maxTop = bar.clientHeight - thumb.clientHeight;

    // clamp
    if (newTop < 0) newTop = 0;
    if (newTop > maxTop) newTop = maxTop;

    thumb.style.top = newTop + 'px';

    // map scrollbar position → content movement
    const scrollRatio = newTop / maxTop;

    const maxScroll = content.scrollHeight - bar.clientHeight + 8; // BORDER OFFSET

    content.style.marginTop = -(scrollRatio * maxScroll) + 'px';
});


///         Horizontal Label Scroll         ///      

let isDraggingH = false;
let startX, startLeft;

thumbH.addEventListener('mousedown', (e) => {
    isDraggingH = true;
    startX = e.clientX;
    startLeft = thumbH.offsetLeft;
    document.body.style.userSelect = 'none';
});

document.addEventListener('mouseup', () => {
    isDraggingH = false;
    document.body.style.userSelect = '';
});

document.addEventListener('mousemove', (e) => {
    if(!condFileOpen) return;
    if (!isDraggingH) return;

    const delta = e.clientX - startX;
    let newLeft = startLeft + delta;

    const maxLeft = barH.clientWidth - thumbH.clientWidth;

    // clamp
    if (newLeft < 0) newLeft = 0;
    if (newLeft > maxLeft) newLeft = maxLeft;

    thumbH.style.left = newLeft + 'px';

    // map position → height
    const ratio = newLeft / maxLeft;

    const minHeight = 30 - 4;   // smallest height   // BORDER OFFSET
    const maxHeight = contentH.offsetHeight-8;  // biggest height   // BORDER OFFSET

    const newHeight = minHeight + ratio * (maxHeight - minHeight);

    content.style.height = newHeight + 'px';
});


///         Preview Label           ///

document.getElementById("fileInput").addEventListener("change", previewPDF);

async function previewPDF() {
    if (!fileInput.files.length) return;
    else{condFileOpen = true;}

    const file = fileInput.files[0];
    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    const containerWidth = contentH.offsetWidth;
    scalePrevW = contentH.offsetWidth / page.getViewport({ scale: 1 }).width;
    scalePrevH = contentH.offsetHeight / page.getViewport({ scale: 1 }).height;
    const scale = containerWidth / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale });

    const scaleCanvasHeight = document.querySelector('.l-c-c');
    scaleCanvasHeight.style.height = Math.ceil(viewport.height) + 'px';

    previewCanvas.width = viewport.width;
    previewCanvas.height = viewport.height;

    overlayCanvas.width = viewport.width;
    overlayCanvas.height = viewport.height;

    const ctx = previewCanvas.getContext("2d");
    /*
    const overlayCtx = overlayCanvas.getContext("2d");
    
    //rgba(0, 255, 0, 0.5);
    overlayCtx.fillStyle = "rgba(0, 255, 0, 0.5)";
    overlayCtx.fillRect(crop.x,crop.y,crop.w,crop.h);
    */

    await page.render({ canvasContext: ctx, viewport }).promise;

}