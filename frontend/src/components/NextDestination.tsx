import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Plane } from "lucide-react";
import { NextDestinationData } from "@/src/types";

export function NextDestination() {
  const [data, setData] = useState<NextDestinationData | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetch("/api/config")
      .then(res => res.json())
      .then(config => {
        setData(config.nextDestination);
        
        const start = new Date(config.nextDestination.startDate).getTime();
        const target = new Date(config.nextDestination.targetDate).getTime();
        const now = Date.now();
        
        const total = target - start;
        const elapsed = now - start;
        const calculatedProgress = Math.min(100, Math.max(0, (elapsed / total) * 100));
        setProgress(calculatedProgress);
      });
  }, []);

  if (!data) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-24 right-6 z-40 w-64 p-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl text-white"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Next Destination</span>
        <Plane className="w-4 h-4 text-blue-400" />
      </div>
      
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{data.flag}</span>
        <div>
          <h3 className="font-bold leading-tight">{data.name}</h3>
          <p className="text-xs text-white/60">{data.targetDate}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-[10px] font-medium text-white/60">
          <span>Preparation</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, delay: 0.5 }}
            className="h-full bg-blue-500"
          />
        </div>
      </div>
    </motion.div>
  );
}
