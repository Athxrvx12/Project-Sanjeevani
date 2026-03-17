'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';

const DynamicMap = dynamic(() => import('./components/Map'), { ssr: false });

export default function Home() {
  const [selectedMeds, setSelectedMeds] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  
  const [isScanning, setIsScanning] = useState(false);
  const [scannedMeds, setScannedMeds] = useState<{medicine: string, dosage: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [glowVisible, setGlowVisible] = useState(false);

  // NEW: Location & Teleporter States
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
      const response = await fetch('http://localhost:8000/scan-prescription', {
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

  // NEW: Geocoding Function (The Teleporter)
  const handleTeleport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!locationQuery.trim()) return;

    setIsLocating(true);
    try {
      // Use OpenStreetMap's free API to turn a city name into coordinates
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

  // NEW: HTML5 GPS Locator
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
    <div className="min-h-screen bg-slate-50 selection:bg-sky-200 selection:text-sky-900 font-sans relative overflow-x-hidden">
      
      <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-md border-b border-white/20 shadow-sm transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-400 flex items-center justify-center text-white font-bold text-xl shadow-md">+</div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">Sanjeevani</span>
          </div>
          <div className="hidden md:flex gap-8 text-sm font-medium text-slate-600">
            <a href="#" className="hover:text-sky-600 transition-colors">How it Works</a>
            <a href="/pharmacist" className="hover:text-sky-600 transition-colors">For Pharmacists</a>
            <a href="#" className="hover:text-sky-600 transition-colors">Contact</a>
          </div>
        </div>
      </nav>

      <div className="fixed inset-0 pointer-events-none -z-10 transition-opacity duration-300 ease-out" style={{ opacity: glowVisible ? 0.4 : 0 }}>
        <div className="w-[30vw] h-[30vw] bg-emerald-400 rounded-full blur-[10rem]" style={{ position: 'absolute', left: `${mousePosition.x}px`, top: `${mousePosition.y}px`, transform: 'translate(-50%, -50%)' }} />
      </div>

      <main className="pt-28 pb-16 px-4 md:px-8 flex flex-col items-center relative" onMouseEnter={() => setGlowVisible(true)} onMouseLeave={() => setGlowVisible(false)}>
        <div className="max-w-5xl w-full space-y-8 z-10">
          
          <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 mb-8">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 drop-shadow-sm">
              Find critical medicine <br className="hidden md:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-emerald-500">in seconds, not hours.</span>
            </h1>
          </div>

          {/* 1. THE LOCATION CONTROL BAR */}
          <div className="bg-white/95 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-lg border-2 border-slate-200 flex flex-col md:flex-row gap-3 relative z-20 hover:shadow-xl hover:border-sky-300 transition-all duration-300">
            <button 
              onClick={handleGPSLocate}
              disabled={isLocating}
              className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 border border-slate-200 shadow-sm active:scale-95"
            >
              📍 Locate Me
            </button>
            <form onSubmit={handleTeleport} className="flex-1 flex gap-2">
              <input 
                type="text" 
                placeholder="Where are you? (e.g., Goregaon, Mumbai)" 
                className="flex-1 px-5 py-3.5 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none transition-all text-lg font-medium"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
              />
              <button 
                type="submit"
                disabled={isLocating}
                className="px-8 py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow-md transition-all active:scale-95 text-lg"
              >
                {isLocating ? '...' : 'Teleport'}
              </button>
            </form>
          </div>

          {/* 2. MEDICINE SEARCH CONSOLE */}
          <div className="bg-white/95 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-lg border-2 border-slate-200 flex flex-col md:flex-row gap-3 relative z-20 hover:shadow-xl hover:border-emerald-300 transition-all duration-300 mt-4">
            {scannedMeds.length > 0 ? (
               <div className="flex-1 px-5 py-4 rounded-xl bg-slate-50/50 border border-emerald-200 text-emerald-800 font-bold flex items-center shadow-inner">
                 ✅ {selectedMeds.length} medicine(s) selected from scan.
               </div>
            ) : (
              <input 
              type="text" 
              placeholder="E.g., Crocin 1 strip, Ascoril 1 bottle..." 
              className="flex-1 px-5 py-4 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all text-lg font-medium"
              value={manualInput}
              onChange={handleManualSearch}
            />
            )}
            
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className={`px-8 py-4 rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2 group text-lg ${isScanning ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 active:scale-95'}`}
            >
              {isScanning ? <span className="animate-pulse">Analyzing...</span> : <><span>📷</span> Scan Rx</>}
            </button>
          </div>

          {/* MULTI-SELECT UI */}
          {scannedMeds.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-md border border-emerald-100 animate-in zoom-in duration-300">
              <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Select medicines to ping
              </h3>
              <div className="flex flex-wrap gap-2">
                {scannedMeds.map((med, index) => {
                  const medString = `${med.medicine} ${med.dosage}`;
                  const isSelected = selectedMeds.includes(medString);
                  return (
                    <button 
                      key={index}
                      onClick={() => toggleMed(medString)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors flex items-center gap-2 ${isSelected ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                    >
                      <span>{isSelected ? '✅' : '⚪'}</span>
                      {med.medicine} <span className="opacity-75">{med.dosage}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="relative group mt-4">
            <div className="absolute -inset-1 bg-gradient-to-r from-sky-400 to-emerald-400 rounded-[1.5rem] blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
            <DynamicMap selectedMeds={selectedMeds} center={mapCenter} />
          </div>

        </div>
      </main>
    </div>
  );
}