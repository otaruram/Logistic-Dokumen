import { useState } from "react";
import { Search, Trash2, CloudUpload, Pencil, Save } from "lucide-react";
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

  // STATE FILTER
  const [filterDay, setFilterDay] = useState("ALL");
  const [filterMonth, setFilterMonth] = useState("ALL");
  const [filterYear, setFilterYear] = useState("ALL");

  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const years = Array.from({ length: 21 }, (_, i) => (2020 + i).toString());

  // LOGIKA FILTER
  const filteredLogs = logs.filter((log) => {
    const matchSearch = 
      (log.docType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.receiver || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.summary || "").toLowerCase().includes(searchQuery.toLowerCase());

    const [y, m, d] = (log.date || "0000-00-00").split("-");
    const matchDay = filterDay === "ALL" || parseInt(d).toString() === filterDay;
    const matchMonth = filterMonth === "ALL" || parseInt(m).toString() === (parseInt(filterMonth) + 1).toString();
    const matchYear = filterYear === "ALL" || y === filterYear;

    return matchSearch && matchDay && matchMonth && matchYear;
  });

  const handleEditClick = (log: any) => { setEditingLogId(log.id); setEditingSummary(log.summary); };
  const handleSaveEdit = async () => { if (editingLogId) { await onUpdateLog(editingLogId, editingSummary); setEditingLogId(null); } };

  const handleDriveUpload = async () => {
    if (filteredLogs.length === 0) return toast({ title: "Data kosong", variant: "destructive" });
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
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

  return (
    // 🔥 ANIMASI MASUK TABEL (Slide Up) 🔥
    <div className="brutal-border overflow-hidden bg-white dark:bg-zinc-900 mt-6 mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
      
      {/* Header Tabel */}
      <div className="bg-black dark:bg-zinc-950 text-white px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-3">
        <h2 className="font-bold uppercase tracking-wide text-xs md:text-sm">LOG HARIAN</h2>
        
        <Button variant="outline" size="sm" onClick={handleDriveUpload} disabled={isUploading} className="text-black bg-yellow-400 h-8 text-[10px] md:text-xs font-bold border-2 border-white hover:bg-yellow-500 hover:text-black w-full md:w-auto transition-transform hover:scale-105 active:scale-95">
            {isUploading ? "..." : <><CloudUpload className="w-3 h-3 mr-2" /> EXPORT DRIVE</>}
        </Button>
      </div>

      {/* --- AREA FILTER (DARK MODE FIXED) --- */}
      <div className="p-4 bg-gray-50 dark:bg-zinc-900 border-b-2 border-black dark:border-white grid grid-cols-2 md:grid-cols-4 gap-3">
        
        <div className="relative col-span-2 md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input 
            type="text" placeholder="Cari..." 
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full pl-9 pr-2 py-1.5 border-2 border-black dark:border-white text-xs font-bold focus:outline-none bg-white dark:bg-zinc-800 dark:text-white transition-colors" 
          />
        </div>

        <select 
          value={filterDay} onChange={(e) => setFilterDay(e.target.value)}
          className="border-2 border-black dark:border-white py-1.5 px-2 text-xs font-bold bg-white dark:bg-zinc-800 dark:text-white focus:outline-none cursor-pointer hover:bg-yellow-50 dark:hover:bg-zinc-700 transition-colors"
        >
          <option value="ALL">TGL: SEMUA</option>
          {days.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select 
          value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
          className="border-2 border-black dark:border-white py-1.5 px-2 text-xs font-bold bg-white dark:bg-zinc-800 dark:text-white focus:outline-none cursor-pointer hover:bg-yellow-50 dark:hover:bg-zinc-700 transition-colors"
        >
          <option value="ALL">BLN: SEMUA</option>
          {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>

        <select 
          value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
          className="border-2 border-black dark:border-white py-1.5 px-2 text-xs font-bold bg-white dark:bg-zinc-800 dark:text-white focus:outline-none cursor-pointer hover:bg-yellow-50 dark:hover:bg-zinc-700 transition-colors"
        >
          <option value="ALL">THN: SEMUA</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-100 dark:bg-zinc-800 border-b-2 border-black dark:border-white">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-black uppercase w-10 border-r border-black dark:border-zinc-600 dark:text-white">No</th>
              <th className="px-4 py-2 text-left text-xs font-black uppercase w-24 border-r border-black dark:border-zinc-600 dark:text-white">Tanggal</th>
              <th className="px-4 py-2 text-left text-xs font-black uppercase w-32 border-r border-black dark:border-zinc-600 dark:text-white">Foto</th>
              <th className="px-4 py-2 text-left text-xs font-black uppercase border-r border-black dark:border-zinc-600 dark:text-white">Ringkasan</th>
              <th className="px-4 py-2 text-center text-xs font-black uppercase w-24 dark:text-white">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log, index) => (
                <tr key={log.id} className="border-b border-black dark:border-zinc-700 hover:bg-yellow-50 dark:hover:bg-zinc-800 transition-colors group">
                  <td className="px-4 py-3 text-sm font-bold border-r border-black dark:border-zinc-700 dark:text-gray-300">{index + 1}</td>
                  <td className="px-4 py-3 text-xs font-mono border-r border-black dark:border-zinc-700 dark:text-gray-300">{log.date}<br/>{log.time}</td>
                  <td className="px-4 py-3 border-r border-black dark:border-zinc-700">
                    {log.imageUrl ? (
                      <div className="relative w-16 h-10 overflow-hidden border border-black dark:border-white group-hover:scale-105 transition-transform">
                          <img src={log.imageUrl} alt="Doc" className="w-full h-full object-cover cursor-pointer" onClick={() => setZoomedImage(log.imageUrl)} onError={(e) => (e.currentTarget.src = "https://placehold.co/100x60?text=Error")} />
                      </div>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm border-r border-black dark:border-zinc-700 dark:text-gray-300">
                    {editingLogId === log.id ? (
                      <div className="flex gap-2">
                        <input value={editingSummary} onChange={(e) => setEditingSummary(e.target.value)} className="w-full border border-black p-1 text-sm dark:bg-zinc-800 dark:text-white" autoFocus />
                        <button onClick={handleSaveEdit} className="bg-green-500 text-white p-1 border border-black"><Save className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold uppercase text-xs dark:text-white">{log.docType}</div>
                        <div className="text-gray-600 dark:text-gray-400 text-xs line-clamp-2">{log.summary}</div>
                        <div className="text-[10px] bg-gray-200 dark:bg-zinc-700 dark:text-white inline-block px-1 mt-1 border border-black dark:border-gray-500">{log.receiver}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" onClick={() => handleEditClick(log)} className="h-8 w-8 p-0 border border-black dark:border-white hover:bg-yellow-200 dark:hover:bg-yellow-600 dark:text-white"><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => onDeleteLog(log.id)} className="h-8 w-8 p-0 border border-black dark:border-white hover:bg-red-200 dark:hover:bg-red-900 text-red-600 dark:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center py-8 font-mono text-gray-500 dark:text-gray-400 font-bold animate-pulse">
                   DATA TIDAK DITEMUKAN 🕵️‍♂️
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Zoom Modal */}
      {zoomedImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setZoomedImage(null)}>
          <div className="relative max-w-full max-h-full animate-in zoom-in-90 duration-300">
            <img src={zoomedImage} className="max-w-full max-h-[85vh] border-4 border-white shadow-[0_0_20px_rgba(0,0,0,0.5)]" />
            <button className="absolute -top-12 right-0 text-white font-bold bg-red-600 px-4 py-2 border-2 border-white hover:bg-red-700 transition-colors">TUTUP [X]</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
