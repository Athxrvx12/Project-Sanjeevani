'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import ThemeToggle from '../components/ThemeToggle';
import toast from 'react-hot-toast';
import { Activity, CheckCircle2, XCircle, Send, Clock, MapPin, AlertCircle, ShieldCheck, Menu, X } from 'lucide-react';
import UPIPayment from '../components/UPIPayment';
import { Radar } from 'lucide-react';

type Medicine = { name: string; status: 'pending' | 'in_stock' | 'out_of_stock' };
type Payload = { medicines: Medicine[]; eta_minutes: number; patient_distance: string };
type Inquiry = { id: string; pharmacy_id: string; medicine_query: string; status: string; created_at: string };
type ParsedInquiry = Inquiry & { parsedQuery: Payload };

// Set this to the ID your patient portal map uses for the demo (e.g., Apollo Pharmacy's OSM ID)
const DEMO_PHARMACY_ID = 'osm-459201'; 

export default function PharmacistDashboard() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [inquiries, setInquiries] = useState<ParsedInquiry[]>([]);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  useEffect(() => {
    const fetchInquiries = async () => {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .eq('status', 'pending')
        // Removed the strict DEMO_PHARMACY_ID filter to catch all map pings
        .order('created_at', { ascending: false });

      if (data) {
        const parsedData = data.map(item => ({
          ...item,
          parsedQuery: JSON.parse(item.medicine_query)
        }));
        setInquiries(parsedData);
      }
    };
    fetchInquiries();

    const channel = supabase
      .channel(`pharmacist-demo-secure`)
      .on('postgres_changes', 
        // Removed the filter here to catch live WebSockets from any clicked pharmacy
        { event: 'INSERT', schema: 'public', table: 'inquiries' }, 
        (payload) => {
          if (payload.new.status === 'pending') {
            const newInquiry = {
              ...payload.new,
              parsedQuery: JSON.parse(payload.new.medicine_query)
            } as ParsedInquiry;
            setInquiries(prev => [newInquiry, ...prev]);
            toast.success("🚨 New Emergency Ping received!");
          }
      })
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'inquiries' }, 
        (payload) => {
          if (payload.new.status === 'cancelled') {
            setInquiries(prev => prev.filter(inq => inq.id !== payload.new.id));
            toast.error("A patient cancelled their request. Release the stock.", { icon: '⚠️' });
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const toggleMedicineStatus = (inquiryId: string, medIndex: number, newStatus: 'in_stock' | 'out_of_stock') => {
    setInquiries(prev => prev.map(inq => {
      if (inq.id === inquiryId) {
        const updatedMeds = [...inq.parsedQuery.medicines];
        updatedMeds[medIndex].status = newStatus;
        return { ...inq, parsedQuery: { ...inq.parsedQuery, medicines: updatedMeds } };
      }
      return inq;
    }));
  };

  const sendResponse = async (inquiry: ParsedInquiry) => {
    const unhandledItems = inquiry.parsedQuery.medicines.filter(m => m.status === 'pending');
    if (unhandledItems.length > 0) {
      toast.error("Please mark all items as In-Stock or Out-of-Stock before sending.");
      return;
    }

    setIsProcessing(inquiry.id);
    const finalQueryString = JSON.stringify(inquiry.parsedQuery);

    const { error } = await supabase
      .from('inquiries')
      .update({ status: 'responded', medicine_query: finalQueryString })
      .eq('id', inquiry.id);

    if (error) {
      toast.error("Security Rejection: Failed to send response.");
    } else {
      toast.success("Response sent! Patient notified.");
      setInquiries(prev => prev.filter(inq => inq.id !== inquiry.id));
    }
    setIsProcessing(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-50 transition-colors duration-300 font-sans pb-20">
      <nav className="fixed top-0 w-full z-50 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg"
                   style={{ background: 'linear-gradient(135deg, #8b5cf6, #d946ef)', boxShadow: '0 0 20px rgba(139,92,246,0.4)' }}>
                <Radar size={20} strokeWidth={2.5} />
              </div>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Rx Radar</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 text-[10px] font-bold uppercase tracking-wider border border-purple-200 dark:border-purple-500/30">Pharmacist View</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-mono border border-slate-200 dark:border-slate-700">Demo ID: osm-459201</span>
            </div>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="/" className="text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 transition-colors">← Back to Patient Map</a>
            <div className="pl-6 border-l border-slate-200 dark:border-slate-800">
              <ThemeToggle />
            </div>
          </div>

          <div className="md:hidden flex items-center gap-4">
            <ThemeToggle />
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl py-4 px-6 flex flex-col gap-4 animate-in slide-in-from-top-2">
            <a href="/" className="w-full py-3 bg-slate-50 dark:bg-slate-800 text-center text-slate-600 dark:text-slate-300 rounded-xl font-bold">
              ← Back to Patient Map
            </a>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-32">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight">Active Inquiries</h2>
          <div className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-full text-sm font-bold shadow-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            Live 
          </div>
        </div>

        {inquiries.length === 0 ? (
          <div className="w-full h-[50vh] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white/50 dark:bg-slate-900/20 backdrop-blur-sm">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-emerald-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
              <Activity size={64} className="text-slate-300 dark:text-slate-700 relative z-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-500 dark:text-slate-400 mb-2">Awaiting Emergency Pings</h3>
            <p className="text-slate-400 dark:text-slate-500 max-w-sm text-center">Place this window next to the patient portal map and click "Ping" to see instant WebSocket synchronization.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {inquiries.map((inquiry) => (
              <div key={inquiry.id} className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-all duration-300 hover:shadow-2xl hover:border-sky-200 dark:hover:border-sky-900/50 animate-in fade-in slide-in-from-bottom-4">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex justify-between items-start">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 mb-3 uppercase tracking-wider">
                      <AlertCircle size={14}/> Action Required
                    </span>
                    <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                      <span className="flex items-center gap-1.5"><Clock size={16} className="text-sky-500"/> ETA: {inquiry.parsedQuery.eta_minutes} mins</span>
                      <span className="flex items-center gap-1.5"><MapPin size={16} className="text-rose-400"/> {inquiry.parsedQuery.patient_distance} away</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Order ID</p>
                    <p className="text-sm font-mono text-slate-900 dark:text-slate-300">{inquiry.id.split('-')[0]}</p>
                  </div>
                </div>

                <div className="p-6 flex-grow space-y-4">
                  <p className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Requested Items</p>
                  {inquiry.parsedQuery.medicines.map((med, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <span className="font-semibold text-lg text-slate-800 dark:text-slate-200">{med.name}</span>
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <button onClick={() => toggleMedicineStatus(inquiry.id, index, 'in_stock')} className={`flex-1 sm:flex-none flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${med.status === 'in_stock' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 shadow-inner' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                          <CheckCircle2 size={18} /> In Stock
                        </button>
                        
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                        <button onClick={() => toggleMedicineStatus(inquiry.id, index, 'out_of_stock')} className={`flex-1 sm:flex-none flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${med.status === 'out_of_stock' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 shadow-inner' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                          <XCircle size={18} /> Out of Stock
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-6 pt-0">
                  <button onClick={() => sendResponse(inquiry)} disabled={isProcessing === inquiry.id} className="w-full py-4 rounded-xl bg-slate-900 dark:bg-sky-500 hover:bg-black dark:hover:bg-sky-600 text-white font-bold text-lg flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                    {isProcessing === inquiry.id ? <span className="animate-pulse">Verifying Security...</span> : <><Send size={20} /> Reply to Patient</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}