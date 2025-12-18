import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// --- KOMPONEN ANIMASI KETIK (Ditingkatkan) ---
const TypewriterText = ({ text, speed = 150 }: { text: string; speed?: number }) => {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayText((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span className="font-mono">
      {displayText}
      {/* Kursor berkedip agar efek mengetik lebih nyata */}
      <span className="animate-pulse text-blue-600">_</span>
    </span>
  );
};

export default function Login() {
  const navigate = useNavigate();
  const [agreedToDrive, setAgreedToDrive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
  }, []);

  const googleLogin = useGoogleLogin({
    scope: agreedToDrive ? 'https://www.googleapis.com/auth/drive.file email profile' : 'email profile',
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      try {
        const accessToken = tokenResponse.access_token;
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const userInfo = await userInfoRes.json();

        const userData = {
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture,
          credential: accessToken,
          isDriveEnabled: agreedToDrive
        };

        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('user', JSON.stringify(userData));

        toast.success(`Welcome back, ${userInfo.given_name || userInfo.name}!`);
        navigate('/dashboard', { replace: true });

      } catch (error) {
        console.error("Login Error:", error);
        toast.error("Gagal mengambil data profil.");
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      toast.error("Login Dibatalkan.");
      setIsLoading(false);
    }
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-300">
      
      {/* Tombol Kembali yang Simpel */}
      <div className="absolute top-6 left-6">
        <Button 
          onClick={() => navigate('/landing')} 
          variant="ghost" 
          className="text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
        </Button>
      </div>

      {/* Container Utama: Card Modern Minimalis */}
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-zinc-800 p-8 text-center">
        
        {/* Header Logo */}
        <div className="mb-8 space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            <TypewriterText text="OCR.WTF" />
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Masuk untuk mengelola dokumen Anda
          </p>
        </div>

        {/* Opsi Drive (Disederhanakan) */}
        <div 
          className="group flex items-center gap-3 p-3 mb-6 rounded-lg border border-transparent hover:border-gray-100 dark:hover:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-all"
          onClick={() => setAgreedToDrive(!agreedToDrive)}
        >
          <div className={`${agreedToDrive ? 'text-blue-600' : 'text-gray-300'} transition-colors`}>
            {agreedToDrive ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Auto-Save ke Google Drive
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              Simpan hasil scan otomatis di folder drive Anda.
            </p>
          </div>
        </div>

        {/* Tombol Login */}
        <button
          onClick={() => googleLogin()}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black font-medium py-3 px-4 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="text-sm">Memproses...</span>
          ) : (
            <>
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="G" />
              <span>Lanjutkan dengan Google</span>
            </>
          )}
        </button>

        {/* Footer Info */}
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-zinc-800">
           <p className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">
            {agreedToDrive ? "ACCESS: FULL (DRIVE + EMAIL)" : "ACCESS: BASIC (EMAIL ONLY)"}
          </p>
        </div>

      </div>
    </div>
  );
}
