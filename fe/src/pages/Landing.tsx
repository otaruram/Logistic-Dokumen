import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-service";
import { CheckCircle2, Zap, Star } from "lucide-react";

// --- Helper Component untuk Efek Mengetik ---
const TypewriterText = ({ text, delay = 50, className = "" }: { text: string, delay?: number, className?: string }) => {
  const [displayText, setDisplayText] = useState("");
  const index = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (index.current < text.length) {
        setDisplayText((prev) => prev + text.charAt(index.current));
        index.current++;
      } else {
        clearInterval(timer);
      }
    }, delay);
    return () => clearInterval(timer);
  }, [text, delay]);

  return <span className={className}>{displayText}{index.current < text.length && <span className="animate-pulse">|</span>}</span>;
};
// -------------------------------------------

export default function Landing() {
  const navigate = useNavigate();
  const [ratings, setRatings] = useState<any[]>([]);

  // Data untuk scrolling vertikal (diulang 10x)
  const trustedByItems = Array(10).fill(["STUDENTS", "BUSINESS OWNERS", "FREELANCERS"]).flat();

  useEffect(() => {
    const fetchRatings = async () => {
      try {
        const res = await apiFetch("/ratings");
        if (res.ok) {
            const json = await res.json();
            if(json.status === "success" && Array.isArray(json.data)) setRatings(json.data);
        }
      } catch (e) {}
    };
    fetchRatings();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950 font-sans text-slate-900 dark:text-slate-50 overflow-x-hidden">
      
      {/* NAVBAR SIMPEL */}
      <header className="px-4 md:px-6 h-16 md:h-20 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 sticky top-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md z-50">
        <div className="flex items-center gap-2 font-bold text-lg md:text-xl tracking-tight cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-7 h-7 md:w-8 md:h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Zap className="w-4 h-4 md:w-5 md:h-5 fill-white" />
          </div>
          <span>OCR<span className="text-blue-600">.wtf</span></span>
        </div>
        <div>
           {/* Tombol Get Started Dihilangkan */}
           <Button variant="ghost" className="font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800" onClick={() => navigate("/login")}>Log In</Button>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO SECTION DENGAN ANIMASI MENGETIK */}
        <section className="relative py-16 md:py-24 px-4 md:px-6 text-center overflow-hidden">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] md:w-[800px] h-[300px] md:h-[400px] bg-blue-100/50 dark:bg-blue-900/20 blur-[80px] md:blur-[100px] rounded-full -z-10" />
           
           <div className="max-w-4xl mx-auto">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] md:text-xs font-bold uppercase tracking-wide mb-6 border border-blue-100 dark:border-blue-800">
                🚀 AI-Powered OCR Technology
             </div>
             
             {/* Judul dengan Efek Mengetik */}
             <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 text-slate-900 dark:text-white leading-tight min-h-[80px] md:min-h-[140px] flex items-center justify-center">
                <TypewriterText text="Extract Data from Images In Seconds." delay={40} className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600" />
             </h1>
             
             {/* Deskripsi dengan Efek Mengetik (muncul sedikit lebih lambat) */}
             <div className="text-base md:text-xl text-slate-600 dark:text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto min-h-[72px] md:min-h-[84px] flex items-center justify-center">
                <TypewriterText text="Stop typing manually. Upload receipts, invoices, or documents and let our AI convert them into structured Excel data instantly." delay={25} />
             </div>

             <div className="flex justify-center">
               {/* Tombol Demo Dihilangkan */}
               <Button size="lg" className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg rounded-full shadow-lg shadow-blue-600/20 hover:scale-105 transition-transform" onClick={() => navigate("/login")}>
                 Start Scanning Now
               </Button>
             </div>
             
             {/* SCROLLING VERTICAL TRUSTED BY */}
             <div className="mt-16 h-16 overflow-hidden relative">
                <div className="absolute w-full h-full bg-gradient-to-b from-white via-transparent to-white dark:from-zinc-950 dark:to-zinc-950 z-10 pointer-events-none"></div>
                <div className="animate-[vertical-scroll_30s_linear_infinite] flex flex-col items-center gap-3 text-sm font-bold text-slate-400 grayscale opacity-60 tracking-widest">
                    {trustedByItems.map((item, i) => (
                        <span key={i}>TRUSTED BY {item}</span>
                    ))}
                </div>
             </div>
           </div>
        </section>

        {/* FEATURES GRID (Simple & Effective) */}
        <section className="py-16 md:py-20 bg-slate-50 dark:bg-zinc-900/50 border-y border-slate-100 dark:border-zinc-800">
            <div className="container mx-auto px-4 md:px-6 max-w-6xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    {[
                        {title: "99% Accuracy", desc: "Precise AI text extraction models."},
                        {title: "Instant Excel Export", desc: "Convert images to spreadsheets instantly."},
                        {title: "Secure Storage", desc: "Encrypted cloud storage for your docs."}
                    ].map((f, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-950 p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 flex flex-col items-center text-center md:items-start md:text-left">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 mb-4 md:mb-6">
                                <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-3">{f.title}</h3>
                            <p className="text-sm md:text-base text-slate-500 leading-relaxed">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* TESTIMONIALS (Animasi saat disentuh/hover) */}
        <section className="py-16 md:py-24 px-4 md:px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-10 md:mb-16">
                <h2 className="text-2xl md:text-3xl font-bold mb-3">Loved by Users</h2>
            </div>
            
            {ratings.length === 0 ? (
              <div className="text-center p-8 md:p-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                 <p className="text-slate-400 font-medium">No reviews yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {ratings.map((rate, i) => (
                  // PENAMBAHAN CLASS ANIMASI HOVER/TOUCH DISINI
                  <div key={i} className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 flex flex-col transition-all duration-300 hover:-translate-y-2 hover:shadow-md active:scale-[0.98]">
                    <div className="flex gap-1 mb-3 md:mb-4">
                        {[...Array(5)].map((_, j) => (
                          <Star key={j} className={`w-3 h-3 md:w-4 md:h-4 ${j < rate.stars ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`} />
                        ))}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mb-4 md:mb-6 flex-1 text-sm leading-relaxed italic">"{rate.message}"</p>
                    <div className="flex items-center gap-3 pt-4 border-t border-slate-50 dark:border-zinc-800">
                      <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center overflow-hidden text-xs md:text-sm font-bold text-blue-700 dark:text-blue-200">
                          {rate.userAvatar ? <img src={rate.userAvatar} alt="u" className="w-full h-full object-cover"/> : rate.userName?.[0]}
                      </div>
                      <div>
                          <p className="text-xs md:text-sm font-bold text-slate-900 dark:text-white">{rate.userName || "Anonymous"}</p>
                      </div>
                      <span className="ml-auto text-xl md:text-2xl">{rate.emoji}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="py-6 md:py-8 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="container mx-auto px-4 md:px-6 text-center">
            <p className="text-xs md:text-sm text-slate-500 font-medium">© 2025 OCR.wtf Inc. Simple & Effective.</p>
        </div>
      </footer>
      
      {/* STYLE UNTUK ANIMASI VERTIKAL */}
      <style>{`
        @keyframes vertical-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>
    </div>
  );
}
