import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';

interface GoogleUser {
  email: string;
  name: string;
  picture: string;
}

export default function Login() {
  const navigate = useNavigate();

  const handleSuccess = (credentialResponse: any) => {
    try {
      const decoded: any = jwtDecode(credentialResponse.credential);
      const user = {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        credential: credentialResponse.credential, // Simpan JWT token untuk backend
      };

      // Simpan user info + credential ke localStorage
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('isAuthenticated', 'true');

      // Redirect ke dashboard
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login gagal. Coba lagi.');
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="border-4 border-black p-12 bg-white max-w-md w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img 
              src="/1.png" 
              alt="OCR.AI Logo"
              className="h-32 w-32 object-contain"
            />
          </div>
          <h1 className="text-5xl font-black text-black mb-4 tracking-tight">
            OCR.AI
          </h1>
          <p className="text-black font-mono text-sm leading-relaxed">
            Aplikasi scan dokumen otomatis pakai AI.<br/>
            Upload foto dokumen, langsung jadi text digital.<br/>
            Simpel, cepat, dan praktis!
          </p>
        </div>

        {/* Divider */}
        <div className="border-2 border-black my-8"></div>

        {/* Google Login Button */}
        <div className="flex justify-center mb-8">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => {
              console.log('Login Failed');
              alert('Login gagal. Periksa koneksi internet.');
            }}
            useOneTap
            theme="outline"
            size="large"
            text="signin_with"
            shape="rectangular"
          />
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-black font-mono text-xs">
            © {new Date().getFullYear()} OCR.AI
          </p>
          <p className="text-gray-600 font-mono text-xs mt-2">
            Powered by Google OAuth & OCR.space
          </p>
        </div>
      </div>
    </div>
  );
}
