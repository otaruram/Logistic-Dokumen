import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ScanUpload } from "../dgtnz/ScanUpload";
import { ValidationZone } from "../dgtnz/ValidationZone";
import { FraudScanHistory } from "../dgtnz/FraudScanHistory";
import { EditScanDialog } from "../dgtnz/EditScanDialog";
import { ScanSuccessDialog } from "../dgtnz/ScanSuccessDialog";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Scan mode
type ScanMode = "fraud";

// Interfaces
interface ScanRecord {
  id: number | string;
  no: number;
  tanggal: string;
  namaPenerima: string;
  keterangan: string;
  fotoUrl: string;
  tandaTangan: string;
  status: "processing" | "verified" | "tampered" | "pending" | "approved" | "rejected";
  isFraudScan?: boolean;
  fraudFields?: {
    nominal_total?: number | null;
    nama_klien?: string | null;
    nomor_surat_jalan?: string | null;
    tanggal_jatuh_tempo?: string | null;
    confidence?: string;
  };
}

export default function DgtnzTab({ onBack }: { onBack: () => void; initialMode?: ScanMode }) {
  // Core state
  const [scanMode] = useState<ScanMode>("fraud");
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [fraudRecords, setFraudRecords] = useState<ScanRecord[]>([]);

  // Fraud scan processing steps
  const [fraudStep, setFraudStep] = useState<string>("");

  // History tab state
  const [historyTab] = useState<"fraud">("fraud");

  // Dialog States
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

  useEffect(() => {
    loadAllRecords();
  }, []);

  const loadAllRecords = async () => {
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Strategy 1: Load from /api/scans (tabel scans via SQLAlchemy)
      const res = await fetch(`${API_BASE_URL}/api/scans`, {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        console.log("[DgtnzTab] Total scans from API:", data.length);
        console.log("[DgtnzTab] Fraud scans:", data.filter((d: any) => d.is_fraud_scan).length);
        console.log("[DgtnzTab] Default scans:", data.filter((d: any) => !d.is_fraud_scan).length);

        // Split into default and fraud
        const defaultMapped: ScanRecord[] = data
          .filter((d: any) => !d.is_fraud_scan)
          .map((d: any, i: number) => ({
            id: d.id,
            no: i + 1,
            tanggal: new Date(d.created_at).toLocaleDateString('id-ID'),
            namaPenerima: d.recipient_name || "-",
            keterangan: d.extracted_text || "-",
            fotoUrl: d.imagekit_url || d.file_path || "",
            tandaTangan: d.signature_url || "",
            status: d.status === 'completed' ? 'verified' : (d.status === 'failed' || d.status === 'tampered' ? 'tampered' : 'processing'),
            isFraudScan: false,
            fraudFields: null,
          }));

        const fraudMapped: ScanRecord[] = data
          .filter((d: any) => d.is_fraud_scan)
          .map((d: any, i: number) => ({
            id: d.id,
            no: i + 1,
            tanggal: new Date(d.created_at).toLocaleDateString('id-ID'),
            namaPenerima: d.recipient_name || "-",
            keterangan: d.extracted_text || "-",
            fotoUrl: d.imagekit_url || d.file_path || "",
            tandaTangan: d.signature_url || "",
            status: d.status === 'verified' ? 'verified' : (d.status === 'tampered' ? 'tampered' : d.status === 'processing' ? 'processing' : 'verified'),
            isFraudScan: true,
            fraudFields: d.fraud_fields || null,
          }));

        setRecords(defaultMapped);

        // If fraud scans found in /api/scans, use those
        if (fraudMapped.length > 0) {
          console.log("[DgtnzTab] Using fraud records from /api/scans:", fraudMapped.length);
          setFraudRecords(fraudMapped);
        } else {
          // Fallback: try loading from dedicated fraud_scans table via Supabase
          console.log("[DgtnzTab] No fraud records in /api/scans, trying Supabase fraud_scans...");
          await loadFraudFromSupabase(session.access_token);
        }
      }
    } catch (e) {
      console.error("Failed to load records:", e);
    }
  };

  const loadFraudFromSupabase = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/scans/fraud-history`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const mapped: ScanRecord[] = (data.records || []).map((d: any, i: number) => ({
          id: d.id,
          no: i + 1,
          tanggal: new Date(d.created_at).toLocaleDateString('id-ID'),
          namaPenerima: d.recipient_name || "-",
          keterangan: d.extracted_text || "-",
          fotoUrl: d.imagekit_url || d.file_url || "",
          tandaTangan: d.signature_url || "",
          status: d.status === 'verified' ? 'verified' : (d.status === 'tampered' ? 'tampered' : 'processing'),
          isFraudScan: true,
          fraudFields: {
            nominal_total: d.nominal_total,
            nama_klien: d.nama_klien,
            nomor_surat_jalan: d.nomor_surat_jalan,
            tanggal_jatuh_tempo: d.tanggal_jatuh_tempo,
            confidence: d.field_confidence || "low",
          },
        }));
        if (mapped.length > 0) {
          console.log("[DgtnzTab] Fraud records from Supabase:", mapped.length);
          setFraudRecords(mapped);
        }
      }
    } catch (e) {
      console.error("Failed to load fraud records from Supabase:", e);
    }
  };

  // ── Default Scan ──────────────────────────────────────────────────
  const handleDefaultProcess = async () => {
    if (!uploadedImage || !recipientName || !signatureData) {
      toast.error("Please complete all validation fields");
      return;
    }
    setIsProcessing(true);
    toast.loading("Processing document...");

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const sigBlob = await (await fetch(signatureData)).blob();
      const sigFormData = new FormData();
      sigFormData.append('file', sigBlob, 'sig.png');
      const sigRes = await fetch(`${API_BASE_URL}/api/scans/upload-signature`, { method: 'POST', body: sigFormData });
      const sigJson = await sigRes.json();
      const finalSigUrl = sigJson.url || "";

      const formData = new FormData();
      formData.append("file", uploadedImage);
      formData.append("recipient_name", recipientName);
      formData.append("signature_url", finalSigUrl);

      const res = await fetch(`${API_BASE_URL}/api/scans/save-with-signature`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
        body: formData
      });

      if (!res.ok) throw new Error("Upload failed");

      // Dispatch event to notify dashboard of scan completion
      window.dispatchEvent(new CustomEvent('scan-completed'));

      toast.dismiss();
      toast.success("Document digitized successfully!");
      setUploadedImage(null);
      setPreviewUrl(null);
      setRecipientName("");
      setSignatureData("");
      setHistoryTab("default"); // Auto-switch to default history tab
      loadAllRecords();

      setTimeout(() => {
        document.getElementById('scan-history-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);

    } catch {
      toast.dismiss();
      toast.error("Failed to process document");
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Fraud Detection Scan ──────────────────────────────────────────
  const handleFraudProcess = async () => {
    if (!uploadedImage || !recipientName || !signatureData) {
      toast.error("Lengkapi semua field validasi");
      return;
    }
    setIsProcessing(true);
    setFraudStep("Mengunggah dokumen...");
    toast.loading("🔍 Menginisiasi Deteksi Fraud...");

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      // Upload signature
      setFraudStep("Memvalidasi tanda tangan...");
      const sigBlob = await (await fetch(signatureData)).blob();
      const sigFormData = new FormData();
      sigFormData.append('file', sigBlob, 'sig.png');
      const sigRes = await fetch(`${API_BASE_URL}/api/scans/upload-signature`, { method: 'POST', body: sigFormData });
      const sigJson = await sigRes.json();
      const finalSigUrl = sigJson.url || "";

      setFraudStep("Mengekstrak field keuangan dengan AI...");
      const formData = new FormData();
      formData.append("file", uploadedImage);
      formData.append("recipient_name", recipientName);
      formData.append("signature_url", finalSigUrl);

      setFraudStep("Menganalisis dokumen untuk deteksi anomali...");
      // Use save-with-signature with ?fraud=true query param (bypasses nginx restriction on new paths)
      const res = await fetch(`${API_BASE_URL}/api/scans/save-with-signature?fraud=true`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
        body: formData
      });

      if (!res.ok) throw new Error("Scan gagal");

      const resJson = await res.json();

      setFraudStep("Menyimpan hasil ke database...");
      await new Promise(r => setTimeout(r, 600));

      const statusLabel = resJson.fraud_status === 'verified' ? '✅ Verified' : resJson.fraud_status === 'processing' ? '🟡 Processing' : '🔴 Tampered';
      toast.dismiss();
      toast.success(`🛡️ Deteksi Fraud selesai! ${statusLabel}`, { description: `Confidence: ${resJson.field_confidence || "low"}` });

      // Dispatch event to notify dashboard of scan completion
      window.dispatchEvent(new CustomEvent('scan-completed'));

      setUploadedImage(null);
      setPreviewUrl(null);
      setFraudStep("");
      loadAllRecords();

      setTimeout(() => {
        document.getElementById('scan-history-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);

    } catch {
      toast.dismiss();
      toast.error("Deteksi fraud gagal");
      setFraudStep("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcess = () => handleFraudProcess();

  const handleDelete = async (id: number | string) => {
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { toast.error("Please login first"); return; }

      // Fraud records have UUID (string) IDs, default records have integer IDs
      const isFraud = typeof id === "string" && id.includes("-");
      const endpoint = isFraud
        ? `${API_BASE_URL}/api/scans/fraud/${id}`
        : `${API_BASE_URL}/api/scans/${id}`;

      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");

      if (isFraud) {
        setFraudRecords(prev => prev.filter(r => r.id !== id));
      } else {
        setRecords(prev => prev.filter(r => r.id !== id));
      }
      toast.success("Record deleted successfully");
      window.dispatchEvent(new Event('scan-completed'));
    } catch (e) {
      console.error("Delete error:", e);
      toast.error("Failed to delete record");
    }
  };

  const handleEdit = (record: ScanRecord) => {
    setEditingRecord(record);
  };

  const handleSaveEdit = async (id: number, data: { recipient_name: string; extracted_text: string }) => {
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_BASE_URL}/api/scans/${id}`, {
        method: 'PATCH',
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        toast.success("Record updated");
        loadAllRecords();
      } else {
        toast.error("Failed to update");
      }
    } catch {
      toast.error("Error updating record");
    }
  };

  const isFraudMode = scanMode === "fraud";

  // Default records = records (already filtered non-fraud from backend)
  // Fraud records = fraudRecords (loaded from /api/scans/fraud-history)
  const defaultRecords = records;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-full">

      {/* Header */}
      <div className="flex items-center gap-3 pb-2 pt-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-white/10 text-white h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-white">feature.wtf</h2>
          <p className="text-xs text-gray-400">Scan & digitize dokumen dengan OCR</p>
        </div>
      </div>

      {/* Mode Badge */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 text-white shadow">
          <ShieldAlert className="w-4 h-4" />
          Mode Analisis
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-white/20">AI</span>
        </div>
      </motion.div>

      {/* Fraud Mode Banner */}
      <AnimatePresence>
        {isFraudMode && (
          <motion.div
            key="fraud-banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-300">Mode Analisis Aktif</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Dokumen akan dianalisis AI untuk mengekstrak <strong className="text-gray-300">Nominal Total, Nama Klien, Nomor Surat Jalan, dan Tanggal Jatuh Tempo</strong>. Hasil tersimpan di tabel riwayat dengan indikator khusus 🔴.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid: Upload + Validation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="h-full">
          <ScanUpload
            uploadedImage={uploadedImage}
            previewUrl={previewUrl}
            isProcessing={isProcessing}
            onImageSelect={(file) => {
              setUploadedImage(file);
              setPreviewUrl(URL.createObjectURL(file));
            }}
            onClear={() => {
              setUploadedImage(null);
              setPreviewUrl(null);
            }}
          />
        </motion.div>

        {/* Validation + Process Button */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col h-full">
          <div className="flex-1">
            <ValidationZone
              recipientName={recipientName}
              setRecipientName={setRecipientName}
              signatureData={signatureData}
              setSignatureData={setSignatureData}
              isProcessing={isProcessing}
            />
          </div>

          {/* Fraud step indicator */}
          <AnimatePresence>
            {isFraudMode && isProcessing && fraudStep && (
              <motion.div
                key="fraud-step"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-3 flex items-center gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                <span>{fraudStep}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4">
            <Button
              onClick={handleProcess}
              disabled={isProcessing || !uploadedImage || !recipientName || !signatureData}
              className={`w-full h-14 text-base font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all ${isFraudMode
                ? "bg-red-600 hover:bg-red-500 text-white shadow-red-500/20"
                : "bg-white text-black hover:bg-gray-200 shadow-white/5"
                }`}
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isFraudMode ? "Menganalisis dokumen..." : "Processing..."}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {isFraudMode ? (
                    <><ShieldAlert className="w-5 h-5" /> Analisis Dokumen</>
                  ) : (
                    <>🚀 Proses Scan</>
                  )}
                </span>
              )}
            </Button>
          </div>
        </motion.div>
      </div>

      {/* History Badge */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="flex gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 text-white shadow">
          <ShieldAlert className="w-4 h-4" />
          Riwayat Analisis
          {fraudRecords.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-white/20">{fraudRecords.length}</span>
          )}
        </div>
      </motion.div>

      {/* Scan History */}
      <motion.div id="scan-history-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <AnimatePresence mode="wait">
          <motion.div key="fraud-history" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
            <FraudScanHistory
              records={fraudRecords}
              onDelete={handleDelete}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <EditScanDialog
        open={!!editingRecord}
        onOpenChange={(open) => !open && setEditingRecord(null)}
        record={editingRecord}
        onSave={handleSaveEdit}
      />

      <ScanSuccessDialog
        open={!!successUrl}
        onOpenChange={(open) => !open && setSuccessUrl(null)}
        imageUrl={successUrl || ""}
      />

    </div>
  );
}
