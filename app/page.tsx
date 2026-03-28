'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ThemeToggle from './components/ThemeToggle';
import { Mail, Search, Zap, Scan } from 'lucide-react'; // Premium Icons
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

  // Location & Teleporter States
  const [mapCenter, setMapCenter] = useState<[number, number]>([19.0760, 72.8777]); // Default: Mumbai
  const [locationQuery, setLocationQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);

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
        alert("No readable medicine found in the image. Please try a clearer photo.");
      }
    } catch (error: any) {
      console.error("AI Scan Error:", error);
      alert(`Scan failed: ${error.message}`);
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
      const multiItems = e.target.value
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
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
        alert("Location not found. Try adding a city name, e.g., 'Goregaon, Mumbai'.");
      }
    } catch (err) {
      console.error(err);
      alert("Error finding location.");
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
        (error) => {
          alert("Could not get your location. Please check browser permissions.");
          setIsLocating(false);
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-transparent selection:bg-sky-200 selection:text-sky-900 font-sans relative overflow-x-hidden transition-colors duration-300">
      
      {/* NAVBAR: Increased backdrop blur, cleaner dark border */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-400 flex items-center justify-center text-white font-bold text-2xl shadow-md">+</div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-950 to-slate-700 dark:from-white dark:to-slate-300 tracking-tighter">Sanjeevani</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">How it Works</a>
            <a href="/pharmacist" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">For Pharmacists</a>
            <a href="#" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-2"><Mail size={16}/> Contact</a>
            
            <div className="pl-6 border-l border-slate-200 dark:border-slate-800">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      {/* CURSOR GLOW EFFECT (Upgraded to Dual-Tone Gradient Blob) */}
      <div className="fixed inset-0 pointer-events-none -z-10 transition-opacity duration-300 ease-out" style={{ opacity: glowVisible ? 0.3 : 0 }}>
        {/* Sky Blue Blob */}
        <div className="w-[35vw] h-[35vw] bg-sky-500 rounded-full blur-[10rem] opacity-70" style={{ position: 'absolute', left: `${mousePosition.x - 100}px`, top: `${mousePosition.y - 100}px`, transform: 'translate(-50%, -50%)' }} />
        {/* Emerald Green Blob (Slight offset for beautiful blending) */}
        <div className="w-[30vw] h-[30vw] bg-emerald-400 rounded-full blur-[10rem] opacity-70" style={{ position: 'absolute', left: `${mousePosition.x + 100}px`, top: `${mousePosition.y + 100}px`, transform: 'translate(-50%, -50%)' }} />
      </div>

      <main className="pt-36 pb-20 px-4 md:px-8 flex flex-col items-center relative" onMouseEnter={() => setGlowVisible(true)} onMouseLeave={() => setGlowVisible(false)}>
        <div className="max-w-6xl w-full space-y-12 z-10">
          
          {/* HERO SECTION: Refined Typography & Wider Span */}
          <div className="text-center space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto">
            <h1 className="text-6xl md:text-7xl font-extrabold tracking-tighter text-slate-950 dark:text-white drop-shadow-sm transition-colors duration-300 leading-[1.05]">
              Find critical medicine <br className="hidden md:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-emerald-500 dark:from-sky-400 dark:to-emerald-400">in seconds, not hours.</span>
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto pt-2">
              Locate verified inventory, scan prescriptions with AI, and ping nearby pharmacists in one click.
            </p>
          </div>

          {/* UPLOADED: THE ACTION CONSOLE (Location & Medicine unified in one sleek block) */}
          <div className="w-full relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-emerald-400 rounded-3xl blur opacity-30 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            
            <div className="relative bg-white/95 dark:bg-slate-900/60 backdrop-blur-xl p-5 md:p-6 rounded-3xl shadow-xl border-2 border-slate-200 dark:border-slate-800/50 flex flex-col gap-5 transition-all duration-300">
              
              {/* Row 1: Location Control (Merged GPS & Teleport) */}
              <form onSubmit={handleTeleport} className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative group/input">
                    <input 
                      type="text" 
                      placeholder="Where are you? (e.g., Goregaon, Mumbai)" 
                      className="w-full pl-6 pr-4 py-4 rounded-xl bg-slate-100/50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 focus:outline-none transition-all text-lg font-medium shadow-inner"
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={handleGPSLocate}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 text-sm bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-lg font-bold transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-600 shadow hover:bg-slate-100 dark:hover:bg-slate-600/50 active:scale-95 z-10"
                    >
                      📍 <span className="hidden md:inline">Current GPS</span>
                    </button>
                </div>
                
                <button 
                  type="submit"
                  disabled={isLocating}
                  className="px-10 py-4 bg-slate-900 dark:bg-sky-500 hover:bg-black dark:hover:bg-sky-600 text-white rounded-xl font-bold shadow-md transition-all active:scale-95 text-lg flex items-center justify-center gap-2"
                >
                  <Zap size={18}/> {isLocating ? '...' : 'Teleport'}
                </button>
              </form>

              {/* Row 2: Medicine Input/Status & AI Scan Button */}
              <div className="flex flex-col md:flex-row gap-3">
                {scannedMeds.length > 0 ? (
                   <div className="flex-1 px-6 py-4.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold flex items-center shadow-inner text-lg">
                     ✅ {selectedMeds.length} medicine(s) selected from scan.
                   </div>
                ) : (
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      placeholder="E.g., Crocin 1 strip, Ascoril 1 bottle..." 
                      className="w-full px-6 py-4.5 rounded-xl bg-slate-100/50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none transition-all text-lg font-medium shadow-inner"
                      value={manualInput}
                      onChange={handleManualSearch}
                    />
                    <Search size={22} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"/>
                  </div>
                )}
                
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                  className={`px-10 py-4.5 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 group text-lg ${isScanning ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 border border-emerald-600 dark:border-emerald-500 active:scale-95'}`}
                >
                  {isScanning ? <span className="animate-pulse">Analyzing...</span> : <><Scan size={20} className="text-white"/> Scan Rx</>}
                </button>
              </div>

            </div>
          </div>

          {/* MULTI-SELECT UI: Increased elevation, cleaner border */}
          {scannedMeds.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-emerald-100 dark:border-emerald-950 animate-in zoom-in duration-300 transition-colors duration-300 relative z-20">
              <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Select medicines to ping on map
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {scannedMeds.map((med, index) => {
                  const medString = `${med.medicine} ${med.dosage}`;
                  const isSelected = selectedMeds.includes(medString);
                  return (
                    <button 
                      key={index}
                      onClick={() => toggleMed(medString)}
                      className={`px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors flex items-center gap-2 ${isSelected ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-[1.03]' : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
                    >
                      <span>{isSelected ? '✅' : '⚪'}</span>
                      {med.medicine} <span className="opacity-75">{med.dosage}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* MAP SECTION: Lifted Glow and cleaner border */}
          <div className="relative group mt-6">
            <div className="absolute -inset-1.5 bg-gradient-to-br from-sky-400/20 to-emerald-400/20 rounded-[1.7rem] blur opacity-40 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
            <DynamicMap selectedMeds={selectedMeds} center={mapCenter} />
          </div>

        </div>
      </main>
    </div>
  );
}