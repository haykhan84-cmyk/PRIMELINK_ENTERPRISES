import { useState, useEffect } from 'react';
import { Truck, Fuel, ShieldCheck, PenTool, Plus, AlertTriangle, Gauge, History } from 'lucide-react';
import { motion } from 'motion/react';

export default function Fleet() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/fleet')
      .then(res => res.json())
      .then(data => {
        setVehicles(data);
        setLoading(false);
      });
  }, []);

  // Mock fleet if empty for demo
  const fleetData = vehicles.length > 0 ? vehicles : [
    { id: 1, vehicle_number: 'SWT-1234', model: 'Hino Truck 5-Ton', current_km: 45200, last_service_km: 40000 },
    { id: 2, vehicle_number: 'SWT-5678', model: 'Suzuki Ravi 1-Ton', current_km: 12500, last_service_km: 12000 }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Fleet & Logistics</h1>
          <p className="text-text-muted font-medium text-sm">Vehicle maintenance, fuel logs, and service alerts.</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Truck className="w-4 h-4" />
          Add Vehicle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {fleetData.map(vehicle => {
          const kmSinceService = vehicle.current_km - vehicle.last_service_km;
          const serviceDue = kmSinceService > 5000;
          
          return (
            <motion.div 
              key={vehicle.id}
              whileHover={{ y: -5 }}
              className={`erp-card relative group ${serviceDue ? 'ring-2 ring-danger ring-offset-2' : ''}`}
            >
              <div className="card-title !mb-6">Vehicle Status: {vehicle.vehicle_number}</div>
              <div className="flex items-start justify-between relative z-10">
                <div className="bg-primary text-white p-3 rounded shadow-lg">
                  <Truck className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase leading-none">Registration</p>
                  <p className="text-xl font-black text-slate-900 mt-1">{vehicle.vehicle_number}</p>
                </div>
              </div>

              <div className="mt-8 space-y-4 relative z-10">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
                  <span>Current Mileage</span>
                  <span className="text-slate-900">{vehicle.current_km.toLocaleString()} KM</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span>Service Interval</span>
                    <span className={`${serviceDue ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {serviceDue ? 'SERVICE OVERDUE' : 'OK'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${serviceDue ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${Math.min(100, (kmSinceService / 5000) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-2">
                  <button className="flex-1 btn-outline py-2 text-xs flex items-center justify-center gap-2 bg-white">
                    <Fuel className="w-3.5 h-3.5" />
                    Fuel Log
                  </button>
                  <button className="flex-1 btn-outline py-2 text-xs flex items-center justify-center gap-2 bg-white">
                    <PenTool className="w-3.5 h-3.5" />
                    Service
                  </button>
                </div>
              </div>

              {/* Decorative side accent */}
              <div className={`absolute top-0 right-0 w-1.5 h-full ${serviceDue ? 'bg-rose-500' : 'bg-slate-200 group-hover:bg-slate-900 transition-colors'}`} />
            </motion.div>
          );
        })}
      </div>

      <div className="erp-card p-6">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <History className="w-5 h-5 text-slate-400" />
          Recent Maintenance Logs
        </h3>
        <div className="space-y-4">
          {[
            { id: 1, v: 'SWT-1234', type: 'Oil Change', cost: 8500, date: '2024-03-20', km: 40000 },
            { id: 2, v: 'SWT-5678', type: 'Tire Replacement', cost: 24000, date: '2024-03-15', km: 12000 },
            { id: 3, v: 'SWT-1234', type: 'Brake Pads', cost: 4500, date: '2024-03-10', km: 38000 }
          ].map(log => (
            <div key={log.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                  {log.type.includes('Oil') ? <Gauge className="w-5 h-5 text-blue-500" /> : <PenTool className="w-5 h-5 text-slate-400" />}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{log.type} - {log.v}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{log.date} @ {log.km} KM</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-900">Rs. {log.cost.toLocaleString()}</p>
                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Verified</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
