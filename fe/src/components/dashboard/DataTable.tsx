import { useState } from "react";
import { Search, Trash2, CloudUpload, Pencil, Save, Download, FileText, FileSpreadsheet, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-service";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [isDownloading, setIsDownloading] = useState(false);

  // Filter Log
  const filteredLogs = logs.filter((log) => 
    (log.docType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.receiver || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.summary || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditClick = (log: any) => { setEditingLogId(log.id); setEditingSummary(log.summary); };
  const handleSaveEdit = async () => { if (editingLogId) { await onUpdateLog(editingLogId, editingSummary); setEditingLogId(null); } };

  // --- 1. EXPORT DRIVE (Login Khusus) ---
  const handleDriveUpload = async () => {
    if (logs.length === 0) return toast({ title: "Data kosong", variant: "destructive" });
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    
    // Cek Izin Drive
    if (!user.isDriveEnabled) return toast({ title: "Akses Ditolak", description: "Login ulang & centang izin Drive.", variant: "destructive" });
    
    setIsUploading(true);
    try {
      const response = await apiFetch('/export?upload_to_drive=true&format=excel', {
        headers: { "Authorization": `Bearer ${user.credential}` }
      });
      const res = await response.json();
      if (res.status === 'success' && res.drive_url) {
        toast({ title: "Sukses!", description: "Tersimpan di Google Drive." });
        window.open(res.drive_url, '_blank');
      } else {
        toast({ title: "Gagal", description: res.message, variant: "destructive" });
      }
    } catch { toast({ title: "Error", variant: "destructive" }); } 
    finally { setIsUploading(false); }
  };

  // --- 2. DOWNLOAD LOKAL (EXCEL / PDF) ---
  const handleDownload = async (format: 'excel' | 'pdf') => {
    if (logs.length === 0) return toast({ title: "Data kosong", variant: "destructive" });
    setIsDownloading(true);
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    
    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/export?upload_to_drive=false&format=${format}`, {
            method: 'GET',
            headers: { "Authorization": `Bearer ${user?.credential}` }
        });
        
        if(response.ok) {
            const blob = await response.blob();
            
            // 🔥 CEK ERROR: JANGAN DOWNLOAD KALAU ISINYA HTML (ERROR PAGE) 🔥
            if (blob.type.includes('text/html')) {
                throw new Error("Server Error (Backend Crash). Cek Logs.");
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); 
            a.href = url;
            const ext = format === 'excel' ? 'xlsx' : 'pdf';
            a.download = `Laporan_OCR.${ext}`; 
            document.body.appendChild(a); a.click(); a.remove();
            toast({ title: "Berhasil", description: `Laporan ${format.toUpperCase()} diunduh.` });
        } else {
            toast({ title: "Gagal", description: "Gagal download file.", variant: "destructive" });
        }
    } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
        setIsDownloading(false);
    }
  };

  return (
    <div className="brutal-border overflow-hidden bg-white mt-6 mb-20">
      <div className="bg-black text-white px-4 py-3 flex justify-between items-center gap-2">
        <h2 className="font-bold uppercase tracking-wide text-xs md:text-sm">LOG HARIAN</h2>
        
        <div className="flex gap-2">
            {/* DROPDOWN MENU DOWNLOAD */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={isDownloading} className="bg-white text-black h-8 px-3 hover:bg-gray-200 border-2 border-transparent hover:border-white font-bold text-[10px] md:text-xs">
                    {isDownloading ? "..." : <><Download className="w-3 h-3 mr-1" /> UNDUH <ChevronDown className="w-3 h-3 ml-1" /></>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="brutal-border border-2 border-black bg-white rounded-none shadow-[4px_4px_0px_0px_black]" align="end">
                <DropdownMenuItem onClick={() => handleDownload('excel')} className="cursor-pointer hover:bg-green-100 font-bold">
                    <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('pdf')} className="cursor-pointer hover:bg-red-100 font-bold">
                    <FileText className="w-4 h-4 mr-2 text-red-600" /> PDF (.pdf)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* TOMBOL EXPORT DRIVE */}
            <Button variant="outline" size="sm" onClick={handleDriveUpload} disabled={isUploading} className="text-black bg-yellow-400 h-8 text-[10px] md:text-xs font-bold border-2 border-white hover:bg-yellow-500 hover:text-black">
                {isUploading ? "..." : <><CloudUpload className="w-3 h-3 mr-2" /> DRIVE</>}
            </Button>
        </div>
      </div>

      <div className="p-4 bg-gray-50 border-b-2 border-black">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Cari dokumen..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border-2 border-black focus:outline-none focus:ring-0 text-sm" />
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
                        <img src={log.imageUrl} alt="Doc" className="w-full h-full object-cover border border-black cursor-pointer" onClick={() => setZoomedImage(log.imageUrl)} onError={(e) => (e.currentTarget.src = "https://placehold.co/100x60?text=Error")} />
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
