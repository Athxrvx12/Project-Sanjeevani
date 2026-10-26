'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ThemeToggle from './components/ThemeToggle';
import AIChatbot from './components/AIChatbot';
import { Mail, Search, Zap, Scan, MapPin, Activity, Sparkles, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import UPIPayment from './components/UPIPayment';

const DynamicMap = dynamic(() => import('./components/Map'), { ssr: false });

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface ScannedMed { medicine: string; dosage: string; }
interface MedSummary  { medicine: string; dosage: string; plain_english: string; }

// ─────────────────────────────────────────────
// AI HELPER — Prescription plain-English summary
// ─────────────────────────────────────────────
async function fetchPrescriptionSummary(meds: ScannedMed[]): Promise<MedSummary[]> {
  const medList = meds.map(m => `${m.medicine} ${m.dosage}`).join(', ');

  const response = await fetch('http://localhost:8000/api/explain-meds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medicines: medList }),
  });

  if (!response.ok) throw new Error('Summary API failed');
  const data = await response.json();
  const cleaned = data.result.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as MedSummary[];
}

// ─────────────────────────────────────────────
// AI HELPER — Explain Medicines
// ─────────────────────────────────────────────
async function getMedicineExplanations(medList: string): Promise<MedSummary[]> {
  const response = await fetch('http://localhost:8000/api/explain-meds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medicines: medList }),
  });

  if (!response.ok) throw new Error('Explain API failed');
  const data = await response.json();
  
  const raw = data.result ?? '[]';
  const cleaned = raw.replace(/```json|```/g, '').trim();
  
  return JSON.parse(cleaned) as MedSummary[];
}

// ─────────────────────────────────────────────
// AI HELPER — Normalize / autocorrect medicine names
// ─────────────────────────────────────────────
async function normalizeMedicineNames(raw: string): Promise<string> {
  const response = await fetch('http://localhost:8000/api/normalize-meds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medicines: raw }),
  });

  if (!response.ok) throw new Error('Normalize API failed');
  const data = await response.json();
  
  return data.result ?? raw;
}

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────
export default function Home() {
  const [selectedMeds, setSelectedMeds]     = useState<string[]>([]);
  const [manualInput, setManualInput]       = useState('');
  const [isScanning, setIsScanning]         = useState(false);
  const [scannedMeds, setScannedMeds]       = useState<ScannedMed[]>([]);
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  const [medSummaries, setMedSummaries]     = useState<MedSummary[]>([]);
  const [isSummarizing, setIsSummarizing]   = useState(false);
  const [isNormalizing, setIsNormalizing]   = useState(false);
  const normalizeTimerRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mousePosition, setMousePosition]   = useState({ x: 0, y: 0 });
  const [glowVisible, setGlowVisible]       = useState(false);

  const [mapCenter, setMapCenter]           = useState<[number, number]>([19.0760, 72.8777]);
  const [locationQuery, setLocationQuery]   = useState('');
  const [isLocating, setIsLocating]         = useState(false);
  const [heroVisible, setHeroVisible]       = useState(false);
  const [consoleVisible, setConsoleVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setHeroVisible(true), 100);
    const t2 = setTimeout(() => setConsoleVisible(true), 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => setMousePosition({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', fn);
    return () => window.removeEventListener('mousemove', fn);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScannedMeds([]);
    setSelectedMeds([]);
    setMedSummaries([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/scan-prescription', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Server error');

      const parsedData: ScannedMed[] = JSON.parse(data.extracted_data);

      if (parsedData && parsedData.length > 0) {
        setScannedMeds(parsedData);
        const allMeds = parsedData.map(m => `${m.medicine} ${m.dosage}`);
        setSelectedMeds(allMeds);

        setIsSummarizing(true);
        fetchPrescriptionSummary(parsedData)
          .then(summaries => setMedSummaries(summaries))
          .catch(() => {})
          .finally(() => setIsSummarizing(false));

      } else {
        toast.error('No readable medicine found in the image. Please try a clearer photo.');
      }
    } catch (error: any) {
      if (error.message.includes('503') || error.message.includes('high demand')) {
        toast.error("Google's AI servers are currently busy. Please try again or type the medicine manually!");
      } else {
        toast.error(`Scan failed: ${error.message}`);
      }
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleMed = (medString: string) => {
    setSelectedMeds(prev =>
      prev.includes(medString) ? prev.filter(m => m !== medString) : [...prev, medString]
    );
  };

  const handleManualSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManualInput(value);

    if (value.trim() !== '') {
      const rawItems = value.split(',').map(i => i.trim()).filter(i => i.length > 0);
      setSelectedMeds(rawItems);

      if (normalizeTimerRef.current) clearTimeout(normalizeTimerRef.current);
      normalizeTimerRef.current = setTimeout(async () => {
        if (value.trim().length < 3) return;
        try {
          setIsNormalizing(true);
          const normalized = await normalizeMedicineNames(value);
          if (normalized && normalized !== value) {
            setManualInput(normalized);
            const normalizedItems = normalized.split(',').map((i: string) => i.trim()).filter((i: string) => i.length > 0);
            setSelectedMeds(normalizedItems);
          }
        } catch {
        } finally {
          setIsNormalizing(false);
        }
      }, 1500);
    } else {
      setSelectedMeds([]);
      if (normalizeTimerRef.current) clearTimeout(normalizeTimerRef.current);
    }
  };

  const handleTeleport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!locationQuery.trim()) return;
    setIsLocating(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      } else {
        toast.error("Location not found. Try adding a city name, e.g., 'Goregaon, Mumbai'.");
      }
    } catch {
      toast.error('Error finding location.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleGPSLocate = () => {
    if ('geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        pos => { setMapCenter([pos.coords.latitude, pos.coords.longitude]); setIsLocating(false); },
        ()  => { toast.error('Could not get your location. Please check browser permissions.'); setIsLocating(false); }
      );
    } else {
      toast.error('Geolocation is not supported by your browser.');
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animated-gradient-text {
          background: linear-gradient(270deg, #38bdf8, #34d399, #06b6d4, #10b981, #67e8f9);
          background-size: 300% 300%;
          animation: gradientShift 5s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        @keyframes floatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(30px, -20px) scale(1.05); }
          66%      { transform: translate(-20px, 15px) scale(0.97); }
        }
        .orb { animation: floatOrb 12s ease-in-out infinite; }
        .orb-delay { animation-delay: -5s; }

        @keyframes scanline {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 0.4; }
          90%  { opacity: 0.4; }
          100% { transform: translateY(200%); opacity: 0; }
        }
        .scanline-anim { animation: scanline 3s ease-in-out infinite; animation-delay: 1s; }

        @keyframes pulsering {
          0%  { transform: scale(1);   opacity: 0.8; }
          70% { transform: scale(1.8); opacity: 0; }
          100%{ transform: scale(1);   opacity: 0; }
        }
        .pulse-ring::before {
          content: ''; position: absolute; inset: 0; border-radius: 9999px;
          border: 2px solid #34d399; animation: pulsering 1.8s ease-out infinite;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up  { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both; }
        .delay-1  { animation-delay: 0.15s; }
        .delay-2  { animation-delay: 0.30s; }
        .delay-3  { animation-delay: 0.45s; }

        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-inner { animation: ticker 24s linear infinite; }

        .glow-border { box-shadow: 0 0 0 1px rgba(56,189,248,0.3), 0 0 20px rgba(56,189,248,0.1); }
        .glow-border:hover { box-shadow: 0 0 0 1px rgba(56,189,248,0.55), 0 0 30px rgba(56,189,248,0.18); }
        .glow-border-green { box-shadow: 0 0 0 1px rgba(52,211,153,0.3), 0 0 20px rgba(52,211,153,0.12); }

        .btn-teleport {
          background: linear-gradient(135deg, #0ea5e9, #06b6d4);
          box-shadow: 0 4px 20px rgba(14,165,233,0.35);
          transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .btn-teleport:hover { background: linear-gradient(135deg,#38bdf8,#22d3ee); box-shadow: 0 6px 30px rgba(14,165,233,0.55); transform: translateY(-2px) scale(1.03); }
        .btn-teleport:active { transform: scale(0.97); }

        .btn-scan {
          background: linear-gradient(135deg, #059669, #10b981);
          box-shadow: 0 4px 20px rgba(16,185,129,0.35);
          transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .btn-scan:hover { background: linear-gradient(135deg,#10b981,#34d399); box-shadow: 0 6px 30px rgba(16,185,129,0.55); transform: translateY(-2px) scale(1.03); }
        .btn-scan:active { transform: scale(0.97); }

        .btn-gps { transition: all 0.2s ease; }
        .btn-gps:hover { transform: translateY(-1px); }

        .input-glow:focus       { outline: none; border-color: rgba(56,189,248,0.6) !important; box-shadow: 0 0 0 3px rgba(56,189,248,0.12); }
        .input-glow-green:focus { outline: none; border-color: rgba(52,211,153,0.6) !important; box-shadow: 0 0 0 3px rgba(52,211,153,0.12); }

        .stat-chip       { font-size:0.7rem; letter-spacing:0.08em; font-weight:700; text-transform:uppercase; padding:0.3rem 0.75rem; border-radius:9999px; display:inline-flex; align-items:center; gap:0.4rem; }
        .dot-grid { background-image: radial-gradient(circle, rgba(56,189,248,0.12) 1px, transparent 1px); background-size: 32px 32px; }

        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        .shimmer { background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%); background-size:600px 100%; animation: shimmer 1.5s infinite; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="min-h-screen bg-slate-50 dark:bg-[#030c18] selection:bg-sky-300/30 selection:text-sky-900 dark:selection:text-sky-100 relative overflow-x-hidden transition-colors duration-500"
           style={{ fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── AMBIENT ORBS ── */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden>
          <div className="orb absolute top-[-10vh] left-[-5vw] w-[55vw] h-[55vw] rounded-full"
               style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.13) 0%, transparent 70%)' }} />
          <div className="orb orb-delay absolute bottom-[-15vh] right-[-5vw] w-[45vw] h-[45vw] rounded-full"
               style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 dot-grid opacity-40 dark:opacity-40 opacity-20" />
        </div>

        {/* ── CURSOR GLOW ── */}
        <div className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-500 hidden dark:block"
             style={{ opacity: glowVisible ? 1 : 0 }}>
          <div className="absolute w-[28vw] h-[28vw] rounded-full blur-[9rem]"
               style={{ background: 'rgba(14,165,233,0.08)', left: mousePosition.x, top: mousePosition.y, transform: 'translate(-50%,-50%)' }} />
          <div className="absolute w-[22vw] h-[22vw] rounded-full blur-[8rem]"
               style={{ background: 'rgba(16,185,129,0.07)', left: mousePosition.x + 80, top: mousePosition.y + 80, transform: 'translate(-50%,-50%)' }} />
        </div>

        {/* ══ NAVBAR ══ */}
        <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-white/70 dark:bg-[#030c18]/75 backdrop-blur-xl border-b border-slate-200 dark:border-sky-400/10">
          <div className="max-w-7xl mx-auto px-6 h-[4.5rem] flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg relative pulse-ring"
                   style={{ background: 'linear-gradient(135deg, #0ea5e9, #10b981)', boxShadow: '0 0 20px rgba(14,165,233,0.4)' }}>
                <Activity size={20} strokeWidth={2.5} />
              </div>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Sanjeevani</span>
              <span className="stat-chip ml-1 bg-sky-100 dark:bg-sky-400/10 border-sky-200 dark:border-sky-400/20 text-sky-600 dark:text-sky-400">v2.0</span>
            </div>
            <div className="hidden md:flex items-center gap-7 text-sm font-medium">
              {[['How it Works', '#'], ['For Pharmacists', '/pharmacist']].map(([label, href]) => (
                <a key={label} href={href} className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors duration-200 relative group/nav">
                  {label}
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-sky-500 dark:bg-sky-400 group-hover/nav:w-full transition-all duration-300" />
                </a>
              ))}
              <a href="#" onClick={(e) => e.preventDefault()} className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-1.5">
                <Mail size={14} /> Contact
              </a>
              <div className="pl-5 border-l border-slate-200 dark:border-white/10">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </nav>

        {/* ── TICKER ── */}
        <div className="fixed top-[4.5rem] w-full z-40 overflow-hidden py-1.5 bg-sky-50/80 dark:bg-sky-400/5 border-b border-sky-100 dark:border-sky-400/10 backdrop-blur-sm">
          <div className="ticker-inner flex gap-12 whitespace-nowrap w-max text-xs font-semibold tracking-widest uppercase">
            {Array(4).fill(['⚡ Real-time Inventory', '🤖 AI Prescription Scan', '📍 GPS Pharmacy Locator', '💊 Emergency Medicine Search', '✨ Sanjeevani AI Assistant']).flat()
              .map((item, i) => <span key={i} className="text-sky-600/70 dark:text-sky-400/60">{item}</span>)}
          </div>
        </div>

        {/* ══ MAIN ══ */}
        <main
          className="pt-36 pb-24 px-4 md:px-8 flex flex-col items-center relative z-10"
          onMouseEnter={() => setGlowVisible(true)}
          onMouseLeave={() => setGlowVisible(false)}
        >
          <div className="max-w-6xl w-full space-y-14">

            {/* ── HERO ── */}
            <div className={`text-center space-y-6 max-w-4xl mx-auto transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="fade-up flex items-center justify-center gap-2 flex-wrap">
                <span className="stat-chip bg-sky-100 dark:bg-sky-400/10 border-sky-200 dark:border-sky-400/20 text-sky-600 dark:text-sky-400">
                  <Activity size={10} className="inline" /> Live Medical Intelligence
                </span>
                <span className="stat-chip bg-emerald-100 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-400/20 text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse inline-block" /> AI-Powered
                </span>
                <span className="stat-chip bg-purple-100 dark:bg-purple-400/10 border-purple-200 dark:border-purple-400/20 text-purple-600 dark:text-purple-400">
                  <Sparkles size={10} className="inline" /> Sanjeevani AI Inside
                </span>
              </div>

              <h1 className="fade-up delay-1 leading-[1.1] tracking-tight font-extrabold text-[clamp(2.5rem,6vw,5rem)]">
                <span className="text-slate-900 dark:text-white">Find critical medicine</span><br />
                <span className="animated-gradient-text">in seconds, not hours.</span>
              </h1>

              <p className="fade-up delay-2 text-slate-600 dark:text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                Locate verified inventory, scan prescriptions with AI, and ping nearby pharmacists in one click.
              </p>

              <div className="fade-up delay-3 flex flex-wrap items-center justify-center gap-8 pt-2">
                {[{ val: 'Live', label: 'WebSocket Pings' }, { val: 'Geo', label: 'Spatial Routing' }, { val: 'Gemini', label: 'Vision AI' }].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="font-bold text-2xl text-slate-900 dark:text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{s.val}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-widest">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── ACTION CONSOLE ── */}
            <div className={`w-full relative transition-all duration-700 delay-300 ${consoleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="absolute -inset-px rounded-3xl -z-10 hidden dark:block"
                   style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.3), rgba(16,185,129,0.2), rgba(14,165,233,0.1))', filter: 'blur(1px)' }} />
              <div className="relative rounded-3xl p-6 md:p-8 glow-border bg-white/90 dark:bg-[#060e1c]/90 backdrop-blur-2xl border border-slate-200 dark:border-sky-400/15 shadow-xl dark:shadow-none">
                <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                  <div className="scanline-anim absolute left-0 right-0 h-px"
                       style={{ background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)' }} />
                </div>

                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400/70">Command Center</span>
                </div>

                <form onSubmit={handleTeleport} className="flex flex-col md:flex-row gap-3 mb-3">
                  <div className="flex-1 relative">
                    <MapPin size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-500/60 dark:text-sky-400/60 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Where are you? (e.g., Goregaon, Mumbai)"
                      className="input-glow w-full pl-11 pr-36 py-4 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-base font-medium transition-all bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-sky-400/15"
                      value={locationQuery}
                      onChange={e => setLocationQuery(e.target.value)}
                    />
                    <button type="button" onClick={handleGPSLocate}
                            className="btn-gps absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs rounded-lg font-bold flex items-center gap-1.5 bg-sky-100/50 dark:bg-sky-400/10 border border-sky-200 dark:border-sky-400/30 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-400/20">
                      📍 <span className="hidden md:inline">Current GPS</span>
                    </button>
                  </div>
                  <button type="submit" disabled={isLocating}
                          className="btn-teleport px-8 py-4 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-base">
                    <Zap size={17} /> {isLocating ? 'Locating…' : 'Teleport'}
                  </button>
                </form>

                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-sky-200 dark:via-sky-400/15 to-transparent" />
                  <span className="text-xs text-slate-400 dark:text-slate-600 uppercase tracking-widest">then</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-emerald-200 dark:via-emerald-400/15 to-transparent" />
                </div>

                <div className="flex flex-col md:flex-row gap-3">
                  {scannedMeds.length > 0 ? (
                    <div className="flex-1 px-5 py-4 rounded-xl flex items-center gap-3 bg-emerald-50 dark:bg-emerald-400/5 border border-emerald-200 dark:border-emerald-400/20">
                      <span className="text-2xl">✅</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-base">{selectedMeds.length} medicine(s) detected from scan</span>
                    </div>
                  ) : (
                    <div className="flex-1 relative">
                      <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500/60 dark:text-emerald-400/60 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="E.g., Crocin 1 strip, Ascoril 1 bottle..."
                        className="input-glow-green w-full pl-11 pr-12 py-4 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-base font-medium transition-all bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-emerald-400/15"
                        value={manualInput}
                        onChange={handleManualSearch}
                      />
                      {isNormalizing && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                          <div className="spin w-3.5 h-3.5 border-2 rounded-full border-emerald-200 dark:border-emerald-400/30 border-t-emerald-500 dark:border-t-emerald-400" />
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400/70 hidden md:block">AI fixing…</span>
                        </div>
                      )}
                    </div>
                  )}

                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className={`btn-scan px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-white text-base min-w-[160px] ${isScanning ? 'opacity-60 cursor-not-allowed bg-emerald-500/50' : ''}`}
                  >
                    {isScanning
                      ? <><span className="spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Analyzing…</>
                      : <><Scan size={18} /> Scan Rx</>}
                  </button>
                </div>

                {!scannedMeds.length && manualInput.length > 3 && !isNormalizing && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-600 mt-2 ml-1 flex items-center gap-1">
                    <Sparkles size={10} className="text-purple-500/60 dark:text-purple-400/60" />
                    Sanjeevani AI auto-corrects medicine spelling after you stop typing
                  </p>
                )}
              </div>
            </div>

            {/* ── SCANNED MED CHIPS + AI SUMMARY ── */}
            {scannedMeds.length > 0 && (
              <div className="rounded-3xl p-6 md:p-8 glow-border-green bg-white/85 dark:bg-[#060e1c]/85 border border-emerald-200 dark:border-emerald-400/15 backdrop-blur-xl shadow-lg dark:shadow-none">
                <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  Select medicines to locate on map
                </h3>

                <div className="flex flex-wrap gap-3 mb-6">
                  {scannedMeds.map((med, index) => {
                    const medString = `${med.medicine} ${med.dosage}`;
                    const isSelected = selectedMeds.includes(medString);
                    return (
                            <button key={index} onClick={() => toggleMed(medString)}
                              style={isSelected
                                ? { background: 'linear-gradient(135deg, #059669, #10b981)', color: 'white', border: '1px solid rgba(52,211,153,0.5)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)', transform: 'translateY(-1px)' }
                                : { background: 'transparent', border: '1px solid currentColor' }}
                              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${isSelected ? 'text-white border-transparent' : 'text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-white/5'}`}>
                        {isSelected ? '✅' : '○'} {med.medicine} <span className="opacity-70">{med.dosage}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-2xl overflow-hidden border border-purple-200 dark:border-purple-400/15">
                  <div className="px-5 py-3 flex items-center gap-2 bg-purple-50 dark:bg-purple-400/10 border-b border-purple-100 dark:border-purple-400/10">
                    <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400">Sanjeevani AI · Prescription Summary</span>
                    {isSummarizing && (
                      <div className="ml-auto flex items-center gap-1.5 text-[10px] text-purple-500/80 dark:text-purple-400/60">
                        <div className="spin w-3 h-3 border border-purple-300 dark:border-purple-400/30 border-t-purple-600 dark:border-t-purple-400 rounded-full" />
                        Analyzing…
                      </div>
                    )}
                  </div>
                  <div className="p-5 space-y-3 bg-slate-50/50 dark:bg-purple-400/5">
                    {isSummarizing && medSummaries.length === 0 ? (
                      Array(scannedMeds.length).fill(0).map((_, i) => (
                        <div key={i} className="shimmer h-14 rounded-xl bg-slate-200 dark:bg-white/5" />
                      ))
                    ) : medSummaries.length > 0 ? (
                      medSummaries.map((s, i) => (
                        <div key={i} className="flex gap-3 p-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm bg-purple-100 dark:bg-purple-400/15">💊</div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">
                              {s.medicine} <span className="text-slate-500 font-normal">{s.dosage}</span>
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{s.plain_english}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-500 p-2">
                        <AlertCircle size={13} />
                        AI summary unavailable — medicine names detected successfully above.
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500 dark:text-slate-600 pt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      AI summaries are for reference only. Always follow your doctor's prescription.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── MAP ── */}
            <div className="relative group/map">
              <div className="absolute -inset-2 rounded-[2rem] opacity-40 group-hover/map:opacity-70 transition duration-700 pointer-events-none hidden dark:block"
                   style={{ background: 'radial-gradient(ellipse at center, rgba(14,165,233,0.15) 0%, transparent 70%)', zIndex: -1 }} />
              <div className="rounded-[1.6rem] overflow-hidden border border-slate-200 dark:border-sky-400/15 shadow-2xl dark:shadow-[0_30px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(56,189,248,0.07)]">
                <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-[#060e1c]/95 border-b border-slate-200 dark:border-sky-400/10">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                    <span className="ml-3 text-xs text-slate-400 dark:text-slate-500 font-mono">sanjeevani://map · live</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                    {selectedMeds.length > 0 ? `Searching for ${selectedMeds.length} medicine(s)` : 'Awaiting query'}
                  </div>
                </div>
                <DynamicMap selectedMeds={selectedMeds} center={mapCenter} />
              </div>
            </div>

          </div>
        </main>

        {/* ══ AI CHATBOT — always floating ══ */}
        <AIChatbot selectedMeds={selectedMeds} />

      </div>
    </>
  );
}