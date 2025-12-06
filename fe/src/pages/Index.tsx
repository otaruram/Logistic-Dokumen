import { useState, useCallback, useEffect } from "react";
import { Send, Package, ClipboardCheck } from "lucide-react";
import Header from "@/components/dashboard/Header";
import FileDropZone from "@/components/dashboard/FileDropZone";
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
    docType: "MANIFEST",
    docNumber: "MNF-2024-001",
    receiver: "JOHN DOE",
    summary: "PT JAYA ABADI - 24 ITEMS",
    status: "SUCCESS" as const,
  },
  {
    id: 2,
    time: "09:15:42",
    docType: "INVOICE",
    docNumber: "INV-2024-042",
    receiver: "JANE SMITH",
    summary: "CV MITRA SEJAHTERA - IDR 5.2M",
    status: "SUCCESS" as const,
  },
  {
    id: 3,
    time: "10:03:08",
    docType: "SURAT JALAN",
    docNumber: "SJ-2024-118",
    receiver: "BUDI SANTOSO",
    summary: "UD BERKAH MAKMUR - 12 ITEMS",
    status: "PENDING" as const,
  },
  {
    id: 4,
    time: "11:27:33",
    docType: "MANIFEST",
    docNumber: "MNF-2024-002",
    receiver: "AHMAD YANI",
    summary: "PT GLOBAL TECH - 8 ITEMS",
    status: "ERROR" as const,
  },
  {
    id: 5,
    time: "13:45:19",
    docType: "DELIVERY NOTE",
    docNumber: "DN-2024-055",
    receiver: "SITI RAHMA",
    summary: "CV PRIMA LOGISTIK - 36 ITEMS",
    status: "SUCCESS" as const,
  },
  {
    id: 6,
    time: "14:22:08",
    docType: "INVOICE",
    docNumber: "INV-2024-043",
    receiver: "DEWI KUSUMA",
    summary: "PT SENTOSA JAYA - IDR 3.8M",
    status: "SUCCESS" as const,
  },
  {
    id: 7,
    time: "15:10:33",
    docType: "MANIFEST",
    docNumber: "MNF-2024-003",
    receiver: "RUDI HARTONO",
    summary: "CV KARYA MANDIRI - 18 ITEMS",
    status: "SUCCESS" as const,
  },
  {
    id: 8,
    time: "16:05:47",
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
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Initial loading + fetch history
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch("http://localhost:8000/history");
        const data = await response.json();
        
        const formattedLogs = data.map((log: any) => ({
          id: log.id,
          time: new Date(log.timestamp).toLocaleTimeString('id-ID'),
          docType: "",
          docNumber: "",
          receiver: log.receiver,
          imageUrl: log.image_path,
          summary: log.summary,
          status: "SUCCESS" as const
        }));
        
        setLogs(formattedLogs);
      } catch (error) {
        console.error("Error loading history:", error);
      } finally {
        // Loading screen duration: 1200ms (not too fast, not too slow)
        setTimeout(() => setIsLoading(false), 1200);
      }
    };
    
    loadData();
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleClearImage = useCallback(() => {
    setSelectedFile(null);
    setImagePreview(null);
  }, []);

  const handleSignatureChange = useCallback((signatureData: string | null) => {
    setSignature(signatureData);
    if (signatureData) {
      toast({
        title: "TANDA TANGAN TERSIMPAN",
        description: "Tanda tangan berhasil dikonfirmasi",
      });
    }
  }, [toast]);

  const handleProcess = useCallback(async () => {
    if (!imagePreview && !selectedFile) {
      toast({
        title: "ERROR: TIDAK ADA INPUT",
        description: "Silakan upload file terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    if (!receiver.trim()) {
      toast({
        title: "ERROR: PENERIMA KOSONG",
        description: "Silakan isi nama penerima",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Kirim file ke backend API
      const formData = new FormData();
      formData.append("file", selectedFile!);
      formData.append("receiver", receiver); // Kirim nama penerima

      const response = await fetch("http://localhost:8000/scan", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.status === "success") {
        // Gunakan data dari backend
        const newLog = {
          id: result.data.id,
          time: new Date(result.data.timestamp).toLocaleTimeString("id-ID"),
          docType: result.data.kategori, // Gunakan kategori dari backend
          docNumber: result.data.nomor_dokumen, // Nomor dari OCR
          receiver: result.data.receiver, // Nama penerima
          imageUrl: result.data.imageUrl, // URL foto
          summary: result.data.summary,
          status: "SUCCESS" as const,
        };

        setLogs((prev) => [newLog, ...prev]);
        
        toast({
          title: "PROSES SELESAI",
          description: `Terdeteksi: ${result.data.kategori}`,
        });
      } else {
        throw new Error(result.message || "Gagal memproses dokumen");
      }
    } catch (error) {
      toast({
        title: "ERROR",
        description: error instanceof Error ? error.message : "Gagal terhubung ke backend",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      handleClearImage();
      setReceiver("");
      setSignature(null);
    }
  }, [imagePreview, selectedFile, receiver, toast, handleClearImage]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {isLoading ? (
        // Loading Screen
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
      <Header />

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-6 flex-1">
        {/* Section 1: ZONA INPUT */}
        <div className="space-y-4 md:space-y-6 mb-4 md:mb-6">
          <div className="brutal-card">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 md:w-5 md:h-5" />
              <h2 className="text-xs md:text-sm font-bold uppercase">ZONA INPUT</h2>
            </div>

            <FileDropZone
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              onClear={handleClearImage}
            />
          </div>

          {/* Image Preview */}
          {imagePreview && (
            <ImagePreview imageUrl={imagePreview} onClear={handleClearImage} />
          )}
        </div>

        {/* Section 2: ZONA VALIDASI */}
        <div className="space-y-4 md:space-y-6 mb-4 md:mb-6">
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
          </div>

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
                <span className="ml-2">PROSES DATA</span>
              </>
            )}
          </Button>
        </div>

        {/* Section 3: LOG HARIAN */}
        <DataTable logs={logs} />
      </main>

      {/* Footer */}
      <footer className="brutal-border-thin border-b-0 border-l-0 border-r-0 mt-auto">
        <div className="container mx-auto px-4 py-3 md:py-4 text-center">
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
