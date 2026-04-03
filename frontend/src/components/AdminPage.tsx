import React, { useState, useRef, useEffect, useCallback } from "react";
import { MapContainer, MapRef } from "./MapContainer";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Save, MapPin, Calendar, Image as ImageIcon, Type, Search,
  Loader2, Plane, Flag, Edit3, Check
} from "lucide-react";
import { authFetch } from "@/src/lib/auth";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || (process.env as any).VITE_MAPBOX_ACCESS_TOKEN;

export function AdminPage() {
  const mapRef = useRef<MapRef>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    imageUrls: ""
  });

  // NextDestination editor state
  const [showNextDestEditor, setShowNextDestEditor] = useState(false);
  const [nextDest, setNextDest] = useState({ name: "", flag: "", startDate: "", targetDate: "" });
  const [savingNextDest, setSavingNextDest] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then(r => r.json())
      .then(data => {
        if (data.nextDestination) setNextDest(data.nextDestination);
      })
      .catch(() => {});
  }, []);

  // useCallback prevents map re-init on every render
  const handleMapClick = useCallback((lngLat: { lng: number; lat: number }) => {
    setSelectedCoords(lngLat);
  }, []);

  const searchLocation = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5`
      );
      const data = await res.json();
      setSearchResults(data.features || []);
      setShowResults(true);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Search triggers on name change (regardless of whether coords are set)
  useEffect(() => {
    if (!isNameFocused) return;
    const timer = setTimeout(() => {
      if (formData.name.length >= 2) {
        searchLocation(formData.name);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.name, isNameFocused]);

  const handleSelectResult = (result: any) => {
    const [lng, lat] = result.center;
    setSelectedCoords({ lng, lat });
    setFormData(prev => ({ ...prev, name: result.place_name }));
    setSearchResults([]);
    setShowResults(false);
    mapRef.current?.flyTo([lng, lat], 12);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoords) return;

    const images = formData.imageUrls
      .split("\n")
      .map(url => url.trim())
      .filter(Boolean);

    const newLocation = {
      name: formData.name,
      coordinates: [selectedCoords.lng, selectedCoords.lat],
      date: formData.date,
      description: formData.description,
      images: images.length > 0 ? images : ["https://picsum.photos/seed/new/800/600"]
    };

    try {
      const res = await authFetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLocation)
      });

      if (res.ok) {
        setSelectedCoords(null);
        setFormData({
          name: "",
          date: new Date().toISOString().split("T")[0],
          description: "",
          imageUrls: ""
        });
        mapRef.current?.refresh();
      }
    } catch (error) {
      console.error("Failed to save location:", error);
    }
  };

  const handleSaveNextDest = async () => {
    setSavingNextDest(true);
    try {
      await authFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextDestination: nextDest })
      });
      setShowNextDestEditor(false);
    } catch (err) {
      console.error("Failed to save config:", err);
    } finally {
      setSavingNextDest(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <MapContainer ref={mapRef} isAdmin onMapClick={handleMapClick} />

      {/* Admin tip panel */}
      <div className="absolute top-24 left-8 z-40 hidden md:flex flex-col gap-3">
        <div className="p-4 bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl text-white max-w-xs shadow-2xl">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" /> Admin Mode
          </h2>
          <p className="text-xs text-white/60 leading-relaxed">
            在名称框搜索地点，或直接点击地图添加足迹。
          </p>
        </div>

        {/* Next Destination editor toggle */}
        <button
          onClick={() => setShowNextDestEditor(v => !v)}
          className="flex items-center gap-2 px-4 py-3 bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl text-white text-sm font-medium hover:bg-white/10 transition-all shadow-2xl"
        >
          <Plane className="w-4 h-4 text-blue-400" />
          编辑下一个目的地
          <Edit3 className="w-3.5 h-3.5 text-white/40 ml-auto" />
        </button>
      </div>

      {/* Next Destination Editor Drawer */}
      <AnimatePresence>
        {showNextDestEditor && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="absolute top-24 left-8 z-50 w-80 md:top-[calc(6rem+9rem)] bg-black/80 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 shadow-2xl text-white"
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Plane className="w-4 h-4 text-blue-400" /> Next Destination
              </h3>
              <button onClick={() => setShowNextDestEditor(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1">
                  <Type className="w-3 h-3" /> 目的地名称
                </label>
                <input
                  type="text"
                  value={nextDest.name}
                  onChange={e => setNextDest(p => ({ ...p, name: e.target.value }))}
                  placeholder="Reykjavik, Iceland"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1">
                  <Flag className="w-3 h-3" /> 国旗 Emoji
                </label>
                <input
                  type="text"
                  value={nextDest.flag}
                  onChange={e => setNextDest(p => ({ ...p, flag: e.target.value }))}
                  placeholder="🇮🇸"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> 开始日期
                  </label>
                  <input
                    type="date"
                    value={nextDest.startDate}
                    onChange={e => setNextDest(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> 目标日期
                  </label>
                  <input
                    type="date"
                    value={nextDest.targetDate}
                    onChange={e => setNextDest(p => ({ ...p, targetDate: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {nextDest.startDate && nextDest.targetDate && (
                <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-[10px] text-blue-300/70">
                    当前进度：{Math.min(100, Math.max(0, Math.round(
                      (Date.now() - new Date(nextDest.startDate).getTime()) /
                      (new Date(nextDest.targetDate).getTime() - new Date(nextDest.startDate).getTime()) * 100
                    )))}%
                  </p>
                </div>
              )}

              <button
                onClick={handleSaveNextDest}
                disabled={savingNextDest}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
              >
                {savingNextDest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                保存
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Footprint Form Drawer */}
      <AnimatePresence>
        {selectedCoords && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="absolute inset-y-0 right-0 z-50 w-full md:w-[420px] p-6 flex items-center"
          >
            <div className="bg-black/80 backdrop-blur-3xl border-l border-white/10 h-[85vh] w-full rounded-3xl md:rounded-r-none md:rounded-l-3xl p-8 shadow-2xl text-white overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">New Footprint</h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    {selectedCoords.lng.toFixed(4)}, {selectedCoords.lat.toFixed(4)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedCoords(null);
                    setFormData(prev => ({ ...prev, name: "" }));
                    setSearchResults([]);
                    setShowResults(false);
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Location Name with search */}
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Type className="w-3 h-3" /> 地点名称
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      onFocus={() => setIsNameFocused(true)}
                      onBlur={() => setTimeout(() => { setIsNameFocused(false); setShowResults(false); }, 200)}
                      placeholder="搜索或输入地点名称..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isSearching
                        ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        : <Search className="w-4 h-4 text-white/20" />
                      }
                    </div>
                  </div>

                  <AnimatePresence>
                    {showResults && searchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute top-full left-0 right-0 mt-1 z-50 bg-neutral-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto"
                      >
                        {searchResults.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            onMouseDown={() => handleSelectResult(result)}
                            className="w-full px-4 py-3 text-left text-xs text-white/80 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 flex items-center gap-2"
                          >
                            <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            {result.place_name}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> 游玩日期
                  </label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Image URLs - multiple */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <ImageIcon className="w-3 h-3" /> 图片 URLs（每行一个）
                  </label>
                  <textarea
                    value={formData.imageUrls}
                    onChange={e => setFormData({ ...formData, imageUrls: e.target.value })}
                    placeholder={"https://r2.yourdomain.com/photo1.jpg\nhttps://r2.yourdomain.com/photo2.jpg"}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none font-mono text-xs"
                  />
                  {formData.imageUrls && (
                    <p className="text-[10px] text-white/30">
                      {formData.imageUrls.split("\n").filter(u => u.trim()).length} 张图片
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">详细描述</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="记录这个地方的故事..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl active:scale-[0.98]"
                  >
                    <Save className="w-5 h-5" /> 保存足迹
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Initial Search Bar (shown when no point is selected) */}
      {!selectedCoords && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              {isSearching ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> : <Search className="w-4 h-4 text-white/40" />}
            </div>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              onFocus={() => setIsNameFocused(true)}
              onBlur={() => setTimeout(() => { setIsNameFocused(false); setShowResults(false); }, 200)}
              placeholder="搜索地点并添加..."
              className="w-full bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all shadow-2xl"
            />

            <AnimatePresence>
              {showResults && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full mt-2 w-full bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                >
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onMouseDown={() => handleSelectResult(result)}
                      className="w-full px-4 py-3 text-left text-sm text-white/80 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 flex items-center gap-2"
                    >
                      <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                      {result.place_name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
