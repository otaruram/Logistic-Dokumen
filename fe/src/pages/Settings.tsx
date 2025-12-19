import { useState } from "react";
import { Switch } from "@/components/ui/switch"; 
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, HardDrive, ChevronLeft } from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 py-8 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full"><ChevronLeft/></Button>
            <h1 className="text-xl font-bold italic tracking-tighter uppercase">Settings</h1>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border space-y-8 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-xl">{theme === 'dark' ? <Moon className="w-5 h-5"/> : <Sun className="w-5 h-5"/>}</div>
                    <div><p className="font-bold text-sm">Mode Gelap</p><p className="text-xs text-slate-500">Ubah tampilan workspace.</p></div>
                </div>
                <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
            </div>

            <div className="flex items-center justify-between border-t pt-8 dark:border-zinc-800">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><HardDrive className="w-5 h-5"/></div>
                    <div><p className="font-bold text-sm">Auto-Sync Google Drive</p><p className="text-xs text-slate-500">Backup otomatis setiap scan.</p></div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-tighter">Active</span>
            </div>
        </div>
      </div>
    </div>
  );
}
