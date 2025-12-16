import { useState, useCallback, useEffect } from "react";
import { Send, Package, ClipboardCheck } from "lucide-react";
import imageCompression from 'browser-image-compression';
import { useNavigate } from "react-router-dom";
import Header from "@/components/dashboard/Header";
import FileUploadZone from "@/components/dashboard/FileUploadZone";
import ImagePreview from "@/components/dashboard/ImagePreview";
import SignaturePad from "@/components/dashboard/SignaturePad";
import DataTable from "@/components/dashboard/DataTable";
import BrutalSpinner from "@/components/dashboard/BrutalSpinner";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-config";

// --- Typewriter Animation Component ---
const TypewriterText = ({ text, delay = 0 }: { text: string; delay?: number }) => {
  const [displayText, setDisplayText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isStarted, setIsStarted] = useState(false)

  useEffect(() => {
    if (delay > 0) {
      const startTimer = setTimeout(() => setIsStarted(true), delay)
      return () => clearTimeout(startTimer)
    } else {
      setIsStarted(true)
    }
  }, [delay])

  useEffect(() => {
    if (isStarted && currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, 80)
      return () => clearTimeout(timeout)
    }
  }, [currentIndex, text, isStarted])

  return <span>{displayText}</span>
}

const Index = () => {
  // =========================================================================
  // [A] PERBAIKAN STATE USER
  // Menggunakan useState agar saat data kredit berubah, UI otomatis update
  // =========================================================================
  const [user, setUser] = useState(() => {
    try {
      const savedUser = sessionStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : {};
    } catch (e) {
      return {};
    }
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [receiver, setReceiver] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load Data History
  const loadData = useCallback(async () => {
    const isInitialMount = sessionStorage.getItem('hasLoaded') !== 'true';
    if (isInitialMount) {
      setIsLoading(true);
      sessionStorage.setItem('hasLoaded', 'true');
    }
    
    try {
      const token = user?.credential || "";
      const response = await apiFetch('/history', { 
        headers: { "Authorization": `Bearer ${token}` } 
      });
      const data = await response.json();
      
      if (Array.isArray(data)) {
        const formattedLogs = data.map((log: any) => {
          const logDate = new Date(log.timestamp);
          const pad = (num: number) => num.toString().padStart(2, '0');
          const isoDate = `${logDate.getFullYear()}-${pad(logDate.getMonth() + 1)}-${pad(logDate.getDate())}`;
          return {
            id: log.id,
            time: logDate.toLocaleTimeString("id-ID"),
            date: isoDate,
            docType: log.kategori || "DOKUMEN",
            docNumber: log.nomorDokumen || log.nomor_dokumen || "TIDAK TERDETEKSI",
            receiver: log.receiver || "TIDAK ADA",
            imageUrl: log.imagePath || log.image_url || "",
            summary: log.summary || "",
            status: "SUCCESS" as const,
          };
        });
        setLogs(formattedLogs);
      }
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      if (isInitialMount) setTimeout(() => setIsLoading(false), 800);
    }
  }, [user?.credential]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Perbaikan Preview Foto: Tampilkan dulu, baru kompres
  const handleFileSelect = useCallback(async (file: File) => {
    try {
      // 1. Tampilkan Preview LANGSUNG (Biar user gak nunggu)
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
      
      // 2. Kompres di Background
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1500, useWebWorker: true };
      toast({ description: 'Mengoptimalkan gambar...' });
      
      const compressedFile = await imageCompression(file, options);
      setSelectedFile(compressedFile);
      toast({ title: 'Ready', description: 'Gambar siap diproses!' });
      
    } catch (error) {
      console.error('Image compression error:', error);
      // Fallback ke file asli jika kompresi gagal
      setSelectedFile(file);
    }
  }, [toast]);

  const handleClearImage = useCallback(() => {
    setSelectedFile(null);
    setImagePreview(null);
  }, []);

  const handleSignatureChange = useCallback((signatureData: string | null) => {
    setSignature(signatureData);
    if (signatureData) toast({ title: "Tanda tangan tersimpan" });
  }, [toast]);

  // =========================================================================
  // [B] PERBAIKAN LOGIC PROSES & UPDATE KREDIT
  // Menangkap 'remaining_credits' dari backend dan update state User
  // =========================================================================
  const handleProcess = useCallback(async () => {
    if (!selectedFile) {
      return toast({ title: "ERROR", description: "Silakan upload file terlebih dahulu", variant: "destructive" });
    }
    if (!receiver.trim()) {
      return toast({ title: "ERROR", description: "Silakan isi nama penerima", variant: "destructive" });
    }

    setIsProcessing(true);
    try {
      const token = user?.credential || "";
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("receiver", receiver);

      const response = await apiFetch('/scan', {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });

      const result = await response.json();
      
      if (result.status === "success") {
        await loadData(); // Refresh tabel history
        toast({ title: "PROSES SELESAI", description: `Terdeteksi: ${result.data.kategori || "Dokumen"}` });

        // 🔥 UPDATE USER STATE (KREDIT) 🔥
        if (result.remaining_credits !== undefined) {
          const updatedUser = { 
            ...user, 
            creditBalance: result.remaining_credits, // Update field utama
            credits: result.remaining_credits        // Update fallback
          };
          
          setUser(updatedUser); // Update State React
          sessionStorage.setItem('user', JSON.stringify(updatedUser)); // Simpan ke Storage
          
          console.log("💳 Kredit updated:", result.remaining_credits);
        }

        // Reset form
        handleClearImage();
        setReceiver("");
        setSignature(null);

      } else {
        if (result.error_type === "insufficient_credits") {
          toast({ 
            title: "KREDIT HABIS", 
            description: "Silakan hubungi admin untuk topup.", 
            variant: "destructive" 
          });
          return;
        }
        throw new Error(result.message || "Gagal memproses dokumen");
      }
    } catch (error) {
      toast({ title: "ERROR", description: error instanceof Error ? error.message : "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, receiver, user, loadData, handleClearImage, toast]);

  // Handler Hapus Log
  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm("Hapus log ini permanen?")) return;
    try {
      const token = user?.credential || "";
      await apiFetch(`/logs/${logId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      setLogs((prev) => prev.filter((log: any) => log.id !== logId));
      toast({ title: "Log dihapus" });
    } catch (error) {
      toast({ title: "Gagal hapus", variant: "destructive" });
    }
  };

  // Handler Update Log
  const handleUpdateLog = async (logId: number, newSummary: string) => {
    try {
      const token = user?.credential || "";
      const response = await apiFetch(`/logs/${logId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ summary: newSummary }),
      });
      const result = await response.json();
      if (result.status === "success") {
        setLogs(currentLogs => currentLogs.map((log: any) => 
          log.id === logId ? { ...log, summary: newSummary } : log
        ));
        toast({ title: "Log diperbarui" });
      }
    } catch (error) {
      toast({ title: "Gagal update", variant: "destructive" });
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/landing');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {isLoading ? (
        <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
          <div className="text-center space-y-4">
            <BrutalSpinner size="lg" />
            <div className="terminal-text font-mono text-lg md:text-xl font-bold uppercase">
              LOADING SYSTEM<span className="terminal-cursor">_</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* =========================================================================
            [C] RENDER HEADER DENGAN STATE USER
            Memastikan Header menerima data user terbaru yang ada kreditnya
            =========================================================================
          */}
          <Header 
            user={user} 
            onLogout={handleLogout} 
            onProfile={() => navigate('/profile')} 
            onSettings={() => navigate('/settings')}
          />

          <main className="container mx-auto px-3 md:px-4 py-4 md:py-6 flex-1">
            {/* Welcome Message */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 text-center mb-6">
              <h2 className="text-xl font-bold mb-2 text-black">
                <TypewriterText text="Welcome to OCR.WTF! 🚀" />
              </h2>
              <p className="text-gray-600">
                <TypewriterText text="Upload dokumen untuk memulai OCR scanning" delay={2500} />
              </p>
            </div>

            {/* ZONA INPUT */}
            <div className="space-y-4 md:space-y-6 mb-4 md:mb-6">
              <div className="brutal-card">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-4 h-4 md:w-5 md:h-5" />
                  <h2 className="text-xs md:text-sm font-bold uppercase">ZONA INPUT</h2>
                </div>

                {!imagePreview ? (
                  <FileUploadZone onFileSelect={handleFileSelect} />
                ) : (
                  <ImagePreview imageUrl={imagePreview} onClear={handleClearImage} />
                )}
              </div>

              {/* ZONA VALIDASI (Muncul jika ada gambar) */}
              {imagePreview && (
                <div className="brutal-card animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-2 mb-4">
                    <ClipboardCheck className="w-4 h-4 md:w-5 md:h-5" />
                    <h2 className="text-xs md:text-sm font-bold uppercase">ZONA VALIDASI</h2>
                  </div>

                  <div className="space-y-3 mb-6">
                    <label className="block text-xs md:text-sm font-bold uppercase tracking-wide">
                      NAMA PENERIMA
                    </label>
                    <input
                      type="text"
                      value={receiver}
                      onChange={(e) => setReceiver(e.target.value)}
                      placeholder="MASUKKAN NAMA PENERIMA..."
                      className="brutal-input w-full"
                    />
                  </div>

                  <SignaturePad onSignatureChange={handleSignatureChange} />

                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleProcess}
                    disabled={isProcessing}
                    className="brutal-button w-full h-14 md:h-16 mt-4 text-sm md:text-base relative overflow-hidden"
                  >
                    {isProcessing ? (
                      <>
                        <span className="scanner-bar"></span>
                        <span className="relative z-20">[ MEMPROSES DATA... ]</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 md:w-5 md:h-5" />
                        <span className="ml-2">PROSES DOKUMEN</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* TABEL DATA */}
            <DataTable 
              logs={logs} 
              onDeleteLog={handleDeleteLog} 
              onUpdateLog={handleUpdateLog} 
            />
          </main>

          <footer className="brutal-border-thin border-b-0 border-l-0 border-r-0 mt-auto">
            <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-center gap-2">
              <img src="/1.png" alt="Logo" className="w-4 h-4 md:w-5 md:h-5 object-contain" />
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase">
                POWERED BY OCR.WTF
              </p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
};

export default Index;
