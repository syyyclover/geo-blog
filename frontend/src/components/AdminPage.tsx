import React, { useState, useRef, useEffect, useCallback } from "react";
import { MapContainer, MapRef } from "./MapContainer";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Save, MapPin, Calendar, Image as ImageIcon, Type, Search,
  Loader2, Plane, Flag, Edit3, Check, List, Trash2, ChevronLeft
} from "lucide-react";
import { authFetch } from "@/src/lib/auth";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || (process.env as any).VITE_MAPBOX_ACCESS_TOKEN;

interface Location {
  id: string;
  name: string;
  coordinates: [number, number];
  date: string;
  description: string;
  images: string[];
}

type PanelMode = "none" | "add" | "list" | "edit";

/**
 * Cloudflare Image Resizing 转换工具
 */
//function cfThumb(originalUrl: string, width = 200, quality = 75): string {
//  if (!originalUrl) return '';
  // 开发环境直接返回原图
//  if (import.meta.env.DEV) return originalUrl;
  
//  const options = `width=${width},quality=${quality},format=auto`;
//  return `/cdn-cgi/image/${options}/${originalUrl}`;
//}
function cfThumb(originalUrl: string, width = 200, quality = 75): string {
  if (!originalUrl) return '';
  if (import.meta.env.DEV) return originalUrl;
  if (originalUrl.startsWith('/') && !originalUrl.startsWith('//')) {
    return originalUrl;
  }
  const options = `width=${width},quality=${quality},format=auto`;
  return `/cdn-cgi/image/${options}/${originalUrl}`;
}
export function AdminPage() {
  const mapRef = useRef<MapRef>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("none");
  const [locations, setLocations] = useState<Location[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const emptyForm = {
    name: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    imageUrls: ""
  };
  const [formData, setFormData] = useState(emptyForm);

  // NextDestination editor state
  const [showNextDestEditor, setShowNextDestEditor] = useState(false);
  const [nextDest, setNextDest] = useState({ name: "", flag: "", startDate: "", targetDate: "" });
  const [savingNextDest, setSavingNextDest] = useState(false);

  const fetchLocations = useCallback(() => {
    fetch("/api/locations")
      .then(r => r.json())
      .then(setLocations)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchLocations();
    fetch("/api/config")
      .then(r => r.json())
      .then(data => { if (data.nextDestination) setNextDest(data.nextDestination); })
      .catch(() => {});
  }, [fetchLocations]);

  // When clicking map, open add panel
  const handleMapClick = useCallback((lngLat: { lng: number; lat: number }) => {
    setSelectedCoords(lngLat);
    setEditingLocation(null);
    setFormData(emptyForm);
    setPanelMode("add");
  }, []);

  const searchLocation = async (query: string) => {
    if (!query || query.length < 2) { setSearchResults([]); setShowResults(false); return; }
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5`
      );
      const data = await res.json();
      setSearchResults(data.features || []);
      setShowResults(true);
    } catch { /* noop */ } finally { setIsSearching(false); }
  };

  useEffect(() => {
    if (!isNameFocused) return;
    const timer = setTimeout(() => {
      formData.name.length >= 2 ? searchLocation(formData.name) : (setSearchResults([]), setShowResults(false));
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
    if (!selectedCoords && !editingLocation) return;

    const images = formData.imageUrls.split("\n").map(u => u.trim()).filter(Boolean);
    const coords = selectedCoords
      ? [selectedCoords.lng, selectedCoords.lat]
      : editingLocation!.coordinates;

    const payload = {
      name: formData.name,
      coordinates: coords,
      date: formData.date,
      description: formData.description,
      images: images.length > 0 ? images : ["https://picsum.photos/seed/new/800/600"]
    };

    if (editingLocation) {
      // Delete old then re-add (simple edit strategy)
      await authFetch(`/api/locations/${editingLocation.id}`, { method: "DELETE" });
      await authFetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      await authFetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    setSelectedCoords(null);
    setEditingLocation(null);
    setFormData(emptyForm);
    setPanelMode("list");
    fetchLocations();
    mapRef.current?.refresh();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await authFetch(`/api/locations/${id}`, { method: "DELETE" });
      fetchLocations();
      mapRef.current?.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditLocation = (loc: Location) => {
    setEditingLocation(loc);
    setSelectedCoords({ lng: loc.coordinates[0], lat: loc.coordinates[1] });
    setFormData({
      name: loc.name,
      date: loc.date,
      description: loc.description,
      imageUrls: loc.images.join("\n")
    });
    setPanelMode("add");
    mapRef.current?.flyTo(loc.coordinates, 10);
  };

  const closePanel = () => {
    setPanelMode("none");
    setSelectedCoords(null);
    setEditingLocation(null);
    setFormData(emptyForm);
    setSearchResults([]);
    setShowResults(false);
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
    } catch { /* noop */ } finally { setSavingNextDest(false); }
  };

  const isAddPanel = panelMode === "add";
  const isListPanel = panelMode === "list";

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <MapContainer ref={mapRef} isAdmin onMapClick={handleMapClick} />

      {/* Left control panel */}
      <div className="absolute top-24 left-8 z-40 hidden md:flex flex-col gap-3">
        <div className="p-4 bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl text-white max-w-xs shadow-2xl">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" /> Admin Mode
          </h2>
          <p className="text-xs text-white/60 leading-relaxed">
            在名称框搜索地点，或直接点击地图添加足迹。
          </p>
        </div>

        {/* Manage locations button */}
        <button
          onClick={() => setPanelMode(isListPanel ? "none" : "list")}
          className={`flex items-center gap-2 px-4 py-3 backdrop-blur-xl border rounded-2xl text-white text-sm font-medium transition-all shadow-2xl ${
            isListPanel ? "bg-white/20 border-white/30" : "bg-black/60 border-white/20 hover:bg-white/10"
          }`}
        >
          <List className="w-4 h-4 text-blue-400" />
          管理地点 ({locations.length})
        </button>

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
            className="absolute top-24 left-8 z-50 w-80 md:top-[calc(6rem+14rem)] bg-black/80 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 shadow-2xl text-white"
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
                <input type="text" value={nextDest.name}
                  onChange={e => setNextDest(p => ({ ...p, name: e.target.value }))}
                  placeholder="Reykjavik, Iceland"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1">
                  <Flag className="w-3 h-3" /> 国旗 Emoji
                </label>
                <input type="text" value={nextDest.flag}
                  onChange={e => setNextDest(p => ({ ...p, flag: e.target.value }))}
                  placeholder="🇮🇸"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> 开始日期
                  </label>
                  <input type="date" value={nextDest.startDate}
                    onChange={e => setNextDest(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> 目标日期
                  </label>
                  <input type="date" value={nextDest.targetDate}
                    onChange={e => setNextDest(p => ({ ...p, targetDate: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>
              <button onClick={handleSaveNextDest} disabled={savingNextDest}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all">
                {savingNextDest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                保存
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location List Panel */}
      <AnimatePresence>
        {isListPanel && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="absolute inset-y-0 right-0 z-50 w-full md:w-[400px] p-4 md:p-6 flex items-center"
          >
            <div className="bg-black/80 backdrop-blur-3xl border border-white/10 h-[88vh] w-full rounded-3xl p-6 shadow-2xl text-white flex flex-col">
              <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <List className="w-5 h-5 text-blue-400" /> 已添加地点
                  <span className="text-sm font-normal text-white/40">({locations.length})</span>
                </h3>
                <button onClick={closePanel} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {locations.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
                  暂无地点，点击地图添加
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {[...locations].sort((a, b) => b.date.localeCompare(a.date)).map(loc => (
                    <div key={loc.id}
                      className="group flex items-start gap-3 p-3 bg-white/5 hover:bg-white/8 border border-white/5 hover:border-white/15 rounded-2xl transition-all">
                      {/* Thumbnail */}
                      {/* 找到这段代码并修改 src 属性 */}
                      {loc.images[0] ? (
                        <img 
                          src={cfThumb(loc.images[0], 200)} // 使用缩略图逻辑
                          alt=""
                          className="w-14 h-14 rounded-xl object-cover flex-shrink-0 opacity-80" 
                          loading="lazy" 
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-5 h-5 text-white/30" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm leading-tight truncate">{loc.name}</p>
                        <p className="text-[10px] text-blue-400/80 font-bold uppercase tracking-wider mt-0.5">{loc.date}</p>
                        <p className="text-xs text-white/40 mt-1 line-clamp-2 leading-relaxed">{loc.description}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditLocation(loc)}
                          className="p-1.5 hover:bg-blue-500/20 rounded-lg transition-colors"
                          title="编辑"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleDelete(loc.id)}
                          disabled={deletingId === loc.id}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                          title="删除"
                        >
                          {deletingId === loc.id
                            ? <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5 text-red-400" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => { closePanel(); }}
                className="mt-4 flex-shrink-0 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 font-medium rounded-2xl flex items-center justify-center gap-2 transition-all text-sm"
              >
                <MapPin className="w-4 h-4 text-blue-400" /> 点击地图添加新地点
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Edit Footprint Form Drawer */}
      <AnimatePresence>
        {isAddPanel && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="absolute inset-y-0 right-0 z-50 w-full md:w-[420px] p-4 md:p-6 flex items-center"
          >
            <div className="bg-black/80 backdrop-blur-3xl border border-white/10 h-[88vh] w-full rounded-3xl p-6 shadow-2xl text-white overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  {editingLocation && (
                    <button onClick={() => setPanelMode("list")} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                      <ChevronLeft className="w-4 h-4 text-white/60" />
                    </button>
                  )}
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">
                      {editingLocation ? "编辑足迹" : "新增足迹"}
                    </h3>
                    {selectedCoords && (
                      <p className="text-xs text-white/40 mt-0.5">
                        {selectedCoords.lng.toFixed(4)}, {selectedCoords.lat.toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={closePanel} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Location Name */}
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Type className="w-3 h-3" /> 地点名称
                  </label>
                  <div className="relative">
                    <input required type="text" value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      onFocus={() => setIsNameFocused(true)}
                      onBlur={() => setTimeout(() => { setIsNameFocused(false); setShowResults(false); }, 200)}
                      placeholder="搜索或输入地点名称..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isSearching ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> : <Search className="w-4 h-4 text-white/20" />}
                    </div>
                  </div>
                  <AnimatePresence>
                    {showResults && searchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                        className="absolute top-full left-0 right-0 mt-1 z-50 bg-neutral-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto"
                      >
                        {searchResults.map(result => (
                          <button key={result.id} type="button" onMouseDown={() => handleSelectResult(result)}
                            className="w-full px-4 py-3 text-left text-xs text-white/80 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 flex items-center gap-2">
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
                  <input required type="date" value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                </div>

                {/* Image URLs */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <ImageIcon className="w-3 h-3" /> 图片 URLs（每行一个）
                  </label>
                  <textarea value={formData.imageUrls}
                    onChange={e => setFormData({ ...formData, imageUrls: e.target.value })}
                    placeholder={"https://r2.yourdomain.com/photo1.jpg\nhttps://r2.yourdomain.com/photo2.jpg"}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none font-mono text-xs" />
                  {formData.imageUrls && (
                    <p className="text-[10px] text-white/30">
                      {formData.imageUrls.split("\n").filter(u => u.trim()).length} 张图片
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">详细描述</label>
                  <textarea required rows={4} value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="记录这个地方的故事..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none" />
                </div>

                <button type="submit"
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl active:scale-[0.98]">
                  <Save className="w-5 h-5" /> {editingLocation ? "保存修改" : "保存足迹"}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top search bar (when no panel open) */}
      {panelMode === "none" && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              {isSearching ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> : <Search className="w-4 h-4 text-white/40" />}
            </div>
            <input type="text" value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              onFocus={() => setIsNameFocused(true)}
              onBlur={() => setTimeout(() => { setIsNameFocused(false); setShowResults(false); }, 200)}
              placeholder="搜索地点并添加..."
              className="w-full bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all shadow-2xl" />
            <AnimatePresence>
              {showResults && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full mt-2 w-full bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                >
                  {searchResults.map(result => (
                    <button key={result.id} onMouseDown={() => handleSelectResult(result)}
                      className="w-full px-4 py-3 text-left text-sm text-white/80 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 flex items-center gap-2">
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
