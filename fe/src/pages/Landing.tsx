import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Star, ShieldCheck, Zap, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-service";

// Komponen Teks Mengetik (Biar estetik)
const TypewriterText = ({ text }: { text: string }) => {
  const [displayText, setDisplayText] = useState('');
  useEffect(() => {
    let i = 0;
    setDisplayText('');
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayText((prev) => prev + text.charAt(i));
        i++;
      } else clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [text]);
  return <span>{displayText}</span>;
};

export default function Landing() {
  const navigate = useNavigate();
  const [ratings, setRatings] = useState<any[]>([]);

  useEffect(() => {
    // Cek Dark Mode
    const savedTheme = sessionStorage.getItem('theme');
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    // Fetch Rating
    const fetchRatings = async () => {
      try {
        const res = await apiFetch("/ratings");
        const json = await res.json();
        if (json.status === "success") {
          // 🔥 FIX: TIDAK ADA LAGI FILTER NAMA SENDIRI 🔥
          // Langsung set semua data yang masuk dari API
          setRatings(json.data || []);
        }
      } catch (e) { console.error(e); }
    };
    fetchRatings();
  }, []);

  const handleLogin = () => navigate('/login');

  return (
    <div className="min-h-screen bg-[#F4F4F0] dark:bg-black text-black dark:text-white transition-colors duration-300 flex flex-col font-sans overflow-hidden">
      
      {/* NAVBAR */}
      <nav className="flex justify-between items-center p-6 border-b-4 border-black dark:border-white bg-white dark:bg-zinc-900 relative z-20">
        <div className="flex items-center gap-2">
           <div className="w-5 h-10 bg-yellow-400 border-2 border-black"></div>
           <h1 className="text-2xl font-black tracking-tighter">OCR.WTF</h1>
        </div>
        <Button onClick={handleLogin} className="brutal-button bg-black text-white hover:bg-yellow-400 hover:text-black border-2 border-transparent hover:border-black transition-all font-bold uppercase">
          Masuk / Daftar
        </Button>
      </nav>

      {/* MAIN CONTENT (SPLIT LAYOUT) */}
      <main className="flex-1 container mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
        
        {/* KOLOM KIRI: HEADLINE & CTA */}
        <div className="space-y-8 text-center lg:text-left animate-in slide-in-from-left-10 duration-700">
          <div className="inline-block bg-yellow-400 border-2 border-black px-4 py-1 font-bold text-xs uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
             🚀 Versi 2.0 Kini Lebih Cepat
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black leading-[0.9] tracking-tighter">
            SCAN.<br/>
            DIGITIZE.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600">
                <TypewriterText text="DONE." />
            </span>
          </h1>
          
          <p className="text-lg md:text-xl font-mono text-gray-600 dark:text-gray-400 max-w-lg mx-auto lg:mx-0">
            Ubah tumpukan dokumen fisik menjadi data digital dalam hitungan detik. Tanpa ribet, tanpa drama.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Button onClick={handleLogin} className="h-14 px-8 text-lg font-bold border-2 border-black bg-white text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all">
              MULAI GRATIS <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 px-4 py-2 border-l-4 border-black dark:border-white">
               <ShieldCheck className="w-6 h-6 text-green-600" />
               <div className="text-left leading-none">
                 <p className="text-[10px] font-bold uppercase text-gray-500">Keamanan</p>
                 <p className="font-bold text-sm">Enkripsi 256-bit</p>
               </div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: REVIEW VERTIKAL SCROLL (PROFESSIONAL LOOK) */}
        <div className="relative h-[600px] w-full overflow-hidden border-4 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[10px_10px_0px_0px_rgba(0,0,0,0.2)]">
            
            {/* Header Fake Browser */}
            <div className="bg-black text-white p-3 flex justify-between items-center border-b-4 border-black dark:border-white">
                <span className="font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /> WALL OF LOVE
                </span>
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-black"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 border border-black"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-black"></div>
                </div>
            </div>

            {/* AREA SCROLLING */}
            <div className="relative h-full overflow-hidden group">
                {/* Gradient Fade Atas Bawah biar halus */}
                <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-white dark:from-zinc-900 to-transparent z-10 pointer-events-none"></div>
                <div className="absolute bottom-12 left-0 w-full h-16 bg-gradient-to-t from-white dark:from-zinc-900 to-transparent z-10 pointer-events-none"></div>

                {/* Kontainer Animasi */}
                {ratings.length > 0 ? (
                    <div className="animate-vertical-marquee group-hover:[animation-play-state:paused] flex flex-col gap-4 p-6">
                        {/* Duplicate array untuk efek infinite loop mulus (x3) */}
                        {[...ratings, ...ratings, ...ratings].map((rating, i) => (
                            <div 
                                key={`${rating.id}-${i}`}
                                className="flex flex-row items-center gap-4 bg-gray-50 dark:bg-zinc-800 p-4 border-2 border-black dark:border-zinc-600 shadow-sm hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.5)] transition-all transform hover:-translate-y-1"
                            >
                                {/* Avatar (Kiri) */}
                                <img 
                                    src={rating.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rating.userName}`} 
                                    alt="User" 
                                    className="w-12 h-12 rounded-full border-2 border-black object-cover shrink-0 bg-white" 
                                />
                                
                                {/* Konten (Kanan) */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-sm truncate dark:text-white">{rating.userName}</h4>
                                        <span className="text-xl">{rating.emoji}</span>
                                    </div>
                                    
                                    <div className="flex mb-1">
                                        {[...Array(5)].map((_, starIndex) => (
                                            <Star 
                                                key={starIndex} 
                                                className={`w-3 h-3 ${starIndex < rating.stars ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200"}`} 
                                            />
                                        ))}
                                    </div>
                                    
                                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 italic">
                                        "{rating.message}"
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center text-gray-400 font-mono text-sm">
                        Belum ada review...
                    </div>
                )}
            </div>
        </div>

      </main>

      {/* FOOTER SIMPLE */}
      <footer className="border-t-4 border-black bg-yellow-400 p-4 text-center font-bold text-sm">
         &copy; 2025 OCR.WTF - NO RIBET JUST SCAN.
      </footer>

      {/* CSS CUSTOM UNTUK ANIMASI VERTIKAL */}
      <style>{`
        @keyframes vertical-marquee {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .animate-vertical-marquee {
          animation: vertical-marquee 40s linear infinite;
        }
      `}</style>
    </div>
  );
}
