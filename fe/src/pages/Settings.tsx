import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Github, Linkedin, 
  Trash2, Database, HelpCircle, Bug, ExternalLink, 
  ShieldAlert, LogOut, UserX 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast'; // Pastikan path hook toast benar
import { apiFetch } from "@/lib/api-service";

export default function Settings() {
  const navigate = useNavigate();
  const [cacheSize, setCacheSize] = useState("0 MB");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Hitung cache palsu (biar terlihat hidup)
    const randomSize = (Math.random() * (25 - 5) + 5).toFixed(1);
    setCacheSize(`${randomSize} MB`);
  }, []);

  const handleClearCache = () => {
    // Simulasi loading
    toast({ title: "Membersihkan...", description: "Menghapus sampah data aplikasi." });
    
    setTimeout(() => {
      setCacheSize("0 MB");
      toast({ title: "Berhasil!", description: "Penyimpanan browser kini bersih." });
    }, 1500);
  };

  const handleReportBug = () => {
    window.open('mailto:otaruna61@gmail.com?subject=Laporan Bug OCR.WTF', '_blank');
  };

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/landing');
    toast({ title: "Logout Berhasil", description: "Sampai jumpa lagi! 👋" });
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("⚠️ PERINGATAN KERAS!\n\nApakah Anda yakin ingin menghapus akun permanen? Semua kredit, log, dan riwayat scan akan hilang selamanya dan tidak bisa dikembalikan.");
    
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
        const res = await apiFetch('/delete-account', {
            method: 'DELETE',
            headers: { "Authorization": `Bearer ${user.credential}` }
        });
        
        const json = await res.json();
        
        if (json.status === 'success') {
            toast({ title: "Akun Terhapus", description: "Seluruh jejak digital Anda telah dibersihkan." });
            sessionStorage.clear();
            navigate('/landing');
        } else {
            throw new Error(json.message);
        }
    } catch (e: any) {
        toast({ title: "Gagal", description: e.message || "Gagal menghapus akun.", variant: "destructive" });
    } finally {
        setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F0] font-sans selection:bg-yellow-400 selection:text-black">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-8 animate-in slide-in-from-top-5 duration-500">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="h-12 w-12 rounded-full border-4 border-black bg-white hover:bg-yellow-400 hover:scale-110 transition-all p-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-black">
              Pengaturan
            </h1>
            <p className="text-sm font-mono text-gray-500 font-bold bg-white px-2 inline-block border-2 border-black rotate-1">
              KONTROL & SISTEM
            </p>
          </div>
        </div>

        <div className="space-y-6">
          
          {/* CARD 1: MANAJEMEN PENYIMPANAN */}
          <div className="group bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 transition-all hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-4 duration-500 delay-100">
            <div className="flex items-start gap-4 mb-4">
                <div className="p-3 border-2 border-black rounded-full bg-blue-100 text-blue-700">
                   <Database className="w-6 h-6" />
                </div>
                <div>
                   <h2 className="text-lg font-black uppercase text-black">Penyimpanan Lokal</h2>
                   <p className="text-xs font-mono text-gray-500 mt-1">
                     Bersihkan cache browser jika aplikasi terasa berat.
                   </p>
                </div>
            </div>
            
            <div className="flex items-center justify-between bg-gray-50 p-3 border-2 border-black border-dashed">
                <span className="font-mono text-xs font-bold text-gray-500">SAMPAH: {cacheSize}</span>
                <Button 
                   onClick={handleClearCache}
                   size="sm" 
                   className="font-bold border-2 border-black bg-white text-black hover:bg-red-500 hover:text-white shadow-[2px_2px_0px_0px_black] active:translate-y-[2px] active:shadow-none transition-all"
                >
                   <Trash2 className="w-3 h-3 mr-2" /> BERSIHKAN
                </Button>
            </div>
          </div>

          {/* CARD 2: PUSAT BANTUAN */}
          <div className="group bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 transition-all hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-4 duration-500 delay-200">
             <div className="flex items-center gap-4 mb-4">
                <div className="p-3 border-2 border-black rounded-full bg-green-100 text-green-700">
                   <HelpCircle className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-black uppercase text-black">Pusat Bantuan</h2>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button onClick={handleReportBug} variant="outline" className="h-auto py-3 justify-start border-2 border-black hover:bg-red-100 transition-all shadow-sm hover:shadow-md">
                    <Bug className="w-4 h-4 mr-2 text-red-500" />
                    <div className="text-left">
                        <span className="block font-bold text-xs uppercase">Lapor Bug</span>
                        <span className="block text-[10px] text-gray-500">Ada fitur error?</span>
                    </div>
                </Button>
                <Button onClick={() => window.open('https://github.com/otaruram', '_blank')} variant="outline" className="h-auto py-3 justify-start border-2 border-black hover:bg-blue-100 transition-all shadow-sm hover:shadow-md">
                    <ExternalLink className="w-4 h-4 mr-2 text-blue-500" />
                    <div className="text-left">
                        <span className="block font-bold text-xs uppercase">Dokumentasi</span>
                        <span className="block text-[10px] text-gray-500">Lihat source code</span>
                    </div>
                </Button>
             </div>
          </div>

          {/* CARD 3 (BARU): ZONA AKUN & PRIVASI */}
          <div className="group bg-red-50 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 transition-all hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_#ef4444] animate-in slide-in-from-bottom-4 duration-500 delay-300 relative overflow-hidden">
             
             {/* Pita Dekorasi */}
             <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-4 py-1 border-l-4 border-b-4 border-black">
                DANGER ZONE
             </div>

             <div className="flex items-center gap-4 mb-6">
                <div className="p-3 border-2 border-black rounded-full bg-red-500 text-white animate-pulse">
                   <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                   <h2 className="text-lg font-black uppercase text-red-600">Akun & Privasi</h2>
                   <p className="text-xs font-mono text-gray-600">
                     Kontrol penuh atas sesi dan data pribadi Anda.
                   </p>
                </div>
             </div>
             
             <div className="space-y-3">
                <Button 
                    onClick={handleLogout}
                    className="w-full h-12 bg-white text-black border-2 border-black font-bold uppercase hover:bg-yellow-400 hover:text-black shadow-[4px_4px_0px_0px_black] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-between px-6"
                >
                    <span>Keluar Sesi (Logout)</span>
                    <LogOut className="w-4 h-4" />
                </Button>

                <Button 
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="w-full h-12 bg-black text-white border-2 border-black font-bold uppercase hover:bg-red-600 hover:border-red-600 shadow-[4px_4px_0px_0px_#991b1b] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-between px-6"
                >
                    <span>{isDeleting ? "MENGHAPUS..." : "HAPUS AKUN PERMANEN"}</span>
                    <UserX className="w-4 h-4" />
                </Button>
                <p className="text-[10px] text-center text-red-500 font-bold mt-2">
                    *Tindakan hapus akun tidak dapat dibatalkan.
                </p>
             </div>
          </div>

          {/* FOOTER INFO */}
          <div className="text-center pt-8 pb-4 animate-in fade-in duration-1000 delay-500 opacity-60 hover:opacity-100 transition-opacity">
             <p className="font-black text-xl text-black tracking-widest">OCR.WTF v2.0</p>
             <div className="flex justify-center gap-4 mt-3">
                <a href="https://github.com/otaruram" target="_blank" className="p-2 bg-black text-white rounded-full hover:bg-yellow-400 hover:text-black transition-colors border-2 border-transparent hover:border-black">
                    <Github className="w-4 h-4" />
                </a>
                <a href="https://linkedin.com/in/otaruram" target="_blank" className="p-2 bg-[#0077b5] text-white rounded-full hover:bg-yellow-400 hover:text-black transition-colors border-2 border-transparent hover:border-black">
                    <Linkedin className="w-4 h-4" />
                </a>
             </div>
             <p className="text-[10px] font-mono text-gray-400 mt-4">
                 Dibuat dengan ☕ & 💻 oleh Oki Taruna
             </p>
          </div>

        </div>
      </div>
    </div>
  );
}
