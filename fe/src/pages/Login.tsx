import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export default function Login() {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  const handleSuccess = (credentialResponse: any) => {
    try {
      const decoded: any = jwtDecode(credentialResponse.credential);
      const user = {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        credential: credentialResponse.credential,
      };

      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('isAuthenticated', 'true');
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login gagal. Coba lagi.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] relative overflow-hidden">
      {/* Subtle Grid Background Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]" 
        style={{
          backgroundImage: `
            linear-gradient(#000 1px, transparent 1px),
            linear-gradient(90deg, #000 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Main Container */}
      <div className="min-h-screen flex flex-col lg:flex-row items-center justify-center p-8 gap-12 lg:gap-24">
        
        {/* LEFT SECTION - Hero Text */}
        <div className="flex-1 max-w-xl">
          <div className="typing-title">
            <h1 className="text-6xl lg:text-7xl font-serif font-bold mb-6 leading-tight">
              OCR.AI: DOKUMEN PINTAR DALAM SEKEJAP.
            </h1>
          </div>

          <div className="typing-description">
            <p className="text-lg font-mono text-black/70 mb-8 leading-relaxed">
              Ubah tumpukan dokumen fisik menjadi data digital yang siap diolah. Cepat, akurat, dan otomatis dengan kecerdasan buatan.
            </p>
          </div>

          {/* Feature Buttons */}
          <div className="flex flex-wrap gap-3">
            {[
              { icon: FileText, text: 'UPLOAD', className: 'pill-1' },
              { icon: Zap, text: 'SCAN', className: 'pill-2' },
              { icon: CheckCircle2, text: 'DIGITIZE', className: 'pill-3' },
              { icon: ArrowRight, text: 'AUTOMATE', className: 'pill-4' }
            ].map((item, i) => (
              <div 
                key={i}
                className={`border-2 border-black bg-white px-4 py-2 font-mono text-xs font-bold flex items-center gap-2 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 ${item.className}`}
              >
                <item.icon className="w-4 h-4" />
                {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SECTION - Login Card */}
        <div className="w-full max-w-md animate-scale-in">
          <div className="border-4 border-black bg-white p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
            
            {/* Card Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="relative">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                </div>
                <img 
                  src="/1.png" 
                  alt="OCR.AI"
                  className="w-24 h-24 object-contain"
                />
              </div>
              
              <h2 className="text-3xl font-serif font-bold mb-2">
                Masuk ke Akun Anda
              </h2>
            </div>

            {/* Divider */}
            <div className="border-t-2 border-black my-6"></div>

            {/* Google Login Button - Custom Styled */}
            <div
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="relative mb-8"
            >
              <div 
                className={`absolute inset-0 bg-black transition-all duration-200 ${
                  isHovered ? 'translate-x-[6px] translate-y-[6px]' : 'translate-x-0 translate-y-0'
                }`}
              />
              <div 
                className={`relative border-2 border-black bg-white hover:bg-gray-50 transition-all duration-200 ${
                  isHovered ? '-translate-x-[2px] -translate-y-[2px]' : ''
                }`}
              >
                <GoogleLogin
                  onSuccess={handleSuccess}
                  onError={() => {
                    console.log('Login Failed');
                    alert('Login gagal. Periksa koneksi internet.');
                  }}
                  useOneTap={false}
                  theme="outline"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                  width="100%"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="text-center border-t-2 border-black pt-6">
              <p className="font-mono text-xs text-black/60">
                © {new Date().getFullYear()} OCR.AI
              </p>
              <p className="font-mono text-xs text-black/40 mt-1">
                Powered by Google OAuth & OCR.space
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
