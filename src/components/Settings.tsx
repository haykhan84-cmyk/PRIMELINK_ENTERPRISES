import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Settings as SettingsIcon, 
  Database, 
  Share2, 
  FileJson, 
  QrCode, 
  Download, 
  Upload, 
  MessageCircle,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  HardDrive,
  Usb,
  Users,
  RotateCcw,
  Printer
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { triggerPrint } from '../lib/printUtils';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useWorkspace } from '../lib/WorkspaceContext';
import { formatDate } from '../lib/dateUtils';
import Employees from './Employees';
import MasterDataManager from './MasterDataManager';

export default function Settings() {
  const { workspaceUid } = useWorkspace();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'system' | 'tax' | 'sync' | 'printer' | 'whatsapp' | 'mdm'>('system');
  const [taxMode, setTaxMode] = useState('exempt');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['system', 'tax', 'sync', 'printer', 'whatsapp', 'mdm'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);
  const [whatsappKey, setWhatsappKey] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [cloudBackups, setCloudBackups] = useState<any[]>([]);
  const [simTaxRate, setSimTaxRate] = useState(18);
  const [stats, setStats] = useState<any>(null);
  const [syncData, setSyncData] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [dirHandle, setDirHandle] = useState<any>(null);

  useEffect(() => {
    // Auto-sync effect if handle is active
    let interval: NodeJS.Timeout;
    if (dirHandle) {
      interval = setInterval(() => {
        performLocalSync();
      }, 60000); // Sync every minute
    }
    return () => clearInterval(interval);
  }, [dirHandle]);

  const selectSyncFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        id: 'primelink-sync'
      });
      setDirHandle(handle);
      performLocalSync(handle);
    } catch (err) {
      console.error("Directory selection cancelled or failed", err);
    }
  };

  const performLocalSync = async (activeHandle = dirHandle) => {
    if (!activeHandle) return;
    setIsSyncing(true);
    try {
      const response = await fetch('/api/backup/download');
      if (!response.ok) throw new Error("Server backup failed");
      
      const blob = await response.blob();
      const filename = `erp_sync_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
      
      // Save current backup
      const fileHandle = await activeHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      // Also maintain a 'latest' copy
      const latestHandle = await activeHandle.getFileHandle('erp_latest.db', { create: true });
      const latestWritable = await latestHandle.createWritable();
      await latestWritable.write(blob);
      await latestWritable.close();

      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const mode = data.find((s: any) => s.key === 'tax_mode')?.value || 'exempt';
        setTaxMode(mode);
        
        const wsKey = data.find((s: any) => s.key === 'whatsapp_api_key')?.value || '';
        const wsPhone = data.find((s: any) => s.key === 'whatsapp_phone')?.value || '';
        setWhatsappKey(wsKey);
        setWhatsappPhone(wsPhone);
      });
    
    fetch('/api/dashboard/stats')
      .then(res => res.json())
      .then(setStats);
  }, []);

  const calculateSimulatedProfit = (rate: number) => {
    if (!stats) return 0;
    const simulatedTax = stats.sales * (rate / 100);
    return stats.sales - simulatedTax - stats.cogs - stats.expenses - stats.fleet;
  };

  const handleSaveWhatsapp = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'whatsapp_api_key', value: whatsappKey })
        }),
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'whatsapp_phone', value: whatsappPhone })
        })
      ]);
      alert('WhatsApp configuration successfully updated.');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchBackups = async () => {
    if (!workspaceUid) return;
    try {
      const backupsRef = collection(db, 'users', workspaceUid, 'backups');
      const q = query(backupsRef, orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCloudBackups(docs);
    } catch (err) {
      console.error("Failed to fetch cloud vault:", err);
    }
  };

  const handleRestore = async (backupData: string) => {
    setIsSaving(true);
    setConfirmRestoreId(null);
    try {
      console.log("[Restore] Initializing payload recovery...");
      
      let data;
      if (typeof backupData === 'string') {
        try {
          data = JSON.parse(backupData);
        } catch (pe) {
          console.error("[Restore] JSON Parse failed, checking if raw object:", pe);
          data = backupData;
        }
      } else {
        data = backupData;
      }

      console.log("[Restore] Sending command to core server...");
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await res.json();
      
      if (res.ok && result.success) {
        console.log("[Restore] System synced successfully.");
        alert("✅ SYSTEM RESTORED\n\nYour snapshots have been re-instated. The application will now refresh to apply changes.");
        window.location.reload();
      } else {
        throw new Error(result.error || "The server rejected the sync packet.");
      }
    } catch (err) {
      console.error("[Restore] Fatal process error:", err);
      alert("❌ RESTORE FAILED\n\n" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sync' || activeTab === 'system') {
       fetchBackups();
    }
  }, [activeTab, workspaceUid]);

  const handleTaxToggle = (mode: string) => {
    setTaxMode(mode);
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'tax_mode', value: mode })
    });
  };

  const generateSyncPayload = async () => {
    // Collect all data to sync
    const skus = await fetch('/api/skus').then(res => res.json());
    const customers = await fetch('/api/customers').then(res => res.json());
    const stats = await fetch('/api/dashboard/stats').then(res => res.json());
    
    const payload = {
      timestamp: new Date().toISOString(),
      origin: "PRIMELINK_ERP_DESKTOP",
      data: { skus, customers, stats }
    };
    
    setSyncData(JSON.stringify(payload));
  };

  const copyToClipboard = () => {
    if (syncData) {
      navigator.clipboard.writeText(syncData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadJson = () => {
    if (!syncData) return;
    const blob = new Blob([syncData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `primelink_sync_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">System Control Center</h1>
          <p className="text-slate-500 font-bold text-sm uppercase">Global orchestration & compliance parameters.</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm no-print relative z-20 overflow-x-auto max-w-full">
          {[
            { id: 'system', name: 'System', icon: SettingsIcon },
            { id: 'tax', name: 'Simulation', icon: Database },
            { id: 'sync', name: 'Backup & Recovery', icon: RefreshCw },
            { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle },
            { id: 'printer', name: 'Printer', icon: Printer },
            { id: 'mdm', name: 'Master Data', icon: HardDrive },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer relative z-30 whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-primary text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'mdm' ? (
        <div className="w-full">
          <MasterDataManager />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <AnimatePresence mode="wait">
              {activeTab === 'system' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="erp-card p-6">
                  <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-slate-400" />
                    WhatsApp & Mobile Integration
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                          <MessageCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">WhatsApp Automations</h4>
                          <p className="text-xs text-slate-500">Auto-send recovery reminders & price updates.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab('whatsapp')}
                        className="btn-outline text-xs bg-white"
                      >
                        Configure
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'whatsapp' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="erp-card p-0 overflow-hidden">
                  <div className="bg-emerald-600 p-8 text-white">
                    <div className="flex items-center justify-between mb-2">
                       <MessageCircle className="w-8 h-8" />
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-emerald-500/30 px-3 py-1 rounded-full">Pro Integration</span>
                    </div>
                    <h3 className="text-2xl font-black italic tracking-tight">WHATSAPP <span className="text-emerald-300">GATEWAY</span></h3>
                    <p className="text-emerald-100/70 text-xs font-bold uppercase tracking-widest mt-1">Primelink Communications Hub</p>
                  </div>

                  <div className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Phone Number</label>
                        <input 
                          type="text" 
                          value={whatsappPhone}
                          onChange={(e) => setWhatsappPhone(e.target.value)}
                          placeholder="+92 3XX XXXXXXX"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">API Gateway Key</label>
                        <div className="relative">
                          <input 
                            type="password" 
                            value={whatsappKey}
                            onChange={(e) => setWhatsappKey(e.target.value)}
                            placeholder="••••••••••••••••"
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all pr-12"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Notification Workflows</h4>
                      <div className="space-y-3">
                        {[
                          { id: 'invoice', label: 'Auto-Send Invoice to Customer', desc: 'Sends PDF link upon order completion' },
                          { id: 'dispatch', label: 'Driver Dispatch SMS', desc: 'Alerts driver with route details via WhatsApp' },
                          { id: 'delivery', label: 'Delivery Confirmation', desc: 'Notifies office when order is marked delivered' }
                        ].map((workflow) => (
                          <div key={workflow.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 group hover:border-emerald-200 transition-all cursor-pointer">
                            <div className="flex items-center gap-4">
                              <div className="w-4 h-4 rounded border-2 border-slate-200 group-hover:border-emerald-500 transition-all flex items-center justify-center">
                                <div className="w-2 h-2 bg-emerald-500 rounded-sm opacity-0 group-hover:opacity-100" />
                              </div>
                              <div>
                                <p className="text-xs font-black text-slate-900">{workflow.label}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">{workflow.desc}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={handleSaveWhatsapp}
                      disabled={isSaving}
                      className="w-full btn-primary !bg-emerald-600 !shadow-[3px_3px_0px_0px_#064e3b] hover:!shadow-[4px_4px_0px_0px_#064e3b] disabled:opacity-50"
                    >
                      {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Update Communication Matrix
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="text-[10px] text-amber-700 font-bold leading-relaxed">
                    COMMUNICATION PROTOCOL: Ensure your Business Phone is verified on the DMS Gateway. Automated messages are billed at the standard carrier rate unless using a verified WhatsApp Business API.
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'tax' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="erp-card">
                  <div className="card-title flex items-center gap-2">
                    <Database className="w-4 h-4 text-accent" />
                    Tax Compliance Mode
                  </div>
                  
                  <div className="space-y-6 p-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">System Tax Status</h4>
                        <p className="text-xs text-slate-500 mt-1">Toggle between Exempt (Default) and FBR Active.</p>
                      </div>
                      <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                        <button 
                          onClick={() => handleTaxToggle('exempt')}
                          className={`px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${taxMode === 'exempt' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          Exempt
                        </button>
                        <button 
                          onClick={() => handleTaxToggle('active')}
                          className={`px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${taxMode === 'active' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          FBR Active
                        </button>
                      </div>
                    </div>

                    {/* Simulator Section */}
                    {stats && (
                      <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-6">
                        <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Profit Simulation (FBR Impact)</h3>
                        
                        <div className="grid grid-cols-2 gap-10 items-end">
                          <div className="flex items-end gap-6 h-32">
                            <div className="flex flex-col items-center gap-2 h-full">
                              <div className="w-10 bg-emerald-500 rounded-t-lg" style={{ height: '100%' }} />
                              <span className="text-[8px] font-black uppercase text-slate-500">Exempt</span>
                            </div>
                            <div className="flex flex-col items-center gap-2 h-full">
                              <div 
                                className="w-10 bg-rose-500 rounded-t-lg transition-all duration-500" 
                                style={{ height: `${(calculateSimulatedProfit(simTaxRate) / stats.netProfit) * 100}%` }} 
                              />
                              <span className="text-[8px] font-black uppercase text-slate-500">{simTaxRate}% Tax</span>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                <span>Sim Rate</span>
                                <span className="text-secondary">{simTaxRate}%</span>
                              </div>
                              <input 
                                type="range" 
                                min="0" 
                                max="30" 
                                step="1" 
                                value={simTaxRate}
                                onChange={(e) => setSimTaxRate(Number(e.target.value))}
                                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-secondary"
                              />
                            </div>
                            <div className="pt-2 border-t border-white/5">
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Est. Loss</p>
                              <p className="text-xl font-black text-rose-400">
                                Rs. {Math.abs(stats.netProfit - calculateSimulatedProfit(simTaxRate)).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-700 leading-relaxed">
                        <p className="font-bold mb-1">Regional Notice</p>
                        Current territory is designated as tax-exempt. Activating this mode will re-enable 18% GST and 4% Further Tax calculations on the Order Pad.
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'sync' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="erp-card p-6 border-2 border-accent/20">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Usb className="w-5 h-5 text-accent" />
                      <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Local Backup & Sync</h3>
                    </div>
                    {dirHandle && (
                      <span className="bg-success/10 text-success text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Connected</span>
                    )}
                  </div>
                  
                  {!dirHandle ? (
                    <button 
                      onClick={selectSyncFolder}
                      className="w-full py-8 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-4 hover:bg-slate-50 hover:border-accent transition-all group"
                    >
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-accent group-hover:text-white transition-all">
                        <HardDrive className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-slate-900">Configure Sync Directory</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black mt-1">Desktop or USB Storage</p>
                      </div>
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Last Synchronization</p>
                          <p className="font-bold text-slate-900">{lastSyncTime || 'Awaiting initial sync...'}</p>
                        </div>
                        <button 
                          onClick={() => performLocalSync()}
                          disabled={isSyncing}
                          className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:opacity-50"
                        >
                          <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                      <button 
                        onClick={() => setDirHandle(null)}
                        className="w-full text-center text-[10px] text-slate-400 font-bold uppercase hover:text-rose-500 py-2"
                      >
                        Disconnect & Forget Path
                      </button>
                    </div>
                  )}
                </div>

                {/* Cloud Continuity Section */}
                <div className="erp-card p-0 overflow-hidden border-2 border-primary/20">
                  <div className="bg-primary p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                       <Database className="w-5 h-5 text-accent" />
                       <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">Automatic</span>
                    </div>
                    <h3 className="font-black text-lg uppercase tracking-tight italic">Snapshot <span className="text-accent">Vault</span></h3>
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-1">Real-time Cloud Continuity Protocol</p>
                  </div>

                  <div className="p-6 space-y-4">
                    {cloudBackups.length === 0 ? (
                      <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <RefreshCw className="w-8 h-8 text-slate-300 mx-auto mb-3 animate-spin duration-[3000ms]" />
                        <p className="text-[10px] font-black uppercase text-slate-400">Initializing First Cloud Link...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {cloudBackups.map((backup) => (
                          <div key={backup.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-primary/30 transition-all group overflow-hidden relative">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-all">
                                  <RotateCcw className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="text-xs font-black text-slate-900">
                                    {formatDate(backup.createdAt?.toDate?.() || backup.createdAt)}
                                  </p>
                                  <div className="flex gap-2 mt-1 text-[8px] font-bold uppercase tracking-widest text-slate-400">
                                    <span>{backup.count?.customers || 0} Customers</span>
                                    <span>•</span>
                                    <span>{backup.count?.orders || 0} Orders</span>
                                  </div>
                                </div>
                              </div>
                              <button 
                                onClick={() => setConfirmRestoreId(backup.id)}
                                disabled={isSaving}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-primary hover:text-white hover:border-primary transition-all disabled:opacity-50"
                              >
                                {isSaving && confirmRestoreId === backup.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Restore'}
                              </button>
                            </div>

                            {/* Confirmation Overlay */}
                            <AnimatePresence>
                              {confirmRestoreId === backup.id && (
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 1.05 }}
                                  className="absolute inset-0 bg-primary/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-20 text-center"
                                >
                                  <p className="text-[10px] font-black text-white uppercase tracking-widest mb-3">Overwrite current system?</p>
                                  <div className="flex gap-2 w-full max-w-[240px]">
                                    <button 
                                      onClick={() => handleRestore(backup.data)}
                                      className="flex-1 py-2 bg-white text-primary rounded-lg text-[9px] font-black uppercase tracking-[0.15em] shadow-xl active:scale-95 transition-all"
                                    >
                                      Confirm Nuclear Restore
                                    </button>
                                    <button 
                                      onClick={() => setConfirmRestoreId(null)}
                                      className="px-3 py-2 bg-black/20 text-white rounded-lg text-[9px] font-black uppercase tracking-[0.15em] hover:bg-black/30 transition-all"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
                      <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
                        <div className="text-[10px] text-blue-700 font-bold leading-relaxed">
                          CONTINUITY PROTOCOL: Your database is automatically snapshotted to the cloud every 20 minutes when the application is active. Restore points are kept for the last 5 operational cycles.
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                          setIsSaving(true);
                          try {
                            const res = await fetch('/api/backup/export');
                            const data = await res.json();
                            const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
                            const { db } = await import('../lib/firebase');
                            await addDoc(collection(db, 'users', workspaceUid!, 'backups'), {
                              userId: workspaceUid,
                              data: JSON.stringify(data),
                              createdAt: serverTimestamp(),
                              count: Object.keys(data).reduce((acc: any, key: string) => {
                                acc[key] = data[key].length;
                                return acc;
                              }, {})
                            });
                            alert("✅ Snapshot Force-Created successfully!");
                            fetchBackups();
                          } catch (e) {
                            alert("❌ Force Snapshot Failed");
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Force Snapshot Now'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'printer' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="erp-card p-6">
                  <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Printer className="w-5 h-5 text-slate-400" />
                    Printer Configuration
                  </h3>
                  
                  <div className="space-y-6">
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <h4 className="text-[10px] font-black uppercase text-emerald-600 mb-2">Cloud-Native Printing</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Primelink ERP uses <strong>Browser Print Services</strong>. You do not need to "Add" a printer to the app. The system automatically detects all USB, Network, and Wireless printers connected to your computer.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">Thermal Printer (Receipt)</h4>
                          <p className="text-xs text-slate-500">80mm thermal receipt format.</p>
                        </div>
                        <span className="text-[9px] font-black uppercase px-2 py-1 bg-slate-200 text-slate-500 rounded">Auto-Detect</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">Professional A4 Printer</h4>
                          <p className="text-xs text-slate-500">A4 Laser/Inkjet for Sales Invoices.</p>
                        </div>
                        <span className="text-[9px] font-black uppercase px-2 py-1 bg-emerald-100 text-emerald-600 rounded">Ready</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <button 
                        onClick={triggerPrint}
                        className="w-full py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:shadow-xl transition-all"
                      >
                        Print Test Page
                      </button>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex gap-3">
                       <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                       <div className="text-[10px] text-amber-700 font-bold leading-relaxed">
                          TIP: If "Print Now" buttons do not respond, please ensure you are not using a Popup Blocker and that you have opened the app in a "New Tab" from the parent dashboard.
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="erp-card bg-primary text-white !p-0 overflow-hidden shadow-2xl">
            <div className="p-6">
              <div className="card-title text-slate-400 !border-white/10 flex items-center gap-2">
                <FileJson className="w-4 h-4 text-accent" />
                DMS Sync Packets
              </div>
              
              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Export master records for field distribution mobile apps.
                </p>
                <button 
                  onClick={generateSyncPayload}
                  className="w-full py-4 bg-accent text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  Generate Packet
                </button>
              </div>
            </div>

            <AnimatePresence>
              {syncData && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-white p-6 border-t border-slate-800"
                >
                  <div className="flex flex-col items-center gap-6">
                    <div className="p-4 bg-white rounded-2xl shadow-inner border border-slate-100">
                      <QRCodeSVG value={syncData.substring(0, 500)} size={180} level="M" />
                    </div>
                    
                    <div className="w-full space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={copyToClipboard}
                          className="btn-outline text-[10px] flex items-center justify-center gap-2 py-3"
                        >
                          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          Copy
                        </button>
                        <button 
                          onClick={downloadJson}
                          className="btn-outline text-[10px] flex items-center justify-center gap-2 py-3"
                        >
                          <Download className="w-4 h-4" />
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="erp-card p-4 border-dashed border-2 bg-slate-50/50">
            <label className="flex flex-col items-center justify-center gap-3 cursor-pointer py-6 hover:bg-white transition-all rounded-2xl">
              <div className="w-12 h-12 bg-white text-slate-300 rounded-full flex items-center justify-center shadow-sm">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-center">
                <p className="text-xs font-black uppercase text-slate-900">Import Field Sales</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">JSON / CSV From DMS Mobile</p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept=".json,.csv" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setIsSaving(true);
                  try {
                    const text = await file.text();
                    let data;
                    if (file.name.endsWith('.json')) {
                      data = JSON.parse(text);
                    } else {
                      // Simple CSV to JSON (assumes headers)
                      const lines = text.split('\n');
                      const headers = lines[0].split(',').map(h => h.trim());
                      data = lines.slice(1).filter(l => l.trim()).map(line => {
                        const values = line.split(',').map(v => v.trim());
                        return headers.reduce((obj: any, header, i) => {
                          obj[header] = values[i];
                          return obj;
                        }, {});
                      });
                    }

                    // For field sales, we usually expect a list of either customers or orders
                    // If it's a raw list, we'll try to identify what it is
                    const payload: any = {};
                    if (Array.isArray(data)) {
                      if (data[0]?.customer_id || data[0]?.total) payload.orders = data;
                      else payload.customers = data;
                    } else {
                      Object.assign(payload, data);
                    }

                    console.log("[Import] Processing external payload:", Object.keys(payload));
                    const res = await fetch('/api/backup/import', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                    });

                    const result = await res.json();
                    if (res.ok && result.success) {
                      alert("✅ FIELD DATA IMPORTED: System updated with mobile sales data.");
                      window.location.reload();
                    } else {
                      throw new Error(result.error || "Batch import rejected by core.");
                    }
                  } catch (err) {
                    console.error("[Import] Failure:", err);
                    alert("❌ IMPORT FAILED: Invalid data format or schema mismatch.");
                  } finally {
                    setIsSaving(false);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
