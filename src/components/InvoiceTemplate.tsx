import { Printer } from 'lucide-react';

interface OrderItem {
  sku: {
    name: string;
    price_per_case: number;
    price_per_unit: number;
  };
  cases: number;
  units: number;
}

interface QueuedOrder {
  customer: {
    name: string;
    route: string;
  } | null;
  items: OrderItem[];
  total: number;
  invoiceNo: string;
  date: string;
}

export const InvoiceTemplate = ({ order, salesmanName, type }: { order: QueuedOrder, salesmanName: string, type?: string, key?: any }) => (
  <div className="p-8 bg-white text-black font-sans border-b border-dashed border-slate-300 last:border-0 relative h-[140mm] overflow-hidden">
    <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black tracking-tighter text-[#222063] leading-none uppercase">PRIMELINK ENTERPRISES</h1>
          {type && (
            <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-widest text-slate-500">
              {type}
            </span>
          )}
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Swat Hub • Panr, Mingora</p>
      </div>
      <div className="text-right">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Sales Invoice</h2>
        <p className="text-[10px] font-mono mt-0.5">Date: {order.date}</p>
        <p className="text-[10px] font-mono">Invoice #: {order.invoiceNo}</p>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4 mb-4">
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
        <h4 className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Customer</h4>
        <p className="text-sm font-bold text-slate-900">{order.customer?.name || 'CASH CUSTOMER'}</p>
        <p className="text-[10px] text-slate-500">{order.customer?.route || 'Local Swat Route'}</p>
      </div>
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
        <h4 className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Logistics</h4>
        <p className="text-[10px] font-bold text-slate-900">Salesman: {salesmanName}</p>
        <p className="text-[10px] text-slate-500">WH: Mingora Main</p>
      </div>
    </div>

    <table className="w-full mb-4">
      <thead>
        <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
          <th className="p-1.5 text-left text-[9px] uppercase font-black">Description</th>
          <th className="p-1.5 text-right text-[9px] uppercase font-black w-12">Qty</th>
          <th className="p-1.5 text-right text-[9px] uppercase font-black w-16">Rate</th>
          <th className="p-1.5 text-right text-[9px] uppercase font-black w-24">Total</th>
        </tr>
      </thead>
      <tbody>
        {order.items.map((item, idx) => (
          <tr key={idx} className="border-b border-slate-50">
            <td className="p-1.5 text-[11px] font-bold">{item.sku.name}</td>
            <td className="p-1.5 text-right text-[10px] font-mono">
              {item.cases}cs {item.units > 0 && `+ ${item.units}u`}
            </td>
            <td className="p-1.5 text-right text-[10px] font-mono">{item.sku.price_per_case.toLocaleString()}</td>
            <td className="p-1.5 text-right text-[11px] font-black italic">
              Rs. {((item.cases * item.sku.price_per_case) + (item.units * item.sku.price_per_unit)).toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <div className="flex justify-between items-end px-2">
      <div className="flex gap-12 flex-1">
        <div className="text-center pt-2">
          <div className="h-0.5 bg-slate-200 w-24 mx-auto mb-1" />
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-300 italic">Signature</p>
        </div>
        <div className="text-center pt-2">
          <div className="h-0.5 bg-slate-200 w-24 mx-auto mb-1" />
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-300 italic">Stamp</p>
        </div>
      </div>
      <div className="w-48 bg-slate-900 text-white p-3 rounded-lg text-right">
        <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">Total Payable</p>
        <p className="text-lg font-black italic">Rs. {order.total.toLocaleString()}</p>
      </div>
    </div>
  </div>
);
