import React from 'react';

interface LoadingItem {
  id: number;
  name: string;
  category: string;
  cases: number;
  units: number;
}

export const LoadingSheetTemplate = ({ items, date }: { items: LoadingItem[], date: string }) => (
  <div className="p-4 bg-white text-black font-sans printing-page">
    <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
      <h1 className="text-2xl font-black uppercase tracking-tighter">Warehouse Loading Sheet</h1>
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Primelink Enterprises • Daily Dispatch Summary</p>
      <p className="text-sm font-bold mt-2">Date: {date}</p>
    </div>

    <div className="mb-6 grid grid-cols-2 gap-4">
      <div className="border border-slate-200 p-3 rounded">
        <p className="text-[10px] font-black uppercase text-slate-400">Warehouse Source</p>
        <p className="font-bold text-slate-900">Panr Distribution Hub</p>
      </div>
      <div className="border border-slate-200 p-3 rounded">
        <p className="text-[10px] font-black uppercase text-slate-400">Total Lines</p>
        <p className="font-bold text-slate-900">{items.length} Products</p>
      </div>
    </div>

    <table className="w-full border-collapse border border-slate-900">
      <thead>
        <tr className="bg-slate-900 text-white text-[10px] font-black uppercase">
          <th className="border border-slate-900 p-2 w-12">Sr#</th>
          <th className="border border-slate-900 p-2 text-left">Product / SKU Name</th>
          <th className="border border-slate-900 p-2 w-24">Total Cases</th>
          <th className="border border-slate-900 p-2 w-24">Loose Units</th>
          <th className="border border-slate-900 p-2 w-32">Checked (Initial)</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => (
          <tr key={idx} className="border-b border-slate-300">
            <td className="border-x border-slate-900 p-2 text-center font-bold">{idx + 1}</td>
            <td className="border-x border-slate-900 p-2 uppercase font-black">{item.name}</td>
            <td className="border-x border-slate-900 p-2 text-center text-lg font-black">{item.cases}</td>
            <td className="border-x border-slate-900 p-2 text-center text-lg font-black">{item.units}</td>
            <td className="border-x border-slate-900 p-2">
              <div className="w-full h-8 border-b border-dotted border-slate-300"></div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <div className="mt-12 grid grid-cols-3 gap-8">
      <div className="text-center">
        <div className="border-t-2 border-slate-900 pt-2">
          <p className="text-[10px] font-black uppercase">Warehouse In-Charge</p>
        </div>
      </div>
      <div className="text-center">
        <div className="border-t-2 border-slate-900 pt-2">
          <p className="text-[10px] font-black uppercase">Loading Supervisor</p>
        </div>
      </div>
      <div className="text-center">
        <div className="border-t-2 border-slate-900 pt-2">
          <p className="text-[10px] font-black uppercase">Driver / Receiver</p>
        </div>
      </div>
    </div>

    <div className="mt-12 p-4 bg-slate-50 border border-slate-200 rounded-xl">
      <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2">Important Instructions</h3>
      <ul className="text-[9px] font-bold text-slate-600 space-y-1 list-disc pl-4">
        <li>Double check the case count before vehicle exits the hub.</li>
        <li>Ensure expiry dates are verified for all loose units.</li>
        <li>Loading sheet must be signed by three authorities.</li>
      </ul>
    </div>
  </div>
);
