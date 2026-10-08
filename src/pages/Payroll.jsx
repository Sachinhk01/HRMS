import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Banknote, FileText, Landmark, Layers } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { EASE_OUT } from "../components/Motion";
import EmployeePayslipView from "./payroll/EmployeePayslipView";
import PayrollRunsPanel from "./payroll/PayrollRunsPanel";
import SalaryStructuresPanel from "./payroll/SalaryStructuresPanel";
import SalaryTemplatesPanel from "./payroll/SalaryTemplatesPanel";
import PaymentDetailsPanel from "./payroll/PaymentDetailsPanel";
import "./payroll/Payroll.css";
import "./payroll/PayrollPolish.css";

const ADMIN_ROLES = ["HR_ADMIN"];

const TABS = [
  { key: "payment", label: "Payment Details", icon: Landmark, roles: ["HR_ADMIN"] },
  { key: "templates", label: "Salary Templates", icon: FileText, roles: ["HR_ADMIN"] },
  { key: "structures", label: "Salary Structures", icon: Layers, roles: ["HR_ADMIN"] },
  { key: "runs", label: "Salary Slip", icon: Banknote, roles: ["HR_ADMIN"] },
];

function HeroArt() {
  return (
    <svg viewBox="0 0 260 180" aria-hidden="true">
      <defs>
        <linearGradient id="prSlip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e8f0ff" />
        </linearGradient>
        <linearGradient id="prCoin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <g className="pr-float">
        <rect x="52" y="22" width="130" height="140" rx="16" fill="url(#prSlip)" stroke="#bfdbfe" strokeWidth="1.5" />
        <rect x="68" y="40" width="46" height="9" rx="4.5" fill="#2563eb" opacity=".85" />
        <path className="pr-line" d="M68 66h98" stroke="#93c5fd" strokeWidth="5" strokeLinecap="round" />
        <path className="pr-line pr-line-2" d="M68 84h80" stroke="#bfdbfe" strokeWidth="5" strokeLinecap="round" />
        <path className="pr-line pr-line-3" d="M68 102h90" stroke="#bfdbfe" strokeWidth="5" strokeLinecap="round" />
        <rect x="68" y="122" width="98" height="26" rx="10" fill="#dcfce7" stroke="#bbf7d0" />
        <text x="80" y="140" fontSize="13" fontWeight="800" fill="#15803d">₹ Net Pay</text>
      </g>
      <g className="pr-float-2">
        <circle cx="206" cy="58" r="22" fill="url(#prCoin)" />
        <circle cx="206" cy="58" r="15" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2" />
        <text x="206" y="64" textAnchor="middle" fontSize="17" fontWeight="800" fill="#fff">₹</text>
      </g>
      <g className="pr-float-3">
        <circle cx="30" cy="118" r="14" fill="url(#prCoin)" />
        <text x="30" y="123" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">₹</text>
      </g>
    </svg>
  );
}

export default function Payroll() {
  const { user } = useAuth();
  const role = user?.role || user?.roles?.[0];
  const isAdmin = ADMIN_ROLES.includes(role);

  const [tab, setTab] = useState("runs");
  const visibleTabs = TABS.filter((item) => item.roles.includes(role));

  if (!isAdmin) {
    return <EmployeePayslipView />;
  }

  return (
    <div className="payroll-page">
      <motion.section
        className="payroll-hero"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
      >
        <div className="payroll-hero-text">
          <span className="eyebrow">Salary</span>
          <h1>Salary Management</h1>
          <p>Generate salary runs, manage salary templates and structures, and handle payment details.</p>
        </div>
        <div className="payroll-hero-art"><HeroArt /></div>
      </motion.section>

      <div className="payroll-tabs" role="tablist">
        {visibleTabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`payroll-tab${active ? " active" : ""}`}
              onClick={() => setTab(item.key)}
            >
              {active && (
                <motion.span
                  layoutId="payroll-tab-pill"
                  className="payroll-tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon size={15} /> <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
        >
          {tab === "runs" && <PayrollRunsPanel />}
          {tab === "templates" && <SalaryTemplatesPanel />}
          {tab === "structures" && <SalaryStructuresPanel />}
          {tab === "payment" && <PaymentDetailsPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
