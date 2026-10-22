// Shared Form 16 helpers + figures. Used by BOTH the on-screen preview (pages/Form16Preview.jsx)
// and the PDF builder (utils/form16Pdf.js) so the two can never show different numbers.

export const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? 0 : Number(v));
// The official certificate prints plain amounts with 2 decimals (no thousand separators).
export const a2 = (v) => num(v).toFixed(2);
// Use the backend-calculated value when it exists, otherwise calculate it from the components.
export const pick = (backend, calc) => (backend === '' || backend == null ? calc : num(backend));
export const sum = (...vals) => vals.reduce((t, v) => t + num(v), 0);
export const quarterTotal = (quarter, suffix) => [1, 2, 3, 4].reduce((t, q) => t + num(quarter?.[`q${q}${suffix}`]), 0);

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parseDate = (v) => {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { y: m[1], m: Number(m[2]), d: m[3] };
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return null;
  return { y: String(dt.getFullYear()), m: dt.getMonth() + 1, d: String(dt.getDate()).padStart(2, '0') };
};
export const dMonY = (v) => { const p = parseDate(v); return p ? `${p.d}-${MON[p.m - 1]}-${p.y}` : (v || '—'); };   // 07-Jun-2025
export const dmy = (v) => { const p = parseDate(v); return p ? `${p.d}-${String(p.m).padStart(2, '0')}-${p.y}` : (v || '—'); }; // 03-05-2024
export const dmySlash = (v) => { const p = parseDate(v); return p ? `${p.d}/${String(p.m).padStart(2, '0')}/${p.y}` : (v || ''); };

// Indian-system amount in words, e.g. 0 -> "Zero Only"
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const three = (n) => `${n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' : ''}` : ''}${two(n % 100)}`;
export function inWords(v) {
  const total = Math.round(num(v) * 100);
  if (!total) return 'Zero Only';
  let rupees = Math.floor(total / 100);
  const paise = total % 100;
  const parts = [];
  const crore = Math.floor(rupees / 1e7); rupees %= 1e7;
  const lakh = Math.floor(rupees / 1e5); rupees %= 1e5;
  const thousand = Math.floor(rupees / 1e3); rupees %= 1e3;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rupees) parts.push(three(rupees));
  let text = parts.join(' ') || 'Zero';
  if (paise) text += ` and ${two(paise)} Paise`;
  return `${text} Only`;
}

export const NOTES = [
  '1. Part B (Annexure) of the certificate in Form No.16 shall be issued by the employer.',
  "2. If an assessee is employed under one employer during the year, Part 'A' of the certificate in Form No.16 issued for the quarter ending on 31st March of the financial year shall contain the details of tax deducted and deposited for all the quarters of the financial year.",
  '3. If an assessee is employed under more than one employer during the year, each of the employers shall issue Part A of the certificate in Form No.16 pertaining to the period for which such assessee was employed with each of the employers. Part B (Annexure) of the certificate in Form No. 16 may be issued by each of the employers or the last employer at the option of the assessee.',
  "4. To update PAN details in Income Tax Department database, apply for 'PAN change request' through NSDL or UTITSL.",
];
export const LEGEND = [
  ['U', 'Unmatched', 'Deductors have not deposited taxes or have furnished incorrect particulars of tax payment. Final credit will be reflected only when payment details in bank match with details of deposit in TDS / TCS statement'],
  ['P', 'Provisional', 'Provisional tax credit is effected only for TDS / TCS Statements filed by Government deductors."P" status will be changed to Final (F) on verification of payment details submitted by Pay and Accounts Officer (PAO)'],
  ['F', 'Final', 'In case of non-government deductors, payment details of TDS / TCS deposited in bank by deductor have matched with the payment details mentioned in the TDS / TCS statement filed by the deductors. In case of government deductors, details of TDS / TCS booked in Government account have been verified by Pay & Accounts Officer (PAO)'],
  ['O', 'Overbooked', 'Payment details of TDS / TCS deposited in bank by deductor have matched with details mentioned in the TDS / TCS statement but the amount is over claimed in the statement. Final (F) credit will be reflected only when deductor reduces claimed amount in the statement or makes new payment for excess amount claimed in the statement'],
];

// All derived Part A / Part B figures, exactly as the preview has always calculated them.
export function computeForm16({ base, quarter, challans, salary, exemption, section16, chapter, lastFields, verification }) {
  // ---------------- Part A figures ----------------
  const totalPaid = quarterTotal(quarter, 'AmountPaidCredited');
  const totalDeducted = quarterTotal(quarter, 'TaxDeducted');
  const totalRemitted = quarterTotal(quarter, 'TaxDepositedRemitted');
  const challanTotal = (challans || []).reduce((t, c) => t + num(c.taxDeposited), 0);
  const bookTotal = num(quarter?.bookAdjustmentTaxDeposited);

  // ---------------- Part B figures ----------------
  const s171 = num(salary?.salaryUnderSection17_1);
  const s172 = num(salary?.perquisitesUnderSection17_2);
  const s173 = num(salary?.profitsInLieuOfSalaryUnderSection17_3);
  const grossTotal1d = s171 + s172 + s173;
  const otherEmployer = num(salary?.salaryReceivedFromOtherEmployers ?? section16?.salaryReceivedFromOtherEmployers);

  const ex = (k) => num(exemption?.[k]);
  const otherExemption = ex('otherSection10') + ex('section10_10B');
  const exemptTotal = pick(exemption?.totalExemption, sum(ex('section10_5'), ex('section10_10'), ex('section10_10A'), ex('section10_10AA'), ex('section10_13A'), ex('section10_14'), otherExemption));

  const salaryFromCurrent = grossTotal1d - exemptTotal;
  const d16a = num(section16?.standardDeductionSection16I);
  const d16b = num(section16?.entertainmentAllowanceSection16II);
  const d16c = num(section16?.taxOnEmploymentSection16III);
  const d16Total = pick(section16?.totalDeductionsSection16, d16a + d16b + d16c);
  const chargeable = salaryFromCurrent + otherEmployer - d16Total;
  const hp = num(section16?.incomeLossHouseProperty);
  const os = num(section16?.incomeUnderOtherSources);
  const otherIncome = hp + os;
  const grossTotalIncome = pick(section16?.grossTotalIncome, chargeable + otherIncome);

  const c = (k) => num(chapter?.[k]);
  const c80Total = c('section80C') + c('section80CCC') + c('section80CCD1');
  const cOthers = c('amountDeductibleUnderAnyOtherProvisionChapterVIA') + c('otherChapterVIA') + c('section80TTB') + c('section80EEA') + c('section80GG');
  const chapterTotal = pick(chapter?.totalChapterVIA, c80Total + c('section80CCD1B') + c('section80CCD2') + c('section80D') + c('section80E') + c('section80CCH') + c('section80CCH2') + c('section80G') + c('section80TTA') + cOthers);
  const taxableIncome = pick(chapter?.totalTaxableIncome, grossTotalIncome - chapterTotal);

  const l = (k) => num(lastFields?.[k]);
  const taxPayable = pick(lastFields?.taxPayable, l('taxOnTotalIncome') + l('surcharge') + l('healthAndEducationCess') - l('rebateUnderSection87A'));
  const netTax = pick(lastFields?.netTaxPayable, taxPayable - l('reliefUnderSection89') - l('taxDeductedAtSourceForm12BAA') - l('taxCollectedAtSourceForm12BAA'));

  const sonOf = verification?.fatherName || verification?.sonDaughterOf || '—';
  const designation = verification?.designation || '—';
  const signer = verification?.fullName || '—';

  return {
    totalPaid, totalDeducted, totalRemitted, challanTotal, bookTotal,
    s171, s172, s173, grossTotal1d, otherEmployer, ex, otherExemption, exemptTotal, salaryFromCurrent,
    d16a, d16b, d16c, d16Total, chargeable, hp, os, otherIncome, grossTotalIncome,
    c, c80Total, cOthers, chapterTotal, taxableIncome, l, taxPayable, netTax,
    sonOf, designation, signer,
  };
}