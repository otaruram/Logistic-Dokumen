import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch"; 
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, HardDrive, ArrowLeft, Trash2, ShieldAlert } from "lucide-react";
import { apiFetch } from "@/lib/api-service";
import { toast } from "sonner";

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));
    const savedTheme = sessionStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    sessionStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const handleDeleteAccount = async () => {
    if (!confirm("PERINGATAN: Akun dan semua data akan dihapus permanen.")) return;
    try {
        await apiFetch("/delete-account", { method: "DELETE", headers: { "Authorization": `Bearer ${user.credential}` } });
        sessionStorage.clear();
        navigate('/landing');
        toast.success("Akun berhasil dihapus.");
    } catch (e) { toast.error("Terjadi kesalahan."); }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 font-sans text-[#1A1A1A] dark:text-white">
      
      {/* 🔥 TOMBOL KEMBALI & TANPA HEADER */}
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4 pl-0 hover:bg-transparent hover:text-gray-500">
            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Dashboard
        </Button>

        <h1 className="text-3xl font-bold mb-8">Pengaturan</h1>

        <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">Tampilan</h2>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><div className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-lg">{theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}</div><div><p className="font-medium">Mode Gelap</p><p className="text-sm text-gray-500">Sesuaikan dengan mata.</p></div></div>
                    <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">Integrasi</h2>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><HardDrive className="w-5 h-5" /></div><div><p className="font-medium">Google Drive</p><p className="text-sm text-gray-500">Simpan otomatis.</p></div></div>
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">TERHUBUNG</span>
                </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 border border-red-100 dark:border-red-900/20">
                <h2 className="text-sm font-bold uppercase tracking-wider text-red-600 mb-4 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Zona Bahaya</h2>
                <div className="flex items-center justify-between">
                    <div className="text-red-800 dark:text-red-200"><p className="font-bold">Hapus Akun</p><p className="text-sm opacity-80">Tindakan permanen.</p></div>
                    <Button variant="destructive" size="sm" onClick={handleDeleteAccount}><Trash2 className="w-4 h-4 mr-2" /> Hapus</Button>
                </div>
            </div>

            <div className="text-center text-xs text-gray-400 mt-12">Versi Aplikasi 2.1.0 (Stable)</div>
        </div>
      </div>
    </div>
  );
}
