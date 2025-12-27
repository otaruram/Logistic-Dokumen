import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ScanUpload } from "../dgtnz/ScanUpload";
import { ValidationZone } from "../dgtnz/ValidationZone";
import { ScanHistory } from "../dgtnz/ScanHistory";
import { EditScanDialog } from "../dgtnz/EditScanDialog";
import { ScanSuccessDialog } from "../dgtnz/ScanSuccessDialog";
import { DriveSuccessDialog } from "../dgtnz/DriveSuccessDialog";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Interfaces
interface ScanRecord {
  id: number;
  no: number;
  tanggal: string;
  namaPenerima: string;
  keterangan: string;
  fotoUrl: string;
  tandaTangan: string;
  status: "pending" | "approved" | "rejected";
}

export default function DgtnzTab({ onBack }: { onBack: () => void }) {
  // State
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [records, setRecords] = useState<ScanRecord[]>([]);

  // Dialog States
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [driveSuccessLink, setDriveSuccessLink] = useState<string | null>(null);

  // Load Data
  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_BASE_URL}/api/scans`, {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const mapped: ScanRecord[] = data.map((d: any, i: number) => ({
          id: d.id,
          no: i + 1,
          tanggal: new Date(d.created_at).toLocaleDateString('id-ID'),
          namaPenerima: d.recipient_name || "-",
          keterangan: d.extracted_text || "-",
          fotoUrl: d.imagekit_url || d.file_path || "",
          tandaTangan: d.signature_url || "",
          status: d.status === 'completed' ? 'approved' : 'pending'
        }));
        setRecords(mapped);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleProcess = async () => {
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

      const sigRes = await fetch(`${API_BASE_URL}/api/scans/upload-signature`, {
        method: 'POST', body: sigFormData
      });
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

      const resJson = await res.json();
      toast.dismiss();
      // toast.success("Document digitized successfully!");
      setUploadedImage(null);
      setPreviewUrl(null);
      setRecipientName("");
      setSignatureData("");

      toast.success("Document digitized successfully!");
      // setSuccessUrl(resJson.imagekit_url || resJson.file_path); // Disabled as requested
      loadRecords();

      setTimeout(() => {
        document.getElementById('scan-history-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);

    } catch (e) {
      toast.dismiss();
      toast.error("Failed to process document");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = (id: number) => {
    setRecords(records.filter(r => r.id !== id));
    toast.success("Record deleted");
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
        loadRecords(); // Reload to refresh table
      } else {
        toast.error("Failed to update");
      }
    } catch (e) {
      toast.error("Error updating record");
    }
  };

  const handleExportDrive = async () => {
    try {
      toast.loading("Preparing premium export...");
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();

      if (!session || !session.provider_token) {
        toast.dismiss();
        toast.error("Please login with Google to use Drive Export");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/scans/export-drive-direct`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ access_token: session.provider_token })
      });

      if (!res.ok) throw new Error("Export failed");

      const data = await res.json();
      toast.dismiss();
      // toast.success("Successfully exported to Drive!", {
      //   action: {
      //     label: "View",
      //     onClick: () => window.open(data.web_view_link, "_blank")
      //   }
      // });
      setDriveSuccessLink(data.web_view_link);

    } catch (e) {
      toast.dismiss();
      console.error(e);
      toast.error("Export failed. Make sure you logged in via Google.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-full">
      {/* Heavy Header */}
      <div className="flex items-center gap-3 pb-2 pt-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-white/10 text-white h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-white">
            dgtnz.wtf
          </h2>
          <p className="text-xs text-gray-400">Scan & digitize dokumen dengan OCR</p>
        </div>
      </div>

      {/* Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left/Top: Upload */}
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

        {/* Right/Bottom: Validation */}
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

          <div className="mt-4">
            <Button
              onClick={handleProcess}
              disabled={isProcessing || !uploadedImage || !recipientName || !signatureData}
              className="w-full bg-white text-black hover:bg-gray-200 h-14 text-base font-bold rounded-xl shadow-lg shadow-white/5 disabled:opacity-50"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  🚀 Proses Scan
                </span>
              )}
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Full Width History */}
      <motion.div id="scan-history-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <ScanHistory
          records={records}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onExportGoogleDrive={handleExportDrive}
        />
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

      <DriveSuccessDialog
        open={!!driveSuccessLink}
        onOpenChange={(open) => !open && setDriveSuccessLink(null)}
        fileUrl={driveSuccessLink || ""}
      />
    </div>
  );
}
