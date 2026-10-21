// Builds the Form 16 PDF as a real, text-based A4 document that follows the official TRACES
// certificate layout page for page:
//   Part A  -> 2 pages (summary + book/challan details, then challans cont. + verification + notes + legend)
//   Part B  -> 4 pages (Annexure-I in three pages, then the break-up tables + signature)
// Text stays selectable/searchable and nothing is cropped or re-sampled (the old version took a
// screenshot of the on-screen preview and sliced it into pages).
import { jsPDF } from 'jspdf';
import { FORM16_HEADER_IMG, FORM16_WATERMARK_IMG } from './form16Assets.js';
import { a2, computeForm16, dMonY, dmy, dmySlash, inWords, LEGEND, NOTES } from './form16Calc.js';

const PAGE_W = 595.28;
const X0 = 20;                 // left edge of every table (pt)
const W = 559;                 // table width (pt)
const PX_W = 862;              // the official layout measured in px; every table below is expressed in these units
const K = W / PX_W;
const BOTTOM = 806;            // lowest y a table row may reach before a new page is started
const GREY = [192, 192, 192];
const BLUE = [188, 211, 238];

// Standard PDF fonts only know Latin-1 / WinAnsi, so anything else would turn into garbage.
const clean = (s) => String(s ?? '')
  .replace(/₹/g, 'Rs.')
  .replace(/\u2013/g, '-')
  .replace(/[^\n\x20-\x7E\xA0-\xFF\u2018\u2019\u201C\u201D\u2014\u2022]/g, '?');

// ---------------------------------------------------------------------------------------------
// Rich-text engine: word wrap, bold / underline runs, left / centre / right / justified lines.
// ---------------------------------------------------------------------------------------------
function tokenize(content, baseBold) {
  const segs = typeof content === 'string' ? [{ t: content }] : content;
  const toks = [];
  let gap = false;
  segs.forEach((s) => {
    let pre = s.pre || 0;
    clean(s.t).split('\n').forEach((part, pi) => {
      if (pi > 0) { toks.push({ br: true }); gap = false; }
      part.split(' ').forEach((w, wi) => {
        if (wi > 0) gap = true;
        if (w === '') return;
        toks.push({ w, b: s.b ?? baseBold, u: !!s.u, gap, pre });
        pre = 0; gap = false;
      });
    });
  });
  return toks;
}

function layout(doc, content, maxW, sz, baseBold) {
  doc.setFontSize(sz);
  doc.setFont('times', 'normal');
  const spW = doc.getTextWidth(' ') + sz * 0.08;
  const lines = [];
  let cur = { items: [], w: 0, hard: false };
  const flush = (hard) => { cur.hard = hard; lines.push(cur); cur = { items: [], w: 0, hard: false }; };
  tokenize(content, baseBold).forEach((t) => {
    if (t.br) { flush(true); return; }
    doc.setFont('times', t.b ? 'bold' : 'normal');
    const ww = doc.getTextWidth(t.w);
    const gapW = (t.gap ? spW : 0) + (t.pre || 0);
    if (cur.items.length && cur.w + gapW + ww > maxW + 0.01) flush(false);
    const gw = cur.items.length ? gapW : 0;
    cur.items.push({ ...t, ww, gw });
    cur.w += gw + ww;
  });
  if (cur.items.length || lines.length) flush(true);
  return lines;
}

function drawLine(doc, ln, x, baseline, sz, maxW, align) {
  let extra = 0;
  if (align === 'j' && !ln.hard) {
    const gaps = ln.items.filter((it, i) => i > 0 && it.gap).length;
    if (gaps) extra = (maxW - ln.w) / gaps;
  }
  let cx = x;
  if (align === 'c') cx = x + (maxW - ln.w) / 2;
  else if (align === 'r') cx = x + maxW - ln.w;
  doc.setFontSize(sz);
  ln.items.forEach((it, i) => {
    if (i > 0) cx += it.gw + (it.gap ? extra : 0);
    doc.setFont('times', it.b ? 'bold' : 'normal');
    doc.text(it.w, cx, baseline);
    if (it.u) {
      const prev = ln.items[i - 1];
      const from = prev && prev.u && it.gap ? cx - it.gw - extra : cx;
      doc.setLineWidth(0.4);
      doc.line(from, baseline + 1.3, cx + it.ww, baseline + 1.3);
    }
    cx += it.ww;
  });
}

// ---------------------------------------------------------------------------------------------
// Table engine: rows of cells with widths in "official px" (862 = full width), rowSpan via
// `rs` + a `{ skip: w }` spacer in the following row, grey / blue fills, automatic page overflow.
// ---------------------------------------------------------------------------------------------
const C = (w, t, o = {}) => ({ w, t, ...o });

function table(ctx, rows, o = {}) {
  const { doc } = ctx;
  const sz0 = o.sz ?? 8;
  const padX0 = o.padX ?? 4;
  const padY0 = o.padY ?? 3;
  const lhF = o.lh ?? 1.18;
  const x0 = o.x ?? X0;
  const k = o.k ?? K;

  const prep = rows.map((r) => r.cells.map((c) => {
    if (c.skip != null) return c;
    const sz = c.sz ?? r.sz ?? sz0;
    const padX = c.padX ?? padX0;
    const padY = c.padY ?? padY0;
    const maxW = c.w * k - 2 * padX;
    const lines = c.t == null || c.t === '' ? [] : layout(doc, c.t, maxW, sz, !!(c.b ?? r.b));
    const th = lines.length * sz * lhF;
    return { ...c, sz, padX, padY, maxW, lines, th, need: lines.length ? th + 2 * padY : 0 };
  }));

  const hs = rows.map((r) => r.h || 0);
  prep.forEach((cells, i) => cells.forEach((c) => { if (!c.rs && c.skip == null) hs[i] = Math.max(hs[i], c.need); }));
  prep.forEach((cells, i) => cells.forEach((c) => {
    if (c.rs > 1) {
      const last = i + c.rs - 1;
      let span = 0;
      for (let j = i; j <= last; j += 1) span += hs[j];
      if (c.need > span) hs[last] += c.need - span;
    }
  }));

  doc.setDrawColor(0);
  doc.setTextColor(0);
  let i = 0;
  while (i < rows.length) {
    let g = i;
    for (let j = i; j <= g; j += 1) prep[j].forEach((c) => { if (c.rs > 1) g = Math.max(g, j + c.rs - 1); });
    let total = 0;
    for (let j = i; j <= g; j += 1) total += hs[j];
    if (ctx.y + total > BOTTOM && !o.noBreak) ctx.newPage();

    for (let j = i; j <= g; j += 1) {
      let x = x0;
      prep[j].forEach((c) => {
        if (c.skip != null) { x += c.skip * k; return; }
        const cw = c.w * k;
        let ch = hs[j];
        for (let m = 1; m < (c.rs || 1); m += 1) ch += hs[j + m];
        doc.setLineWidth(0.6);
        if (c.fill) { doc.setFillColor(...c.fill); doc.rect(x, ctx.y, cw, ch, 'FD'); } else doc.rect(x, ctx.y, cw, ch, 'S');
        if (c.lines.length) {
          const lh = c.sz * lhF;
          const top = c.v === 't' ? ctx.y + c.padY : ctx.y + (ch - c.th) / 2;
          const align = c.a || 'l';
          c.lines.forEach((ln, li) => {
            drawLine(doc, ln, x + c.padX, top + li * lh + lh / 2 + c.sz * 0.32, c.sz, c.maxW, align);
          });
        }
        x += cw;
      });
      ctx.y += hs[j];
    }
    i = g + 1;
  }
}

// ---------------------------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------------------------
function newPage(ctx, part, first) {
  const { doc, base } = ctx;
  if (ctx.pages.length) doc.addPage();
  ctx.pages.push({ part });
  ctx.part = part;
  doc.addImage(FORM16_WATERMARK_IMG, 'PNG', 134, part === 'A' && first ? 315 : 390, 336, 286.2);
  if (first) {
    doc.addImage(FORM16_HEADER_IMG, 'JPEG', 18, 18, 558, 51.1);
    ctx.y = 70;
  } else {
    doc.setFont('times', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(0);
    doc.text(clean(`Certificate Number: ${base.certificateNo || ''}`), 30, 41);
    doc.text(clean(`TAN of Employer:${base.deductorTan || ''}`), 163, 41);
    doc.text(clean(`PAN of Employee: ${base.employeePan || ''}`), 314, 41);
    doc.text(clean(`Assessment Year: ${base.assessmentYear || ''}`), 462, 41);
    ctx.y = 50.5;
  }
}

function certHeader(ctx, part) {
  const { base } = ctx;
  const cit = base.citTds || base.citTdsAddress || base.commissionerOfIncomeTax || '-';
  const A = part === 'A';
  const rows = [
    { h: 20, cells: [C(862, 'FORM NO. 16', { a: 'c', b: true, sz: 12 })] },
  ];
  if (A) rows.push({ h: 18.8, cells: [C(862, '[See rule 31(1)(a)]', { a: 'c', sz: 8.5 })] });
  rows.push({ h: 17, cells: [C(862, `PART ${part}`, { a: 'c', b: true, sz: 10.5 })] });
  rows.push({
    h: 26,
    cells: [C(862, `Certificate under ${A ? 'Section' : 'section'} 203 of the Income-tax Act, 1961 for tax deducted at source on salary paid to an employee under section 192 or pension/interest income of specified senior citizen under section 194P`, { a: 'c', b: true, sz: 6.6 })],
  });
  rows.push({
    h: 24.6,
    cells: [
      C(436, [{ t: 'Certificate No.', b: true }, { t: base.certificateNo || '-', pre: 8 }], { sz: 8 }),
      C(426, [{ t: 'Last updated on', b: true }, { t: dMonY(base.lastUpdatedOn), pre: 22 }], { a: 'r', sz: 8, padX: 14 }),
    ],
  });
  rows.push({
    h: 22,
    cells: [
      C(436, 'Name and address of the Employer/Specified Bank', { a: 'c', b: true }),
      C(426, 'Name and address of the Employee/Specified senior citizen', { a: 'c', b: true }),
    ],
  });
  rows.push({
    h: 63.5,
    cells: [
      C(436, [base.employerName, base.employerAddress, base.employerPhone, base.employerEmail].filter(Boolean).join('\n') || '-', { padX: 19, v: 'm' }),
      C(426, [base.employeeName, base.employeeAddress].filter(Boolean).join('\n') || '-', { padX: 19 }),
    ],
  });
  if (A) {
    rows.push({
      h: 45,
      cells: [
        C(234, 'PAN of the Deductor', { a: 'c', b: true }),
        C(202, 'TAN of the Deductor', { a: 'c', b: true }),
        C(160, 'PAN of the Employee/Specified senior citizen', { b: true }),
        C(266, 'Employee Reference No. provided by the Employer/Pension Payment order no. provided by the Employer (If available)', { b: true }),
      ],
    });
    rows.push({
      h: 19,
      cells: [
        C(234, base.deductorPan || '-', { a: 'c' }), C(202, base.deductorTan || '-', { a: 'c' }),
        C(160, base.employeePan || '-', { a: 'c' }), C(266, base.employeeReferenceNo || '', { a: 'c' }),
      ],
    });
  } else {
    rows.push({
      h: 17,
      cells: [
        C(286, 'PAN of the Deductor', { a: 'c', b: true }), C(270, 'TAN of the Deductor', { a: 'c', b: true }),
        C(306, 'PAN of the Employee/Specified senior citizen', { a: 'c', b: true }),
      ],
    });
    rows.push({
      h: 19,
      cells: [
        C(286, base.deductorPan || '-', { a: 'c' }), C(270, base.deductorTan || '-', { a: 'c' }),
        C(306, base.employeePan || '-', { a: 'c' }),
      ],
    });
  }
  rows.push({
    h: 20,
    cells: [C(436, 'CIT (TDS)', { a: 'c', b: true }), C(208, 'Assessment Year', { a: 'c', b: true }), C(218, 'Period with the Employer', { a: 'c', b: true })],
  });
  rows.push({
    h: 52,
    cells: [
      C(436, cit, { a: 'c' }),
      C(208, base.assessmentYear || '-', { a: 'c' }),
      C(103, [{ t: 'From', b: true }, { t: `\n${dMonY(base.employmentFrom)}` }], { a: 'c' }),
      C(115, [{ t: 'To', b: true }, { t: `\n${dMonY(base.employmentTo)}` }], { a: 'c' }),
    ],
  });
  table(ctx, rows);
}

function verificationBlock(ctx, f, verification, part) {
  const A = part === 'A';
  const u = (t) => ({ t, u: true });
  const segs = A
    ? [
      { t: 'I, ' }, u(f.signer), { t: ', son / daughter of ' }, u(f.sonOf), { t: ' working in the capacity of ' }, u(f.designation),
      { t: ' (designation) do hereby certify that a sum of Rs. ' }, u(a2(f.totalDeducted)), { t: ' [Rs. ' }, u(inWords(f.totalDeducted)),
      { t: ' (in words)] has been deducted and a sum of Rs. ' }, u(a2(f.challanTotal + f.bookTotal)), { t: ' [Rs. ' }, u(inWords(f.challanTotal + f.bookTotal)),
      { t: '] has been deposited to the credit of the Central Government. I further certify that the information given above is true, complete and correct and is based on the books of account, documents, TDS statements, TDS deposited and other available records.' },
    ]
    : [
      { t: 'I, ' }, u(f.signer), { t: ', son/daughter of ' }, u(f.sonOf), { t: ' .Working in the capacity of ' }, u(f.designation),
      { t: ' (Designation) do hereby certify that the information given above is true, complete and correct and is based on the books of account, documents, TDS statements, and other available records.' },
    ];
  table(ctx, [
    { h: 16, cells: [C(862, 'Verification', { a: 'c', b: A, sz: A ? 8 : 8.5 })] },
    { cells: [C(862, segs, { a: 'j', b: A, sz: A ? 7.3 : 8, padY: A ? 6 : 5 })] },
  ]);

  const place = verification?.place || '-';
  const date = dMonY(verification?.date || ctx.base.lastUpdatedOn);
  const sig = verification?.signature ? `\n${verification.signature}` : '';
  if (A) {
    table(ctx, [
      { h: 20.7, cells: [C(96, 'Place', { b: true }), C(308, place, { a: 'c' }), C(458, [{ t: '(Signature of person responsible for deduction of Tax)', b: true }, { t: sig, b: true }], { a: 'c', rs: 2 })] },
      { h: 20, cells: [C(96, 'Date', { b: true }), C(308, date, { a: 'c' }), { skip: 458 }] },
      { h: 20, cells: [C(404, [{ t: 'Designation:', b: true }, { t: ` ${f.designation}` }]), C(458, [{ t: 'Full Name:', b: true }, { t: f.signer }])] },
    ]);
  } else {
    signBlockB(ctx, f, verification);
  }
}

function signBlockB(ctx, f, verification) {
  const place = verification?.place || '-';
  const date = dMonY(verification?.date || ctx.base.lastUpdatedOn);
  const sig = verification?.signature ? `\n${verification.signature}` : '';
  table(ctx, [
    { h: 30, cells: [C(97, 'Place', { b: true }), C(372, place, { a: 'c' }), C(393, [{ t: '(Signature of person responsible for deduction of tax)' }, { t: sig, b: true }], { a: 'c', sz: 8.5 })] },
    { h: 28.5, cells: [C(97, 'Date', { b: true }), C(372, date, { a: 'c' }), C(87, 'Full Name:', { b: true }), C(306, f.signer)] },
  ]);
}

// ----- Part A challan block (header repeats if the list ever flows onto another page) -------
const CH_W = [77, 188, 161, 160, 138, 138];
function challanHeader(ctx) {
  table(ctx, [
    {
      h: 17,
      cells: [
        C(77, 'Sl. No.', { rs: 2, a: 'c', b: true }),
        C(188, 'Tax Deposited in respect of the deductee (Rs.)', { rs: 2, a: 'c', b: true }),
        C(597, 'Challan Identification Number (CIN)', { a: 'c', b: true }),
      ],
    },
    {
      h: 37,
      cells: [
        { skip: 265 },
        C(161, 'BSR Code of the Bank Branch', { a: 'c', b: true }),
        C(160, 'Date on which Tax deposited (dd/mm/yyyy)', { a: 'c', b: true }),
        C(138, 'Challan Serial Number', { a: 'c', b: true }),
        C(138, 'Status of matching with OLTAS*', { a: 'c', b: true }),
      ],
    },
  ]);
}
const challanRow = (ch, i) => ({
  h: 15.1,
  cells: [
    C(CH_W[0], String(ch.serialNumber ?? i + 1), { a: 'c' }),
    C(CH_W[1], a2(ch.taxDeposited), { a: 'r', padX: 3 }),
    C(CH_W[2], ch.bsrCode || '-', { a: 'c' }),
    C(CH_W[3], ch.taxDepositedDate ? dmy(ch.taxDepositedDate) : '-', { a: 'c' }),
    C(CH_W[4], ch.challanSerialNumber || '-', { a: 'c' }),
    C(CH_W[5], ch.statusOfMatchingWithOltas || '-', { a: 'c' }),
  ],
});
function challanRows(ctx, list, offset, withHeader) {
  if (withHeader) challanHeader(ctx);
  list.forEach((ch, i) => {
    if (ctx.y + 16 > BOTTOM) { ctx.newPage(); challanHeader(ctx); }
    table(ctx, [challanRow(ch, offset + i)]);
  });
}
const challanTotalRow = (ctx, total) => table(ctx, [{
  h: 15.1,
  cells: [C(77, 'Total (Rs.)', { b: true, padX: 3 }), C(188, a2(total), { a: 'r', b: true, padX: 3 }), C(597, '', { fill: GREY })],
}]);

// ---------------------------------------------------------------------------------------------
// Part B helpers
// ---------------------------------------------------------------------------------------------
const PB = { sz: 9, padY: 5 };
// one amount in the first (col3) or last (col4) column
const R = (sl, desc, a, b, o = {}) => ({
  h: o.h ?? 24,
  b: o.bold,
  cells: [
    C(49, sl, { a: 'c', sz: /^\d/.test(sl) ? 8 : 9 }),
    C(461, desc, { padX: 6 }),
    C(178, a ?? '', { a: o.head ? 'c' : 'r', padX: 3 }),
    C(174, b ?? '', { a: o.head ? 'c' : 'r', padX: 3 }),
  ],
});
const S = (sl, desc) => ({ h: 20, cells: [C(49, sl, { a: 'c', sz: 8 }), C(813, desc, { padX: 6 })] });
const R3 = (sl, desc, g, q, d) => ({
  h: 24,
  cells: [C(49, sl, { a: 'c' }), C(461, desc, { padX: 6 }), C(117.3, g, { a: 'r', padX: 3 }), C(117.3, q, { a: 'r', padX: 3 }), C(117.4, d, { a: 'r', padX: 3 })],
});
const NOTE_BREAKUP = '[Note: Break-up to be filled and signed by employer in the table provide at the bottom of this form]';

function breakupTable(ctx, title, particulars) {
  const rows = [
    { h: 15, cells: [C(862, title, { sz: 8.5 })] },
    {
      h: 41.5,
      cells: [
        C(39, 'Sl. No.', { a: 'c', sz: 8.5, padX: 2 }),
        C(297, [{ t: particulars }, { t: '\nRs.' }], { a: 'c', sz: 8.5 }),
        C(172, [{ t: 'Gross Amount' }, { t: '\nRs.' }], { a: 'c', sz: 8.5 }),
        C(173, [{ t: 'Qualifying Amount' }, { t: '\nRs.' }], { a: 'c', sz: 8.5 }),
        C(181, [{ t: 'Deductible Amount' }, { t: '\nRs.' }], { a: 'c', sz: 8.5 }),
      ],
    },
  ];
  [1, 2, 3, 4, 5, 6].forEach((n) => rows.push({
    h: 15,
    cells: [C(39, `${n}.`, { sz: 8.5, padX: 3 }), C(297, ''), C(172, ''), C(173, ''), C(181, '')],
  }));
  table(ctx, rows);
}

// ---------------------------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------------------------
export function buildForm16Pdf(props) {
  const { base, quarter, challans = [], verification } = props;
  if (!base) throw new Error('Form 16 content is not available.');
  const f = computeForm16(props);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.setProperties({ title: `Form 16 - ${base.assessmentYear || ''}`, subject: 'Form No. 16', creator: 'MyHourly HRMS' });
  const ctx = {
    doc, base, y: 0, part: 'A', pages: [],
    newPage() { newPage(ctx, ctx.part, false); },
  };

  // ================================ PART A ================================
  newPage(ctx, 'A', true);
  certHeader(ctx, 'A');

  table(ctx, [{ h: 15.5, cells: [C(862, 'Summary of amount paid/credited and tax deducted at source thereon in respect of the employee', { a: 'c', b: true })] }]);
  const SUM = [124, 187, 161, 190, 200];
  const sumRows = [{
    h: 44.7,
    cells: [
      C(SUM[0], 'Quarter(s)', { a: 'c', b: true }),
      C(SUM[1], 'Receipt Numbers of original quarterly statements of TDS under sub-section (3) of Section 200', { a: 'c', b: true }),
      C(SUM[2], 'Amount paid/credited (Rs.)', { a: 'c', b: true }),
      C(SUM[3], 'Amount of tax deducted (Rs.)', { a: 'c', b: true }),
      C(SUM[4], 'Amount of tax deposited / remitted (Rs.)', { a: 'c', b: true }),
    ],
  }];
  [1, 2, 3, 4].forEach((q) => sumRows.push({
    h: 13.8,
    cells: [
      C(SUM[0], `Q${q}`, { a: 'c' }),
      C(SUM[1], quarter?.[`q${q}ReceiptNumber`] || '-', { a: 'c' }),
      C(SUM[2], a2(quarter?.[`q${q}AmountPaidCredited`]), { a: 'r', padX: 3 }),
      C(SUM[3], a2(quarter?.[`q${q}TaxDeducted`]), { a: 'r', padX: 3 }),
      C(SUM[4], a2(quarter?.[`q${q}TaxDepositedRemitted`]), { a: 'r', padX: 3 }),
    ],
  }));
  sumRows.push({
    h: 13.8,
    b: true,
    cells: [
      C(SUM[0], 'Total (Rs.)', { a: 'c' }), C(SUM[1], '', { fill: GREY }),
      C(SUM[2], a2(f.totalPaid), { a: 'r', padX: 3 }), C(SUM[3], a2(f.totalDeducted), { a: 'r', padX: 3 }), C(SUM[4], a2(f.totalRemitted), { a: 'r', padX: 3 }),
    ],
  });
  table(ctx, sumRows);

  // I. Book adjustment
  table(ctx, [{
    h: 28.5,
    cells: [C(862, [{ t: 'I. DETAILS OF TAX DEDUCTED AND DEPOSITED IN THE CENTRAL GOVERNMENT ACCOUNT THROUGH BOOK ADJUSTMENT', b: true }, { t: '\n(The deductor to provide payment wise details of tax deducted and deposited with respect to the deductee)' }], { a: 'c' })],
  }]);
  const BK = [77, 188, 145, 186, 128, 138];
  const bookRows = [
    {
      h: 17,
      cells: [
        C(77, 'Sl. No.', { rs: 2, a: 'c', b: true }),
        C(188, 'Tax Deposited in respect of the deductee (Rs.)', { rs: 2, a: 'c', b: true }),
        C(597, 'Book Identification Number (BIN)', { a: 'c', b: true }),
      ],
    },
    {
      h: 37,
      cells: [
        { skip: 265 },
        C(BK[2], 'Receipt Numbers of Form No. 24G', { a: 'c', b: true }),
        C(BK[3], 'DDO serial number in Form no. 24G', { a: 'c', b: true }),
        C(BK[4], 'Date of transfer voucher (dd/mm/yyyy)', { a: 'c', b: true }),
        C(BK[5], 'Status of matching with Form no. 24G', { a: 'c', b: true }),
      ],
    },
  ];
  if (f.bookTotal > 0) {
    bookRows.push({
      h: 15.1,
      cells: [
        C(BK[0], '1', { a: 'c' }), C(BK[1], a2(f.bookTotal), { a: 'r', padX: 3 }),
        C(BK[2], quarter?.receiptNumberForm24G || quarter?.form24GReceiptNumber || '-', { a: 'c' }),
        C(BK[3], quarter?.ddoSerialNumberForm24G || quarter?.ddoSerialNumber || '-', { a: 'c' }),
        C(BK[4], dmySlash(quarter?.dateOfTransferVoucher) || '-', { a: 'c' }),
        C(BK[5], quarter?.statusOfMatchingWithForm24G || '-', { a: 'c' }),
      ],
    });
  }
  bookRows.push({
    h: 16,
    cells: [C(77, 'Total (Rs.)', { b: true, padX: 3 }), C(188, f.bookTotal > 0 ? a2(f.bookTotal) : '', { a: 'r', b: true, padX: 3 }), C(597, '', { fill: GREY })],
  });
  table(ctx, bookRows);

  // II. Challans
  table(ctx, [{
    h: 28.5,
    cells: [C(862, [{ t: 'II. DETAILS OF TAX DEDUCTED AND DEPOSITED IN THE CENTRAL GOVERNMENT ACCOUNT THROUGH CHALLAN', b: true }, { t: '\n(The deductor to provide payment wise details of tax deducted and deposited with respect to the deductee)' }], { a: 'c' })],
  }]);
  const FIRST = 4; // the official certificate shows four challan rows on page 1 and the rest on page 2
  const startPages = ctx.pages.length;
  challanRows(ctx, challans.slice(0, FIRST), 0, true);
  const spilled = ctx.pages.length > startPages;   // page 1 was already full -> we are on page 2 now
  if (challans.length <= FIRST) {
    challanTotalRow(ctx, f.challanTotal);
    if (ctx.pages.length === startPages) newPage(ctx, 'A', false);
  } else {
    if (!spilled) newPage(ctx, 'A', false);
    challanRows(ctx, challans.slice(FIRST), FIRST, !spilled);
    challanTotalRow(ctx, f.challanTotal);
  }

  verificationBlock(ctx, f, verification, 'A');

  // Notes + legend
  ctx.y += 16;
  doc.setFont('times', 'bold'); doc.setFontSize(7); doc.setTextColor(0);
  doc.text('Notes:', X0 + 1, ctx.y + 5);
  ctx.y += 9;
  NOTES.forEach((n) => {
    layout(doc, n, W - 2, 6.3, false).forEach((ln) => {
      drawLine(doc, ln, X0 + 1, ctx.y + 6, 6.3, W - 2, 'l');
      ctx.y += 7.8;
    });
  });
  ctx.y += 28;
  doc.setFont('times', 'bold'); doc.setFontSize(8);
  doc.text('Legend used in Form 16', X0 + 1, ctx.y);
  doc.setLineWidth(0.5);
  doc.line(X0 + 1, ctx.y + 1.4, X0 + 1 + doc.getTextWidth('Legend used in Form 16'), ctx.y + 1.4);
  ctx.y += 18;
  doc.setFontSize(7.5);
  doc.text('* Status of matching with OLTAS', X0 + 8, ctx.y);
  ctx.y += 8;
  const LG = [74, 93, 685];
  const legendRows = [{
    h: 11,
    cells: [C(LG[0], 'Legend', { a: 'c', b: true, fill: BLUE }), C(LG[1], 'Description', { a: 'c', b: true, fill: BLUE }), C(LG[2], 'Definition', { a: 'c', b: true, fill: BLUE })],
  }];
  LEGEND.forEach(([k, d, def]) => legendRows.push({
    h: 12,
    cells: [C(LG[0], k, { a: 'c', b: true }), C(LG[1], d, { a: 'c' }), C(LG[2], def, { padX: 3 })],
  }));
  table(ctx, legendRows, { x: 26.6, k: K, sz: 6.3, padX: 3, padY: 2.5, lh: 1.2 });

  // ================================ PART B ================================
  newPage(ctx, 'B', true);
  certHeader(ctx, 'B');
  doc.setFont('times', 'normal'); doc.setFontSize(8.5);
  doc.text('Annexure - I', X0 + W - 15, ctx.y + 10, { align: 'right' });
  ctx.y += 17;

  const yesNo = base.optingOutOfTaxation115BAC1A ? 'Yes' : 'No';
  const { ex, c, l } = f;
  table(ctx, [
    { h: 25, cells: [C(862, 'Details of Salary Paid and any other income and tax deducted', { padX: 5 })] },
    { h: 20.7, cells: [C(49, 'A', { a: 'c' }), C(461, 'Whether opting out of taxation u/s 115BAC(1A)?', { padX: 6 }), C(352, yesNo, { a: 'c' })] },
    R('1.', 'Gross Salary', 'Rs.', 'Rs.', { head: true, h: 22.7 }),
    R('(a)', 'Salary as per provisions contained in section 17(1)', a2(f.s171), '', { h: 29 }),
    R('(b)', 'Value of perquisites under section 17(2) (as per Form No. 12BA, wherever applicable)', a2(f.s172), '', { h: 26.6 }),
    R('(c)', 'Profits in lieu of salary under section 17(3) (as per Form No. 12BA, wherever applicable)', a2(f.s173), '', { h: 28 }),
    R('(d)', 'Total', '', a2(f.grossTotal1d), { h: 17.5 }),
    R('(e)', 'Reported total amount of salary received from other employer(s)', '', a2(f.otherEmployer), { h: 28 }),
    S('2.', 'Less: Allowances to the extent exempt under section 10'),
    R('(a)', 'Travel concession or assistance under section 10(5)', a2(ex('section10_5')), '', { h: 30 }),
    R('(b)', 'Death-cum-retirement gratuity under section 10(10)', a2(ex('section10_10')), '', { h: 30 }),
    R('(c)', 'Commuted value of pension under section 10(10A)', a2(ex('section10_10A')), '', { h: 30 }),
    R('(d)', 'Cash equivalent of leave salary encashment under section 10(10AA)', a2(ex('section10_10AA')), '', { h: 31 }),
    R('(e)', 'House rent allowance under section 10(13A)', a2(ex('section10_13A')), '', { h: 30 }),
    R('(f)', 'Other special allowances under section 10(14)', a2(ex('section10_14')), '', { h: 30 }),
  ], PB);

  newPage(ctx, 'B', false);
  table(ctx, [
    R('(g)', [{ t: 'Amount of any other exemption under section 10 ' }, { t: NOTE_BREAKUP, b: true }], '', '', { h: 44 }),
    R('(h)', 'Total amount of any other exemption under section 10', a2(f.otherExemption), '', { h: 29 }),
    R('(i)', 'Total amount of exemption claimed under section 10 [2(a)+2(b)+2(c)+2(d)+2(e)+2(f)+2(h)]', '', a2(f.exemptTotal), { h: 28.5 }),
    R('3.', 'Total amount of salary received from current employer [1(d)-2(i)]', '', a2(f.salaryFromCurrent), { h: 28.5 }),
    S('4.', 'Less: Deductions under section 16'),
    R('(a)', 'Standard deduction under section 16(ia)', a2(f.d16a), '', { h: 22.7 }),
    R('(b)', 'Entertainment allowance under section 16(ii)', a2(f.d16b), '', { h: 24.6 }),
    R('(c)', 'Tax on employment under section 16(iii)', a2(f.d16c), '', { h: 26 }),
    R('5.', 'Total amount of deductions under section 16 [4(a)+4(b)+4(c)]', '', a2(f.d16Total), { h: 29 }),
    R('6.', 'Income chargeable under the head "Salaries" [(3+1(e)-5]', '', a2(f.chargeable), { h: 29 }),
    S('7.', 'Add: Any other income reported by the employee under as per section 192 (2B)'),
    R('(a)', 'Income (or admissible loss) from house property reported by employee offered for TDS', a2(f.hp), '', { h: 34 }),
    R('(b)', 'Income under the head Other Sources offered for TDS', a2(f.os), '', { h: 31 }),
    R('8.', 'Total amount of other income reported by the employee [7(a)+7(b)]', '', a2(f.otherIncome), { h: 31 }),
    R('9.', 'Gross total income (6+8)', '', a2(f.grossTotalIncome), { h: 21, bold: true }),
    R('10.', 'Deductions under Chapter VI-A', 'Gross Amount', 'Deductible Amount', { head: true, h: 27 }),
    R('(a)', 'Deduction in respect of life insurance premia, contributions to provident fund etc. under section 80C', a2(c('section80C')), a2(c('section80C')), { h: 32 }),
    R('(b)', 'Deduction in respect of contribution to certain pension funds under section 80CCC', a2(c('section80CCC')), a2(c('section80CCC')), { h: 32 }),
    R('(c)', 'Deduction in respect of contribution by taxpayer to pension scheme under section 80CCD (1)', a2(c('section80CCD1')), a2(c('section80CCD1')), { h: 32 }),
    R('(d)', 'Total deduction under section 80C, 80CCC and 80CCD(1)', a2(f.c80Total), a2(f.c80Total), { h: 26 }),
    R('(e)', 'Deductions in respect of amount paid/deposited to notified pension scheme under section 80CCD (1B)', a2(c('section80CCD1B')), a2(c('section80CCD1B')), { h: 32 }),
    R('(f)', 'Deduction in respect of contribution by Employer to pension scheme under section 80CCD (2)', a2(c('section80CCD2')), a2(c('section80CCD2')), { h: 32 }),
    R('(g)', 'Deduction in respect of health insurance premia under section 80D', a2(c('section80D')), a2(c('section80D')), { h: 32 }),
  ], PB);

  newPage(ctx, 'B', false);
  table(ctx, [
    R('(h)', 'Deduction in respect of interest on loan taken for higher education under section 80E', a2(c('section80E')), a2(c('section80E')), { h: 33 }),
    R('(i)', 'Deduction in respect of contribution by the employee to Agnipath Scheme under section 80CCH', a2(c('section80CCH')), a2(c('section80CCH')), { h: 33 }),
    R('(j)', 'Deduction in respect of contribution by the Central Government to Agnipath Scheme under section 80CCH', a2(c('section80CCH2')), a2(c('section80CCH2')), { h: 33 }),
    {
      h: 30,
      cells: [C(510, ''), C(117.3, 'Gross Amount', { a: 'c', padX: 2, sz: 8 }), C(117.3, 'Qualifying Amount', { a: 'c', padX: 2, sz: 8 }), C(117.4, 'Deductible Amount', { a: 'c', padX: 2, sz: 8 })],
    },
    R3('(k)', 'Total Deduction in respect of donations to certain funds, charitable institutions, etc. under section 80G', a2(c('section80G')), a2(c('section80G')), a2(c('section80G'))),
    R3('(l)', 'Deduction in respect of interest on deposits in savings account under section 80TTA', a2(c('section80TTA')), a2(c('section80TTA')), a2(c('section80TTA'))),
    { h: 44, cells: [C(49, '(m)', { a: 'c' }), C(813, [{ t: 'Amount Deductible under any other provision (s) of Chapter VI-A ' }, { t: NOTE_BREAKUP, b: true }], { padX: 6 })] },
    R3('(n)', 'Total of amount deductible under any other provision(s) of Chapter VI-A', a2(f.cOthers), a2(f.cOthers), a2(f.cOthers)),
    R('11.', 'Aggregate of deductible amount under Chapter VI-A [10(d)+10(e)+10(f)+10(g)+10(h)+10(i)+10(j)+10(k)+10(l)+10(n)]', '', a2(f.chapterTotal), { h: 32 }),
    R('12.', 'Total taxable income (9-11)', '', a2(f.taxableIncome), { h: 26, bold: true }),
    R('13.', 'Tax on total income', '', a2(l('taxOnTotalIncome')), { h: 26 }),
    R('14.', 'Rebate under section 87A, if applicable', '', a2(l('rebateUnderSection87A')), { h: 26 }),
    R('15.', 'Surcharge, wherever applicable', '', a2(l('surcharge')), { h: 26 }),
    R('16.', 'Health and education cess', '', a2(l('healthAndEducationCess')), { h: 26 }),
    R('17.', 'Tax payable (13+15+16-14)', '', a2(f.taxPayable), { h: 26 }),
    R('18.', 'Less: Relief under section 89 (attach details)', '', a2(l('reliefUnderSection89')), { h: 26 }),
    R('19.', 'Less: Tax deducted at source as per Form No. 12BAA submitted under provisions of section 192(2B)', '', a2(l('taxDeductedAtSourceForm12BAA')), { h: 33 }),
    R('20.', 'Less: Tax collected at source as per Form No. 12BAA submitted under provisions of section 192(2B)', '', a2(l('taxCollectedAtSourceForm12BAA')), { h: 33 }),
    R('21.', 'Net tax payable (17-18-19-20)', '', a2(f.netTax), { h: 26, bold: true }),
  ], PB);
  verificationBlock(ctx, f, verification, 'B');

  newPage(ctx, 'B', false);
  breakupTable(ctx, '2. (f) Break up for ‘Amount of any other exemption under section 10’ to be filled in the table below', "Particular's of Amount for any other exemption under section 10");
  ctx.y += 18;
  breakupTable(ctx, '10(k). Break up for ‘Amount deductible under any other provision(s) of Chapter VIA ‘to be filled in the table below', "Particular's of Amount deductible under any other provision(s) of Chapter VIA");
  ctx.y += 22;
  signBlockB(ctx, f, verification);

  // ---------------- "Page x of y" – counted separately for Part A and Part B ----------------
  const total = { A: 0, B: 0 };
  ctx.pages.forEach((p) => { total[p.part] += 1; });
  const seen = { A: 0, B: 0 };
  ctx.pages.forEach((p, idx) => {
    seen[p.part] += 1;
    doc.setPage(idx + 1);
    doc.setTextColor(0);
    const label = `Page ${seen[p.part]} of ${total[p.part]}`;
    if (p.part === 'A') {
      doc.setFont('times', 'normal'); doc.setFontSize(7);
      doc.text(label, 542, 822, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(label, 217, 818);
    }
  });
  return doc;
}

export async function downloadForm16Pdf(props, fileName) {
  const doc = buildForm16Pdf(props);
  doc.save(fileName);
}