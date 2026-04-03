import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { MapContainer } from "./components/MapContainer";
import { NextDestination } from "./components/NextDestination";
import { NotesSection } from "./components/NotesSection";
import { AboutSection } from "./components/AboutSection";
import { AdminPage } from "./components/AdminPage";
import { LoginPage } from "./components/LoginPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <Router>
      <div className="relative min-h-screen bg-neutral-950 font-sans selection:bg-blue-500/30">
        <Navbar />

        <Routes>
          <Route path="/" element={
            <main className="relative w-full h-screen overflow-hidden">
              <MapContainer />
              <NextDestination />
              <div className="absolute bottom-8 left-8 z-40 pointer-events-none">
                <div className="p-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl text-white max-w-xs">
                  <h2 className="text-lg font-bold mb-1">Footprint Map</h2>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Interactive visualization of my travels. Click on markers to see photos and stories from each location.
                  </p>
                </div>
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
