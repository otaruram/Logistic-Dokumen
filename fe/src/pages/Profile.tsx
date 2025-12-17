import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-service";
import Header from "@/components/dashboard/Header";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CreditCard, Calendar, Mail, ShieldAlert, Trash2, Star, Send } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingMessage, setRatingMessage] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedUser = sessionStorage.getItem('user');
        const localUser = storedUser ? JSON.parse(storedUser) : null;
        if (!localUser?.credential) { navigate('/landing'); return; }

        const res = await apiFetch("/me", { headers: { "Authorization": `Bearer ${localUser.credential}` } });
        const json = await res.json();
        
        if (json.status === "success") {
             const merged = { ...localUser, ...json.data };
             setUser(merged);
             sessionStorage.setItem('user', JSON.stringify(merged));
        } else { setUser(localUser); }
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    };
    loadData();
  }, [navigate]);

  const handleDeleteAccount = async () => {
    if (!confirm("PERINGATAN: Akun dan semua data akan dihapus permanen. Lanjutkan?")) return;
    try {
        const res = await apiFetch("/delete-account", { 
            method: "DELETE",
            headers: { "Authorization": `Bearer ${user.credential}` }
        });
        const json = await res.json();
        if (json.status === "success") {
            sessionStorage.clear();
            navigate('/landing');
            toast.success("Akun berhasil dihapus.");
        } else { toast.error("Gagal menghapus akun."); }
    } catch (e) { toast.error("Terjadi kesalahan."); }
  };

  const handleSubmitRating = async () => {
    if (!ratingMessage.trim()) return toast.warning("Tulis pesan ulasan dulu ya!");
    setIsSubmittingRating(true);
    try {
      const emojiMap = ["😡", "🙁", "😐", "🙂", "🤩"];
      const payload = { stars: ratingStars, emoji: emojiMap[ratingStars - 1] || "🙂", message: ratingMessage, userName: user?.name || "Pengguna", userAvatar: user?.picture || "" };
      await apiFetch("/rating", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.credential}` }, body: JSON.stringify(payload) });
      toast.success("Terima kasih atas ulasannya! ⭐");
      setRatingMessage("");
    } catch (e) { toast.error("Gagal mengirim ulasan."); } 
    finally { setIsSubmittingRating(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 font-sans text-[#1A1A1A] dark:text-white">
      <Header user={user} onLogout={() => { sessionStorage.clear(); navigate('/landing'); }} onProfile={() => {}} onSettings={() => navigate('/settings')} />

      <main className="container mx-auto px-4 py-12 max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold mb-8 tracking-tight">Profile & Akun</h1>
        {loading ? ( <div className="space-y-4"><Skeleton className="h-40 w-full rounded-3xl" /><Skeleton className="h-20 w-full rounded-3xl" /></div> ) : (
            <>
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col md:flex-row items-center gap-6">
                    <Avatar className="h-24 w-24 border-4 border-gray-50 dark:border-zinc-800 shadow-inner"><AvatarImage src={user?.picture} /><AvatarFallback className="text-2xl">{user?.name?.charAt(0)}</AvatarFallback></Avatar>
                    <div className="text-center md:text-left space-y-1">
                        <h2 className="text-2xl font-bold">{user?.name}</h2>
                        <div className="flex items-center justify-center md:justify-start gap-2 text-gray-500 dark:text-gray-400 text-sm"><Mail className="w-4 h-4" /> {user?.email}</div>
                        <div className="pt-2"><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-black text-white dark:bg-white dark:text-black">{user?.tier || "FREE PLAN"}</span></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center gap-3 mb-2 text-gray-500"><div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><CreditCard className="w-5 h-5" /></div><span className="text-sm font-semibold uppercase tracking-wider">Sisa Kredit</span></div>
                        <p className="text-4xl font-bold">{user?.creditBalance}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center gap-3 mb-2 text-gray-500"><div className="p-2 bg-green-50 text-green-600 rounded-lg"><Calendar className="w-5 h-5" /></div><span className="text-sm font-semibold uppercase tracking-wider">Bergabung</span></div>
                        <p className="text-xl font-bold">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString("id-ID", { month: 'short', year: 'numeric' }) : "-"}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg">Beri Ulasan Aplikasi</h3><Star className="w-5 h-5 text-yellow-400 fill-yellow-400" /></div>
                    <div className="flex justify-center gap-2 mb-6">{[1, 2, 3, 4, 5].map((star) => (<button key={star} onClick={() => setRatingStars(star)} className="transition-transform hover:scale-110 focus:outline-none"><Star className={`w-8 h-8 ${star <= ratingStars ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-100 dark:text-zinc-700 dark:fill-zinc-800"}`} /></button>))}</div>
                    <textarea value={ratingMessage} onChange={(e) => setRatingMessage(e.target.value)} placeholder="Ceritakan pengalaman Anda..." className="w-full p-4 rounded-xl bg-gray-50 dark:bg-zinc-800 border-none text-sm mb-4" rows={3} />
                    <Button onClick={handleSubmitRating} disabled={isSubmittingRating} className="w-full rounded-xl font-bold">{isSubmittingRating ? "Mengirim..." : <><Send className="w-4 h-4 mr-2" /> Kirim Ulasan</>}</Button>
                </div>

                <div className="pt-8 border-t border-gray-200 dark:border-zinc-800">
                    <h3 className="text-sm font-bold text-red-600 uppercase mb-4 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Zona Bahaya</h3>
                    <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/20">
                        <div className="text-sm text-red-800 dark:text-red-200"><p className="font-bold">Hapus Akun</p></div>
                        <Button variant="destructive" size="sm" onClick={handleDeleteAccount}><Trash2 className="w-4 h-4 mr-2" /> Hapus</Button>
                    </div>
                </div>
            </>
        )}
      </main>
    </div>
  );
}
