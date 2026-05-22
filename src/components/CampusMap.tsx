import React, { useEffect, useRef, useState } from 'react';
import { LostItem } from '../types';
import { CAMPUS_COORDINATES } from '../constants';
import { MapPin, Calendar, User, Eye } from 'lucide-react';

interface CampusMapProps {
  items: LostItem[];
  onSelectItem: (itemId: string) => void;
}

const GOOGLE_MAPS_KEY = (process.env.GOOGLE_MAPS_PLATFORM_KEY as string) || '';

export default function CampusMap({ items, onSelectItem }: CampusMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedItem, setSelectedItem] = useState<LostItem | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Load Google Maps API script
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) {
      console.warn('Google Maps Platform key is missing in environment.');
      return;
    }

    const loadScript = () => {
      if (window.google && window.google.maps) {
        setMapLoaded(true);
        return;
      }

      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        existingScript.addEventListener('load', () => setMapLoaded(true));
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapLoaded(true);
      document.head.appendChild(script);
    };

    loadScript();
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || map) return;

    // Centered around the campus center (default coordinates)
    const campusCenter = { lat: 8.4851, lng: 124.6565 };

    const customStyles = [
      { elementType: 'geometry', stylers: [{ color: '#f5f2eb' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#4a3f35' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
      { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9b2a6' }] },
      { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#dfd7cc' }] },
      { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e6ded4' }] },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d8decb' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ebdcc5' }] },
      { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c5d8d1' }] }
    ];

    const initializedMap = new window.google.maps.Map(mapRef.current, {
      center: campusCenter,
      zoom: 17,
      styles: customStyles,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'cooperative',
    });

    setMap(initializedMap);
  }, [mapLoaded, map]);

  // Update Markers when items or map changes
  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    markers.forEach(m => m.setMap(null));
    setMarkers([]);

    const activeItems = items.filter(item => item.status === 'active');
    const newMarkers: google.maps.Marker[] = [];

    // Group items by location to offset markers slightly if they overlap
    const locationCounts: Record<string, number> = {};

    activeItems.forEach(item => {
      const coords = CAMPUS_COORDINATES[item.location] || CAMPUS_COORDINATES['Other'];
      
      // Calculate slight offset if multiple items share the same location
      const count = locationCounts[item.location] || 0;
      locationCounts[item.location] = count + 1;
      
      const offsetLat = count * 0.00015;
      const offsetLng = (count % 2 === 0 ? 1 : -1) * count * 0.00015;

      const position = {
        lat: coords.lat + offsetLat,
        lng: coords.lng + offsetLng,
      };

      // Custom marker colors: Sage/Forest Green for Found, Warm Terracotta/Red for Lost
      const markerColor = item.type === 'found' ? '#606c38' : '#bc6c25';

      const pinSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="${markerColor}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3" fill="#ffffff"/>
        </svg>
      `;

      const marker = new window.google.maps.Marker({
        position,
        map,
        title: item.title,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pinSvg)}`,
          scaledSize: new window.google.maps.Size(36, 36),
          anchor: new window.google.maps.Point(18, 36),
        },
      });

      marker.addListener('click', () => {
        setSelectedItem(item);
        map.panTo(position);
      });

      newMarkers.push(marker);
    });

    setMarkers(newMarkers);
  }, [map, items]);

  return (
    <div className="relative w-full h-[550px] rounded-3xl overflow-hidden shadow-sm border border-natural-light bg-natural-cream">
      {!GOOGLE_MAPS_KEY && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-natural-cream">
          <MapPin className="w-12 h-12 text-terracotta mb-4 animate-bounce" />
          <h3 className="text-xl font-bold text-natural-dark mb-2">Google Maps Key Missing</h3>
          <p className="text-natural-muted max-w-md">
            Please add your <code className="bg-natural-light px-2 py-1 rounded">GOOGLE_MAPS_PLATFORM_KEY</code> to the <code className="bg-natural-light px-2 py-1 rounded">.env</code> file to enable the interactive map view.
          </p>
        </div>
      )}

      {GOOGLE_MAPS_KEY && !mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-natural-cream">
          <div className="w-10 h-10 border-4 border-sage border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Map Target */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Floating Info Overlay Card */}
      {selectedItem && (
        <div className="absolute bottom-6 left-6 right-6 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[420px] bg-white rounded-2xl shadow-xl border border-natural-light p-4 animate-slide-up z-20">
          <button 
            onClick={() => setSelectedItem(null)}
            className="absolute top-3 right-3 text-natural-muted hover:text-natural-dark text-lg font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-natural-light transition-colors"
          >
            &times;
          </button>
          
          <div className="flex gap-4">
            {selectedItem.imageUrl ? (
              <img 
                src={selectedItem.imageUrl} 
                alt={selectedItem.title} 
                className="w-20 h-20 rounded-xl object-cover border border-natural-light"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-natural-light flex items-center justify-center text-natural-muted">
                <MapPin className="w-8 h-8" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider ${
                  selectedItem.type === 'found' 
                    ? 'bg-sage-light text-sage' 
                    : 'bg-terracotta-light text-terracotta'
                }`}>
                  {selectedItem.type}
                </span>
                <span className="text-xs text-natural-muted flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {selectedItem.date}
                </span>
              </div>

              <h4 className="font-bold text-natural-dark truncate mb-1">{selectedItem.title}</h4>
              
              <p className="text-xs text-natural-muted flex items-center gap-1 mb-3">
                <MapPin className="w-3.5 h-3.5 text-sage" />
                {selectedItem.location}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => onSelectItem(selectedItem.id)}
                  className="flex-1 bg-sage text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 hover:bg-sage-dark transition-colors shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
