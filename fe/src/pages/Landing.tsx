import { useNavigate } from 'react-router-dom';
import { FileText, Zap, CheckCircle2, ArrowRight, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Landing() {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Load theme from sessionStorage
    const savedTheme = sessionStorage.getItem('theme');
    setIsDarkMode(savedTheme === 'dark');
    
    // Apply theme to document
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    
    if (newTheme) {
      document.documentElement.classList.add('dark');
      sessionStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      sessionStorage.setItem('theme', 'light');
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] dark:bg-gray-900 relative overflow-hidden transition-colors duration-300">
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 p-3 bg-white dark:bg-gray-800 border-2 border-black dark:border-white rounded-lg hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all duration-200"
      >
        {isDarkMode ? (
          <Sun className="w-5 h-5 text-black dark:text-white" />
        ) : (
          <Moon className="w-5 h-5 text-black" />
        )}
      </button>

      {/* Subtle Grid Background Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]" 
        style={{
          backgroundImage: `
            linear-gradient(${isDarkMode ? '#fff' : '#000'} 1px, transparent 1px),
            linear-gradient(90deg, ${isDarkMode ? '#fff' : '#000'} 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Main Container */}
      <div className="min-h-screen flex flex-col items-center justify-center p-8 max-w-5xl mx-auto pt-20">
        
        {/* Hero Section */}
        <div className="text-center mb-12 mt-16">
          <div className="hero-title-wrapper">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold mb-6 leading-tight hero-title text-black dark:text-white">
              OCR.WTF: SCAN DOKUMEN TANPA RIBET.
            </h1>
          </div>

          <p className="text-lg md:text-xl font-mono text-black/70 dark:text-white/80 mb-8 leading-relaxed max-w-3xl mx-auto hero-description">
            Upload foto dokumen, langsung jadi data digital. 
            Cepat, akurat, dan otomatis dengan kecerdasan buatan.
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {[
              { icon: FileText, text: 'UPLOAD', delay: 0 },
              { icon: Zap, text: 'SCAN', delay: 0.2 },
              { icon: CheckCircle2, text: 'DIGITIZE', delay: 0.4 },
              { icon: ArrowRight, text: 'AUTOMATE', delay: 0.6 }
            ].map((item, i) => (
              <div 
                key={i}
                style={{ animationDelay: `${2.5 + item.delay}s` }}
                className="feature-pill border-2 border-black dark:border-white bg-white dark:bg-gray-800 px-4 py-2 font-mono text-xs font-bold text-black dark:text-white flex items-center gap-2 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all duration-200"
              >
                <item.icon className="w-4 h-4 text-black dark:text-white" />
                {item.text}
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative inline-block cta-button"
          >
            <div 
              className={`absolute inset-0 bg-black dark:bg-white transition-all duration-200 ${
                isHovered ? 'translate-x-[8px] translate-y-[8px]' : 'translate-x-0 translate-y-0'
              }`}
            />
            <button
              onClick={() => navigate('/login')}
              className={`relative border-4 border-black dark:border-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 px-12 py-5 flex items-center gap-3 ${
                isHovered ? '-translate-x-[4px] -translate-y-[4px]' : ''
              }`}
            >
              <span className="font-bold text-xl text-black dark:text-white">START RIGHT NOW</span>
              <ArrowRight className="w-6 h-6 text-black dark:text-white" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-auto pt-8">
          <p className="font-mono text-xs text-black/60">
            © {new Date().getFullYear()} OCR.WTF - Scan Dokumen Otomatis dengan AI
          </p>
        </div>
      </div>

      <style>{`
        @keyframes typing {
          from { 
            width: 0;
            opacity: 1;
          }
          to { 
            width: 100%;
            opacity: 1;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes scale-in {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }

        .hero-title-wrapper {
          overflow: hidden;
        }

        .hero-title {
          opacity: 0;
          animation: typing 1.5s steps(40) 0s forwards, fade-in 0.5s ease-out 0s forwards;
        }

        .hero-description {
          opacity: 0;
          animation: fade-in 0.8s ease-out 1.5s forwards;
        }

        .feature-pill {
          opacity: 0;
          animation: slide-in 0.5s ease-out forwards;
        }

        .cta-button {
          opacity: 0;
          animation: scale-in 0.8s ease-out 3.3s forwards;
        }

        .animate-scale-in {
          animation: scale-in 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
