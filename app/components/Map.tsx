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
    if (lastPing && (now - parseInt(lastPing)) < 60000) { // 60,000 ms = 60 seconds
      alert("🚨 Anti-Spam: Please wait 60 seconds before sending another emergency ping.");
      return;
    }

    if (selectedMeds.length === 0) {
      alert("Please select or type at least one medicine first!");
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
      alert("Failed to send ping.");
    } else if (data) {
      setActivePingId(data.id);
      alert(`Ping sent! Tracking ${selectedMeds.length} medicines. Estimated arrival: ${estimatedMinutes} mins.`);
    }
  }; // <--- sendPing officially ends here!

  // 2. THE CANCEL FUNCTION (Safely outside of sendPing)
  const handleCloseAndCancel = async () => {
    if (pharmacistResponse?.id) {
      // Tell the database this order is cancelled so it disappears from the pharmacist's screen
      await supabase
        .from('inquiries')
        .update({ status: 'cancelled' })
        .eq('id', pharmacistResponse.id);
    }
    setPharmacistResponse(null);
  };

  // Fetch REAL pharmacies from the global Overpass API
  useEffect(() => {
    // Create an AbortController to prevent React Strict Mode from spamming the API
    const abortController = new AbortController();

    async function fetchLivePharmacies() {
      setIsLoadingPharmacies(true);
      
      const query = `
        [out:json][timeout:10];
        node["amenity"="pharmacy"](around:5000,${center[0]},${center[1]});
        out 15; 
      `;
      
      try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: abortController.signal // Attach the abort signal
        });
        
        if (!res.ok) {
          console.warn("Overpass API is currently busy. Please wait a moment and try again.");
          setIsLoadingPharmacies(false);
          return; 
        }

        const data = await res.json();
        
        const realPharmacies: Pharmacy[] = data.elements.map((node: any) => {
          const distance = getDistanceInMeters(center[0], center[1], node.lat, node.lon);
          return {
            id: `osm-${node.id}`,
            shop_name: node.tags?.name || "Local Pharmacy",
            address_text: "Area Pharmacy",
            distance_meters: distance,
            lat: node.lat,
            lon: node.lon
          };
        });

        realPharmacies.sort((a, b) => a.distance_meters - b.distance_meters);
        setPharmacies(realPharmacies);
        
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log("Duplicate API request cancelled.");
        } else {
          console.error("Failed to fetch global map data:", err);
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

  // THE BULLETPROOF REAL-TIME LISTENER
  useEffect(() => {
    if (!activePingId) return;

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
              console.error("Failed to parse pharmacist JSON:", err);
            }
          }
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activePingId]);

  return (
    <div className="h-[60vh] w-full rounded-xl overflow-hidden shadow-lg border-2 border-sky-100 relative z-0">
      
      {/* Loading Overlay */}
      {isLoadingPharmacies && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md text-sm font-bold text-sky-600 animate-pulse border border-sky-100">
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

      {/* THE SMART MULTI-MEDICINE MODAL WITH DYNAMIC PRICING */}
      {pharmacistResponse && (
        <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in duration-200">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Pharmacist Response</h2>
            
            <div className="space-y-3 mb-6">
              {pharmacistResponse.data.medicines.map((med: any, i: number) => (
                <div key={i} className={`p-3 rounded-lg flex justify-between items-center border ${med.status === 'in_stock' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                  <span className="font-medium text-slate-700">{med.name}</span>
                  <span className={`font-bold text-sm px-2 py-1 rounded ${med.status === 'in_stock' ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}`}>
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
                    className="block w-full text-center bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 shadow-md transition-all active:scale-95 text-lg"
                  >
                    Pay ₹{totalAmount} UPI Reservation
                  </a>
                );
              } else {
                return (
                  <div className="bg-rose-100 border border-rose-200 text-rose-700 p-4 rounded-xl text-center font-bold">
                    Order Declined: No requested items are in stock.
                  </div>
                );
              }
            })()}
            
            <button 
              onClick={handleCloseAndCancel} 
              className="mt-4 w-full text-sm text-slate-500 hover:text-slate-700 font-medium bg-slate-100 py-3 rounded-xl transition-colors"
            >
              Close & Try Another Pharmacy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}