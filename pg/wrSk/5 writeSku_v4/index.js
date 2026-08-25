

pdfjsLib.GlobalWorkerOptions.workerSrc = "pdfjs/pdf.worker.min.js";

const logger = document.querySelector('.logger');

//let pdfReady;  
let condFileOpen = false;
//let condPdfReady = false;
let condSkuFileOpen = false;
let condScale2 = false;

const matchHeaderTagsSet = new Set();
const matchHeaderTags = [];
let clmnSku = '';
let clmnQ = '';
let clmnTrkn = '';
let datacsv = [];
let accrl = 0;

// Options: GA-SPST
//let templatelabel = '';

const leorange = '<div class=\"txt-orange\"> ';
const lered = '<div class=\"txt-red\"> ';
const legreen = '<div class=\"txt-green\"> ';
const ediv = '</div>';

const arrSkipPages = [];
let arrSkipCond = false;

//const exTrkcArr = ["1ZJ74 F69 YW 3588 6373","1ZJ74 F69 YW 8806 8925","1ZJ74 F69 YW 8563 8789"];
const matchTrackingFromPagesSet = new Set();
let matchNumPages = 0;
//const matchTrackingFromPagesArr = [Array.from(exTrkcArr)];
const matchTrackingFromPagesArr = [];
const matchSkuFromPagesArr = [];

///         BUTTONS         ///

const prntOp1 = document.querySelector('.prnt-o-1');
const prntOp2 = document.querySelector('.prnt-o-2');

const pgTrvrsP = document.querySelector('.pg-trvrs-prev');
const pgTrvrsN = document.querySelector('.pg-trvrs-next');
const pgTrvrsS = document.querySelector('.pg-trvrs-swtch');

///         TEMPLATE BUTTONS

let templates = [];
const templateListEl = document.getElementById('prnt-o-1-temp-list');

///         Verticsal Label Scroll          ///

let isDragging = false;
let startY, startTop;

const thumb = document.querySelector('.scroll-thumb');
const bar = document.querySelector('.scroll-bar');

const content = document.querySelector('.cs-1');

///         Verticsal Label Scroll X        ///

let isDraggingX = false;

const thumbx = document.querySelector('.scroll-thumb-x');
const barx = document.querySelector('.scroll-bar-x');

///         Verticsal Label Scroll AH        ///

let isDraggingAH = false;

const thumbAh = document.querySelector('.scroll-thumb-Ah');
const barAh = document.querySelector('.scroll-bar-Ah');

const contentA = document.querySelector('.cs-2');

///         Verticsal Label Scroll AL        ///

let isDraggingAL = false;

const thumbAl = document.querySelector('.scroll-thumb-Al');
const barAl = document.querySelector('.scroll-bar-Al');

///         Horizontal Label Scroll         ///    

let isDraggingH = false;
let startX, startLeft;

const thumbH = document.querySelector('.scroll-thumb-h');
const barH = document.querySelector('.scroll-bar-h');
const contentH = document.querySelector('.l-c');

///         Horizontal Label Scroll W       ///    

let isDraggingHW = false;

const thumbHW = document.querySelector('.scroll-thumb-h-w');
const barHW = document.querySelector('.scroll-bar-h-w');

///         Preview Label           ///

//let scalePrevW = 0;
//let scalePrevH = 0;

let crop = {
    x: 0,
    y: 0,
    w: 0,
    h: 0
};


///         Verticsal Label Scroll          ///

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
    if (!condFileOpen) return;
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


///         Verticsal Label Scroll X        ///

thumbx.addEventListener('mousedown', (e) => {
    isDraggingX = true;
    startY = e.clientY;
    startTop = thumbx.offsetTop;
    document.body.style.userSelect = 'none';
});

document.addEventListener('mouseup', () => {
    isDraggingX = false;
    document.body.style.userSelect = '';
});

document.addEventListener('mousemove', (e) => {
    if (!condFileOpen) return;
    if (!isDraggingX) return;

    const delta = e.clientY - startY;
    let newTop = startTop + delta;

    const maxTop = barx.clientHeight - thumbx.clientHeight;

    // clamp
    if (newTop < 0) newTop = 0;
    if (newTop > maxTop) newTop = maxTop;

    thumbx.style.top = newTop + 'px';

    // map scrollbar position → content movement
    const scrollRatio = newTop / maxTop;

    const maxScroll = contentH.scrollWidth - 60;

    //content.style.width = (contentH.scrollWidth - (scrollRatio * maxScroll)-4)+ 'px';
    content.style.marginLeft = (scrollRatio * maxScroll) + 'px';
});

///         Verticsal Label Scroll AH       ///

thumbAh.addEventListener('mousedown', (e) => {
    isDraggingAH = true;
    startY = e.clientY;
    startTop = thumbAh.offsetTop;
    document.body.style.userSelect = 'none';
});

document.addEventListener('mouseup', () => {
    isDraggingAH = false;
    document.body.style.userSelect = '';
});

document.addEventListener('mousemove', (e) => {
    if (!condFileOpen) return;
    if (!isDraggingAH) return;

    const delta = e.clientY - startY;
    let newTop = startTop + delta;

    const maxTop = barAh.clientHeight - thumbAh.clientHeight;

    // clamp
    if (newTop < 0) newTop = 0;
    if (newTop > maxTop) newTop = maxTop;

    thumbAh.style.top = newTop + 'px';

    // map scrollbar position → content movement
    const scrollRatio = newTop / maxTop;

    const maxScroll = contentA.scrollHeight - barAh.clientHeight + 8; // BORDER OFFSET

    contentA.style.marginTop = -(scrollRatio * maxScroll) + 'px';
});

///         Verticsal Label Scroll AL       ///

thumbAl.addEventListener('mousedown', (e) => {
    isDraggingAL = true;
    startY = e.clientY;
    startTop = thumbAl.offsetTop;
    document.body.style.userSelect = 'none';
});

document.addEventListener('mouseup', () => {
    isDraggingAL = false;
    document.body.style.userSelect = '';
});

document.addEventListener('mousemove', (e) => {
    if (!condFileOpen) return;
    if (!isDraggingAL) return;

    const delta = e.clientY - startY;
    let newTop = startTop + delta;

    const maxTop = barAl.clientHeight - thumbAl.clientHeight;

    // clamp
    if (newTop < 0) newTop = 0;
    if (newTop > maxTop) newTop = maxTop;

    thumbAl.style.top = newTop + 'px';

    // map scrollbar position → content movement
    const scrollRatio = newTop / maxTop;

    const maxScroll = contentH.scrollWidth - 60;

    contentA.style.marginLeft = (scrollRatio * maxScroll) + 'px';
});


///         Horizontal Label Scroll         ///      

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
    if (!condFileOpen) return;
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

    const minHeight = 18 - 4;   // smallest height   // BORDER OFFSET
    const maxHeight = contentH.offsetHeight + 8;  // biggest height   // BORDER OFFSET

    const newHeight = minHeight + ratio * (maxHeight - minHeight);

    content.style.height = newHeight + 'px';
});


///         Horizontal Label Scroll W       ///      

thumbHW.addEventListener('mousedown', (e) => {
    isDraggingHW = true;
    startX = e.clientX;
    startLeft = thumbH.offsetLeft;
    document.body.style.userSelect = 'none';
});

document.addEventListener('mouseup', () => {
    isDraggingHW = false;
    document.body.style.userSelect = '';
});

document.addEventListener('mousemove', (e) => {
    if (!condFileOpen) return;
    if (!isDraggingHW) return;

    const delta = e.clientX - startX;
    let newLeft = startLeft + delta;

    const maxLeft = barHW.clientWidth - thumbHW.clientWidth;

    // clamp
    if (newLeft < 0) newLeft = 0;
    if (newLeft > maxLeft) newLeft = maxLeft;

    thumbHW.style.left = newLeft + 'px';

    // map position → height
    const ratio = newLeft / maxLeft;

    const minWidth = 60;   // smallest height   
    const maxWidth = contentH.offsetWidth - 4;  // biggest height 

    const newWidth = maxWidth - ratio * (maxWidth - minWidth);

    content.style.width = newWidth + 'px';
});

///         Preview Label           ///
/*
async function pdfOpenResource() {
    const fileInput = document.getElementById("fileInput");
    condFileOpen = false;
    if (!fileInput.files.length) return;
    else { condFileOpen = true; }

    const file = fileInput.files[0];
    const arrayBuffer = await file.arrayBuffer();

    pdfReady = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    condPdfReady = true;
}
*/

document.getElementById("fileInput").addEventListener("change", previewPDFx);

function previewPDFx() { previewPDF(0) }

async function previewPDF(n) {
    /*
    if(n == 0 ){pdfOpenResource();}
    if (!condPdfReady) {
        pdfOpenResource();
        if(!pdfReady) return;
    }
    const pdf = pdfReady;
    */
    condFileOpen = false;
    if (!fileInput.files.length) return;
    else { condFileOpen = true; }

    const file = fileInput.files[0];
    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    ///     pdfReady shortcut

    let ipg = 1;
    if (n != 0) {
        if (n != 3) {
            const cn = parseInt(document.getElementById("pg-trvrs-curid").innerText);
            if (n == 1) {
                if ((cn - 1) <= 0) return;
                else ipg = cn - 1;
            } else { /// n == 2
                if ((cn + 1) > pdf.numPages) return;
                else ipg = cn + 1;
            }
        } else { /// n == 3
            const sn = parseInt(document.getElementById("pg-trvrs-iid").value);
            if (sn <= 0 || sn > pdf.numPages) return;
            else ipg = sn;
        }
    }

    const page = await pdf.getPage(ipg);

    const previewCanvas = document.getElementById("pdfPreview");
    const overlayCanvas = document.getElementById("overlay");

    const labelContContainer = document.querySelector('.l-c-c');

    //const containerWidth = contentH.offsetWidth;
    //scalePrevW = contentH.offsetWidth / page.getViewport({ scale: 1 }).width;
    //scalePrevH = contentH.offsetHeight / page.getViewport({ scale: 1 }).height;
    //const scale = containerWidth / page.getViewport({ scale: 1 }).width;
    const viewportX = page.getViewport({ scale: 1 });

    let vwprtscl = 1;
    if(viewportX.width < 350){ vwprtscl = 2; condScale2 = true; }

    const viewport = page.getViewport({ scale: vwprtscl });

    //const scaleCanvasHeight = document.querySelector('.l-c-c');
    //scaleCanvasHeight.style.height = Math.ceil(viewport.height) + 'px';

    labelContContainer.style.width = viewport.width + 'px';
    labelContContainer.style.height = viewport.height + 'px';

    if (n == 0) {
        content.style.width = (viewport.width - 4) + 'px';
        content.style.margin = '0px';
        contentA.style.width = (viewport.width - 4) + 'px';
        contentA.style.margin = '18px 0px 0px 0px';
    }
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

    const pgsNmDis = document.getElementById("pg-trvrs-pgsid");
    const pgCurDis = document.getElementById("pg-trvrs-curid");

    pgsNmDis.innerText = pdf.numPages;
    pgCurDis.innerText = ipg;
}


///             Crop Label          ///


async function cropPDF(condArg) {
    //console.log('crop():');
    const fileInput = document.getElementById("fileInput");
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const { PDFDocument } = PDFLib;
    const newPdf = await PDFDocument.create();

    for (let i = 1; i <= pdf.numPages; i++) {
        if (condArg) {
            //console.log('crop(): read only');
            i = parseInt(document.getElementById("pg-trvrs-curid").innerText);
        } else{
            //Skip feature
            parsePageRanges();
        }
        const page = await pdf.getPage(i);

        //const viewport = page.getViewport({ scale: 1 }); // higher = better quality

        const viewportX = page.getViewport({ scale: 1 });
        let vwprtscl = 1;
        if(viewportX.width < 350){ vwprtscl = 2; }
        const viewport = page.getViewport({ scale: vwprtscl });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        const yhDiv = document.getElementById('cs-1id');
        const yhStyle = window.getComputedStyle(yhDiv);
        crop.y = parseFloat(yhStyle.marginTop) + 2.0;
        crop.h = parseFloat(yhStyle.height);
        crop.x = parseFloat(yhStyle.marginLeft) + 2.0;
        crop.w = parseFloat(yhStyle.width);
        if (crop.x + crop.w > contentH.scrollWidth) { crop.w = contentH.scrollWidth - crop.x; }


        /*
        let cropXset = 0;
        let cropYset = 0;
        console.log('l:' + crop.y + ',' + crop.h);

        if (crop.y === 0) { cropYset = 0; }
        else {
            cropYset = ((crop.y) / scalePrevH) * 2;
        }
        if (crop.x === 0) { cropXset = 0; }
        else {
            cropXset = crop.x;
        }
            */

        // 🔥 CROP AREA (YOU WILL ADJUST THIS)
        const cropX = crop.x;
        const cropY = crop.y;
        const cropWidth = crop.w;
        const cropHeight = crop.h;

        const croppedCanvas = document.createElement("canvas");
        const croppedCtx = croppedCanvas.getContext("2d");

        croppedCanvas.width = cropWidth;
        croppedCanvas.height = cropHeight;

        croppedCtx.drawImage(
            canvas,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
        );

        const imgData = croppedCanvas.toDataURL("image/png");

        const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
        const img = await newPdf.embedPng(imgBytes);

        const pageNew = newPdf.addPage([img.width, img.height]);
        pageNew.drawImage(img, {
            x: 0,
            y: 0,
            width: img.width,
            height: img.height
        });
        if (condArg) { i = pdf.numPages + 10; }
    }

    const pdfBytes = await newPdf.save();

    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    /*
    const a = document.createElement("a");
    a.href = url;
    a.download = "cropped_labels.pdf";
    a.click();

    URL.revokeObjectURL(url);
    */
    readLabels(pdfBytes, condArg);
}


///             Read Pdf            ///

async function readLabels(pdfArg, rBtn) {

    /*
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const status = document.getElementById('status');
    const output = document.getElementById('output');

    output.innerText = "";
    status.innerText = "Loading PDF...";

    const arrayBuffer = await pdfArg.arrayBuffer();
    */
    const pdf = await pdfjsLib.getDocument({ data: pdfArg }).promise;

    //status.innerText = "Initializing OCR...";

    const worker = await Tesseract.createWorker("eng", 1, {
        workerPath: 'tesseract/worker.min.js',
        corePath: 'tesseract/tesseract-core.wasm.js',
        langPath: '.'
        //logger: m => console.log(m)
    });

    /*worker.setLogger(m => {
      status.innerText = m.status + " (" + Math.round(m.progress * 100) + "%)";
    });

    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    */

    let fullText = "";

    matchNumPages = pdf.numPages;

    if (!rBtn) {
        matchTrackingFromPagesArr.length = 0;
        matchTrackingFromPagesSet.clear();
    }

    //

    for (let i = 1; i <= pdf.numPages; i++) {
        //status.innerText = "Processing page " + i + " / " + pdf.numPages;

        let page;

        if (rBtn) {
            //console.log('read(): read only');
            i = parseInt(document.getElementById("pg-trvrs-curid").innerText);
            page = await pdf.getPage(1);
        } else {
            //Skip feature
            if (arrSkipCond){
                if(arrSkipPages.includes(i)){
                    matchTrackingFromPagesArr.push("99ZZskipMe");
                    continue;
                }
            }
            page = await pdf.getPage(i);
        }
        const viewport = page.getViewport({ scale: 2 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const { data: { text } } = await worker.recognize(canvas);

        fullText += text;

        if (!rBtn) { matchTrackingFromPagesArr.push(text.trim()); }
        else { logger.innerText = fullText; }
    }
    //logger.innerText = fullText;  

    await worker.terminate();
    //status.innerText = "Done ✅";

    if (!rBtn) {
        //console.log(matchTrackingFromPagesArr);
        const woutprintCond = document.getElementById("dwnld-wout-print-chkid");
        if(woutprintCond.checked){
            sortOnlyMatching();
        } else { csvMatch(); }
    }
}

///             CVS                 ///

function csvParseHeaders(text) {
    const rows = text
        .split("\n")
        .map(r => r.trim())
        .filter(r => r.length > 0)
        .map(r => r.split(","));
    let data = [];
    rows[0].map(x => {
        let ntag = x;
        //if(x[0] == '\"'){x = x.replaceAll("\"","");}
        ntagi = ntag;
        for (let fi = 1; fi < 10; fi++) {
            if (!matchHeaderTagsSet.has(ntagi)) {
                matchHeaderTagsSet.add(ntagi);
                fi = 10;
            }
            else { ntagi = ntag + '-' + fi; }
        }
        ntag = ntagi;
        //matchHeaderTagsSet.push(ntag);
        data[ntag] = [];
    });
    //console.log(matchHeaderTagsSet);
    rows.slice(1).map(row => {
        let obj = {};
        let ri = 0;
        for (const h of matchHeaderTagsSet) {
            //obj[h] = row[i]?.trim();
            //console.log(h,row[i]);
            data[h].push(row[ri]?.trim());
            ri++;
        }
        //console.log('i',obj);
    });
    return data;
}

function csvPapaParcer(text) {
  const result = Papa.parse(text, {
    skipEmptyLines: true
  });

  let headers = result.data[0];
  let rows = result.data.slice(1);

  const headerCount = {};
  const matchHeadersTags = headers.map(h => {
    if (!headerCount[h]) {
      headerCount[h] = 1;
      return h;
    }
    headerCount[h]++;
    return `${h}-${headerCount[h]}`;
  });

  const data = {};
  matchHeadersTags.forEach((h, colIndex) => {
    matchHeaderTags.push(h);
    data[h] = rows.map(row =>
      (row[colIndex] || "").replace(/\n/g, " || ")
    );
  });

  return data;
}

document.getElementById("cfileInput").addEventListener("change", csvOpen);

function csvEnableDivs() {
    const chk = document.getElementById("ds-hdrs-sl-qckid");
    const btn = document.getElementById("ds-hdrs-sl-qid");
    const ln = document.getElementById("mtch-sk-ds-hdrs-sl-cqid");
    if (chk.checked) {
        ln.style.color = 'black';
        btn.classList.remove("ds-hdrs-sl-bq");
        btn.classList.add("selected-0");
    } else {
        ln.style.color = 'grey';
        btn.classList.remove("selected-0");
        btn.classList.add("ds-hdrs-sl-bq");
        btn.innerText = 'show';
        const tags = document.getElementById("ds-hdrs-a-qid");
        if (!tags.classList.contains("hidden")) tags.classList.replace("visible", "hidden");
    }
}

function csvDisableDivs() {
    const chk = document.getElementById("ds-hdrs-sl-qckid");
    const btn = document.getElementById("ds-hdrs-sl-qid");
    const ln = document.getElementById("mtch-sk-ds-hdrs-sl-cqid");
    if (chk.checked) {
        ln.style.color = 'grey';
        btn.classList.remove("selected-0");
        btn.classList.add("ds-hdrs-sl-bq");
        btn.innerText = 'show';
        const tags = document.getElementById("ds-hdrs-a-qid");
        if (!tags.classList.contains("hidden")) tags.classList.replace("visible", "hidden");
    }
}

function csvTagsClick(n, x) {
    let dsid = '';
    let dsexid = '';
    let tagsid = '';
    if (n == 1) {
        dsid = "ds-hdrs-sl-optn-skid";
        dsexid = "ds-hdrs-sl-exskid";
        tagsid = "ds-hdrs-a-skid";
    }
    if (n == 2) {
        dsid = "ds-hdrs-sl-optn-qid";
        dsexid = "ds-hdrs-sl-exqid";
        tagsid = "ds-hdrs-a-qid";
    }
    if (n == 3) {
        dsid = "ds-hdrs-sl-optn-trknid";
        dsexid = "ds-hdrs-sl-extrknid";
        tagsid = "ds-hdrs-a-trknid";
    }
    const skuDs = document.getElementById(dsid);
    const skuDsEx = document.getElementById(dsexid);
    const skuTags = document.getElementById(tagsid);
    if (skuDs.innerText === x) return;
    switch (n) {
        case 1: clmnSku = x; break;
        case 2: clmnQ = x; break;
        case 3: clmnTrkn = x; break;
    }
    skuDs.innerText = x;
    skuDsEx.innerHTML = datacsv[x][0];
    for (const child of skuTags.children) {
        if (child.innerText.trim() === x.trim()) { child.classList.replace("selected-0", "selected-1"); }
        else { if (child.classList.contains("selected-1")) { child.classList.replace("selected-1", "selected-0"); } }
    }
}

function csvAutoTagsClear() {
    const obj = [['', ''], ['', ''], ['', '']];
    obj[0][0] = "ds-hdrs-sl-optn-skid";
    obj[0][1] = "ds-hdrs-sl-exskid";
    obj[1][0] = "ds-hdrs-sl-optn-qid";
    obj[1][1] = "ds-hdrs-sl-exqid";
    obj[2][0] = "ds-hdrs-sl-optn-trknid";
    obj[2][1] = "ds-hdrs-sl-extrknid";
    for (n = 0; n <= 2; n++) {
        dsid = obj[n][0];
        dsexid = obj[n][1];
        const skuDs = document.getElementById(dsid);
        const skuDsEx = document.getElementById(dsexid);
        skuDs.innerText = '';
        skuDsEx.innerHTML = '';
    }
}

function csvAutoSlTags() {
    let dsid = '';
    let dsexid = '';
    let tagsid = '';
    let autosl = false;
    let foundSku, foundQ, foundTrkn = false;
    for (const v of matchHeaderTags) {
        //console.log(v.trim().toLowerCase());
        if (v.trim().toLowerCase().includes("sku") && !foundSku) {
            dsid = "ds-hdrs-sl-optn-skid";
            dsexid = "ds-hdrs-sl-exskid";
            tagsid = "ds-hdrs-a-skid";
            clmnSku = v;
            foundSku = true;
            autosl = true;
        }
        if (v.trim().toLowerCase().includes("quant") && !foundQ) {
            dsid = "ds-hdrs-sl-optn-qid";
            dsexid = "ds-hdrs-sl-exqid";
            tagsid = "ds-hdrs-a-qid";
            clmnQ = v;
            foundQ = true;
            autosl = true;
        }
        if (v.trim().toLowerCase().includes("track") && !foundTrkn) {
            dsid = "ds-hdrs-sl-optn-trknid";
            dsexid = "ds-hdrs-sl-extrknid";
            tagsid = "ds-hdrs-a-trknid";
            clmnTrkn = v;
            foundTrnk = true;
            autosl = true;
        } else { }
        if (autosl) {
            const skuDs = document.getElementById(dsid);
            const skuDsEx = document.getElementById(dsexid);
            const skuTags = document.getElementById(tagsid);
            for (const child of skuTags.children) {
                if (child.innerText.trim() === v.trim()) { child.classList.replace("selected-0", "selected-1"); }
                else { if (child.classList.contains("selected-1")) { child.classList.replace("selected-1", "selected-0"); } }
            }
            skuDs.innerText = v;
            skuDsEx.innerHTML = datacsv[v][0];
            let datav = datacsv[v][0].trim();
            autosl = false;
        }
    }
}


function csvOpen() {
    condSkuFileOpen = false;
    if (!cfileInput.files.length) {
        csvDisableDivs();
        return;
    }
    else { csvEnableDivs(); }
    condSkuFileOpen = true;

    const file = cfileInput.files[0];

    const reader = new FileReader();

    reader.onload = function (e) {

        matchHeaderTags.length = 0;
        datacsv = csvPapaParcer(e.target.result);
        //console.log(datacsv);
        //console.log(matchHeaderTags);
        const hdrMenuSk = document.getElementById("ds-hdrs-a-skid");
        hdrMenuSk.innerHTML = '';
        const hdrMenuQ = document.getElementById("ds-hdrs-a-qid");
        hdrMenuQ.innerHTML = '';
        const hdrMenuTrkn = document.getElementById("ds-hdrs-a-trknid");
        hdrMenuTrkn.innerHTML = '';

        for (const x of matchHeaderTags) {
            //console.log(x,i);
            const newDiv = document.createElement('div');
            newDiv.classList.add('ds-hdrs-sk-tg');
            newDiv.classList.add('selected-0');
            newDiv.innerText = x;
            const newDiv2 = newDiv.cloneNode(true);
            const newDiv3 = newDiv.cloneNode(true);
            newDiv.addEventListener('click', (e) => { csvTagsClick(1, x); });
            newDiv2.addEventListener('click', (e) => { csvTagsClick(2, x); });
            newDiv3.addEventListener('click', (e) => { csvTagsClick(3, x); });
            hdrMenuSk.appendChild(newDiv);
            hdrMenuQ.appendChild(newDiv2);
            hdrMenuTrkn.appendChild(newDiv3);
        }
        csvAutoTagsClear();
        csvAutoSlTags();
        csvAccuarcyInput(accrl);
    };

    reader.readAsText(file);

    //console.log(matchHeaderTags);
}


///             MATCH               ///

function parsePageRanges() {
  arrSkipPages.length = 0; // clear existing contents, keep same array reference

  const input = document.getElementById('pg-trvrs-skip').value.trim();
  if (!input) {arrSkipCond = false; return};

  arrSkipCond = true;
  const parts = input.split(',');

  parts.forEach(part => {
    part = part.trim();
    if (!part) return;

    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end)) return;

      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      for (let i = lo; i <= hi; i++) {
        if (!arrSkipPages.includes(i)) arrSkipPages.push(i);
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && !arrSkipPages.includes(num)) {
        arrSkipPages.push(num);
      }
    }
  });

  arrSkipPages.sort((a, b) => a - b);
}

function startLoadingAni(cond){
    const dv = document.getElementById("loadinganiid");
    if(cond){ dv.classList.replace("hidden", "visible"); }
    else{ dv.classList.replace("visible", "hidden"); }
}

async function csvMatchBtn() {
    const woutprintCond = document.getElementById("dwnld-wout-print-chkid");
    if (!condFileOpen) return;
    if (!condSkuFileOpen && !woutprintCond.checked) return;

    startLoadingAni(true);
    // Let UI update BEFORE blocking work starts
    /*setTimeout(() => {
        cropPDF(false);
        startLoadingAni(false);
    }, 0);
    */
   // use with async
   await new Promise(resolve => setTimeout(resolve, 0));
   await cropPDF(false);
}

function sortOnlyMatching(){
    const cout = document.getElementById("logger-mtch-errid");
    let lni = 1;
    cout.innerHTML = '';
    
    let pnum = 1;

    if(matchTrackingFromPagesArr.length < 1){ cout.innerHTML += lered + lni + ': ' + 'No read data' + ediv; lni++; }

    matchSkuFromPagesArr.length = 0;

    matchTrackingFromPagesArr.forEach(v => {
        //Skip feature
        if (arrSkipCond){
            if(arrSkipPages.includes(pnum)){
                pnum++;
                return;
            }
        }
        cout.innerHTML += legreen + lni + ': pg.' + pnum + ' read: '+ v + ediv; lni++;
        pnum++;
        matchSkuFromPagesArr.push(v);
    });
    startLoadingAni(false);
}

function csvMatch() {

    if(!condSkuFileOpen) { return; }

    const cout = document.getElementById("logger-mtch-errid");
    const chkQ = document.getElementById("ds-hdrs-sl-qckid");
    let lni = 1;
    //const accrv = document.getElementById("mtch-accr-iid");

    cout.innerHTML = '';

    matchSkuFromPagesArr.length = matchNumPages;
    matchSkuFromPagesArr.forEach(x => x = 'N/A');

    let tpnum = 1;
    //console.log('data:',datacsv);
    //console.log('SQT',clmnSku,clmnQ,clmnTrkn);
    //console.log('accrl',accrl);

    const datacsvo = Object.values(datacsv[clmnTrkn]);

    if (!clmnTrkn || clmnTrkn.length < 1) { cout.innerHTML += lered + lni + ': ' + 'Tracking column not selected' + ediv; lni++; }
    if (!clmnSku || clmnSku.length < 1) { cout.innerHTML += lered + lni + ': ' + 'Sku column not selected' + ediv; lni++; }
    if (!datacsvo || datacsvo.length < 1) { cout.innerHTML += leorange + lni + ': ' + 'No Tracking column values' + ediv; lni++; }

    const rwarr = [];
    for (let rwarri = 2; rwarri < datacsvo.length + 2; rwarri++) {
        rwarr.push(rwarri);
    }

    for (const tnum of matchTrackingFromPagesArr) {
        //Skip feature
        if (arrSkipCond){
            if(arrSkipPages.includes(tpnum)){
                tpnum++;
                continue;
            }
        }
        let infread = tnum.trim().replaceAll(' ', '').toUpperCase();
        let infreada = infread;
        /// CHECK
        if (!infread || infread.length < 1) { cout.innerHTML += leorange + lni + ': ' + 'WRN: pg. ' + tpnum + ' NO READ' + ediv; lni++; }

        let infreqt = '';
        let infreqa = '';
        //let infreqr = '';
        let infquant = 0;
        //let infitemi = 0;
        let infsku = '';

        let mtchfound = false;

        for (let rwi = 0; rwi < datacsvo.length; rwi++) {
            const rwvraw = datacsvo[rwi];
            if (!rwvraw || rwvraw.length < 1) {
                cout.innerHTML += leorange + lni + ': ' + 'column: ' + clmnTrkn + ' row: ' + rwarr[rwi] + ' EMPTY' + ediv; lni++;
                datacsvo.splice(rwi, 1);
                rwarr.splice(rwi, 1);
                rwi--;
            } else {
                let rwv = rwvraw.trim();
                if (rwv[0] === '\"') { rwv = rwv.slice(1, rwv.length - 1); }
                infreqt = rwv.replaceAll(' ', '').toUpperCase();
                if (accrl == 0 || accrl == rwv.length) {
                    infreqa = infreqt;
                    //infreqr = '';
                } else {
                    infreqa = infreqt.slice((infreqt.length - accrl), (infreqt.length));
                    //infreqr = infreqt.slice(0, (infreqt.length - accrl));
                    infreada = infread.slice((infread.length - accrl), infread.length);
                }

                if (infreqa === infreada) {
                    mtchfound = true;

                    let qv = 0;
                    let sv = '';
                    if (matchTrackingFromPagesSet.has(rwvraw)) {
                        if (chkQ.checked && !clmnQ.length < 1) {
                            qv = parseInt(datacsv[clmnQ][rwarr[rwi] - 2]);
                            if (!qv || qv < !Number.isInteger(qv) || qv < 1) {
                                cout.innerHTML += lered + lni + ': ' + 'qauntity column:' + clmnQ + ' -> value ERROR row: ' + rwarr[rwi] + ' !!!' + ediv; lni++;
                            } else {
                                infquant += qv;
                            }
                        } else {
                            infquant++;
                            qv++;
                        }
                        sv = datacsv[clmnSku][rwarr[rwi] - 2].trim();
                        if (infsku !== sv) {
                            //infitemi++;
                            //infsku = '( ' + infitemi + ' items )';
                            infsku = '( # items )';
                        }
                    } else {
                        matchTrackingFromPagesSet.add(rwvraw);
                        infquant = 1;
                        qv = 1;
                        //infitemi = 1;
                        if (chkQ.checked && !clmnQ.length < 1) {
                            qv = parseInt(datacsv[clmnQ][rwarr[rwi] - 2]);
                            if (!qv || qv < !Number.isInteger(qv) || qv < 1) {
                                cout.innerHTML += lered + lni + ': ' + 'qauntity column:' + clmnQ + ' -> value ERROR row: ' + rwarr[rwi] + ' !!!' + ediv; lni++;
                            } else {
                                infquant = qv;
                            }
                        } else { }
                        sv = datacsv[clmnSku][rwarr[rwi] - 2].trim();
                        if (!sv || sv.length < 1) {
                            cout.innerHTML += lered + lni + ': ' + 'sku column:' + clmnSku + ' -> value ERROR row: ' + rwarr[rwi] + ' !!!' + ediv; lni++;
                            infsku = 'ERROR';
                        } else {
                            infsku = sv;
                        }
                    }
                    cout.innerHTML += legreen + lni + ': row:' + rwarr[rwi] + ' MATCH'+ ' pg: '+ tpnum  + ' Rdt: ' + infread + ' | Rqt: ' + infreqt +' || '+qv+'x '+sv+ediv; lni++;
                    datacsvo.splice(rwi, 1);
                    rwarr.splice(rwi, 1);
                    rwi--;
                }
            }
        }
        if (!mtchfound) {
            //cout.innerHTML += legreen + lni+': '+'- - - - -' + ediv;lni++;
            //cout.innerHTML += legreen + lni+': '+'Rd:'+infread + ' | Rda: '+ infreada+ ediv;lni++;
            cout.innerHTML += lered + lni + ': ' + 'NO MATCH FOUND'+ ' pg: '+ tpnum  + ' Rdt: ' + infread + ediv; lni++;
            //cout.innerHTML += legreen + lni+': '+'- - - - -' + ediv;lni++;
        } else {
            matchSkuFromPagesArr[tpnum-1] = +infquant + 'x ' + infsku;
            if(infquant > 1){
                cout.innerHTML += leorange + lni + ': ' + 'WRITE SKU' + ' pg: '+ tpnum + ' || '+infquant + 'x ' + infsku+ ediv; lni++;
            }
        }
        tpnum++;
    }
    startLoadingAni(false);
}


///             DOWNLOAD            ///

async function csvDwnldBtn(){

    if(!condFileOpen || matchSkuFromPagesArr.length < 1){
        console.log('no skus to print'); 
        return;
    }

    const fileInput = document.getElementById("fileInput");
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const arrayBuffer = await file.arrayBuffer();

    // Load PDF with pdf-lib
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // --- Build a sortable array of { pageIndex, sku } ---
    const pageSkuMap = pages.map((page, index) => ({
        pageIndex: index,
        sku: matchSkuFromPagesArr[index] || 'N/A'
    }));

    const woutprintCond = document.getElementById("dwnld-wout-print-chkid");
    if(!woutprintCond.checked){

    // Write SKU text on each page first
    pageSkuMap.forEach(({ pageIndex, sku }) => {
        //Skip feature
        if (arrSkipCond){
            if(arrSkipPages.includes(pageIndex+1)){
                return;
            }
        }

        const page = pages[pageIndex];
        const { width, height } = page.getSize();
        const text = sku;

        let xc = parseFloat(contentA.style.marginLeft);
        let yc = (parseFloat(contentA.style.marginTop) + 16);
        let fontsize = 12;

        if(text.length > 22){ fontsize = 6; }
        if(text.length > 20){ fontsize = 8; }
        if(text.length > 18){ fontsize = 10; }

        if(condScale2){
            xc /= 2;
            yc /= 2;
        }

        page.drawText(text, {
            x: xc,
            y: height - yc,
            size: fontsize,
            font: font,
            color: rgb(0, 0, 0),
        });
    });

    }       ///     sort only conditional IF 

    // --- Sort pages by SKU ---
    // "N/A" pages are pushed to the end; numeric SKUs sorted numerically,
    // mixed/alpha SKUs sorted alphabetically after numerics
    pageSkuMap.sort((a, b) => {
        if(a.sku === 'N/A') return 1;
        if(b.sku === 'N/A') return -1;

        /*
        const numA = parseFloat(a.sku);
        const numB = parseFloat(b.sku);
        const aIsNum = !isNaN(numA);
        const bIsNum = !isNaN(numB);

        if(aIsNum && bIsNum) return numA - numB;   // both numeric
        if(aIsNum) return -1;                       // numeric before alpha
        if(bIsNum) return 1;
        */
        return a.sku.localeCompare(b.sku);          // both alpha
    });
    //console.log(pageSkuMap);

    // --- Rebuild PDF with sorted page order ---
    const sortedDoc = await PDFDocument.create();

    for (const entry of pageSkuMap) {
        const [copiedPage] = await sortedDoc.copyPages(pdfDoc, [entry.pageIndex]);
        sortedDoc.addPage(copiedPage);
    }

    // Save modified PDF
    const pdfBytes = await sortedDoc.save();

    // Trigger download
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "modified.pdf";
    a.click();

    URL.revokeObjectURL(url);

}


///             BUTTONS             ///

prntOp1.addEventListener('click', (e) => {
    prntOptions1n2(1);
});

prntOp2.addEventListener('click', (e) => {
    prntOptions1n2(2);
});

pgTrvrsP.addEventListener('click', (e) => {
    previewPDF(1);
});

pgTrvrsN.addEventListener('click', (e) => {
    previewPDF(2);
});

pgTrvrsS.addEventListener('click', (e) => {
    previewPDF(3);
});

document.getElementById("ds-hdrs-sl-skid").addEventListener('click', (e) => {
    displayHeaderTagsToggle(1);
});

document.getElementById("ds-hdrs-sl-qid").addEventListener('click', (e) => {
    displayHeaderTagsToggle(2);
});

document.getElementById("ds-hdrs-sl-trknid").addEventListener('click', (e) => {
    displayHeaderTagsToggle(3);
});

document.getElementById("ds-hdrs-sl-qckid").addEventListener('change', (e) => {
    if (!condSkuFileOpen) return;
    csvEnableDivs();
});

document.getElementById("mtch-accr-iid").addEventListener("change", (e) => { csvAccuarcyInput(e.target.value); });

function csvAccuarcyInput(n) {
    //console.log('accrl':accrl);
    const dsinptv = document.getElementById("mtch-accr-iid");
    let v = parseInt(n);
    if (!condSkuFileOpen) {
        dsinptv.value = v;
        return;
    }
    const extxtraw = document.getElementById("ds-hdrs-sl-extrknid");
    const extxt = extxtraw.innerText.trim();
    const dsex = document.getElementById("mtch-accr-dsid");
    const dsexlngth = document.getElementById("mtch-accr-dslngthid");
    if (extxt.at(0) === '\"') {
        const vl = extxt.length - 2;
        const vtxt = extxt;
        dsexlngth.innerText = vl;
        if (v <= 0 || v > vl){ v = vl };
        accrl = v;
        let dif = vl - v;
        dsex.innerHTML = '\"' + vtxt.slice(1, dif + 1) + '<div class=\"highlighted-g\">' + vtxt.slice(dif + 1, vl + 1) + '</div>\"';
    } else {
        const vl = extxt.length;
        const vtxt = extxt;
        dsexlngth.innerText = vl;
        if (v <= 0 || v > vl){ v = vl };
        accrl = v;
        let dif = vl - v;
        dsex.innerHTML = '\"' + vtxt.slice(0, dif) + '<div class=\"highlighted-g\">' + vtxt.slice(dif, vl) + '</div>\"';
    }
    dsinptv.value = v;
}

document.getElementById("mtch-accr-btnid").addEventListener('click', (e) => {
    csvAccuarcyInput(0);
});

function displayHeaderTagsToggle(n) {
    if (!condSkuFileOpen) return;
    let btnid = "";
    let dsid = "";
    if (n == 2) {
        const n2ck = document.getElementById("ds-hdrs-sl-qckid");
        if (!n2ck.checked) return;
        btnid = "ds-hdrs-sl-qid";
        dsid = "ds-hdrs-a-qid";
    }
    if (n == 1) {
        btnid = "ds-hdrs-sl-skid";
        dsid = "ds-hdrs-a-skid";
    }
    if (n == 3) {
        btnid = "ds-hdrs-sl-trknid";
        dsid = "ds-hdrs-a-trknid";
    }
    const btn = document.getElementById(btnid);
    const dscl = document.getElementById(dsid);
    if (dscl.classList.contains("hidden")) {
        btn.innerText = 'hide';
        dscl.classList.replace("hidden", "visible");
    } else {
        btn.innerText = 'show';
        dscl.classList.replace("visible", "hidden");
    }

}

function prntOptions1n2(n) {
    const checkClass = document.querySelector('.prnt-o-1');

    if ((n == 1 && checkClass.classList.contains("selected-0")) ||
        (n == 2 && checkClass.classList.contains("selected-1"))) {
        const otherClass = document.querySelector('.prnt-o-2');
        const prntOp1tm = document.querySelector('.prnt-o-1-tm');
        const prntOp2tm = document.querySelector('.prnt-o-2-tm');
        const scrBr = document.querySelector('.scroll-bar');
        const scrBrX = document.querySelector('.scroll-bar-x');
        const scrBrH = document.querySelector('.scroll-bar-h');
        const scrBrHW = document.querySelector('.scroll-bar-h-w');

        if (n == 1) {
            checkClass.classList.replace("selected-0", "selected-1");
            otherClass.classList.replace("selected-1", "selected-0");

            prntOp1tm.classList.replace("hidden", "visible");
            prntOp2tm.classList.replace("visible", "hidden");

            content.classList.replace("invisible", "display");
            scrBr.classList.replace("invisible", "display");
            scrBrX.classList.replace("invisible", "display");
            scrBrH.classList.replace("invisible", "display");
            scrBrHW.classList.replace("invisible", "display");

        } else { // n == 2
            checkClass.classList.replace("selected-1", "selected-0");
            otherClass.classList.replace("selected-0", "selected-1");

            prntOp2tm.classList.replace("hidden", "visible");
            prntOp1tm.classList.replace("visible", "hidden");

            content.classList.replace("display", "invisible");
            scrBr.classList.replace("display", "invisible");
            scrBrX.classList.replace("display", "invisible");
            scrBrH.classList.replace("display", "invisible");
            scrBrHW.classList.replace("display", "invisible");
        }
    }
    /*
    if(n == 1 && checkClass.classList.contains("selected-0")){ 
    }
    if(n == 2 && checkClass.classList.contains("selected-1")){
    }
    */
}

///             TEMPLATE BUTTONS

function tempLcsvLineToFields(line) {
    return line.split(',').map(f => f.trim());
}

function tempLparseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    return lines.slice(1).map(line => {
    const [id, name, widthGreen, heightGreen, topGreen, leftGreen, topRed, leftRed, accuracy] = tempLcsvLineToFields(line);
    return {
        id, name, widthGreen, heightGreen, topGreen, leftGreen, topRed, leftRed,
        accuracy: accuracy ? parseFloat(accuracy) : 10
    };
    });
}

function tempLapplyTemplate(t) {
    content.style.width = t.widthGreen;
    content.style.height = t.heightGreen;
    content.style.marginTop = t.topGreen;
    content.style.marginLeft = t.leftGreen;

    contentA.style.marginLeft = t.leftRed;
    contentA.style.marginTop = t.topRed;

    accrl = t.accuracy;
    csvAccuarcyInput(t.accuracy);
}

function tempLrenderTemplates() {
    templateListEl.innerHTML = '';

    const noneDiv = document.createElement('div');
    noneDiv.className = 'prnt-o-1-temp selected-0';
    noneDiv.id = 'prnt-o-1-naid';
    noneDiv.textContent = 'None';
    templateListEl.appendChild(noneDiv);

    templates.forEach(t => {
    const div = document.createElement('div');
    div.className = 'prnt-o-1-temp selected-0';
    div.id = t.id;
    div.textContent = t.name;
    div.addEventListener('click', () => {
        if (!condFileOpen) return;
        tempLapplyTemplate(t);
    });
    templateListEl.appendChild(div);
    });
}

function tempLnextCustomId() {
    let max = 0;
    templates.forEach(t => {
    const m = t.id.match(/^prnt-o-1-cust-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'prnt-o-1-cust-' + (max + 1);
}

function tempLdownloadCSV() {
    const header = 'Id,Template Name,Width-Green,Height-Green,Top-Green,Left-Green,Top-Red,Left-Red,Accuracy';
    const rows = templates.map(t =>
    [t.id, t.name, t.widthGreen, t.heightGreen, t.topGreen, t.leftGreen, t.topRed, t.leftRed, t.accuracy].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Templ_Buttons.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

document.getElementById('prnt-o-1-custom-save').addEventListener('click', () => {
    const nameInput = document.getElementById('prnt-o-1-custom-name');
    const accInput = document.getElementById('prnt-o-1-custom-accuracy');

    const name = nameInput.value.trim();
    if (!name) { alert('Please enter a template name.'); return; }

    const accuracy = accInput.value.trim() ? parseFloat(accInput.value.trim()) : 10;

    templates.push({
    id: tempLnextCustomId(),
    name,
    widthGreen: content.style.width,
    heightGreen: content.style.height,
    topGreen: content.style.marginTop,
    leftGreen: content.style.marginLeft,
    topRed: contentA.style.marginTop,
    leftRed: contentA.style.marginLeft,
    accuracy
    });

    tempLrenderTemplates();
    tempLdownloadCSV();

    nameInput.value = '';
    accInput.value = '';
});

///             MISCELLANEOUS

function showContex() {
    const overlayCanvas = document.getElementById("overlay");
    const overlayCtx = overlayCanvas.getContext("2d");

    const yhDiv = document.getElementById('cs-1id');
    const yhStyle = window.getComputedStyle(yhDiv);
    const y = parseFloat(yhStyle.marginTop) + 2;
    const h = parseFloat(yhStyle.height);

    //rgba(0, 255, 0, 0.5);
    overlayCtx.fillStyle = "rgba(0, 255, 0, 0.5)";
    overlayCtx.fillRect(crop.x, y, crop.w, h);
    console.log('cor:' + crop.x + ',' + y + ',' + crop.w + ',' + h);
}

function processName() {
    const fileInput = document.getElementById("fileInput");
    if (!fileInput.files.length) return;
    cropPDF(true);
}