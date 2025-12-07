import { useNavigate } from 'react-router-dom';
import { FileText, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import { useState } from 'react';

export default function Landing() {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="min-h-screen bg-[#FDFDFD] relative overflow-hidden">
      {/* Subtle Grid Background Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]" 
        style={{
          backgroundImage: `
            linear-gradient(#000 1px, transparent 1px),
            linear-gradient(90deg, #000 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Main Container */}
      <div className="min-h-screen flex flex-col items-center justify-center p-8 max-w-5xl mx-auto pt-20">
        
        {/* Hero Section */}
        <div className="text-center mb-12 mt-16">
          <div className="hero-title-wrapper">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold mb-6 leading-tight hero-title">
              OCR.AI: DOKUMEN PINTAR DALAM SEKEJAP.
            </h1>
          </div>

          <p className="text-lg md:text-xl font-mono text-black/70 mb-8 leading-relaxed max-w-3xl mx-auto hero-description">
            Ubah tumpukan dokumen fisik menjadi data digital yang siap diolah. 
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
                className="feature-pill border-2 border-black bg-white px-4 py-2 font-mono text-xs font-bold flex items-center gap-2 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200"
              >
                <item.icon className="w-4 h-4" />
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
              className={`absolute inset-0 bg-black transition-all duration-200 ${
                isHovered ? 'translate-x-[8px] translate-y-[8px]' : 'translate-x-0 translate-y-0'
              }`}
            />
            <button
              onClick={() => navigate('/login')}
              className={`relative border-4 border-black bg-white hover:bg-gray-50 transition-all duration-200 px-12 py-5 flex items-center gap-3 ${
                isHovered ? '-translate-x-[4px] -translate-y-[4px]' : ''
              }`}
            >
              <span className="font-bold text-xl">START RIGHT NOW</span>
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-auto pt-8">
          <p className="font-mono text-xs text-black/60">
            © {new Date().getFullYear()} OCR.AI - Digitalisasi Dokumen Pintar
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
