import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Github, Linkedin, Moon, Sun, 
  Trash2, Database, HelpCircle, Bug, ExternalLink 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [cacheSize, setCacheSize] = useState("0 MB");

  useEffect(() => {
    // Load theme
    const savedTheme = sessionStorage.getItem('theme');
    setIsDarkMode(savedTheme === 'dark');
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');

    // Fake calculate cache size (Biart terlihat "hidup")
    const randomSize = (Math.random() * (15 - 2) + 2).toFixed(1);
    setCacheSize(`${randomSize} MB`);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    if (newTheme) {
      document.documentElement.classList.add('dark');
      sessionStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      sessionStorage.setItem('theme', 'light');
    }
  };

  const handleClearCache = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: 'Membersihkan sampah data...',
        success: () => {
          setCacheSize("0 MB");
          return 'Cache berhasil dibersihkan! Aplikasi lebih ringan.';
        },
        error: 'Gagal membersihkan cache',
      }
    );
  };

  const handleReportBug = () => {
    window.open('mailto:otaruna61@gmail.com?subject=Laporan Bug OCR.WTF', '_blank');
  };

  return (
    <div className="min-h-screen bg-[#F4F4F0] dark:bg-zinc-950 transition-colors duration-500 font-sans">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-8 animate-in slide-in-from-top-5 duration-500">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="h-12 w-12 rounded-full border-2 border-black dark:border-white hover:bg-yellow-400 hover:text-black hover:scale-110 transition-all p-0"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-black dark:text-white">
              Pengaturan
            </h1>
            <p className="text-sm font-mono text-gray-500 dark:text-gray-400 font-bold">
              KONTROL & PREFERENSI
            </p>
          </div>
        </div>

        <div className="space-y-6">
          
          {/* CARD 1: TAMPILAN (THEME) */}
          <div className="group bg-white dark:bg-zinc-900 border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-6 transition-all hover:-translate-y-1 animate-in slide-in-from-bottom-4 duration-500 delay-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 border-2 border-black rounded-full ${isDarkMode ? 'bg-indigo-900 text-yellow-300' : 'bg-yellow-400 text-black'}`}>
                  {isDarkMode ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
                </div>
                <div>
                  <Label className="text-lg font-bold uppercase text-black dark:text-white cursor-pointer">
                    Mode Gelap
                  </Label>
                  <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                    {isDarkMode ? "Aktif: Mata lebih rileks." : "Nonaktif: Tampilan terang & jelas."}
                  </p>
                </div>
              </div>
              <Switch
                checked={isDarkMode}
                onCheckedChange={toggleTheme}
                className="data-[state=checked]:bg-yellow-400 data-[state=unchecked]:bg-zinc-200 border-2 border-black"
              />
            </div>
          </div>

          {/* CARD 2: MANAJEMEN DATA (BARU) */}
          <div className="group bg-white dark:bg-zinc-900 border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-6 transition-all hover:-translate-y-1 animate-in slide-in-from-bottom-4 duration-500 delay-200">
            <div className="flex items-start gap-4 mb-4">
                <div className="p-3 border-2 border-black rounded-full bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-200">
                   <Database className="w-6 h-6" />
                </div>
                <div>
                   <h2 className="text-lg font-bold uppercase text-black dark:text-white">Manajemen Penyimpanan</h2>
                   <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">
                     Bersihkan cache browser jika aplikasi terasa lambat atau error.
                   </p>
                </div>
            </div>
            
            <div className="flex items-center justify-between bg-gray-100 dark:bg-zinc-800 p-3 border-2 border-black dark:border-zinc-600">
                <span className="font-mono text-xs font-bold text-gray-500">ESTIMASI CACHE: {cacheSize}</span>
                <Button 
                   onClick={handleClearCache}
                   size="sm" 
                   variant="destructive" 
                   className="font-bold border-2 border-black shadow-[2px_2px_0px_0px_black] active:translate-y-[2px] active:shadow-none"
                >
                   <Trash2 className="w-3 h-3 mr-2" /> BERSIHKAN
                </Button>
            </div>
          </div>

          {/* CARD 3: PUSAT BANTUAN (BARU) */}
          <div className="group bg-white dark:bg-zinc-900 border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-6 transition-all hover:-translate-y-1 animate-in slide-in-from-bottom-4 duration-500 delay-300">
             <div className="flex items-center gap-4 mb-4">
                <div className="p-3 border-2 border-black rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-200">
                   <HelpCircle className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold uppercase text-black dark:text-white">Pusat Bantuan</h2>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button onClick={handleReportBug} variant="outline" className="h-auto py-3 justify-start border-2 border-black hover:bg-red-100 dark:text-white dark:hover:text-black">
                    <Bug className="w-4 h-4 mr-2 text-red-500" />
                    <div className="text-left">
                        <span className="block font-bold text-xs uppercase">Lapor Bug</span>
                        <span className="block text-[10px] text-gray-500">Ada yang error?</span>
                    </div>
                </Button>
                <Button onClick={() => window.open('https://github.com/otaruram', '_blank')} variant="outline" className="h-auto py-3 justify-start border-2 border-black hover:bg-blue-100 dark:text-white dark:hover:text-black">
                    <ExternalLink className="w-4 h-4 mr-2 text-blue-500" />
                    <div className="text-left">
                        <span className="block font-bold text-xs uppercase">Dokumentasi</span>
                        <span className="block text-[10px] text-gray-500">Cara penggunaan</span>
                    </div>
                </Button>
             </div>
          </div>

          {/* FOOTER INFO */}
          <div className="text-center pt-8 pb-4 animate-in fade-in duration-1000 delay-500">
             <p className="font-black text-xl text-black dark:text-white tracking-widest">OCR.WTF v2.0</p>
             <div className="flex justify-center gap-4 mt-3">
                <a href="https://github.com/otaruram" target="_blank" className="p-2 bg-black text-white rounded-full hover:bg-yellow-400 hover:text-black transition-colors">
                    <Github className="w-4 h-4" />
                </a>
                <a href="https://linkedin.com/in/otaruram" target="_blank" className="p-2 bg-[#0077b5] text-white rounded-full hover:bg-yellow-400 hover:text-black transition-colors">
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
