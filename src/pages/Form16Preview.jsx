import { useLayoutEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/* =====================================================================
 * Form 16 preview
 * Order of the certificate (as requested):
 *   PART A  →  Section I (book adjustment)  →  Section II (challan)
 *           →  Verification (Part A)  →  Notes / legend
 *   PART B  →  Annexure I  →  Break-ups  →  Verification (Part B)
 * The certificate is laid out on a fixed A4-like sheet (794px wide) and
 * scaled to the panel width, so it never reflows or gets cropped.
 * ===================================================================== */

const PAGE_WIDTH = 794;

/* ---------------------------- value helpers --------------------------- */
export const num = (v) => {
  const x = v === '' || v == null ? 0 : Number(v);
  return Number.isFinite(x) ? x : 0;
};
export const money = (v) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v));
// TAN is alphanumeric (e.g. BLRJ11679D): 4 letters + 5 digits + 1 letter, 10 characters.
export const formatTan = (v) => String(v ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10);

const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Reads the first available key from an API object. Falls back to a
 * case/underscore-insensitive match so `salaryUnderSection17_1`,
 * `salaryUnderSection171` and `SalaryUnderSection17_1` all resolve.
 */
const pick = (obj, ...keys) => {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v != null && v !== '') return v;
  }
  const index = {};
  Object.keys(obj).forEach((k) => { index[normKey(k)] = k; });
  for (const k of keys) {
    const real = index[normKey(k)];
    if (real != null && obj[real] != null && obj[real] !== '') return obj[real];
  }
  return undefined;
};

/** Use the backend total when it is meaningful, otherwise the locally computed one. */
const total = (backend, computed) => {
  if (backend == null || backend === '') return computed;
  const b = num(backend);
  return b === 0 && computed !== 0 ? computed : b;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateParts = (v) => {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { y: m[1], m: m[2], d: m[3] };
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return { y: String(d.getFullYear()), m: String(d.getMonth() + 1).padStart(2, '0'), d: String(d.getDate()).padStart(2, '0') };
};
const fmtDMY = (v) => { const p = dateParts(v); return p ? `${p.d}-${p.m}-${p.y}` : (v || '—'); };
const fmtDMonY = (v) => { const p = dateParts(v); return p ? `${p.d}-${MONTHS[Number(p.m) - 1]}-${p.y}` : (v || '—'); };

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const twoDigits = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const threeDigits = (n) => [Math.floor(n / 100) ? `${ONES[Math.floor(n / 100)]} Hundred` : '', n % 100 ? twoDigits(n % 100) : ''].filter(Boolean).join(' ');
const intWords = (n) => {
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${intWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(' ');
};
const rupeesInWords = (v) => {
  const val = Math.round(num(v) * 100) / 100;
  const rupees = Math.floor(val);
  const paise = Math.round((val - rupees) * 100);
  return `${intWords(rupees)}${paise ? ` and ${twoDigits(paise)} Paise` : ''} Only`;
};

/* ------------------------------ data model ---------------------------- */
export function buildForm16Model({ base, quarter, challans, salary, exemption, section16, chapter, lastFields, verification }) {
  const b = base || {};

  // ---- Part A ----
  const quarters = [1, 2, 3, 4].map((q) => ({
    label: `Q${q}`,
    receipt: quarter?.[`q${q}ReceiptNumber`] || '',
    paid: num(quarter?.[`q${q}AmountPaidCredited`]),
    deducted: num(quarter?.[`q${q}TaxDeducted`]),
    deposited: num(quarter?.[`q${q}TaxDepositedRemitted`]),
  }));
  const sum = (k) => quarters.reduce((a, r) => a + r[k], 0);
  const totals = { paid: sum('paid'), deducted: sum('deducted'), deposited: sum('deposited') };

  const bookAmount = num(pick(quarter, 'bookAdjustmentTaxDeposited'));
  const bookStatus = pick(quarter, 'statusOfMatchingWithForm24G') || '';
  const book = bookAmount > 0 || bookStatus
    ? {
      amount: bookAmount,
      receipt: pick(quarter, 'form24GReceiptNumber', 'receiptNumberOfForm24G') || '',
      ddo: pick(quarter, 'ddoSerialNumberForm24G', 'ddoSerialNumber') || '',
      date: pick(quarter, 'dateOfTransferVoucher'),
      status: bookStatus,
    }
    : null;

  const challanRows = (challans || []).map((c, i) => ({
    sl: c.serialNumber ?? i + 1,
    amount: num(c.taxDeposited),
    bsr: c.bsrCode || '',
    date: c.taxDepositedDate,
    serial: c.challanSerialNumber || '',
    status: c.statusOfMatchingWithOltas || '',
  }));
  const challanTotal = challanRows.reduce((a, c) => a + c.amount, 0);

  // ---- Part B ----
  const s171 = num(pick(salary, 'salaryUnderSection17_1', 'salaryUnderSection171', 'salary17_1', 'salaryAsPerSection17_1'));
  const s172 = num(pick(salary, 'perquisitesUnderSection17_2', 'perquisitesUnderSection172', 'perquisites17_2'));
  const s173 = num(pick(salary, 'profitsInLieuOfSalaryUnderSection17_3', 'profitsInLieuOfSalaryUnderSection173', 'profitsInLieu17_3'));
  const gross = total(pick(salary, 'grossSalary', 'grossSalaryTotal'), s171 + s172 + s173);
  const otherEmployers = num(pick(salary, 'salaryReceivedFromOtherEmployers') ?? pick(section16, 'salaryReceivedFromOtherEmployers'));

  const e5 = num(pick(exemption, 'section10_5'));
  const e10 = num(pick(exemption, 'section10_10'));
  const e10A = num(pick(exemption, 'section10_10A'));
  const e10AA = num(pick(exemption, 'section10_10AA'));
  const e13A = num(pick(exemption, 'section10_13A'));
  const e14 = num(pick(exemption, 'section10_10B', 'section10_14'));
  const eOther = num(pick(exemption, 'otherSection10'));
  const totalExempt = total(pick(exemption, 'totalExemption', 'totalExemptionUnderSection10'), e5 + e10 + e10A + e10AA + e13A + e14 + eOther);

  const salaryCurrent = gross - totalExempt;

  const std = num(pick(section16, 'standardDeductionSection16I', 'standardDeductionSection16ia'));
  const ent = num(pick(section16, 'entertainmentAllowanceSection16II', 'entertainmentAllowanceSection16ii'));
  const ptax = num(pick(section16, 'taxOnEmploymentSection16III', 'taxOnEmploymentSection16iii'));
  const ded16 = total(pick(section16, 'totalDeductionsSection16'), std + ent + ptax);
  const incomeSalaries = salaryCurrent + otherEmployers - ded16;

  const hp = num(pick(section16, 'incomeLossHouseProperty'));
  const os = num(pick(section16, 'incomeUnderOtherSources'));
  const otherIncome = hp + os;
  const grossTotalIncome = total(pick(section16, 'grossTotalIncome'), incomeSalaries + otherIncome);

  const c = (k) => num(pick(chapter, k));
  const c80C = c('section80C');
  const c80CCC = c('section80CCC');
  const c80CCD1 = c('section80CCD1');
  const c80CCDsub = c80C + c80CCC + c80CCD1;
  const c80CCD1B = c('section80CCD1B');
  const c80CCD2 = c('section80CCD2');
  const c80D = c('section80D');
  const c80E = c('section80E');
  const c80CCH = c('section80CCH');
  const c80CCH2 = c('section80CCH2');
  const c80G = c('section80G');
  const c80TTA = c('section80TTA');
  const cOtherTotal = c('section80EEA') + c('section80GG') + c('section80TTB') + c('amountDeductibleUnderAnyOtherProvisionChapterVIA') + c('otherChapterVIA');
  const chapterTotal = total(
    pick(chapter, 'totalChapterVIA'),
    c80CCDsub + c80CCD1B + c80CCD2 + c80D + c80E + c80CCH + c80CCH2 + c80G + c80TTA + cOtherTotal,
  );
  const taxableIncome = total(pick(chapter, 'totalTaxableIncome'), Math.max(0, grossTotalIncome - chapterTotal));

  const taxOnIncome = num(pick(lastFields, 'taxOnTotalIncome'));
  const rebate = num(pick(lastFields, 'rebateUnderSection87A'));
  const surcharge = num(pick(lastFields, 'surcharge'));
  const cess = num(pick(lastFields, 'healthAndEducationCess'));
  const taxPayable = total(pick(lastFields, 'taxPayable'), Math.max(0, taxOnIncome + surcharge + cess - rebate));
  const relief = num(pick(lastFields, 'reliefUnderSection89'));
  const tds12 = num(pick(lastFields, 'taxDeductedAtSourceForm12BAA'));
  const tcs12 = num(pick(lastFields, 'taxCollectedAtSourceForm12BAA'));
  const netTax = total(pick(lastFields, 'netTaxPayable'), taxPayable - relief - tds12 - tcs12);

  const v = verification || {};
  return {
    base: b,
    certNo: b.certificateNo || '—',
    updated: fmtDMonY(b.lastUpdatedOn || b.updatedAt),
    employeeRef: b.employeeReferenceNumber || b.employeeReferenceNo || '',
    cit: b.citTds || b.citTdsAddress || '',
    opt: !!b.optingOutOfTaxation115BAC1A,
    quarters, totals, book, challanRows, challanTotal,
    ver: {
      name: v.fullName || '',
      father: v.fatherName || v.sonDaughterOf || '',
      designation: v.designation || '',
      place: v.place || '',
      date: fmtDMonY(v.date || b.lastUpdatedOn || b.updatedAt),
      signature: v.signature || '',
    },
    b: {
      s171, s172, s173, gross, otherEmployers,
      e5, e10, e10A, e10AA, e13A, e14, eOther, totalExempt, salaryCurrent,
      std, ent, ptax, ded16, incomeSalaries, hp, os, otherIncome, grossTotalIncome,
      c80C, c80CCC, c80CCD1, c80CCDsub, c80CCD1B, c80CCD2, c80D, c80E, c80CCH, c80CCH2, c80G, c80TTA, cOtherTotal,
      chapterTotal, taxableIncome,
      taxOnIncome, rebate, surcharge, cess, taxPayable, relief, tds12, tcs12, netTax,
    },
  };
}

/** Annexure I rows — shared by the on-screen preview and the PDF export. */
function annexureRows(m) {
  const b = m.b;
  const two = (ref, label, val) => ({ t: 'row2', ref, label, g: val, d: val });
  const three = (ref, label, val) => ({ t: 'row3', ref, label, g: val, q: val, d: val });
  return [
    { t: 'yn', ref: 'A', label: 'Whether opting out of taxation u/s 115BAC(1A)?', v: m.opt ? 'Yes' : 'No' },
    { t: 'head', ref: '1.', label: 'Gross Salary', caps: ['Rs.', 'Rs.'] },
    { t: 'row', ref: '(a)', label: 'Salary as per provisions contained in section 17(1)', i: b.s171 },
    { t: 'row', ref: '(b)', label: 'Value of perquisites under section 17(2) (as per Form No. 12BA, wherever applicable)', i: b.s172 },
    { t: 'row', ref: '(c)', label: 'Profits in lieu of salary under section 17(3) (as per Form No. 12BA, wherever applicable)', i: b.s173 },
    { t: 'row', ref: '(d)', label: 'Total', o: b.gross },
    { t: 'row', ref: '(e)', label: 'Reported total amount of salary received from other employer(s)', o: b.otherEmployers },
    { t: 'head', ref: '2.', label: 'Less: Allowances to the extent exempt under section 10' },
    { t: 'row', ref: '(a)', label: 'Travel concession or assistance under section 10(5)', i: b.e5 },
    { t: 'row', ref: '(b)', label: 'Death-cum-retirement gratuity under section 10(10)', i: b.e10 },
    { t: 'row', ref: '(c)', label: 'Commuted value of pension under section 10(10A)', i: b.e10A },
    { t: 'row', ref: '(d)', label: 'Cash equivalent of leave salary encashment under section 10(10AA)', i: b.e10AA },
    { t: 'row', ref: '(e)', label: 'House rent allowance under section 10(13A)', i: b.e13A },
    { t: 'row', ref: '(f)', label: 'Other special allowances under section 10(14)', i: b.e14 },
    { t: 'text', ref: '(g)', label: 'Amount of any other exemption under section 10 [Note: Break-up to be filled and signed by employer in the table provided at the bottom of this form]' },
    { t: 'row', ref: '(h)', label: 'Total amount of any other exemption under section 10', i: b.eOther },
    { t: 'row', ref: '(i)', label: 'Total amount of exemption claimed under section 10 [2(a)+2(b)+2(c)+2(d)+2(e)+2(f)+2(h)]', o: b.totalExempt },
    { t: 'row', ref: '3.', label: 'Total amount of salary received from current employer [1(d)-2(i)]', o: b.salaryCurrent },
    { t: 'head', ref: '4.', label: 'Less: Deductions under section 16' },
    { t: 'row', ref: '(a)', label: 'Standard deduction under section 16(ia)', i: b.std },
    { t: 'row', ref: '(b)', label: 'Entertainment allowance under section 16(ii)', i: b.ent },
    { t: 'row', ref: '(c)', label: 'Tax on employment under section 16(iii)', i: b.ptax },
    { t: 'row', ref: '5.', label: 'Total amount of deductions under section 16 [4(a)+4(b)+4(c)]', o: b.ded16 },
    { t: 'row', ref: '6.', label: 'Income chargeable under the head "Salaries" [(3+1(e)-5]', o: b.incomeSalaries },
    { t: 'head', ref: '7.', label: 'Add: Any other income reported by the employee under as per section 192 (2B)' },
    { t: 'row', ref: '(a)', label: 'Income (or admissible loss) from house property reported by employee offered for TDS', i: b.hp },
    { t: 'row', ref: '(b)', label: 'Income under the head Other Sources offered for TDS', i: b.os },
    { t: 'row', ref: '8.', label: 'Total amount of other income reported by the employee [7(a)+7(b)]', o: b.otherIncome },
    { t: 'row', ref: '9.', label: 'Gross total income (6+8)', o: b.grossTotalIncome, bold: true },
    { t: 'head', ref: '10.', label: 'Deductions under Chapter VI-A', caps: ['Gross Amount', 'Deductible Amount'] },
    two('(a)', 'Deduction in respect of life insurance premia, contributions to provident fund etc. under section 80C', b.c80C),
    two('(b)', 'Deduction in respect of contribution to certain pension funds under section 80CCC', b.c80CCC),
    two('(c)', 'Deduction in respect of contribution by taxpayer to pension scheme under section 80CCD (1)', b.c80CCD1),
    two('(d)', 'Total deduction under section 80C, 80CCC and 80CCD(1)', b.c80CCDsub),
    two('(e)', 'Deductions in respect of amount paid/deposited to notified pension scheme under section 80CCD (1B)', b.c80CCD1B),
    two('(f)', 'Deduction in respect of contribution by Employer to pension scheme under section 80CCD (2)', b.c80CCD2),
    two('(g)', 'Deduction in respect of health insurance premia under section 80D', b.c80D),
    two('(h)', 'Deduction in respect of interest on loan taken for higher education under section 80E', b.c80E),
    two('(i)', 'Deduction in respect of contribution by the employee to Agnipath Scheme under section 80CCH', b.c80CCH),
    two('(j)', 'Deduction in respect of contribution by the Central Government to Agnipath Scheme under section 80CCH', b.c80CCH2),
    { t: 'sub3' },
    three('(k)', 'Total Deduction in respect of donations to certain funds, charitable institutions, etc. under section 80G', b.c80G),
    three('(l)', 'Deduction in respect of interest on deposits in savings account under section 80TTA', b.c80TTA),
    { t: 'text', ref: '(m)', label: 'Amount Deductible under any other provision(s) of Chapter VI-A [Note: Break-up to be filled and signed by employer in the table provided at the bottom of this form]' },
    three('(n)', 'Total of amount deductible under any other provision(s) of Chapter VI-A', b.cOtherTotal),
    { t: 'row', ref: '11.', label: 'Aggregate of deductible amount under Chapter VI-A [10(d)+10(e)+10(f)+10(g)+10(h)+10(i)+10(j)+10(k)+10(l)+10(n)]', o: b.chapterTotal },
    { t: 'row', ref: '12.', label: 'Total taxable income (9-11)', o: b.taxableIncome, bold: true },
    { t: 'row', ref: '13.', label: 'Tax on total income', o: b.taxOnIncome },
    { t: 'row', ref: '14.', label: 'Rebate under section 87A, if applicable', o: b.rebate },
    { t: 'row', ref: '15.', label: 'Surcharge, wherever applicable', o: b.surcharge },
    { t: 'row', ref: '16.', label: 'Health and education cess', o: b.cess },
    { t: 'row', ref: '17.', label: 'Tax payable (13+15+16-14)', o: b.taxPayable },
    { t: 'row', ref: '18.', label: 'Less: Relief under section 89 (attach details)', o: b.relief },
    { t: 'row', ref: '19.', label: 'Less: Tax deducted at source as per Form No. 12BAA submitted under provisions of section 192(2B)', o: b.tds12 },
    { t: 'row', ref: '20.', label: 'Less: Tax collected at source as per Form No. 12BAA submitted under provisions of section 192(2B)', o: b.tcs12 },
    { t: 'row', ref: '21.', label: 'Net tax payable (17-18-19-20)', o: b.netTax, bold: true },
  ];
}

/* ------------------------------ fit-to-width -------------------------- */
function FitToWidth({ width = PAGE_WIDTH, children }) {
  const wrapRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return undefined;
    const update = () => {
      const s = Math.min(1, wrap.clientWidth / width) || 1;
      setScale(s);
      setHeight(inner.offsetHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={wrapRef} className="f16d-fit" style={{ height: height || undefined }}>
      <div ref={innerRef} className="f16d-fit-inner" style={{ width, transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}

/* ------------------------------- pieces ------------------------------- */
const lines = (...parts) => parts.filter((p) => p != null && String(p).trim() !== '' && p !== '—').join('\n');
const Blank = ({ w = 90 }) => <span className="f16d-blank" style={{ minWidth: w }} />;
const U = ({ children, w }) => (children ? <u className="f16d-u">{children}</u> : <Blank w={w} />);

function CertHeader({ part, m }) {
  const b = m.base;
  const isA = part === 'A';
  return (
    <>
      <table className="f16d-t">
        <tbody>
          <tr><th className="f16d-h1">FORM NO. 16</th></tr>
          <tr><td className="f16d-sm">[See rule 31(1)(a)]</td></tr>
          <tr><th className="f16d-h2">PART {part}</th></tr>
          <tr><td className="f16d-sm f16d-b">Certificate under Section 203 of the Income-tax Act, 1961 for tax deducted at source on salary paid to an employee under section 192 or pension/interest income of specified senior citizen under section 194P</td></tr>
        </tbody>
      </table>
      <table className="f16d-t">
        <tbody>
          <tr>
            <td className="f16d-l"><b>Certificate No.</b>&nbsp;&nbsp;{m.certNo}</td>
            <td className="f16d-r"><b>Last updated on</b>&nbsp;&nbsp;&nbsp;{m.updated}</td>
          </tr>
        </tbody>
      </table>
      <table className="f16d-t">
        <tbody>
          <tr><th>Name and address of the Employer/Specified Bank</th><th>Name and address of the Employee/Specified senior citizen</th></tr>
          <tr>
            <td className="f16d-l f16d-addr"><b>{b.employerName || '—'}</b>{'\n'}{lines(b.employerAddress, b.employerPhone, b.employerEmail) || '—'}</td>
            <td className="f16d-l f16d-addr"><b>{b.employeeName || '—'}</b>{'\n'}{b.employeeAddress || '—'}</td>
          </tr>
        </tbody>
      </table>
      <table className="f16d-t">
        <tbody>
          <tr>
            <th>PAN of the Deductor</th>
            <th>TAN of the Deductor</th>
            <th>PAN of the Employee/Specified senior citizen</th>
            {isA && <th>Employee Reference No. provided by the Employer/Pension Payment order no. provided by the Employer (If available)</th>}
          </tr>
          <tr>
            <td>{b.deductorPan || '—'}</td>
            <td>{formatTan(b.deductorTan) || '—'}</td>
            <td>{b.employeePan || '—'}</td>
            {isA && <td>{m.employeeRef || ''}</td>}
          </tr>
        </tbody>
      </table>
      <table className="f16d-t">
        <colgroup><col style={{ width: '40%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /></colgroup>
        <tbody>
          <tr><th>CIT (TDS)</th><th>Assessment Year</th><th colSpan={2}>Period with the Employer</th></tr>
          <tr>
            <td rowSpan={2} className="f16d-addr">{m.cit || '—'}</td>
            <td rowSpan={2}>{b.assessmentYear || '—'}</td>
            <th>From</th><th>To</th>
          </tr>
          <tr><td>{fmtDMonY(b.employmentFrom)}</td><td>{fmtDMonY(b.employmentTo)}</td></tr>
        </tbody>
      </table>
    </>
  );
}

function SignBlock({ m }) {
  const v = m.ver;
  return (
    <table className="f16d-t">
      <colgroup><col style={{ width: '12%' }} /><col style={{ width: '38%' }} /><col style={{ width: '25%' }} /><col style={{ width: '25%' }} /></colgroup>
      <tbody>
        <tr>
          <th>Place</th><td>{v.place || '—'}</td>
          <td colSpan={2} rowSpan={2} className="f16d-sign">
            <div className="f16d-sigtext">{v.signature}</div>
            <b>(Signature of person responsible for deduction of Tax)</b>
          </td>
        </tr>
        <tr><th>Date</th><td>{v.date}</td></tr>
        <tr>
          <td colSpan={2} className="f16d-l"><b>Designation:</b> {v.designation || '—'}</td>
          <td colSpan={2} className="f16d-l"><b>Full Name:</b> {v.name || '—'}</td>
        </tr>
      </tbody>
    </table>
  );
}

function BreakupTable({ title, rows }) {
  const filled = [...rows];
  while (filled.length < 6) filled.push(null);
  return (
    <table className="f16d-t f16d-breakup">
      <thead>
        <tr><th colSpan={5} className="f16d-l">{title}</th></tr>
        <tr><th style={{ width: '6%' }}>Sl. No.</th><th>Particular&apos;s of Amount</th><th>Gross Amount Rs.</th><th>Qualifying Amount Rs.</th><th>Deductible Amount Rs.</th></tr>
      </thead>
      <tbody>
        {filled.slice(0, 6).map((r, i) => (
          <tr key={i}>
            <td>{i + 1}.</td>
            <td className="f16d-l">{r?.name || ''}</td>
            <td className="f16d-n">{r ? money(r.g) : ''}</td>
            <td className="f16d-n">{r ? money(r.q) : ''}</td>
            <td className="f16d-n">{r ? money(r.d) : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Annexure({ m }) {
  const rows = annexureRows(m);
  return (
    <>
      <div className="f16d-annex">Annexure - I</div>
      <table className="f16d-t f16d-annex-t">
        <colgroup><col style={{ width: '6%' }} /><col style={{ width: '46%' }} /><col style={{ width: '16%' }} /><col style={{ width: '16%' }} /><col style={{ width: '16%' }} /></colgroup>
        <tbody>
          <tr><td colSpan={5} className="f16d-l">Details of Salary Paid and any other income and tax deducted</td></tr>
          {rows.map((r, i) => {
            const bold = r.bold ? 'f16d-bold' : '';
            switch (r.t) {
              case 'yn':
                return <tr key={i}><td>{r.ref}</td><td colSpan={2} className="f16d-l">{r.label}</td><td colSpan={2}>{r.v}</td></tr>;
              case 'head':
                return (
                  <tr key={i}>
                    <td>{r.ref}</td>
                    <td colSpan={2} className="f16d-l">{r.label}</td>
                    {r.caps ? <><td>{r.caps[0]}</td><td>{r.caps[1]}</td></> : <td colSpan={2} />}
                  </tr>
                );
              case 'text':
                return <tr key={i}><td>{r.ref}</td><td colSpan={4} className="f16d-l">{r.label}</td></tr>;
              case 'row':
                return (
                  <tr key={i} className={bold}>
                    <td>{r.ref}</td>
                    <td colSpan={2} className="f16d-l">{r.label}</td>
                    <td className="f16d-n">{r.i != null ? money(r.i) : ''}</td>
                    <td className="f16d-n">{r.o != null ? money(r.o) : ''}</td>
                  </tr>
                );
              case 'row2':
                return (
                  <tr key={i}>
                    <td>{r.ref}</td>
                    <td colSpan={2} className="f16d-l">{r.label}</td>
                    <td className="f16d-n">{money(r.g)}</td>
                    <td className="f16d-n">{money(r.d)}</td>
                  </tr>
                );
              case 'sub3':
                return <tr key={i} className="f16d-capsrow"><td colSpan={2} /><td>Gross Amount</td><td>Qualifying Amount</td><td>Deductible Amount</td></tr>;
              case 'row3':
                return (
                  <tr key={i}>
                    <td>{r.ref}</td>
                    <td className="f16d-l">{r.label}</td>
                    <td className="f16d-n">{money(r.g)}</td>
                    <td className="f16d-n">{money(r.q)}</td>
                    <td className="f16d-n">{money(r.d)}</td>
                  </tr>
                );
              default:
                return null;
            }
          })}
        </tbody>
      </table>
    </>
  );
}

const LEGEND = [
  ['U', 'Unmatched', 'Deductors have not deposited taxes or have furnished incorrect particulars of tax payment. Final credit will be reflected only when payment details in bank match with details of deposit in TDS / TCS statement'],
  ['P', 'Provisional', 'Provisional tax credit is effected only for TDS / TCS Statements filed by Government deductors."P" status will be changed to Final (F) on verification of payment details submitted by Pay and Accounts Officer (PAO)'],
  ['F', 'Final', 'In case of non-government deductors, payment details of TDS / TCS deposited in bank by deductor have matched with the payment details mentioned in the TDS / TCS statement filed by the deductors. In case of government deductors, details of TDS / TCS booked in Government account have been verified by Pay & Accounts Officer (PAO)'],
  ['O', 'Overbooked', 'Payment details of TDS / TCS deposited in bank by deductor have matched with details mentioned in the TDS / TCS statement but the amount is over claimed in the statement. Final (F) credit will be reflected only when deductor reduces claimed amount in the statement or makes new payment for excess amount claimed in the statement'],
];

/* ------------------------------- preview ------------------------------ */
export function FormPreview({ model: m }) {
  if (!m) {
    return <div className="f16-empty"><FileText size={44} /><strong>No Form 16 loaded</strong>Select an employee and generate or load a Form 16.</div>;
  }
  const v = m.ver;
  const breakup1 = m.b.eOther > 0 ? [{ name: 'Other exemption under section 10', g: m.b.eOther, q: m.b.eOther, d: m.b.eOther }] : [];
  const breakup2 = m.b.cOtherTotal > 0 ? [{ name: 'Other provision(s) of Chapter VI-A', g: m.b.cOtherTotal, q: m.b.cOtherTotal, d: m.b.cOtherTotal }] : [];

  return (
    <div className="f16d-viewport">
      <FitToWidth>
        <div className="f16d-sheet">
          {/* ============================ PART A ============================ */}
          <section className="f16d-part">
            <div className="f16d-wm"><span>MYHOURLY HRMS</span></div>
            <CertHeader part="A" m={m} />

            <table className="f16d-t">
              <colgroup><col style={{ width: '9%' }} /><col style={{ width: '31%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /></colgroup>
              <tbody>
                <tr><th colSpan={5}>Summary of amount paid/credited and tax deducted at source thereon in respect of the employee</th></tr>
                <tr>
                  <th>Quarter(s)</th>
                  <th>Receipt Numbers of original quarterly statements of TDS under sub-section (3) of Section 200</th>
                  <th>Amount paid/credited (Rs.)</th>
                  <th>Amount of tax deducted (Rs.)</th>
                  <th>Amount of tax deposited / remitted (Rs.)</th>
                </tr>
                {m.quarters.map((q) => (
                  <tr key={q.label}>
                    <td>{q.label}</td><td>{q.receipt || '—'}</td>
                    <td className="f16d-n">{money(q.paid)}</td><td className="f16d-n">{money(q.deducted)}</td><td className="f16d-n">{money(q.deposited)}</td>
                  </tr>
                ))}
                <tr className="f16d-bold">
                  <td>Total (Rs.)</td><td className="f16d-shade" />
                  <td className="f16d-n">{money(m.totals.paid)}</td><td className="f16d-n">{money(m.totals.deducted)}</td><td className="f16d-n">{money(m.totals.deposited)}</td>
                </tr>
              </tbody>
            </table>

            {/* Section I — book adjustment */}
            <table className="f16d-t">
              <colgroup><col style={{ width: '9%' }} /><col style={{ width: '19%' }} /><col style={{ width: '18%' }} /><col style={{ width: '18%' }} /><col style={{ width: '18%' }} /><col style={{ width: '18%' }} /></colgroup>
              <tbody>
                <tr><th colSpan={6} className="f16d-secttl">I. DETAILS OF TAX DEDUCTED AND DEPOSITED IN THE CENTRAL GOVERNMENT ACCOUNT THROUGH BOOK ADJUSTMENT<div className="f16d-sm f16d-nb">(The deductor to provide payment wise details of tax deducted and deposited with respect to the deductee)</div></th></tr>
                <tr>
                  <th rowSpan={2}>Sl. No.</th>
                  <th rowSpan={2}>Tax Deposited in respect of the deductee (Rs.)</th>
                  <th colSpan={4}>Book Identification Number (BIN)</th>
                </tr>
                <tr><th>Receipt Numbers of Form No. 24G</th><th>DDO serial number in Form no. 24G</th><th>Date of transfer voucher (dd/mm/yyyy)</th><th>Status of matching with Form no. 24G</th></tr>
                {m.book && (
                  <tr>
                    <td>1</td><td className="f16d-n">{money(m.book.amount)}</td>
                    <td>{m.book.receipt || '—'}</td><td>{m.book.ddo || '—'}</td><td>{fmtDMY(m.book.date)}</td><td>{m.book.status || '—'}</td>
                  </tr>
                )}
                <tr className="f16d-bold"><td>Total (Rs.)</td><td className="f16d-n">{m.book ? money(m.book.amount) : ''}</td><td colSpan={4} className="f16d-shade" /></tr>
              </tbody>
            </table>

            {/* Section II — challan */}
            <table className="f16d-t">
              <colgroup><col style={{ width: '9%' }} /><col style={{ width: '19%' }} /><col style={{ width: '18%' }} /><col style={{ width: '18%' }} /><col style={{ width: '18%' }} /><col style={{ width: '18%' }} /></colgroup>
              <tbody>
                <tr><th colSpan={6} className="f16d-secttl">II. DETAILS OF TAX DEDUCTED AND DEPOSITED IN THE CENTRAL GOVERNMENT ACCOUNT THROUGH CHALLAN<div className="f16d-sm f16d-nb">(The deductor to provide payment wise details of tax deducted and deposited with respect to the deductee)</div></th></tr>
                <tr>
                  <th rowSpan={2}>Sl. No.</th>
                  <th rowSpan={2}>Tax Deposited in respect of the deductee (Rs.)</th>
                  <th colSpan={4}>Challan Identification Number (CIN)</th>
                </tr>
                <tr><th>BSR Code of the Bank Branch</th><th>Date on which Tax deposited (dd/mm/yyyy)</th><th>Challan Serial Number</th><th>Status of matching with OLTAS*</th></tr>
                {m.challanRows.length === 0 && <tr><td colSpan={6} className="f16d-muted">No challan details added yet.</td></tr>}
                {m.challanRows.map((c) => (
                  <tr key={c.sl}>
                    <td>{c.sl}</td><td className="f16d-n">{money(c.amount)}</td>
                    <td>{c.bsr || '-'}</td><td>{fmtDMY(c.date)}</td><td>{c.serial || '-'}</td><td>{c.status || '-'}</td>
                  </tr>
                ))}
                <tr className="f16d-bold"><td>Total (Rs.)</td><td className="f16d-n">{money(m.challanTotal)}</td><td colSpan={4} className="f16d-shade" /></tr>
              </tbody>
            </table>

            {/* Verification — Part A */}
            <table className="f16d-t">
              <tbody>
                <tr><th>Verification</th></tr>
                <tr>
                  <td className="f16d-l f16d-para">
                    I, <U w={120}>{v.name}</U>, son / daughter of <U w={120}>{v.father}</U> working in the capacity of <U w={70}>{v.designation}</U> (designation) do hereby certify that a sum of Rs. <u className="f16d-u">{money(m.totals.deducted)}</u> [Rs. <u className="f16d-u">{rupeesInWords(m.totals.deducted)}</u> (in words)] has been deducted and a sum of Rs. <u className="f16d-u">{money(m.totals.deposited)}</u> [Rs. <u className="f16d-u">{rupeesInWords(m.totals.deposited)}</u>] has been deposited to the credit of the Central Government. I further certify that the information given above is true, complete and correct and is based on the books of account, documents, TDS statements, TDS deposited and other available records.
                  </td>
                </tr>
              </tbody>
            </table>
            <SignBlock m={m} />

            <div className="f16d-notes">
              <div className="f16d-notes-h">Notes:</div>
              <ol>
                <li>Part B (Annexure) of the certificate in Form No.16 shall be issued by the employer.</li>
                <li>If an assessee is employed under one employer during the year, Part &apos;A&apos; of the certificate in Form No.16 issued for the quarter ending on 31st March of the financial year shall contain the details of tax deducted and deposited for all the quarters of the financial year.</li>
                <li>If an assessee is employed under more than one employer during the year, each of the employers shall issue Part A of the certificate in Form No.16 pertaining to the period for which such assessee was employed with each of the employers. Part B (Annexure) of the certificate in Form No. 16 may be issued by each of the employers or the last employer at the option of the assessee.</li>
                <li>To update PAN details in Income Tax Department database, apply for &apos;PAN change request&apos; through NSDL or UTITSL.</li>
              </ol>
              <div className="f16d-notes-h"><u>Legend used in Form 16</u></div>
              <div className="f16d-notes-h">* Status of matching with OLTAS</div>
              <table className="f16d-t f16d-legend">
                <colgroup><col style={{ width: '9%' }} /><col style={{ width: '14%' }} /><col /></colgroup>
                <thead><tr><th>Legend</th><th>Description</th><th>Definition</th></tr></thead>
                <tbody>{LEGEND.map(([k, d, def]) => <tr key={k}><th>{k}</th><td>{d}</td><td className="f16d-l">{def}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          {/* ============================ PART B ============================ */}
          <section className="f16d-part f16d-part-b">
            <div className="f16d-wm"><span>MYHOURLY HRMS</span></div>
            <CertHeader part="B" m={m} />
            <Annexure m={m} />
            <div className="f16d-gap" />
            <BreakupTable title="2. (f) Break up for ‘Amount of any other exemption under section 10’ to be filled in the table below" rows={breakup1} />
            <div className="f16d-gap" />
            <BreakupTable title="10(k). Break up for ‘Amount deductible under any other provision(s) of Chapter VIA ’to be filled in the table below" rows={breakup2} />

            {/* Verification — Part B */}
            <div className="f16d-gap" />
            <table className="f16d-t">
              <tbody>
                <tr><th>Verification</th></tr>
                <tr>
                  <td className="f16d-l f16d-para">
                    I, <U w={120}>{v.name}</U>, son/daughter of <U w={120}>{v.father}</U> .Working in the capacity of <U w={70}>{v.designation}</U> (Designation) do hereby certify that the information given above is true, complete and correct and is based on the books of account, documents, TDS statements, and other available records.
                  </td>
                </tr>
              </tbody>
            </table>
            <SignBlock m={m} />
            <div className="f16d-foot">Preview follows the structure of the supplied Form 16 blueprint while using MyHourly branding and a non-obstructive watermark.</div>
          </section>
        </div>
      </FitToWidth>
    </div>
  );
}

/* ------------------------------- PDF export --------------------------- */
export function exportForm16Pdf(m) {
  const b = m.base;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 30;
  const grid = {
    theme: 'grid',
    margin: { left: M, right: M, bottom: 34 },
    styles: { fontSize: 7.4, cellPadding: 3, lineColor: [70, 80, 95], lineWidth: 0.5, textColor: 20, valign: 'middle', font: 'helvetica' },
    headStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: 'bold', halign: 'center' },
  };
  const bold = (content, extra = {}) => ({ content, styles: { fontStyle: 'bold', halign: 'center', ...extra } });
  const y = () => doc.lastAutoTable.finalY;
  const table = (opts) => autoTable(doc, { ...grid, ...opts, startY: opts.startY ?? y() });

  const header = (part, startY) => {
    doc.setTextColor(20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('FORM NO. 16', W / 2, startY, { align: 'center' });
    doc.setFontSize(10.5); doc.text(`PART ${part}`, W / 2, startY + 15, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
    doc.text(doc.splitTextToSize('Certificate under Section 203 of the Income-tax Act, 1961 for tax deducted at source on salary paid to an employee under section 192 or pension/interest income of specified senior citizen under section 194P', W - 2 * M), W / 2, startY + 26, { align: 'center' });
    table({ startY: startY + 46, body: [[`Certificate No.: ${m.certNo}`, { content: `Last updated on: ${m.updated}`, styles: { halign: 'right' } }]] });
    table({ head: [['Name and address of the Employer/Specified Bank', 'Name and address of the Employee/Specified senior citizen']], body: [[lines(b.employerName, b.employerAddress, b.employerPhone, b.employerEmail) || '—', lines(b.employeeName, b.employeeAddress) || '—']] });
    table({
      head: [part === 'A' ? ['PAN of the Deductor', 'TAN of the Deductor', 'PAN of the Employee', 'Employee Reference No.'] : ['PAN of the Deductor', 'TAN of the Deductor', 'PAN of the Employee']],
      body: [part === 'A'
        ? [b.deductorPan || '—', formatTan(b.deductorTan) || '—', b.employeePan || '—', m.employeeRef || '']
        : [b.deductorPan || '—', formatTan(b.deductorTan) || '—', b.employeePan || '—']],
      bodyStyles: { halign: 'center' },
    });
    table({
      head: [['CIT (TDS)', 'Assessment Year', 'Period From', 'Period To']],
      body: [[m.cit || '—', b.assessmentYear || '—', fmtDMonY(b.employmentFrom), fmtDMonY(b.employmentTo)]],
      bodyStyles: { halign: 'center' },
    });
  };

  const verification = (partA) => {
    const v = m.ver;
    const text = partA
      ? `I, ${v.name || '____________'}, son / daughter of ${v.father || '____________'} working in the capacity of ${v.designation || '________'} (designation) do hereby certify that a sum of Rs. ${money(m.totals.deducted)} [Rs. ${rupeesInWords(m.totals.deducted)} (in words)] has been deducted and a sum of Rs. ${money(m.totals.deposited)} [Rs. ${rupeesInWords(m.totals.deposited)}] has been deposited to the credit of the Central Government. I further certify that the information given above is true, complete and correct and is based on the books of account, documents, TDS statements, TDS deposited and other available records.`
      : `I, ${v.name || '____________'}, son/daughter of ${v.father || '____________'} .Working in the capacity of ${v.designation || '________'} (Designation) do hereby certify that the information given above is true, complete and correct and is based on the books of account, documents, TDS statements, and other available records.`;
    table({ head: [['Verification']], body: [[{ content: text, styles: { halign: 'left', cellPadding: 5 } }]] });
    table({
      body: [
        [bold('Place'), v.place || '—', { content: `${v.signature ? `${v.signature}\n` : '\n'}(Signature of person responsible for deduction of Tax)`, rowSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } }],
        [bold('Date'), v.date],
        [{ content: `Designation: ${v.designation || '—'}`, colSpan: 2 }, `Full Name: ${v.name || '—'}`],
      ],
      columnStyles: { 0: { cellWidth: 60 }, 2: { cellWidth: 240 } },
    });
  };

  // ------------------------------ PART A ------------------------------
  header('A', 40);
  table({
    head: [[{ content: 'Summary of amount paid/credited and tax deducted at source thereon in respect of the employee', colSpan: 5 }], ['Quarter(s)', 'Receipt Numbers of original quarterly statements of TDS under sub-section (3) of Section 200', 'Amount paid/credited (Rs.)', 'Amount of tax deducted (Rs.)', 'Amount of tax deposited / remitted (Rs.)']],
    body: [
      ...m.quarters.map((q) => [q.label, q.receipt || '—', money(q.paid), money(q.deducted), money(q.deposited)]),
      [bold('Total (Rs.)'), '', bold(money(m.totals.paid), { halign: 'right' }), bold(money(m.totals.deducted), { halign: 'right' }), bold(money(m.totals.deposited), { halign: 'right' })],
    ],
    columnStyles: { 0: { halign: 'center' }, 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  });
  table({
    head: [[{ content: 'I. DETAILS OF TAX DEDUCTED AND DEPOSITED IN THE CENTRAL GOVERNMENT ACCOUNT THROUGH BOOK ADJUSTMENT', colSpan: 6 }], ['Sl. No.', 'Tax Deposited (Rs.)', 'Receipt No. of Form 24G', 'DDO serial no. in Form 24G', 'Date of transfer voucher', 'Status of matching with Form 24G']],
    body: [
      ...(m.book ? [['1', money(m.book.amount), m.book.receipt || '—', m.book.ddo || '—', fmtDMY(m.book.date), m.book.status || '—']] : []),
      [bold('Total (Rs.)'), bold(m.book ? money(m.book.amount) : '', { halign: 'right' }), { content: '', colSpan: 4 }],
    ],
    bodyStyles: { halign: 'center' },
  });
  table({
    head: [[{ content: 'II. DETAILS OF TAX DEDUCTED AND DEPOSITED IN THE CENTRAL GOVERNMENT ACCOUNT THROUGH CHALLAN', colSpan: 6 }], ['Sl. No.', 'Tax Deposited (Rs.)', 'BSR Code', 'Date of deposit (dd/mm/yyyy)', 'Challan Serial Number', 'Status of matching with OLTAS*']],
    body: [
      ...m.challanRows.map((c) => [c.sl, money(c.amount), c.bsr || '-', fmtDMY(c.date), c.serial || '-', c.status || '-']),
      [bold('Total (Rs.)'), bold(money(m.challanTotal), { halign: 'right' }), { content: '', colSpan: 4 }],
    ],
    bodyStyles: { halign: 'center' },
  });
  verification(true);

  // ------------------------------ PART B ------------------------------
  doc.addPage();
  header('B', 40);
  const cell = (content, isBold, extra = {}) => ({ content, styles: { fontStyle: isBold ? 'bold' : 'normal', ...extra } });
  const body = annexureRows(m).map((r) => {
    switch (r.t) {
      case 'yn': return [r.ref, r.label, { content: r.v, colSpan: 2, styles: { halign: 'center' } }];
      case 'head': return [r.ref, cell(r.label, true), cell(r.caps?.[0] || '', true, { halign: 'center' }), cell(r.caps?.[1] || '', true, { halign: 'center' })];
      case 'text': return [r.ref, r.label, '', ''];
      case 'row': return [cell(r.ref, r.bold), cell(r.label, r.bold), cell(r.i != null ? money(r.i) : '', r.bold), cell(r.o != null ? money(r.o) : '', r.bold)];
      case 'row2': return [r.ref, r.label, money(r.g), money(r.d)];
      case 'sub3': return ['', cell('Gross Amount  |  Qualifying Amount  |  Deductible Amount', true, { halign: 'right' }), '', ''];
      case 'row3': return [r.ref, `${r.label}\nGross: ${money(r.g)}    Qualifying: ${money(r.q)}`, '', money(r.d)];
      default: return ['', '', '', ''];
    }
  });
  table({
    head: [[{ content: 'Annexure - I  —  Details of Salary Paid and any other income and tax deducted', colSpan: 4, styles: { halign: 'left' } }]],
    body,
    columnStyles: { 0: { cellWidth: 28, halign: 'center' }, 2: { cellWidth: 80, halign: 'right' }, 3: { cellWidth: 80, halign: 'right' } },
  });
  verification(false);

  // watermark + footer on every page (drawn translucent so it never hides text)
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.07 }));
    doc.setTextColor(36, 104, 217); doc.setFont('helvetica', 'bold'); doc.setFontSize(56);
    doc.text('MYHOURLY HRMS', W / 2, H / 2, { align: 'center', angle: 32 });
    doc.restoreGraphicsState();
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120);
    doc.text(`Generated from MyHourly HRMS • Page ${i} of ${pages}`, W / 2, H - 16, { align: 'center' });
  }
  doc.save(`Form16_${b.employeeCode || b.employeeId || 'employee'}_${b.assessmentYear || ''}.pdf`);
}