import { useRef, useState, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { MapContainer, MapRef } from "./components/MapContainer";
import { NextDestination } from "./components/NextDestination";
import { NotesSection } from "./components/NotesSection";
import { AboutSection } from "./components/AboutSection";
import { AdminPage } from "./components/AdminPage";
import { LoginPage } from "./components/LoginPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AutoCruise } from "./components/AutoCruise";
import { Location } from "./types";

export default function App() {
  const mapRef = useRef<MapRef>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isCruising, setIsCruising] = useState(false);

  const handleFlyTo = useCallback(
    (coords: [number, number], zoom: number, bearing: number, pitch: number, isInitialJump?: boolean) => {
      if (!mapRef.current) return Promise.resolve();
      return mapRef.current.cruiseFlyTo(coords, zoom, bearing, pitch, isInitialJump);
    },
    []
  );

  const handleCruiseStateChange = useCallback((active: boolean) => {
    setIsCruising(active);
  }, []);

  return (
    <Router>
      <div className="relative min-h-screen bg-neutral-950 font-sans selection:bg-blue-500/30">
        <Navbar />

        <Routes>
          <Route path="/" element={
            <main className="relative w-full h-screen overflow-hidden">
              <MapContainer
                ref={mapRef}
                onLocationsLoaded={setLocations}
                isCruising={isCruising}
              />
              {/* Shared right-side panel — both controls stacked, no overlap */}
              <div className="fixed top-20 sm:top-24 right-3 sm:right-6 z-40 flex flex-col gap-2 items-end w-64">
                <NextDestination />
                <AutoCruise
                  locations={locations}
                  onFlyTo={handleFlyTo}
                  onCruiseStateChange={handleCruiseStateChange}
                />
              </div>
            </main>
          } />

          <Route path="/notes" element={<NotesSection />} />
          <Route path="/about" element={<AboutSection />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
}
