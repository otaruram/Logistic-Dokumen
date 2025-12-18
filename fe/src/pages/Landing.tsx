import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-service";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Landing() {
  const navigate = useNavigate();
  const [ratings, setRatings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🔥 FIX 1: Pindahkan Pengecekan Login ke paling atas & pakai useLayoutEffect jika perlu
  // Tapi useEffect dengan dependency kosong [] sudah cukup jika logicnya benar
  useEffect(() => {
    const checkLogin = () => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                if (user.credential) {
                    console.log("User detected, redirecting...");
                    navigate('/dashboard', { replace: true }); // Pakai replace biar gak bisa back
                    return true;
                }
            } catch (e) {
                localStorage.removeItem('user'); // Hapus jika data rusak
            }
        }
        return false;
    };

    if (!checkLogin()) {
        // Cuma fetch rating kalau user BELUM login
        const fetchRatings = async () => {
          try {
            const res = await apiFetch("/ratings");
            const json = await res.json();
            if (json.status === "success") {
                setRatings(json.data);
            }
          } catch (e) { console.error(e); } finally { setIsLoading(false); }
        };
        fetchRatings();
    }
  }, [navigate]);

  const handleLogin = () => navigate('/login');

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 text-[#1A1A1A] dark:text-white font-sans overflow-x-hidden">
      <nav className="flex justify-between items-center p-6 container mx-auto">
        <h1 className="text-xl font-bold tracking-tight">SmartDoc Pipeline</h1>
        <Button onClick={handleLogin} variant="outline" className="rounded-full border-gray-300">Masuk / Daftar</Button>
      </nav>

      {/* ... Sisa Tampilan Sama Persis ... */}
      <section className="container mx-auto px-4 py-24 flex flex-col items-center text-center max-w-4xl">
        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight mb-8">Digitalisasi Dokumen Logistik dalam Detik.</h1>
        <Button onClick={handleLogin} className="bg-black hover:bg-gray-800 text-white h-14 px-8 rounded-full text-lg font-bold flex items-center gap-2 shadow-lg mb-8">MULAI SCAN DOKUMEN <ArrowRight className="w-5 h-5" /></Button>
      </section>

      <section className="container mx-auto px-4 py-24 bg-white dark:bg-zinc-900 border-y border-gray-100 dark:border-zinc-800">
        <h2 className="text-2xl font-bold text-center mb-12">Kata Mereka yang Terbantu</h2>
        {isLoading ? ( <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><Skeleton className="h-40 w-full rounded-2xl" /></div> ) : ratings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {ratings.map((rating) => (
              <div key={rating.id} className="bg-[#F8F9FA] dark:bg-zinc-950 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800">
                 <div className="flex mb-4">{[...Array(5)].map((_, i) => (<Star key={i} className={`w-4 h-4 ${i < rating.stars ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200"}`} />))}</div>
                 <p className="text-gray-600 dark:text-gray-400 italic mb-6 text-sm">"{rating.message}"</p>
                 <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8 border border-gray-200">
                        <AvatarImage src={rating.userAvatar} />
                        <AvatarFallback>{rating.userName?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-sm">{rating.userName || "Pengguna"}</span>
                 </div>
              </div>
            ))}
          </div>
        ) : <p className="text-center text-gray-500">Belum ada review. Jadilah yang pertama!</p>}
      </section>
      
      <footer className="py-8 text-center text-xs text-gray-400">© 2025 SmartDoc Pipeline.</footer>
    </div>
  );
}
