import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Privacy() {
  const navigate = useNavigate();
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
        onClick={() => navigate(-1)}
        className={`absolute top-8 left-8 border-2 px-4 py-2 font-mono text-xs font-bold flex items-center gap-2 hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200 ${
          isDarkMode
            ? 'border-white bg-[#0a0a0a] text-white hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]'
            : 'border-black bg-white text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        <ArrowLeft className="w-4 h-4" />
        KEMBALI
      </button>

      {/* Main Content */}
      <div className="min-h-screen flex items-center justify-center p-8 pt-24">
        <div className={`w-full max-w-4xl border-4 p-8 md:p-12 ${
          isDarkMode
            ? 'border-white bg-[#0a0a0a] shadow-[12px_12px_0px_0px_rgba(255,255,255,1)]'
            : 'border-black bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]'
        }`}>
          
          {/* Header */}
          <div className="text-center mb-8">
            <img 
              src="/1.png" 
              alt="OCR.WTF"
              className="w-16 h-16 mx-auto mb-4 object-contain"
            />
            <h1 className="text-3xl md:text-4xl font-serif font-bold mb-2">
              Kebijakan Privasi
            </h1>
            <p className={`text-sm font-mono ${
              isDarkMode ? 'text-white/60' : 'text-black/60'
            }`}>
              Terakhir diperbarui: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* Divider */}
          <div className={`border-t-2 my-6 ${
            isDarkMode ? 'border-white' : 'border-black'
          }`}></div>

          {/* Content */}
          <div className="space-y-6 font-mono text-sm leading-relaxed">
            
            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">1. Informasi yang Kami Kumpulkan</h2>
              <div className={`space-y-3 ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
                <p className="font-bold">Informasi Akun:</p>
                <p>• Nama lengkap dan email dari akun Google Anda</p>
                <p>• Foto profil dari akun Google Anda</p>
                <p>• Token autentikasi untuk akses Google Drive</p>
                
                <p className="font-bold mt-4">Informasi Penggunaan:</p>
                <p>• Dokumen yang Anda upload untuk diproses OCR</p>
                <p>• Log aktivitas scan dan manifest</p>
                <p>• Statistik penggunaan layanan</p>
                
                <p className="font-bold mt-4">Data Teknis:</p>
                <p>• Alamat IP dan informasi browser</p>
                <p>• Preferensi tema (light/dark mode)</p>
                <p>• API Key pribadi (disimpan lokal di browser)</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">2. Bagaimana Kami Menggunakan Informasi</h2>
              <div className={`space-y-2 ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
                <p>• Untuk menyediakan dan memelihara layanan OCR</p>
                <p>• Untuk memproses dokumen yang Anda upload</p>
                <p>• Untuk menyimpan hasil scan ke Google Drive Anda</p>
                <p>• Untuk meningkatkan dan mengoptimalkan layanan kami</p>
                <p>• Untuk berkomunikasi dengan Anda tentang layanan</p>
                <p>• Untuk mendeteksi dan mencegah penyalahgunaan</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">3. Penyimpanan & Keamanan Data</h2>
              <div className={`space-y-3 ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
                <p className="font-bold">Keamanan:</p>
                <p>• Kami menggunakan enkripsi SSL/TLS untuk semua komunikasi</p>
                <p>• Dokumen diproses secara sementara dan tidak disimpan permanen di server kami</p>
                <p>• API Key BYOK disimpan hanya di localStorage browser Anda</p>
                <p>• Kami tidak pernah menyimpan password Anda (menggunakan Google OAuth)</p>
                
                <p className="font-bold mt-4">Penyimpanan:</p>
                <p>• Hasil scan disimpan di Google Drive Anda (bukan server kami)</p>
                <p>• Log aktivitas disimpan di database terenkripsi</p>
                <p>• Data statistik disimpan untuk keperluan analitik</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">4. Berbagi Informasi</h2>
              <div className={`space-y-2 ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
                <p className="font-bold">Kami TIDAK PERNAH menjual data Anda kepada pihak ketiga.</p>
                <p className="mt-3">Kami hanya berbagi informasi dalam kondisi berikut:</p>
                <p>• Dengan Google Drive (untuk menyimpan hasil scan Anda)</p>
                <p>• Dengan penyedia layanan OCR (untuk memproses dokumen)</p>
                <p>• Jika diwajibkan oleh hukum atau proses hukum yang sah</p>
                <p>• Untuk melindungi hak, properti, atau keamanan kami dan pengguna lain</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">5. Integrasi Pihak Ketiga</h2>
              <div className={`space-y-3 ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
                <p className="font-bold">Google OAuth & Drive:</p>
                <p>• Kami menggunakan Google OAuth untuk autentikasi yang aman</p>
                <p>• Kami meminta akses ke Google Drive hanya untuk menyimpan hasil scan Anda</p>
                <p>• Anda dapat mencabut akses kapan saja melalui Google Account Settings</p>
                
                <p className="font-bold mt-4">OpenAI API (BYOK):</p>
                <p>• Jika Anda menggunakan API Key pribadi, data dikirim langsung ke OpenAI</p>
                <p>• Kebijakan privasi OpenAI berlaku untuk data yang diproses melalui API mereka</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">6. Hak Anda</h2>
              <div className={`space-y-2 ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
                <p className="font-bold">Anda memiliki hak untuk:</p>
                <p>• Mengakses data pribadi yang kami simpan tentang Anda</p>
                <p>• Meminta koreksi data yang tidak akurat</p>
                <p>• Meminta penghapusan akun dan data Anda</p>
                <p>• Mencabut persetujuan untuk pemrosesan data</p>
                <p>• Mengekspor data Anda dalam format yang dapat dibaca mesin</p>
                <p>• Mengajukan keluhan ke otoritas perlindungan data</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">7. Cookies & Tracking</h2>
              <p className={isDarkMode ? 'text-white/80' : 'text-black/80'}>
                Kami menggunakan localStorage browser untuk menyimpan preferensi Anda (tema, API key pribadi, token autentikasi). 
                Kami tidak menggunakan cookies pihak ketiga untuk tracking atau iklan. Anda dapat menghapus data lokal 
                kapan saja melalui pengaturan browser Anda.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">8. Pengguna Anak-anak</h2>
              <p className={isDarkMode ? 'text-white/80' : 'text-black/80'}>
                Layanan kami tidak ditujukan untuk pengguna di bawah usia 18 tahun. Kami tidak dengan sengaja 
                mengumpulkan informasi pribadi dari anak-anak. Jika Anda adalah orang tua atau wali dan mengetahui 
                bahwa anak Anda telah memberikan informasi pribadi kepada kami, silakan hubungi kami.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">9. Perubahan Kebijakan</h2>
              <p className={isDarkMode ? 'text-white/80' : 'text-black/80'}>
                Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Kami akan memberi tahu Anda tentang 
                perubahan dengan memposting kebijakan baru di halaman ini dan memperbarui tanggal "Terakhir diperbarui". 
                Anda disarankan untuk meninjau Kebijakan Privasi ini secara berkala untuk setiap perubahan.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">10. Hubungi Kami</h2>
              <p className={isDarkMode ? 'text-white/80' : 'text-black/80'}>
                Jika Anda memiliki pertanyaan tentang Kebijakan Privasi ini atau ingin menggunakan hak Anda, 
                silakan hubungi kami:
              </p>
              <div className={`mt-3 space-y-1 ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
                <p>• Email: privacy@ocr.wtf</p>
                <p>• GitHub: github.com/otaruram</p>
                <p>• LinkedIn: linkedin.com/in/otaruram</p>
              </div>
            </section>

          </div>

          {/* Footer */}
          <div className={`text-center border-t-2 pt-6 mt-8 ${
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
