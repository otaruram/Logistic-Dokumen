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

// Mock data for the table
const mockLogs = [
  {
    id: 1,
    time: "08:32:15",
    date: "2025-12-06",
    docType: "MANIFEST",
    docNumber: "MNF-2024-001",
    receiver: "JOHN DOE",
    summary: "PT JAYA ABADI - 24 ITEMS",
    status: "SUCCESS" as const,
  },
  {
    id: 2,
    time: "09:15:42",
    date: "2025-12-06",
    docType: "INVOICE",
    docNumber: "INV-2024-042",
    receiver: "JANE SMITH",
    summary: "CV MITRA SEJAHTERA - IDR 5.2M",
    status: "SUCCESS" as const,
  },
  {
    id: 3,
    time: "10:03:08",
    date: "2025-12-06",
    docType: "SURAT JALAN",
    docNumber: "SJ-2024-118",
    receiver: "BUDI SANTOSO",
    summary: "UD BERKAH MAKMUR - 12 ITEMS",
    status: "PENDING" as const,
  },
  {
    id: 4,
    time: "11:27:33",
    date: "2025-12-06",
    docType: "MANIFEST",
    docNumber: "MNF-2024-002",
    receiver: "AHMAD YANI",
    summary: "PT GLOBAL TECH - 8 ITEMS",
    status: "ERROR" as const,
  },
  {
    id: 5,
    time: "13:45:19",
    date: "2025-12-06",
    docType: "DELIVERY NOTE",
    docNumber: "DN-2024-055",
    receiver: "SITI RAHMA",
    summary: "CV PRIMA LOGISTIK - 36 ITEMS",
    status: "SUCCESS" as const,
  },
  {
    id: 6,
    time: "14:22:08",
    date: "2025-12-06",
    docType: "INVOICE",
    docNumber: "INV-2024-043",
    receiver: "DEWI KUSUMA",
    summary: "PT SENTOSA JAYA - IDR 3.8M",
    status: "SUCCESS" as const,
  },
  {
    id: 7,
    time: "15:10:33",
    date: "2025-12-06",
    docType: "MANIFEST",
    docNumber: "MNF-2024-003",
    receiver: "RUDI HARTONO",
    summary: "CV KARYA MANDIRI - 18 ITEMS",
    status: "SUCCESS" as const,
  },
  {
    id: 8,
    time: "16:05:47",
    date: "2025-12-06",
    docType: "SURAT JALAN",
    docNumber: "SJ-2024-119",
    receiver: "WATI SURYANI",
    summary: "UD MAKMUR SENTOSA - 9 ITEMS",
    status: "PENDING" as const,
  },
];

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [receiver, setReceiver] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState(mockLogs);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const API_URL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('isAuthenticated');
    navigate('/landing');
  };

  const handleGaskeun = () => navigate('/gaskeun');
  const handleProfile = () => navigate('/profile');
  const handleSettings = () => navigate('/settings');

  const loadData = useCallback(async () => {
    const isInitialMount = sessionStorage.getItem('hasLoaded') !== 'true';
    if (isInitialMount) {
      setIsLoading(true);
      sessionStorage.setItem('hasLoaded', 'true');
    }
    try {
      const userStr = sessionStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const token = user?.credential || "";
      const response = await fetch(`${API_URL}/history`, { headers: { "Authorization": `Bearer ${token}` } });
      const data = await response.json();
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
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setTimeout(() => setIsLoading(false), 1200);
    }
  }, [API_URL]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileSelect = useCallback(async (file: File) => {
    try {
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
      toast({ description: 'Mengompres gambar...' });
      const compressedFile = await imageCompression(file, options);
      setSelectedFile(compressedFile);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(compressedFile);
      toast({ title: 'Sukses', description: 'Gambar siap diproses!' });
    } catch (error) {
      console.error('Image compression error:', error);
      toast({ title: 'Error', description: 'Gagal mengompres gambar.', variant: 'destructive' });
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  }, [toast]);

  const handleClearImage = useCallback(() => {
    setSelectedFile(null);
    setImagePreview(null);
  }, []);

  const handleCameraCapture = useCallback(async (file: File) => {
    try {
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
      toast({ description: 'Mengompres gambar...' });
      const compressedFile = await imageCompression(file, options);
      setSelectedFile(compressedFile);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(compressedFile);
      toast({ title: 'Sukses', description: 'Foto berhasil diambil!' });
    } catch (error) {
      console.error('Camera compression error:', error);
      toast({ title: 'Error', description: 'Gagal mengompres gambar.', variant: 'destructive' });
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  }, [toast]);

  const handleSignatureChange = useCallback((signatureData: string | null) => {
    setSignature(signatureData);
    if (signatureData) {
      toast({ title: "TANDA TANGAN TERSIMPAN" });
    }
  }, [toast]);

  const handleProcess = useCallback(async () => {
    if (!imagePreview || !selectedFile) {
      return toast({ title: "ERROR", description: "Silakan upload file terlebih dahulu", variant: "destructive" });
    }
    if (!receiver.trim()) {
      return toast({ title: "ERROR", description: "Silakan isi nama penerima", variant: "destructive" });
    }

    setIsProcessing(true);
    try {
      const userStr = sessionStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const token = user?.credential || "";
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("receiver", receiver);

      const response = await fetch(`${API_URL}/scan`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });

      const result = await response.json();
      if (result.status === "success") {
        await loadData(); // Re-fetch all data to get the new log
        toast({ title: "PROSES SELESAI", description: `Terdeteksi: ${result.data.kategori || "Dokumen"}` });
      } else {
        throw new Error(result.message || "Gagal memproses dokumen");
      }
    } catch (error) {
      toast({ title: "ERROR", description: error instanceof Error ? error.message : "Gagal terhubung ke backend", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      handleClearImage();
      setReceiver("");
      setSignature(null);
    }
  }, [imagePreview, selectedFile, receiver, toast, handleClearImage, API_URL, loadData]);

  const handleUpdateLog = async (logId: number, newSummary: string) => {
    try {
      const userStr = sessionStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const token = user?.credential || "";
      
      console.log("UPDATE LOG - Sending request:", { logId, newSummary: newSummary.substring(0, 50) + "..." });
      
      const response = await fetch(`${API_URL}/logs/${logId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ summary: newSummary }),
      });

      const result = await response.json();
      console.log("UPDATE LOG - Server response:", result);

      if (result.status === "success" && result.data) {
        // Update state dengan data terbaru dari server
        setLogs(currentLogs => {
          const updatedLogs = [...currentLogs];
          const indexToUpdate = updatedLogs.findIndex(log => log.id === logId);
          if (indexToUpdate !== -1) {
            updatedLogs[indexToUpdate] = {
              ...updatedLogs[indexToUpdate],
              summary: result.data.summary, // Pastikan menggunakan data dari server
            };
            console.log("UPDATE LOG - Updated log in state:", updatedLogs[indexToUpdate]);
          }
          return updatedLogs;
        });

        // Refresh data dari server untuk memastikan konsistensi
        await loadData();
        
        toast({ title: "✅ BERHASIL DIPERBARUI" });
      } else {
        throw new Error(result.message || "Gagal memperbarui log");
      }
    } catch (error) {
      toast({ title: "❌ ERROR", description: error instanceof Error ? error.message : "Gagal memperbarui log", variant: "destructive" });
    }
  };

  const handleDeleteLog = async (logId: number) => {
    const confirmed = window.confirm("⚠️ HAPUS LOG INI?\n\nData akan dihapus permanen.");
    if (!confirmed) return;

    try {
      const userStr = sessionStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const token = user?.credential || "";
      const response = await fetch(`${API_URL}/logs/${logId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const result = await response.json();
      if (result.status === "success") {
        setLogs((prev) => prev.filter((log) => log.id !== logId));
        toast({ title: "✅ BERHASIL DIHAPUS" });
      } else {
        throw new Error(result.message || "Gagal menghapus log");
      }
    } catch (error) {
      toast({ title: "❌ ERROR", description: error instanceof Error ? error.message : "Gagal menghapus log", variant: "destructive" });
    }
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
      <Header user={user} onLogout={handleLogout} onGaskeun={handleGaskeun} onProfile={handleProfile} onSettings={handleSettings} />

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-6 flex-1">
        {/* Section 1: ZONA INPUT */}
        <div className="space-y-4 md:space-y-6 mb-4 md:mb-6">
          <div className="brutal-card">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 md:w-5 md:h-5" />
              <h2 className="text-xs md:text-sm font-bold uppercase">ZONA INPUT</h2>
            </div>

            {!selectedFile ? (
              <FileUploadZone onFileSelect={handleFileSelect} />
            ) : (
              <ImagePreview
                imageUrl={imagePreview!}
                onClear={handleClearImage}
              />
            )}
          </div>

          {/* Receiver Input - Only show when file is selected */}
          {selectedFile && (
            <div className="brutal-card">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardCheck className="w-4 h-4 md:w-5 md:h-5" />
                <h2 className="text-xs md:text-sm font-bold uppercase">
                  ZONA VALIDASI
                </h2>
              </div>

              {/* Receiver Input */}
              <div className="space-y-3 mb-6">
                <label className="block text-xs md:text-sm font-bold uppercase tracking-wide">
                  NAMA PENERIMA
                </label>
                <input
                  type="text"
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder="MASUKKAN NAMA PENERIMA..."
                  className="brutal-input brutal-input-focus w-full text-xs md:text-sm"
                />
              </div>

            {/* Signature Pad */}
            <SignaturePad onSignatureChange={handleSignatureChange} />

            {/* Process Button */}
            <Button
              variant="primary"
              size="lg"
              onClick={handleProcess}
              disabled={isProcessing}
              className="brutal-button w-full h-14 md:h-16 text-sm md:text-base relative overflow-hidden"
            >
              {isProcessing ? (
                <>
                  {/* Scanner Bar */}
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

        {/* Section 3: LOG HARIAN */}
        <DataTable 
          key={`logs-${logs.length}-${Date.now()}`} 
          logs={logs} 
          onDeleteLog={handleDeleteLog} 
          onUpdateLog={handleUpdateLog} 
        />
      </main>

      {/* Footer */}
      <footer className="brutal-border-thin border-b-0 border-l-0 border-r-0 mt-auto">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-center gap-2">
          <img src="/1.png" alt="Logo" className="w-4 h-4 md:w-5 md:h-5 object-contain" />
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase">
            MADE BY SOMEONE
          </p>
        </div>
      </footer>
      </>
      )}
    </div>
  );
};

export default Index;
