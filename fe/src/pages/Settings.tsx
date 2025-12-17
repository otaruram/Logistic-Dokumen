import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch"; 
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, HardDrive, ChevronLeft, Trash2, ShieldAlert } from "lucide-react";
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
    if (!confirm("YAKIN? Data akan hilang permanen.")) return;
    try {
        await apiFetch("/delete-account", { method: "DELETE", headers: { "Authorization": `Bearer ${user.credential}` } });
        sessionStorage.clear();
        navigate('/landing');
        toast.success("Akun dihapus.");
    } catch (e) { toast.error("Gagal menghapus."); }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 font-sans text-[#1A1A1A] dark:text-white p-4">
      
      {/* HEADER MINIMALIS + ICONIC BACK BUTTON */}
      <div className="max-w-2xl mx-auto flex items-center gap-4 py-6">
        <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigate('/')} 
            className="rounded-full w-10 h-10 bg-white dark:bg-zinc-900 shadow-sm border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
        >
            <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan</h1>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Tampilan</h2>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><div className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-xl">{theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}</div><div><p className="font-bold text-sm">Mode Gelap</p><p className="text-xs text-gray-500">Sesuaikan dengan kenyamanan mata.</p></div></div>
                    <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Penyimpanan</h2>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><HardDrive className="w-5 h-5" /></div><div><p className="font-bold text-sm">Google Drive</p><p className="text-xs text-gray-500">Backup otomatis aktif.</p></div></div>
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">TERHUBUNG</span>
                </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/10 rounded-3xl p-6 border border-red-100 dark:border-red-900/20">
                <h2 className="text-xs font-bold uppercase tracking-wider text-red-600 mb-4 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Zona Bahaya</h2>
                <div className="flex items-center justify-between">
                    <div className="text-red-800 dark:text-red-200"><p className="font-bold text-sm">Hapus Akun</p><p className="text-xs opacity-70">Menghapus semua data log & profil.</p></div>
                    <Button variant="destructive" size="sm" onClick={handleDeleteAccount} className="rounded-lg"><Trash2 className="w-4 h-4 mr-2" /> Hapus</Button>
                </div>
            </div>

            <div className="text-center text-[10px] text-gray-400 mt-12">
                Version 2.1.0 (Stable Release)
            </div>
      </div>
    </div>
  );
}
