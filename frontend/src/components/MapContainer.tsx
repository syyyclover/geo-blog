import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Location } from '@/src/types';
import { GalleryModal } from './GalleryModal';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || (process.env as any).VITE_MAPBOX_ACCESS_TOKEN;

interface MapContainerProps {
  isAdmin?: boolean;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
}

export interface MapRef {
  flyTo: (coords: [number, number], zoom?: number) => void;
  refresh: () => void;
}

export const MapContainer = forwardRef<MapRef, MapContainerProps>(({ isAdmin, onMapClick }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null);

  // Keep refs to avoid map reinitialization on prop change
  const isAdminRef = useRef(isAdmin);
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { isAdminRef.current = isAdmin; }, [isAdmin]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  const fetchLocations = () => {
    fetch('/api/locations')
      .then(res => res.json())
      .then(setLocations)
      .catch(err => console.error('Failed to fetch locations:', err));
  };

  useImperativeHandle(ref, () => ({
    flyTo: (coords: [number, number], zoom = 10) => {
      map.current?.flyTo({ center: coords, zoom, duration: 2000, essential: true });
    },
    refresh: () => {
      fetchLocations();
    }
  }));

  useEffect(() => {
    fetchLocations();
  }, []);

  // Register global gallery opener so popup HTML can trigger it
  useEffect(() => {
    (window as any).__openMapGallery = (imagesJson: string) => {
      try {
        setGalleryImages(JSON.parse(imagesJson));
      } catch { /* noop */ }
    };
    return () => { delete (window as any).__openMapGallery; };
  }, []);

  // Initialize Map only once (empty deps - use refs for isAdmin/onMapClick)
  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [0, 20],
        zoom: 1.5,
        projection: { name: 'globe' },
        antialias: true
      });

      map.current.on('load', () => {
        if (!map.current) return;
        map.current.resize();
        map.current.setFog({
          color: 'rgb(186, 210, 235)',
          'high-color': 'rgb(36, 92, 223)',
          'horizon-blend': 0.02,
          'space-color': 'rgb(11, 11, 25)',
          'star-intensity': 0.6
        });
      });

      map.current.on('click', (e) => {
        if (isAdminRef.current && onMapClickRef.current) {
          onMapClickRef.current(e.lngLat);
        }
      });

      const handleResize = () => map.current?.resize();
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        map.current?.remove();
        map.current = null;
      };
    } catch (error) {
      console.error('Mapbox initialization error:', error);
    }
  }, []); // Empty deps: map init once, click handler via refs

  // Update markers when locations change
  useEffect(() => {
    if (!map.current) return;

    markers.current.forEach(m => m.remove());
    markers.current = [];

    locations.forEach((loc) => {
      const thumbnail = loc.images[0] ? `${loc.images[0]}?w=400&q=75` : '';
      const imagesJson = JSON.stringify(loc.images).replace(/'/g, "\\'");
      const extraCount = loc.images.length - 1;

      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        className: 'custom-popup'
      }).setHTML(
        `<div class="p-2 text-gray-900 min-w-[220px]">
          ${thumbnail ? `
          <div class="relative mb-2">
            <img
              src="${thumbnail}"
              class="w-full h-36 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onclick="window.__openMapGallery('${imagesJson.replace(/"/g, '&quot;')}')"
            />
            ${extraCount > 0 ? `<span class="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">+${extraCount}</span>` : ''}
          </div>
          ` : ''}
          <h3 class="font-bold text-base leading-tight">${loc.name}</h3>
          <p class="text-[10px] text-gray-500 mb-1 uppercase font-bold tracking-wider">${loc.date}</p>
          <p class="text-sm text-gray-700 leading-relaxed">${loc.description}</p>
        </div>`
      );

      const marker = new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat(loc.coordinates)
        .setPopup(popup)
        .addTo(map.current!);

      markers.current.push(marker);
    });
  }, [locations]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="w-full h-screen bg-neutral-900 flex items-center justify-center text-white p-8 text-center">
        <div className="max-w-md space-y-4">
          <h2 className="text-2xl font-bold">Mapbox Token Required</h2>
          <p className="text-neutral-400">Please add your Mapbox Access Token to the environment variables.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={mapContainer} className="w-full h-screen" />
      {galleryImages && (
        <GalleryModal images={galleryImages} onClose={() => setGalleryImages(null)} />
      )}
    </>
  );
});
