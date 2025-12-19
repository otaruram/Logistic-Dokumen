import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Send, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-service";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    else navigate('/landing');
  }, [navigate]);

  const handleRating = async () => {
    if (!review.trim()) return toast.error("Pesan ulasan wajib diisi.");
    setIsSubmitting(true);
    try {
      const res = await apiFetch("/rating", { 
        method: "POST", 
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.credential}` },
        body: JSON.stringify({ stars: rating, message: review, userName: user.name, userAvatar: user.picture, emoji: "⭐" }) 
      });
      if (res.ok) { toast.success("Ulasan terkirim!"); setReview(""); }
      else { toast.error("Gagal mengirim ulasan."); }
    } catch { toast.error("Koneksi server terputus."); } 
    finally { setIsSubmitting(false); }
  }; // <--- TADI KURANG PENUTUP INI

  const handleDelete = async () => {
    const check = prompt("Ketik 'HAPUS' untuk konfirmasi penghapusan permanen.");
    if (check !== "HAPUS") return;
    
    toast.promise(async () => {
      const res = await apiFetch("/delete-account", { 
        method: "DELETE", 
        headers: { "Authorization": `Bearer ${user.credential}` } 
      });
      if (!res.ok) throw new Error("Gagal menghapus.");
      localStorage.clear();
      navigate('/landing');
    }, { loading: "Menghapus akun...", success: "Akun berhasil dihapus.", error: "Gagal menghapus akun." });
  };

  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-8 min-h-screen bg-white dark:bg-zinc-950">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft/></Button>
        <h1 className="font-black text-sm uppercase tracking-widest opacity-50">Settings & Profile</h1>
      </div>

      <div className="flex flex-col items-center py-6">
        <Avatar className="w-24 h-24 mb-4 border-4 border-slate-50 shadow-sm">
          <AvatarImage src={user?.picture}/>
          <AvatarFallback className="bg-blue-600 text-white text-2xl font-black">{user?.name?.charAt(0)}</AvatarFallback>
        </Avatar>
        <h2 className="text-2xl font-black italic tracking-tighter">{user?.name}</h2>
        <p className="text-slate-400 text-xs font-medium">{user?.email}</p>
      </div>

      <div className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-[2rem] border dark:border-zinc-800 flex justify-between items-center">
        <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sisa Kredit</p><p className="text-3xl font-black text-blue-600">{user?.creditBalance ?? 0}</p></div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reset Bulanan</p>
          <p className={cn("text-sm font-black italic", user?.resetInfo?.color === 'red' ? 'text-red-500' : 'text-green-600')}>
            {user?.resetInfo?.nextResetDate || "N/A"}
          </p>
        </div>
      </div>

      <div className="space-y-4 pt-6">
        <h3 className="text-xs font-black uppercase text-center opacity-40 tracking-[0.3em]">Rate Experience</h3>
        <div className="flex justify-center gap-2">
          {[1,2,3,4,5].map(s => <Star key={s} onClick={() => setRating(s)} className={cn("w-10 h-10 cursor-pointer transition-all active:scale-90", s <= rating ? "fill-yellow-400 text-yellow-400 drop-shadow-sm" : "text-slate-200")}/>)}
        </div>
        <Textarea value={review} onChange={e => setReview(e.target.value)} placeholder="Tulis masukan Anda di sini..." className="rounded-2xl bg-slate-50 dark:bg-zinc-900 border-none p-4 text-sm min-h-[120px] focus:ring-blue-600"/>
        <Button onClick={handleRating} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-600/20">
          {isSubmitting ? "Sending..." : "Kirim Ulasan"}
        </Button>
      </div>

      <div className="pt-10">
        <button onClick={handleDelete} className="w-full py-4 text-[10px] font-black tracking-[0.3em] text-red-500 border border-red-100 dark:border-red-900/30 rounded-2xl hover:bg-red-50 transition-all uppercase">
          Delete Account Permanently
        </button>
      </div>
    </div>
  );
} // <--- PASTIKAN PENUTUP KOMPONEN INI JUGA ADA
