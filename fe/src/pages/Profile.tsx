import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Send, Trash2, Zap, Calendar } from "lucide-react";
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
  }, []);

  const handleDeleteAccount = async () => {
    const confirm = prompt("Ketik 'HAPUS' untuk menghapus akun permanen.");
    if (confirm !== "HAPUS") return;
    try {
        const res = await apiFetch("/delete-account", { method: "DELETE", headers: { "Authorization": `Bearer ${user.credential}` } });
        if (res.ok) { localStorage.clear(); navigate('/landing'); toast.success("Akun dihapus."); }
    } catch { toast.error("Gagal."); }
  };

  const handleSendReview = async () => {
    if (!review.trim()) return toast.error("Tulis pesan ulasan.");
    setIsSubmitting(true);
    try {
        const res = await apiFetch("/rating", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.credential}` },
            body: JSON.stringify({ stars: rating, emoji: "⭐", message: review, userName: user.name, userAvatar: user.picture })
        });
        if (res.ok) { toast.success("Terima kasih!"); setReview(""); }
    } finally { setIsSubmitting(false); }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 pb-20">
      <div className="max-w-xl mx-auto px-6">
        <div className="flex items-center py-8">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full"><ArrowLeft/></Button>
            <h1 className="flex-1 text-center font-bold text-xs uppercase tracking-widest opacity-50">Profile Settings</h1>
        </div>

        {/* Hero */}
        <div className="flex flex-col items-center mb-10">
            <Avatar className="w-24 h-24 mb-4 border-2 border-slate-100 shadow-sm">
                <AvatarImage src={user.picture} />
                <AvatarFallback className="bg-blue-600 text-white font-black">{user.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-black">{user.name}</h2>
            <p className="text-slate-400 text-sm mb-2">{user.email}</p>
            <span className="px-3 py-0.5 bg-slate-100 dark:bg-zinc-800 text-[10px] font-black rounded-full uppercase tracking-tighter italic">Free Tier</span>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 gap-4 mb-10">
            <div className="bg-slate-50 dark:bg-zinc-900 p-5 rounded-2xl border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-blue-600 fill-blue-600"/>
                    <div><p className="text-[10px] font-bold text-slate-500 uppercase">Kredit Aktif</p><p className="text-lg font-black">{user.creditBalance}</p></div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Next Reset</p>
                    <p className={cn("text-sm font-bold", user.resetInfo?.color === 'red' ? 'text-red-500' : 'text-green-600')}>{user.resetInfo?.nextResetDate}</p>
                </div>
            </div>
        </div>

        {/* Review */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border mb-10">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 text-center">Berikan Feedback</h3>
            <div className="flex justify-center gap-3 mb-6">
                {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setRating(s)} className="transition-transform active:scale-90">
                        <Star className={cn("w-8 h-8", s <= rating ? "fill-yellow-400 text-yellow-400" : "text-slate-200")}/>
                    </button>
                ))}
            </div>
            <div className="relative">
                <Textarea placeholder="Ada saran atau kendala?" value={review} onChange={e => setReview(e.target.value)} className="bg-slate-50 dark:bg-zinc-800 border-none rounded-xl p-4 text-sm"/>
                <Button onClick={handleSendReview} disabled={isSubmitting} size="icon" className="absolute bottom-2 right-2 rounded-full h-8 w-8 bg-blue-600">
                    {isSubmitting ? "..." : <Send className="w-4 h-4"/>}
                </Button>
            </div>
        </div>

        {/* Danger Zone */}
        <button onClick={handleDeleteAccount} className="w-full py-4 text-[10px] font-black tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl border border-red-100 transition-all uppercase">
            Permanently Delete My Account
        </button>
      </div>
    </div>
  );
}
