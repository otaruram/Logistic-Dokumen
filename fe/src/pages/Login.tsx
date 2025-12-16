import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Komponen Animasi Ketik Simpel
const TypewriterText = ({ text }: { text: string }) => {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayText((prev) => prev + text.charAt(i));
        i++;
      } else clearInterval(timer);
    }, 150); // Kecepatan ketik
    return () => clearInterval(timer);
  }, [text]);

  return <span>{displayText}</span>;
};

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    const savedTheme = sessionStorage.getItem('theme');
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
  }, []);

  const handleSuccess = async (credentialResponse: any) => {
    try {
      const decoded: any = jwtDecode(credentialResponse.credential);
      
      const userData = {
        name: decoded.name,
        email: decoded.email,
        picture: decoded.picture,
        credential: credentialResponse.credential,
        // ❌ HAPUS BARIS creditBalance: 3 AGAR TIDAK RESET SENDIRI
      };

      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('user', JSON.stringify(userData));
      
      toast.success(`Selamat datang, ${decoded.name}!`);
      navigate('/');
    } catch (error) {
      console.error("Login Failed:", error);
      toast.error("Gagal login dengan Google.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F0] dark:bg-black flex flex-col items-center justify-center p-4 transition-colors duration-300">
      
      <div className="absolute top-6 left-6">
        <Button onClick={() => navigate('/landing')} variant="ghost" className="font-bold font-mono text-black dark:text-white hover:bg-transparent hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" /> KEMBALI
        </Button>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-8 text-center transition-all">
        
        {/* LOGO FIX: TEXT BLACK (LIGHT) & WHITE (DARK) */}
        <h1 className="text-5xl font-black mb-2 text-black dark:text-white tracking-tighter">
          <TypewriterText text="OCR.WTF" />
        </h1>
        <p className="font-mono text-sm text-gray-500 dark:text-gray-400 mb-8 font-bold">
          LOGIN AREA
        </p>

        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => toast.error("Login Failed")}
            theme="filled_black"
            shape="rectangular"
            size="large"
            width="300"
          />
        </div>

        <p className="mt-6 text-[10px] font-mono text-gray-400 uppercase">
          Secure access by Google OAuth 2.0
        </p>
      </div>
    </div>
  );
}
