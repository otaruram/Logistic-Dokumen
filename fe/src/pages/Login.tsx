import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google'; 
import { ArrowLeft, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Komponen Animasi Teks Ketik
const TypewriterText = ({ text }: { text: string }) => {
  const [displayText, setDisplayText] = useState('');
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayText((prev) => prev + text.charAt(i));
        i++;
      } else clearInterval(timer);
    }, 150);
    return () => clearInterval(timer);
  }, [text]);
  return <span>{displayText}</span>;
};

export default function Login() {
  const navigate = useNavigate();
  // 🔥 UBAH KE TRUE: Agar default-nya sudah tercentang (User Experience lebih baik)
  const [agreedToDrive, setAgreedToDrive] = useState(true); 
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
  }, []);

  // --- LOGIC LOGIN UTAMA ---
  const googleLogin = useGoogleLogin({
    // Scope dinamis
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

        toast.success(`Selamat datang, ${userInfo.name}!`);
        
        // Redirect ke dashboard
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
    <div className="min-h-screen bg-[#F4F4F0] dark:bg-black flex flex-col items-center justify-center p-4 transition-colors duration-300">
      
      <div className="absolute top-6 left-6">
        <Button onClick={() => navigate('/landing')} variant="ghost" className="font-bold font-mono text-black dark:text-white hover:bg-transparent hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" /> KEMBALI
        </Button>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-8 text-center transition-all">
        
        <h1 className="text-5xl font-black mb-2 text-black dark:text-white tracking-tighter">
          <TypewriterText text="OCR.WTF" />
        </h1>
        <p className="font-mono text-sm text-gray-500 dark:text-gray-400 mb-8 font-bold">
          LOGIN AREA
        </p>

        {/* Checkbox Persetujuan Drive */}
        <div 
          className="flex items-start gap-3 text-left mb-6 cursor-pointer group"
          onClick={() => setAgreedToDrive(!agreedToDrive)}
        >
          <div className={`mt-1 transition-colors ${agreedToDrive ? 'text-green-600' : 'text-gray-400'}`}>
            {agreedToDrive ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </div>
          <p className="text-xs font-mono text-gray-600 dark:text-gray-300 leading-relaxed select-none group-hover:text-black dark:group-hover:text-white transition-colors">
            Saya mengizinkan <strong>OCR.WTF</strong> mengakses Google Drive saya untuk menyimpan hasil scan/laporan secara otomatis.
          </p>
        </div>

        {/* Tombol Masuk Google */}
        <div className="flex justify-center">
          <button
            onClick={() => googleLogin()}
            disabled={isLoading}
            className="w-full bg-black dark:bg-white text-white dark:text-black font-bold uppercase py-3 px-6 border-2 border-transparent hover:border-black dark:hover:border-white hover:bg-white dark:hover:bg-black hover:text-black dark:hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none flex items-center justify-center gap-2"
          >
            {isLoading ? "LOADING..." : (
              <>
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="G" />
                MASUK DENGAN GOOGLE
              </>
            )}
          </button>
        </div>

        <p className="mt-6 text-[10px] font-mono text-gray-400 uppercase">
          {agreedToDrive ? "Mode: Full Access (Drive + Profile)" : "Mode: Basic Access (Profile Only)"}
        </p>
      </div>
    </div>
  );
}
