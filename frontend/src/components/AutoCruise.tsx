import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plane, ChevronLeft, ChevronRight, Pause, Play, ChevronDown, X, MapPin, Clock } from "lucide-react";
import { Location } from "@/src/types";

//function cfThumb(url: string, width = 800, quality = 85): string {
//  if (!url) return '';
//  if (import.meta.env.DEV) return url;
//  return `/cdn-cgi/image/width=${width},quality=${quality},format=auto/${url}`;
//}
function cfThumb(url: string, width = 800, quality = 85): string {
  if (!url) return '';
  if (import.meta.env.DEV) return url;
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url;
  }
  return `/cdn-cgi/image/width=${width},quality=${quality},format=auto/${url}`;
}

interface AutoCruiseProps {
  locations: Location[];
  onFlyTo: (coords: [number, number], zoom: number, bearing: number, pitch: number, isInitialJump?: boolean) => Promise<void>;
  onCruiseStateChange: (active: boolean) => void;
}

// ── Location card shown at bottom after arriving ──────────────────────────────
function LocationCard({ location, onClose }: { location: Location; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const thumb = location.images[0] ? cfThumb(location.images[0]) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: "spring", stiffness: 340, damping: 32 }}
      // Mobile: flush to screen edges at very bottom
      // sm+: centred card floating above the map chrome
      className={[
        "fixed z-[90] pointer-events-auto",
        // mobile — full width, no side margin
        "bottom-0 left-0 right-0",
        // sm+ — centred floating card
        "sm:bottom-8 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-80",
      ].join(" ")}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className={[
        "overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl text-white",
        // square corners on mobile (flush), rounded on sm+
        "rounded-none sm:rounded-2xl",
      ].join(" ")}>
        {thumb && (
          <div className="relative overflow-hidden h-28 sm:h-44">
            <img
              src={thumb}
              alt={location.name}
              onLoad={() => setLoaded(true)}
              className={`w-full h-full object-cover transition-transform duration-700 ${loaded ? "scale-100" : "scale-105"}`}
            />
            {!loaded && <div className="absolute inset-0 bg-white/5 animate-pulse" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            {location.images.length > 1 && (
              <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] font-bold border border-white/10">
                +{location.images.length - 1}
              </div>
            )}
            {/* Close button visible on mobile (inside image) */}
            <button
              onClick={onClose}
              className="sm:hidden absolute top-3 left-3 w-7 h-7 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white/70"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <h3 className="absolute bottom-3 left-4 right-4 font-bold text-base sm:text-lg leading-tight drop-shadow-lg">
              {location.name}
            </h3>
          </div>
        )}

        <div className="px-4 pt-3 pb-3 space-y-1.5" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}>
          {!thumb && <h3 className="font-bold text-base">{location.name}</h3>}
          <div className="flex items-center gap-3 text-white/50 text-[11px]">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-blue-400/70" />{location.date}</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-blue-400/70" />
              {location.coordinates[1].toFixed(2)}°, {location.coordinates[0].toFixed(2)}°
            </span>
          </div>
          <p className="text-white/60 text-xs leading-relaxed line-clamp-2">{location.description}</p>
        </div>

        {/* progress bar */}
        <div className="h-0.5 bg-white/10">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-300"
            initial={{ width: "0%" }} animate={{ width: "100%" }}
            transition={{ duration: 5, ease: "linear" }}
          />
        </div>
      </div>

      {/* close — only visible sm+ */}
      <button
        onClick={onClose}
        className="hidden sm:flex absolute -top-2.5 -right-2.5 w-7 h-7 bg-black/40 hover:bg-white/10 backdrop-blur-md border border-white/20 rounded-full items-center justify-center text-white/60 hover:text-white transition-all"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ── AutoCruise panel ──────────────────────────────────────────────────────────
export function AutoCruise({ locations, onFlyTo, onCruiseStateChange }: AutoCruiseProps) {
  const [isActive,    setIsActive]    = useState(false);
  const [isPaused,    setIsPaused]    = useState(false);
  const [collapsed,   setCollapsed]   = useState(false);
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [showCard,    setShowCard]    = useState(false);
  const [isCruising,  setIsCruising]  = useState(false);

  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preloaded       = useRef<Set<string>>(new Set());
  const flightId        = useRef(0);
  // Stable refs that callbacks can read without stale closure issues
  const isPausedRef     = useRef(false);
  const isActiveRef     = useRef(false);
  const showCardRef     = useRef(false);
  const currentIdxRef   = useRef(0);
  const flyRef          = useRef<(idx: number, jump?: boolean) => Promise<void>>();

  useEffect(() => { isPausedRef.current   = isPaused;    }, [isPaused]);
  useEffect(() => { isActiveRef.current   = isActive;    }, [isActive]);
  useEffect(() => { showCardRef.current   = showCard;    }, [showCard]);
  useEffect(() => { currentIdxRef.current = currentIdx;  }, [currentIdx]);

  const sorted = [...locations].sort((a, b) => a.date.localeCompare(b.date));

  const preloadThumb = useCallback((idx: number) => {
    const img0 = sorted[idx]?.images[0];
    if (!img0) return;
    const url = cfThumb(img0);
    if (preloaded.current.has(url)) return;
    if (preloaded.current.size > 30) preloaded.current.clear(); // prevent unbounded growth
    preloaded.current.add(url);
    const el = new Image(); el.src = url;
  }, [sorted]);

  const scheduleNext = useCallback((arrivedIdx: number, fid: number) => {
    timerRef.current = setTimeout(() => {
      if (fid !== flightId.current || !isActiveRef.current || isPausedRef.current) return;
      setShowCard(false);
      const next = arrivedIdx + 1;
      if (next < sorted.length) { setCurrentIdx(next); flyRef.current?.(next); }
      else { setIsActive(false); setCurrentIdx(0); onCruiseStateChange(false); }
    }, 5500);
  }, [sorted.length, onCruiseStateChange]);

  const flyTo = useCallback(async (idx: number, isJump = false) => {
    if (!sorted[idx]) return;
    const loc = sorted[idx];
    const fid = ++flightId.current;

    let bearing = 0;
    if (idx > 0 && !isJump) {
      const prev = sorted[idx - 1];
      const dlng = loc.coordinates[0] - prev.coordinates[0];
      const dlat = loc.coordinates[1] - prev.coordinates[1];
      bearing = Math.atan2(dlng, dlat) * 180 / Math.PI;
    }

    setIsCruising(true);
    setShowCard(false);
    preloadThumb(idx + 1);

    await onFlyTo([loc.coordinates[0], loc.coordinates[1]], 9, bearing, 40, isJump);

    if (fid !== flightId.current || !isActiveRef.current) return;
    setIsCruising(false);
    setShowCard(true);
    if (!isPausedRef.current) scheduleNext(idx, fid);
  }, [sorted, onFlyTo, preloadThumb, scheduleNext]);

  useEffect(() => { flyRef.current = flyTo; }, [flyTo]);

  const start = useCallback(() => {
    setIsActive(true); setIsPaused(false);
    onCruiseStateChange(true);
    preloadThumb(currentIdx); preloadThumb(currentIdx + 1);
    flyTo(currentIdx, true);
  }, [currentIdx, flyTo, preloadThumb, onCruiseStateChange]);

  const stop = useCallback(() => {
    flightId.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsActive(false); setIsPaused(false);
    setShowCard(false); setIsCruising(false);
    onCruiseStateChange(false);
  }, [onCruiseStateChange]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      const nowPaused = !prev;
      if (nowPaused) {
        if (timerRef.current) clearTimeout(timerRef.current);
      } else {
        // resuming
        if (showCardRef.current) {
          // re-arm advance timer
          scheduleNext(currentIdxRef.current, flightId.current);
        } else {
          // mid-flight when paused — restart the leg
          flyRef.current?.(currentIdxRef.current);
        }
      }
      return nowPaused;
    });
  }, [scheduleNext]);

  const goTo = useCallback((raw: number) => {
    const idx = Math.max(0, Math.min(sorted.length - 1, raw));
    flightId.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowCard(false); setIsCruising(false); setCurrentIdx(idx);
    if (isActiveRef.current) {
      const wasPaused = isPausedRef.current;
      isPausedRef.current = false; setIsPaused(false);
      flyTo(idx, true).then(() => { if (wasPaused) { setIsPaused(true); } });
    }
  }, [sorted.length, flyTo]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (locations.length === 0) return null;

  // ── Collapsed pill — identical look to NextDestination pill ──────────────
  if (collapsed) return (
    <>
      <motion.button
        key="ac-pill"
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ type: "tween", duration: 0.15 }}
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-2 px-3 py-2
                   bg-white/10 backdrop-blur-xl border border-white/20
                   rounded-full shadow-lg text-white
                   hover:bg-white/15 transition-colors"
      >
        <Plane className={`w-3 h-3 ${isActive ? "text-blue-400" : ""}`} />
        <span className="text-xs font-semibold">Cruise</span>
        {isActive && !isPaused && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        )}
      </motion.button>

      <AnimatePresence>
        {showCard && sorted[currentIdx] && (
          <LocationCard location={sorted[currentIdx]} onClose={() => setShowCard(false)} />
        )}
      </AnimatePresence>
    </>
  );

  // ── Expanded panel — mirrors NextDestination card token-for-token ─────────
  return (
    <>
      <motion.div
        key="ac-panel"
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ type: "tween", duration: 0.18, ease: "easeOut" }}
        className="w-full"
      >
        <div
          className="p-3 sm:p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white"
          style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
        >
          {/* Header — same layout as NextDestination */}
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white/50 flex items-center gap-1.5">
              <Plane className={`w-3.5 h-3.5 ${isActive ? "text-blue-400" : "text-white/40"}`} />
              Auto Cruise
            </span>
            <button onClick={() => setCollapsed(true)} className="p-0.5 rounded-full hover:bg-white/10 transition-colors" aria-label="Collapse">
              <ChevronDown className="w-3.5 h-3.5 text-white/40" />
            </button>
          </div>

          {/* Current destination info */}
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 text-xl sm:text-2xl">
              <Plane className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? "text-blue-400" : "text-white/20"}`} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white leading-tight truncate text-sm sm:text-base">
                {sorted[currentIdx]?.name ?? "—"}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-white/50 mt-0.5">
                {currentIdx + 1} / {sorted.length}
                {isCruising && <span className="ml-1.5 text-blue-400">· flying…</span>}
              </p>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-1 mb-2 sm:mb-3 h-1.5">
            {sorted.map((_, i) => (
              <button key={i} onClick={() => goTo(i)}
                className="relative flex-1 h-full rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                {i < currentIdx  && <div className="absolute inset-0 bg-blue-500/50 rounded-full" />}
                {i === currentIdx && <motion.div className="absolute inset-0 bg-blue-400 rounded-full" layoutId="ac-dot" />}
              </button>
            ))}
          </div>

          {/* Controls — same height as NextDestination countdown badge */}
          <div className="flex items-center gap-1.5 px-0 py-0">
            <button
              onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0}
              className="p-1.5 sm:p-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-colors border border-white/5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {!isActive ? (
              <button onClick={start}
                className="flex-1 py-1.5 sm:py-2 bg-blue-500 hover:bg-blue-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-blue-500/20 border border-blue-400/20"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Start
              </button>
            ) : (
              <>
                <button onClick={togglePause}
                  className={`flex-1 py-1.5 sm:py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border ${
                    isPaused
                      ? "bg-blue-500 hover:bg-blue-400 border-blue-400/20 shadow-lg shadow-blue-500/20"
                      : "bg-white/10 hover:bg-white/15 border-white/10"
                  }`}
                >
                  {isPaused
                    ? <><Play  className="w-3.5 h-3.5 fill-current" /> Resume</>
                    : <><Pause className="w-3.5 h-3.5 fill-current" /> Pause</>}
                </button>
                <button onClick={stop}
                  className="p-1.5 sm:p-2 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-colors border border-white/5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              onClick={() => goTo(currentIdx + 1)} disabled={currentIdx === sorted.length - 1}
              className="p-1.5 sm:p-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-colors border border-white/5"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showCard && sorted[currentIdx] && (
          <LocationCard location={sorted[currentIdx]} onClose={() => setShowCard(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
