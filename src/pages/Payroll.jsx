import { useEffect, useState } from 'react';
import { Download, IndianRupee, WalletCards } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { hrmsService } from '../services/hrmsService';

const money = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(n) || 0);

export default function Payroll() {
  const [list, setList] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    hrmsService.getPayslips()
      .then((payslips) => {
        if (!active) return;
        const items = Array.isArray(payslips) ? payslips : [];
        setList(items);
        setData(items[0] || null);
      })
      .catch(() => {
        if (active) {
          setList([]);
          setData(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const earnings = Array.isArray(data?.earnings) ? data.earnings : [];
  const deductions = Array.isArray(data?.deductions) ? data.deductions : [];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Payroll"
        title="Payslip & salary"
        description="A clean breakdown of your monthly earnings and deductions."
        action={
          <select
            className="compact-select"
            value={data?.month || ''}
            onChange={(e) => setData(list.find((p) => p.month === e.target.value) || null)}
            disabled={list.length === 0}
          >
            {list.length === 0 ? <option value="">No payslips</option> : list.map((p) => (
              <option key={p.id} value={p.month}>{p.month}</option>
            ))}
          </select>
        }
      />

      {loading ? (
        <div className="panel empty-state">Loading payroll…</div>
      ) : !data ? (
        <div className="panel empty-state">
          No payslips are available yet for this account.
        </div>
      ) : (
        <div className="payroll-layout">
          <section className="pay-hero">
            <div>
              <span>Net pay · {data.month}</span>
              <strong>{money(data.netPay)}</strong>
              <p>Credited to your registered salary account.</p>
            </div>
            <WalletCards size={64} />
            <button className="btn btn-light" type="button">
              <Download size={18} />
              Download payslip
            </button>
          </section>

          <section className="panel line-items">
            <div className="panel-title">
              <h2>Earnings</h2>
              <IndianRupee size={19} />
            </div>
            {earnings.length === 0 ? (
              <div className="empty-row">No earnings data available.</div>
            ) : earnings.map(([label, value]) => (
              <div className={label.startsWith('Total') ? 'total' : ''} key={`${data.id}-${label}`}>
                <span>{label}</span>
                <strong>{money(value)}</strong>
              </div>
            ))}
          </section>

          <section className="panel line-items">
            <div className="panel-title">
              <h2>Deductions</h2>
            </div>
            {deductions.length === 0 ? (
              <div className="empty-row">No deduction data available.</div>
            ) : deductions.map(([label, value]) => (
              <div className={label.startsWith('Total') ? 'total' : ''} key={`${data.id}-${label}-deduction`}>
                <span>{label}</span>
                <strong>{money(value)}</strong>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
