import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ExternalLink, BookOpen, Map, ChevronRight, Loader2 } from "lucide-react";

interface TravelGuide {
  slug: string;
  title: string;
  date: string;
  category: string;
}

export function NotesSection() {
  const [guides, setGuides] = useState<TravelGuide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/travel-guides")
      .then(res => res.json())
      .then(data => setGuides(data))
      .catch(() => setGuides([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen pt-24 px-6 pb-12">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">

          {/* Left Column: Travel Guides */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-4 space-y-6"
          >
            <div className="p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Map className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">游玩攻略</h2>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
              ) : guides.length === 0 ? (
                <div className="py-8 text-center text-white/30 text-sm">
                  <p>暂无攻略</p>
                  <p className="text-xs mt-1">将 .md 文件上传至 content/travel/ 目录即可</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {guides.map((guide) => (
                    <a
                      key={guide.slug}
                      href={`/notes/travel/${guide.slug}`}
                      className="block p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">{guide.category}</span>
                        <span className="text-[10px] text-white/40">{guide.date}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <h3 className="text-white font-medium group-hover:text-blue-300 transition-colors">{guide.title}</h3>
                        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-blue-400 transition-all flex-shrink-0" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Right Column: Quartz 4 Knowledge Base */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-6"
          >
            <a
              href="/notes/"
              className="relative group overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md flex flex-col h-full min-h-[480px] cursor-pointer block"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 opacity-50 group-hover:opacity-70 transition-opacity duration-500" />

              <div className="relative p-8 flex-1 flex flex-col justify-center items-center text-center space-y-6">
                <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500">
                  <BookOpen className="w-10 h-10 text-white" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-white tracking-tight">Digital Garden</h2>
                  <p className="text-white/60 max-w-md mx-auto leading-relaxed">
                    My interconnected second brain powered by Quartz 4.
                    Deep dives into software engineering, geography, and personal growth.
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  {["React", "Node.js", "GIS", "Productivity"].map(tag => (
                    <span key={tag} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-white/60">
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 px-8 py-3 bg-white text-black font-bold rounded-full group-hover:bg-blue-400 group-hover:text-white transition-all shadow-xl">
                  Enter Knowledge Base <ExternalLink className="w-4 h-4" />
                </div>
              </div>

              <div className="relative h-24 bg-white/5 border-t border-white/10 p-6 flex items-center justify-center gap-4">
                <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Knowledge Base Preview</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500/50 rounded-full" style={{ width: `${[60, 40, 80, 30][i - 1]}%` }} />
                    </div>
                  ))}
                </div>
              </div>
            </a>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
