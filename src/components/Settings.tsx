import { useState, useEffect } from 'react';
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
  Users
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';

import Employees from './Employees';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'system' | 'tax' | 'sync'>('system');
  const [taxMode, setTaxMode] = useState('exempt');
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
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm no-print">
          {[
            { id: 'system', name: 'System', icon: SettingsIcon },
            { id: 'tax', name: 'Simulation', icon: Database },
            { id: 'sync', name: 'Offline Sync', icon: RefreshCw },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
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
                      <button className="btn-outline text-xs bg-white">Configure</button>
                    </div>
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
              <input type="file" className="hidden" accept=".json,.csv" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
