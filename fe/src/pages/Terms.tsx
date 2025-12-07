import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Terms() {
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
              Syarat & Ketentuan
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
              <h2 className="text-xl font-bold mb-3 uppercase">1. Penerimaan Syarat</h2>
              <p className={isDarkMode ? 'text-white/80' : 'text-black/80'}>
                Dengan mengakses dan menggunakan OCR.WTF ("Layanan"), Anda menyetujui untuk terikat oleh Syarat dan Ketentuan ini. 
                Jika Anda tidak setuju dengan syarat-syarat ini, mohon jangan menggunakan layanan kami.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">2. Deskripsi Layanan</h2>
              <p className={isDarkMode ? 'text-white/80' : 'text-black/80'}>
                OCR.WTF adalah platform digitalisasi dokumen yang menyediakan layanan Optical Character Recognition (OCR), 
                pengelolaan manifest, dan integrasi Google Drive. Layanan ini dirancang untuk membantu pengguna dalam 
                mengelola dokumen logistik dan bisnis secara efisien.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">3. Akun Pengguna</h2>
              <div className={`space-y-2 ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
                <p>• Anda bertanggung jawab untuk menjaga kerahasiaan akun Google Anda</p>
                <p>• Anda bertanggung jawab atas semua aktivitas yang terjadi di bawah akun Anda</p>
                <p>• Anda setuju untuk memberikan informasi yang akurat dan terkini</p>
                <p>• Anda harus segera memberi tahu kami tentang penggunaan akun yang tidak sah</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">4. Privasi & Data</h2>
              <div className={`space-y-2 ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
                <p>• Kami menggunakan Google OAuth untuk autentikasi yang aman</p>
                <p>• Dokumen yang Anda upload akan diproses menggunakan teknologi OCR</p>
                <p>• Data yang tersimpan di Google Drive Anda tetap milik Anda sepenuhnya</p>
                <p>• Kami tidak menyimpan atau membagikan dokumen Anda kepada pihak ketiga</p>
                <p>• API Key pribadi (BYOK) disimpan secara lokal di browser Anda</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">5. Penggunaan yang Diizinkan</h2>
              <div className={`space-y-2 ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
                <p className="font-bold">Anda BOLEH menggunakan layanan untuk:</p>
                <p>• Memproses dokumen bisnis dan logistik yang sah</p>
                <p>• Mengekstrak teks dari dokumen untuk keperluan bisnis</p>
                <p>• Menyimpan hasil scan ke Google Drive Anda</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">6. Penggunaan yang Dilarang</h2>
              <div className={`space-y-2 ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
                <p className="font-bold">Anda TIDAK BOLEH menggunakan layanan untuk:</p>
                <p>• Memproses dokumen ilegal atau yang melanggar hak cipta</p>
                <p>• Melakukan aktivitas yang melanggar hukum</p>
                <p>• Mengganggu atau merusak sistem atau server kami</p>
                <p>• Menggunakan layanan untuk tujuan yang merugikan pihak lain</p>
                <p>• Melakukan reverse engineering atau mencoba mengakses source code</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">7. Batasan Tanggung Jawab</h2>
              <div className={`space-y-2 ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
                <p>• Layanan disediakan "sebagaimana adanya" tanpa jaminan apapun</p>
                <p>• Kami tidak bertanggung jawab atas kesalahan OCR atau kehilangan data</p>
                <p>• Anda bertanggung jawab untuk memverifikasi akurasi hasil OCR</p>
                <p>• Kami tidak bertanggung jawab atas kerusakan yang timbul dari penggunaan layanan</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">8. Kekayaan Intelektual</h2>
              <p className={isDarkMode ? 'text-white/80' : 'text-black/80'}>
                Semua konten, fitur, dan fungsi layanan (termasuk tetapi tidak terbatas pada informasi, perangkat lunak, 
                teks, tampilan, gambar, video, dan audio) adalah milik eksklusif OCR.WTF dan dilindungi oleh hukum 
                hak cipta internasional.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">9. Perubahan Layanan</h2>
              <p className={isDarkMode ? 'text-white/80' : 'text-black/80'}>
                Kami berhak untuk memodifikasi atau menghentikan layanan (atau bagian darinya) sewaktu-waktu dengan 
                atau tanpa pemberitahuan. Kami tidak akan bertanggung jawab kepada Anda atau pihak ketiga atas 
                modifikasi, penangguhan, atau penghentian layanan.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">10. Hukum yang Berlaku</h2>
              <p className={isDarkMode ? 'text-white/80' : 'text-black/80'}>
                Syarat dan Ketentuan ini diatur oleh dan ditafsirkan sesuai dengan hukum Republik Indonesia. 
                Setiap perselisihan yang timbul sehubungan dengan Syarat ini akan diselesaikan di pengadilan 
                yang berlokasi di Indonesia.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 uppercase">11. Hubungi Kami</h2>
              <p className={isDarkMode ? 'text-white/80' : 'text-black/80'}>
                Jika Anda memiliki pertanyaan tentang Syarat dan Ketentuan ini, silakan hubungi kami melalui:
              </p>
              <div className={`mt-3 space-y-1 ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
                <p>• Email: support@ocr.wtf</p>
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
