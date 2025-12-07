import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Key, Info, Github, Linkedin, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://logistic-dokumen.onrender.com';

export default function Settings() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [maskedApiKey, setMaskedApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [provider, setProvider] = useState('openai');
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    setIsDarkMode(savedTheme === 'dark');

    // Apply theme to body
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
    }

    // Fetch user's API key from backend only on initial mount
    fetchApiKey();
  }, []); // Only run once on mount

  const fetchApiKey = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const token = user.credential;
      
      if (!token) {
        console.log('No token found, user not logged in');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/user/apikey`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('API key fetch response:', data);
        
        // Only update if we got valid data
        if (data.hasApiKey) {
          setHasApiKey(true);
          setMaskedApiKey(data.apiKey);
          setProvider(data.provider);
          setUseOwnKey(true);
        } else {
          // No API key in database
          setHasApiKey(false);
          setUseOwnKey(false);
        }
      } else {
        console.error('Failed to fetch API key:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Error fetching API key:', error);
    }
  };

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

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error('API Key tidak boleh kosong!');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      toast.error('Format API Key tidak valid! Harus diawali dengan "sk-"');
      return;
    }

    // Get token from user object
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = user.credential;
    
    if (!token) {
      toast.error('Anda harus login terlebih dahulu!');
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/apikey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          apiKey: apiKey,
          provider: provider,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Save API key response:', data);
        
        // Mask the saved API key for display
        const masked = apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length - 4);
        
        // Update all states immediately
        setHasApiKey(true);
        setUseOwnKey(true);
        setIsEditing(false);
        setMaskedApiKey(masked);
        setProvider(provider);
        setApiKey('');
        
        toast.success(data.message || 'API Key berhasil disimpan!');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Gagal menyimpan API Key');
        console.error('Save failed:', response.status, error);
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      toast.error('Gagal menyimpan API Key');
    } finally {
      setLoading(false);
    }
  };

  const deleteApiKey = async () => {
    setLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const token = user.credential;
      
      const response = await fetch(`${API_BASE_URL}/api/user/apikey`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setHasApiKey(false);
        setMaskedApiKey('');
        setUseOwnKey(false);
        setApiKey('');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Gagal menghapus API Key');
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error('Gagal menghapus API Key');
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };

  const handleToggleOwnKey = (checked: boolean) => {
    console.log('Toggle clicked:', { checked, hasApiKey, useOwnKey });
    
    // If user wants to turn ON but hasn't saved API key yet, just enable the form
    if (checked && !hasApiKey) {
      setUseOwnKey(true);
      toast.info('Silakan masukkan dan simpan API Key Anda');
      return;
    }
    
    // If user wants to turn OFF
    if (!checked) {
      setUseOwnKey(false);
      toast.success('🤖 BYOK Nonaktif - Menggunakan API Key default');
      return;
    }
    
    // If user wants to turn ON and has API key
    if (checked && hasApiKey) {
      setUseOwnKey(true);
      toast.success('🔑 BYOK Aktif - Menggunakan API Key pribadi');
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setApiKey('');
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
        
        {/* API Key Settings */}
        <div className="brutal-border-thin bg-background p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-6 h-6" />
            <h2 className="text-lg font-bold uppercase">Chatbot API Configuration</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-bold">Gunakan API Key Pribadi</Label>
                <p className="text-sm text-muted-foreground">
                  {useOwnKey && hasApiKey ? '🔑 BYOK Aktif - Chatbot menggunakan API key Anda' : '🤖 Default - Chatbot menggunakan API key sistem'}
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
                {hasApiKey && !isEditing ? (
                  <>
                    <Label className="font-bold">API Key Tersimpan</Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={maskedApiKey}
                        className="brutal-border-thin font-mono text-sm flex-1"
                        disabled
                      />
                      <Button
                        onClick={handleEdit}
                        variant="outline"
                        size="icon"
                        className="brutal-border-thin"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => setShowDeleteDialog(true)}
                        variant="destructive"
                        size="icon"
                        className="brutal-border-thin"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-success">
                      ✅ API Key tersimpan. Provider: {provider.toUpperCase()}
                    </p>
                  </>
                ) : (
                  <>
                    <Label htmlFor="apiKey" className="font-bold">OpenAI API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="brutal-border-thin font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      API Key akan disimpan secara aman di database terenkripsi. Dapatkan di <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com</a>
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={saveApiKey}
                        className="flex-1 brutal-border-thin"
                        variant="default"
                        disabled={loading}
                      >
                        {loading ? 'Menyimpan...' : isEditing ? 'Update API Key' : 'Simpan API Key'}
                      </Button>
                      {isEditing && (
                        <Button
                          onClick={() => {
                            setIsEditing(false);
                            setApiKey('');
                          }}
                          variant="outline"
                          className="brutal-border-thin"
                        >
                          Batal
                        </Button>
                      )}
                    </div>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              API Key Anda akan dihapus secara permanen dari database. 
              Sistem akan menggunakan API Key default setelah penghapusan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteApiKey}
              className="bg-red-600 hover:bg-red-700"
              disabled={loading}
            >
              {loading ? 'Menghapus...' : 'Ya, Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
