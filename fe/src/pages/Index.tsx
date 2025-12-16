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
import { apiFetch } from "@/lib/api-config";

// Komponen teks animasi
const TypewriterText = ({ text, delay = 0 }: { text: string; delay?: number }) => {
  const [displayText, setDisplayText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isStarted, setIsStarted] = useState(false)
  useEffect(() => {
    if (delay > 0) {
      const startTimer = setTimeout(() => setIsStarted(true), delay)
      return () => clearTimeout(startTimer)
    } else setIsStarted(true)
  }, [delay])
  useEffect(() => {
    if (isStarted && currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, 50)
      return () => clearTimeout(timeout)
    }
  }, [currentIndex, text, isStarted])
  return <span>{displayText}</span>
}

const Index = () => {
  // State User
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('user');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [receiver, setReceiver] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  // 🔥 STATE BARU UNTUK KUNCI TANDA TANGAN
  const [isSignatureLocked, setIsSignatureLocked] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load Data & Sync Credit
  const loadData = useCallback(async () => {
    try {
      const token = user?.credential || "";
      if (!token) return;

      // 1. Get History
      const response = await apiFetch('/history', { headers: { "Authorization": `Bearer ${token}` } });
      const data = await response.json();
      if (Array.isArray(data)) {
        const formatted = data.map((log: any) => ({
          id: log.id,
          time: new Date(log.timestamp).toLocaleTimeString("id-ID"),
          date: new Date(log.timestamp).toISOString().split('T')[0],
          docType: log.kategori,
          docNumber: log.nomorDokumen,
          receiver: log.receiver,
          imageUrl: log.imagePath,
          summary: log.summary,
          status: "SUCCESS"
        }));
        setLogs(formatted as any);
      }

      // 2. Sync Credits (Biar gak 0)
      const creditRes = await apiFetch('/api/pricing/user/credits', { headers: { "Authorization": `Bearer ${token}` } });
      const creditData = await creditRes.json();
      if (creditData.status === 'success' && creditData.data.remainingCredits !== undefined) {
         if (creditData.data.remainingCredits !== user.creditBalance) {
            const updated = { ...user, creditBalance: creditData.data.remainingCredits };
            setUser(updated);
            sessionStorage.setItem('user', JSON.stringify(updated));
         }
      }

    } catch (e) { console.error(e); }
  }, [user?.credential]);

  useEffect(() => { loadData(); }, [loadData]);

  // Handle Input File
  const handleFileSelect = useCallback(async (file: File) => {
    setImagePreview(URL.createObjectURL(file));
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1500, useWebWorker: true });
      setSelectedFile(compressed);
    } catch { setSelectedFile(file); }
  }, []);

  const handleClearImage = useCallback(() => {
    setSelectedFile(null);
    setImagePreview(null);
  }, []);

  // Handle Tanda Tangan
  const handleSignatureChange = useCallback((signatureData: string | null) => {
    setSignature(signatureData);
    if (signatureData) {
       setIsSignatureLocked(true); // Kunci setelah ttd
       toast({ title: "Tanda tangan tersimpan", description: "Tanda tangan dikunci." });
    } else {
       setIsSignatureLocked(false);
    }
  }, [toast]);

  // Reset Signature Manual
  const resetSignature = () => {
    setSignature(null);
    setIsSignatureLocked(false);
  }

  // Handle Scan Process
  const handleProcess = useCallback(async () => {
    if (!selectedFile) return toast({ title: "Upload foto dulu", variant: "destructive" });
    if (!receiver) return toast({ title: "Isi nama penerima", variant: "destructive" });

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
        await loadData();
        toast({ title: "SCAN BERHASIL", description: `Sisa Kredit: ${result.remaining_credits}` });

        // Update Kredit UI
        if (result.remaining_credits !== undefined) {
          const updatedUser = { ...user, creditBalance: result.remaining_credits };
          setUser(updatedUser);
          sessionStorage.setItem('user', JSON.stringify(updatedUser));
        }
        
        // Reset form input (tapi gambar preview biarkan user lihat dulu)
        setReceiver("");
        resetSignature();

      } else {
        throw new Error(result.message);
      }
    } catch (e: any) {
      toast({ title: "ERROR", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, receiver, user, loadData]);

  // Handle Update Log (Edit Keterangan)
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
        setLogs(prev => prev.map((log: any) => 
          log.id === logId ? { ...log, summary: newSummary } : log
        ));
        toast({ title: "Berhasil Disimpan", description: "Keterangan log diperbarui." });
      }
    } catch {
      toast({ title: "Gagal Update", variant: "destructive" });
    }
  };

  // Handle Delete
  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm("Hapus log ini?")) return;
    try {
      const token = user?.credential || "";
      await apiFetch(`/logs/${logId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      setLogs(prev => prev.filter((log: any) => log.id !== logId));
      toast({ title: "Log Dihapus" });
    } catch {
      toast({ title: "Gagal Hapus", variant: "destructive" });
    }
  };

  const handleLogout = () => { sessionStorage.clear(); navigate('/landing'); };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={handleLogout} onProfile={() => navigate('/profile')} onSettings={() => navigate('/settings')} />

      <main className="container mx-auto px-4 py-6 flex-1">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center mb-6">
          <h2 className="text-xl font-bold mb-1"><TypewriterText text="Welcome to OCR.WTF! 🚀" /></h2>
          <p className="text-gray-600"><TypewriterText text="Scanner Dokumen Cerdas" delay={1500} /></p>
        </div>

        <div className="space-y-6 mb-6">
          {/* ZONA INPUT */}
          <div className="brutal-card">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5" />
              <h2 className="text-sm font-bold uppercase">ZONA INPUT</h2>
            </div>
            {!imagePreview ? (
              <FileUploadZone onFileSelect={handleFileSelect} />
            ) : (
              <ImagePreview imageUrl={imagePreview} onClear={handleClearImage} />
            )}
          </div>

          {/* ZONA VALIDASI */}
          {imagePreview && (
            <div className="brutal-card animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardCheck className="w-5 h-5" />
                <h2 className="text-sm font-bold uppercase">VALIDASI</h2>
              </div>
              <div className="space-y-3 mb-6">
                <label className="block text-xs font-bold uppercase">PENERIMA</label>
                <input
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder="Nama Penerima..."
                  className="brutal-input w-full"
                />
              </div>

              {/* Signature Pad dengan Logic Lock */}
              <div className={isSignatureLocked ? "pointer-events-none opacity-80 relative" : ""}>
                 <SignaturePad onSignatureChange={handleSignatureChange} />
                 {isSignatureLocked && (
                    <div className="absolute top-2 right-2 z-10 pointer-events-auto">
                        <Button size="sm" variant="destructive" onClick={resetSignature} className="h-6 text-[10px]">
                           UBAH TTD
                        </Button>
                    </div>
                 )}
              </div>
              
              <Button onClick={handleProcess} disabled={isProcessing} className="brutal-button w-full h-14 mt-4">
                {isProcessing ? "MEMPROSES..." : "SCAN & SIMPAN"}
              </Button>
            </div>
          )}
        </div>

        <DataTable logs={logs} onDeleteLog={handleDeleteLog} onUpdateLog={handleUpdateLog} />
      </main>
    </div>
  );
};

// 🔥 PENTING: EXPORT DEFAULT AGAR VERCEL TIDAK ERROR
export default Index;
