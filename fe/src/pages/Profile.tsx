import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-service";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CreditCard, Calendar, Mail, ShieldAlert, Trash2, Star, Send, ChevronLeft, Zap } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingMessage, setRatingMessage] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // 🔥 LOGIKA UTAMA: SYNC DATA REALTIME SAAT DIBUKA
  useEffect(() => {
    const syncUserData = async () => {
      try {
        const storedUser = sessionStorage.getItem('user');
        const localUser = storedUser ? JSON.parse(storedUser) : null;
        
        // Kalau gak ada login, tendang ke depan
        if (!localUser?.credential) { navigate('/landing'); return; }

        // Tampilkan data lama dulu biar gak blank (Optimistic UI)
        setUser(localUser);

        // 🔥 WAJIB: Minta data terbaru ke Server (Sync)
        const res = await apiFetch("/me", { 
            headers: { "Authorization": `Bearer ${localUser.credential}` } 
        });
        const json = await res.json();
        
        if (json.status === "success") {
             // Gabungkan data lama dengan data baru dari server (Kredit, Tgl Join, dll)
             const updatedUser = { ...localUser, ...json.data };
             setUser(updatedUser);
             // Simpan ke HP biar halaman lain juga update
             sessionStorage.setItem('user', JSON.stringify(updatedUser));
        }
      } catch (e) { 
        console.error("Gagal sync profile:", e);
      } finally { 
        setLoading(false); 
      }
    };

    syncUserData();
  }, [navigate]);

  const handleDeleteAccount = async () => {
    if (!confirm("YAKIN? Data akan hilang permanen.")) return;
    try {
        await apiFetch("/delete-account", { method: "DELETE", headers: { "Authorization": `Bearer ${user.credential}` } });
        sessionStorage.clear();
        navigate('/landing');
        toast.success("Akun dihapus.");
    } catch (e) { toast.error("Gagal menghapus."); }
  };

  const handleSubmitRating = async () => {
    if (!ratingMessage.trim()) return toast.warning("Isi pesan dulu ya.");
    setIsSubmittingRating(true);
    try {
      const emojiMap = ["😡", "🙁", "😐", "🙂", "🤩"];
      const payload = { 
          stars: ratingStars, 
          emoji: emojiMap[ratingStars - 1] || "🙂", 
          message: ratingMessage, 
          userName: user?.name, 
          userAvatar: user?.picture 
      };
      await apiFetch("/rating", { 
          method: "POST", 
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.credential}` }, 
          body: JSON.stringify(payload) 
      });
      toast.success("Ulasan terkirim!");
      setRatingMessage("");
    } catch (e) { toast.error("Gagal kirim ulasan."); } 
    finally { setIsSubmittingRating(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 font-sans text-[#1A1A1A] dark:text-white p-4 pb-20">
      
      {/* HEADER MINIMALIS DENGAN TOMBOL KEMBALI ICONIC */}
      <div className="max-w-2xl mx-auto flex items-center gap-4 py-6">
        <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigate('/')} 
            className="rounded-full w-10 h-10 bg-white dark:bg-zinc-900 shadow-sm border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
        >
            <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Profile Saya</h1>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
          {loading ? ( <div className="space-y-4"><Skeleton className="h-40 w-full rounded-3xl" /><Skeleton className="h-20 w-full rounded-3xl" /></div> ) : (
            <>
                {/* ID CARD */}
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="w-32 h-32" /></div>
                    <Avatar className="h-24 w-24 border-4 border-gray-50 dark:border-zinc-800 shadow-inner z-10"><AvatarImage src={user?.picture} /><AvatarFallback className="text-2xl">{user?.name?.charAt(0)}</AvatarFallback></Avatar>
                    <div className="text-center md:text-left space-y-1 z-10">
                        <h2 className="text-2xl font-bold">{user?.name}</h2>
                        <div className="flex items-center justify-center md:justify-start gap-2 text-gray-500 dark:text-gray-400 text-sm"><Mail className="w-4 h-4" /> {user?.email}</div>
                        <div className="pt-2"><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-black text-white dark:bg-white dark:text-black tracking-wide">{user?.tier || "FREE MEMBER"}</span></div>
                    </div>
                </div>

                {/* STATS REALTIME (KREDIT & JOIN DATE) */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2 mb-2 text-gray-500"><CreditCard className="w-4 h-4" /><span className="text-xs font-bold uppercase">Sisa Kredit</span></div>
                        <p className="text-3xl font-bold text-black dark:text-white">{user?.creditBalance ?? 0}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2 mb-2 text-gray-500"><Calendar className="w-4 h-4" /><span className="text-xs font-bold uppercase">Bergabung</span></div>
                        <p className="text-sm font-bold mt-2">
                            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' }) : "-"}
                        </p>
                    </div>
                </div>

                {/* RATING SECTION */}
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-4"><h3 className="font-bold">Beri Ulasan</h3><Star className="w-5 h-5 text-yellow-400 fill-yellow-400" /></div>
                    <div className="flex justify-center gap-3 mb-6">{[1, 2, 3, 4, 5].map((star) => (<button key={star} onClick={() => setRatingStars(star)} className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"><Star className={`w-8 h-8 ${star <= ratingStars ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-100 dark:text-zinc-700 dark:fill-zinc-800"}`} /></button>))}</div>
                    <textarea value={ratingMessage} onChange={(e) => setRatingMessage(e.target.value)} placeholder="Gimana pengalamanmu?" className="w-full p-4 rounded-xl bg-gray-50 dark:bg-zinc-800 border-none text-sm mb-4 outline-none focus:ring-1 focus:ring-black" rows={2} />
                    <Button onClick={handleSubmitRating} disabled={isSubmittingRating} className="w-full rounded-xl font-bold h-12 bg-black text-white hover:bg-gray-800">{isSubmittingRating ? "Mengirim..." : <><Send className="w-4 h-4 mr-2" /> Kirim</>}</Button>
                </div>

                {/* DANGER ZONE */}
                <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/10 p-5 rounded-2xl border border-red-100 dark:border-red-900/20">
                    <div className="text-sm text-red-800 dark:text-red-200"><p className="font-bold">Hapus Akun</p><p className="text-xs opacity-70">Aksi ini tidak bisa dibatalkan.</p></div>
                    <Button variant="destructive" size="sm" onClick={handleDeleteAccount} className="rounded-lg"><Trash2 className="w-4 h-4" /></Button>
                </div>
            </>
          )}
      </div>
    </div>
  );
}
