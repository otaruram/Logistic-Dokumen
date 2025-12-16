import { useState } from "react";
import { Search, Trash2, CloudUpload, Pencil, Save, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-service";

interface DataTableProps {
  logs: any[];
  onDeleteLog: (id: number) => void;
  onUpdateLog: (id: number, summary: string) => void;
}

const DataTable = ({ logs, onDeleteLog, onUpdateLog }: DataTableProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editingSummary, setEditingSummary] = useState("");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const filteredLogs = logs.filter((log) => 
    (log.docType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.receiver || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.summary || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditClick = (log: any) => { setEditingLogId(log.id); setEditingSummary(log.summary); };
  const handleSaveEdit = async () => { if (editingLogId) { await onUpdateLog(editingLogId, editingSummary); setEditingLogId(null); } };

  // --- LOGIC EXPORT DRIVE BARU ---
  const handleDriveUpload = async () => {
    if (logs.length === 0) return toast({ title: "Data kosong", variant: "destructive" });

    // Cek apakah user mengizinkan Drive saat login
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (!user.isDriveEnabled) {
      toast({ 
        title: "Akses Ditolak", 
        description: "Anda belum mengizinkan akses Drive. Silakan Logout dan centang izin Drive saat Login.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      // Kirim Access Token (user.credential) ke Backend
      const response = await apiFetch('/export?upload_to_drive=true', {
        headers: { "Authorization": `Bearer ${user.credential}` }
      });
      
      const res = await response.json();
      
      if (res.status === 'success' && res.drive_url) {
        toast({ title: "Sukses!", description: "File tersimpan di Google Drive." });
        window.open(res.drive_url, '_blank');
      } else {
        toast({ title: "Gagal", description: res.message || "Gagal upload.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Koneksi bermasalah.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // --- LOGIC DOWNLOAD BIASA ---
  const handleDownloadExcel = async () => {
    if (logs.length === 0) return toast({ title: "Data kosong", variant: "destructive" });
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    
    // Download biasa tidak butuh akses Drive, cukup token profile biasa
    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/export?upload_to_drive=false`, {
            method: 'GET',
            headers: { "Authorization": `Bearer ${user?.credential}` }
        });
        if(response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = `Laporan_OCR.xlsx`; document.body.appendChild(a); a.click(); a.remove();
        }
    } catch {}
  };

  return (
    <div className="brutal-border overflow-hidden bg-white mt-6 mb-20">
      <div className="bg-black text-white px-4 py-3 flex justify-between items-center gap-2">
        <h2 className="font-bold uppercase tracking-wide text-xs md:text-sm">LOG HARIAN</h2>
        
        <div className="flex gap-2">
            {/* Tombol Download Biasa (Selalu Ada) */}
            <Button variant="ghost" size="sm" onClick={handleDownloadExcel} className="bg-white text-black h-8 w-8 p-0 hover:bg-gray-200">
                <Download className="w-4 h-4" />
            </Button>

            {/* Tombol Export Drive (Mewah) */}
            <Button variant="outline" size="sm" onClick={handleDriveUpload} disabled={isUploading} className="text-black bg-yellow-400 h-8 text-[10px] md:text-xs font-bold border-2 border-white hover:bg-yellow-500 hover:text-black">
            {isUploading ? "..." : <><CloudUpload className="w-3 h-3 mr-2" /> DRIVE</>}
            </Button>
        </div>
      </div>

      <div className="p-4 bg-gray-50 border-b-2 border-black">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text" placeholder="Cari dokumen..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border-2 border-black focus:outline-none focus:ring-0 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-100 border-b-2 border-black">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-black uppercase w-10 border-r border-black">No</th>
              <th className="px-4 py-2 text-left text-xs font-black uppercase w-24 border-r border-black">Tanggal</th>
              <th className="px-4 py-2 text-left text-xs font-black uppercase w-32 border-r border-black">Foto</th>
              <th className="px-4 py-2 text-left text-xs font-black uppercase border-r border-black">Ringkasan</th>
              <th className="px-4 py-2 text-center text-xs font-black uppercase w-24">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log, index) => (
              <tr key={log.id} className="border-b border-black hover:bg-yellow-50 transition-colors">
                <td className="px-4 py-3 text-sm font-bold border-r border-black">{index + 1}</td>
                <td className="px-4 py-3 text-xs font-mono border-r border-black">{log.date}<br/>{log.time}</td>
                <td className="px-4 py-3 border-r border-black">
                  {log.imageUrl ? (
                    <div className="relative group w-16 h-10">
                        <img 
                            src={log.imageUrl} alt="Doc" 
                            className="w-full h-full object-cover border border-black cursor-pointer"
                            onClick={() => setZoomedImage(log.imageUrl)}
                            onError={(e) => (e.currentTarget.src = "https://placehold.co/100x60?text=Error")}
                        />
                    </div>
                  ) : "-"}
                </td>
                <td className="px-4 py-3 text-sm border-r border-black">
                  {editingLogId === log.id ? (
                    <div className="flex gap-2">
                      <input value={editingSummary} onChange={(e) => setEditingSummary(e.target.value)} className="w-full border border-black p-1 text-sm" autoFocus />
                      <button onClick={handleSaveEdit} className="bg-green-500 text-white p-1 border border-black"><Save className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div>
                      <div className="font-bold uppercase text-xs">{log.docType}</div>
                      <div className="text-gray-600 text-xs line-clamp-2">{log.summary}</div>
                      <div className="text-[10px] bg-gray-200 inline-block px-1 mt-1 border border-black">{log.receiver}</div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEditClick(log)} className="h-8 w-8 p-0 border border-black hover:bg-yellow-200"><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => onDeleteLog(log.id)} className="h-8 w-8 p-0 border border-black hover:bg-red-200 text-red-600"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {zoomedImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setZoomedImage(null)}>
          <div className="relative max-w-full max-h-full">
            <img src={zoomedImage} className="max-w-full max-h-[85vh] border-4 border-white shadow-[0_0_20px_rgba(0,0,0,0.5)]" />
            <button className="absolute -top-12 right-0 text-white font-bold bg-red-600 px-4 py-2 border-2 border-white hover:bg-red-700">TUTUP [X]</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
