// Builds the Form 16 PDF from the SAME Form16Preview markup that is shown on screen,
// so the downloaded file always contains the complete certificate
// (Part A + Part B + annexures + notes/legend) over as many A4 pages as needed.
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import Form16Preview from '../pages/Form16Preview';

const CAPTURE_WIDTH = 1000;   // CSS px used for rendering; wide enough for crisp, readable text
const SCALE = 2;              // canvas resolution multiplier
const MARGIN = 24;            // pt, around every PDF page

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// Collect Y positions (relative to the paper top, in CSS px) where a page may be cut.
function collectBreaks(paper) {
  const top = paper.getBoundingClientRect().top;
  const rel = (el) => el.getBoundingClientRect().bottom - top;

  // Never cut through a cell that spans several rows (signature box, rowSpan headers)
  const forbidden = [...paper.querySelectorAll('td[rowspan], th[rowspan]')].map((c) => {
    const r = c.getBoundingClientRect();
    return [r.top - top + 1, r.bottom - top - 1];
  });
  const allowed = (y) => !forbidden.some(([a, b]) => y > a && y < b);

  const candidates = [];
  paper.querySelectorAll('tr').forEach((tr) => candidates.push(rel(tr)));
  [...paper.children].forEach((el) => {
    if (!el.classList.contains('form16-watermark')) candidates.push(rel(el));
  });

  // Page gaps in the preview mark where Part A / Part B / annexures start a new page
  const forced = [...paper.querySelectorAll('.f16-page-gap')].map((g) => {
    const r = g.getBoundingClientRect();
    return { cut: r.top - top, resume: r.bottom - top };
  });

  return { candidates: candidates.filter(allowed).sort((a, b) => a - b), forced };
}

export async function downloadForm16Pdf(props, fileName) {
  const host = document.createElement('div');
  host.className = 'f16-fullview f16-capture';
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${CAPTURE_WIDTH}px;background:#fff;z-index:-1;`;
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    flushSync(() => root.render(createElement(Form16Preview, props)));
    if (document.fonts?.ready) await document.fonts.ready;
    await nextFrame();

    const paper = host.querySelector('.form16-paper');
    if (!paper) throw new Error('Form 16 content is not available.');

    // Drop on-screen-only helpers from the PDF
    paper.querySelectorAll('.f16-preview-note').forEach((n) => n.remove());
    paper.querySelectorAll('.f16-page-gap').forEach((g) => { g.style.borderTop = '0'; });
    paper.style.overflow = 'visible';
    paper.style.minHeight = '0';
    paper.style.padding = '0';
    // Keep the watermark light and stretch it over the whole certificate
    const wm = paper.querySelector('.form16-watermark span');
    if (wm) wm.style.fontSize = '64px';

    // html2canvas draws text differently from the browser when overflow-wrap:anywhere is used
    // (squashed words + different row heights), which pushed page cuts into the middle of rows.
    paper.querySelectorAll('*').forEach((el) => {
      el.style.overflowWrap = 'normal';
      el.style.wordBreak = 'normal';
    });
    await nextFrame();

    const { candidates, forced } = collectBreaks(paper);
    const paperH = paper.getBoundingClientRect().height;
    const canvas = await html2canvas(paper, { scale: SCALE, backgroundColor: '#fff', useCORS: true, logging: false });
    // Map DOM positions onto the canvas even if html2canvas ended up a few px taller/shorter
    const ratio = canvas.height / SCALE / paperH;
    const fix = (y) => y * ratio;
    const cand = candidates.map(fix);
    const gaps = forced.map((f) => ({ cut: fix(f.cut), resume: fix(f.resume) }));

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const contentW = pageW - MARGIN * 2;
    const k = contentW / paper.getBoundingClientRect().width; // CSS px -> pt
    const pageHpx = (pageH - MARGIN * 2) / k;               // usable page height in CSS px
    const totalPx = canvas.height / SCALE;

    let start = 0;
    let first = true;
    while (start < totalPx - 1) {
      const limit = start + pageHpx;
      let end;
      let nextStart;
      const gap = gaps.find((f) => f.cut > start + 1 && f.cut <= limit);
      if (gap) {
        end = gap.cut; nextStart = gap.resume;
      } else if (limit >= totalPx) {
        end = totalPx; nextStart = totalPx;
      } else {
        const fits = cand.filter((y) => y > start + pageHpx * 0.3 && y <= limit);
        end = fits.length ? fits[fits.length - 1] : limit;  // fall back to a hard cut only if a block is taller than a page
        nextStart = end;
      }

      if (end - start < 12) { start = Math.max(nextStart, start + 1); continue; }   // skip slivers -> no blank pages
      const sliceH = Math.max(1, Math.round((end - start) * SCALE));
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, Math.round(start * SCALE), canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      if (!first) doc.addPage();
      first = false;
      doc.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', MARGIN, MARGIN, contentW, (sliceH / SCALE) * k, undefined, 'FAST');
      start = nextStart;
    }

    // Page numbers
    const pages = doc.getNumberOfPages();
    doc.setFontSize(7); doc.setTextColor(120);
    for (let i = 1; i <= pages; i += 1) {
      doc.setPage(i);
      doc.text(`Page ${i} of ${pages}`, pageW / 2, pageH - 10, { align: 'center' });
    }
    doc.save(fileName);
  } finally {
    root.unmount();
    host.remove();
  }
}