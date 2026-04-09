'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import ThemeToggle from '../components/ThemeToggle';
import toast from 'react-hot-toast';
import { Activity, CheckCircle2, XCircle, Send, Clock, MapPin, AlertCircle, Lock, ShieldCheck, Mail, Key, UserPlus, LogIn } from 'lucide-react';

type Medicine = { name: string; status: 'pending' | 'in_stock' | 'out_of_stock' };
type Payload = { medicines: Medicine[]; eta_minutes: number; patient_distance: string };
type Inquiry = { id: string; pharmacy_id: string; medicine_query: string; status: string; created_at: string };
type ParsedInquiry = Inquiry & { parsedQuery: Payload };

export default function PharmacistDashboard() {
  // --- TRUE AUTHENTICATION STATE ---
  const [session, setSession] = useState<any>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [facilityId, setFacilityId] = useState(''); // Only used for Sign Up
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // --- DASHBOARD STATE ---
  const [inquiries, setInquiries] = useState<ParsedInquiry[]>([]);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [pharmacyProfile, setPharmacyProfile] = useState<string | null>(null);

  // 1. CHECK FOR EXISTING LOGIN ON LOAD
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. FETCH THE LINKED FACILITY ID
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('pharmacy_profiles')
      .select('osm_id')
      .eq('id', userId)
      .single();
    
    if (data) setPharmacyProfile(data.osm_id);
  };

  // 3. SECURE LOGIN & REGISTRATION LOGIC
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);

    try {
      if (isSignUp) {
        if (!facilityId.trim()) {
          toast.error("Facility ID is required for registration.");
          return;
        }

        // Step A: Create User
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;

        // Step B: Link User to Facility ID in the secure table
        if (authData.user) {
          const { error: profileError } = await supabase
            .from('pharmacy_profiles')
            .insert([{ id: authData.user.id, osm_id: facilityId }]);
          
          if (profileError) throw profileError;
          toast.success("Registration successful! You are now securely logged in.");
        }
      } else {
        // Just Log In
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Secure login successful.");
      }
    } catch (error: any) {
      toast.error(error.message || "Authentication failed.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setInquiries([]);
    setPharmacyProfile(null);
    toast.success("Logged out securely.");
  };

  // 4. SECURE DATA FETCHING (Protected by RLS!)
  useEffect(() => {
    if (!session || !pharmacyProfile) return;

    // Because of RLS, this will ONLY return data belonging to this specific pharmacy
    const fetchInquiries = async () => {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .eq('status', 'pending')
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
      .channel(`pharmacist-secure`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'inquiries', filter: `pharmacy_id=eq.${pharmacyProfile}` }, 
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
        { event: 'UPDATE', schema: 'public', table: 'inquiries', filter: `pharmacy_id=eq.${pharmacyProfile}` }, 
        (payload) => {
          if (payload.new.status === 'cancelled') {
            setInquiries(prev => prev.filter(inq => inq.id !== payload.new.id));
            toast.error("A patient cancelled their request. Release the stock.", { icon: '⚠️' });
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session, pharmacyProfile]);

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

    // Because of RLS, this update will ONLY succeed if the user owns this row
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

  // =========================================================================
  // VIEW 1: TRUE AUTHENTICATION GATEWAY
  // =========================================================================
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex flex-col items-center justify-center p-4 transition-colors duration-300">
        <div className="absolute top-6 right-6 z-50"><ThemeToggle /></div>
        <a href="/" className="absolute top-6 left-6 z-50 text-slate-500 hover:text-sky-600 font-medium">← Back to Map</a>
        
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sky-500 to-emerald-400"></div>
          
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-slate-200 dark:border-slate-700">
            <Lock className="text-sky-600 dark:text-sky-400" size={32} />
          </div>
          
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">Pharmacist Portal</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            {isSignUp ? "Register your facility to start receiving live orders." : "Authorized personnel only. Secure login."}
          </p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="email" 
                required
                placeholder="Official Email" 
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none text-slate-900 dark:text-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="password" 
                required
                placeholder="Password" 
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none text-slate-900 dark:text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {isSignUp && (
              <div className="relative animate-in fade-in slide-in-from-top-2">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  required
                  placeholder="Facility ID (e.g., osm-12345)" 
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-emerald-200 dark:border-emerald-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-slate-900 dark:text-white font-mono"
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                />
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 ml-1">This permanently links your account to a map location.</p>
              </div>
            )}

            <button type="submit" disabled={isAuthenticating} className="w-full py-4 mt-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:bg-black dark:hover:bg-slate-200 transition-colors flex justify-center items-center gap-2">
              {isAuthenticating ? "Authenticating..." : isSignUp ? <><UserPlus size={20} /> Register Facility</> : <><LogIn size={20} /> Secure Login</>}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm font-bold text-sky-600 dark:text-sky-400 hover:underline">
              {isSignUp ? "Already registered? Log in here." : "New pharmacy? Register your facility."}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: THE SECURE DASHBOARD
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-50 transition-colors duration-300 font-sans pb-20">
      <nav className="fixed top-0 w-full z-50 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-md">
              <ShieldCheck size={24} className="text-emerald-400 dark:text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Rx Radar</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide flex items-center gap-1">
                Verified: {pharmacyProfile?.substring(0, 12)}...
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-sm font-medium">
            <button onClick={handleLogout} className="text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors">Sign Out</button>
            <div className="pl-6 border-l border-slate-200 dark:border-slate-800">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-32">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight">Active Inquiries</h2>
          <div className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-full text-sm font-bold shadow-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            Encrypted & Live
          </div>
        </div>

        {inquiries.length === 0 ? (
          <div className="w-full h-[50vh] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white/50 dark:bg-slate-900/20 backdrop-blur-sm">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-emerald-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
              <Activity size={64} className="text-slate-300 dark:text-slate-700 relative z-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-500 dark:text-slate-400 mb-2">Awaiting Emergency Pings</h3>
            <p className="text-slate-400 dark:text-slate-500 max-w-sm text-center">Your portal is cryptographically secured. Only data intended for your facility will appear here.</p>
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