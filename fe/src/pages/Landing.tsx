import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Camera, Cpu, Cloud, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-service";
import { Skeleton } from "@/components/ui/skeleton";

export default function Landing() {
  const navigate = useNavigate();
  const [ratings, setRatings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedTheme = sessionStorage.getItem('theme');
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    const fetchRatings = async () => {
      try {
        const res = await apiFetch("/ratings");
        const json = await res.json();
        if (json.status === "success") {
            setRatings(json.data.slice(0, 6));
        }
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    fetchRatings();
  }, []);

  // 🔥 PERBAIKAN: Arahkan langsung ke halaman Login
  const handleLogin = () => {
    navigate('/login'); 
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 text-[#1A1A1A] dark:text-white font-sans overflow-x-hidden">
      
      {/* HEADER */}
      <nav className="flex justify-between items-center p-6 container mx-auto">
        <h1 className="text-xl font-bold tracking-tight font-sans">SmartDoc Pipeline</h1>
        <Button 
            onClick={handleLogin} 
            variant="outline"
            className="rounded-full border-gray-300 hover:bg-gray-100 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-all flex items-center gap-2"
        >
            Masuk / Daftar
        </Button>
      </nav>

      {/* HERO SECTION */}
      <section className="container mx-auto px-4 py-24 flex flex-col items-center text-center max-w-4xl">
        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight mb-8 text-[#1A1A1A] dark:text-white">
          Digitalisasi Dokumen Logistik dalam Detik.
        </h1>
        <p className="text-xl md:text-2xl text-[#666666] dark:text-gray-400 mb-12 leading-relaxed max-w-2xl">
          Hentikan input data manual. Gunakan AI untuk ekstrak Surat Jalan & Validasi Tanda Tangan.
        </p>
        
        {/* 🔥 TOMBOL UTAMA DIPERBAIKI */}
        <Button 
            onClick={handleLogin} 
            className="bg-black hover:bg-gray-800 text-white h-14 px-8 rounded-full text-lg font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-1 mb-8"
        >
            MULAI SCAN DOKUMEN <ArrowRight className="w-5 h-5" />
        </Button>

        <p className="text-sm text-gray-400 flex items-center gap-2 font-medium">
           <ShieldCheck className="w-4 h-4" /> Secured by Cloudflare & Google OAuth
        </p>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
                { icon: Camera, title: "Capture", desc: "Foto dokumen fisik langsung dari lapangan." },
                { icon: Cpu, title: "AI Extraction", desc: "OCR membaca teks & validasi tanda tangan." },
                { icon: Cloud, title: "Cloud Archive", desc: "Data digital tersimpan aman di Cloud." }
            ].map((feature, idx) => (
                <div key={idx} className="flex flex-col items-center text-center space-y-4">
                    <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
                        <feature.icon className="w-8 h-8 text-black dark:text-white" />
                    </div>
                    <h3 className="text-lg font-bold">{feature.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{feature.desc}</p>
                </div>
            ))}
        </div>
      </section>

      {/* REVIEWS */}
      <section className="container mx-auto px-4 py-24 bg-white dark:bg-zinc-900 border-y border-gray-100 dark:border-zinc-800">
        <h2 className="text-2xl font-bold text-center mb-12">Kata Mereka yang Terbantu</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><Skeleton className="h-40 w-full rounded-2xl" /><Skeleton className="h-40 w-full rounded-2xl" /><Skeleton className="h-40 w-full rounded-2xl" /></div>
        ) : ratings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {ratings.map((rating) => (
              <div key={rating.id} className="bg-[#F8F9FA] dark:bg-zinc-950 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800">
                 <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (<Star key={i} className={`w-4 h-4 ${i < rating.stars ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200"}`} />))}
                 </div>
                 <p className="text-gray-600 dark:text-gray-400 italic mb-6 text-sm">"{rating.message}"</p>
                 <div className="flex items-center gap-3">
                    <img src={rating.userAvatar} className="w-8 h-8 rounded-full" alt="" />
                    <span className="font-bold text-sm">{rating.userName}</span>
                 </div>
              </div>
            ))}
          </div>
        ) : <p className="text-center text-gray-500">Belum ada review.</p>}
      </section>

      <footer className="py-8 text-center text-xs text-gray-400">© 2025 SmartDoc Pipeline.</footer>
    </div>
  );
}
