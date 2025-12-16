import { useNavigate } from 'react-router-dom';
import { FileText, Zap, ArrowRight, Moon, Sun, Terminal, Cpu } from 'lucide-react';
import { useState, useEffect } from 'react';
import RatingMarquee from '@/components/landing/RatingMarquee'; // Import Marquee

// ... (Sub-components FeaturePill & BioPanel tetap sama) ...
// Copy FeaturePill & BioPanel dari kode sebelumnya di sini 

// --- MAIN COMPONENT ---
export default function Landing() {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = sessionStorage.getItem('theme');
    setIsDarkMode(savedTheme === 'dark');
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    document.documentElement.classList.toggle('dark');
    sessionStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  return (
    <div className="min-h-screen bg-[#F4F4F0] dark:bg-black relative overflow-x-hidden transition-colors duration-300">
      
      {/* Theme Toggle */}
      <button onClick={toggleTheme} className="fixed top-6 right-6 z-50 p-3 bg-white dark:bg-gray-800 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_black] hover:translate-y-1 hover:shadow-none transition-all">
        {isDarkMode ? <Sun className="w-5 h-5 text-white" /> : <Moon className="w-5 h-5 text-black" />}
      </button>

      <div className="relative min-h-screen flex flex-col items-center justify-center pt-20 pb-20">
        
        {/* Hero Text */}
        <div className="text-center max-w-4xl mx-auto space-y-6 z-10 mt-8 mb-12 px-4">
          <h1 className="text-6xl md:text-9xl font-black tracking-tighter leading-[0.85] text-black dark:text-white mix-blend-difference">
            OCR.WTF
          </h1>
          <p className="text-xl md:text-2xl font-mono font-bold text-gray-500 dark:text-gray-400">
            SCAN DOKUMEN. <span className="text-black dark:text-white bg-yellow-400 px-2">TANPA RIBET.</span>
          </p>
        </div>

        {/* 🔥 RATING MARQUEE (Jalan Kiri ke Kanan) 🔥 */}
        <RatingMarquee />

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-4 mb-8 z-10 px-4">
          <FeaturePill icon={FileText} text="UPLOAD" delay={0.6} />
          <FeaturePill icon={Zap} text="AI SCAN" delay={0.8} />
          <FeaturePill icon={Terminal} text="DIGITIZE" delay={1.0} />
          <FeaturePill icon={Cpu} text="AUTOMATE" delay={1.2} />
        </div>

        {/* Bio Panel */}
        <BioPanel />

        {/* CTA Button */}
        <div className="mt-4 mb-20 z-10">
          <div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} className="relative group cursor-pointer" onClick={() => navigate('/login')}>
            <div className={`absolute inset-0 bg-black dark:bg-white transition-transform duration-200 ${isHovered ? 'translate-x-2 translate-y-2' : 'translate-x-0 translate-y-0'}`}></div>
            <button className={`relative border-4 border-black dark:border-white bg-yellow-400 dark:bg-yellow-600 px-12 py-5 flex items-center gap-3 transition-transform duration-200 ${isHovered ? '-translate-x-1 -translate-y-1' : ''}`}>
              <span className="font-black text-xl text-black dark:text-white tracking-widest">START NOW</span>
              <ArrowRight className={`w-6 h-6 text-black dark:text-white`} />
            </button>
          </div>
        </div>

        <footer className="absolute bottom-6 text-center w-full opacity-60">
          <p className="font-mono text-[10px] uppercase tracking-widest text-black dark:text-white">© {new Date().getFullYear()} OCR.WTF</p>
        </footer>
      </div>
    </div>
  );
}
