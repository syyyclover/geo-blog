import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Location } from '@/src/types';
import { GalleryModal } from './GalleryModal';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || (process.env as any).VITE_MAPBOX_ACCESS_TOKEN;

//function cfThumb(originalUrl: string, width = 400, quality = 75): string {
//  if (!originalUrl) return '';
//  if (import.meta.env.DEV) return originalUrl;
//  return `/cdn-cgi/image/width=${width},quality=${quality},format=auto/${originalUrl}`;
//}
function cfThumb(originalUrl: string, width = 400, quality = 75): string {
  if (!originalUrl) return '';
  if (import.meta.env.DEV) return originalUrl;
  if (originalUrl.startsWith('/') && !originalUrl.startsWith('//')) {
    return originalUrl;
  }
  return `/cdn-cgi/image/width=${width},quality=${quality},format=auto/${originalUrl}`;
}

interface MapContainerProps {
  isAdmin?: boolean;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  onLocationsLoaded?: (locations: Location[]) => void;
  isCruising?: boolean;
}

export interface MapRef {
  flyTo: (coords: [number, number], zoom?: number) => void;
  cruiseFlyTo: (
    coords: [number, number],
    zoom: number,
    bearing: number,
    pitch: number,
    isInitialJump?: boolean
  ) => Promise<void>;
  refresh: () => void;
}

// rAF-throttled move handler: only sample at most once per animation frame
let rafHandle = 0;

export const MapContainer = forwardRef<MapRef, MapContainerProps>(
  ({ isAdmin, onMapClick, onLocationsLoaded, isCruising }, ref) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map          = useRef<mapboxgl.Map | null>(null);
    const markers      = useRef<mapboxgl.Marker[]>([]);

    // Plane & route — kept as simple DOM/ref state, never triggers React renders
    const planeEl        = useRef<HTMLDivElement | null>(null);
    const planeMarker    = useRef<mapboxgl.Marker | null>(null);
    const routeCoords    = useRef<[number, number][]>([]);
    const moveListenerRef = useRef<(() => void) | null>(null);
    const rafPending     = useRef(false);
    const rafSkip        = useRef(0); // skip counter for additional throttle

    const [locations,    setLocations]    = useState<Location[]>([]);
    const [galleryImages,setGalleryImages]= useState<string[] | null>(null);

    const isAdminRef     = useRef(isAdmin);
    const onMapClickRef  = useRef(onMapClick);
    useEffect(() => { isAdminRef.current    = isAdmin;    }, [isAdmin]);
    useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

    // ── helpers ──────────────────────────────────────────────────────────────
    const hidePlane = () => {
      if (planeEl.current) {
        planeEl.current.style.opacity = '0';
        planeEl.current.style.visibility = 'hidden';
        planeEl.current.style.pointerEvents = 'none';
      }
    };
    const showPlane = () => {
      if (planeEl.current) {
        planeEl.current.style.visibility = 'visible';
        planeEl.current.style.opacity = '1';
        planeEl.current.style.pointerEvents = 'auto';
      }
    };
    const setRouteData = (coords: [number, number][]) => {
      const src = map.current?.getSource('cruise-route') as mapboxgl.GeoJSONSource | undefined;
      src?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
    };
    const clearRoute = () => { routeCoords.current = []; setRouteData([]); };

    const fetchLocations = () => {
      fetch('/api/locations')
        .then(r => r.json())
        .then(data => { setLocations(data); onLocationsLoaded?.(data); })
        .catch(e => console.error('Failed to fetch locations:', e));
    };

    // ── imperative API ────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      flyTo: (coords, zoom = 10) => {
        map.current?.flyTo({ center: coords, zoom, duration: 2000, essential: true });
      },

      cruiseFlyTo: (coords, zoom, bearing, pitch, isInitialJump = false) =>
        new Promise<void>(resolve => {
          if (!map.current) return resolve();

          // Cancel previous move listener
          if (moveListenerRef.current) {
            map.current.off('move', moveListenerRef.current);
            moveListenerRef.current = null;
          }
          if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = 0; }
          rafPending.current = false;
          rafSkip.current = 0;

          if (isInitialJump) {
            clearRoute();
            hidePlane();
            map.current.once('moveend', () => resolve());
            // curve:1 = no zoom-out arc; just a flat pan
            map.current.flyTo({ center: coords, zoom, bearing, pitch, duration: 1800, curve: 1, essential: true });
            return;
          }

          const start = map.current.getCenter();
          const dist  = start.distanceTo(new mapboxgl.LngLat(coords[0], coords[1]));

          // Duration: short flights fast, very long ones capped at 6 s
          const duration = dist < 100_000  ? 2500
                         : dist < 800_000  ? 3500
                         : Math.min(4000 + (dist / 1_000_000) * 600, 6000);

          routeCoords.current = [[start.lng, start.lat]];
          planeMarker.current?.setLngLat([start.lng, start.lat]);
          showPlane();

          // rAF-throttled move sampler
          // Plane marker position: every frame (smooth)
          // Route line GeoJSON: every 3rd frame (reduce GPU churn)
          const onMove = () => {
            if (rafPending.current) return;
            rafPending.current = true;
            rafHandle = requestAnimationFrame(() => {
              rafPending.current = false;
              rafHandle = 0;
              if (!map.current) return;

              const cur  = map.current.getCenter();
              const last = routeCoords.current[routeCoords.current.length - 1];
              const dx = cur.lng - last[0], dy = cur.lat - last[1];
              // ~1 km threshold — skip micro-movements
              if (dx * dx + dy * dy < 1e-4) return;

              // Bearing for plane icon (fast approximation)
              const brng = Math.atan2(dx * Math.cos(last[1] * Math.PI / 180), dy) * 180 / Math.PI;
              planeMarker.current?.setRotation(brng);
              planeMarker.current?.setLngLat([cur.lng, cur.lat]);

              // Route line updated every 3rd frame to reduce GeoJSON churn
              rafSkip.current = (rafSkip.current + 1) % 3;
              if (rafSkip.current !== 0) return;

              routeCoords.current.push([cur.lng, cur.lat]);

              // Hard cap: keep last 40 points
              if (routeCoords.current.length > 40) {
                routeCoords.current = routeCoords.current.slice(-40);
              }

              setRouteData(routeCoords.current);
            });
          };

          moveListenerRef.current = onMove;
          map.current.on('move', onMove);

          map.current.once('moveend', () => {
            if (moveListenerRef.current) {
              map.current?.off('move', moveListenerRef.current);
              moveListenerRef.current = null;
            }
            if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = 0; }
            rafPending.current = false;
            resolve();
          });

          // curve:1 eliminates the zoom-out arc that causes tile-404 spam
          map.current.flyTo({
            center: coords, zoom, bearing, pitch, duration,
            curve: 1,
            essential: true,
            easing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t, // easeInOutQuad
          });
        }),

      refresh: fetchLocations,
    }));

    // Hide plane when cruise is not active
    useEffect(() => {
      if (!isCruising) { clearRoute(); hidePlane(); }
    }, [isCruising]);

    useEffect(() => { fetchLocations(); }, []);

    useEffect(() => {
      (window as any).__openMapGallery = (json: string) => {
        try { setGalleryImages(JSON.parse(json)); } catch { /* noop */ }
      };
      return () => { delete (window as any).__openMapGallery; };
    }, []);

    // ── Map init (runs once) ─────────────────────────────────────────────────
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
          antialias: true,
          minZoom: 1,
          fadeDuration: 0,          // disable tile fade-in for better perf during cruise
        });

        // Silence ALL map errors (tile 404s, network errors, etc.)
        map.current.on('error', () => {});

        map.current.on('load', () => {
          if (!map.current) return;
          map.current.resize();

          map.current.setFog({
            color: 'rgb(186, 210, 235)',
            'high-color': 'rgb(36, 92, 223)',
            'horizon-blend': 0.02,
            'space-color': 'rgb(11, 11, 25)',
            'star-intensity': 0.6,
          });

          // ── Cruise route source + layers ───────────────────────────────────
          map.current.addSource('cruise-route', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
          });

          map.current.addLayer({
            id: 'cruise-route-glow', type: 'line', source: 'cruise-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#60a5fa', 'line-width': 8, 'line-opacity': 0.12, 'line-blur': 6 },
          });
          map.current.addLayer({
            id: 'cruise-route-line', type: 'line', source: 'cruise-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#93c5fd', 'line-width': 2, 'line-dasharray': [3, 3], 'line-opacity': 0.85 },
          });

          // ── Plane marker (hidden on init) ──────────────────────────────────
          const el = document.createElement('div');
          el.style.cssText =
            'opacity:0;visibility:hidden;pointer-events:none;will-change:transform;' +
            'filter:drop-shadow(0 0 6px rgba(96,165,250,0.9));';
          el.innerHTML = `<div style="transform:rotate(-45deg)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"
                 stroke="#60a5fa" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21.5 4s-2 .5-3.5 2L14.5 9.5
                       6.3 7.7c-.9-.2-1.9.3-2.5 1.1L2.5 11c-.3.6 0 1.2.5 1.5l5.5 2.5-3 3
                       -3-.5c-.5-.1-1 .2-1.2.7l-.8 1.5c-.2.5.2 1 .8 1l4.5 1 1 4.5
                       c.1.6.6.9 1 .8l1.5-.8c.5-.2.8-.7.7-1.2l-.5-3 3-3 2.5 5.5
                       c.3.5.9.8 1.5.5l2.2-1.3c.8-.6 1.3-1.6 1.1-2.5z"/>
            </svg></div>`;
          planeEl.current = el;
          planeMarker.current = new mapboxgl.Marker({
            element: el, rotationAlignment: 'map', pitchAlignment: 'map',
          }).setLngLat([0, 0]).addTo(map.current);
        });

        map.current.on('click', e => {
          if (isAdminRef.current && onMapClickRef.current) onMapClickRef.current(e.lngLat);
        });

        const onResize = () => map.current?.resize();
        window.addEventListener('resize', onResize);
        return () => {
          window.removeEventListener('resize', onResize);
          if (rafHandle) cancelAnimationFrame(rafHandle);
          map.current?.remove();
          map.current = null;
        };
      } catch (e) { console.error('Mapbox init error:', e); }
    }, []);

    // ── Markers ───────────────────────────────────────────────────────────────
    useEffect(() => {
      if (!map.current) return;
      markers.current.forEach(m => m.remove());
      markers.current = [];

      locations.forEach(loc => {
        if (!loc.images?.length) return;
        const thumb     = cfThumb(loc.images[0]);
        const imgAttr   = JSON.stringify(loc.images).replace(/"/g, '&quot;');
        const extraCount= loc.images.length - 1;

        const popup = new mapboxgl.Popup({ offset: 25, closeButton: true, closeOnClick: false, className: 'custom-popup' })
          .setHTML(`<div class="p-2 text-gray-900 min-w-[220px]">
            <div class="relative mb-2">
              <img src="${thumb}" class="w-full h-36 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                   loading="lazy" onclick="window.__openMapGallery('${imgAttr}')" />
              ${extraCount > 0 ? `<span class="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">+${extraCount}</span>` : ''}
            </div>
            <h3 class="font-bold text-base leading-tight">${loc.name}</h3>
            <p class="text-[10px] text-gray-500 mb-1 uppercase font-bold tracking-wider">${loc.date}</p>
            <p class="text-sm text-gray-700 leading-relaxed">${loc.description}</p>
          </div>`);

        markers.current.push(
          new mapboxgl.Marker({ color: '#3b82f6' })
            .setLngLat(loc.coordinates)
            .setPopup(popup)
            .addTo(map.current!)
        );
      });
    }, [locations]);

    if (!MAPBOX_TOKEN) return (
      <div className="w-full h-screen bg-neutral-900 flex items-center justify-center text-white">
        <p>Mapbox Token Required</p>
      </div>
    );

    return (
      <>
        <div ref={mapContainer} className="w-full h-screen" />
        {galleryImages && !isCruising && (
          <GalleryModal images={galleryImages} onClose={() => setGalleryImages(null)} />
        )}
      </>
    );
  }
);
