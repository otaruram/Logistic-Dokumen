import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google'; // Pakai Hook, bukan Komponen jadi
import { ArrowLeft, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Animasi Ketik
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
  const [agreedToDrive, setAgreedToDrive] = useState(false); // State Checkbox
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedTheme = sessionStorage.getItem('theme');
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
  }, []);

  // --- LOGIC LOGIN UTAMA ---
  const googleLogin = useGoogleLogin({
    // Jika dicentang, minta izin Drive. Jika tidak, hanya email/profile.
    scope: agreedToDrive ? 'https://www.googleapis.com/auth/drive.file email profile' : 'email profile',
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      try {
        // 1. Kita punya Access Token (Bisa buat Drive!)
        const accessToken = tokenResponse.access_token;

        // 2. Ambil Info User (Nama, Foto) pakai Token tadi
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const userInfo = await userInfoRes.json();

        // 3. Simpan Data
        const userData = {
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture,
          credential: accessToken, // Simpan Access Token (Bukan ID Token)
          isDriveEnabled: agreedToDrive // Tandai user ini punya akses drive
        };

        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem('user', JSON.stringify(userData));

        toast.success(`Selamat datang, ${userInfo.name}!`);
        navigate('/');
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

        {/* --- CHECKBOX PERSETUJUAN --- */}
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

        {/* --- TOMBOL LOGIN CUSTOM --- */}
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
