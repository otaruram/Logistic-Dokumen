import { useNavigate } from 'react-router-dom';
import { FileText, Zap, CheckCircle2, ArrowRight, Moon, Sun, Code2, Terminal, Cpu } from 'lucide-react';
import { useState, useEffect } from 'react';

// --- SUB-COMPONENTS ---

const FeaturePill = ({ icon: Icon, text, delay }: { icon: any, text: string, delay: number }) => (
  <div 
    style={{ animationDelay: `${delay}s` }}
    className="opacity-0 animate-slide-up border-2 border-black dark:border-white bg-white dark:bg-gray-900 px-4 py-2 font-mono text-xs font-bold text-black dark:text-white flex items-center gap-2 hover:bg-yellow-300 dark:hover:bg-yellow-600 transition-colors duration-200 cursor-default shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
  >
    <Icon className="w-4 h-4" />
    {text}
  </div>
);

const BioPanel = () => (
  <div className="opacity-0 animate-fade-in-delayed w-full max-w-xl mx-auto mt-16 mb-12">
    {/* Kartu Nama Digital Style */}
    <div className="border-4 border-black dark:border-white bg-white dark:bg-gray-900 p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all duration-300 text-center">
      
      <div className="flex justify-center mb-4">
        <Terminal className="w-8 h-8 text-black dark:text-white" />
      </div>

      <h3 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-black dark:text-white mb-4">
        Oki Taruna R.
      </h3>
      
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        <span className="bg-black text-white px-3 py-1 text-[10px] font-mono font-bold tracking-wider">FULLSTACK DEV</span>
        <span className="bg-blue-600 text-white px-3 py-1 text-[10px] font-mono font-bold tracking-wider">UT STUDENT</span>
        <span className="border border-black dark:border-white text-black dark:text-white px-3 py-1 text-[10px] font-mono font-bold tracking-wider">GEN-AFFAIR</span>
      </div>

      <div className="border-t-2 border-black dark:border-white w-12 mx-auto mb-6"></div>

      <p className="text-sm font-mono text-gray-600 dark:text-gray-300 leading-relaxed max-w-sm mx-auto">
        "Code Wizard di malam hari. Menyulap tumpukan kertas menjadi data digital yang rapi."
      </p>
    </div>
  </div>
);

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
    <div className="min-h-screen bg-[#F4F4F0] dark:bg-black relative overflow-x-hidden transition-colors duration-300 selection:bg-yellow-400 selection:text-black">
      
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 z-50 p-3 bg-white dark:bg-gray-800 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-1 hover:shadow-none transition-all"
      >
        {isDarkMode ? <Sun className="w-5 h-5 text-white" /> : <Moon className="w-5 h-5 text-black" />}
      </button>

      {/* Grid Background */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.1] pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      {/* Main Content */}
      <div className="relative min-h-screen flex flex-col items-center justify-center p-6 pt-20">
        
        {/* 1. Hero Text */}
        <div className="text-center max-w-4xl mx-auto space-y-6 z-10 mt-8">
          <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-[0.85] text-black dark:text-white mix-blend-difference opacity-0 animate-slide-up [animation-delay:0.2s]">
            OCR.WTF
          </h1>
          <p className="text-xl md:text-2xl font-mono font-bold text-gray-500 dark:text-gray-400 opacity-0 animate-slide-up [animation-delay:0.4s]">
            SCAN DOKUMEN. <span className="text-black dark:text-white bg-yellow-400 dark:bg-yellow-600 px-2">TANPA RIBET.</span>
          </p>
        </div>

        {/* 2. Feature Pills */}
        <div className="flex flex-wrap justify-center gap-4 mt-10 mb-2 z-10">
          <FeaturePill icon={FileText} text="UPLOAD" delay={0.6} />
          <FeaturePill icon={Zap} text="AI SCAN" delay={0.8} />
          <FeaturePill icon={Terminal} text="DIGITIZE" delay={1.0} />
          <FeaturePill icon={Cpu} text="AUTOMATE" delay={1.2} />
        </div>

        {/* 3. Bio Panel (Clean Text Only) */}
        <BioPanel />

        {/* 4. CTA Button (Brutalist Style) */}
        <div className="mt-4 mb-20 opacity-0 animate-slide-up [animation-delay:1.5s] z-10">
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative group cursor-pointer"
            onClick={() => navigate('/login')}
          >
            <div className={`absolute inset-0 bg-black dark:bg-white transition-transform duration-200 ${isHovered ? 'translate-x-2 translate-y-2' : 'translate-x-0 translate-y-0'}`}></div>
            <button
              className={`relative border-4 border-black dark:border-white bg-yellow-400 dark:bg-yellow-600 px-12 py-5 flex items-center gap-3 transition-transform duration-200 ${isHovered ? '-translate-x-1 -translate-y-1' : ''}`}
            >
              <span className="font-black text-xl text-black dark:text-white tracking-widest">START NOW</span>
              <ArrowRight className={`w-6 h-6 text-black dark:text-white transition-transform ${isHovered ? 'translate-x-2' : ''}`} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="absolute bottom-6 text-center w-full opacity-60">
          <p className="font-mono text-[10px] uppercase tracking-widest text-black dark:text-white">
            © {new Date().getFullYear()} OCR.WTF // BANDUNG, INDONESIA
          </p>
        </footer>
      </div>

      {/* Global Styles for Animations */}
      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-delayed {
          0% { opacity: 0; }
          50% { opacity: 0; }
          100% { opacity: 1; }
        }
        
        .animate-slide-up {
          animation: slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in-delayed {
          animation: fade-in-delayed 1.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
