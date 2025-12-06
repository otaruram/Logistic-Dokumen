import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  const documentTransform = {
    hidden: { scale: 0.8, opacity: 0, rotate: -10 },
    visible: {
      scale: 1,
      opacity: 1,
      rotate: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut"
      }
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

      {/* SYSTEM ONLINE Indicator */}
      <motion.div 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute top-8 left-1/2 -translate-x-1/2 z-10"
      >
        <div className="border-2 border-black bg-white px-6 py-2 font-mono text-sm tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          SYSTEM ONLINE
        </div>
      </motion.div>

      {/* Main Container - Split Screen */}
      <div className="min-h-screen flex flex-col lg:flex-row items-center justify-center p-8 gap-12 lg:gap-24">
        
        {/* LEFT SECTION - The Story */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex-1 max-w-xl"
        >
          {/* Logo & Animated Document */}
          <motion.div 
            variants={documentTransform}
            className="relative mb-12"
          >
            <div className="border-4 border-black bg-[#FF4500] p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
              <img 
                src="/1.png" 
                alt="OCR.AI Logo"
                className="w-48 h-48 mx-auto object-contain"
              />
            </div>
          </motion.div>

          {/* Hero Title */}
          <motion.div variants={itemVariants}>
            <h1 className="text-6xl lg:text-7xl font-serif font-bold mb-6 leading-none">
              OCR.AI: Dokumen Pintar dalam Sekejap.
            </h1>
          </motion.div>

          <motion.p 
            variants={itemVariants}
            className="text-lg font-mono text-black/70 mb-8 leading-relaxed"
          >
            Ubah tumpukan dokumen fisik menjadi data digital yang siap diolah.
            <br />
            Cepat, akurat, dan otomatis dengan kecerdasan buatan.
          </motion.p>

          {/* Feature Pills */}
          <motion.div 
            variants={itemVariants}
            className="flex flex-wrap gap-3"
          >
            {[
              { icon: FileText, text: 'UPLOAD' },
              { icon: Zap, text: 'SCAN' },
              { icon: CheckCircle2, text: 'DIGITIZE' },
              { icon: ArrowRight, text: 'AUTOMATE' }
            ].map((item, i) => (
              <div 
                key={i}
                className="border-2 border-black bg-white px-4 py-2 font-mono text-xs font-bold flex items-center gap-2 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200"
              >
                <item.icon className="w-4 h-4" />
                {item.text}
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* RIGHT SECTION - The Action (Login Card) */}
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex-1 max-w-md w-full"
        >
          <div className="border-4 border-black bg-white p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
            
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
              <p className="font-mono text-sm text-black/60">
                Sign in as Oki
              </p>
            </div>

            {/* Divider */}
            <div className="border-t-2 border-black my-6"></div>

            {/* Google Login Button - Custom Styled */}
            <motion.div
              onHoverStart={() => setIsHovered(true)}
              onHoverEnd={() => setIsHovered(false)}
              whileHover={{ 
                x: -4, 
                y: -4,
              }}
              className="relative mb-8"
            >
              <div 
                className={`absolute inset-0 bg-black transition-all duration-200 ${
                  isHovered ? 'translate-x-[6px] translate-y-[6px]' : 'translate-x-0 translate-y-0'
                }`}
              />
              <div className="relative border-2 border-black bg-white hover:bg-gray-50 transition-colors">
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
            </motion.div>

            {/* Demo Accounts (Reference from image) */}
            <div className="space-y-3 mb-6">
              <div className="border-2 border-black bg-gray-50 p-3 flex items-center gap-3 hover:bg-gray-100 transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-mono font-bold">
                  O
                </div>
                <div className="flex-1">
                  <p className="font-mono text-sm font-bold">Oki Taruna Ramadhan</p>
                  <p className="font-mono text-xs text-black/60">okitarunaramadhan@gmail.com</p>
                </div>
              </div>

              <div className="border-2 border-black bg-gray-50 p-3 flex items-center gap-3 hover:bg-gray-100 transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-gray-600 text-white flex items-center justify-center font-mono font-bold">
                  O
                </div>
                <div className="flex-1">
                  <p className="font-mono text-sm font-bold">Oki Taruna</p>
                  <p className="font-mono text-xs text-black/60">otaruna61@gmail.com</p>
                </div>
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
        </motion.div>
      </div>
    </div>
  );
}
