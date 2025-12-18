import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Send, Trash2, Calendar, Zap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-service";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  
  // State Rating
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        setUser(JSON.parse(storedUser));
    } else {
        navigate('/login');
    }
  }, [navigate]);

  // 🔥 FUNGSI HAPUS AKUN
  const handleDeleteAccount = async () => {
    const confirmText = prompt("Ketik 'HAPUS' untuk konfirmasi penghapusan akun permanen.");
    if (confirmText !== "HAPUS") return;
    
    try {
        const res = await apiFetch("/delete-account", { 
            method: "DELETE", 
            headers: { "Authorization": `Bearer ${user.credential}` } 
        });

        if (res.ok) {
            localStorage.clear();
            toast.success("Akun berhasil dihapus.");
            navigate('/landing');
        } else {
            toast.error("Gagal menghapus akun.");
        }
    } catch (e) {
        toast.error("Terjadi kesalahan sistem.");
    }
  };

  // 🔥 FUNGSI LOGOUT
  const handleLogout = () => {
      localStorage.clear();
      navigate('/login');
  };

  // 🔥 FUNGSI KIRIM ULASAN
  const handleSendReview = async () => {
    if (!review.trim()) {
        toast.error("Tulis pesan ulasan dulu ya!");
        return;
    }
    
    setIsSubmitting(true);
    try {
        const res = await apiFetch("/rating", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${user.credential}` 
            },
            body: JSON.stringify({
                stars: rating,
                emoji: "⭐",
                message: review,
                userName: user.name,
                userAvatar: user.picture
            })
        });
        
        if (res.ok) {
            toast.success("Ulasan terkirim!", { description: "Terima kasih feedback-nya!" });
            setReview(""); 
        } else {
            toast.error("Gagal mengirim ulasan.");
        }
    } catch (e) {
        toast.error("Gagal terhubung ke server.");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 font-sans text-slate-900 dark:text-white pb-10">
      
      {/* --- HEADER --- */}
      <div className="sticky top-0 z-10 bg-gray-50/80 dark:bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/dashboard')} 
            className="rounded-full hover:bg-white dark:hover:bg-zinc-800 shadow-sm"
        >
            <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="text-sm font-bold tracking-widest uppercase opacity-50">Profile</span>
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout}
            className="rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
            <LogOut className="w-5 h-5" />
        </Button>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6 mt-2">
            
            {/* 1. HERO PROFILE CARD */}
            <div className="flex flex-col items-center py-6">
                <div className="relative">
                    <Avatar className="w-28 h-28 border-4 border-white dark:border-zinc-800 shadow-xl mb-4">
                        <AvatarImage src={user.picture} className="object-cover" />
                        <AvatarFallback className="text-3xl font-bold bg-blue-600 text-white">{user.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-4 right-0 bg-black text-white dark:bg-white dark:text-black text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white dark:border-zinc-900 uppercase">
                        {user.tier || "Free"}
                    </span>
                </div>
                <h2 className="text-2xl font-black text-center leading-tight">{user.name}</h2>
                <p className="text-slate-400 text-sm font-medium">{user.email}</p>
            </div>

            {/* 2. ACTIVE STATS CARDS (GRID) */}
            <div className="grid grid-cols-2 gap-4">
                {/* Kartu Kredit */}
                <div className="group bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-zinc-800 relative overflow-hidden transition-all hover:shadow-md hover:scale-[1.02] active:scale-95 cursor-default">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-full text-blue-600 dark:text-blue-400">
                                <Zap className="w-4 h-4 fill-blue-600" />
                            </div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Kredit</span>
                        </div>
                        <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{user.creditBalance ?? 0}</p>
                    </div>
                </div>

                {/* Kartu Tanggal */}
                <div className="group bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-zinc-800 relative overflow-hidden transition-all hover:shadow-md hover:scale-[1.02] active:scale-95 cursor-default">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 dark:bg-orange-900/20 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-full text-orange-600 dark:text-orange-400">
                                <Calendar className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Join</span>
                        </div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-2">
                            {user.createdAt 
                                ? new Date(user.createdAt).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) 
                                : "-"
                            }
                        </p>
                    </div>
                </div>
            </div>

            {/* 3. REVIEW SECTION (CLEAN) */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-zinc-800">
                <h3 className="text-center text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Rate Your Experience</h3>
                
                {/* Interactive Stars */}
                <div className="flex justify-center gap-2 mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onClick={() => setRating(star)}
                            className="focus:outline-none transition-transform active:scale-90 hover:scale-110"
                        >
                            <Star 
                                className={cn(
                                    "w-9 h-9 transition-colors duration-200",
                                    star <= rating 
                                        ? "fill-yellow-400 text-yellow-400 drop-shadow-sm" 
                                        : "text-slate-200 dark:text-zinc-700"
                                )} 
                            />
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <Textarea 
                        placeholder="Ada saran untuk kami?" 
                        value={review}
                        onChange={(e) => setReview(e.target.value)}
                        className="bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl p-4 min-h-[100px] text-sm focus-visible:ring-blue-500"
                    />
                    <Button 
                        onClick={handleSendReview} 
                        disabled={isSubmitting} 
                        size="icon"
                        className="absolute bottom-3 right-3 h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-transform active:scale-90"
                    >
                        {isSubmitting ? <span className="animate-spin text-[8px]">⏳</span> : <Send className="w-4 h-4" />}
                    </Button>
                </div>
            </div>

            {/* 4. DANGER ZONE (MINIMALIST) */}
            <button 
                onClick={handleDeleteAccount}
                className="w-full py-4 text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 rounded-2xl transition-colors border border-transparent hover:border-red-200 flex items-center justify-center gap-2"
            >
                <Trash2 className="w-4 h-4" />
                HAPUS AKUN PERMANEN
            </button>

            <div className="text-center pb-8">
                <p className="text-[10px] text-slate-300 dark:text-zinc-700 uppercase tracking-widest font-bold">
                    OCR System v2.1
                </p>
            </div>
      </div>
    </div>
  );
}
