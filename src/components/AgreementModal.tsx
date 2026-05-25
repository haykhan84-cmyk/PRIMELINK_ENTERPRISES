import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, ArrowDown, MapPin, Smartphone, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AgreementModalProps {
  onAccept: (details: { deviceId: string; gps: string; timestamp: string }) => void;
}

export default function AgreementModal({ onAccept }: AgreementModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [gps, setGps] = useState('Fetching...');

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps(`${pos.coords.latitude}, ${pos.coords.longitude}`),
        () => setGps('Permission Denied')
      );
    }
  }, []);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 20) {
        setHasScrolledToBottom(true);
      }
    }
  };

  const handleAccept = () => {
    onAccept({
      deviceId: navigator.userAgent.split(' ')[0], // Simulating device ID
      gps,
      timestamp: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-200"
      >
        <div className="p-8 bg-slate-50 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Employment Compliance Agreement</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Primelink Distribution Management System v4.0</p>
          </div>
        </div>

        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="p-8 overflow-y-auto text-sm text-slate-600 leading-relaxed space-y-6"
        >
          <section className="space-y-3">
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">1. GPS & Field Tracking</h3>
            <p>As a field employee of Primelink DMS, you acknowledge that your GPS location will be captured during order bookings. You must be within a 50m radius of the customer's registered location for an order to be considered valid for commission calculation.</p>
          </section>

          <section className="space-y-3">
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">2. Financial Integrity</h3>
            <p>All cash collected from customers must be deposited at the branch settlement desk on a daily basis as per the Post-Route Settlement (PRS) policy. Any variance exceeding 0.5% will be deducted from the monthly payroll.</p>
          </section>

          <section className="space-y-3">
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">3. Equipment & Data</h3>
            <p>This digital pad/app is for official use only. Unauthorized use of the "Dummy Invoice" mode for non-training purposes is strictly prohibited and subject to disciplinary action under Pakistan Labor Laws.</p>
          </section>

          <section className="space-y-3">
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">4. Legal Jurisdiction</h3>
            <p>This agreement is governed by the laws of Pakistan. In case of dispute, the Labor Court of Swat/Mingora shall have exclusive jurisdiction.</p>
          </section>
          
          {!hasScrolledToBottom && (
            <div className="flex items-center justify-center py-4 text-primary animate-bounce">
              <ArrowDown className="w-5 h-5" />
              <span className="text-[10px] font-black ml-2 uppercase">Scroll to Bottom to Accept</span>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
              <Smartphone className="w-3 h-3" />
              Device: {navigator.userAgent.split(' ')[0]}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
              <MapPin className="w-3 h-3 text-rose-500" />
              GPS: {gps}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
              <Clock className="w-3 h-3" />
              {new Date().toLocaleTimeString()}
            </div>
          </div>

          <button 
            disabled={!hasScrolledToBottom}
            onClick={handleAccept}
            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl transition-all active:scale-95 ${
              hasScrolledToBottom 
                ? 'bg-primary text-white hover:bg-slate-800' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            Accept Terms & Synchronize Data
          </button>
        </div>
      </motion.div>
    </div>
  );
}
