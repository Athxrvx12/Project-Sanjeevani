'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Inquiry {
  id: string;
  medicine_query: string; // Now holds our JSON payload!
  status: string;
  created_at: string;
  pharmacy_id: string;
}

export default function PharmacistDashboard() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  
  // NEW: Toaster Notification State
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  const triggerToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 4000); // Hides after 4 seconds
  };

  useEffect(() => {
    const fetchPending = async () => {
      const { data } = await supabase
        .from('inquiries')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (data) setInquiries(data);
    };

    fetchPending();

    const channel = supabase
      .channel('pharmacist-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inquiries' }, (payload) => {
        // ... (Your existing code that adds the new ping to the screen) ...
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inquiries' }, (payload) => {
        // NEW: Listen for patient cancellations!
        if (payload.new.status === 'cancelled') {
          // 1. Remove it from the pharmacist's screen
          setInquiries((prev) => prev.filter((inquiry) => inquiry.id !== payload.new.id));
          
          // 2. Alert the pharmacist so they can put the medicine back on the shelf
          alert("A patient cancelled their reservation. You can release the stock.");
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // SAFE PARSER: Handles both new JSON payloads and old test strings so your app doesn't crash
  const parsePayload = (queryStr: string) => {
    try {
      const parsed = JSON.parse(queryStr);
      if (parsed.medicines) return parsed;
      throw new Error("Old format");
    } catch {
      return { 
        medicines: [{ name: queryStr, status: 'pending' }], 
        eta_minutes: 'N/A', 
        patient_distance: 'Unknown' 
      };
    }
  };

  // TOGGLE INDIVIDUAL MEDICINE
  // TOGGLE INDIVIDUAL MEDICINE
  const toggleMedicineStock = (inquiryId: string, medIndex: number) => {
    setInquiries(current => current.map(inq => {
      if (inq.id === inquiryId) {
        const payload = parsePayload(inq.medicine_query);
        const currentStatus = payload.medicines[medIndex].status;
        
        // FIX: A single click immediately marks it out of stock, another click brings it back
        payload.medicines[medIndex].status = (currentStatus === 'out_of_stock') ? 'in_stock' : 'out_of_stock';
        
        return { ...inq, medicine_query: JSON.stringify(payload) };
      }
      return inq;
    }));
  };
  // SUBMIT FINAL RESPONSE TO PATIENT
  const submitResponse = async (inq: Inquiry) => {
    const payload = parsePayload(inq.medicine_query);
    
    payload.medicines = payload.medicines.map((m: any) => ({
      ...m,
      status: m.status === 'pending' ? 'in_stock' : m.status
    }));

    // 1. Optimistic UI update & Toast
    setInquiries(current => current.filter(i => i.id !== inq.id));
    triggerToast(`✅ Response sent! Patient notified for Order #${inq.id.split('-')[0]}`);

    // 2. Update Database with ERROR LOGGING
    const { data, error } = await supabase
      .from('inquiries')
      .update({ 
        status: 'responded', 
        medicine_query: JSON.stringify(payload) 
      })
      .eq('id', inq.id)
      .select(); // Ask Supabase to return the updated data

    if (error) {
      console.error("❌ SUPABASE UPDATE ERROR:", error);
      alert(`Database Error: ${error.message}`);
    } else {
      console.log("✅ SUPABASE UPDATE SUCCESS:", data);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-sky-200 selection:text-sky-900 font-sans flex flex-col relative overflow-x-hidden">
      
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-md border-b border-white/20 shadow-sm transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-400 flex items-center justify-center text-white font-bold text-xl shadow-md">+</div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">Sanjeevani</span>
          </div>
          <div className="hidden md:flex gap-8 text-sm font-medium text-slate-600">
            <a href="/" className="hover:text-sky-600 transition-colors">Patient Map</a>
            <a href="#" className="text-sky-600 font-bold transition-colors">Pharmacist Portal</a>
          </div>
        </div>
      </nav>

      {/* DASHBOARD CONTENT */}
      <main className="flex-grow pt-28 pb-16 px-4 md:px-8 flex flex-col items-center z-10">
        <div className="max-w-4xl w-full space-y-8">
          
          <header className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-white flex justify-between items-center relative z-20">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Pharmacist Console</h1>
              <p className="text-slate-500 font-medium mt-1">Manage incoming critical medicine requests.</p>
            </div>
            <div className="flex items-center gap-3 bg-emerald-50 px-5 py-2.5 rounded-full border border-emerald-100 shadow-sm">
              <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>
              <span className="text-sm font-bold text-emerald-700 uppercase tracking-wide">System Live</span>
            </div>
          </header>

          <div className="space-y-6">
            {inquiries.length === 0 ? (
              <div className="text-center p-16 bg-white/60 backdrop-blur-md rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-sky-50 rounded-full flex items-center justify-center text-3xl animate-bounce">📡</div>
                <div>
                  <h3 className="text-xl font-bold text-slate-700">Listening for nearby patients...</h3>
                  <p className="text-slate-500 mt-1">New requests will appear here instantly.</p>
                </div>
              </div>
            ) : (
              inquiries.map((inq) => {
                const payload = parsePayload(inq.medicine_query);
                
                return (
                  <div key={inq.id} className="bg-white p-6 rounded-2xl shadow-md border-l-[6px] border-sky-500 flex flex-col gap-6 animate-in slide-in-from-top-4">
                    
                    {/* Header: ETA & Distance */}
                    <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="px-3 py-1 bg-rose-100 text-rose-700 text-xs font-extrabold uppercase rounded-md animate-pulse">Urgent Request</span>
                          <span className="text-xs text-slate-400 font-medium">ID: {inq.id.split('-')[0]}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-600 mt-2">
                          Patient is <span className="text-sky-600">{payload.patient_distance}</span> away. 
                          Expected arrival: <span className="text-emerald-600 text-lg">~{payload.eta_minutes} mins</span>
                        </p>
                      </div>
                    </div>

                    {/* Body: Medicine Checklist */}
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Requested Items (Click to toggle stock)</p>
                      {payload.medicines.map((med: any, index: number) => {
                        // We assume it's in stock by default to save pharmacist clicks, unless they toggle it off.
                        const inStock = med.status !== 'out_of_stock'; 
                        
                        return (
                          <div 
                            key={index}
                            onClick={() => toggleMedicineStock(inq.id, index)}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center group ${inStock ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}
                          >
                            <span className={`font-bold text-lg ${inStock ? 'text-emerald-900' : 'text-slate-500 line-through'}`}>
                              {med.name}
                            </span>
                            <span className={`text-sm font-bold px-3 py-1 rounded-md ${inStock ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>
                              {inStock ? '✓ In Stock' : '❌ Out of Stock'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Footer: Submit Button */}
                    <div className="pt-2">
                      <button 
                        onClick={() => submitResponse(inq)}
                        className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-sky-600 active:scale-95 transition-all text-lg"
                      >
                        Send Status & Accept Reservation
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* THE TOASTER NOTIFICATION */}
      {toast.show && (
        <div className="fixed bottom-8 right-8 z-[9999] animate-in slide-in-from-bottom-8 fade-in duration-300">
          <div className="bg-slate-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700">
            <span className="text-xl">🚀</span>
            <span className="font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

    </div>
  );
}