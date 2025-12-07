import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Login() {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    setIsDarkMode(savedTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  // Google Login dengan Drive scope
  const loginWithDrive = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Get user info dari Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await userInfoResponse.json();
        
        const user = {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          credential: tokenResponse.access_token, // Save access token
          driveToken: tokenResponse.access_token, // Explicitly save for Drive
        };

        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('isAuthenticated', 'true');
        navigate('/');
      } catch (error) {
        console.error('Login failed:', error);
        alert('Login gagal. Coba lagi.');
      }
    },
    onError: () => {
      alert('Login gagal. Coba lagi.');
    },
    scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
    flow: 'implicit',
  });

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-300 ${
      isDarkMode ? 'bg-[#0a0a0a] text-white' : 'bg-[#FDFDFD] text-black'
    }`}>
      {/* Subtle Grid Background Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]" 
        style={{
          backgroundImage: isDarkMode ? `
            linear-gradient(#fff 1px, transparent 1px),
            linear-gradient(90deg, #fff 1px, transparent 1px)
          ` : `
            linear-gradient(#000 1px, transparent 1px),
            linear-gradient(90deg, #000 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className={`absolute top-8 right-8 z-50 border-2 px-4 py-2 font-bold transition-all duration-200 hover:translate-x-[-2px] hover:translate-y-[-2px] ${
          isDarkMode 
            ? 'border-white bg-[#0a0a0a] text-white hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]'
            : 'border-black bg-white text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Back Button */}
      <button
        onClick={() => navigate('/landing')}
        className={`absolute top-8 left-8 border-2 px-4 py-2 font-mono text-xs font-bold flex items-center gap-2 hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200 ${
          isDarkMode
            ? 'border-white bg-[#0a0a0a] text-white hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]'
            : 'border-black bg-white text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        <ArrowLeft className="w-4 h-4" />
        KEMBALI
      </button>

      {/* Main Container */}
      <div className="min-h-screen flex items-center justify-center p-8">
        
        {/* Login Card */}
        <div className="w-full max-w-md animate-scale-in">
          <div className={`border-4 p-10 ${
            isDarkMode
              ? 'border-white bg-[#0a0a0a] shadow-[12px_12px_0px_0px_rgba(255,255,255,1)]'
              : 'border-black bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            
            {/* Card Header */}
            <div className="text-center mb-8">
              <img 
                src="/1.png" 
                alt="OCR.AI"
                className="w-24 h-24 mx-auto mb-6 object-contain"
              />
              
              <h2 className="text-3xl font-serif font-bold mb-2">
                Masuk ke Akun Anda
              </h2>
              <p className={`text-sm font-mono ${
                isDarkMode ? 'text-white/60' : 'text-black/60'
              }`}>
                Login untuk mulai digitalisasi dokumen
              </p>
            </div>

            {/* Divider */}
            <div className={`border-t-2 my-6 ${
              isDarkMode ? 'border-white' : 'border-black'
            }`}></div>

            {/* Google Login Button - Custom Styled */}
            <div
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="relative mb-4"
            >
              <div 
                className={`absolute inset-0 transition-all duration-200 ${
                  isDarkMode ? 'bg-white' : 'bg-black'
                } ${
                  isHovered ? 'translate-x-[6px] translate-y-[6px]' : 'translate-x-0 translate-y-0'
                }`}
              />
              <button
                onClick={() => loginWithDrive()}
                className={`relative w-full border-2 transition-all duration-200 p-4 flex items-center justify-center gap-3 ${
                  isDarkMode
                    ? 'border-white bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]'
                    : 'border-black bg-white text-black hover:bg-gray-50'
                } ${
                  isHovered ? '-translate-x-[2px] -translate-y-[2px]' : ''
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="font-bold text-sm">MASUK DENGAN GOOGLE</span>
              </button>
            </div>

            <p className={`text-xs text-center mb-4 ${
              isDarkMode ? 'text-white/60' : 'text-muted-foreground'
            }`}>
              Akses penuh ke semua fitur termasuk Google Drive backup
            </p>

            {/* Terms & Privacy Links */}
            <div className="text-center mb-4">
              <p className={`text-xs ${
                isDarkMode ? 'text-white/60' : 'text-black/60'
              }`}>
                Dengan masuk, Anda menyetujui{' '}
                <button
                  onClick={() => navigate('/terms')}
                  className={`underline hover:no-underline ${
                    isDarkMode ? 'text-white' : 'text-black'
                  }`}
                >
                  Syarat & Ketentuan
                </button>
                {' '}dan{' '}
                <button
                  onClick={() => navigate('/privacy')}
                  className={`underline hover:no-underline ${
                    isDarkMode ? 'text-white' : 'text-black'
                  }`}
                >
                  Kebijakan Privasi
                </button>
                {' '}kami
              </p>
            </div>

            {/* Footer */}
            <div className={`text-center border-t-2 pt-6 mt-6 ${
              isDarkMode ? 'border-white' : 'border-black'
            }`}>
              <p className={`font-mono text-xs ${
                isDarkMode ? 'text-white/60' : 'text-black/60'
              }`}>
                © {new Date().getFullYear()} OCR.WTF - Scan Dokumen Tanpa Ribet
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-scale-in {
          animation: scale-in 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
