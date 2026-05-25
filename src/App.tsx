/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ReactNode } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useWorkspace, WorkspaceProvider } from './lib/WorkspaceContext';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Truck, 
  Package, 
  Users, 
  Settings, 
  Menu,
  RotateCcw,
  TrendingUp,
  BarChart4,
  BookOpen,
  ExternalLink,
  LogOut,
  Briefcase,
  UserCircle,
  ShieldCheck,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import OrderPad from './components/OrderPad';
import Fleet from './components/Fleet';
import Inventory from './components/Inventory';
import SettingsPage from './components/Settings';
import Customers from './components/Customers';
import Reports from './components/Reports';
import Settlement from './components/Settlement';
import Employees from './components/Employees';
import BankManagement from './components/BankManagement';
import Suppliers from './components/Suppliers';
import PurchaseOrders from './components/PurchaseOrders';
import Invoices from './components/Invoices';
import Expenses from './components/Expenses';
import AgreementModal from './components/AgreementModal';
import Login from './components/Login';
import MyFiles from './components/MyFiles';
import MyNotes from './components/MyNotes';
import TeamMembers from './components/TeamMembers';
import AutoBackup from './components/AutoBackup';
import Roznamcha from './components/Roznamcha';

function ProtectedRoute({ children, roles, currentRole }: { children: ReactNode, roles: string[], currentRole: string | null }) {
  if (!currentRole) return <>{children}</>;
  const role = currentRole.toLowerCase();
  const isAuthorized = roles.some(r => r.toLowerCase() === role);
  
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <ShieldCheck className="w-20 h-20 text-slate-100 mb-6" />
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Access Denied</h2>
        <p className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest max-w-xs">Your clearance level does not permit access to this sector.</p>
        <Link to="/" className="mt-8 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">
          Return to Dashboard
        </Link>
      </div>
    );
  }
  
  return <>{children}</>;
}

const MENU_PERMISSIONS = {
  dashboard: ['admin', 'IT', 'Accountant', 'Business Development Manager', 'Marketing Manager', 'Salesman'],
  orderPad: ['admin', 'IT', 'Salesman', 'Accountant'],
  inventory: ['admin', 'IT', 'Salesman', 'Accountant'],
  fleet: ['admin', 'IT', 'Driver', 'Deliveryman'],
  customers: ['admin', 'IT', 'Salesman', 'Accountant', 'Business Development Manager'],
  employees: ['admin', 'IT'],
  suppliers: ['admin', 'IT', 'Accountant'],
  purchaseOrders: ['admin', 'IT', 'Accountant'],
  invoices: ['admin', 'IT', 'Salesman', 'Accountant', 'Business Development Manager'],
  expenses: ['admin', 'IT', 'Accountant'],
  bank: ['admin', 'IT', 'Accountant'],
  reports: ['admin', 'IT', 'Accountant', 'Marketing Manager', 'Business Development Manager'],
  settlement: ['admin', 'IT', 'Salesman', 'Accountant'],
  files: ['admin', 'IT', 'Salesman', 'Accountant', 'Driver', 'Deliveryman', 'Office Boy', 'Business Development Manager', 'Marketing Manager', 'staff'],
  notes: ['admin', 'IT', 'Salesman', 'Accountant', 'Driver', 'Deliveryman', 'Office Boy', 'Business Development Manager', 'Marketing Manager', 'staff'],
  team: ['admin', 'IT'],
  settings: ['admin', 'IT'],
  roznamcha: ['admin', 'IT', 'Accountant', 'Salesman', 'Driver', 'Deliveryman', 'Business Development Manager']
};

function Sidebar({ isOpen, setIsOpen, user, isUrdu }: { isOpen: boolean, setIsOpen: (v: boolean) => void, user: User | null, isUrdu?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUserRole, availableWorkspaces, workspaceUid, setWorkspaceUid, isSubordinate } = useWorkspace();
  
  const allMenuItems = [
    { name: 'Admin Dashboard', path: '/', icon: LayoutDashboard, roles: MENU_PERMISSIONS.dashboard },
    { name: 'Sales', path: '/order-pad', icon: ShoppingCart, roles: MENU_PERMISSIONS.orderPad },
    { name: 'Reports', path: '/reports', icon: BarChart4, roles: MENU_PERMISSIONS.reports },
    { name: 'Inventory', path: '/inventory', icon: Package, roles: MENU_PERMISSIONS.inventory },
    { name: 'Fleet & Logistics', path: '/fleet', icon: Truck, roles: MENU_PERMISSIONS.fleet },
    { name: 'Customers', path: '/customers', icon: Users, roles: MENU_PERMISSIONS.customers },
    { name: 'Employees', path: '/employees', icon: Users, roles: MENU_PERMISSIONS.employees },
    { name: 'Suppliers', path: '/suppliers', icon: Truck, roles: MENU_PERMISSIONS.suppliers },
    { name: 'Purchase Orders', path: '/purchase-orders', icon: FileText, roles: MENU_PERMISSIONS.purchaseOrders },
    { name: 'Invoices & Ledger', path: '/invoices', icon: FileText, roles: MENU_PERMISSIONS.invoices },
    { name: 'Roznamcha (Daybook)', path: '/roznamcha', icon: BookOpen, roles: MENU_PERMISSIONS.roznamcha },
    { name: 'Expenses', path: '/expenses', icon: RotateCcw, roles: MENU_PERMISSIONS.expenses },
    { name: 'Bank & Accounts', path: '/bank', icon: TrendingUp, roles: MENU_PERMISSIONS.bank },
    { name: 'PRS Settlements', path: '/settlement', icon: RotateCcw, roles: MENU_PERMISSIONS.settlement },
    { name: 'Settings', path: '/settings', icon: Settings, roles: MENU_PERMISSIONS.settings },
  ];

  const menuItems = allMenuItems.filter(item => {
    if (!currentUserRole) return true;
    const role = currentUserRole.toLowerCase();
    return item.roles.some(r => r.toLowerCase() === role);
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key >= '1' && e.key <= '8') {
        const index = parseInt(e.key) - 1;
        if (menuItems[index]) {
          navigate(menuItems[index].path);
          setIsOpen(false);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, menuItems]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside 
        initial={false}
        animate={{ 
          x: isOpen ? 0 : -240,
          opacity: isOpen ? 1 : 0
        }}
        className="fixed inset-y-0 left-0 w-[240px] bg-[#1a184d] text-white z-50 flex flex-col transition-all duration-300 transform no-print"
      >
        <div className="p-6 border-b border-white/10 mb-4 bg-[#222063]">
          <div className="flex flex-col">
            <h1 className="font-black text-white leading-none text-xl tracking-tighter uppercase">Primelink DMS</h1>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">Panr Distribution Hub</p>
          </div>
        </div>

        {isSubordinate && (
          <div className="px-4 mb-4">
            <div className="bg-white/5 rounded-xl p-2 border border-white/10">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 px-1">Authority Domains</p>
              <div className="space-y-1">
                <button 
                  onClick={() => setWorkspaceUid(user?.uid || '')}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all ${workspaceUid === user?.uid ? 'bg-primary border border-white/20' : 'text-slate-400 hover:bg-white/5'}`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${workspaceUid === user?.uid ? 'bg-white text-primary' : 'bg-white/10'}`}>Me</div>
                  <p className="text-[10px] font-bold truncate">Personal</p>
                </button>
                {availableWorkspaces.map((grant) => (
                  <button 
                    key={grant.bossUid}
                    onClick={() => setWorkspaceUid(grant.bossUid)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all ${workspaceUid === grant.bossUid ? 'bg-emerald-600 border border-white/20' : 'text-slate-400 hover:bg-white/5'}`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${workspaceUid === grant.bossUid ? 'bg-white text-emerald-600' : 'bg-emerald-500/20 text-emerald-500'}`}>
                      {grant.bossEmail.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left overflow-hidden">
                       <p className="text-[10px] font-bold truncate">{grant.bossEmail.split('@')[0]}</p>
                       <p className="text-[7px] text-white/50 font-black uppercase leading-none">{grant.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto space-y-0.5">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-6 py-3 transition-all border-l-4 outline-none ${isActive ? 'bg-white/10 border-accent text-white' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-slate-500'}`} />
                <span className="font-bold tracking-wide uppercase text-[11px]">{item.name}</span>
                {index < 8 && <span className="ml-auto text-[8px] opacity-30 font-black">Alt+{index+1}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-white/5 bg-[#14123d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 border border-white/10">
              <UserCircle className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white truncate uppercase tracking-tight">{user?.email}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${currentUserRole === 'admin' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  {currentUserRole === 'admin' ? 'System Admin' : currentUserRole}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[8px] font-black uppercase text-slate-600 tracking-[0.2em]">
            <span>Ent. v4.2.0 • S.KP</span>
            <button onClick={() => auth.signOut()} className="text-slate-400 hover:text-white">Log Out</button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <WorkspaceProvider>
        <AppContent />
      </WorkspaceProvider>
    </Router>
  );
}

function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isUrdu, setIsUrdu] = useState(false);
  const [inIframe, setInIframe] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const { currentUserRole, isSubordinate, workspaceUid, setWorkspaceUid, availableWorkspaces } = useWorkspace();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setInIframe(window.self !== window.top);
    const accepted = localStorage.getItem('erp_agreement_accepted');
    if (accepted) setAgreementAccepted(true);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#1a184d] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-white text-xl font-black uppercase tracking-tighter shadow-sm">Initializing Primelink</h2>
        <p className="text-white/40 text-[9px] font-bold uppercase tracking-[0.3em] mt-2">Authenticating Encrypted Gateway...</p>
      </div>
    );
  }

  if (user && !user.emailVerified) {
    return <Login unverifiedEmail={user.email} />;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 relative overflow-x-hidden">
      <AutoBackup />
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} user={user} isUrdu={isUrdu} />
      
      <motion.main 
        animate={{ marginLeft: isSidebarOpen && window.innerWidth >= 1024 ? '240px' : '0px' }}
        className="flex-1 flex flex-col min-w-0 transition-all duration-300"
      >
        <header className="h-16 border-b border-[#e0f1f1] bg-[#f2980b] sticky top-0 z-30 flex items-center px-4 md:px-8 justify-between no-print shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-black/10 rounded-lg text-white">
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden lg:flex items-center gap-2">
               <ShieldCheck className="w-4 h-4 text-white opacity-50" />
               <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">{currentUserRole || 'Operator'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {inIframe && (
              <a href={window.location.href} target="_blank" rel="noreferrer" className="hidden md:flex items-center gap-2 bg-[#222063] px-4 py-2 rounded-lg border border-white/20 text-white transition-all shadow-lg group">
                <ExternalLink className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Full App</span>
              </a>
            )}
            
            <div className="flex items-center gap-4 text-white">
              {isSubordinate && (
                <div className="hidden sm:flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                  <Briefcase className="w-4 h-4 text-accent" />
                  <select 
                    value={workspaceUid || ''} 
                    onChange={(e) => setWorkspaceUid(e.target.value)}
                    className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-wider text-white"
                  >
                    <option value={user.uid} className="text-slate-900">My Workspace</option>
                    {availableWorkspaces.map(ws => (
                      <option key={ws.bossUid} value={ws.bossUid} className="text-slate-900">{ws.bossEmail.split('@')[0]}'s ERP</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="hidden lg:block text-right">
                <p className="text-sm font-bold text-white leading-none">{user.email}</p>
                <p className="text-[10px] text-[#222063] uppercase font-bold mt-1 tracking-tighter tracking-widest">Authorized Operator</p>
              </div>
              <button onClick={() => signOut(auth)} className="p-2 hover:bg-rose-500 rounded-lg group transition-colors">
                <LogOut className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 flex-1 overflow-x-hidden">
          <AnimatePresence>
            {!agreementAccepted && <AgreementModal onAccept={(d: any) => {
               localStorage.setItem('erp_agreement_accepted', 'true');
               setAgreementAccepted(true);
            }} />}
          </AnimatePresence>
          <Routes>
            <Route path="/" element={<ProtectedRoute roles={MENU_PERMISSIONS.dashboard} currentRole={currentUserRole}><Dashboard isUrdu={isUrdu} /></ProtectedRoute>} />
            <Route path="/order-pad" element={<ProtectedRoute roles={MENU_PERMISSIONS.orderPad} currentRole={currentUserRole}><OrderPad isUrdu={isUrdu} setIsUrdu={setIsUrdu} /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute roles={MENU_PERMISSIONS.inventory} currentRole={currentUserRole}><Inventory /></ProtectedRoute>} />
            <Route path="/fleet" element={<ProtectedRoute roles={MENU_PERMISSIONS.fleet} currentRole={currentUserRole}><Fleet /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute roles={MENU_PERMISSIONS.customers} currentRole={currentUserRole}><Customers /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute roles={MENU_PERMISSIONS.employees} currentRole={currentUserRole}><Employees /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute roles={MENU_PERMISSIONS.suppliers} currentRole={currentUserRole}><Suppliers /></ProtectedRoute>} />
            <Route path="/purchase-orders" element={<ProtectedRoute roles={MENU_PERMISSIONS.purchaseOrders} currentRole={currentUserRole}><PurchaseOrders /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute roles={MENU_PERMISSIONS.invoices} currentRole={currentUserRole}><Invoices /></ProtectedRoute>} />
            <Route path="/roznamcha" element={<ProtectedRoute roles={MENU_PERMISSIONS.roznamcha} currentRole={currentUserRole}><Roznamcha /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute roles={MENU_PERMISSIONS.expenses} currentRole={currentUserRole}><Expenses /></ProtectedRoute>} />
            <Route path="/bank" element={<ProtectedRoute roles={MENU_PERMISSIONS.bank} currentRole={currentUserRole}><BankManagement /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute roles={MENU_PERMISSIONS.reports} currentRole={currentUserRole}><Reports /></ProtectedRoute>} />
            <Route path="/settlement" element={<ProtectedRoute roles={MENU_PERMISSIONS.settlement} currentRole={currentUserRole}><Settlement /></ProtectedRoute>} />
            <Route path="/files" element={<ProtectedRoute roles={MENU_PERMISSIONS.files} currentRole={currentUserRole}><MyFiles /></ProtectedRoute>} />
            <Route path="/notes" element={<ProtectedRoute roles={MENU_PERMISSIONS.notes} currentRole={currentUserRole}><MyNotes /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute roles={MENU_PERMISSIONS.team} currentRole={currentUserRole}><TeamMembers /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute roles={MENU_PERMISSIONS.settings} currentRole={currentUserRole}><SettingsPage /></ProtectedRoute>} />
          </Routes>
        </div>
      </motion.main>
    </div>
  );
}
