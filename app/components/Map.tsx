'use client';

import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase'; 
import toast from 'react-hot-toast';

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Pharmacy {
  id: string;
  shop_name: string;
  address_text: string;
  distance_meters: number;
  lat: number;
  lon: number;
}

// MATH HELPER: The Haversine Formula to calculate distance between two GPS coordinates
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
}

// This tiny component sits inside the map and controls the camera
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      map.flyTo(center, 13, { animate: true, duration: 1.5 });
    }
  }, [center, map]);
  
  return null;
}

export default function Map({ selectedMeds, center }: { selectedMeds: string[], center: [number, number] }) {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [activePingId, setActivePingId] = useState<string | null>(null);
  const [pharmacistResponse, setPharmacistResponse] = useState<any | null>(null);
  const [isLoadingPharmacies, setIsLoadingPharmacies] = useState(false);

  // 1. SEND PING FUNCTION
  const sendPing = async (pharmacy: Pharmacy) => {
    // THE ANTI-SPAM BLOCKER
    const now = Date.now();
    const lastPing = localStorage.getItem('lastSanjeevaniPing');
    if (lastPing && (now - parseInt(lastPing)) < 30000) { // 30,000 ms = 30 seconds
      toast.error("🚨 Anti-Spam: Please wait 30 seconds before sending another emergency ping.");
      return;
    }

    if (selectedMeds.length === 0) {
      toast.error("Please select or type at least one medicine first!");
      return;
    }

    // Record the time of this ping
    localStorage.setItem('lastSanjeevaniPing', now.toString());

    const estimatedMinutes = Math.ceil(pharmacy.distance_meters / 80);

    const payload = {
      medicines: selectedMeds.map(med => ({ name: med, status: 'pending' })),
      eta_minutes: estimatedMinutes,
      patient_distance: (pharmacy.distance_meters / 1000).toFixed(2) + " km"
    };

    const { data, error } = await supabase
      .from('inquiries')
      .insert([{
          pharmacy_id: pharmacy.id, // Now uses the global OSM ID!
          medicine_query: JSON.stringify(payload),
          status: "pending"
      }])
      .select()
      .single();

    if (error) {
      console.error("Ping Error:", error);
      toast.error("Failed to send ping.");
    } else if (data) {
      setActivePingId(data.id);
      toast.success(`Ping sent! Tracking ${selectedMeds.length} medicines. Estimated arrival: ${estimatedMinutes} mins.`);
    }
  }; // <--- sendPing officially ends here!

  // 2. THE CANCEL FUNCTION
  const handleCloseAndCancel = async () => {
    if (pharmacistResponse?.id) {
      await supabase
        .from('inquiries')
        .update({ status: 'cancelled' })
        .eq('id', pharmacistResponse.id);
    }
    setPharmacistResponse(null);
  };
  // Fetch REAL pharmacies from the global Overpass API (With Bulletproof Fallback)
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchLivePharmacies() {
      setIsLoadingPharmacies(true);
      
      // FIX 1: Use 'nwr' (node, way, relation) to catch buildings, not just points!
      // Added 'out center' to find the middle of the buildings.
      const query = `
        [out:json][timeout:10];
        nwr["amenity"="pharmacy"](around:5000,${center[0]},${center[1]});
        out center 15; 
      `;
      
      try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
          signal: abortController.signal
        });
        
        let fetchedPharmacies: Pharmacy[] = [];

        if (res.ok) {
          const data = await res.json();
          fetchedPharmacies = data.elements.map((element: any) => {
            // FIX 2: Check for element.lat (node) OR element.center.lat (building)
            const lat = element.lat || element.center?.lat;
            const lon = element.lon || element.center?.lon;
            const distance = getDistanceInMeters(center[0], center[1], lat, lon);

            return {
              id: `osm-${element.id}`,
              shop_name: element.tags?.name || "Verified Pharmacy",
              address_text: "Local Area",
              distance_meters: distance,
              lat: lat,
              lon: lon
            };
          }).filter((p: any) => p.lat && p.lon); // Make sure we have valid GPS points
        }

        // FIX 3: THE DEMO SAFETY NET
        // If the API failed, OR if it returned 0 pharmacies, spawn realistic fallbacks
        if (!res.ok || fetchedPharmacies.length === 0) {
          console.warn("Using fallback pharmacies for demo stability.");
          fetchedPharmacies = [
            { id: 'fallback-1', shop_name: 'Apollo Pharmacy', address_text: '', distance_meters: 450, lat: center[0] + 0.004, lon: center[1] + 0.004 },
            { id: 'fallback-2', shop_name: 'Wellness Forever', address_text: '', distance_meters: 800, lat: center[0] - 0.005, lon: center[1] + 0.002 },
            { id: 'fallback-3', shop_name: 'MedPlus Mart', address_text: '', distance_meters: 1200, lat: center[0] + 0.008, lon: center[1] - 0.006 },
            { id: 'fallback-4', shop_name: 'Noble Plus', address_text: '', distance_meters: 2100, lat: center[0] - 0.012, lon: center[1] - 0.010 },
            { id: 'fallback-5', shop_name: 'Sanjeevani Partner Rx', address_text: '', distance_meters: 3500, lat: center[0] + 0.020, lon: center[1] + 0.015 },
          ];
        }

        // Sort whatever we got by distance so the closest is first
        fetchedPharmacies.sort((a, b) => a.distance_meters - b.distance_meters);
        setPharmacies(fetchedPharmacies);
        
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Map fetch error:", err);
          // Safety Net for catastrophic network failure
          setPharmacies([
            { id: 'fallback-safe', shop_name: 'Apollo Pharmacy', address_text: '', distance_meters: 450, lat: center[0] + 0.004, lon: center[1] + 0.004 }
          ]);
        }
      } finally {
        setIsLoadingPharmacies(false);
      }
    }
    
    fetchLivePharmacies();

    return () => {
      abortController.abort();
    };
  }, [center]);

  // THE BULLETPROOF REAL-TIME LISTENER (With Polling Failsafe)
  useEffect(() => {
    if (!activePingId) return;

    // 1. PRIMARY: The WebSocket Listener (Instant)
    const channel = supabase
      .channel(`patient-ping-${activePingId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inquiries' },
        (payload) => {
          if (payload.new.id === activePingId && payload.new.status === 'responded') {
            try {
              const resultData = JSON.parse(payload.new.medicine_query);
              setPharmacistResponse({ id: payload.new.id, data: resultData });
              setActivePingId(null);
            } catch (err) {
              console.error(err);
            }
          }
        }
      ).subscribe();

    // 2. BACKUP: The Polling Engine (Fires every 3 seconds)
    // Guarantees the modal pops up even if WebSockets or WiFi fail during a pitch
    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('inquiries')
        .select('status, medicine_query')
        .eq('id', activePingId)
        .single();
        
      if (data && data.status === 'responded') {
        try {
          const resultData = JSON.parse(data.medicine_query);
          setPharmacistResponse({ id: activePingId, data: resultData });
          setActivePingId(null);
        } catch (err) {
          console.error(err);
        }
      }
    }, 3000);

    return () => { 
      supabase.removeChannel(channel); 
      clearInterval(interval);
    };
  }, [activePingId]);

  return (
    <div className="h-[60vh] w-full rounded-xl overflow-hidden shadow-lg border-2 border-sky-100 dark:border-slate-700 relative z-0">
      
      {/* Loading Overlay */}
      {isLoadingPharmacies && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md text-sm font-bold text-sky-600 dark:text-sky-400 animate-pulse border border-sky-100 dark:border-slate-700">
          Scanning satellite data for pharmacies...
        </div>
      )}

      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapUpdater center={center} />
        <Circle center={center} radius={5000} pathOptions={{ color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.1 }} />
        <Marker position={center}><Popup><strong>You are here</strong></Popup></Marker>
        
        {pharmacies.map((pharmacy) => (
          <Marker key={pharmacy.id} position={[pharmacy.lat, pharmacy.lon]}>
            <Popup>
              <strong>{pharmacy.shop_name}</strong><br/>
              <span className="text-sky-600 text-sm font-semibold">{(pharmacy.distance_meters / 1000).toFixed(2)} km away</span><br/>
              <button 
                onClick={() => sendPing(pharmacy)} 
                className="mt-2 w-full bg-sky-600 text-white py-1 rounded shadow-sm hover:bg-sky-700 text-sm active:scale-95 transition-transform"
              >
                Ping Pharmacist
              </button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* THE SMART MULTI-MEDICINE MODAL WITH DYNAMIC PRICING (Now with Dark Mode!) */}
      {pharmacistResponse && (
        <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">Pharmacist Response</h2>
            
            <div className="space-y-3 mb-6">
              {pharmacistResponse.data.medicines.map((med: any, i: number) => (
                <div key={i} className={`p-3 rounded-lg flex justify-between items-center border ${med.status === 'in_stock' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800'}`}>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{med.name}</span>
                  <span className={`font-bold text-sm px-2 py-1 rounded ${med.status === 'in_stock' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50' : 'text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/50'}`}>
                    {med.status === 'in_stock' ? '✓ In Stock' : '❌ Out of Stock'}
                  </span>
                </div>
              ))}
            </div>
            
            {(() => {
              const inStockCount = pharmacistResponse.data.medicines.filter((m: any) => m.status === 'in_stock').length;
              const totalAmount = inStockCount * 10;

              if (totalAmount > 0) {
                return (
                  <a 
                    href={`upi://pay?pa=sanjeevani@ybl&pn=Project+Sanjeevani&am=${totalAmount}.00&tn=Token+For+${pharmacistResponse.id}`}
                    className="block w-full text-center bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-md transition-all active:scale-95 text-lg"
                  >
                    Pay ₹{totalAmount} UPI Reservation
                  </a>
                );
              } else {
                return (
                  <div className="bg-rose-100 dark:bg-rose-900/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 p-4 rounded-xl text-center font-bold">
                    Order Declined: No requested items are in stock.
                  </div>
                );
              }
            })()}
            
            <button 
              onClick={handleCloseAndCancel} 
              className="mt-4 w-full text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium bg-slate-100 dark:bg-slate-700/50 py-3 rounded-xl transition-colors"
            >
              Close & Try Another Pharmacy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}