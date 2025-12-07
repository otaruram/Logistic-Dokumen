import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon, Sun, Key, Info, Github, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const savedTheme = localStorage.getItem('theme');
    const savedUseOwnKey = localStorage.getItem('useOwnKey') === 'true';
    const savedApiKey = localStorage.getItem('openaiApiKey') || '';

    setIsDarkMode(savedTheme === 'dark');
    setUseOwnKey(savedUseOwnKey);
    setApiKey(savedApiKey);
    setHasApiKey(!!savedApiKey);

    // Apply theme to body
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);

    if (newTheme) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }

    toast.success(`Tema berhasil diubah ke ${newTheme ? 'Dark' : 'Light'} Mode`);
  };

  const saveApiKey = () => {
    if (!apiKey.trim()) {
      toast.error('API Key tidak boleh kosong!');
      return;
    }

    localStorage.setItem('useOwnKey', 'true');
    localStorage.setItem('openaiApiKey', apiKey);
    setHasApiKey(true);
    setUseOwnKey(true);

    toast.success('API Key berhasil disimpan!');
  };

  const handleToggleOwnKey = (checked: boolean) => {
    setUseOwnKey(checked);
    
    if (checked) {
      // User mengaktifkan BYOK
      localStorage.setItem('useOwnKey', 'true');
      if (hasApiKey) {
        toast.success('Menggunakan API Key pribadi');
      }
    } else {
      // User menonaktifkan BYOK, kembali ke API key default
      localStorage.setItem('useOwnKey', 'false');
      toast.success('Kembali menggunakan API Key default');
    }
  };

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Header */}
      <div className="brutal-border-thin bg-background sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="brutal-border-thin"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <h1 className="text-xl md:text-2xl font-bold uppercase">SETTINGS</h1>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        
        {/* Theme Settings */}
        <div className="brutal-border-thin bg-background p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            {isDarkMode ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
            <h2 className="text-lg font-bold uppercase">Tema Aplikasi</h2>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-bold">Dark Mode</Label>
              <p className="text-sm text-muted-foreground">
                Ubah warna background dari putih ke hitam
              </p>
            </div>
            <Switch
              checked={isDarkMode}
              onCheckedChange={toggleTheme}
              className="data-[state=checked]:bg-black"
            />
          </div>
        </div>

        {/* API Key Settings */}
        <div className="brutal-border-thin bg-background p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-6 h-6" />
            <h2 className="text-lg font-bold uppercase">OpenAI API Configuration</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-bold">Gunakan API Key Pribadi</Label>
                <p className="text-sm text-muted-foreground">
                  Bring Your Own Key (BYOK) untuk chatbot OKi
                </p>
              </div>
              <Switch
                checked={useOwnKey}
                onCheckedChange={handleToggleOwnKey}
                className="data-[state=checked]:bg-black"
              />
            </div>

            {useOwnKey && (
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="apiKey" className="font-bold">OpenAI API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="brutal-border-thin font-mono text-sm"
                  disabled={hasApiKey}
                />
                {hasApiKey ? (
                  <p className="text-xs text-success">
                    ✅ API Key sudah tersimpan. Matikan toggle untuk menggunakan API default.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      API Key akan disimpan secara lokal di browser Anda
                    </p>
                    <Button
                      onClick={saveApiKey}
                      className="w-full mt-2 brutal-border-thin"
                      variant="default"
                    >
                      Simpan API Key
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* About Section */}
        <div className="brutal-border-thin bg-background p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Info className="w-6 h-6" />
            <h2 className="text-lg font-bold uppercase">Tentang Aplikasi</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Versi Aplikasi</Label>
              <p className="text-base font-bold">v1.0.0 (Beta)</p>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Developer</Label>
              <p className="text-base font-bold mb-2">Built with ☕ by Oki Taruna</p>
              
              <div className="flex gap-3">
                <a
                  href="https://github.com/otaruram"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="brutal-border-thin bg-white hover:bg-gray-100 px-4 py-2 flex items-center gap-2 transition-colors"
                >
                  <Github className="w-4 h-4" />
                  <span className="text-sm font-bold">GitHub</span>
                </a>

                <a
                  href="https://www.linkedin.com/in/otaruram"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="brutal-border-thin bg-[#0A66C2] hover:bg-[#004182] text-white px-4 py-2 flex items-center gap-2 transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                  <span className="text-sm font-bold">LinkedIn</span>
                </a>
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Website</Label>
              <a
                href="https://www.ocr.wtf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-base font-bold hover:underline"
              >
                www.ocr.wtf
              </a>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} OCR.WTF - Scan Dokumen Tanpa Ribet
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
