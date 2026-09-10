import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  Loader2,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { form16Service, getForm16EmployeeDropdown } from '../services/form16Service';
import './Form16.css';

const num = (v) => (v === '' || v == null ? 0 : Number(v));
const money = (v) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v));
const today = () => new Date().toISOString().slice(0, 10);
const currentAssessmentYear = () => {
  const d = new Date();
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start + 1}-${String(start + 2).slice(-2)}`;
};
const financialPeriod = () => {
  const d = new Date();
  const fyStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` };
};
const emptyQuarter = {
  q1AmountPaidCredited: '', q1TaxDeducted: '', q1TaxDepositedRemitted: '',
  q2AmountPaidCredited: '', q2TaxDeducted: '', q2TaxDepositedRemitted: '',
  q3AmountPaidCredited: '', q3TaxDeducted: '', q3TaxDepositedRemitted: '',
  q4AmountPaidCredited: '', q4TaxDeducted: '', q4TaxDepositedRemitted: '',
  bookAdjustmentTaxDeposited: '', statusOfMatchingWithForm24G: '',
};
const emptySalary = { salaryUnderSection17_1: '', perquisitesUnderSection17_2: '', profitsInLieuOfSalaryUnderSection17_3: '', grossSalary: '', salaryReceivedFromOtherEmployers: '' };
const emptyExemption = { section10_5: '', section10_10: '', section10_10A: '', section10_10AA: '', section10_13A: '', section10_10B: '', otherSection10: '' };
const emptySection16 = { salaryReceivedFromOtherEmployers: '', standardDeductionSection16I: '', entertainmentAllowanceSection16II: '', taxOnEmploymentSection16III: '', incomeLossHouseProperty: '', incomeUnderOtherSources: '' };
const emptyChapter = { section80C: '', section80CCC: '', section80CCD1: '', section80CCD1B: '', section80CCD2: '', section80D: '', section80CCH: '', section80CCH2: '', section80E: '', amountDeductibleUnderAnyOtherProvisionChapterVIA: '', section80EEA: '', section80G: '', section80GG: '', section80TTA: '', section80TTB: '', otherChapterVIA: '' };
const emptyLast = { taxOnTotalIncome: '', rebateUnderSection87A: '', surcharge: '', healthAndEducationCess: '', reliefUnderSection89: '', taxDeductedAtSourceForm12BAA: '', taxCollectedAtSourceForm12BAA: '' };
const emptyVerification = { place: '', designation: '', fullName: '', signature: '' };
const emptyChallan = { taxDeposited: '', bsrCode: '', taxDepositedDate: today(), challanSerialNumber: '', statusOfMatchingWithOltas: 'F' };

function safePayload(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => {
    if (v === '') return [k, null];
    if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && !['bsrCode', 'challanSerialNumber'].includes(k)) return [k, Number(v)];
    return [k, v];
  }));
}

function Field({ label, value, onChange, type = 'text', full = false, readOnly = false, children, placeholder }) {
  return <label className={`f16-field ${full ? 'full' : ''}`}>
    <span>{label}</span>
    {children || (readOnly ? <div className="f16-readonly">{value || '—'}</div> : <input type={type} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} />)}
  </label>;
}

function SectionEditor({ title, fields, value, setValue, onSave, saving, exists, note, children }) {
  return <div className="f16-form">
    <div className="f16-section-heading"><div><h4>{title}</h4>{note && <div className="f16-note">{note}</div>}</div></div>
    {children || <div className="f16-form-grid">
      {fields.map((f) => <Field key={f.key} label={f.label} type={f.type || 'number'} value={value[f.key]} onChange={(v) => setValue((s) => ({ ...s, [f.key]: v }))} />)}
    </div>}
    {!children && <div className="f16-savebar"><button className="btn btn-primary" type="button" onClick={onSave} disabled={saving}><Save size={16}/>{saving ? 'Saving...' : exists ? 'Save Changes' : 'Create Section'}</button></div>}
  </div>;
}

function FormPreview({ base, quarter, challans, salary, exemption, section16, chapter, lastFields, verification }) {
  if (!base) return <div className="f16-empty"><FileText size={44}/><strong>No Form 16 loaded</strong>Select an employee and generate or load a Form 16.</div>;
  const qRows = [1,2,3,4].map((q) => [
    `Q${q}`,
    quarter?.[`q${q}ReceiptNumber`] || '—',
    money(quarter?.[`q${q}AmountPaidCredited`]),
    money(quarter?.[`q${q}TaxDeducted`]),
    money(quarter?.[`q${q}TaxDepositedRemitted`]),
  ]);
  return <div className="form16-paper">
    <div className="form16-watermark"><span>MYHOURLY HRMS</span></div>
    <div className="f16-doc-header">
      <div className="title">FORM NO. 16</div><div className="part">PART A &amp; PART B</div>
      <div className="subtitle">Certificate under Section 203 of the Income-tax Act, 1961 for tax deducted at source on salary</div>
    </div>
    <div className="f16-doc-box">
      <div className="f16-doc-cell"><span className="f16-doc-label">Name and address of Employer</span><b>{base.employerName || '—'}</b><br/>{base.employerAddress || '—'}<br/>{base.employerPhone || ''}<br/>{base.employerEmail || ''}</div>
      <div className="f16-doc-cell"><span className="f16-doc-label">Name and address of Employee</span><b>{base.employeeName || '—'}</b><br/>{base.employeeAddress || '—'}<br/>{base.employeeCode || ''}</div>
    </div>
    <div className="f16-mini-grid">
      <div><b>PAN of Deductor</b><br/>{base.deductorPan || '—'}</div><div><b>TAN of Deductor</b><br/>{base.deductorTan || '—'}</div><div><b>PAN of Employee</b><br/>{base.employeePan || '—'}</div>
    </div>
    <div className="f16-mini-grid">
      <div><b>Assessment Year</b><br/>{base.assessmentYear || '—'}</div><div><b>Period From</b><br/>{base.employmentFrom || '—'}</div><div><b>Period To</b><br/>{base.employmentTo || '—'}</div>
    </div>
    <div className="f16-section-title">Summary of amount paid/credited and tax deducted at source</div>
    <table className="f16-preview-table"><thead><tr><th>Quarter</th><th>Receipt No.</th><th>Amount paid</th><th>Tax deducted</th><th>Tax deposited</th></tr></thead><tbody>{qRows.map((r) => <tr key={r[0]}>{r.map((c,i)=><td key={i}>{c}</td>)}</tr>)}</tbody></table>
    <div className="f16-section-title">PART B — Details of Salary Paid and Tax Deducted</div>
    <table className="f16-preview-table"><tbody>
      <tr><td>1(a) Salary under section 17(1)</td><td>{money(salary?.salaryUnderSection17_1)}</td></tr>
      <tr><td>1(b) Perquisites under section 17(2)</td><td>{money(salary?.perquisitesUnderSection17_2)}</td></tr>
      <tr><td>1(c) Profits in lieu of salary under section 17(3)</td><td>{money(salary?.profitsInLieuOfSalaryUnderSection17_3)}</td></tr>
      <tr><th>Gross Salary</th><th>{money(salary?.grossSalary)}</th></tr>
      <tr><td>Total exemption under section 10</td><td>{money(exemption?.totalExemption)}</td></tr>
      <tr><td>Total deduction under section 16</td><td>{money(section16?.totalDeductionsSection16)}</td></tr>
      <tr><td>Gross total income</td><td>{money(section16?.grossTotalIncome)}</td></tr>
      <tr><td>Aggregate deduction Chapter VI-A</td><td>{money(chapter?.totalChapterVIA)}</td></tr>
      <tr><th>Total taxable income</th><th>{money(chapter?.totalTaxableIncome)}</th></tr>
      <tr><td>Tax on total income</td><td>{money(lastFields?.taxOnTotalIncome)}</td></tr>
      <tr><th>Net tax payable</th><th>{money(lastFields?.netTaxPayable)}</th></tr>
    </tbody></table>
    {!!challans?.length && <><div className="f16-section-title">Challan Identification Number (CIN)</div><table className="f16-preview-table"><thead><tr><th>Sl.</th><th>Tax deposited</th><th>BSR Code</th><th>Date</th><th>Challan No.</th><th>OLTAS</th></tr></thead><tbody>{challans.map((c)=><tr key={c.id}><td>{c.serialNumber}</td><td>{money(c.taxDeposited)}</td><td>{c.bsrCode||'—'}</td><td>{c.taxDepositedDate||'—'}</td><td>{c.challanSerialNumber||'—'}</td><td>{c.statusOfMatchingWithOltas||'—'}</td></tr>)}</tbody></table></>}
    <div className="f16-section-title">Verification</div>
    <div className="f16-doc-box"><div className="f16-doc-cell">Place: <b>{verification?.place || '—'}</b><br/>Date: <b>{verification?.date || base.lastUpdatedOn || '—'}</b></div><div className="f16-doc-cell">Designation: <b>{verification?.designation || '—'}</b><br/>Full Name: <b>{verification?.fullName || '—'}</b><br/>Signature: <b>{verification?.signature || '—'}</b></div></div>
    <div className="f16-preview-note">Preview follows the structure of the supplied Form 16 blueprint while using MyHourly branding and a non-obstructive watermark.</div>
  </div>;
}

export default function Form16() {
  const { user } = useAuth();
  const role = user?.role || user?.roles?.[0];
  const canManage = ['HR_ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(role);
  const period = useMemo(financialPeriod, []);
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [assessmentYear, setAssessmentYear] = useState(currentAssessmentYear());
  const [baseDraft, setBaseDraft] = useState({ employeeAddress: '', assessmentYear: currentAssessmentYear(), employmentFrom: period.from, employmentTo: period.to, optingOutOfTaxation115BAC1A: false });
  const [base, setBase] = useState(null);
  const [quarter, setQuarter] = useState(null); const [quarterDraft, setQuarterDraft] = useState(emptyQuarter);
  const [challans, setChallans] = useState([]); const [challanDraft, setChallanDraft] = useState(emptyChallan); const [editingChallan, setEditingChallan] = useState(null);
  const [salary, setSalary] = useState(null); const [salaryDraft, setSalaryDraft] = useState(emptySalary);
  const [exemption, setExemption] = useState(null); const [exemptionDraft, setExemptionDraft] = useState(emptyExemption);
  const [section16, setSection16] = useState(null); const [section16Draft, setSection16Draft] = useState(emptySection16);
  const [chapter, setChapter] = useState(null); const [chapterDraft, setChapterDraft] = useState(emptyChapter);
  const [lastFields, setLastFields] = useState(null); const [lastDraft, setLastDraft] = useState(emptyLast);
  const [verification, setVerification] = useState(null); const [verificationDraft, setVerificationDraft] = useState(emptyVerification);
  const [tab, setTab] = useState('overview'); const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState('');

  useEffect(() => { if (canManage) getForm16EmployeeDropdown().then(setEmployees).catch(() => setEmployees([])); }, [canManage]);
  useEffect(() => setBaseDraft((s) => ({ ...s, assessmentYear })), [assessmentYear]);

  const loadChildren = useCallback(async (id) => {
    const specs = [
      ['quarter', form16Service.getQuarter, setQuarter, setQuarterDraft, emptyQuarter],
      ['salary', form16Service.getSalary, setSalary, setSalaryDraft, emptySalary],
      ['exemption', form16Service.getExemption, setExemption, setExemptionDraft, emptyExemption],
      ['section16', form16Service.getSection16, setSection16, setSection16Draft, emptySection16],
      ['chapter', form16Service.getChapterVIA, setChapter, setChapterDraft, emptyChapter],
      ['lastFields', form16Service.getLastFields, setLastFields, setLastDraft, emptyLast],
      ['verification', form16Service.getVerification, setVerification, setVerificationDraft, emptyVerification],
    ];
    await Promise.all(specs.map(async ([, getter, setter, draftSetter, empty]) => {
      try { const d = await getter(id); setter(d); draftSetter({ ...empty, ...d }); } catch (e) { if (e.status === 404) { setter(null); draftSetter(empty); } }
    }));
    try { const d = await form16Service.getChallans(id); setChallans(d?.challans || []); } catch { setChallans([]); }
  }, []);

  const loadExisting = async () => {
    if (!employeeId || !assessmentYear) { setError('Select an employee and assessment year.'); return; }
    setLoading(true); setError(''); setNotice('');
    try {
      const d = await form16Service.getByEmployeeYear(employeeId, assessmentYear);
      setBase(d); setBaseDraft({ employeeAddress: d.employeeAddress || '', assessmentYear: d.assessmentYear || assessmentYear, employmentFrom: d.employmentFrom || period.from, employmentTo: d.employmentTo || period.to, optingOutOfTaxation115BAC1A: !!d.optingOutOfTaxation115BAC1A });
      await loadChildren(d.id); setNotice('Form 16 loaded successfully.');
    } catch (e) { setBase(null); setError(e.status === 404 ? 'No Form 16 exists for this employee and assessment year. Use Generate Form 16.' : e.message); }
    finally { setLoading(false); }
  };

  const generate = async () => {
    if (!employeeId) { setError('Select an employee before generating Form 16.'); return; }
    setSaving(true); setError(''); setNotice('');
    try { const d = await form16Service.create(employeeId, baseDraft); setBase(d); await loadChildren(d.id); setNotice('Form 16 generated successfully. You can now edit Part A and Part B details.'); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const toggleActive = async (active) => {
    if (!employeeId || !base) return; setSaving(true); setError('');
    try { active ? await form16Service.activate(employeeId) : await form16Service.deactivate(employeeId); setBase((b) => ({ ...b, active })); setNotice(`Form 16 ${active ? 'activated' : 'deactivated'} successfully.`); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const saveSection = async ({ existing, draft, create, update, setter, draftSetter }) => {
    if (!base?.id) { setError('Generate or load Form 16 first.'); return; }
    setSaving(true); setError(''); setNotice('');
    try { const result = existing ? await update(base.id, safePayload(draft)) : await create(base.id, safePayload(draft)); setter(result); draftSetter((s) => ({ ...s, ...result })); setNotice('Form 16 section saved successfully.'); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const saveChallan = async () => {
    if (!base?.id) return; setSaving(true); setError('');
    try { editingChallan ? await form16Service.updateChallan(base.id, editingChallan.id, safePayload(challanDraft)) : await form16Service.createChallan(base.id, safePayload(challanDraft)); const d = await form16Service.getChallans(base.id); setChallans(d?.challans || []); setEditingChallan(null); setChallanDraft(emptyChallan); setNotice('Challan saved successfully.'); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const deleteChallan = async (id) => { if (!base?.id) return; try { await form16Service.deleteChallan(base.id, id); setChallans((s)=>s.filter((c)=>c.id!==id)); setNotice('Challan deleted.'); } catch(e){setError(e.message);} };

  const exportPdf = () => {
    if (!base) return;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const watermark = () => { doc.saveGraphicsState(); doc.setTextColor(225, 228, 240); doc.setFontSize(42); doc.text('MYHOURLY HRMS', W / 2, 430, { align: 'center', angle: 32 }); doc.restoreGraphicsState(); };
    watermark(); doc.setTextColor(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('FORM NO. 16', W/2, 42, {align:'center'}); doc.setFontSize(11); doc.text('PART A & PART B', W/2, 60, {align:'center'}); doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.text('Certificate under Section 203 of the Income-tax Act, 1961 for tax deducted at source on salary', W/2, 74, {align:'center'});
    autoTable(doc,{startY:88,theme:'grid',styles:{fontSize:7,cellPadding:4},body:[['Employer',`${base.employerName||'—'}\n${base.employerAddress||''}`,'Employee',`${base.employeeName||'—'}\n${base.employeeAddress||''}`],['Deductor PAN',base.deductorPan||'—','Employee PAN',base.employeePan||'—'],['Deductor TAN',base.deductorTan||'—','Assessment Year',base.assessmentYear||'—'],['Employment Period',`${base.employmentFrom||'—'} to ${base.employmentTo||'—'}`,'Certificate No.',base.certificateNo||'—']]});
    let y=doc.lastAutoTable.finalY+12; doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.text('Summary of amount paid/credited and tax deducted at source',40,y); y+=6;
    autoTable(doc,{startY:y,theme:'grid',styles:{fontSize:7},head:[['Quarter','Receipt No.','Amount Paid','Tax Deducted','Tax Deposited']],body:[1,2,3,4].map(q=>[`Q${q}`,quarter?.[`q${q}ReceiptNumber`]||'—',money(quarter?.[`q${q}AmountPaidCredited`]),money(quarter?.[`q${q}TaxDeducted`]),money(quarter?.[`q${q}TaxDepositedRemitted`])])});
    y=doc.lastAutoTable.finalY+12; doc.setFontSize(9); doc.text('PART B — Salary and Tax Computation',40,y); y+=6;
    autoTable(doc,{startY:y,theme:'grid',styles:{fontSize:7},body:[['Salary u/s 17(1)',money(salary?.salaryUnderSection17_1)],['Perquisites u/s 17(2)',money(salary?.perquisitesUnderSection17_2)],['Gross Salary',money(salary?.grossSalary)],['Total Exemption u/s 10',money(exemption?.totalExemption)],['Total Deductions u/s 16',money(section16?.totalDeductionsSection16)],['Gross Total Income',money(section16?.grossTotalIncome)],['Chapter VI-A Deduction',money(chapter?.totalChapterVIA)],['Total Taxable Income',money(chapter?.totalTaxableIncome)],['Tax on Total Income',money(lastFields?.taxOnTotalIncome)],['Net Tax Payable',money(lastFields?.netTaxPayable)]]});
    if (verification) { y=doc.lastAutoTable.finalY+12; autoTable(doc,{startY:y,theme:'grid',styles:{fontSize:7},body:[['Verification Place',verification.place||'—','Date',verification.date||'—'],['Designation',verification.designation||'—','Full Name',verification.fullName||'—'],['Signature',verification.signature||'—','','']]}); }
    doc.setFontSize(7); doc.setTextColor(120); doc.text('Generated from MyHourly HRMS • Professional Form 16 working copy', W/2, 815, {align:'center'});
    doc.save(`Form16_${base.employeeCode || base.employeeId}_${base.assessmentYear || ''}.pdf`);
  };

  const salaryFields = [
    ['salaryUnderSection17_1','Salary under section 17(1)'],['perquisitesUnderSection17_2','Perquisites under section 17(2)'],['profitsInLieuOfSalaryUnderSection17_3','Profits in lieu of salary under section 17(3)'],['grossSalary','Gross Salary'],['salaryReceivedFromOtherEmployers','Salary received from other employer(s)']
  ].map(([key,label])=>({key,label}));
  const exemptionFields = [['section10_5','Travel concession — 10(5)'],['section10_10','Gratuity — 10(10)'],['section10_10A','Commuted pension — 10(10A)'],['section10_10AA','Leave encashment — 10(10AA)'],['section10_13A','House rent allowance — 10(13A)'],['section10_10B','Other specified exemption — 10(10B)'],['otherSection10','Other exemption under section 10']].map(([key,label])=>({key,label}));
  const section16Fields = [['salaryReceivedFromOtherEmployers','Salary received from other employers'],['standardDeductionSection16I','Standard deduction — 16(ia)'],['entertainmentAllowanceSection16II','Entertainment allowance — 16(ii)'],['taxOnEmploymentSection16III','Tax on employment — 16(iii)'],['incomeLossHouseProperty','Income/loss from house property'],['incomeUnderOtherSources','Income under other sources']].map(([key,label])=>({key,label}));
  const chapterFields = [['section80C','Section 80C'],['section80CCC','Section 80CCC'],['section80CCD1','Section 80CCD(1)'],['section80CCD1B','Section 80CCD(1B)'],['section80CCD2','Section 80CCD(2)'],['section80D','Section 80D'],['section80CCH','Section 80CCH — employee'],['section80CCH2','Section 80CCH — Central Govt.'],['section80E','Section 80E'],['section80G','Section 80G'],['section80TTA','Section 80TTA'],['section80TTB','Section 80TTB'],['section80EEA','Section 80EEA'],['section80GG','Section 80GG'],['amountDeductibleUnderAnyOtherProvisionChapterVIA','Other Chapter VI-A provision'],['otherChapterVIA','Other Chapter VI-A']].map(([key,label])=>({key,label}));
  const lastFieldsDef = [['taxOnTotalIncome','Tax on total income'],['rebateUnderSection87A','Rebate under section 87A'],['surcharge','Surcharge'],['healthAndEducationCess','Health and education cess'],['reliefUnderSection89','Relief under section 89'],['taxDeductedAtSourceForm12BAA','TDS as per Form 12BAA'],['taxCollectedAtSourceForm12BAA','TCS as per Form 12BAA']].map(([key,label])=>({key,label}));

  return <div className="form16-page">
    <PageHeader eyebrow="Payroll & Tax" title="Form 16" description="Generate, edit, activate/deactivate and export Form 16 using the backend Form 16 endpoints." />
    {error && <div className="f16-alert error">{error}</div>}{notice && <div className="f16-alert success"><CheckCircle2 size={18}/>{notice}</div>}
    <section className="panel form16-toolbar">
      <Field label="Employee" value={employeeId}>{<select value={employeeId} onChange={(e)=>setEmployeeId(e.target.value)}><option value="">Select employee</option>{employees.map((e)=><option key={e.id} value={e.id}>{e.employeeCode ? `${e.employeeCode} — ` : ''}{e.employeeName || e.name}</option>)}</select>}</Field>
      <Field label="Assessment year" value={assessmentYear} onChange={setAssessmentYear} placeholder="2026-27" />
      <div className="form16-actions">
        <button className="btn btn-secondary" onClick={loadExisting} disabled={!canManage || loading}><RefreshCw size={16}/>{loading?'Loading...':'Load'}</button>
        <button className="btn btn-primary" onClick={generate} disabled={!canManage || saving}><FileText size={16}/>Generate Form 16</button>
        <button className="btn btn-secondary" onClick={exportPdf} disabled={!base}><Download size={16}/>Download PDF</button>
        <button className="btn btn-secondary" onClick={()=>toggleActive(true)} disabled={!base || base.active || saving}><Power size={16}/>Activate</button>
        <button className="btn btn-secondary" onClick={()=>toggleActive(false)} disabled={!base || !base.active || saving}><PowerOff size={16}/>Deactivate</button>
      </div>
    </section>

    {base && <section className="f16-panel"><div className="f16-panel-head"><div><b>{base.employeeName}</b> <span className={`f16-status ${base.active?'active':'inactive'}`}>{base.active?'ACTIVE':'INACTIVE'}</span></div><div className="f16-note">Certificate: {base.certificateNo || 'Generated by backend'} • AY {base.assessmentYear}</div></div><div className="f16-employee-card"><div><span>Employee Code</span><strong>{base.employeeCode||'—'}</strong></div><div><span>PAN</span><strong>{base.employeePan||'—'}</strong></div><div><span>Designation</span><strong>{base.designation||'—'}</strong></div></div></section>}

    <div className="f16-grid">
      <section className="f16-panel">
        <div className="f16-tabs">{[['overview','Overview'],['quarter','Part A — Quarter'],['challan','Challans'],['salary','Salary'],['exemption','Exemptions'],['section16','Section 16'],['chapter','Chapter VI-A'],['tax','Tax'],['verification','Verification']].map(([k,l])=><button key={k} className={`f16-tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>)}</div>
        {!base && tab!=='overview' ? <div className="f16-empty"><strong>Generate or load Form 16 first.</strong>The section endpoints require a Form 16 ID.</div> : null}
        {tab==='overview' && <div className="f16-form"><div className="f16-section-heading"><h4>Form 16 header</h4></div><div className="f16-form-grid"><Field label="Employee address" full value={baseDraft.employeeAddress} onChange={(v)=>setBaseDraft(s=>({...s,employeeAddress:v}))}/><Field label="Employment from" type="date" value={baseDraft.employmentFrom} onChange={(v)=>setBaseDraft(s=>({...s,employmentFrom:v}))}/><Field label="Employment to" type="date" value={baseDraft.employmentTo} onChange={(v)=>setBaseDraft(s=>({...s,employmentTo:v}))}/><label className="f16-toggle"><input type="checkbox" checked={!!baseDraft.optingOutOfTaxation115BAC1A} onChange={(e)=>setBaseDraft(s=>({...s,optingOutOfTaxation115BAC1A:e.target.checked}))}/>Opting out of taxation u/s 115BAC(1A)</label></div><hr className="f16-section-separator"/><div className="f16-note">The main Form 16 endpoint supports CREATE, GET, ACTIVATE, DEACTIVATE and DELETE. It does not expose a PUT/PATCH for the header, so header fields are entered before generation; editable tax sections below use their respective PUT endpoints.</div></div>}
        {base && tab==='quarter' && <SectionEditor title="Quarter-wise TDS summary" exists={!!quarter} value={quarterDraft} setValue={setQuarterDraft} saving={saving} onSave={()=>saveSection({existing:quarter,draft:quarterDraft,create:form16Service.createQuarter,update:form16Service.updateQuarter,setter:setQuarter,draftSetter:setQuarterDraft})}>{<><div style={{overflowX:'auto'}}><table className="f16-quarter-table"><thead><tr><th>Quarter</th><th>Amount paid/credited</th><th>Tax deducted</th><th>Tax deposited/remitted</th></tr></thead><tbody>{[1,2,3,4].map(q=><tr key={q}><td>Q{q}</td>{['AmountPaidCredited','TaxDeducted','TaxDepositedRemitted'].map(s=><td key={s}><input type="number" value={quarterDraft[`q${q}${s}`]??''} onChange={e=>setQuarterDraft(d=>({...d,[`q${q}${s}`]:e.target.value}))}/></td>)}</tr>)}</tbody></table></div><div className="f16-form-grid" style={{marginTop:14}}><Field label="Book adjustment tax deposited" type="number" value={quarterDraft.bookAdjustmentTaxDeposited} onChange={v=>setQuarterDraft(d=>({...d,bookAdjustmentTaxDeposited:v}))}/><Field label="Matching status with Form 24G" value={quarterDraft.statusOfMatchingWithForm24G} onChange={v=>setQuarterDraft(d=>({...d,statusOfMatchingWithForm24G:v}))}/></div><div className="f16-savebar"><button className="btn btn-primary" onClick={()=>saveSection({existing:quarter,draft:quarterDraft,create:form16Service.createQuarter,update:form16Service.updateQuarter,setter:setQuarter,draftSetter:setQuarterDraft})}><Save size={16}/>{quarter?'Save Changes':'Create Quarter Details'}</button></div></>}</SectionEditor>}
        {base && tab==='challan' && <div className="f16-form"><div className="f16-section-heading"><h4>Tax deposited through challan</h4></div><div className="f16-form-grid"><Field label="Tax deposited" type="number" value={challanDraft.taxDeposited} onChange={v=>setChallanDraft(s=>({...s,taxDeposited:v}))}/><Field label="BSR code" value={challanDraft.bsrCode} onChange={v=>setChallanDraft(s=>({...s,bsrCode:v}))}/><Field label="Deposit date" type="date" value={challanDraft.taxDepositedDate} onChange={v=>setChallanDraft(s=>({...s,taxDepositedDate:v}))}/><Field label="Challan serial number" value={challanDraft.challanSerialNumber} onChange={v=>setChallanDraft(s=>({...s,challanSerialNumber:v}))}/><Field label="OLTAS matching status" value={challanDraft.statusOfMatchingWithOltas}>{<select value={challanDraft.statusOfMatchingWithOltas} onChange={e=>setChallanDraft(s=>({...s,statusOfMatchingWithOltas:e.target.value}))}><option>F</option><option>U</option><option>P</option><option>O</option></select>}</Field></div><div className="f16-savebar"><button className="btn btn-primary" onClick={saveChallan}><Plus size={16}/>{editingChallan?'Update Challan':'Add Challan'}</button></div><div className="f16-challan-list">{challans.map(c=><div className="f16-challan-row" key={c.id}><b>{c.serialNumber}</b><div><b>₹{money(c.taxDeposited)}</b><div className="f16-note">{c.taxDepositedDate} • BSR {c.bsrCode||'—'} • OLTAS {c.statusOfMatchingWithOltas||'—'}</div></div><div><button className="f16-icon-btn" onClick={()=>{setEditingChallan(c);setChallanDraft({...emptyChallan,...c});}}><Edit3 size={15}/></button> <button className="f16-icon-btn" onClick={()=>deleteChallan(c.id)}><Trash2 size={15}/></button></div></div>)}</div></div>}
        {base && tab==='salary' && <SectionEditor title="Gross Salary — Part B" fields={salaryFields} value={salaryDraft} setValue={setSalaryDraft} exists={!!salary} saving={saving} onSave={()=>saveSection({existing:salary,draft:salaryDraft,create:form16Service.createSalary,update:form16Service.updateSalary,setter:setSalary,draftSetter:setSalaryDraft})}/>} 
        {base && tab==='exemption' && <SectionEditor title="Allowances exempt under Section 10" fields={exemptionFields} value={exemptionDraft} setValue={setExemptionDraft} exists={!!exemption} saving={saving} note="Totals are calculated by the backend and shown in the preview." onSave={()=>saveSection({existing:exemption,draft:exemptionDraft,create:form16Service.createExemption,update:form16Service.updateExemption,setter:setExemption,draftSetter:setExemptionDraft})}/>} 
        {base && tab==='section16' && <SectionEditor title="Deductions under Section 16 & Other Income" fields={section16Fields} value={section16Draft} setValue={setSection16Draft} exists={!!section16} saving={saving} onSave={()=>saveSection({existing:section16,draft:section16Draft,create:form16Service.createSection16,update:form16Service.updateSection16,setter:setSection16,draftSetter:setSection16Draft})}/>} 
        {base && tab==='chapter' && <SectionEditor title="Deductions under Chapter VI-A" fields={chapterFields} value={chapterDraft} setValue={setChapterDraft} exists={!!chapter} saving={saving} note="The backend calculates total Chapter VI-A deduction and taxable income." onSave={()=>saveSection({existing:chapter,draft:chapterDraft,create:form16Service.createChapterVIA,update:form16Service.updateChapterVIA,setter:setChapter,draftSetter:setChapterDraft})}/>} 
        {base && tab==='tax' && <SectionEditor title="Final tax computation" fields={lastFieldsDef} value={lastDraft} setValue={setLastDraft} exists={!!lastFields} saving={saving} note="Tax payable and net tax payable are calculated by backend endpoints." onSave={()=>saveSection({existing:lastFields,draft:lastDraft,create:form16Service.createLastFields,update:form16Service.updateLastFields,setter:setLastFields,draftSetter:setLastDraft})}/>} 
        {base && tab==='verification' && <SectionEditor title="Verification" value={verificationDraft} setValue={setVerificationDraft} exists={!!verification} saving={saving} onSave={()=>saveSection({existing:verification,draft:verificationDraft,create:form16Service.createVerification,update:form16Service.updateVerification,setter:setVerification,draftSetter:setVerificationDraft})}>{<><div className="f16-form-grid"><Field label="Place" value={verificationDraft.place} onChange={v=>setVerificationDraft(s=>({...s,place:v}))}/><Field label="Designation" value={verificationDraft.designation} onChange={v=>setVerificationDraft(s=>({...s,designation:v}))}/><Field label="Full name" value={verificationDraft.fullName} onChange={v=>setVerificationDraft(s=>({...s,fullName:v}))}/><Field label="Signature / signatory text" value={verificationDraft.signature} onChange={v=>setVerificationDraft(s=>({...s,signature:v}))}/></div><div className="f16-savebar"><button className="btn btn-primary" onClick={()=>saveSection({existing:verification,draft:verificationDraft,create:form16Service.createVerification,update:form16Service.updateVerification,setter:setVerification,draftSetter:setVerificationDraft})}><ShieldCheck size={16}/>{verification?'Save Verification':'Create Verification'}</button></div></>}</SectionEditor>}
      </section>
      <aside className="form16-preview-wrap"><section className="f16-panel"><div className="f16-panel-head"><h3>Form 16 Preview</h3>{base && <span className={`f16-status ${base.active?'active':'inactive'}`}>{base.active?'ACTIVE':'INACTIVE'}</span>}</div>{loading?<div className="f16-loader"><Loader2 className="spin"/> Loading Form 16...</div>:<FormPreview base={base} quarter={quarter} challans={challans} salary={salary} exemption={exemption} section16={section16} chapter={chapter} lastFields={lastFields} verification={verification}/>}</section></aside>
    </div>
  </div>;
}
