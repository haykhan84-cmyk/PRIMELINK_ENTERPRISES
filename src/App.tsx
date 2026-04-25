/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Truck, 
  Package, 
  Users, 
  Settings, 
  Menu,
  X,
  TrendingUp,
  RotateCcw,
  Smartphone,
  BarChart4,
  Printer,
  ExternalLink
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
import Expenses from './components/Expenses';
import AgreementModal from './components/AgreementModal';

function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (v: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  const menuItems = [
    { name: 'Admin Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Order Pad (Field)', path: '/order-pad', icon: ShoppingCart },
    { name: 'Accounts & Vouchers', path: '/reports', icon: BarChart4 },
    { name: 'Inventory & Batch', path: '/inventory', icon: Package },
    { name: 'Fleet & Logistics', path: '/fleet', icon: Truck },
    { name: 'Customers (Territory)', path: '/customers', icon: Users },
    { name: 'Employees', path: '/employees', icon: Users },
    { name: 'Suppliers', path: '/suppliers', icon: Truck },
    { name: 'Daily Expenses', path: '/expenses', icon: RotateCcw },
    { name: 'Bank & Accounts', path: '/bank', icon: TrendingUp },
    { name: 'PRS Settlements', path: '/settlement', icon: RotateCcw },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  // Keyboard Navigation Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Use Alt + 1-8 for quick navigation
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
  }, [navigate]);

  return (
    <>
      {/* Mobile Backdrop */}
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
        <div className="p-6 border-b border-white/10 mb-6 bg-[#222063]">
          <div className="flex flex-col">
            <h1 className="font-black text-white leading-none text-xl tracking-tighter">SWAT DMS</h1>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">Panr Distribution Hub</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-0.5" role="navigation" aria-label="Main Navigation">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                title={`Shortcut: Alt + ${index + 1}`}
                className={`flex items-center gap-3 px-6 py-3 text-sm transition-all border-l-4 outline-none focus-visible:bg-white/20 focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-accent ${isActive ? 'bg-white/10 border-accent text-white' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-slate-500 group-hover:text-white'}`} />
                <span className="font-bold tracking-wide uppercase text-[11px]">{item.name}</span>
                <span className="ml-auto text-[8px] opacity-30 font-black">Alt+{index+1}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
          Enterprise v4.2.0 • Swat, KP<br />
          Offline Sync: ACTIVE
        </div>
      </motion.aside>
    </>
  );
}

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [inIframe, setInIframe] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  useEffect(() => {
    setInIframe(window.self !== window.top);
    const accepted = localStorage.getItem('erp_agreement_accepted');
    if (accepted) setAgreementAccepted(true);
  }, []);

  const handleAgreementAccept = (details: any) => {
    console.log("Agreement accepted:", details);
    localStorage.setItem('erp_agreement_accepted', 'true');
    localStorage.setItem('erp_agreement_details', JSON.stringify(details));
    setAgreementAccepted(true);
  };

  // Auto-close sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50 relative overflow-x-hidden">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        
        <motion.main 
          initial={false}
          animate={{ 
            marginLeft: isSidebarOpen && window.innerWidth >= 1024 ? '240px' : '0px' 
          }}
          className="flex-1 flex flex-col min-w-0 transition-all duration-300"
        >
          <header className="h-16 border-b border-[#e0f1f1] bg-[#f2980b] backdrop-blur-md sticky top-0 z-30 flex items-center px-4 md:px-8 justify-between no-print">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-black/10 rounded-lg flex items-center justify-center transition-colors"
            >
              <Menu className="w-6 h-6 text-white" />
            </button>
            
            {inIframe && (
              <a 
                href={window.location.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 bg-[#222063] hover:bg-[#1a184d] px-4 py-2 rounded-lg border border-white/20 text-white transition-all shadow-lg group no-print"
              >
                <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-black uppercase tracking-widest">
                  Open Full Application
                </span>
              </a>
            )}
            
            <div className="flex items-center gap-4 text-white">
              <div className="hidden md:block text-right">
                <p className="text-sm font-bold text-white leading-none">Panr, Mingora</p>
                <p className="text-[10px] text-[#222063] uppercase font-bold mt-1 tracking-tighter">Swat, KP</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </header>

          <div className="p-4 md:p-8 flex-1 overflow-x-hidden">
            <AnimatePresence>
              {!agreementAccepted && <AgreementModal onAccept={handleAgreementAccept} />}
            </AnimatePresence>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/order-pad" element={<OrderPad />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/fleet" element={<Fleet />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/bank" element={<BankManagement />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settlement" element={<Settlement />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </motion.main>
      </div>
    </Router>
  );
}

