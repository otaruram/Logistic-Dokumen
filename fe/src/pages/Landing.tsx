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
    // Cek Dark Mode (tetap dipertahankan agar konsisten jika user sudah login sebelumnya)
    const savedTheme = sessionStorage.getItem('theme');
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    // Fetch Ratings untuk section "Trusted by Teams"
    const fetchRatings = async () => {
      try {
        const res = await apiFetch("/ratings");
        const json = await res.json();
        if (json.status === "success") {
            // Ambil 6 review terbaru saja agar tampilan rapi
            setRatings(json.data.slice(0, 6));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRatings();
  }, []);

  const handleLogin = () => {
    // Di real app, ini akan arahkan ke Google OAuth flow
    // Untuk sekarang, kita simpan dummy user dan redirect
    sessionStorage.setItem('user', JSON.stringify({
      email: "demo@smartdoc.com",
      name: "Demo User",
      picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=Demo",
      creditBalance: 3,
      isDriveEnabled: true // Anggap sudah connect drive
    }));
    navigate('/dashboard');
  };

  return (
    // Background Putih Bersih / Abu super muda
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 text-[#1A1A1A] dark:text-white font-sans overflow-x-hidden">
      
      {/* 1. HEADER (Bagian Atas) - Minimalis */}
      <nav className="flex justify-between items-center p-6 container mx-auto">
        <h1 className="text-xl font-bold tracking-tight font-sans">SmartDoc Pipeline</h1>
        <Button 
            onClick={handleLogin} 
            variant="outline"
            className="rounded-full border-gray-300 hover:bg-gray-100 hover:text-black dark:border-zinc-700 dark:hover:bg-zinc-800 dark:text-white text-sm px-4 py-2 transition-all flex items-center gap-2"
        >
            {/* Ikon Google Sederhana */}
            <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.66-2.06z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l2.66 2.06c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Masuk dengan Google
        </Button>
      </nav>

      {/* 2. HERO SECTION (Bagian Tengah) - Center Aligned */}
      <section className="container mx-auto px-4 py-24 flex flex-col items-center text-center max-w-4xl">
        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight mb-8 text-[#1A1A1A] dark:text-white">
          Digitalisasi Dokumen Logistik dalam Detik.
        </h1>
        <p className="text-xl md:text-2xl text-[#666666] dark:text-gray-400 mb-12 leading-relaxed max-w-2xl">
          Hentikan input data manual. Gunakan AI untuk ekstrak Surat Jalan & Validasi Tanda Tangan, langsung tersimpan ke Google Drive Anda.
        </p>
        
        {/* Call to Action Button - Hitam Solid & Rounded */}
        <Button 
            onClick={handleLogin} 
            className="bg-[#000000] hover:bg-zinc-800 text-white h-16 px-10 rounded-full text-lg font-bold transition-all flex items-center gap-2 group shadow-xl hover:shadow-2xl hover:-translate-y-1 mb-8"
        >
            MULAI SCAN DOKUMEN <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Button>

        {/* Trust Badge */}
        <p className="text-sm text-gray-400 flex items-center gap-2 font-medium">
           <ShieldCheck className="w-4 h-4 text-gray-400" /> Secured by Cloudflare & Google OAuth
        </p>
      </section>

      {/* 3. FEATURES GRID (Bagian Bawah) - 3 Kolom Sederhana */}
      <section className="container mx-auto px-4 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            {/* Kolom 1 */}
            <div className="flex flex-col items-center text-center space-y-4 group">
                <div className="p-5 bg-gray-100 dark:bg-zinc-800 rounded-2xl mb-2 group-hover:bg-gray-200 transition-colors">
                    <Camera className="w-10 h-10 text-[#1A1A1A] dark:text-white stroke-[1.5]" />
                </div>
                <h3 className="text-xl font-bold text-[#1A1A1A] dark:text-white">Capture</h3>
                <p className="text-[#666666] dark:text-gray-400 leading-relaxed">Upload foto dokumen fisik atau ambil gambar langsung dari lapangan.</p>
            </div>
            {/* Kolom 2 */}
            <div className="flex flex-col items-center text-center space-y-4 group">
                <div className="p-5 bg-gray-100 dark:bg-zinc-800 rounded-2xl mb-2 group-hover:bg-gray-200 transition-colors">
                    <Cpu className="w-10 h-10 text-[#1A1A1A] dark:text-white stroke-[1.5]" />
                </div>
                <h3 className="text-xl font-bold text-[#1A1A1A] dark:text-white">AI Extraction</h3>
                <p className="text-[#666666] dark:text-gray-400 leading-relaxed">OCR Engine membaca teks dan memvalidasi keberadaan tanda tangan.</p>
            </div>
            {/* Kolom 3 */}
            <div className="flex flex-col items-center text-center space-y-4 group">
                <div className="p-5 bg-gray-100 dark:bg-zinc-800 rounded-2xl mb-2 group-hover:bg-gray-200 transition-colors">
                    <Cloud className="w-10 h-10 text-[#1A1A1A] dark:text-white stroke-[1.5]" />
                </div>
                <h3 className="text-xl font-bold text-[#1A1A1A] dark:text-white">Cloud Archive</h3>
                <p className="text-[#666666] dark:text-gray-400 leading-relaxed">File asli dan data digital otomatis terorganisir di Google Drive korporat.</p>
            </div>
        </div>
      </section>

      {/* 4. REVIEW SECTION (BARU) - Minimalist Cards */}
      <section className="container mx-auto px-4 py-24 bg-[#F3F4F6] dark:bg-zinc-900/50 rounded-[3rem] my-12">
        <h2 className="text-3xl font-bold text-center mb-16 text-[#1A1A1A] dark:text-white">Kata Mereka yang Terbantu</h2>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-2xl bg-gray-200 dark:bg-zinc-800" />)}
          </div>
        ) : ratings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {ratings.map((rating) => (
              <div key={rating.id} className="bg-white dark:bg-zinc-800 p-8 rounded-3xl shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-zinc-700/50 flex flex-col h-full">
                 {/* Stars */}
                 <div className="flex mb-6">
                    {[...Array(5)].map((_, starIndex) => (
                      <Star key={starIndex} className={`w-4 h-4 ${starIndex < rating.stars ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200 dark:fill-zinc-600 dark:text-zinc-600"}`} />
                    ))}
                 </div>
                 {/* Message */}
                 <p className="text-[#666666] dark:text-gray-300 italic mb-8 flex-grow text-lg leading-relaxed">"{rating.message}"</p>
                 {/* User Info */}
                 <div className="flex items-center gap-4 mt-auto">
                    <img src={rating.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rating.userName}`} alt={rating.userName} className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-700 object-cover" />
                    <div>
                        <h4 className="font-bold text-[#1A1A1A] dark:text-white">{rating.userName}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Pengguna SmartDoc</p>
                    </div>
                 </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">Belum ada review publik.</p>
        )}
      </section>

      {/* 5. FOOTER (Paling Bawah) - Sangat Sederhana */}
      <footer className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p className="mb-4">© 2025 SmartDoc Pipeline. Didesain untuk efisiensi Supply Chain.</p>
          <div className="flex justify-center gap-6 font-medium">
             <a href="#" className="hover:text-[#1A1A1A] dark:hover:text-white transition-colors">GitHub Repository</a>
             <span className="text-gray-300 dark:text-zinc-700">|</span>
             <a href="#" className="hover:text-[#1A1A1A] dark:hover:text-white transition-colors">Dokumentasi</a>
          </div>
      </footer>
    </div>
  );
}
