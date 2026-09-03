import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileText,
  Landmark,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getEmployeeDropdown, getMyProfile } from '../services/employeeService';
import * as payroll from '../services/payrollService';
import './Payroll.css';

const PAYROLL_STATUS_VALUES = ['DRAFT', 'GENERATED', 'APPROVED', 'PAID', 'CANCELLED'];
const EMPLOYMENT_TYPE_VALUES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];
const PAYMENT_MODE_VALUES = ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI'];

const SALARY_FIELDS = [
  ['basicSalary', 'Basic Salary'],
  ['hra', 'HRA'],
  ['specialAllowance', 'Special Allowance'],
  ['medicalAllowance', 'Medical Allowance'],
  ['travelAllowance', 'Travel Allowance'],
  ['bonus', 'Bonus'],
  ['otherAllowance', 'Other Allowance'],
  ['pf', 'PF'],
  ['esi', 'ESI'],
  ['professionalTax', 'Professional Tax'],
  ['incomeTax', 'Income Tax'],
  ['otherDeduction', 'Other Deduction'],
];

const emptyPayment = {
  employeeId: '',
  panNumber: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  paymentMode: 'BANK_TRANSFER',
  uanNumber: '',
  pfNumber: '',
  esiNumber: '',
};

const emptyTemplate = {
  employeeType: 'FULL_TIME',
  basicSalary: '',
  hra: '',
  specialAllowance: '',
  medicalAllowance: '',
  travelAllowance: '',
  bonus: '',
  otherAllowance: '',
  pf: '',
  esi: '',
  professionalTax: '',
  incomeTax: '',
  otherDeduction: '',
};

const emptyStructure = {
  employeeId: '',
  salaryTemplateId: '',
  effectiveFrom: '',
  effectiveTo: '',
  remarks: '',
};

const emptyGenerate = {
  payrollMonth: '',
  remarks: '',
  saveAsDraft: false,
};

function titleEnum(value = '') {
  return String(value)
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function money(value) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function employeeLabel(employee) {
  return (
    employee?.employeeName ||
    employee?.name ||
    [employee?.firstName, employee?.lastName].filter(Boolean).join(' ') ||
    employee?.employeeCode ||
    `Employee ${employee?.id ?? ''}`
  );
}

function normalizeNumberFields(source, fields) {
  const next = { ...source };
  fields.forEach(([key]) => {
    next[key] = next[key] === '' || next[key] == null ? 0 : Number(next[key]);
  });
  return next;
}


function extractError(error, fallback) {
  return error?.message || fallback;
}

const PAYMENT_PATTERNS = {
  panNumber: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  accountNumber: /^[0-9]{9,18}$/,
  ifscCode: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  uanNumber: /^[0-9]{12}$/,
  pfNumber: /^[A-Z0-9]{18}$/,
  esiNumber: /^[0-9]{17}$/,
};

function validatePaymentDetails(form) {
  const errors = {};
  if (!form.employeeId) errors.employeeId = 'Please Select An Employee.';
  if (!String(form.panNumber || '').trim()) errors.panNumber = 'PAN Number Is Required.';
  else if (!PAYMENT_PATTERNS.panNumber.test(String(form.panNumber).trim().toUpperCase())) errors.panNumber = 'Enter A Valid PAN Number, For Example ABCDE1234F.';
  if (!String(form.bankName || '').trim()) errors.bankName = 'Bank Name Is Required.';
  if (!String(form.accountNumber || '').trim()) errors.accountNumber = 'Account Number Is Required.';
  else if (!PAYMENT_PATTERNS.accountNumber.test(String(form.accountNumber).trim())) errors.accountNumber = 'Account Number Must Contain 9 To 18 Digits.';
  if (!String(form.ifscCode || '').trim()) errors.ifscCode = 'IFSC Code Is Required.';
  else if (!PAYMENT_PATTERNS.ifscCode.test(String(form.ifscCode).trim().toUpperCase())) errors.ifscCode = 'Enter A Valid IFSC Code, For Example SBIN0001234.';
  if (!String(form.paymentMode || '').trim()) errors.paymentMode = 'Payment Mode Is Required.';
  if (!String(form.uanNumber || '').trim()) errors.uanNumber = 'UAN Number Is Required.';
  else if (!PAYMENT_PATTERNS.uanNumber.test(String(form.uanNumber).trim())) errors.uanNumber = 'UAN Number Must Contain Exactly 12 Digits.';
  if (!String(form.pfNumber || '').trim()) errors.pfNumber = 'PF Number Is Required.';
  else if (!PAYMENT_PATTERNS.pfNumber.test(String(form.pfNumber).trim().toUpperCase())) errors.pfNumber = 'PF Number Must Contain Exactly 18 Letters Or Digits.';
  if (!String(form.esiNumber || '').trim()) errors.esiNumber = 'ESI Number Is Required.';
  else if (!PAYMENT_PATTERNS.esiNumber.test(String(form.esiNumber).trim())) errors.esiNumber = 'ESI Number Must Contain Exactly 17 Digits.';
  return errors;
}

function validateSalaryTemplate(form) {
  const errors = {};
  if (!form.employeeType) errors.employeeType = 'Employment Type Is Required.';
  SALARY_FIELDS.forEach(([key, label]) => {
    const raw = form[key];
    if (raw === '' || raw == null) errors[key] = `${label} Is Required.`;
    else if (!Number.isFinite(Number(raw)) || Number(raw) < 0) errors[key] = `${label} Must Be A Valid Non-Negative Amount.`;
  });
  if (!errors.basicSalary && Number(form.basicSalary) <= 0) errors.basicSalary = 'Basic Salary Must Be Greater Than Zero.';
  return errors;
}

function validateSalaryStructure(form) {
  const errors = {};
  if (!form.employeeId) errors.employeeId = 'Employee Is Required.';
  if (!form.salaryTemplateId) errors.salaryTemplateId = 'Salary Template Is Required.';
  if (!form.effectiveFrom) errors.effectiveFrom = 'Effective From Date Is Required.';
  if (form.effectiveFrom && form.effectiveTo && form.effectiveTo < form.effectiveFrom) errors.effectiveTo = 'Effective To Date Cannot Be Earlier Than Effective From Date.';
  return errors;
}

function validatePayrollGeneration(form) {
  const errors = {};
  if (!form.payrollMonth) errors.payrollMonth = 'Payroll Month Is Required.';
  return errors;
}

function firstErrorMessage(errors) {
  return Object.values(errors)[0] || 'Please Correct The Highlighted Fields.';
}

export default function Payroll() {
  const { user } = useAuth();
  const role = user?.role || user?.roles?.[0];
  const isHr = role === 'HR_ADMIN';
  const isEmployee = role === 'EMPLOYEE';

  const [activeStep, setActiveStep] = useState('payment');
  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [structures, setStructures] = useState([]);
  const [payrollRows, setPayrollRows] = useState([]);
  const [myPayrolls, setMyPayrolls] = useState([]);
  const [myEmployeeId, setMyEmployeeId] = useState(null);

  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [paymentExists, setPaymentExists] = useState(false);
  const [templateForm, setTemplateForm] = useState(emptyTemplate);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [structureForm, setStructureForm] = useState(emptyStructure);
  const [revisionMode, setRevisionMode] = useState(false);
  const [generateForm, setGenerateForm] = useState(emptyGenerate);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [paymentErrors, setPaymentErrors] = useState({});
  const [templateErrors, setTemplateErrors] = useState({});
  const [structureErrors, setStructureErrors] = useState({});
  const [generateErrors, setGenerateErrors] = useState({});

  const steps = useMemo(
    () => [
      { id: 'payment', number: '17', label: 'Employee Payment Details', icon: Landmark },
      { id: 'template', number: '18', label: 'Salary Template', icon: FileText },
      { id: 'structure', number: '19', label: 'Salary Structure', icon: Building2 },
      { id: 'payroll', number: '20', label: 'Payroll', icon: WalletCards },
    ],
    [],
  );

  const visibleSteps = isHr ? steps : [steps[3]];

  const run = async (work, successMessage) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await work();
      if (successMessage) setNotice({ type: 'success', message: successMessage });
      return result;
    } catch (error) {
      setNotice({ type: 'error', message: extractError(error, 'Something Went Wrong.') });
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const loadHrReferenceData = async () => {
    if (!isHr) return;
    const [employeeResult, templateResult, structureResult] = await Promise.allSettled([
      getEmployeeDropdown(),
      payroll.getSalaryTemplates(false),
      payroll.getSalaryStructures(false),
    ]);

    if (employeeResult.status === 'fulfilled') {
      setEmployees(Array.isArray(employeeResult.value) ? employeeResult.value : []);
    }
    if (templateResult.status === 'fulfilled') {
      setTemplates(Array.isArray(templateResult.value) ? templateResult.value : []);
    }
    if (structureResult.status === 'fulfilled') {
      setStructures(Array.isArray(structureResult.value) ? structureResult.value : []);
    }
  };

  const loadEmployeePayslips = async () => {
    if (!isEmployee) return;
    setBusy(true);
    setNotice(null);
    try {
      const profile = await getMyProfile();
      const candidateIds = [
        user?.employeeId,
        user?.employee?.id,
        profile?.employeeId,
        profile?.employee?.id,
        profile?.id,
      ].filter((value, index, values) => value != null && value !== '' && values.indexOf(value) === index);

      if (!candidateIds.length) {
        setMyEmployeeId(null);
        setMyPayrolls([]);
        setNotice({ type: 'error', message: 'Employee Profile Could Not Be Resolved.' });
        return;
      }

      let resolvedId = candidateIds[0];
      let history = [];
      let lastError = null;
      for (const candidateId of candidateIds) {
        try {
          const rows = await payroll.getEmployeePayrollHistory(candidateId);
          resolvedId = candidateId;
          if (Array.isArray(rows) && rows.length) {
            history = rows;
            break;
          }
          if (!history.length) history = Array.isArray(rows) ? rows : [];
        } catch (error) {
          lastError = error;
        }
      }

      setMyEmployeeId(resolvedId || null);
      setMyPayrolls([...history].sort((a, b) => new Date(b.createdAt || b.updatedAt || b.payrollMonth || 0) - new Date(a.createdAt || a.updatedAt || a.payrollMonth || 0)));
      if (!history.length && lastError) {
        setNotice({ type: 'error', message: extractError(lastError, 'Unable To Load Payslips.') });
      }
    } catch (error) {
      setMyPayrolls([]);
      setNotice({ type: 'error', message: extractError(error, 'Unable To Load Payslips.') });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (isHr) {
      setActiveStep('payment');
      loadHrReferenceData();
    } else if (isEmployee) {
      setActiveStep('payroll');
      loadEmployeePayslips();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);


  useEffect(() => {
    if (!isEmployee) return undefined;
    const timer = window.setInterval(() => {
      loadEmployeePayslips();
    }, 60000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmployee]);

  const selectPaymentEmployee = async (employeeId) => {
    setPaymentForm({ ...emptyPayment, employeeId });
    setPaymentExists(false);
    if (!employeeId) return;

    try {
      const details = await payroll.getEmployeePaymentDetails(employeeId);
      if (details) {
        setPaymentExists(true);
        setPaymentForm({
          employeeId,
          panNumber: details.panNumber || '',
          bankName: details.bankName || '',
          accountNumber: details.accountNumber || '',
          ifscCode: details.ifscCode || '',
          paymentMode: details.paymentMode || 'BANK_TRANSFER',
          uanNumber: details.uanNumber || '',
          pfNumber: details.pfNumber || '',
          esiNumber: details.esiNumber || '',
        });
      }
    } catch (error) {
      if (error?.status !== 404) {
        setNotice({ type: 'error', message: extractError(error, 'Unable To Load Payment Details.') });
      }
    }
  };

  const savePaymentDetails = async (event) => {
    event.preventDefault();
    const errors = validatePaymentDetails(paymentForm);
    setPaymentErrors(errors);
    if (Object.keys(errors).length) {
      setNotice({ type: 'error', message: firstErrorMessage(errors) });
      return;
    }

    const payload = {
      ...paymentForm,
      panNumber: paymentForm.panNumber.trim().toUpperCase(),
      bankName: paymentForm.bankName.trim(),
      accountNumber: paymentForm.accountNumber.trim(),
      ifscCode: paymentForm.ifscCode.trim().toUpperCase(),
      uanNumber: paymentForm.uanNumber.trim(),
      pfNumber: paymentForm.pfNumber.trim().toUpperCase(),
      esiNumber: paymentForm.esiNumber.trim(),
    };
    const employeeId = payload.employeeId;
    delete payload.employeeId;

    try {
      if (paymentExists) {
        await run(
          () => payroll.updateEmployeePaymentDetails(employeeId, payload),
          'Employee Payment Details Updated Successfully.',
        );
      } else {
        await run(
          () => payroll.createEmployeePaymentDetails({ ...payload, employeeId: Number(employeeId) }),
          'Employee Payment Details Created Successfully.',
        );
        setPaymentExists(true);
      }
    } catch {
      // Notice Is Already Set By run().
    }
  };

  const editTemplate = (template) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      employeeType: template.employeeType || 'FULL_TIME',
      ...Object.fromEntries(SALARY_FIELDS.map(([key]) => [key, template[key] ?? ''])),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveTemplate = async (event) => {
    event.preventDefault();
    const errors = validateSalaryTemplate(templateForm);
    setTemplateErrors(errors);
    if (Object.keys(errors).length) {
      setNotice({ type: 'error', message: firstErrorMessage(errors) });
      return;
    }
    const payload = normalizeNumberFields(templateForm, SALARY_FIELDS);
    try {
      if (editingTemplateId) {
        const updatePayload = { ...payload };
        delete updatePayload.employeeType;
        await run(
          () => payroll.updateSalaryTemplate(editingTemplateId, updatePayload),
          'Salary Template Updated Successfully.',
        );
      } else {
        await run(() => payroll.createSalaryTemplate(payload), 'Salary Template Created Successfully.');
      }
      setTemplateForm(emptyTemplate);
      setEditingTemplateId(null);
      setTemplates(await payroll.getSalaryTemplates(false));
    } catch {
      // Notice Is Already Set By run().
    }
  };

  const toggleTemplateStatus = async (template) => {
    try {
      await run(
        () => payroll.updateSalaryTemplateStatus(template.id, !template.active),
        `Salary Template ${template.active ? 'Deactivated' : 'Activated'} Successfully.`,
      );
      setTemplates(await payroll.getSalaryTemplates(false));
    } catch {
      // Notice Is Already Set By run().
    }
  };

  const saveStructure = async (event) => {
    event.preventDefault();
    const errors = validateSalaryStructure(structureForm);
    setStructureErrors(errors);
    if (Object.keys(errors).length) {
      setNotice({ type: 'error', message: firstErrorMessage(errors) });
      return;
    }
    const payload = {
      employeeId: Number(structureForm.employeeId),
      salaryTemplateId: Number(structureForm.salaryTemplateId),
      effectiveFrom: structureForm.effectiveFrom,
      effectiveTo: structureForm.effectiveTo || null,
      remarks: structureForm.remarks || '',
    };

    try {
      if (revisionMode) {
        await run(() => payroll.createSalaryRevision(payload), 'Salary Revision Created Successfully.');
      } else {
        await run(() => payroll.createSalaryStructure(payload), 'Salary Structure Assigned Successfully.');
      }
      setStructureForm(emptyStructure);
      setRevisionMode(false);
      setStructures(await payroll.getSalaryStructures(false));
    } catch {
      // Notice Is Already Set By run().
    }
  };

  const generatePayroll = async (event) => {
    event.preventDefault();
    const errors = validatePayrollGeneration(generateForm);
    setGenerateErrors(errors);
    if (Object.keys(errors).length) {
      setNotice({ type: 'error', message: firstErrorMessage(errors) });
      return;
    }
    const payload = {
      payrollMonth: generateForm.payrollMonth,
      employeeIds: selectedEmployees.map(Number),
      remarks: generateForm.remarks || '',
      saveAsDraft: Boolean(generateForm.saveAsDraft),
    };

    try {
      const summary = await run(() => payroll.generatePayroll(payload), 'Payroll Generated Successfully.');
      setGenerateForm(emptyGenerate);
      setSelectedEmployees([]);
      if (summary?.payrollMonth) {
        setFilterMonth(summary.payrollMonth);
        setPayrollRows(await payroll.getPayrollsByMonth(summary.payrollMonth));
      }
    } catch {
      // Notice Is Already Set By run().
    }
  };

  const loadPayrollByMonth = async () => {
    if (!filterMonth) {
      setNotice({ type: 'error', message: 'Please Select A Payroll Month.' });
      return;
    }
    try {
      const rows = await run(() => payroll.getPayrollsByMonth(filterMonth));
      setPayrollRows(rows || []);
    } catch {
      // Notice Is Already Set By run().
    }
  };

  const loadPayrollByStatus = async () => {
    if (!filterStatus) {
      setNotice({ type: 'error', message: 'Please Select A Payroll Status.' });
      return;
    }
    try {
      const rows = await run(() => payroll.getPayrollsByStatus(filterStatus));
      setPayrollRows(rows || []);
    } catch {
      // Notice Is Already Set By run().
    }
  };

  const updateStatus = async (row, status) => {
    let paymentReference = '';
    if (status === 'PAID') {
      paymentReference = window.prompt('Enter Payment Reference') || '';
      if (!paymentReference.trim()) return;
    }
    try {
      await run(
        () => payroll.updatePayrollStatus(row.id, { status, paymentReference }),
        `Payroll Marked As ${titleEnum(status)} Successfully.`,
      );
      if (filterMonth) setPayrollRows(await payroll.getPayrollsByMonth(filterMonth));
      else if (filterStatus) setPayrollRows(await payroll.getPayrollsByStatus(filterStatus));
    } catch {
      // Notice Is Already Set By run().
    }
  };

  const regenerate = async (row) => {
    try {
      await run(() => payroll.regeneratePayroll(row.id), 'Payroll Regenerated Successfully.');
      if (filterMonth) setPayrollRows(await payroll.getPayrollsByMonth(filterMonth));
      else if (filterStatus) setPayrollRows(await payroll.getPayrollsByStatus(filterStatus));
    } catch {
      // Notice Is Already Set By run().
    }
  };

  if (!isHr && !isEmployee) {
    return (
      <div className="payroll-page page-reveal">
        <section className="payroll-empty-access">
          <ShieldCheck size={42} />
          <h1>Payroll Access Restricted</h1>
          <p>Payroll Management Is Available To HR. Employees Can Download Their Own Payslips.</p>
        </section>
      </div>
    );
  }

  if (isEmployee) {
    return (
      <div className="payroll-page page-reveal">
        <section className="payroll-employee-hero">
          <div>
            <span className="payroll-kicker">Payroll</span>
            <h1>My Payslips</h1>
            <p>Download Your Generated Payslips Securely From One Place.</p>
          </div>
          <div className="payroll-hero-icon"><WalletCards size={34} /></div>
        </section>

        {notice && <div className={`payroll-alert ${notice.type}`}>{notice.message}</div>}

        <section className="payroll-card payroll-payslip-card">
          <div className="payroll-section-heading">
            <div>
              <span className="payroll-section-number">20</span>
              <div>
                <h2>Payroll</h2>
                <p>Generated Payslips Available For Download.</p>
              </div>
            </div>
            <button className="payroll-icon-button" type="button" onClick={loadEmployeePayslips} disabled={busy}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="employee-payslip-grid">
            {myPayrolls.length ? myPayrolls.map((item) => (
              <article className="employee-payslip-item" key={item.id}>
                <div className="employee-payslip-icon"><FileText size={22} /></div>
                <div className="employee-payslip-content">
                  <span>{item.payrollNumber || 'Payroll Payslip'}</span>
                  <strong>{item.payrollMonth || 'Payroll Month'}</strong>
                  <small>{titleEnum(item.status || 'GENERATED')}</small>
                </div>
                <button
                  type="button"
                  className="btn btn-primary employee-download-button"
                  onClick={() => payroll.downloadPayslip(item.id, item.payrollNumber || 'payslip')}
                >
                  <Download size={15} />
                  Download Payslip
                </button>
              </article>
            )) : (
              <div className="payroll-empty-state">
                <FileText size={34} />
                <h3>No Payslips Available</h3>
                <p>Your Payslip Will Appear Here After HR Generates Payroll.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="payroll-page page-reveal">
      <section className="payroll-hero">
        <div className="payroll-hero-copy">
          <span className="payroll-kicker">Payroll Workspace</span>
          <h1>Payroll Management</h1>
          <p>Manage Payment Details, Salary Templates, Salary Structures And Monthly Payroll In The Backend Swagger Order.</p>
          <div className="payroll-hero-chips">
            <span><ShieldCheck size={14} /> HR Controlled</span>
            <span><Sparkles size={14} /> MyHourly Payroll</span>
          </div>
        </div>
        <div className="payroll-hero-visual">
          <div className="payroll-orbit payroll-orbit-one" />
          <div className="payroll-orbit payroll-orbit-two" />
          <CircleDollarSign size={54} />
        </div>
      </section>

      <section className="payroll-progress-card">
        {visibleSteps.map((step, index) => {
          const Icon = step.icon;
          const active = activeStep === step.id;
          return (
            <button
              className={`payroll-progress-step ${active ? 'active' : ''}`}
              type="button"
              key={step.id}
              onClick={() => setActiveStep(step.id)}
            >
              <span className="payroll-progress-number">{step.number}</span>
              <span className="payroll-progress-icon"><Icon size={18} /></span>
              <span className="payroll-progress-text">{step.label}</span>
              {index < visibleSteps.length - 1 && <ChevronRight className="payroll-progress-arrow" size={16} />}
            </button>
          );
        })}
      </section>

      {notice && <div className={`payroll-alert ${notice.type}`}>{notice.message}</div>}

      {activeStep === 'payment' && (
        <>
          <PayrollSectionHeading  title="Employee Payment Details" subtitle="Manage Employee Bank, PAN, UAN, PF And ESI Details." icon={Landmark} />
          <section className="payroll-card">
            <form onSubmit={savePaymentDetails}>
              <div className="payroll-grid payroll-grid-three">
                <Field label="Employee" error={paymentErrors.employeeId}>
                  <select required value={paymentForm.employeeId} onChange={(e) => { setPaymentErrors({ ...paymentErrors, employeeId: undefined }); selectPaymentEmployee(e.target.value); }}>
                    <option value="">Select Employee</option>
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>)}
                  </select>
                </Field>
                <Field label="PAN Number" error={paymentErrors.panNumber}><input required maxLength="10" value={paymentForm.panNumber} onChange={(e) => { setPaymentForm({ ...paymentForm, panNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }); setPaymentErrors({ ...paymentErrors, panNumber: undefined }); }} placeholder="ABCDE1234F" /></Field>
                <Field label="Bank Name" error={paymentErrors.bankName}><input required value={paymentForm.bankName} onChange={(e) => { setPaymentForm({ ...paymentForm, bankName: e.target.value }); setPaymentErrors({ ...paymentErrors, bankName: undefined }); }} placeholder="State Bank Of India" /></Field>
                <Field label="Account Number" error={paymentErrors.accountNumber}><input required inputMode="numeric" maxLength="18" value={paymentForm.accountNumber} onChange={(e) => { setPaymentForm({ ...paymentForm, accountNumber: e.target.value.replace(/\D/g, '') }); setPaymentErrors({ ...paymentErrors, accountNumber: undefined }); }} placeholder="9 To 18 Digits" /></Field>
                <Field label="IFSC Code" error={paymentErrors.ifscCode}><input required maxLength="11" value={paymentForm.ifscCode} onChange={(e) => { setPaymentForm({ ...paymentForm, ifscCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }); setPaymentErrors({ ...paymentErrors, ifscCode: undefined }); }} placeholder="SBIN0001234" /></Field>
                <Field label="Payment Mode" error={paymentErrors.paymentMode}>
                  <select required value={paymentForm.paymentMode} onChange={(e) => { setPaymentForm({ ...paymentForm, paymentMode: e.target.value }); setPaymentErrors({ ...paymentErrors, paymentMode: undefined }); }}>
                    {PAYMENT_MODE_VALUES.map((value) => <option key={value} value={value}>{titleEnum(value)}</option>)}
                  </select>
                </Field>
                <Field label="UAN Number" error={paymentErrors.uanNumber}><input required inputMode="numeric" maxLength="12" value={paymentForm.uanNumber} onChange={(e) => { setPaymentForm({ ...paymentForm, uanNumber: e.target.value.replace(/\D/g, '') }); setPaymentErrors({ ...paymentErrors, uanNumber: undefined }); }} placeholder="12 Digit UAN" /></Field>
                <Field label="PF Number" error={paymentErrors.pfNumber}><input required maxLength="18" value={paymentForm.pfNumber} onChange={(e) => { setPaymentForm({ ...paymentForm, pfNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }); setPaymentErrors({ ...paymentErrors, pfNumber: undefined }); }} placeholder="KNBNG1234567000001" /></Field>
                <Field label="ESI Number" error={paymentErrors.esiNumber}><input required inputMode="numeric" maxLength="17" value={paymentForm.esiNumber} onChange={(e) => { setPaymentForm({ ...paymentForm, esiNumber: e.target.value.replace(/\D/g, '') }); setPaymentErrors({ ...paymentErrors, esiNumber: undefined }); }} placeholder="17 Digit ESI Number" /></Field>
              </div>
              <div className="payroll-actions">
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  <CheckCircle2 size={16} />
                  {paymentExists ? 'Update Payment Details' : 'Save Payment Details'}
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      {activeStep === 'template' && (
        <>
          <PayrollSectionHeading number="18" title="Salary Template" subtitle="Create Reusable Earnings And Deduction Templates By Employment Type." icon={FileText} />
          <section className="payroll-card">
            <form onSubmit={saveTemplate}>
              <div className="payroll-grid payroll-grid-three">
                <Field label="Employment Type" error={templateErrors.employeeType}>
                  <select disabled={Boolean(editingTemplateId)} value={templateForm.employeeType} onChange={(e) => setTemplateForm({ ...templateForm, employeeType: e.target.value })}>
                    {EMPLOYMENT_TYPE_VALUES.map((value) => <option key={value} value={value}>{titleEnum(value)}</option>)}
                  </select>
                </Field>
                {SALARY_FIELDS.map(([key, label]) => (
                  <Field key={key} label={label} error={templateErrors[key]}>
                    <input required type="number" min="0" step="0.01" value={templateForm[key]} onChange={(e) => { setTemplateForm({ ...templateForm, [key]: e.target.value }); setTemplateErrors({ ...templateErrors, [key]: undefined }); }} />
                  </Field>
                ))}
              </div>
              <div className="payroll-actions">
                <button className="btn btn-primary" type="submit" disabled={busy}>{editingTemplateId ? 'Update Salary Template' : 'Create Salary Template'}</button>
                {editingTemplateId && <button className="btn btn-secondary" type="button" onClick={() => { setEditingTemplateId(null); setTemplateForm(emptyTemplate); }}>Cancel Edit</button>}
              </div>
            </form>
          </section>

          <section className="payroll-card">
            <div className="payroll-card-title-row">
              <div><h2>Salary Templates</h2><p>Active And Inactive Templates From The Payroll API.</p></div>
              <button className="payroll-icon-button" type="button" onClick={async () => setTemplates(await payroll.getSalaryTemplates(false))}><RefreshCw size={15} />Refresh</button>
            </div>
            <PayrollTable
              heads={['Employment Type', 'Basic Salary', 'Gross Salary', 'Status', 'Actions']}
              rows={templates.map((template) => [
                titleEnum(template.employeeType),
                money(template.basicSalary),
                money(template.grossSalary),
                <StatusPill key={`status-${template.id}`} status={template.active ? 'ACTIVE' : 'INACTIVE'} />,
                <div className="payroll-row-actions" key={`actions-${template.id}`}>
                  <button type="button" className="btn btn-small btn-secondary" onClick={() => editTemplate(template)}>Edit</button>
                  <button type="button" className="btn btn-small btn-secondary" onClick={() => toggleTemplateStatus(template)}>{template.active ? 'Deactivate' : 'Activate'}</button>
                </div>,
              ])}
            />
          </section>
        </>
      )}

      {activeStep === 'structure' && (
        <>
          <PayrollSectionHeading number="19" title="Salary Structure" subtitle="Assign Salary Templates To Employees And Create Salary Revisions." icon={Building2} />
          <section className="payroll-card">
            <div className="payroll-mode-switch">
              <button type="button" className={!revisionMode ? 'active' : ''} onClick={() => setRevisionMode(false)}>Initial Structure</button>
              <button type="button" className={revisionMode ? 'active' : ''} onClick={() => setRevisionMode(true)}>Salary Revision</button>
            </div>
            <form onSubmit={saveStructure}>
              <div className="payroll-grid payroll-grid-three">
                <Field label="Employee" error={structureErrors.employeeId}>
                  <select required value={structureForm.employeeId} onChange={(e) => { setStructureForm({ ...structureForm, employeeId: e.target.value }); setStructureErrors({ ...structureErrors, employeeId: undefined }); }}>
                    <option value="">Select Employee</option>
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>)}
                  </select>
                </Field>
                <Field label="Salary Template" error={structureErrors.salaryTemplateId}>
                  <select required value={structureForm.salaryTemplateId} onChange={(e) => { setStructureForm({ ...structureForm, salaryTemplateId: e.target.value }); setStructureErrors({ ...structureErrors, salaryTemplateId: undefined }); }}>
                    <option value="">Select Salary Template</option>
                    {templates.filter((template) => template.active !== false).map((template) => <option key={template.id} value={template.id}>{titleEnum(template.employeeType)} - {money(template.grossSalary)}</option>)}
                  </select>
                </Field>
                <Field label="Effective From" error={structureErrors.effectiveFrom}><input type="date" required value={structureForm.effectiveFrom} onChange={(e) => { setStructureForm({ ...structureForm, effectiveFrom: e.target.value }); setStructureErrors({ ...structureErrors, effectiveFrom: undefined, effectiveTo: undefined }); }} /></Field>
                <Field label="Effective To" error={structureErrors.effectiveTo}><input type="date" value={structureForm.effectiveTo} onChange={(e) => { setStructureForm({ ...structureForm, effectiveTo: e.target.value }); setStructureErrors({ ...structureErrors, effectiveTo: undefined }); }} /></Field>
                <Field label="Remarks"><input value={structureForm.remarks} onChange={(e) => setStructureForm({ ...structureForm, remarks: e.target.value })} /></Field>
              </div>
              <div className="payroll-actions">
                <button className="btn btn-primary" type="submit" disabled={busy}>{revisionMode ? 'Create Salary Revision' : 'Assign Salary Structure'}</button>
              </div>
            </form>
          </section>

          <section className="payroll-card">
            <div className="payroll-card-title-row">
              <div><h2>Salary Structures</h2><p>Current And Historical Employee Salary Structures.</p></div>
              <button className="payroll-icon-button" type="button" onClick={async () => setStructures(await payroll.getSalaryStructures(false))}><RefreshCw size={15} />Refresh</button>
            </div>
            <PayrollTable
              heads={['Employee', 'Effective From', 'Effective To', 'Gross Salary', 'Net Salary', 'Status']}
              rows={structures.map((structure) => [
                structure.employeeName || structure.employeeCode || structure.employeeId,
                structure.effectiveFrom,
                structure.effectiveTo || '—',
                money(structure.grossSalary),
                money(structure.netSalary),
                <StatusPill key={`structure-${structure.id}`} status={structure.status || 'ACTIVE'} />,
              ])}
            />
          </section>
        </>
      )}

      {activeStep === 'payroll' && (
        <>
          <PayrollSectionHeading number="20" title="Payroll" subtitle="Generate Monthly Payroll, Review Status And Download Payslips." icon={WalletCards} />

          <div className="payroll-summary-grid">
            <SummaryTile icon={UserRound} label="Employees Selected" value={selectedEmployees.length || 'All'} tone="blue" />
            <SummaryTile icon={Banknote} label="Payroll Records" value={payrollRows.length} tone="green" />
            <SummaryTile icon={ShieldCheck} label="Payroll Access" value="HR Only" tone="purple" />
          </div>

          <section className="payroll-card payroll-generate-card">
            <div className="payroll-card-title-row">
              <div><h2>Generate Monthly Payroll</h2><p>Leave Employee Selection Empty To Generate Payroll For All Active Employees.</p></div>
            </div>
            <form onSubmit={generatePayroll}>
              <div className="payroll-grid payroll-grid-two">
                <Field label="Payroll Month" error={generateErrors.payrollMonth}><input type="date" required value={generateForm.payrollMonth} onChange={(e) => { setGenerateForm({ ...generateForm, payrollMonth: e.target.value }); setGenerateErrors({ ...generateErrors, payrollMonth: undefined }); }} /></Field>
                <Field label="Remarks"><input value={generateForm.remarks} onChange={(e) => setGenerateForm({ ...generateForm, remarks: e.target.value })} /></Field>
              </div>

              <div className="payroll-employee-selector">
                <div className="payroll-selector-title">
                  <div><strong>Select Employees</strong><span>Optional - Leave Empty For All Active Employees</span></div>
                  {selectedEmployees.length > 0 && <button type="button" onClick={() => setSelectedEmployees([])}>Clear Selection</button>}
                </div>
                <div className="payroll-checks">
                  {employees.map((employee) => {
                    const id = String(employee.id);
                    return (
                      <label key={id} className={selectedEmployees.includes(id) ? 'selected' : ''}>
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(id)}
                          onChange={(event) => setSelectedEmployees(event.target.checked ? [...selectedEmployees, id] : selectedEmployees.filter((item) => item !== id))}
                        />
                        <span className="payroll-check-avatar">{employeeLabel(employee).charAt(0).toUpperCase()}</span>
                        <span>{employeeLabel(employee)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="payroll-actions payroll-generate-actions">
                <label className="payroll-draft-toggle">
                  <input type="checkbox" checked={generateForm.saveAsDraft} onChange={(e) => setGenerateForm({ ...generateForm, saveAsDraft: e.target.checked })} />
                  <span>Save As Draft</span>
                </label>
                <button className="btn btn-primary" type="submit" disabled={busy}><CircleDollarSign size={16} />Generate Payroll</button>
              </div>
            </form>
          </section>

          <section className="payroll-card">
            <div className="payroll-card-title-row payroll-filter-heading">
              <div><h2>Payroll Records</h2><p>Filter Payroll Records By Month Or Status.</p></div>
            </div>
            <div className="payroll-filter-bar">
              <div className="payroll-filter-group">
                <input type="date" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
                <button className="btn btn-secondary" type="button" onClick={loadPayrollByMonth}>Load Month</button>
              </div>
              <div className="payroll-filter-group">
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">Select Status</option>
                  {PAYROLL_STATUS_VALUES.map((value) => <option key={value} value={value}>{titleEnum(value)}</option>)}
                </select>
                <button className="btn btn-secondary" type="button" onClick={loadPayrollByStatus}>Filter Status</button>
              </div>
            </div>

            <PayrollTable
              heads={['Payroll Number', 'Employee', 'Payroll Month', 'Gross Salary', 'Deductions', 'Net Payable', 'Status', 'Actions']}
              rows={payrollRows.map((row) => [
                row.payrollNumber || '—',
                row.employeeName || row.employeeCode || row.employeeId,
                row.payrollMonth || '—',
                money(row.grossSalary),
                money(row.totalDeduction),
                money(row.netPayable ?? row.netSalary),
                <StatusPill key={`payroll-${row.id}`} status={row.status} />,
                <div className="payroll-row-actions" key={`payroll-actions-${row.id}`}>
                  {['DRAFT', 'GENERATED'].includes(row.status) && <button type="button" className="btn btn-small btn-secondary" onClick={() => updateStatus(row, 'APPROVED')}>Approve</button>}
                  {row.status === 'APPROVED' && <button type="button" className="btn btn-small btn-secondary" onClick={() => updateStatus(row, 'PAID')}>Mark Paid</button>}
                  <button type="button" className="btn btn-small btn-secondary" onClick={() => regenerate(row)}><RefreshCw size={13} />Regenerate</button>
                  <button type="button" className="btn btn-small btn-secondary" onClick={() => payroll.downloadPayslip(row.id, row.payrollNumber || 'payslip')}><Download size={13} />Payslip</button>
                </div>,
              ])}
            />
          </section>
        </>
      )}
    </div>
  );
}

function PayrollSectionHeading({ number, title, subtitle, icon: Icon }) {
  return (
    <div className="payroll-section-heading standalone">
      <div>
        <span className="payroll-section-number">{number}</span>
        <span className="payroll-section-icon"><Icon size={20} /></span>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, error }) {
  return <label className={`payroll-field ${error ? 'has-error' : ''}`}><span>{label}</span>{children}{error && <small className="payroll-field-error">{error}</small>}</label>;
}

function StatusPill({ status }) {
  const normalized = String(status || 'UNKNOWN').toLowerCase();
  return <span className={`payroll-pill payroll-pill-${normalized}`}>{titleEnum(status || 'Unknown')}</span>;
}

function PayrollTable({ heads, rows }) {
  return (
    <div className="payroll-table-wrap">
      <table className="payroll-table">
        <thead><tr>{heads.map((head) => <th key={head}>{head}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          )) : (
            <tr><td colSpan={heads.length}><div className="payroll-table-empty"><FileText size={22} />No Records Found.</div></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value, tone }) {
  return (
    <div className={`payroll-summary-tile tone-${tone}`}>
      <span className="payroll-summary-icon"><Icon size={20} /></span>
      <div><span>{label}</span><strong>{value}</strong></div>
    </div>
  );
}
