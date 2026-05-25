import { Printer } from 'lucide-react';

interface SKU {
  name: string;
  price_per_case: number;
  price_per_unit: number;
  units_per_case?: number;
  batch_number?: string;
  expiry_date?: string;
}

interface OrderItem {
  sku: SKU;
  cases: number;
  units: number;
}

interface QueuedOrder {
  customer: {
    name: string;
    route: string;
    contact?: string;
  } | null;
  items: OrderItem[];
  total: number;
  invoiceNo: string;
  date: string;
  orderBooker?: string;
  deliveryMan?: string;
  is_dummy?: number;
}

export const InvoiceTemplate = ({ order, salesmanName, type, isUrdu }: { order: QueuedOrder, salesmanName: string, type?: string, key?: any, isUrdu?: boolean }) => {
  const isDummy = order.is_dummy === 1 || order.invoiceNo?.startsWith('DUMMY');

  return (
    <div className={`printing-page ${isUrdu ? 'font-urdu' : ''} ${order.items.length > 12 ? 'scale-95' : ''} relative`}>
      {/* Non-Fiscal Watermark for Dummy Invoices */}
      {isDummy && (
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none rotate-45 z-0 flex-col">
          <h2 className="text-[120px] font-black leading-none uppercase">DUMMY</h2>
          <h3 className="text-[40px] font-black leading-none uppercase">NON-FISCAL RECORD</h3>
        </div>
      )}

      {/* Header Section */}
    <div className="flex justify-between items-start mb-2 px-1">
      <div className="text-left">
        <h1 className="text-base font-black tracking-tighter text-slate-900 leading-none uppercase">PRIMELINK ENTERPRISES</h1>
        <p className="text-[10px] font-black text-slate-900 mt-1">0310-6548820</p>
      </div>
      
      <div className="text-center">
        <h2 className={`text-[12px] font-black uppercase border-b-2 border-slate-900 pb-0.5 ${isUrdu ? 'font-urdu' : ''}`}>
          {type || (isUrdu ? 'سیلز انوائس' : 'SALES INVOICE')}
        </h2>
      </div>

      <div className="text-right">
        <p className="text-[8px] font-black uppercase text-slate-400">{isUrdu ? 'انوائس' : 'Invoice'}: <span className="text-slate-900">#{order.invoiceNo}</span></p>
        <p className="text-[8px] font-black uppercase text-slate-400">{isUrdu ? 'تاریخ' : 'Date'}: <span className="text-slate-900">{order.date}</span></p>
      </div>
    </div>

    {/* Details Section */}
    <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-50 p-2 border border-slate-200 rounded">
      <div className="space-y-0.5">
        <DetailRow label={isUrdu ? 'صارف:' : 'Customer:'} value={order.customer?.name || (isUrdu ? 'نقد گاہک' : 'CASH CUSTOMER')} isBold />
        <DetailRow label={isUrdu ? 'فون:' : 'Contact:'} value={order.customer?.contact || '-'} />
        <DetailRow label={isUrdu ? 'روٹ:' : 'Route:'} value={order.customer?.route || (isUrdu ? 'مقامی سوات' : 'Local Swat')} />
      </div>
      <div className="space-y-0.5 border-l border-slate-200 pl-2">
        <DetailRow label={isUrdu ? 'بکنگ کنندہ:' : 'Order Booker:'} value={order.orderBooker || salesmanName} />
        <DetailRow label={isUrdu ? 'ڈیلیوری کنندہ:' : 'Delivery Man:'} value={order.deliveryMan || "AFM"} />
      </div>
    </div>

    {/* Items Table */}
    <table className="w-full border-collapse border border-slate-900 mb-4 print-compact">
      <thead>
        <tr className="bg-slate-100 text-slate-900 text-[7px] font-black uppercase">
          <th className="border border-slate-900 p-0.5 w-5">#</th>
          <th className="border border-slate-900 p-0.5 text-left">{isUrdu ? 'آئٹم' : 'Product'}</th>
          <th className="border border-slate-900 p-0.5 text-center">{isUrdu ? 'بیچ' : 'Batch'}</th>
          <th className="border border-slate-900 p-0.5 text-center">{isUrdu ? 'ایکسپائری' : 'Expiry'}</th>
          <th className="border border-slate-900 p-0.5 text-center">{isUrdu ? 'پیک سائز' : 'Pk Size'}</th>
          <th className="border border-slate-900 p-0.5 text-right">{isUrdu ? 'یونٹ قیمت' : 'Unit Pr'}</th>
          <th className="border border-slate-900 p-0.5 text-right">{isUrdu ? 'پیک قیمت' : 'Pack Pr'}</th>
          <th className="border border-slate-900 p-0.5 text-center">{isUrdu ? 'مقدار' : 'Qty'}</th>
          <th className="border border-slate-900 p-0.5 text-right">{isUrdu ? 'خالص' : 'Net'}</th>
        </tr>
      </thead>
      <tbody className="text-[8px] text-slate-900">
        {order.items.map((item, idx) => {
          const sku = item.sku || { name: 'Unknown Item', price_per_case: 0, price_per_unit: 0, units_per_case: 1 };
          const pricePerCase = sku.price_per_case || 0;
          const pricePerUnit = sku.price_per_unit || 0;
          const cases = item.cases || 0;
          const units = item.units || 0;
          const gross = (cases * pricePerCase) + (units * pricePerUnit);
          
          return (
            <tr key={idx} className="font-bold border-b border-slate-900">
              <td className="border-x border-slate-900 p-0.5 text-center">{idx + 1}</td>
              <td className="border-x border-slate-900 p-0.5 uppercase text-[7px] leading-tight">{sku.name}</td>
              <td className="border-x border-slate-900 p-0.5 text-center font-mono text-[7px]">{sku.batch_number || '-'}</td>
              <td className="border-x border-slate-900 p-0.5 text-center font-mono text-[7px]">{sku.expiry_date || '-'}</td>
              <td className="border-x border-slate-900 p-0.5 text-center">{sku.units_per_case || '-'}</td>
              <td className="border-x border-slate-900 p-0.5 text-right font-mono">{pricePerUnit.toFixed(1)}</td>
              <td className="border-x border-slate-900 p-0.5 text-right font-mono">{pricePerCase.toFixed(0)}</td>
              <td className="border-x border-slate-900 p-0.5 text-center font-mono">
                {cases > 0 && `${cases}C `}
                {units > 0 && `${units}U`}
                {cases === 0 && units === 0 && '0'}
              </td>
              <td className="border-x border-slate-900 p-0.5 text-right font-black">
                {gross.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>

    {/* Summary Footer Section */}
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="border border-dashed border-slate-300 p-2 rounded bg-slate-50 min-h-[60px] flex flex-col justify-center">
             <p className={`text-[10px] font-urdu font-black text-slate-800 text-center leading-relaxed mb-1`}>
               ایکسپائری صرف ایکسپائری تاریخ سے 3 ماہ قبل اور انوائس بل کے ساتھ قبول کی جائے گی
             </p>
             <p className="text-[6px] text-slate-400 font-bold text-center uppercase">Expiry will accept only 3 months from expiry date with bill</p>
        </div>
        <p className={`text-[7px] text-slate-500 italic font-bold ${isUrdu ? 'font-urdu' : ''}`}>
          {isUrdu ? '"آپ کے کاروبار کا شکریہ۔ برائے مہربانی سیلز مین کے جانے سے پہلے سٹاک چیک کر لیں۔"' : '"Thank you for your business. Please check stock before salesman leaves."'}
        </p>
      </div>

      <div className="relative">
        <div className="border border-slate-900 overflow-hidden rounded">
          <SummaryRow label={isUrdu ? 'کل واجب الادا:' : 'Total Payable:'} value={order.total} isFinal />
        </div>
        
        {/* Signature Line for Primelink Enterprises */}
        <div className="mt-4 border-t border-slate-900 pt-1 text-center">
          <p className="text-[8px] font-black uppercase text-slate-900">For: Primelink Enterprises</p>
          <div className="h-6"></div>
          <p className={`text-[7px] font-bold uppercase text-slate-500 mt-1 ${isUrdu ? 'font-urdu' : ''}`}>{isUrdu ? 'مجاز دستخط' : 'Authorized Signature'}</p>
        </div>
      </div>
    </div>
    </div>
  );
};

const DetailRow = ({ label, value, isBold, isRed }: { label: string, value: string | undefined, isBold?: boolean, isRed?: boolean }) => (
  <div className="flex gap-1 items-start text-[8px]">
    <span className={`w-20 font-black uppercase text-slate-500 shrink-0 ${isRed ? 'text-rose-600' : ''}`}>{label}</span>
    <span className={`font-mono border-b border-slate-100 flex-1 ${isBold ? 'font-black text-[10px] text-slate-900' : 'text-slate-700'}`}>{value || ''}</span>
  </div>
);

const SummaryRow = ({ label, value, isFinal }: { label: string, value: number, isFinal?: boolean }) => (
  <div className={`flex justify-between p-2 border-b border-slate-900 last:border-0 ${isFinal ? 'bg-slate-50' : ''}`}>
    <span className={`text-[10px] font-black uppercase ${isFinal ? 'text-slate-900' : 'text-slate-600'}`}>{label}</span>
    <span className={`font-mono text-xs ${isFinal ? 'font-black text-lg' : 'font-bold'}`}>
      {value.toLocaleString(undefined, {minimumFractionDigits: 2})}
    </span>
  </div>
);

