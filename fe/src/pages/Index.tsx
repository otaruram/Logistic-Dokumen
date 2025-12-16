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
  // 1. STATE USER (Untuk Kredit Live)
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // LOAD DATA HISTORY
  const loadData = useCallback(async () => {
    try {
      const token = user?.credential || "";
      const response = await apiFetch('/history', { headers: { "Authorization": `Bearer ${token}` } });
      const data = await response.json();
      
      if (Array.isArray(data)) {
        const formatted = data.map((log: any) => ({
          id: log.id,
          time: new Date(log.timestamp).toLocaleTimeString("id-ID"),
          date: new Date(log.timestamp).toISOString().split('T')[0],
          docType: log.kategori || "DOKUMEN",
          docNumber: log.nomorDokumen || "TIDAK TERDETEKSI",
          receiver: log.receiver || "-",
          imageUrl: log.imagePath || "",
          summary: log.summary || "",
          status: "SUCCESS"
        }));
        setLogs(formatted as any);
      }
    } catch (e) { console.error(e); }
  }, [user?.credential]);

  useEffect(() => { loadData(); }, [loadData]);

  // HANDLE FILE (Preview Dulu)
  const handleFileSelect = useCallback(async (file: File) => {
    // 1. Preview Instan
    setImagePreview(URL.createObjectURL(file));
    
    // 2. Kompres
    try {
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1500, useWebWorker: true };
      const compressed = await imageCompression(file, options);
      setSelectedFile(compressed);
    } catch {
      setSelectedFile(file);
    }
  }, []);

  const handleClearImage = useCallback(() => {
    setSelectedFile(null);
    setImagePreview(null);
  }, []);

  // PROSES SCAN (FIX LOGIC)
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
        await loadData(); // Refresh Tabel
        toast({ title: "SCAN BERHASIL", description: `Sisa Kredit: ${result.remaining_credits}` });

        // 🔥 UPDATE KREDIT LIVE 🔥
        if (result.remaining_credits !== undefined) {
          const updatedUser = { ...user, creditBalance: result.remaining_credits };
          setUser(updatedUser);
          sessionStorage.setItem('user', JSON.stringify(updatedUser));
        }

        // 🔥 PENTING: JANGAN HAPUS GAMBAR AGAR PREVIEW TETAP ADA 🔥
        // handleClearImage(); <--- Saya matikan ini agar gambar tidak hilang
        // setReceiver(""); <--- Opsional: Reset penerima atau tidak

      } else if (result.error_type === "insufficient_credits") {
        toast({ title: "KREDIT HABIS", description: "Kredit Anda habis. Reset otomatis besok.", variant: "destructive" });
      } else {
        throw new Error(result.message);
      }
    } catch (e: any) {
      toast({ title: "ERROR", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, receiver, user, loadData, handleClearImage]);

  const handleLogout = () => { sessionStorage.clear(); navigate('/landing'); };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header 
        user={user} 
        onLogout={handleLogout} 
        onProfile={() => navigate('/profile')} 
        onSettings={() => navigate('/settings')}
      />

      <main className="container mx-auto px-4 py-6 flex-1">
        {/* Welcome */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center mb-6">
          <h2 className="text-xl font-bold mb-1"><TypewriterText text="Welcome to OCR.WTF! 🚀" /></h2>
          <p className="text-gray-600"><TypewriterText text="Scanner Dokumen Cerdas & Log Harian" delay={1500} /></p>
        </div>

        {/* INPUT ZONE */}
        <div className="space-y-6 mb-6">
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
              <SignaturePad onSignatureChange={setSignature} />
              
              <Button onClick={handleProcess} disabled={isProcessing} className="brutal-button w-full h-14 mt-4">
                {isProcessing ? "MEMPROSES..." : "SCAN & SIMPAN"}
              </Button>
            </div>
          )}
        </div>

        {/* TABLE */}
        <DataTable logs={logs} />
      </main>
    </div>
  );
};

export default Index;
