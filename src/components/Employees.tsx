import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Briefcase, 
  TrendingUp, 
  Wallet, 
  Plus, 
  Search, 
  Trash2, 
  Edit,
  Phone,
  Power,
  Slash,
  BarChart,
  UserPlus,
  Calendar,
  AlertCircle,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../lib/dateUtils';

interface Employee {
  id: number;
  name: string;
  role: string;
  contact: string;
  base_salary: number;
  commission_pc: number;
  food_allowance: number;
  working_days: number;
  status: string;
  target?: number;
}

interface Performance {
  total_orders: number;
  total_sales: number | null;
  avg_order_value: number | null;
}

interface Absence {
  id: number;
  date: string;
  reason: string;
  deduction_amount: number;
}

interface SalaryPayment {
  id: number;
  amount: number;
  month: string;
  payment_date: string;
  status: string;
}

interface Loan {
  id: number;
  amount: number;
  type: string;
  date: string;
  status: string;
  description: string;
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Employee>>({
    name: '',
    role: 'Salesman',
    contact: '',
    base_salary: 0,
    commission_pc: 0,
    food_allowance: 0,
    working_days: 26,
    status: 'active',
    target: 0
  });

  const [absenceData, setAbsenceData] = useState({
    date: new Date().toISOString().split('T')[0],
    reason: 'Sick Leave',
    deduction_amount: 0
  });

  const [paymentData, setPaymentData] = useState({
    amount: 0,
    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
  });

  const [loanData, setLoanData] = useState({
    amount: 0,
    type: 'Advance',
    description: ''
  });

  const fetchData = async () => {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch employees", err);
      setEmployees([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchPerformance = async (id: number) => {
    try {
      const [perfRes, absRes, payRes, loanRes] = await Promise.all([
        fetch(`/api/employees/${id}/performance`),
        fetch(`/api/employees/${id}/absences`),
        fetch(`/api/employees/${id}/payments`),
        fetch(`/api/employees/${id}/loans`)
      ]);
      
      const perfData = await perfRes.json();
      const absData = await absRes.json();
      const payData = await payRes.json();
      const loanDataRaw = await loanRes.json();

      setPerformance(perfData);
      setAbsences(Array.isArray(absData) ? absData : []);
      setPayments(Array.isArray(payData) ? payData : []);
      setLoans(Array.isArray(loanDataRaw) ? loanDataRaw : []);
    } catch (err) {
      console.error("Failed to fetch employee details", err);
    }
  };

  const handleEdit = (employee: Employee) => {
    setFormData(employee);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this employee?')) {
      await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    setIsModalOpen(false);
    setFormData({ name: '', role: 'Salesman', contact: '', base_salary: 0, commission_pc: 0, status: 'active', target: 0 });
    fetchData();
  };

  const logAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    await fetch(`/api/employees/${selectedEmployee.id}/absences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(absenceData)
    });
    setIsAbsenceModalOpen(false);
    fetchPerformance(selectedEmployee.id);
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    await fetch(`/api/employees/${selectedEmployee.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });
    setIsPaymentModalOpen(false);
    fetchPerformance(selectedEmployee.id);
  };

  const handleLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    await fetch(`/api/employees/${selectedEmployee.id}/loans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loanData)
    });
    setIsLoanModalOpen(false);
    setLoanData({ amount: 0, type: 'Advance', description: '' });
    fetchPerformance(selectedEmployee.id);
  };

  const safeEmployees = Array.isArray(employees) ? employees : [];
  const filteredEmployees = safeEmployees.filter(e => 
    (e.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.role || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalPayroll: safeEmployees.reduce((acc, e) => acc + (e.base_salary || 0) + (e.food_allowance || 0), 0),
    totalCommission: safeEmployees.reduce((acc, e) => acc + (e.role === 'Salesman' ? 5000 : 0), 0), 
    employeeCount: safeEmployees.length
  };

  const safeAbsences = Array.isArray(absences) ? absences : [];
  const currentMonthAbsences = safeAbsences.filter(a => (a.date || '').startsWith(new Date().toISOString().slice(0, 7)));
  
  // Salary Automation Logic
  const dailyRate = (selectedEmployee?.base_salary || 0) / (selectedEmployee?.working_days || 26);
  const totalDeductions = currentMonthAbsences.reduce((acc, a) => acc + (a.deduction_amount || 0), 0);
  const safeLoans = Array.isArray(loans) ? loans : [];
  const activeLoans = safeLoans.filter(l => l.status === 'Pending' || l.status === 'Active');
  const advancesThisMonth = activeLoans.filter(l => l.type === 'Advance' && (l.date || '').startsWith(new Date().toISOString().slice(0, 7)));
  const totalAdvanceTaken = advancesThisMonth.reduce((acc, l) => acc + (l.amount || 0), 0);
  const totalLoanBalance = activeLoans.reduce((acc, l) => acc + (l.amount || 0), 0);
  
  const projectedCommission = Math.round(((performance?.total_sales || 0) * (selectedEmployee?.commission_pc || 0)) / 100);
  const foodAllowance = selectedEmployee?.food_allowance || 0;
  const netPayable = (selectedEmployee?.base_salary || 0) + foodAllowance + projectedCommission - totalDeductions - totalAdvanceTaken;

  useEffect(() => {
    if (isPaymentModalOpen && selectedEmployee) {
      setPaymentData(prev => ({
        ...prev,
        amount: Math.round(netPayable)
      }));
    }
  }, [isPaymentModalOpen, selectedEmployee, netPayable]);

  useEffect(() => {
    if (isAbsenceModalOpen && selectedEmployee) {
      const rate = (selectedEmployee.base_salary || 0) / (selectedEmployee.working_days || 26);
      setAbsenceData(prev => ({
        ...prev,
        deduction_amount: Math.round(rate)
      }));
    }
  }, [isAbsenceModalOpen, selectedEmployee]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="w-10 h-10 text-primary" />
            EMPLOYEE <span className="text-secondary">MANAGEMENT</span>
          </h1>
          <p className="text-slate-500 font-bold text-sm mt-1 uppercase tracking-widest">
            Human Resources & Performance Tracking
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-100 border-none rounded-xl pl-10 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none w-64 shadow-inner"
            />
          </div>
          <button 
            onClick={() => {
              setFormData({ name: '', role: 'Salesman', contact: '', base_salary: 0, commission_pc: 0, target: 0 });
              setIsModalOpen(true);
            }}
            className="bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 shadow-lg transition-all active:scale-95"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="erp-card bg-white p-6 border-l-4 border-l-primary">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Force</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{stats.employeeCount} Members</p>
            </div>
          </div>
        </div>
        <div className="erp-card bg-white p-6 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Wallet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Monthly Payroll</p>
              <p className="text-2xl font-black text-slate-900 mt-1">Rs. {stats.totalPayroll.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="erp-card bg-white p-6 border-l-4 border-l-accent">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Avg Yield / Member</p>
              <p className="text-2xl font-black text-slate-900 mt-1">Rs. 42k</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="erp-card overflow-hidden h-[calc(100vh-280px)] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-100">
                  <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Employee</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Role</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Salary</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((e) => (
                  <tr 
                    key={e.id} 
                    onClick={() => {
                      setSelectedEmployee(e);
                      fetchPerformance(e.id);
                    }}
                    className={`border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${selectedEmployee?.id === e.id ? 'bg-primary/5' : ''}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-900">{e.name}</div>
                        {e.status === 'inactive' && (
                          <span className="text-[8px] px-1 py-0.5 bg-rose-100 text-rose-600 rounded font-black uppercase">Inactive</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" /> {e.contact || 'N/A'}
                      </div>
                    </td>
                    <td className="p-4 text-xs font-black uppercase">
                      <span className={`px-2 py-1 rounded-md ${
                        e.role === 'Salesman' ? 'bg-emerald-100 text-emerald-700' : 
                        e.role === 'Accountant' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {e.role}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-900">
                      Rs. {e.base_salary?.toLocaleString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(evt) => { 
                            evt.stopPropagation(); 
                            const newStatus = e.status === 'active' ? 'inactive' : 'active';
                            if (confirm(`Mark ${e.name} as ${newStatus}?`)) {
                              fetch('/api/employees', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ...e, status: newStatus })
                              }).then(() => fetchData());
                            }
                          }}
                          className={`p-2 rounded-lg transition-colors ${e.status === 'active' ? 'text-slate-400 hover:bg-slate-100' : 'text-emerald-500 hover:bg-emerald-50'}`}
                          title={e.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          <Slash className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(evt) => { evt.stopPropagation(); handleEdit(e); }}
                          className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-600"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(evt) => { evt.stopPropagation(); handleDelete(e.id); }}
                          className="p-2 hover:bg-rose-100 rounded-lg transition-colors text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Details & Performance */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {selectedEmployee ? (
              <motion.div
                key={selectedEmployee.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="erp-card bg-slate-900 text-white p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Briefcase className="w-24 h-24" />
                  </div>
                  <h3 className="text-2xl font-black mb-1">{selectedEmployee.name}</h3>
                  <p className="text-secondary font-black uppercase text-[10px] tracking-widest mb-6">
                    {selectedEmployee.role} Profile
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Gross Salary</p>
                      <p className="text-xl font-black">Rs. {((selectedEmployee.base_salary || 0) + (selectedEmployee.food_allowance || 0))?.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Working Days</p>
                      <p className="text-xl font-black text-accent">{selectedEmployee.working_days || 26}</p>
                    </div>
                  </div>
                </div>

                {selectedEmployee.role === 'Salesman' && (
                  <div className="erp-card p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h3 className="font-black text-slate-900 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        PERFORMANCE
                      </h3>
                    </div>

                    {performance ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-end p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Sales</p>
                            <p className="text-2xl font-black text-slate-900">Rs. {performance.total_sales?.toLocaleString() || 0}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Orders</p>
                            <p className="text-xl font-bold font-mono text-slate-900">{performance.total_orders}</p>
                          </div>
                        </div>

                        {selectedEmployee.target && (
                          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Target Progress</p>
                              <p className="text-xs font-bold text-emerald-700">
                                {Math.round(((performance.total_sales || 0) / selectedEmployee.target) * 100)}%
                              </p>
                            </div>
                            <div className="h-2 bg-emerald-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-600 transition-all duration-1000"
                                style={{ width: `${Math.min(100, ((performance.total_sales || 0) / selectedEmployee.target) * 100)}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-emerald-600 mt-2 font-bold uppercase tracking-widest text-center">
                              Target: Rs. {selectedEmployee.target.toLocaleString()}
                            </p>
                          </div>
                        )}

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Earned Commission</p>
                          <p className="text-xl font-black text-secondary">
                            Rs. {Math.round(((performance.total_sales || 0) * selectedEmployee.commission_pc) / 100).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-400 italic text-sm">
                        Loading performance data...
                      </div>
                    )}
                  </div>
                )}

                {/* Salary Tracker */}
                <div className="erp-card p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h3 className="font-black text-slate-900 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-blue-500" />
                      SALARY TRACKER
                    </h3>
                    <button 
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="text-[10px] font-black text-primary border border-primary/20 bg-primary/5 px-2 py-1 rounded-md uppercase tracking-widest hover:bg-primary/10 transition-all"
                    >
                      Record Payment
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Net Payable (This Month)</p>
                        <p className="text-lg font-black text-blue-900">Rs. {netPayable.toLocaleString()}</p>
                      </div>
                      <div className="grid grid-cols-5 gap-2 mt-4 pt-4 border-t border-blue-200">
                        <div className="text-center">
                          <p className="text-[8px] font-black text-blue-400 uppercase">Base</p>
                          <p className="text-xs font-bold text-blue-900">{selectedEmployee.base_salary.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] font-black text-blue-400 uppercase">Food</p>
                          <p className="text-xs font-bold text-emerald-600">+{foodAllowance.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] font-black text-blue-400 uppercase">Comm.</p>
                          <p className="text-xs font-bold text-blue-900">+{projectedCommission.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] font-black text-blue-400 uppercase">Abs.</p>
                          <p className="text-xs font-bold text-rose-600">-{Math.round(totalDeductions).toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] font-black text-blue-400 uppercase">Adv.</p>
                          <p className="text-xs font-bold text-rose-600">-{totalAdvanceTaken.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment History</p>
                      {payments.length > 0 ? (
                        <div className="space-y-1.5 h-32 overflow-y-auto pr-1">
                          {payments.map(p => (
                            <div key={p.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg text-[10px]">
                              <div>
                                <span className="font-bold text-slate-900">{p.month}</span>
                                <span className="text-slate-400 mx-1">•</span>
                                <span className="text-slate-500">{formatDate(p.payment_date)}</span>
                              </div>
                              <span className="font-black text-emerald-600">Rs. {p.amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No payment records found.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Absentee System */}
                <div className="erp-card p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h3 className="font-black text-slate-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-rose-500" />
                      ATTENDANCE / ABSENCES
                    </h3>
                    <button 
                      onClick={() => setIsAbsenceModalOpen(true)}
                      className="text-[10px] font-black text-rose-600 border border-rose-200 bg-rose-50 px-2 py-1 rounded-md uppercase tracking-widest hover:bg-rose-100 transition-all"
                    >
                      Log Absence
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Leaves (This Month)</p>
                        <p className="text-2xl font-black text-rose-600">{currentMonthAbsences.length}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Deductions</p>
                        <p className="text-2xl font-black text-slate-900">Rs. {totalDeductions.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Absences</p>
                      {absences.length > 0 ? (
                        <div className="space-y-1.5 h-32 overflow-y-auto pr-1">
                          {absences.map(a => (
                            <div key={a.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg text-[10px]">
                              <div>
                                <span className="font-bold text-slate-900">{formatDate(a.date)}</span>
                                <span className="text-slate-400 mx-1">•</span>
                                <span className="text-slate-500">{a.reason}</span>
                              </div>
                              <span className="font-bold text-rose-600">-Rs. {a.deduction_amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No absence records found.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Loan & Advance Section */}
                <div className="erp-card p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h3 className="font-black text-slate-900 flex items-center gap-2">
                      <Coins className="w-4 h-4 text-amber-500" />
                      LOANS & ADVANCES
                    </h3>
                    <button 
                      onClick={() => setIsLoanModalOpen(true)}
                      className="text-[10px] font-black text-amber-600 border border-amber-200 bg-amber-50 px-2 py-1 rounded-md uppercase tracking-widest hover:bg-amber-100 transition-all"
                    >
                      Issue Loan
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                      <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Outstanding Balance</p>
                      <p className="text-2xl font-black text-amber-900">Rs. {totalLoanBalance.toLocaleString()}</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Transactions</p>
                      {loans.length > 0 ? (
                        <div className="space-y-1.5 h-32 overflow-y-auto pr-1">
                          {loans.map(l => (
                            <div key={l.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg text-[10px]">
                              <div>
                                <span className="font-black text-slate-900">{l.type}</span>
                                <span className="text-slate-400 mx-1">•</span>
                                <span className="text-slate-500">{formatDate(l.date)}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-slate-900">Rs. {l.amount.toLocaleString()}</span>
                                <div className="text-[8px] font-black uppercase text-amber-600">{l.status}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No loan records found.</p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-400 space-y-4 erp-card">
                <BarChart className="w-12 h-12 opacity-20" />
                <p className="text-xs font-black uppercase tracking-widest">Select an employee for details</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-6 text-white text-center">
                <h3 className="text-xl font-black uppercase tracking-widest">
                  {formData.id ? 'Edit Employee' : 'Register Employee'}
                </h3>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Full Name</label>
                    <input 
                      required
                      type="text" 
                      value={formData.name || ''}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Role</label>
                    <select 
                      value={formData.role || 'Salesman'}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Accountant">Accountant</option>
                      <option value="Salesman">Salesman</option>
                      <option value="Business Development Manager">Business Development Manager</option>
                      <option value="Marketing Manager">Marketing Manager</option>
                      <option value="Deliveryman">Deliveryman</option>
                      <option value="Driver">Driver</option>
                      <option value="IT">IT</option>
                      <option value="Office Boy">Office Boy</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Status</label>
                    <select 
                      value={formData.status || 'active'}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Contact</label>
                    <input 
                      type="text" 
                      value={formData.contact || ''}
                      onChange={(e) => setFormData({...formData, contact: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Base Salary</label>
                    <input 
                      type="number" 
                      value={formData.base_salary || 0}
                      onChange={(e) => setFormData({...formData, base_salary: Number(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Commission %</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={formData.commission_pc || 0}
                      onChange={(e) => setFormData({...formData, commission_pc: Number(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Food Allowance</label>
                    <input 
                      type="number" 
                      value={formData.food_allowance || 0}
                      onChange={(e) => setFormData({...formData, food_allowance: Number(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Working Days</label>
                    <input 
                      type="number" 
                      value={formData.working_days || 26}
                      onChange={(e) => setFormData({...formData, working_days: Number(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                    />
                  </div>

                  {formData.role === 'Salesman' && (
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Monthly Sales Target</label>
                      <input 
                        type="number" 
                        value={formData.target || 0}
                        onChange={(e) => setFormData({...formData, target: Number(e.target.value)})}
                        className="w-full bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400 hover:text-slate-600 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"
                  >
                    {formData.id ? 'Save Changes' : 'Register Now'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Log Absence Modal */}
      <AnimatePresence>
        {isAbsenceModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
            >
              <div className="bg-rose-600 p-6 text-white text-center">
                <h3 className="text-xl font-black uppercase tracking-widest leading-none">Log Absence</h3>
                <p className="text-[10px] font-bold opacity-70 mt-2">{selectedEmployee?.name}</p>
              </div>
              <form onSubmit={logAbsence} className="p-8 space-y-5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Date</label>
                  <input 
                    type="date" 
                    value={absenceData.date}
                    onChange={(e) => setAbsenceData({...absenceData, date: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Reason</label>
                  <select 
                    value={absenceData.reason}
                    onChange={(e) => setAbsenceData({...absenceData, reason: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  >
                    <option>Sick Leave</option>
                    <option>Family Emergency</option>
                    <option>Unannounced</option>
                    <option>Half Day</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Deduction (Rs.)</label>
                  <input 
                    type="number" 
                    value={absenceData.deduction_amount}
                    onChange={(e) => setAbsenceData({...absenceData, deduction_amount: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsAbsenceModalOpen(false)} className="flex-1 text-xs font-black text-slate-400 uppercase tracking-widest">Cancel</button>
                  <button type="submit" className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Confirm</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Record Payment Modal */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
            >
              <div className="bg-blue-600 p-6 text-white text-center">
                <h3 className="text-xl font-black uppercase tracking-widest leading-none">Salary Disbursement</h3>
                <p className="text-[10px] font-bold opacity-70 mt-2">{selectedEmployee?.name}</p>
              </div>
              <form onSubmit={recordPayment} className="p-8 space-y-5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Month</label>
                  <input 
                    type="text" 
                    value={paymentData.month}
                    onChange={(e) => setPaymentData({...paymentData, month: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Amount (Rs.)</label>
                  <input 
                    type="number" 
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({...paymentData, amount: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                  <button 
                    type="button"
                    onClick={() => setPaymentData({...paymentData, amount: netPayable})}
                    className="text-[10px] text-primary font-black uppercase mt-2 hover:underline"
                  >
                    Suggest Net: Rs. {netPayable.toLocaleString()}
                  </button>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="flex-1 text-xs font-black text-slate-400 uppercase tracking-widest">Cancel</button>
                  <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Disburse</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Loan Modal */}
      <AnimatePresence>
        {isLoanModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
            >
              <div className="bg-amber-600 p-6 text-white text-center">
                <h3 className="text-xl font-black uppercase tracking-widest leading-none">Issue Loan / Advance</h3>
                <p className="text-[10px] font-bold opacity-70 mt-2">{selectedEmployee?.name}</p>
              </div>
              <form onSubmit={handleLoanSubmit} className="p-8 space-y-5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Type</label>
                  <select 
                    value={loanData.type}
                    onChange={(e) => setLoanData({...loanData, type: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none font-bold"
                  >
                    <option value="Advance">Advance</option>
                    <option value="Loan">Loan</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Amount (Rs.)</label>
                  <input 
                    type="number" 
                    value={loanData.amount}
                    onChange={(e) => setLoanData({...loanData, amount: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Description</label>
                  <input 
                    type="text" 
                    placeholder="Reason or notes..."
                    value={loanData.description}
                    onChange={(e) => setLoanData({...loanData, description: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsLoanModalOpen(false)} className="flex-1 text-xs font-black text-slate-400 uppercase tracking-widest">Cancel</button>
                  <button type="submit" className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Approve</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
