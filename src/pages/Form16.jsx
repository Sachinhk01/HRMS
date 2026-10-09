import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  Loader2,
  Maximize2,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Form16Hero from './Form16Hero';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { form16Service, getForm16EmployeeDropdown } from '../services/form16Service';
import './Form16.css';
import './Form16Polish.css';
import { INPUT_LIMITS } from '../utils/inputLimits';
import DatePicker from '../components/DatePicker';
import Form16Preview from './Form16Preview';
import { downloadForm16Pdf } from '../utils/form16Pdf';

// Backend occasionally serializes an entity's default Object.toString()
// (e.g. "com.my_hourly.master.entity.Designation@463364df") into a text
// field instead of its display name. Never show that raw form to users.
const JAVA_TOSTRING_PATTERN = /^[\w.$]+@[0-9a-fA-F]+$/;
const displayText = (v) => (v && typeof v === 'string' && JAVA_TOSTRING_PATTERN.test(v.trim()) ? '' : v);
const num = (v) => (v === '' || v == null ? 0 : Number(v));
const money = (v) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v));
// Sums a field (e.g. 'AmountPaidCredited') across Q1-Q4 of the quarter API response.
const quarterTotal = (quarter, suffix) => [1, 2, 3, 4].reduce((sum, q) => sum + num(quarter?.[`q${q}${suffix}`]), 0);
const today = () => new Date().toISOString().slice(0, 10);
const currentAssessmentYear = () => {
  const d = new Date();
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start + 1}-${String(start + 2).slice(-2)}`;
};
// Assessment-year dropdown values, newest first, e.g. "2027-28", "2026-27", ...
const ayLabel = (startYear) => `${startYear}-${String(startYear + 1).slice(-2)}`;
const buildAssessmentYears = (extra) => {
  const current = Number(currentAssessmentYear().slice(0, 4));
  const list = [];
  for (let y = current + 1; y >= current - 10; y -= 1) list.push(ayLabel(y));
  if (extra && !list.includes(extra)) list.push(extra);
  return list;
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
  bookAdjustmentTaxDeposited: '', dateOfTransferVoucher: today(), statusOfMatchingWithForm24G: '',
};
const emptySalary = { salaryUnderSection17_1: '', perquisitesUnderSection17_2: '', profitsInLieuOfSalaryUnderSection17_3: '', grossSalary: '', salaryReceivedFromOtherEmployers: '' };
const emptyExemption = { section10_5: '', section10_10: '', section10_10A: '', section10_10AA: '', section10_13A: '', section10_10B: '', otherSection10: '' };
const emptySection16 = { salaryReceivedFromOtherEmployers: '', standardDeductionSection16I: '', entertainmentAllowanceSection16II: '', taxOnEmploymentSection16III: '', incomeLossHouseProperty: '', incomeUnderOtherSources: '' };
const emptyChapter = { section80C: '', section80CCC: '', section80CCD1: '', section80CCD1B: '', section80CCD2: '', section80D: '', section80CCH: '', section80CCH2: '', section80E: '', amountDeductibleUnderAnyOtherProvisionChapterVIA: '', section80EEA: '', section80G: '', section80GG: '', section80TTA: '', section80TTB: '', otherChapterVIA: '' };
const emptyLast = { taxOnTotalIncome: '', rebateUnderSection87A: '', surcharge: '', healthAndEducationCess: '', reliefUnderSection89: '', taxDeductedAtSourceForm12BAA: '', taxCollectedAtSourceForm12BAA: '' };
// Part A quarter amounts: up to 10 digits before the decimal point (99,99,99,999.99) and 2 decimals
const QUARTER_AMOUNT_INT_DIGITS = 10;
const cleanQuarterAmount = (v) => cleanAmount(v, QUARTER_AMOUNT_INT_DIGITS);
const emptyVerification = { place: '', designation: '', fullName: '', signature: '' };
const emptyChallan = { taxDeposited: '', bsrCode: '', taxDepositedDate: today(), challanSerialNumber: '', statusOfMatchingWithOltas: 'F' };

// ---- Challan input rules (TRACES: BSR code = 7 digits, challan serial no. = up to 5 digits) ----
const cleanDigits = (v, max) => String(v ?? '').replace(/\D/g, '').slice(0, max);
const cleanAmount = (v, maxInt = 11) => {
  const [intPart = '', ...rest] = String(v ?? '').replace(/[^\d.]/g, '').split('.');
  const ip = intPart.slice(0, maxInt);
  return rest.length ? `${ip}.${rest.join('').slice(0, 2)}` : ip;
};
function validateChallan(d) {
  const e = {};
  const amt = String(d.taxDeposited ?? '').trim();
  if (!amt) e.taxDeposited = 'Tax deposited is required.';
  else if (!/^\d{1,11}(\.\d{1,2})?$/.test(amt) || Number(amt) <= 0) e.taxDeposited = 'Enter a valid amount greater than 0 (max 2 decimals).';
  const bsr = String(d.bsrCode ?? '').trim();
  if (!bsr) e.bsrCode = 'BSR code is required.';
  else if (!/^\d{7}$/.test(bsr)) e.bsrCode = 'BSR code must be exactly 7 digits.';
  if (!d.taxDepositedDate) e.taxDepositedDate = 'Deposit date is required.';
  const sn = String(d.challanSerialNumber ?? '').trim();
  if (!sn) e.challanSerialNumber = 'Challan serial number is required.';
  else if (!/^\d{1,5}$/.test(sn)) e.challanSerialNumber = 'Challan serial number must be 1 to 5 digits.';
  if (!d.statusOfMatchingWithOltas) e.statusOfMatchingWithOltas = 'OLTAS matching status is required.';
  return e;
}

function safePayload(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => {
    if (v === '') return [k, null];
    if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && !['bsrCode', 'challanSerialNumber'].includes(k)) return [k, Number(v)];
    return [k, v];
  }));
}

function Field({ label, value, onChange, type = 'text', full = false, readOnly = false, children, placeholder, maxLength, inputMode, error }) {
  return <label className={`f16-field ${full ? 'full' : ''}`}>
    <span>{label}</span>
    {children || (readOnly ? <div className="f16-readonly">{value || '—'}</div> : type === 'date' ? <DatePicker id={`f16-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} /> : <input maxLength={maxLength ?? INPUT_LIMITS.SHORT_TEXT} inputMode={inputMode} type={type} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} onWheel={type === 'number' ? (e) => e.currentTarget.blur() : undefined} placeholder={placeholder} />)}
    {error && <small style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{error}</small>}
  </label>;
}

function SectionEditor({ title, fields, value, setValue, onSave, saving, exists, note, children, readOnly = false }) {
  return <div className="f16-form">
    <div className="f16-section-heading"><div><h4>{title}</h4>{note && <div className="f16-note">{note}</div>}</div></div>
    {children || <div className="f16-form-grid">
      {fields.map((f) => <Field key={f.key} label={f.label} type={f.type || 'number'} value={value[f.key]} readOnly={readOnly} placeholder={(f.type || 'number') === 'number' ? undefined : `Enter ${String(f.label).toLowerCase()}`} onChange={(v) => setValue((s) => ({ ...s, [f.key]: v }))} />)}
    </div>}
    {!children && !readOnly && <div className="f16-savebar"><button className="btn btn-primary" type="button" onClick={onSave} disabled={saving}><Save size={16}/>{saving ? 'Saving...' : exists ? 'Save Changes' : 'Create Section'}</button></div>}
  </div>;
}

function FormPreview(props) {
  if (!props.base) return <div className="f16-empty"><FileText size={44}/><strong>No Form 16 loaded</strong>Select an employee and generate or load a Form 16.</div>;
  return <Form16Preview {...props} />;
}

export default function Form16() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const role = user?.role || user?.roles?.[0];
  const isHr = role === 'HR_ADMIN';
  const isManager = role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE';
  // Only HR can generate, edit, add, delete, activate or deactivate Form 16.
  // Managers are view + download only; Employees have no access to this page's data.
  const canManage = isHr;
  const canView = isHr || isManager;
  const period = useMemo(financialPeriod, []);
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeListError, setEmployeeListError] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [assessmentYear, setAssessmentYear] = useState(currentAssessmentYear());
  const ayOptions = useMemo(() => buildAssessmentYears(assessmentYear), [assessmentYear]);
  const [baseDraft, setBaseDraft] = useState({ employeeAddress: '', assessmentYear: currentAssessmentYear(), employmentFrom: period.from, employmentTo: period.to, optingOutOfTaxation115BAC1A: false });
  const [base, setBase] = useState(null);
  const [quarter, setQuarter] = useState(null); const [quarterDraft, setQuarterDraft] = useState(emptyQuarter);
  const [challans, setChallans] = useState([]); const [challanDraft, setChallanDraft] = useState(emptyChallan); const [challanErrors, setChallanErrors] = useState({}); const [editingChallan, setEditingChallan] = useState(null);
  const [salary, setSalary] = useState(null); const [salaryDraft, setSalaryDraft] = useState(emptySalary);
  const [exemption, setExemption] = useState(null); const [exemptionDraft, setExemptionDraft] = useState(emptyExemption);
  const [section16, setSection16] = useState(null); const [section16Draft, setSection16Draft] = useState(emptySection16);
  const [chapter, setChapter] = useState(null); const [chapterDraft, setChapterDraft] = useState(emptyChapter);
  const [lastFields, setLastFields] = useState(null); const [lastDraft, setLastDraft] = useState(emptyLast);
  const [verification, setVerification] = useState(null); const [verificationDraft, setVerificationDraft] = useState(emptyVerification);
  const [tab, setTab] = useState('overview'); const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false);
  // These were referenced (read AND written, e.g. setError('') / setNotice('')
  // inside loadExisting) without ever being declared as state — every call to
  // "Load" crashed with a ReferenceError on the very first line, before the
  // actual API call even ran, which is why Form 16 loaded but employee/
  // company details, quarters, salary etc. never showed up.
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Full-page (full-screen) preview of the Form 16 certificate
  const [showFull, setShowFull] = useState(false);

  // Close full-page preview with Esc and lock background scroll while it is open
  useEffect(() => {
    if (!showFull) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setShowFull(false); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showFull]);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    setEmployeesLoading(true);
    setEmployeeListError('');
    getForm16EmployeeDropdown()
      .then((items) => {
        if (cancelled) return;
        setEmployees(Array.isArray(items) ? items : []);
        if (!items?.length) setEmployeeListError('No Employees Were Returned By The Backend.');
      })
      .catch((err) => {
        if (cancelled) return;
        setEmployees([]);
        setEmployeeListError(err?.message || 'Unable To Load Employee List.');
      })
      .finally(() => { if (!cancelled) setEmployeesLoading(false); });
    return () => { cancelled = true; };
  }, [canView]);
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
      await loadChildren(d.id); setNotice('Form 16 Loaded Successfully.');
    } catch (e) { setBase(null); setError(e.status === 404 ? 'No Form 16 exists for this employee and assessment year. Use Generate Form 16.' : e.message); }
    finally { setLoading(false); }
  };

  const generate = async () => {
    if (!canManage) { showToast('Only HR can generate Form 16.', 'error'); return; }
    if (!employeeId) { showToast('Select an employee before generating Form 16.', 'error'); return; }
    setSaving(true);
    try { const d = await form16Service.create(employeeId, baseDraft); setBase(d); await loadChildren(d.id); showToast('Form 16 generated successfully. You can now edit Part A and Part B details.', 'success'); }
    catch (e) { showToast(e.message, 'error'); } finally { setSaving(false); }
  };

  const toggleActive = async (active) => {
    if (!canManage) { showToast('Only HR can activate or deactivate Form 16.', 'error'); return; }
    if (!employeeId || !base) return; setSaving(true);
    try { active ? await form16Service.activate(employeeId) : await form16Service.deactivate(employeeId); setBase((b) => ({ ...b, active })); showToast(`Form 16 ${active ? 'activated' : 'deactivated'} successfully.`, 'success'); }
    catch (e) { showToast(e.message, 'error'); } finally { setSaving(false); }
  };

  const saveSection = async ({ existing, draft, create, update, setter, draftSetter }) => {
    if (!canManage) { showToast('Only HR can edit Form 16.', 'error'); return; }
    if (!base?.id) { showToast('Generate or load Form 16 first.', 'error'); return; }
    setSaving(true);
    try { const result = existing ? await update(base.id, safePayload(draft)) : await create(base.id, safePayload(draft)); setter(result); draftSetter((s) => ({ ...s, ...result })); showToast('Form 16 section saved successfully.', 'success'); }
    catch (e) { showToast(e.message, 'error'); } finally { setSaving(false); }
  };

  const setChallanField = (key, val) => { setChallanDraft((s) => ({ ...s, [key]: val })); setChallanErrors((e) => ({ ...e, [key]: '' })); };
  const saveChallan = async () => {
    if (!canManage || !base?.id) return;
    const errs = validateChallan(challanDraft);
    setChallanErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fix the highlighted challan fields.', 'error'); return; }
    setSaving(true);
    try { editingChallan ? await form16Service.updateChallan(base.id, editingChallan.id, safePayload(challanDraft)) : await form16Service.createChallan(base.id, safePayload(challanDraft)); const d = await form16Service.getChallans(base.id); setChallans(d?.challans || []); setEditingChallan(null); setChallanDraft(emptyChallan); setChallanErrors({}); showToast('Challan saved successfully.', 'success'); }
    catch (e) { showToast(e.message, 'error'); } finally { setSaving(false); }
  };
  const deleteChallan = async (id) => { if (!canManage || !base?.id) return; try { await form16Service.deleteChallan(base.id, id); setChallans((s)=>s.filter((c)=>c.id!==id)); showToast('Challan deleted.', 'success'); } catch(e){showToast(e.message, 'error');} };

  // Once Part A quarter details are saved they are locked: fields become read-only and Save is disabled.
  const quarterLocked = !!quarter;
  const [downloading, setDownloading] = useState(false);
  // Builds the PDF from the full Form 16 preview (Part A + Part B + annexures) over as many pages as needed.
  const exportPdf = async () => {
    if (!base || downloading) return;
    setDownloading(true);
    try {
      await downloadForm16Pdf(
        { base, quarter, challans, salary, exemption, section16, chapter, lastFields, verification },
        `Form16_${base.employeeCode || base.employeeId}_${base.assessmentYear || ''}.pdf`,
      );
    } catch (e) {
      showToast(e?.message || 'Unable to generate the Form 16 PDF.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const salaryFields = [
    ['salaryUnderSection17_1','Salary under section 17(1)'],['perquisitesUnderSection17_2','Perquisites under section 17(2)'],['profitsInLieuOfSalaryUnderSection17_3','Profits in lieu of salary under section 17(3)'],['salaryReceivedFromOtherEmployers','Salary received from other employer(s)']
  ].map(([key,label])=>({key,label}));
  const exemptionFields = [['section10_5','Travel concession — 10(5)'],['section10_10','Gratuity — 10(10)'],['section10_10A','Commuted pension — 10(10A)'],['section10_10AA','Leave encashment — 10(10AA)'],['section10_13A','House rent allowance — 10(13A)'],['section10_10B','Other specified exemption — 10(10B)'],['otherSection10','Other exemption under section 10']].map(([key,label])=>({key,label}));
  const section16Fields = [['salaryReceivedFromOtherEmployers','Salary received from other employers'],['standardDeductionSection16I','Standard deduction — 16(ia)'],['entertainmentAllowanceSection16II','Entertainment allowance — 16(ii)'],['taxOnEmploymentSection16III','Tax on employment — 16(iii)'],['incomeLossHouseProperty','Income/loss from house property'],['incomeUnderOtherSources','Income under other sources']].map(([key,label])=>({key,label}));
  const chapterFields = [['section80C','Section 80C'],['section80CCC','Section 80CCC'],['section80CCD1','Section 80CCD(1)'],['section80CCD1B','Section 80CCD(1B)'],['section80CCD2','Section 80CCD(2)'],['section80D','Section 80D'],['section80CCH','Section 80CCH — employee'],['section80CCH2','Section 80CCH — Central Govt.'],['section80E','Section 80E'],['section80G','Section 80G'],['section80TTA','Section 80TTA'],['section80TTB','Section 80TTB'],['section80EEA','Section 80EEA'],['section80GG','Section 80GG'],['amountDeductibleUnderAnyOtherProvisionChapterVIA','Other Chapter VI-A provision'],['otherChapterVIA','Other Chapter VI-A']].map(([key,label])=>({key,label}));
  const lastFieldsDef = [['taxOnTotalIncome','Tax on total income'],['rebateUnderSection87A','Rebate under section 87A'],['surcharge','Surcharge'],['healthAndEducationCess','Health and education cess'],['reliefUnderSection89','Relief under section 89'],['taxDeductedAtSourceForm12BAA','TDS as per Form 12BAA'],['taxCollectedAtSourceForm12BAA','TCS as per Form 12BAA']].map(([key,label])=>({key,label}));

  return <div className="form16-page">
    <Form16Hero description={isManager ? 'View And Download Form 16. Only HR Can Generate Or Edit It.' : isHr ? 'HR Can Generate And Manage Form 16. Employees Can Only Download Their Own Form 16.' : 'View And Download Your Form 16.'} />
    {error && <div className="f16-alert error">{error}</div>}{notice && <div className="f16-alert success"><CheckCircle2 size={18}/>{notice}</div>}
    <section className="panel form16-toolbar">
      <Field label="Employee" value={employeeId}>{<select value={employeeId} onChange={(e)=>setEmployeeId(e.target.value)}><option value="">Select Employee</option>{employees.map((e)=><option key={e.id} value={e.id}>{e.employeeCode ? `${e.employeeCode} — ` : ''}{e.employeeName || e.name}</option>)}</select>}</Field>
      <Field label="Assessment Year" value={assessmentYear}>{<select value={assessmentYear} onChange={(e)=>setAssessmentYear(e.target.value)}>{ayOptions.map((ay)=><option key={ay} value={ay}>{ay}</option>)}</select>}</Field>
      <div className="form16-actions">
        <button className="btn btn-secondary" onClick={loadExisting} disabled={!canView || loading}><RefreshCw size={16}/>{loading?'Loading...':'Load'}</button>
        {canManage && <button className="btn btn-primary" onClick={generate} disabled={saving}><FileText size={16}/>Generate Form 16</button>}
        <button className="btn btn-secondary" onClick={exportPdf} disabled={!base || downloading}><Download size={16}/>{downloading ? 'Preparing PDF...' : 'Download PDF'}</button>
        {canManage && <button className="btn btn-secondary" onClick={()=>toggleActive(true)} disabled={!base || base.active || saving}><Power size={16}/>Activate</button>}
        {canManage && <button className="btn btn-secondary" onClick={()=>toggleActive(false)} disabled={!base || !base.active || saving}><PowerOff size={16}/>Deactivate</button>}
      </div>
    </section>

    {base && <section className="f16-panel"><div className="f16-panel-head"><div><b>{base.employeeName}</b> <span className={`f16-status ${base.active?'active':'inactive'}`}>{base.active?'ACTIVE':'INACTIVE'}</span></div><div className="f16-note">Certificate: {base.certificateNo || 'Generated by backend'} • AY {base.assessmentYear}</div></div><div className="f16-employee-card"><div><span>Employee Code</span><strong>{base.employeeCode||'—'}</strong></div><div><span>PAN</span><strong>{base.employeePan||'—'}</strong></div><div><span>Designation</span><strong>{displayText(base.designation)||'—'}</strong></div></div></section>}

    <div className="f16-grid">
      <section className="f16-panel">
        <div className="f16-tabs">{[['overview','Overview'],['quarter','Part A — Quarter'],['challan','Challans'],['salary','Salary'],['exemption','Exemptions'],['section16','Section 16'],['chapter','Chapter VI-A'],['tax','Tax'],['verification','Verification']].map(([k,l])=><button key={k} className={`f16-tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{tab===k && <motion.span layoutId="f16-tab-pill" className="f16-tab-pill" transition={{type:'spring',stiffness:420,damping:34}}/>}<span>{l}</span></button>)}</div>
        {!canManage && <div className="f16-note" style={{marginTop:8}}>You can view these sections. Only HR can edit, save, or add entries — use the preview panel on the right to view and download this Form 16.</div>}
        {!base && tab!=='overview' ? <div className="f16-empty"><strong>Generate or load Form 16 first.</strong>The section endpoints require a Form 16 ID.</div> : null}
        {tab==='overview' && <div className="f16-form"><div className="f16-section-heading"><h4>Form 16 Header</h4></div><div className="f16-form-grid"><Field label="Employee Address" full maxLength={250} placeholder="Enter employee address" readOnly={!canManage} value={baseDraft.employeeAddress} onChange={(v)=>setBaseDraft(s=>({...s,employeeAddress:v}))}/><Field label="Employment From" type="date" placeholder="Select employment start date" readOnly={!canManage} value={baseDraft.employmentFrom} onChange={(v)=>setBaseDraft(s=>({...s,employmentFrom:v}))}/><Field label="Employment To" type="date" placeholder="Select employment end date" readOnly={!canManage} value={baseDraft.employmentTo} onChange={(v)=>setBaseDraft(s=>({...s,employmentTo:v}))}/><label className="f16-toggle"><input type="checkbox" disabled={!canManage} checked={!!baseDraft.optingOutOfTaxation115BAC1A} onChange={(e)=>setBaseDraft(s=>({...s,optingOutOfTaxation115BAC1A:e.target.checked}))}/>Opting Out Of Taxation U/S 115BAC(1A)</label></div><hr className="f16-section-separator"/><div className="f16-note">The main Form 16 endpoint supports CREATE, GET, ACTIVATE, DEACTIVATE and DELETE. It does not expose a PUT/PATCH for the header, so header fields are entered before generation; editable tax sections below use their respective PUT endpoints.</div></div>}
        {base && tab==='quarter' && <SectionEditor title="Quarter-Wise TDS Summary" exists={!!quarter} value={quarterDraft} setValue={setQuarterDraft} saving={saving} readOnly={!canManage} onSave={()=>saveSection({existing:quarter,draft:quarterDraft,create:form16Service.createQuarter,update:form16Service.updateQuarter,setter:setQuarter,draftSetter:setQuarterDraft})}>{<><div style={{overflowX:'auto'}}><table className="f16-quarter-table"><thead><tr><th>Quarter</th><th>Amount Paid/Credited</th><th>Tax Deducted</th><th>Tax Deposited/Remitted</th></tr></thead><tbody>{[1,2,3,4].map(q=><tr key={q}><td>Q{q}</td>{['AmountPaidCredited','TaxDeducted','TaxDepositedRemitted'].map(s=><td key={s}>{canManage && !quarterLocked?<input type="text" inputMode="decimal" maxLength={QUARTER_AMOUNT_INT_DIGITS+3} placeholder="0.00" value={quarterDraft[`q${q}${s}`]??''} onChange={e=>setQuarterDraft(d=>({...d,[`q${q}${s}`]:cleanQuarterAmount(e.target.value)}))} onWheel={e=>e.currentTarget.blur()}/>:<div className="f16-readonly">{quarterDraft[`q${q}${s}`] ?? '—'}</div>}</td>)}</tr>)}<tr className="f16-quarter-total"><td><b>Total</b></td>{['AmountPaidCredited','TaxDeducted','TaxDepositedRemitted'].map(s=><td key={s}><div className="f16-readonly" style={{fontWeight:700}}>{[1,2,3,4].reduce((t,q)=>t+num(quarterDraft[`q${q}${s}`]),0).toFixed(2)}</div></td>)}</tr></tbody></table></div><div className="f16-form-grid" style={{marginTop:14}}><Field label="Book Adjustment Tax Deposited" inputMode="decimal" maxLength={QUARTER_AMOUNT_INT_DIGITS+3} placeholder="0.00" value={quarterDraft.bookAdjustmentTaxDeposited} readOnly={!canManage || quarterLocked} onChange={v=>setQuarterDraft(d=>({...d,bookAdjustmentTaxDeposited:cleanQuarterAmount(v)}))}/><Field label="Matching Status With Form 24G" maxLength={10} placeholder="Enter matching status" value={quarterDraft.statusOfMatchingWithForm24G} readOnly={!canManage || quarterLocked} onChange={v=>setQuarterDraft(d=>({...d,statusOfMatchingWithForm24G:v}))}/></div>{canManage && <div className="f16-savebar"><button className="btn btn-primary" disabled={quarterLocked || saving} onClick={()=>{ if (quarterLocked) return; saveSection({existing:quarter,draft:quarterDraft,create:form16Service.createQuarter,update:form16Service.updateQuarter,setter:setQuarter,draftSetter:setQuarterDraft}); }}><Save size={16}/>{quarterLocked?'Saved':saving?'Saving...':'Create Quarter Details'}</button></div>}</>}</SectionEditor>}
        {base && tab==='challan' && <div className="f16-form"><div className="f16-section-heading"><h4>Tax Deposited Through Challan</h4></div>{canManage && <><div className="f16-form-grid"><Field label="Tax Deposited *" inputMode="decimal" maxLength={14} error={challanErrors.taxDeposited} value={challanDraft.taxDeposited} onChange={v=>setChallanField('taxDeposited',cleanAmount(v))}/><Field label="BSR Code *" placeholder="Enter 7-digit BSR code" inputMode="numeric" maxLength={7} error={challanErrors.bsrCode} value={challanDraft.bsrCode} onChange={v=>setChallanField('bsrCode',cleanDigits(v,7))}/><Field label="Deposit Date *" type="date" placeholder="Select deposit date" error={challanErrors.taxDepositedDate} value={challanDraft.taxDepositedDate} onChange={v=>setChallanField('taxDepositedDate',v)}/><Field label="Challan Serial Number *" placeholder="Enter challan serial number" inputMode="numeric" maxLength={5} error={challanErrors.challanSerialNumber} value={challanDraft.challanSerialNumber} onChange={v=>setChallanField('challanSerialNumber',cleanDigits(v,5))}/><Field label="OLTAS Matching Status" value={challanDraft.statusOfMatchingWithOltas}>{<select value={challanDraft.statusOfMatchingWithOltas} onChange={e=>setChallanDraft(s=>({...s,statusOfMatchingWithOltas:e.target.value}))}><option>F</option><option>U</option><option>P</option><option>O</option></select>}</Field></div><div className="f16-savebar"><button className="btn btn-primary" onClick={saveChallan}><Plus size={16}/>{editingChallan?'Update Challan':'Add Challan'}</button></div></>}<div className="f16-challan-list">{challans.map(c=><div className="f16-challan-row" key={c.id}><b>{c.serialNumber}</b><div><b>₹{money(c.taxDeposited)}</b><div className="f16-note">{c.taxDepositedDate} • BSR {c.bsrCode||'—'} • OLTAS {c.statusOfMatchingWithOltas||'—'}</div></div>{canManage && <div><button className="f16-icon-btn" onClick={()=>{setEditingChallan(c);setChallanDraft({...emptyChallan,...c});setChallanErrors({});}}><Edit3 size={15}/></button> <button className="f16-icon-btn" onClick={()=>deleteChallan(c.id)}><Trash2 size={15}/></button></div>}</div>)}</div></div>}
        {base && tab==='salary' && <SectionEditor title="Gross Salary — Part B" fields={salaryFields} value={salaryDraft} setValue={setSalaryDraft} exists={!!salary} saving={saving} readOnly={!canManage} onSave={()=>saveSection({existing:salary,draft:salaryDraft,create:form16Service.createSalary,update:form16Service.updateSalary,setter:setSalary,draftSetter:setSalaryDraft})}/>} 
        {base && tab==='exemption' && <SectionEditor title="Allowances exempt under Section 10" fields={exemptionFields} value={exemptionDraft} setValue={setExemptionDraft} exists={!!exemption} saving={saving} note="Totals are calculated by the backend and shown in the preview." readOnly={!canManage} onSave={()=>saveSection({existing:exemption,draft:exemptionDraft,create:form16Service.createExemption,update:form16Service.updateExemption,setter:setExemption,draftSetter:setExemptionDraft})}/>} 
        {base && tab==='section16' && <SectionEditor title="Deductions under Section 16 & Other Income" fields={section16Fields} value={section16Draft} setValue={setSection16Draft} exists={!!section16} saving={saving} readOnly={!canManage} onSave={()=>saveSection({existing:section16,draft:section16Draft,create:form16Service.createSection16,update:form16Service.updateSection16,setter:setSection16,draftSetter:setSection16Draft})}/>} 
        {base && tab==='chapter' && <SectionEditor title="Deductions under Chapter VI-A" fields={chapterFields} value={chapterDraft} setValue={setChapterDraft} exists={!!chapter} saving={saving} note="The backend calculates total Chapter VI-A deduction and taxable income." readOnly={!canManage} onSave={()=>saveSection({existing:chapter,draft:chapterDraft,create:form16Service.createChapterVIA,update:form16Service.updateChapterVIA,setter:setChapter,draftSetter:setChapterDraft})}/>} 
        {base && tab==='tax' && <SectionEditor title="Final tax computation" fields={lastFieldsDef} value={lastDraft} setValue={setLastDraft} exists={!!lastFields} saving={saving} note="Tax payable and net tax payable are calculated by backend endpoints." readOnly={!canManage} onSave={()=>saveSection({existing:lastFields,draft:lastDraft,create:form16Service.createLastFields,update:form16Service.updateLastFields,setter:setLastFields,draftSetter:setLastDraft})}/>} 
        {base && tab==='verification' && <SectionEditor title="Verification" value={verificationDraft} setValue={setVerificationDraft} exists={!!verification} saving={saving} readOnly={!canManage} onSave={()=>saveSection({existing:verification,draft:verificationDraft,create:form16Service.createVerification,update:form16Service.updateVerification,setter:setVerification,draftSetter:setVerificationDraft})}>{<><div className="f16-form-grid"><Field label="Place" maxLength={50} placeholder="Enter place" value={verificationDraft.place} readOnly={!canManage} onChange={v=>setVerificationDraft(s=>({...s,place:v}))}/><Field label="Designation" maxLength={50} placeholder="Enter designation" value={verificationDraft.designation} readOnly={!canManage} onChange={v=>setVerificationDraft(s=>({...s,designation:v}))}/><Field label="Full name" maxLength={INPUT_LIMITS.NAME} placeholder="Enter full name" value={verificationDraft.fullName} readOnly={!canManage} onChange={v=>setVerificationDraft(s=>({...s,fullName:v}))}/><Field label="Signature / signatory text" maxLength={INPUT_LIMITS.SHORT_TEXT} placeholder="Enter signature / signatory name" value={verificationDraft.signature} readOnly={!canManage} onChange={v=>setVerificationDraft(s=>({...s,signature:v}))}/></div>{canManage && <div className="f16-savebar"><button className="btn btn-primary" onClick={()=>saveSection({existing:verification,draft:verificationDraft,create:form16Service.createVerification,update:form16Service.updateVerification,setter:setVerification,draftSetter:setVerificationDraft})}><ShieldCheck size={16}/>{verification?'Save Verification':'Create Verification'}</button></div>}</>}</SectionEditor>}
      </section>
      <aside className="form16-preview-wrap"><section className="f16-panel"><div className="f16-panel-head"><h3>Form 16 Preview</h3><div className="f16-panel-head-actions">{base && <span className={`f16-status ${base.active?'active':'inactive'}`}>{base.active?'ACTIVE':'INACTIVE'}</span>}<button type="button" className="f16-viewfull-btn" onClick={()=>setShowFull(true)} disabled={!base} title="View full page"><Maximize2 size={14}/>View Full Page</button></div></div>{loading?<div className="f16-loader"><Loader2 className="spin"/> Loading Form 16...</div>:<FormPreview base={base} quarter={quarter} challans={challans} salary={salary} exemption={exemption} section16={section16} chapter={chapter} lastFields={lastFields} verification={verification}/>}</section></aside>
    </div>

    {showFull && createPortal(
      <div className="f16-fullview" role="dialog" aria-modal="true" aria-label="Form 16 full page preview" onClick={()=>setShowFull(false)}>
        <div className="f16-fullview-card" onClick={(e)=>e.stopPropagation()}>
          <div className="f16-fullview-head">
            <div className="f16-fullview-title">
              <h3>Form 16 Preview</h3>
              {base && <span className={`f16-status ${base.active?'active':'inactive'}`}>{base.active?'ACTIVE':'INACTIVE'}</span>}
            </div>
            <div className="f16-fullview-actions">
              <button className="btn btn-secondary" onClick={exportPdf} disabled={!base || downloading}><Download size={16}/>{downloading ? 'Preparing PDF...' : 'Download PDF'}</button>
              <button className="f16-fullview-close" onClick={()=>setShowFull(false)} aria-label="Close preview"><X size={18}/></button>
            </div>
          </div>
          <div className="f16-fullview-body">
            {loading
              ? <div className="f16-loader"><Loader2 className="spin"/> Loading Form 16...</div>
              : <FormPreview base={base} quarter={quarter} challans={challans} salary={salary} exemption={exemption} section16={section16} chapter={chapter} lastFields={lastFields} verification={verification}/>}
          </div>
        </div>
      </div>,
      document.body
    )}
  </div>;
}