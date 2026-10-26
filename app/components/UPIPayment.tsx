import { QRCodeSVG } from 'qrcode.react';

export default function UPIPayment({ amount, pharmacyName = "Sanjeevani Pharmacy" }: { amount: number, pharmacyName?: string }) {
  // The standard UPI intent string format
  const upiString = `upi://pay?pa=demo@upi&pn=${encodeURIComponent(pharmacyName)}&am=${amount}&cu=INR`;

  return (
    <div className="flex flex-col items-center p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <p className="text-sm font-bold text-slate-800 dark:text-white mb-4 uppercase tracking-wide">
        Scan to Pay: ₹{amount}
      </p>
      <div className="p-3 bg-white rounded-xl">
        <QRCodeSVG value={upiString} size={160} level="H" />
      </div>
      <p className="text-[11px] text-slate-500 mt-4 flex items-center gap-1">
        Works with GPay, PhonePe, Paytm
      </p>
    </div>
  );
}