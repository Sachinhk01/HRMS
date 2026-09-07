import { useState } from "react";
import { Banknote, FileText, Landmark, Layers } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import EmployeePayslipView from "./payroll/EmployeePayslipView";
import PayrollRunsPanel from "./payroll/PayrollRunsPanel";
import SalaryStructuresPanel from "./payroll/SalaryStructuresPanel";
import SalaryTemplatesPanel from "./payroll/SalaryTemplatesPanel";
import PaymentDetailsPanel from "./payroll/PaymentDetailsPanel";
import "./payroll/Payroll.css";

const ADMIN_ROLES = ["HR_ADMIN"];

const TABS = [
  { key: "runs", label: "Payroll Runs", icon: Banknote, roles: ["HR_ADMIN"] },
  { key: "templates", label: "Salary Templates", icon: FileText, roles: ["HR_ADMIN"] },
  { key: "structures", label: "Salary Structures", icon: Layers, roles: ["HR_ADMIN"] },
  { key: "payment", label: "Payment Details", icon: Landmark, roles: ["HR_ADMIN"] },
];

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
      <PageHeader
        eyebrow="Payroll"
        title="Payroll Management"
        description="Generate payroll runs, manage salary templates and structures, and handle payment details."
      />

      <div className="payroll-tabs">
        {visibleTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              className={`payroll-tab${tab === item.key ? " active" : ""}`}
              onClick={() => setTab(item.key)}
            >
              <Icon size={15} /> {item.label}
            </button>
          );
        })}
      </div>

      {tab === "runs" && <PayrollRunsPanel />}
      {tab === "templates" && <SalaryTemplatesPanel />}
      {tab === "structures" && <SalaryStructuresPanel />}
      {tab === "payment" && <PaymentDetailsPanel />}
    </div>
  );
}
