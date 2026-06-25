'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ThemeToggle from './components/ThemeToggle';
import { Mail, Search, Zap, Scan, MapPin, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

const DynamicMap = dynamic(() => import('./components/Map'), { ssr: false });

export default function Home() {
  const [selectedMeds, setSelectedMeds] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedMeds, setScannedMeds] = useState<{medicine: string, dosage: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [glowVisible, setGlowVisible] = useState(false);

  const [mapCenter, setMapCenter] = useState<[number, number]>([19.0760, 72.8777]);
  const [locationQuery, setLocationQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  const [consoleVisible, setConsoleVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setHeroVisible(true), 100);
    const t2 = setTimeout(() => setConsoleVisible(true), 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    setScannedMeds([]);
    setSelectedMeds([]);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('https://sanjeevani-api-84r3.onrender.com/scan-prescription', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Server error");
      const parsedData = JSON.parse(data.extracted_data);
      if (parsedData && parsedData.length > 0) {
        setScannedMeds(parsedData);
        const allMeds = parsedData.map((m: any) => `${m.medicine} ${m.dosage}`);
        setSelectedMeds(allMeds);
      } else {
        toast.error("No readable medicine found in the image. Please try a clearer photo.");
      }
    } catch (error: any) {
      console.error("AI Scan Error:", error);
      if (error.message.includes("503") || error.message.includes("high demand")) {
        toast.error("Google's AI servers are currently busy. Please wait a minute and try again!");
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
      prev.includes(medString)
        ? prev.filter(m => m !== medString)
        : [...prev, medString]
    );
  };

  const handleManualSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualInput(e.target.value);
    if (e.target.value.trim() !== '') {
      const multiItems = e.target.value.split(',').map(item => item.trim()).filter(item => item.length > 0);
      setSelectedMeds(multiItems);
    } else {
      setSelectedMeds([]);
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
    } catch (err) {
      toast.error("Error finding location.");
    } finally {
      setIsLocating(false);
    }
  };

  const handleGPSLocate = () => {
    if ('geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter([position.coords.latitude, position.coords.longitude]);
          setIsLocating(false);
        },
        () => {
          toast.error("Could not get your location. Please check browser permissions.");
          setIsLocating(false);
        }
      );
    } else {
      toast.error("Geolocation is not supported by your browser.");
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; }

        body {
          font-family: 'DM Sans', sans-serif;
        }

        .font-display { font-family: 'Syne', sans-serif; }

        /* === ANIMATED GRADIENT TEXT === */
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

        /* === AMBIENT ORB FLOATS === */
        @keyframes floatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(30px, -20px) scale(1.05); }
          66%       { transform: translate(-20px, 15px) scale(0.97); }
        }
        .orb { animation: floatOrb 12s ease-in-out infinite; }
        .orb-delay { animation-delay: -5s; }

        /* === SHIMMER SCANLINE === */
        @keyframes scanline {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 0.4; }
          90%  { opacity: 0.4; }
          100% { transform: translateY(200%); opacity: 0; }
        }
        .scanline-anim {
          animation: scanline 3s ease-in-out infinite;
          animation-delay: 1s;
        }

        /* === PULSING GREEN RING === */
        @keyframes pulsering {
          0%   { transform: scale(1);   opacity: 0.8; }
          70%  { transform: scale(1.8); opacity: 0; }
          100% { transform: scale(1);   opacity: 0; }
        }
        .pulse-ring::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 2px solid #34d399;
          animation: pulsering 1.8s ease-out infinite;
        }

        /* === FADE UP === */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up   { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both; }
        .delay-1   { animation-delay: 0.15s; }
        .delay-2   { animation-delay: 0.3s; }
        .delay-3   { animation-delay: 0.45s; }
        .delay-4   { animation-delay: 0.6s; }

        /* === GLASS CARD === */
        .glass-card {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          backdrop-filter: blur(20px) saturate(140%);
          -webkit-backdrop-filter: blur(20px) saturate(140%);
        }
        .dark .glass-card {
          background: rgba(10,18,35,0.65);
          border: 1px solid rgba(56,189,248,0.12);
        }
        .light-glass {
          background: rgba(255,255,255,0.85);
          border: 1px solid rgba(14,165,233,0.15);
          backdrop-filter: blur(20px);
        }

        /* === NEON GLOW BORDER === */
        .glow-border {
          box-shadow: 0 0 0 1px rgba(56,189,248,0.3), 0 0 20px rgba(56,189,248,0.1), 0 0 40px rgba(52,211,153,0.05);
        }
        .glow-border:hover {
          box-shadow: 0 0 0 1px rgba(56,189,248,0.55), 0 0 30px rgba(56,189,248,0.18), 0 0 60px rgba(52,211,153,0.12);
        }
        .glow-border-green {
          box-shadow: 0 0 0 1px rgba(52,211,153,0.3), 0 0 20px rgba(52,211,153,0.12);
        }

        /* === BUTTONS === */
        .btn-teleport {
          background: linear-gradient(135deg, #0ea5e9, #06b6d4);
          box-shadow: 0 4px 20px rgba(14,165,233,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
          transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .btn-teleport:hover {
          background: linear-gradient(135deg, #38bdf8, #22d3ee);
          box-shadow: 0 6px 30px rgba(14,165,233,0.55), inset 0 1px 0 rgba(255,255,255,0.15);
          transform: translateY(-2px) scale(1.03);
        }
        .btn-teleport:active { transform: scale(0.97); }

        .btn-scan {
          background: linear-gradient(135deg, #059669, #10b981);
          box-shadow: 0 4px 20px rgba(16,185,129,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
          transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .btn-scan:hover {
          background: linear-gradient(135deg, #10b981, #34d399);
          box-shadow: 0 6px 30px rgba(16,185,129,0.55), inset 0 1px 0 rgba(255,255,255,0.15);
          transform: translateY(-2px) scale(1.03);
        }
        .btn-scan:active { transform: scale(0.97); }

        .btn-gps {
          background: rgba(14,165,233,0.12);
          border: 1px solid rgba(14,165,233,0.35);
          color: #38bdf8;
          transition: all 0.2s ease;
        }
        .btn-gps:hover {
          background: rgba(14,165,233,0.22);
          border-color: rgba(56,189,248,0.6);
          box-shadow: 0 0 16px rgba(56,189,248,0.25);
          transform: translateY(-1px);
        }

        /* === INPUT FOCUS GLOW === */
        .input-glow:focus {
          outline: none;
          border-color: rgba(56,189,248,0.6) !important;
          box-shadow: 0 0 0 3px rgba(56,189,248,0.12), 0 0 20px rgba(56,189,248,0.08);
        }
        .input-glow-green:focus {
          outline: none;
          border-color: rgba(52,211,153,0.6) !important;
          box-shadow: 0 0 0 3px rgba(52,211,153,0.12), 0 0 20px rgba(52,211,153,0.08);
        }

        /* === BADGE CHIP === */
        .stat-chip {
          background: rgba(56,189,248,0.08);
          border: 1px solid rgba(56,189,248,0.2);
          color: #38bdf8;
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          font-weight: 700;
          text-transform: uppercase;
          padding: 0.3rem 0.75rem;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
        }
        .stat-chip-green {
          background: rgba(52,211,153,0.08);
          border: 1px solid rgba(52,211,153,0.2);
          color: #34d399;
        }

        /* === MAP CARD SHIMMER === */
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
        .shimmer-bg {
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%);
          background-size: 600px 100%;
          animation: shimmer 2s infinite;
        }

        /* === GRID DOT PATTERN === */
        .dot-grid {
          background-image: radial-gradient(circle, rgba(56,189,248,0.12) 1px, transparent 1px);
          background-size: 32px 32px;
        }

        /* === NOISE OVERLAY === */
        .noise::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          opacity: 0.4;
          border-radius: inherit;
        }

        /* === TICKER === */
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-inner { animation: ticker 24s linear infinite; }

        /* Light mode overrides */
        :root:not(.dark) .dark-only { display: none !important; }
        .dark .light-only { display: none !important; }
      `}</style>

      <div className="min-h-screen bg-[#030c18] dark:bg-[#030c18] selection:bg-sky-300/30 selection:text-sky-100 relative overflow-x-hidden transition-colors duration-500"
           style={{ fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── AMBIENT BACKGROUND ORBS ── */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden>
          <div className="orb absolute top-[-10vh] left-[-5vw] w-[55vw] h-[55vw] rounded-full"
               style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.13) 0%, transparent 70%)' }} />
          <div className="orb orb-delay absolute bottom-[-15vh] right-[-5vw] w-[45vw] h-[45vw] rounded-full"
               style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 dot-grid opacity-40" />
        </div>

        {/* ── CURSOR GLOW ── */}
        <div className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-500"
             style={{ opacity: glowVisible ? 1 : 0 }}>
          <div className="absolute w-[28vw] h-[28vw] rounded-full blur-[9rem]"
               style={{ background: 'rgba(14,165,233,0.08)', left: mousePosition.x, top: mousePosition.y, transform: 'translate(-50%,-50%)' }} />
          <div className="absolute w-[22vw] h-[22vw] rounded-full blur-[8rem]"
               style={{ background: 'rgba(16,185,129,0.07)', left: mousePosition.x + 80, top: mousePosition.y + 80, transform: 'translate(-50%,-50%)' }} />
        </div>

        {/* ══════════════════ NAVBAR ══════════════════ */}
        <nav className="fixed top-0 w-full z-50 transition-all duration-300"
             style={{ background: 'rgba(3,12,24,0.75)', backdropFilter: 'blur(24px) saturate(150%)', borderBottom: '1px solid rgba(56,189,248,0.10)' }}>
          <div className="max-w-7xl mx-auto px-6 h-[4.5rem] flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg relative pulse-ring"
                   style={{ background: 'linear-gradient(135deg, #0ea5e9, #10b981)', boxShadow: '0 0 20px rgba(14,165,233,0.4)' }}>
                +
              </div>
              <span className="font-display text-xl font-800 text-white tracking-tight" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800 }}>
                Sanjeevani
              </span>
              <span className="stat-chip ml-1">v2.0</span>
            </div>

            <div className="hidden md:flex items-center gap-7 text-sm font-medium">
              {['How it Works', 'For Pharmacists'].map(link => (
                <a key={link} href={link === 'For Pharmacists' ? '/pharmacist' : '#'}
                   className="text-slate-400 hover:text-sky-400 transition-colors duration-200 relative group/nav">
                  {link}
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-sky-400 group-hover/nav:w-full transition-all duration-300" />
                </a>
              ))}
              <a href="#" className="text-slate-400 hover:text-sky-400 transition-colors flex items-center gap-1.5">
                <Mail size={14} /> Contact
              </a>
              <div className="pl-5 border-l border-white/10">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </nav>

        {/* ══════════════════ TICKER STRIP ══════════════════ */}
        <div className="fixed top-[4.5rem] w-full z-40 overflow-hidden py-1.5"
             style={{ background: 'rgba(14,165,233,0.07)', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
          <div className="ticker-inner flex gap-12 whitespace-nowrap w-max text-xs font-semibold tracking-widest uppercase">
            {Array(4).fill(['⚡ Real-time Inventory', '🤖 AI Prescription Scan', '📍 GPS Pharmacy Locator', '💊 Emergency Medicine Search', '🏥 Verified Pharmacies']).flat()
              .map((item, i) => (
                <span key={i} className="text-sky-400/60">{item}</span>
              ))}
          </div>
        </div>

        {/* ══════════════════ MAIN ══════════════════ */}
        <main
          className="pt-36 pb-24 px-4 md:px-8 flex flex-col items-center relative z-10"
          onMouseEnter={() => setGlowVisible(true)}
          onMouseLeave={() => setGlowVisible(false)}
        >
          <div className="max-w-6xl w-full space-y-14">

            {/* ── HERO ── */}
            <div className={`text-center space-y-6 max-w-4xl mx-auto transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

              {/* Label badge */}
              <div className="fade-up flex items-center justify-center gap-2">
                <span className="stat-chip">
                  <Activity size={10} className="inline" />
                  Live Medical Intelligence
                </span>
                <span className="stat-chip stat-chip-green">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  AI-Powered
                </span>
              </div>

              {/* Headline */}
              <h1 className="fade-up delay-1 font-display leading-[1.03] tracking-tighter"
                  style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(2.8rem, 7vw, 5.5rem)' }}>
                <span className="text-white">Find critical medicine</span>
                <br />
                <span className="animated-gradient-text">in seconds, not hours.</span>
              </h1>

              <p className="fade-up delay-2 text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                Locate verified inventory, scan prescriptions with AI, and ping nearby pharmacists in one click.
              </p>

              {/* Stats row */}
              <div className="fade-up delay-3 flex flex-wrap items-center justify-center gap-8 pt-2">
                {[
                  { val: '2,400+', label: 'Pharmacies' },
                  { val: '<3s', label: 'Response Time' },
                  { val: '98%', label: 'Scan Accuracy' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="font-display font-800 text-2xl text-white" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800 }}>{s.val}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-widest">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── ACTION CONSOLE ── */}
            <div className={`w-full relative transition-all duration-700 delay-300 ${consoleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

              {/* Outer glow ring */}
              <div className="absolute -inset-px rounded-3xl"
                   style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.3), rgba(16,185,129,0.2), rgba(14,165,233,0.1))', zIndex: -1, filter: 'blur(1px)' }} />

              <div className="relative rounded-3xl p-6 md:p-8 glow-border noise"
                   style={{ background: 'rgba(6,14,28,0.90)', backdropFilter: 'blur(28px)', border: '1px solid rgba(56,189,248,0.14)' }}>

                {/* Scanline effect */}
                <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                  <div className="scanline-anim absolute left-0 right-0 h-px"
                       style={{ background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)' }} />
                </div>

                {/* Section label */}
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-widest text-sky-400/70">Command Center</span>
                </div>

                {/* Row 1: Location */}
                <form onSubmit={handleTeleport} className="flex flex-col md:flex-row gap-3 mb-3">
                  <div className="flex-1 relative">
                    <MapPin size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-400/60 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Where are you? (e.g., Goregaon, Mumbai)"
                      className="input-glow w-full pl-11 pr-36 py-4 rounded-xl text-white placeholder-slate-500 text-base font-medium transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(56,189,248,0.15)', fontFamily: 'DM Sans, sans-serif' }}
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleGPSLocate}
                      className="btn-gps absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs rounded-lg font-bold flex items-center gap-1.5"
                    >
                      📍 <span className="hidden md:inline">Current GPS</span>
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={isLocating}
                    className="btn-teleport px-8 py-4 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-base"
                  >
                    <Zap size={17} />
                    {isLocating ? 'Locating…' : 'Teleport'}
                  </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.15), transparent)' }} />
                  <span className="text-xs text-slate-600 uppercase tracking-widest">then</span>
                  <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(52,211,153,0.15), transparent)' }} />
                </div>

                {/* Row 2: Medicine */}
                <div className="flex flex-col md:flex-row gap-3">
                  {scannedMeds.length > 0 ? (
                    <div className="flex-1 px-5 py-4 rounded-xl flex items-center gap-3"
                         style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
                      <span className="text-2xl">✅</span>
                      <span className="text-emerald-400 font-semibold text-base">{selectedMeds.length} medicine(s) detected from scan</span>
                    </div>
                  ) : (
                    <div className="flex-1 relative">
                      <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400/60 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="E.g., Crocin 1 strip, Ascoril 1 bottle..."
                        className="input-glow-green w-full pl-11 pr-5 py-4 rounded-xl text-white placeholder-slate-500 text-base font-medium transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(52,211,153,0.15)', fontFamily: 'DM Sans, sans-serif' }}
                        value={manualInput}
                        onChange={handleManualSearch}
                      />
                    </div>
                  )}

                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className={`btn-scan px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-white text-base min-w-[160px] ${isScanning ? 'opacity-60 cursor-not-allowed' : ''}`}
                    style={isScanning ? { background: 'rgba(16,185,129,0.3)', boxShadow: 'none', transform: 'none' } : {}}
                  >
                    {isScanning ? (
                      <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Analyzing…</>
                    ) : (
                      <><Scan size={18} /> Scan Rx</>
                    )}
                  </button>
                </div>

              </div>
            </div>

            {/* ── SCANNED MED CHIPS ── */}
            {scannedMeds.length > 0 && (
              <div className="rounded-3xl p-6 md:p-8 glow-border-green"
                   style={{ background: 'rgba(6,14,28,0.85)', border: '1px solid rgba(52,211,153,0.15)', backdropFilter: 'blur(20px)' }}>
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Select medicines to locate on map
                </h3>
                <div className="flex flex-wrap gap-3">
                  {scannedMeds.map((med, index) => {
                    const medString = `${med.medicine} ${med.dosage}`;
                    const isSelected = selectedMeds.includes(medString);
                    return (
                      <button
                        key={index}
                        onClick={() => toggleMed(medString)}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2"
                        style={isSelected
                          ? { background: 'linear-gradient(135deg, #059669, #10b981)', color: 'white', border: '1px solid rgba(52,211,153,0.5)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)', transform: 'translateY(-1px)' }
                          : { background: 'rgba(255,255,255,0.03)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.15)' }
                        }
                      >
                        {isSelected ? '✅' : '○'} {med.medicine} <span className="opacity-70">{med.dosage}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── MAP ── */}
            <div className="relative group/map">
              {/* Outer glow */}
              <div className="absolute -inset-2 rounded-[2rem] opacity-40 group-hover/map:opacity-70 transition duration-700 pointer-events-none"
                   style={{ background: 'radial-gradient(ellipse at center, rgba(14,165,233,0.15) 0%, transparent 70%)', zIndex: -1 }} />

              <div className="rounded-[1.6rem] overflow-hidden"
                   style={{ border: '1px solid rgba(56,189,248,0.15)', boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(56,189,248,0.07)' }}>
                {/* Map header bar */}
                <div className="flex items-center justify-between px-5 py-3"
                     style={{ background: 'rgba(6,14,28,0.95)', borderBottom: '1px solid rgba(56,189,248,0.1)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                    <span className="ml-3 text-xs text-slate-500 font-mono">sanjeevani://map · live</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {selectedMeds.length > 0 ? `Searching for ${selectedMeds.length} medicine(s)` : 'Awaiting query'}
                  </div>
                </div>
                <DynamicMap selectedMeds={selectedMeds} center={mapCenter} />
              </div>
            </div>

          </div>
        </main>

        {/* ══════════════════ FOOTER ══════════════════ */}
        <footer className="relative z-10" style={{ background: 'rgba(3,8,18,0.95)', borderTop: '1px solid rgba(56,189,248,0.08)' }}>
          <div className="max-w-7xl mx-auto px-8 py-16">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

              {/* Brand */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                       style={{ background: 'linear-gradient(135deg, #0ea5e9, #10b981)' }}>+</div>
                  <span className="font-display text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800 }}>Sanjeevani</span>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                  Bridging the gap between critical patients and life-saving medicine through real-time geospatial intelligence and AI.
                </p>
                <div className="flex items-center gap-4 pt-2">
                  {['𝕏', '⌥', 'in'].map((icon, i) => (
                    <a key={i} href="#"
                       className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-sky-400 transition-all hover:scale-110"
                       style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {icon}
                    </a>
                  ))}
                </div>
              </div>

              {/* Platform */}
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Platform</div>
                {['How it Works', 'For Pharmacists', 'API Documentation', 'Partner Network'].map(l => (
                  <a key={l} href="#" className="block text-sm text-slate-500 hover:text-sky-400 transition-colors mb-2.5">{l}</a>
                ))}
              </div>

              {/* Company */}
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Company</div>
                {['Privacy Policy', 'Terms of Service', 'Contact Us'].map(l => (
                  <a key={l} href="#" className="block text-sm text-slate-500 hover:text-sky-400 transition-colors mb-2.5">{l}</a>
                ))}
              </div>
            </div>

            <div className="mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-3"
                 style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-xs text-slate-600">© 2026 Project Sanjeevani. All rights reserved.</span>
              <span className="text-xs text-slate-600">Built with <span className="text-red-400">♥</span> for global health.</span>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}