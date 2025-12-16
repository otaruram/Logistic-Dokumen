import { useState, useCallback, useEffect } from "react";
import { Send, Package, ClipboardCheck } from "lucide-react";
import imageCompression from 'browser-image-compression';
import { useNavigate } from "react-router-dom";
import Header from "@/components/dashboard/Header";
import FileUploadZone from "@/components/dashboard/FileUploadZone";
import ImagePreview from "@/components/dashboard/ImagePreview";
import SignaturePad from "@/components/dashboard/SignaturePad";
import DataTable from "@/components/dashboard/DataTable";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-service";

const TypewriterText = ({ text, delay = 0 }: { text: string; delay?: number }) => {
  const [displayText, setDisplayText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isStarted, setIsStarted] = useState(false)
  useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => setIsStarted(true), delay)
      return () => clearTimeout(timer)
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
  const [isSignatureLocked, setIsSignatureLocked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  // --- FUNGSI UPDATE USER DATA (KREDIT) ---
  const syncUserData = async (currentToken: string) => {
    try {
        // Panggil API Cek Kredit
        const res = await apiFetch('/api/pricing/user/credits', {
            headers: { "Authorization": `Bearer ${currentToken}` }
        });
        const json = await res.json();
        
        if (json.status === 'success' && json.data) {
            const serverCredit = json.data.remainingCredits;
            
            // Update State & SessionStorage jika beda
            setUser((prev: any) => {
                if (prev.creditBalance !== serverCredit) {
                    const updated = { ...prev, creditBalance: serverCredit };
                    sessionStorage.setItem('user', JSON.stringify(updated));
                    return updated;
                }
                return prev;
            });
        }
    } catch (e) {
        console.error("Gagal sync kredit:", e);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const token = user?.credential || "";
      if (!token) return;

      // 1. Sync Kredit (PENTING: Jalankan ini di awal)
      await syncUserData(token);

      // 2. Load History
      const response = await apiFetch('/history', { headers: { "Authorization": `Bearer ${token}` } });
      const data = await response.json();
      
      if (Array.isArray(data)) {
        const formatted = data.map((log: any) => ({
          id: log.id,
          time: new Date(log.timestamp).toLocaleTimeString("id-ID"),
          date: new Date(log.timestamp).toISOString().split('T')[0],
          docType: log.kategori || "DOKUMEN",
          docNumber: log.nomorDokumen || "-",
          receiver: log.receiver || "-",
          imageUrl: log.imagePath,
          summary: log.summary || "",
          status: "SUCCESS"
        }));
        setLogs(formatted as any);
      }
    } catch (e) { console.error(e); }
  }, [user?.credential]);

  useEffect(() => { loadData(); }, [loadData]);

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

  const handleSignatureConfirm = (signatureData: string | null) => {
    setSignature(signatureData);
    if (signatureData) {
       setIsSignatureLocked(true);
       toast({ title: "Tanda Tangan Tersimpan", description: "Tanda tangan dikunci." });
    }
  };

  const handleResetSignature = () => {
    setSignature(null);
    setIsSignatureLocked(false);
  };

  const handleProcess = useCallback(async () => {
    if (!selectedFile) return toast({ title: "Upload foto dulu", variant: "destructive" });
    if (!receiver) return toast({ title: "Isi nama penerima", variant: "destructive" });
    if (!signature && !isSignatureLocked) return toast({ title: "Harap tanda tangan", variant: "destructive" });

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
        // Update Kredit Langsung dari Respon Scan
        if (result.remaining_credits !== undefined) {
             const updatedUser = { ...user, creditBalance: result.remaining_credits };
             setUser(updatedUser);
             sessionStorage.setItem('user', JSON.stringify(updatedUser));
        }
        
        await loadData(); // Refresh Log
        toast({ title: "SCAN BERHASIL", description: `Sisa Kredit: ${result.remaining_credits}` });
        
        setReceiver("");
        handleResetSignature(); // Reset Form tapi file tetap ada (opsional)

      } else if (result.error_type === "insufficient_credits") {
        toast({ title: "KREDIT HABIS", description: "Tunggu reset besok.", variant: "destructive" });
      } else {
        throw new Error(result.message);
      }
    } catch (e: any) {
      toast({ title: "ERROR", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, receiver, user, loadData, signature, isSignatureLocked]);

  const handleUpdateLog = async (id: number, summary: string) => {
    try {
        const token = user?.credential;
        await apiFetch(`/logs/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ summary })
        });
        setLogs(prev => prev.map((l:any) => l.id === id ? {...l, summary} : l));
        toast({ title: "Tersimpan", description: "Keterangan diperbarui" });
    } catch { toast({ title: "Gagal Update", variant: "destructive" }); }
  };

  const handleDeleteLog = async (id: number) => {
    if(!confirm("Hapus?")) return;
    try {
        const token = user?.credential;
        await apiFetch(`/logs/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        setLogs(prev => prev.filter((l:any) => l.id !== id));
        toast({ title: "Terhapus" });
    } catch { toast({ title: "Gagal Hapus", variant: "destructive" }); }
  }

  const handleLogout = () => { sessionStorage.clear(); navigate('/landing'); };

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
      <Header user={user} onLogout={handleLogout} onProfile={() => navigate('/profile')} onSettings={() => navigate('/settings')} />

      <main className="container mx-auto px-4 py-6 flex-1">
        <div className="bg-blue-50 dark:bg-zinc-900 border-2 border-blue-200 dark:border-zinc-700 rounded-lg p-6 text-center mb-6 shadow-md">
          <h2 className="text-xl font-bold mb-1 dark:text-white"><TypewriterText text="Welcome to OCR.WTF! 🚀" /></h2>
          <p className="text-gray-600 dark:text-gray-400"><TypewriterText text="Scanner Dokumen Cerdas" delay={1500} /></p>
        </div>

        <div className="space-y-6 mb-6">
          <div className="brutal-card bg-white dark:bg-zinc-900 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
            <div className="flex items-center gap-2 mb-4 dark:text-white">
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
            <div className="brutal-card bg-white dark:bg-zinc-900 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2 mb-4 dark:text-white">
                <ClipboardCheck className="w-5 h-5" />
                <h2 className="text-sm font-bold uppercase">VALIDASI</h2>
              </div>
              <div className="space-y-3 mb-6">
                <label className="block text-xs font-bold uppercase dark:text-white">PENERIMA</label>
                <input
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder="Nama Penerima..."
                  className="brutal-input w-full dark:bg-zinc-800 dark:text-white dark:border-white"
                />
              </div>

              <div className="space-y-2">
                 <label className="block text-xs font-bold uppercase dark:text-white">TANDA TANGAN</label>
                 <div className={`relative border-2 border-black dark:border-white ${isSignatureLocked ? "pointer-events-none opacity-80" : ""}`}>
                     <SignaturePad onSignatureChange={handleSignatureConfirm} />
                     {isSignatureLocked && (
                        <div className="absolute top-2 right-2 pointer-events-auto z-10">
                            <Button size="sm" variant="destructive" onClick={handleResetSignature} className="h-6 text-[10px] font-bold border border-black shadow-[2px_2px_0px_0px_black]">
                               UBAH TTD
                            </Button>
                        </div>
                     )}
                 </div>
              </div>
              
              <Button onClick={handleProcess} disabled={isProcessing} className="brutal-button w-full h-14 mt-4 dark:bg-white dark:text-black dark:hover:bg-gray-200">
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

export default Index;
