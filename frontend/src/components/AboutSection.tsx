import { motion } from "motion/react";
import { Github, Twitter, Mail, MapPin, Code, Globe, Coffee, Heart, Camera, Terminal } from "lucide-react";

export function AboutSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen pt-24 px-6 pb-20">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6"
      >
        {/* Profile Card */}
        <motion.div 
          variants={itemVariants}
          className="md:col-span-8 bg-black/40 backdrop-blur-md border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
        >
          <div className="h-48 bg-gradient-to-r from-blue-600/30 via-indigo-600/30 to-purple-600/30 relative">
            <div className="absolute inset-0 backdrop-blur-sm" />
            <div className="absolute -bottom-16 left-12">
              <div className="w-32 h-32 rounded-3xl border-4 border-white/10 bg-white/10 backdrop-blur-xl overflow-hidden shadow-2xl">
                <img 
                  src="https://picsum.photos/seed/avatar/400/400" 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="pt-20 px-12 pb-12 space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-white tracking-tight font-display">Geo Blogger</h1>
              <p className="text-blue-400 font-medium flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5" /> Digital Nomad & Full-Stack Engineer
              </p>
            </div>

            <p className="text-white/70 text-lg leading-relaxed max-w-2xl">
              I build bridges between the physical world and the digital realm. 
              Currently traveling the globe, documenting my journey through code, 
              photography, and interactive maps. My mission is to capture the essence 
              of every place I visit and share it through immersive digital experiences.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <SocialLink icon={Github} label="GitHub" />
              <SocialLink icon={Twitter} label="Twitter" />
              <SocialLink icon={Mail} label="Email" />
            </div>
          </div>
        </motion.div>

        {/* Stats/Quick Info */}
        <motion.div 
          variants={itemVariants}
          className="md:col-span-4 grid grid-cols-2 gap-4"
        >
          <StatCard icon={Globe} value="24" label="Countries" />
          <StatCard icon={Camera} value="1.2k" label="Photos" />
          <StatCard icon={Terminal} value="8y" label="Coding" />
          <StatCard icon={Coffee} value="∞" label="Coffee" />
        </motion.div>

        {/* Tech Stack */}
        <motion.div 
          variants={itemVariants}
          className="md:col-span-5 p-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-[2.5rem] space-y-6"
        >
          <div className="flex items-center gap-3">
            <Code className="w-6 h-6 text-blue-400" />
            <h3 className="text-xl font-bold text-white">Tech Stack</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {['React', 'TypeScript', 'Node.js', 'Mapbox', 'Tailwind', 'Astro', 'Cloudflare', 'PostgreSQL', 'Docker'].map(tech => (
              <span key={tech} className="px-4 py-2 bg-white/5 text-white/80 text-sm rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                {tech}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Interests */}
        <motion.div 
          variants={itemVariants}
          className="md:col-span-7 p-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-[2.5rem] space-y-6"
        >
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-pink-400" />
            <h3 className="text-xl font-bold text-white">Interests</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <InterestItem label="Photography" />
            <InterestItem label="Hiking" />
            <InterestItem label="Open Source" />
            <InterestItem label="GIS Tech" />
            <InterestItem label="History" />
            <InterestItem label="Cooking" />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function SocialLink({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <a 
      href="#" 
      className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl transition-all border border-white/10 group"
    >
      <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
      <span className="text-sm font-medium">{label}</span>
    </a>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: any, value: string, label: string }) {
  return (
    <div className="p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-1 hover:bg-white/10 transition-colors border-transparent hover:border-white/20">
      <Icon className="w-6 h-6 text-blue-400 mb-2" />
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{label}</span>
    </div>
  );
}

function InterestItem({ label }: { label: string }) {
  return (
    <div className="px-4 py-3 bg-white/5 border border-white/5 rounded-2xl text-white/70 text-sm font-medium hover:text-white hover:border-white/20 transition-all text-center">
      {label}
    </div>
  );
}
