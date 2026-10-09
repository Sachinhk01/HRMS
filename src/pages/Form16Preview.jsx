// Form 16 preview – mirrors the official TRACES Form 16 PDF (Part A + Part B + annexures).
// Used by Form16.jsx for both the side-panel preview and the "View Full Page" dialog.

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? 0 : Number(v));
// The official certificate prints plain amounts with 2 decimals (no thousand separators).
const a2 = (v) => num(v).toFixed(2);
// Use the backend-calculated value when it exists, otherwise calculate it from the components.
const pick = (backend, calc) => (backend === '' || backend == null ? calc : num(backend));
const sum = (...vals) => vals.reduce((t, v) => t + num(v), 0);
const quarterTotal = (quarter, suffix) => [1, 2, 3, 4].reduce((t, q) => t + num(quarter?.[`q${q}${suffix}`]), 0);

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parseDate = (v) => {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { y: m[1], m: Number(m[2]), d: m[3] };
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return null;
  return { y: String(dt.getFullYear()), m: dt.getMonth() + 1, d: String(dt.getDate()).padStart(2, '0') };
};
const dMonY = (v) => { const p = parseDate(v); return p ? `${p.d}-${MON[p.m - 1]}-${p.y}` : (v || '—'); };   // 07-Jun-2025
const dmy = (v) => { const p = parseDate(v); return p ? `${p.d}-${String(p.m).padStart(2, '0')}-${p.y}` : (v || '—'); }; // 03-05-2024
const dmySlash = (v) => { const p = parseDate(v); return p ? `${p.d}/${String(p.m).padStart(2, '0')}/${p.y}` : (v || ''); };

// Indian-system amount in words, e.g. 0 -> "Zero Only"
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const three = (n) => `${n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' : ''}` : ''}${two(n % 100)}`;
function inWords(v) {
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

// ---------- small building blocks ----------
// Every table uses the same 24-unit column grid, so vertical lines line up from top to bottom.
const GRID = 24;
const Grid = () => (
  <colgroup>{Array.from({ length: GRID }, (_, i) => <col key={i} style={{ width: `${100 / GRID}%` }} />)}</colgroup>
);
function Row({ sl, desc, a, b, bold = false, head = false }) {
  // a -> first amount column (spans two sub-columns), b -> last amount column
  return (
    <tr className={bold ? 'bold' : ''}>
      <td colSpan={2}>{sl}</td>
      <td colSpan={10} className="l">{desc}</td>
      {head ? <td colSpan={8}>{a}</td> : <td colSpan={8} className="r">{a}</td>}
      {head ? <td colSpan={4}>{b}</td> : <td colSpan={4} className="r">{b}</td>}
    </tr>
  );
}
const Row3 = ({ sl, desc, g, q, d }) => (
  <tr><td colSpan={2}>{sl}</td><td colSpan={10} className="l">{desc}</td><td colSpan={4} className="r">{g}</td><td colSpan={4} className="r">{q}</td><td colSpan={4} className="r">{d}</td></tr>
);
const Section = ({ sl, desc, note }) => (
  <tr><td colSpan={2}>{sl}</td><td className="l" colSpan={22}>{desc}{note && <> <b>{note}</b></>}</td></tr>
);

function CertHeader({ part, base }) {
  const cit = base.citTds || base.citTdsAddress || base.commissionerOfIncomeTax || '—';
  return (
    <>
      <table className="f16-pt">
        <Grid />
        <tbody>
          <tr><th colSpan={24} className="title">FORM NO. 16</th></tr>
          {part === 'A' && <tr><td colSpan={24}>[See rule 31(1)(a)]</td></tr>}
          <tr><th colSpan={24}>PART {part}</th></tr>
          <tr><th colSpan={24} className="small">Certificate under Section 203 of the Income-tax Act, 1961 for tax deducted at source on salary paid to an employee under section 192 or pension/interest income of specified senior citizen under section 194P</th></tr>
        </tbody>
      </table>
      <table className="f16-pt">
        <Grid />
        <tbody>
          <tr>
            <td colSpan={12} className="l"><b>Certificate No.</b> &nbsp; {base.certificateNo || '—'}</td>
            <td colSpan={12} className="r"><b>Last updated on</b> &nbsp; {dMonY(base.lastUpdatedOn)}</td>
          </tr>
        </tbody>
      </table>
      <table className="f16-pt">
        <Grid />
        <thead>
          <tr><th colSpan={12}>Name and address of the Employer/Specified Bank</th><th colSpan={12}>Name and address of the Employee/Specified senior citizen</th></tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={12} className="pre">{[base.employerName, base.employerAddress, base.employerPhone, base.employerEmail].filter(Boolean).join('\n') || '—'}</td>
            <td colSpan={12} className="pre">{[base.employeeName, base.employeeAddress].filter(Boolean).join('\n') || '—'}</td>
          </tr>
        </tbody>
      </table>
      <table className="f16-pt">
        <Grid />
        <thead>
          <tr>
            <th colSpan={6}>PAN of the Deductor</th>
            <th colSpan={6}>TAN of the Deductor</th>
            <th colSpan={12}>PAN of the Employee/Specified senior citizen</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={6} className="l">{base.deductorPan || '—'}</td>
            <td colSpan={6} className="l">{base.deductorTan || '—'}</td>
            <td colSpan={12} className="r">{base.employeePan || '—'}</td>
          </tr>
        </tbody>
      </table>
      <table className="f16-pt">
        <Grid />
        <thead>
          <tr><th colSpan={8}>CIT (TDS)</th><th colSpan={8}>Assessment Year</th><th colSpan={8}>Period with the Employer</th></tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={8} className="pre">{cit}</td>
            <td colSpan={8}>{base.assessmentYear || '—'}</td>
            <td colSpan={4}><b>From</b><br />{dMonY(base.employmentFrom)}</td>
            <td colSpan={4}><b>To</b><br />{dMonY(base.employmentTo)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

const NOTES = [
  '1. Part B (Annexure) of the certificate in Form No.16 shall be issued by the employer.',
  "2. If an assessee is employed under one employer during the year, Part 'A' of the certificate in Form No.16 issued for the quarter ending on 31st March of the financial year shall contain the details of tax deducted and deposited for all the quarters of the financial year.",
  '3. If an assessee is employed under more than one employer during the year, each of the employers shall issue Part A of the certificate in Form No.16 pertaining to the period for which such assessee was employed with each of the employers. Part B (Annexure) of the certificate in Form No. 16 may be issued by each of the employers or the last employer at the option of the assessee.',
  "4. To update PAN details in Income Tax Department database, apply for 'PAN change request' through NSDL or UTITSL.",
];
const LEGEND = [
  ['U', 'Unmatched', 'Deductors have not deposited taxes or have furnished incorrect particulars of tax payment. Final credit will be reflected only when payment details in bank match with details of deposit in TDS / TCS statement'],
  ['P', 'Provisional', 'Provisional tax credit is effected only for TDS / TCS Statements filed by Government deductors."P" status will be changed to Final (F) on verification of payment details submitted by Pay and Accounts Officer (PAO)'],
  ['F', 'Final', 'In case of non-government deductors, payment details of TDS / TCS deposited in bank by deductor have matched with the payment details mentioned in the TDS / TCS statement filed by the deductors. In case of government deductors, details of TDS / TCS booked in Government account have been verified by Pay & Accounts Officer (PAO)'],
  ['O', 'Overbooked', 'Payment details of TDS / TCS deposited in bank by deductor have matched with details mentioned in the TDS / TCS statement but the amount is over claimed in the statement. Final (F) credit will be reflected only when deductor reduces claimed amount in the statement or makes new payment for excess amount claimed in the statement'],
];

function SignBlock({ verification, base }) {
  return (
    <table className="f16-pt">
      <Grid />
      <tbody>
        <tr>
          <td colSpan={4} className="l"><b>Place</b></td>
          <td colSpan={8}>{verification?.place || '—'}</td>
          <td colSpan={12} rowSpan={2} className="sign">(Signature of person responsible for deduction of Tax)<br /><b>{verification?.signature || ''}</b></td>
        </tr>
        <tr>
          <td colSpan={4} className="l"><b>Date</b></td>
          <td colSpan={8}>{dMonY(verification?.date || base.lastUpdatedOn)}</td>
        </tr>
        <tr>
          <td colSpan={12} className="l"><b>Designation:</b> {verification?.designation || '—'}</td>
          <td colSpan={12} className="l"><b>Full Name:</b> {verification?.fullName || '—'}</td>
        </tr>
      </tbody>
    </table>
  );
}

const BlankBreakup = ({ title, particulars }) => (
  <table className="f16-pt f16-annex">
    <Grid />
    <thead>
      <tr><th className="l" colSpan={24}>{title}</th></tr>
      <tr><th colSpan={2}>Sl. No.</th><th colSpan={10}>{particulars}<br />Rs.</th><th colSpan={4}>Gross Amount<br />Rs.</th><th colSpan={4}>Qualifying Amount<br />Rs.</th><th colSpan={4}>Deductible Amount<br />Rs.</th></tr>
    </thead>
    <tbody>
      {[1, 2, 3, 4, 5, 6].map((n) => <tr key={n} className="blank"><td colSpan={2} className="l">{n}.</td><td colSpan={10} /><td colSpan={4} /><td colSpan={4} /><td colSpan={4} /></tr>)}
    </tbody>
  </table>
);

export default function Form16Preview({ base, quarter, challans, salary, exemption, section16, chapter, lastFields, verification }) {
  if (!base) return null;

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

  return (
    <div className="form16-paper f16-pdf">
      <div className="form16-watermark"><span>MYHOURLY HRMS</span></div>

      {/* =================== PART A =================== */}
      <div className="f16-brand">
        <div><b>TDS</b><br />Centralized Processing Cell</div>
        <div><b>TRACES</b><br />TDS Reconciliation Analysis and Correction Enabling System</div>
        <div>Government of India<br /><b>Income Tax Department</b></div>
      </div>

      <CertHeader part="A" base={base} />

      <table className="f16-pt"><Grid /><tbody><tr><th colSpan={24}>Summary of amount paid/credited and tax deducted at source thereon in respect of the employee</th></tr></tbody></table>
      <table className="f16-pt">
        <Grid />
        <thead>
          <tr>
            <th colSpan={4}>Quarter(s)</th>
            <th colSpan={8}>Receipt Numbers of original quarterly statements of TDS under sub-section (3) of Section 200</th>
            <th colSpan={4}>Amount paid/credited (Rs.)</th>
            <th colSpan={4}>Amount of tax deducted (Rs.)</th>
            <th colSpan={4}>Amount of tax deposited / remitted (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4].map((q) => (
            <tr key={q}>
              <td colSpan={4}>Q{q}</td>
              <td colSpan={8}>{quarter?.[`q${q}ReceiptNumber`] || '—'}</td>
              <td colSpan={4} className="r">{a2(quarter?.[`q${q}AmountPaidCredited`])}</td>
              <td colSpan={4} className="r">{a2(quarter?.[`q${q}TaxDeducted`])}</td>
              <td colSpan={4} className="r">{a2(quarter?.[`q${q}TaxDepositedRemitted`])}</td>
            </tr>
          ))}
          <tr className="bold"><td colSpan={4}>Total (Rs.)</td><td colSpan={8} className="grey" /><td colSpan={4} className="r">{a2(totalPaid)}</td><td colSpan={4} className="r">{a2(totalDeducted)}</td><td colSpan={4} className="r">{a2(totalRemitted)}</td></tr>
        </tbody>
      </table>

      <table className="f16-pt">
        <Grid />
        <tbody>
          <tr><th colSpan={24}>I. DETAILS OF TAX DEDUCTED AND DEPOSITED IN THE CENTRAL GOVERNMENT ACCOUNT THROUGH BOOK ADJUSTMENT<br /><span className="norm">(The deductor to provide payment wise details of tax deducted and deposited with respect to the deductee)</span></th></tr>
        </tbody>
      </table>
      <table className="f16-pt">
        <Grid />
        <thead>
          <tr>
            <th colSpan={4} rowSpan={2}>Sl. No.</th>
            <th colSpan={4} rowSpan={2}>Tax Deposited in respect of the deductee (Rs.)</th>
            <th colSpan={16}>Book Identification Number (BIN)</th>
          </tr>
          <tr>
            <th colSpan={4}>Receipt Numbers of Form No. 24G</th>
            <th colSpan={4}>DDO serial number in Form no. 24G</th>
            <th colSpan={4}>Date of transfer voucher (dd/mm/yyyy)</th>
            <th colSpan={4}>Status of matching with Form no. 24G</th>
          </tr>
        </thead>
        <tbody>
          {bookTotal > 0 && (
            <tr>
              <td colSpan={4}>1</td><td colSpan={4} className="r">{a2(bookTotal)}</td>
              <td colSpan={4}>{quarter?.receiptNumberForm24G || quarter?.form24GReceiptNumber || '—'}</td>
              <td colSpan={4}>{quarter?.ddoSerialNumberForm24G || quarter?.ddoSerialNumber || '—'}</td>
              <td colSpan={4}>{dmySlash(quarter?.dateOfTransferVoucher) || '—'}</td>
              <td colSpan={4}>{quarter?.statusOfMatchingWithForm24G || '—'}</td>
            </tr>
          )}
          <tr className="bold"><td colSpan={4}>Total (Rs.)</td><td colSpan={4} className="r">{a2(bookTotal)}</td><td className="grey" colSpan={16} /></tr>
        </tbody>
      </table>

      <table className="f16-pt">
        <Grid />
        <tbody>
          <tr><th colSpan={24}>II. DETAILS OF TAX DEDUCTED AND DEPOSITED IN THE CENTRAL GOVERNMENT ACCOUNT THROUGH CHALLAN<br /><span className="norm">(The deductor to provide payment wise details of tax deducted and deposited with respect to the deductee)</span></th></tr>
        </tbody>
      </table>
      <table className="f16-pt">
        <Grid />
        <thead>
          <tr>
            <th colSpan={4} rowSpan={2}>Sl. No.</th>
            <th colSpan={4} rowSpan={2}>Tax Deposited in respect of the deductee (Rs.)</th>
            <th colSpan={16}>Challan Identification Number (CIN)</th>
          </tr>
          <tr>
            <th colSpan={4}>BSR Code of the Bank Branch</th>
            <th colSpan={4}>Date on which Tax deposited (dd/mm/yyyy)</th>
            <th colSpan={4}>Challan Serial Number</th>
            <th colSpan={4}>Status of matching with OLTAS*</th>
          </tr>
        </thead>
        <tbody>
          {(challans || []).map((ch, i) => (
            <tr key={ch.id ?? i}>
              <td colSpan={4}>{ch.serialNumber ?? i + 1}</td>
              <td colSpan={4} className="r">{a2(ch.taxDeposited)}</td>
              <td colSpan={4}>{ch.bsrCode || '-'}</td>
              <td colSpan={4}>{ch.taxDepositedDate ? dmy(ch.taxDepositedDate) : '-'}</td>
              <td colSpan={4}>{ch.challanSerialNumber || '-'}</td>
              <td colSpan={4}>{ch.statusOfMatchingWithOltas || '-'}</td>
            </tr>
          ))}
          <tr className="bold"><td colSpan={4}>Total (Rs.)</td><td colSpan={4} className="r">{a2(challanTotal)}</td><td className="grey" colSpan={16} /></tr>
        </tbody>
      </table>

      <table className="f16-pt"><Grid /><tbody><tr><th colSpan={24}>Verification</th></tr></tbody></table>
      <table className="f16-pt">
        <Grid />
        <tbody>
          <tr>
            <td colSpan={24} className="l just">
              I, <b><u>{signer}</u></b>, son / daughter of <b><u>{sonOf}</u></b> working in the capacity of <b><u>{designation}</u></b> (designation) do hereby certify that a sum of Rs. <b><u>{a2(totalDeducted)}</u></b> [Rs. <b><u>{inWords(totalDeducted)}</u></b> (in words)] has been deducted and a sum of Rs. <b><u>{a2(challanTotal + bookTotal)}</u></b> [Rs. <b><u>{inWords(challanTotal + bookTotal)}</u></b>] has been deposited to the credit of the Central Government. I further certify that the information given above is true, complete and correct and is based on the books of account, documents, TDS statements, TDS deposited and other available records.
            </td>
          </tr>
        </tbody>
      </table>
      <SignBlock verification={verification} base={base} />

      <div className="f16-notes">
        <b>Notes:</b>
        {NOTES.map((n) => <div key={n}>{n}</div>)}
      </div>
      <div className="f16-legend-title"><u>Legend used in Form 16</u></div>
      <div className="f16-legend-sub">* Status of matching with OLTAS</div>
      <table className="f16-pt f16-legend">
        <Grid />
        <thead><tr><th colSpan={4}>Legend</th><th colSpan={4}>Description</th><th colSpan={16}>Definition</th></tr></thead>
        <tbody>
          {LEGEND.map(([k, d, def]) => <tr key={k}><td colSpan={4}><b>{k}</b></td><td colSpan={4}>{d}</td><td colSpan={16} className="l">{def}</td></tr>)}
        </tbody>
      </table>

      <div className="f16-page-gap" />

      {/* =================== PART B =================== */}
      <div className="f16-brand">
        <div><b>TDS</b><br />Centralized Processing Cell</div>
        <div><b>TRACES</b><br />TDS Reconciliation Analysis and Correction Enabling System</div>
        <div>Government of India<br /><b>Income Tax Department</b></div>
      </div>

      <CertHeader part="B" base={base} />

      <div className="f16-annexure-label">Annexure - I</div>
      <table className="f16-pt f16-partb">
        <Grid />
        <tbody>
          <tr><td className="l" colSpan={24}>Details of Salary Paid and any other income and tax deducted</td></tr>
          <tr><td colSpan={2}>A</td><td colSpan={10} className="l">Whether opting out of taxation u/s 115BAC(1A)?</td><td colSpan={12}>{base.optingOutOfTaxation115BAC1A ? 'Yes' : 'No'}</td></tr>

          <Row sl="1." desc="Gross Salary" a="Rs." b="Rs." head />
          <Row sl="(a)" desc="Salary as per provisions contained in section 17(1)" a={a2(s171)} />
          <Row sl="(b)" desc="Value of perquisites under section 17(2) (as per Form No. 12BA, wherever applicable)" a={a2(s172)} />
          <Row sl="(c)" desc="Profits in lieu of salary under section 17(3) (as per Form No. 12BA, wherever applicable)" a={a2(s173)} />
          <Row sl="(d)" desc="Total" b={a2(grossTotal1d)} />
          <Row sl="(e)" desc="Reported total amount of salary received from other employer(s)" b={a2(otherEmployer)} />

          <Section sl="2." desc="Less: Allowances to the extent exempt under section 10" />
          <Row sl="(a)" desc="Travel concession or assistance under section 10(5)" a={a2(ex('section10_5'))} />
          <Row sl="(b)" desc="Death-cum-retirement gratuity under section 10(10)" a={a2(ex('section10_10'))} />
          <Row sl="(c)" desc="Commuted value of pension under section 10(10A)" a={a2(ex('section10_10A'))} />
          <Row sl="(d)" desc="Cash equivalent of leave salary encashment under section 10(10AA)" a={a2(ex('section10_10AA'))} />
          <Row sl="(e)" desc="House rent allowance under section 10(13A)" a={a2(ex('section10_13A'))} />
          <Row sl="(f)" desc="Other special allowances under section 10(14)" a={a2(ex('section10_14'))} />
          <Row sl="(g)" desc={<>Amount of any other exemption under section 10 <b>[Note: Break-up to be filled and signed by employer in the table provide at the bottom of this form]</b></>} />
          <Row sl="(h)" desc="Total amount of any other exemption under section 10" a={a2(otherExemption)} />
          <Row sl="(i)" desc="Total amount of exemption claimed under section 10 [2(a)+2(b)+2(c)+2(d)+2(e)+2(f)+2(h)]" b={a2(exemptTotal)} />

          <Row sl="3." desc="Total amount of salary received from current employer [1(d)-2(i)]" b={a2(salaryFromCurrent)} />

          <Section sl="4." desc="Less: Deductions under section 16" />
          <Row sl="(a)" desc="Standard deduction under section 16(ia)" a={a2(d16a)} />
          <Row sl="(b)" desc="Entertainment allowance under section 16(ii)" a={a2(d16b)} />
          <Row sl="(c)" desc="Tax on employment under section 16(iii)" a={a2(d16c)} />
          <Row sl="5." desc="Total amount of deductions under section 16 [4(a)+4(b)+4(c)]" b={a2(d16Total)} />
          <Row sl="6." desc={'Income chargeable under the head "Salaries" [(3+1(e)-5]'} b={a2(chargeable)} />

          <Section sl="7." desc="Add: Any other income reported by the employee under as per section 192 (2B)" />
          <Row sl="(a)" desc="Income (or admissible loss) from house property reported by employee offered for TDS" a={a2(hp)} />
          <Row sl="(b)" desc="Income under the head Other Sources offered for TDS" a={a2(os)} />
          <Row sl="8." desc="Total amount of other income reported by the employee [7(a)+7(b)]" b={a2(otherIncome)} />
          <Row sl="9." desc="Gross total income (6+8)" b={a2(grossTotalIncome)} bold />

          <Row sl="10." desc="Deductions under Chapter VI-A" a="Gross Amount" b="Deductible Amount" head />
          <Row sl="(a)" desc="Deduction in respect of life insurance premia, contributions to provident fund etc. under section 80C" a={a2(c('section80C'))} b={a2(c('section80C'))} />
          <Row sl="(b)" desc="Deduction in respect of contribution to certain pension funds under section 80CCC" a={a2(c('section80CCC'))} b={a2(c('section80CCC'))} />
          <Row sl="(c)" desc="Deduction in respect of contribution by taxpayer to pension scheme under section 80CCD (1)" a={a2(c('section80CCD1'))} b={a2(c('section80CCD1'))} />
          <Row sl="(d)" desc="Total deduction under section 80C, 80CCC and 80CCD(1)" a={a2(c80Total)} b={a2(c80Total)} />
          <Row sl="(e)" desc="Deductions in respect of amount paid/deposited to notified pension scheme under section 80CCD (1B)" a={a2(c('section80CCD1B'))} b={a2(c('section80CCD1B'))} />
          <Row sl="(f)" desc="Deduction in respect of contribution by Employer to pension scheme under section 80CCD (2)" a={a2(c('section80CCD2'))} b={a2(c('section80CCD2'))} />
          <Row sl="(g)" desc="Deduction in respect of health insurance premia under section 80D" a={a2(c('section80D'))} b={a2(c('section80D'))} />
          <Row sl="(h)" desc="Deduction in respect of interest on loan taken for higher education under section 80E" a={a2(c('section80E'))} b={a2(c('section80E'))} />
          <Row sl="(i)" desc="Deduction in respect of contribution by the employee to Agnipath Scheme under section 80CCH" a={a2(c('section80CCH'))} b={a2(c('section80CCH'))} />
          <Row sl="(j)" desc="Deduction in respect of contribution by the Central Government to Agnipath Scheme under section 80CCH" a={a2(c('section80CCH2'))} b={a2(c('section80CCH2'))} />

          <tr className="subhead"><td colSpan={12} /><td colSpan={4}>Gross Amount</td><td colSpan={4}>Qualifying Amount</td><td colSpan={4}>Deductible Amount</td></tr>
          <Row3 sl="(k)" desc="Total Deduction in respect of donations to certain funds, charitable institutions, etc. under section 80G" g={a2(c('section80G'))} q={a2(c('section80G'))} d={a2(c('section80G'))} />
          <Row3 sl="(l)" desc="Deduction in respect of interest on deposits in savings account under section 80TTA" g={a2(c('section80TTA'))} q={a2(c('section80TTA'))} d={a2(c('section80TTA'))} />
          <tr><td colSpan={2}>(m)</td><td className="l" colSpan={22}>Amount Deductible under any other provision (s) of Chapter VI-A <b>[Note: Break-up to be filled and signed by employer in the table provide at the bottom of this form]</b></td></tr>
          <Row3 sl="(n)" desc="Total of amount deductible under any other provision(s) of Chapter VI-A" g={a2(cOthers)} q={a2(cOthers)} d={a2(cOthers)} />

          <Row sl="11." desc="Aggregate of deductible amount under Chapter VI-A [10(d)+10(e)+10(f)+10(g)+10(h)+10(i)+10(j)+10(k)+10(l)+10(n)]" b={a2(chapterTotal)} />
          <Row sl="12." desc="Total taxable income (9-11)" b={a2(taxableIncome)} bold />
          <Row sl="13." desc="Tax on total income" b={a2(l('taxOnTotalIncome'))} />
          <Row sl="14." desc="Rebate under section 87A, if applicable" b={a2(l('rebateUnderSection87A'))} />
          <Row sl="15." desc="Surcharge, wherever applicable" b={a2(l('surcharge'))} />
          <Row sl="16." desc="Health and education cess" b={a2(l('healthAndEducationCess'))} />
          <Row sl="17." desc="Tax payable (13+15+16-14)" b={a2(taxPayable)} />
          <Row sl="18." desc="Less: Relief under section 89 (attach details)" b={a2(l('reliefUnderSection89'))} />
          <Row sl="19." desc="Less: Tax deducted at source as per Form No. 12BAA submitted under provisions of section 192(2B)" b={a2(l('taxDeductedAtSourceForm12BAA'))} />
          <Row sl="20." desc="Less: Tax collected at source as per Form No. 12BAA submitted under provisions of section 192(2B)" b={a2(l('taxCollectedAtSourceForm12BAA'))} />
          <Row sl="21." desc="Net tax payable (17-18-19-20)" b={a2(netTax)} bold />
        </tbody>
      </table>

      <table className="f16-pt"><Grid /><tbody><tr><th colSpan={24} className="norm">Verification</th></tr></tbody></table>
      <table className="f16-pt">
        <Grid />
        <tbody>
          <tr>
            <td colSpan={24} className="l just">
              I, <u>{signer}</u>, son/daughter of <u>{sonOf}</u> .Working in the capacity of <u>{designation}</u> (Designation) do hereby certify that the information given above is true, complete and correct and is based on the books of account, documents, TDS statements, and other available records.
            </td>
          </tr>
        </tbody>
      </table>
      <SignBlock verification={verification} base={base} />

      <div className="f16-page-gap" />

      {/* =================== ANNEXURE BREAK-UPS =================== */}
      <BlankBreakup title="2. (f) Break up for ‘Amount of any other exemption under section 10’ to be filled in the table below" particulars="Particular's of Amount for any other exemption under section 10" />
      <div className="f16-gap" />
      <BlankBreakup title="10(k). Break up for ‘Amount deductible under any other provision(s) of Chapter VIA ‘to be filled in the table below" particulars="Particular's of Amount deductible under any other provision(s) of Chapter VIA" />
      <div className="f16-gap" />
      <SignBlock verification={verification} base={base} />

      <div className="f16-preview-note">Preview follows the layout of the official TRACES Form 16 (Part A, Part B and annexures) with a non-obstructive MyHourly watermark.</div>
    </div>
  );
}