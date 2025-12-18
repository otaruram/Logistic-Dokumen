import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Send, Trash2, Calendar, CreditCard, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-service";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  
  // State untuk Rating
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Ambil data user dari localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        setUser(JSON.parse(storedUser));
    } else {
        navigate('/login');
    }
  }, [navigate]);

  // 🔥 FUNGSI HAPUS AKUN 🔥
  const handleDeleteAccount = async () => {
    if (!confirm("YAKIN HAPUS AKUN? \nSemua data, log scan, dan kredit akan hilang permanen.")) return;
    
    try {
        const res = await apiFetch("/delete-account", { 
            method: "DELETE", 
            headers: { "Authorization": `Bearer ${user.credential}` } 
        });

        if (res.ok) {
            localStorage.clear(); // Bersihkan data di HP
            toast.success("Akun berhasil dihapus.");
            navigate('/landing'); // Tendang ke Landing Page
        } else {
            toast.error("Gagal menghapus akun.");
        }
    } catch (e) {
        toast.error("Terjadi kesalahan sistem.");
    }
  };

  // 🔥 FUNGSI KIRIM ULASAN 🔥
  const handleSendReview = async () => {
    if (!review.trim()) {
        toast.error("Isi pesan ulasannya dulu ya!");
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
                emoji: "⭐", // Default emoji
                message: review,
                userName: user.name,
                userAvatar: user.picture
            })
        });
        
        if (res.ok) {
            toast.success("Ulasan terkirim!", { description: "Terima kasih atas masukan Anda." });
            setReview(""); // Reset form
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
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 font-sans text-[#1A1A1A] dark:text-white p-4 pb-20">
      
      {/* HEADER */}
      <div className="max-w-md mx-auto flex items-center gap-4 py-6">
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/dashboard')} 
            className="rounded-full hover:bg-gray-200 dark:hover:bg-zinc-800"
        >
            <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold uppercase tracking-wider">Profile Saya</h1>
      </div>

      <div className="max-w-md mx-auto space-y-6">
            
            {/* 1. KARTU PROFIL UTAMA */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col items-center text-center">
                <Avatar className="w-24 h-24 mb-4 border-4 border-gray-50 dark:border-zinc-800">
                    <AvatarImage src={user.picture} />
                    <AvatarFallback className="text-2xl">{user.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-black uppercase tracking-tight">{user.name}</h2>
                <p className="text-gray-400 text-xs mb-4">{user.email}</p>
                <span className="bg-black text-white dark:bg-white dark:text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                    {user.tier || "Free Member"}
                </span>
            </div>

            {/* 2. STATISTIK KREDIT & BERGABUNG */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-2 text-gray-400">
                        <CreditCard className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase">Sisa Kredit</span>
                    </div>
                    <p className="text-3xl font-black">{user.creditBalance ?? 0}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-2 text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase">Bergabung</span>
                    </div>
                    <p className="text-sm font-bold truncate">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) : "-"}
                    </p>
                </div>
            </div>

            {/* 3. FORM BERI ULASAN */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Beri Ulasan</h3>
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                </div>
                
                {/* Bintang */}
                <div className="flex justify-center gap-3 mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                            key={star} 
                            className={`w-8 h-8 cursor-pointer transition-transform hover:scale-110 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200 dark:text-zinc-700"}`}
                            onClick={() => setRating(star)}
                        />
                    ))}
                </div>

                <Textarea 
                    placeholder="Gimana pengalamanmu?" 
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    className="mb-4 bg-gray-50 dark:bg-zinc-800 border-none resize-none h-24 rounded-xl focus-visible:ring-1"
                />

                <Button onClick={handleSendReview} disabled={isSubmitting} className="w-full bg-black hover:bg-gray-800 dark:bg-white dark:text-black font-bold rounded-xl h-12">
                    {isSubmitting ? "MENGIRIM..." : <><Send className="w-4 h-4 mr-2" /> KIRIM</>}
                </Button>
            </div>

            {/* 4. TOMBOL HAPUS AKUN */}
            <div className="bg-red-50 dark:bg-red-900/10 rounded-3xl p-6 border border-red-100 dark:border-red-900/20">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-red-600">Hapus Akun</h3>
                        <p className="text-[10px] text-red-400 mt-1">Aksi ini tidak bisa dibatalkan.</p>
                    </div>
                    <Button variant="destructive" size="icon" onClick={handleDeleteAccount} className="rounded-xl w-10 h-10">
                        <Trash2 className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            <p className="text-center text-[10px] text-gray-300 uppercase py-4">
                SmartDoc Pipeline v2.1
            </p>
      </div>
    </div>
  );
}
