import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Upload, Image as ImageIcon, Edit2, Trash2, Save, X, FileDown, Cloud } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import SignatureCanvas from "@/components/ui/signature-canvas";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface CompressOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

// Compress image file
const compressImage = (file: File, options: CompressOptions): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > options.maxWidth) {
          height = (height * options.maxWidth) / width;
          width = options.maxWidth;
        }
        if (height > options.maxHeight) {
          width = (width * options.maxHeight) / height;
          height = options.maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          'image/jpeg',
          options.quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

// Compress image blob (for signature)
const compressImageBlob = (blob: Blob, options: CompressOptions): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > options.maxWidth) {
          height = (height * options.maxWidth) / width;
          width = options.maxWidth;
        }
        if (height > options.maxHeight) {
          width = (width * options.maxHeight) / height;
          height = options.maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          // White background
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);

          // Apply brightness/contrast filter
          ctx.filter = "brightness(1.5) contrast(1.3)";
          ctx.drawImage(img, 0, 0, width, height);
        }

        canvas.toBlob(
          (newBlob) => {
            if (newBlob) {
              resolve(newBlob);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          'image/jpeg',
          options.quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

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

interface DgtnzTabProps {
  onBack: () => void;
}

const DgtnzTab = ({ onBack }: DgtnzTabProps) => {
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [penerimaNama, setPenerimaNama] = useState("");
  const [tandaTanganValidasi, setTandaTanganValidasi] = useState("");
  const [scanRecords, setScanRecords] = useState<ScanRecord[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingKeterangan, setEditingKeterangan] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Filter state
  const [filterDay, setFilterDay] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");

  // Load scan records from backend on mount
  useEffect(() => {
    const loadScanRecords = async () => {
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setIsLoadingData(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/scans`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const scans = await response.json();
          // Transform API response to ScanRecord format
          const records: ScanRecord[] = scans.map((scan: any, idx: number) => ({
            id: scan.id,
            no: idx + 1,
            tanggal: new Date(scan.created_at).toLocaleDateString('id-ID'),
            namaPenerima: scan.recipient_name || "-",
            keterangan: scan.extracted_text || "-",
            fotoUrl: scan.imagekit_url || scan.file_path || "-",
            tandaTangan: scan.signature_url || "-",
            status: scan.status === 'completed' ? 'approved' : scan.status === 'failed' ? 'rejected' : 'pending',
          }));
          setScanRecords(records);
          toast.success(`✅ ${records.length} scan records loaded`);
        }
      } catch (error) {
        console.error("Error loading scan records:", error);
        toast.error("Gagal memuat data scan");
      } finally {
        setIsLoadingData(false);
      }
    };

    loadScanRecords();
  }, []);

  // Export to Excel with professional formatting
  const handleExportExcel = () => {
    const exportData = filteredRecords.map((record, idx) => ({
      "No": idx + 1,
      "Tanggal": record.tanggal,
      "Nama Penerima": record.namaPenerima,
      "Keterangan": record.keterangan,
      "Link Foto": record.fotoUrl,
      "Link Tanda Tangan": record.tandaTangan || "-",
      "Status": record.status === 'approved' ? 'APPROVED' : record.status === 'rejected' ? 'REJECTED' : 'PENDING',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Scan Records");

    // Professional column widths
    ws['!cols'] = [
      { wch: 5 },   // No
      { wch: 12 },  // Tanggal
      { wch: 25 },  // Nama Penerima
      { wch: 50 },  // Keterangan
      { wch: 60 },  // Link Foto
      { wch: 60 },  // Link Tanda Tangan
      { wch: 12 },  // Status
    ];

    // Add styling to all cells (borders + header color)
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

    // Style all cells with borders
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;

        // Add borders to all cells
        const borderStyle = { style: "thin", color: { rgb: "000000" } };
        ws[cellAddress].s = {
          border: {
            top: borderStyle,
            bottom: borderStyle,
            left: borderStyle,
            right: borderStyle
          },
          alignment: { vertical: "center", wrapText: true }
        };

        // Header row styling (bold + blue background)
        if (R === 0) {
          ws[cellAddress].s = {
            ...ws[cellAddress].s,
            font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4472C4" } },
            alignment: { horizontal: "center", vertical: "center" }
          };
        }
      }
    }

    const fileName = `Scan-Records-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success(`✅ Excel exported: ${fileName}`);
  };

  // Export to Google Drive
  const handleExportGDrive = async () => {
    try {
      // 1. Ambil Session
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: sessionData } = await supabase.auth.getSession();

      console.log('📋 Session data:', sessionData);
      console.log('📋 Provider token:', sessionData?.session?.provider_token);

      // 2. CEK TOKEN LEBIH TELITI
      const googleToken = sessionData?.session?.provider_token;

      if (!googleToken) {
        // Jika token kosong, berikan instruksi jelas ke user
        toast.error('Token Google Drive kadaluarsa atau belum diizinkan.');

        // Minta user login ulang manual untuk refresh token
        const shouldRelogin = confirm(
          '⚠️ Token Google Drive tidak ditemukan.\n\n' +
          'Untuk mengaktifkan export ke Google Drive:\n' +
          '1. Klik OK untuk logout\n' +
          '2. Login kembali dengan Google\n' +
          '3. Pastikan mengizinkan akses Google Drive\n\n' +
          'Lanjutkan?'
        );

        if (shouldRelogin) {
          await supabase.auth.signOut();
          window.location.reload();
        }
        return;
      }

      toast.loading('Exporting to Google Drive...');

      // Create Excel blob with same formatting as local export
      const exportData = filteredRecords.map((record, idx) => ({
        "No": idx + 1,
        "Tanggal": record.tanggal,
        "Nama Penerima": record.namaPenerima,
        "Keterangan": record.keterangan,
        "Link Foto": record.fotoUrl,
        "Link Tanda Tangan": record.tandaTangan || "-",
        "Status": record.status === 'approved' ? 'APPROVED' : record.status === 'rejected' ? 'REJECTED' : 'PENDING',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Scan Records");

      // Professional column widths
      ws['!cols'] = [
        { wch: 5 },   // No
        { wch: 12 },  // Tanggal
        { wch: 25 },  // Nama Penerima
        { wch: 50 },  // Keterangan
        { wch: 60 },  // Link Foto
        { wch: 60 },  // Link Tanda Tangan
        { wch: 12 },  // Status
      ];

      // Add styling (borders + header color)
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) continue;

          const borderStyle = { style: "thin", color: { rgb: "000000" } };
          ws[cellAddress].s = {
            border: {
              top: borderStyle,
              bottom: borderStyle,
              left: borderStyle,
              right: borderStyle
            },
            alignment: { vertical: "center", wrapText: true }
          };

          if (R === 0) {
            ws[cellAddress].s = {
              ...ws[cellAddress].s,
              font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "4472C4" } },
              alignment: { horizontal: "center", vertical: "center" }
            };
          }
        }
      }

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // Upload directly to Google Drive using provider token
      const fileName = `scan-records-${new Date().toISOString().split('T')[0]}.xlsx`;
      const metadata = {
        name: fileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', blob);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`
        },
        body: formData
      });

      console.log('📤 Drive API Response Status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Drive API Error:', errorData);
        throw new Error(errorData.error?.message || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Drive Upload Success:', data);

      const driveUrl = `https://drive.google.com/file/d/${data.id}/view`;

      toast.dismiss();
      toast.success(`✅ Excel exported to Google Drive!`);

      // Open Google Drive file
      window.open(driveUrl, '_blank');
    } catch (error: any) {
      toast.dismiss();
      console.error('❌ Google Drive export error:', error);
      toast.error(`Failed to export: ${error.message || 'Unknown error'}`);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Compress image before preview
      const compressedFile = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.8
      });

      // Preview compressed image
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(compressedFile);
      setUploadedImage(compressedFile);
    } catch (error) {
      console.error('Error compressing image:', error);
      toast.error('❌ Gagal memproses gambar');
    }
  };

  // Upload signature to ImageKit
  const handleSignatureUpload = async (signatureDataUrl: string): Promise<string> => {
    try {
      // Convert data URL to blob
      const response = await fetch(signatureDataUrl);
      const blob = await response.blob();

      // Compress signature
      const compressedBlob = await compressImageBlob(blob, {
        maxWidth: 500,
        maxHeight: 300,
        quality: 0.7
      });

      // Upload to backend
      const formData = new FormData();
      formData.append('file', compressedBlob, 'signature.png');

      const uploadResponse = await fetch(`${API_BASE_URL}/api/scans/upload-signature`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) throw new Error('Signature upload failed');

      const data = await uploadResponse.json();
      return data.url || signatureDataUrl;
    } catch (error) {
      console.error('Signature upload error:', error);
      return signatureDataUrl; // Fallback to data URL
    }
  };

  const handleProcessScan = async () => {
    if (!uploadedImage) {
      toast.error("Mohon upload gambar terlebih dahulu");
      return;
    }

    if (!penerimaNama.trim()) {
      toast.error("Mohon isi nama penerima terlebih dahulu");
      return;
    }

    if (!tandaTanganValidasi) {
      toast.error("Mohon buat tanda tangan terlebih dahulu");
      return;
    }

    // Process OCR
    setIsProcessing(true);
    toast.loading("Processing dengan Tesseract + OpenAI...");

    try {
      // Get session for authentication
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Anda harus login terlebih dahulu");
        return;
      }

      // 1. Upload signature first
      toast.loading("Uploading signature...");
      const signatureUrl = await handleSignatureUpload(tandaTanganValidasi);

      // 2. Upload image with metadata to save in database
      const formData = new FormData();
      formData.append("file", uploadedImage);
      formData.append("recipient_name", penerimaNama);
      formData.append("signature_url", signatureUrl);

      const response = await fetch(`${API_BASE_URL}/api/scans/save-with-signature`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();

      // Removed optimistic update to prevent data mismatch
      // Refresh data from server instead
      toast.dismiss();
      toast.success("✅ Dokumen berhasil di-scan dan disimpan ke database!");

      // RELOAD DATA FROM SERVER
      if (session) {
        const response = await fetch(`${API_BASE_URL}/api/scans`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (response.ok) {
          const scans = await response.json();
          const records: ScanRecord[] = scans.map((scan: any, idx: number) => ({
            id: scan.id,
            no: idx + 1,
            tanggal: new Date(scan.created_at).toLocaleDateString('id-ID'),
            namaPenerima: scan.recipient_name || "-",
            keterangan: scan.extracted_text || "-",
            fotoUrl: scan.imagekit_url || scan.file_path || "-",
            tandaTangan: scan.signature_url || "-",
            status: scan.status === 'completed' ? 'approved' : scan.status === 'failed' ? 'rejected' : 'pending',
          }));
          setScanRecords(records);
        }
      }

      // AUTO-CLEAR: Reset zona validasi setelah berhasil
      setPenerimaNama("");
      setTandaTanganValidasi("");
      setPreviewUrl(null);
      setUploadedImage(null);

      // Scroll ke tabel untuk lihat hasil
      setTimeout(() => {
        const tableElement = document.querySelector('[class*="Riwayat"]');
        if (tableElement) {
          tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

    } catch (error) {
      toast.dismiss();
      toast.error("❌ Gagal memproses dokumen");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = (id: number) => {
    setScanRecords(scanRecords.filter((record) => record.id !== id));
    toast.success("Record dihapus");
  };

  const handleEdit = (id: number, keterangan: string) => {
    setEditingId(id);
    setEditingKeterangan(keterangan);
  };

  const handleSaveEdit = (id: number) => {
    setScanRecords(
      scanRecords.map((record) =>
        record.id === id ? { ...record, keterangan: editingKeterangan } : record
      )
    );
    setEditingId(null);
    setEditingKeterangan("");
    toast.success("Perubahan disimpan");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingKeterangan("");
  };

  const handleStatusChange = (id: number, status: ScanRecord["status"]) => {
    setScanRecords(
      scanRecords.map((record) =>
        record.id === id ? { ...record, status } : record
      )
    );
  };

  // Filter logic
  const filteredRecords = scanRecords.filter((record) => {
    const recordDate = new Date(record.tanggal);
    const day = recordDate.getDate();
    const month = recordDate.getMonth() + 1;
    const year = recordDate.getFullYear();

    const dayMatch = filterDay === "all" || day === parseInt(filterDay);
    const monthMatch = filterMonth === "all" || month === parseInt(filterMonth);
    const yearMatch = filterYear === "all" || year === parseInt(filterYear);

    return dayMatch && monthMatch && yearMatch;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold">dgtnz.wtf</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Scan & digitize dokumen dengan OCR
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <Card className="p-4 sm:p-6">
        <h3 className="font-medium mb-4 text-sm sm:text-base">Upload Gambar</h3>

        <div className="space-y-4">
          {/* Image Upload */}
          <div className="border-2 border-dashed border-border rounded-xl p-4 sm:p-8 text-center hover:border-foreground/20 transition-colors">
            <input
              type="file"
              id="imageUpload"
              className="hidden"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={isProcessing}
            />
            <label htmlFor="imageUpload" className="cursor-pointer block">
              {previewUrl ? (
                <div className="space-y-3">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-32 sm:max-h-48 mx-auto rounded-lg"
                  />
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Klik untuk ganti gambar
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const link = document.createElement('a');
                        link.href = previewUrl;
                        link.download = uploadedImage?.name || 'preview.jpg';
                        link.click();
                        toast.success('Gambar berhasil di-download!');
                      }}
                    >
                      <FileDown className="h-3 w-3" />
                      Download
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground" />
                  <p className="text-sm sm:text-base font-medium">
                    Klik untuk upload gambar
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    PNG, JPG, TIFF, PDF (Max 10MB)
                  </p>
                </div>
              )}
            </label>
          </div>

          {isProcessing && (
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <div className="animate-spin h-4 w-4 border-2 border-foreground border-t-transparent rounded-full" />
              <span>Processing dengan Tesseract + OpenAI...</span>
            </div>
          )}
        </div>
      </Card>

      {/* Zona Validasi - Flow: Nama → TTD (Lock) → Tombol Scan */}
      <Card className="p-3 sm:p-4 md:p-6">
        <div className="mb-3 sm:mb-4">
          <h3 className="font-semibold text-base sm:text-lg">📝 Zona Validasi</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Isi nama penerima dan tanda tangan untuk memproses scan</p>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {/* Nama Penerima */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="penerima" className="text-xs sm:text-sm font-medium">Nama Penerima *</Label>
            <Input
              id="penerima"
              value={penerimaNama}
              onChange={(e) => setPenerimaNama(e.target.value)}
              placeholder="Masukkan nama penerima"
              className="w-full text-sm h-9 sm:h-10"
              disabled={isProcessing}
            />
          </div>

          {/* Tanda Tangan - BEBAS EDIT kapan saja */}
          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm font-medium">Tanda Tangan *</Label>
            <div className="w-full overflow-hidden rounded-lg border">
              <SignatureCanvas
                value={tandaTanganValidasi}
                onChange={setTandaTanganValidasi}
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Tombol Proses Scan - di bawah zona validasi */}
          <div className="pt-3 sm:pt-4 border-t">
            <Button
              onClick={handleProcessScan}
              disabled={isProcessing || !uploadedImage || !penerimaNama.trim() || !tandaTanganValidasi}
              className="w-full text-sm sm:text-base h-10 sm:h-11 font-medium"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  <span className="text-sm sm:text-base">Processing...</span>
                </>
              ) : (
                <>🚀 Proses Scan</>
              )}
            </Button>
            {(!penerimaNama.trim() || !tandaTanganValidasi) && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 text-center">
                {!penerimaNama.trim() ? "⚠️ Isi nama penerima terlebih dahulu" : "⚠️ Buat tanda tangan terlebih dahulu"}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Tabel Data Excel-like */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-sm sm:text-base">Riwayat Scan</h3>
          <div className="flex gap-2">
            <Button
              onClick={handleExportExcel}
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              disabled={filteredRecords.length === 0}
            >
              <FileDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export Excel</span>
            </Button>
            <Button
              onClick={handleExportGDrive}
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              disabled={filteredRecords.length === 0}
            >
              <Cloud className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export to GDrive</span>
            </Button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 pb-4 border-b">
          <div className="space-y-1.5">
            <Label htmlFor="filterDay" className="text-xs">Tanggal</Label>
            <select
              id="filterDay"
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-md border border-input bg-background"
            >
              <option value="all">Semua</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filterMonth" className="text-xs">Bulan</Label>
            <select
              id="filterMonth"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-md border border-input bg-background"
            >
              <option value="all">Semua</option>
              {[
                { value: 1, label: "Januari" },
                { value: 2, label: "Februari" },
                { value: 3, label: "Maret" },
                { value: 4, label: "April" },
                { value: 5, label: "Mei" },
                { value: 6, label: "Juni" },
                { value: 7, label: "Juli" },
                { value: 8, label: "Agustus" },
                { value: 9, label: "September" },
                { value: 10, label: "Oktober" },
                { value: 11, label: "November" },
                { value: 12, label: "Desember" },
              ].map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filterYear" className="text-xs">Tahun</Label>
            <select
              id="filterYear"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-md border border-input bg-background"
            >
              <option value="all">Semua</option>
              {Array.from({ length: 11 }, (_, i) => 2020 + i).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border bg-muted/50">
                  <th className="text-left p-2 sm:p-3 text-xs font-semibold whitespace-nowrap">
                    No
                  </th>
                  <th className="text-left p-2 sm:p-3 text-xs font-semibold whitespace-nowrap">
                    Tanggal
                  </th>
                  <th className="text-left p-2 sm:p-3 text-xs font-semibold whitespace-nowrap">
                    Nama Penerima
                  </th>
                  <th className="text-left p-2 sm:p-3 text-xs font-semibold whitespace-nowrap min-w-[200px]">
                    Keterangan
                  </th>
                  <th className="text-left p-2 sm:p-3 text-xs font-semibold whitespace-nowrap">
                    Foto (Link)
                  </th>
                  <th className="text-left p-2 sm:p-3 text-xs font-semibold whitespace-nowrap">
                    Tanda Tangan
                  </th>
                  <th className="text-left p-2 sm:p-3 text-xs font-semibold whitespace-nowrap">
                    Status
                  </th>
                  <th className="text-center p-2 sm:p-3 text-xs font-semibold whitespace-nowrap">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">
                      {scanRecords.length === 0 ? "Belum ada data scan" : "Tidak ada data yang sesuai dengan filter"}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, idx) => (
                    <tr
                      key={record.id}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-2 sm:p-3 text-xs sm:text-sm">{idx + 1}</td>
                      <td className="p-2 sm:p-3 text-xs sm:text-sm">{record.tanggal}</td>
                      <td className="p-2 sm:p-3 text-xs sm:text-sm">{record.namaPenerima}</td>
                      <td className="p-2 sm:p-3 text-xs sm:text-sm">
                        {editingId === record.id ? (
                          <Textarea
                            value={editingKeterangan}
                            onChange={(e) => setEditingKeterangan(e.target.value)}
                            className="min-h-[60px] text-xs min-w-[200px]"
                          />
                        ) : (
                          <div className="max-w-[250px] line-clamp-2">
                            {record.keterangan}
                          </div>
                        )}
                      </td>
                      <td className="p-2 sm:p-3">
                        {record.fotoUrl && record.fotoUrl !== "-" ? (
                          <a
                            href={record.fotoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                            title={record.fotoUrl}
                          >
                            <img
                              src={record.fotoUrl}
                              alt="Foto scan"
                              className="w-16 h-16 object-cover rounded border hover:scale-105 transition-transform cursor-pointer"
                              loading="lazy"
                              onError={(e) => {
                                console.error('Failed to load image:', record.fotoUrl);
                                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect fill="%23ddd" width="64" height="64"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="10"%3ENo Image%3C/text%3E%3C/svg%3E';
                              }}
                              onLoad={() => {
                                console.log('Image loaded successfully:', record.fotoUrl);
                              }}
                            />
                          </a>
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded border flex items-center justify-center">
                            <span className="text-[10px] text-gray-400">No Image</span>
                          </div>
                        )}
                      </td>
                      <td className="p-2 sm:p-3">
                        {record.tandaTangan && record.tandaTangan !== "-" ? (
                          <a
                            href={record.tandaTangan}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                            title={record.tandaTangan}
                          >
                            <img
                              src={record.tandaTangan}
                              alt="Tanda tangan"
                              className="w-16 h-16 object-cover rounded border hover:scale-105 transition-transform cursor-pointer bg-white"
                              loading="lazy"
                              onError={(e) => {
                                console.error('Failed to load signature:', record.tandaTangan);
                                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect fill="%23ddd" width="64" height="64"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="10"%3ENo Sign%3C/text%3E%3C/svg%3E';
                              }}
                              onLoad={() => {
                                console.log('Signature loaded successfully:', record.tandaTangan);
                              }}
                            />
                          </a>
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded border flex items-center justify-center">
                            <span className="text-[10px] text-gray-400">No Sign</span>
                          </div>
                        )}
                      </td>
                      <td className="p-2 sm:p-3">
                        <select
                          value={record.status}
                          onChange={(e) =>
                            handleStatusChange(
                              record.id,
                              e.target.value as ScanRecord["status"]
                            )
                          }
                          disabled={editingId === record.id}
                          className={`text-xs rounded-full px-2 py-1 border-0 font-medium cursor-pointer ${record.status === "approved"
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : record.status === "rejected"
                              ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                            }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td className="p-2 sm:p-3">
                        <div className="flex items-center justify-center gap-1">
                          {editingId === record.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleSaveEdit(record.id)}
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEdit(record.id, record.keterangan)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(record.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {scanRecords.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm sm:text-base">Belum ada data scan</p>
            <p className="text-xs sm:text-sm">
              Upload gambar untuk memulai scanning
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default DgtnzTab;
