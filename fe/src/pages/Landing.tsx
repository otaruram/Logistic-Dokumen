import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-service"; // Pastikan import ini ada

export default function Landing() {
  const navigate = useNavigate();
  const [ratings, setRatings] = useState<any[]>([]);

  // FETCH RATINGS OTOMATIS SAAT BUKA HALAMAN
  useEffect(() => {
    const fetchRatings = async () => {
      try {
        const res = await apiFetch("/ratings");
        if (res.ok) {
            const json = await res.json();
            if(json.status === "success" && Array.isArray(json.data)) {
                setRatings(json.data);
            }
        }
      } catch (e) { 
        console.error("Gagal load rating", e); 
      }
    };
    fetchRatings();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950 font-sans text-slate-900 dark:text-slate-50">
      {/* NAVBAR */}
      <header className="px-6 py-4 flex items-center justify-between border-b dark:border-zinc-800 sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight cursor-pointer" onClick={() => navigate("/")}>
          <span className="text-blue-600">OCR</span>.wtf
        </div>
        <div className="flex gap-4">
           <Button variant="ghost" onClick={() => navigate("/login")}>Masuk</Button>
           <Button onClick={() => navigate("/login")}>Coba Gratis</Button>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="flex-1">
        <section className="py-20 px-6 text-center max-w-4xl mx-auto">
           <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
             Ubah Tumpukan Kertas <br/> Jadi <span className="text-blue-600">Data Digital</span>
           </h1>
           <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
             Scan struk, faktur, dan dokumen dalam hitungan detik menggunakan AI. <br/>
             Export ke Excel langsung, tanpa ribet ketik manual.
           </p>
           <div className="flex flex-col sm:flex-row gap-4 justify-center">
             <Button size="lg" className="h-12 px-8 text-lg rounded-full" onClick={() => navigate("/login")}>
               Mulai Scanning Sekarang 🚀
             </Button>
           </div>
        </section>

        {/* TESTIMONI SECTION (FIX ISSUE NO 2) */}
        <section className="py-20 bg-slate-50 dark:bg-zinc-900/50">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-12">Kata Pengguna</h2>
            
            {ratings.length === 0 ? (
              <div className="text-center text-gray-500 py-10 border-2 border-dashed rounded-xl">
                 Belum ada ulasan. Jadilah yang pertama mencoba!
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                {ratings.map((rate, i) => (
                  <div key={i} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 transition hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-3xl">{rate.emoji || "😀"}</span>
                      <div className="flex text-yellow-400 text-sm">
                        {[...Array(rate.stars || 5)].map((_, j) => (
                          <span key={j}>★</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mb-6 italic text-sm leading-relaxed">
                      "{rate.message}"
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold overflow-hidden text-blue-700 dark:text-blue-200">
                          {rate.userAvatar ? <img src={rate.userAvatar} alt="user" className="w-full h-full object-cover"/> : rate.userName ? rate.userName[0].toUpperCase() : "U"}
                      </div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {rate.userName || "User"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="py-8 text-center text-sm text-slate-500 border-t dark:border-zinc-800">
        © 2025 OCR.wtf - Powered by AI
      </footer>
    </div>
  );
}
