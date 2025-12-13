import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Github, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Load theme from sessionStorage
    const savedTheme = sessionStorage.getItem('theme');
    setIsDarkMode(savedTheme === 'dark');
    
    // Apply theme to document
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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

    toast.success(`Tema berhasil diubah ke ${newTheme ? 'Dark' : 'Light'} Mode`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/')}
              className="brutal-border hover:bg-accent"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold uppercase tracking-tight">SETTINGS</h1>
          </div>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Theme Settings */}
          <div className="bg-card border brutal-border rounded-lg p-6">
            <h2 className="text-lg font-bold uppercase mb-4">PENGATURAN TEMA</h2>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium uppercase">
                  Dark Mode
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Aktifkan tema gelap untuk pengalaman visual yang lebih nyaman
                </p>
              </div>
              <Switch
                checked={isDarkMode}
                onCheckedChange={toggleTheme}
              />
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-card border brutal-border rounded-lg p-6">
            <h2 className="text-lg font-bold uppercase mb-4">INFORMASI</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Versi Aplikasi</p>
                <p className="text-xs text-muted-foreground">OCR.WTF v2.0</p>
              </div>
              
              <div>
                <p className="text-sm font-medium">Developer</p>
                <div className="flex items-center gap-2 mt-1">
                  <a 
                    href="https://github.com/otaruram" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <Github className="w-3 h-3" />
                    GitHub
                  </a>
                  <a 
                    href="https://linkedin.com/in/otaruram" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <Linkedin className="w-3 h-3" />
                    LinkedIn
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}