import { useState } from "react";
import { Search, Trash2, CloudUpload, Pencil, Save, Clock, Filter, ChevronDown, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-service";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

  // Filter States
  const [filterDay, setFilterDay] = useState("ALL");
  const [filterHour, setFilterHour] = useState("ALL");
  const [filterMinute, setFilterMinute] = useState("ALL");
  
  // Data Generator
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // Logic Filter
  const filteredLogs = logs.filter((log) => {
    const matchSearch = 
      (log.docType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.receiver || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.summary || "").toLowerCase().includes(searchQuery.toLowerCase());

    const [y, m, d] = (log.date || "0000-00-00").split("-");
    const timeParts = (log.time || "00:00:00").split(":"); // HH:mm:ss
    
    const matchDay = filterDay === "ALL" || parseInt(d).toString() === filterDay;
    const matchHour = filterHour === "ALL" || timeParts[0] === filterHour;
    const matchMinute = filterMinute === "ALL" || timeParts[1] === filterMinute;

    return matchSearch && matchDay && matchHour && matchMinute;
  });

  const handleSaveEdit = async () => { if (editingLogId) { await onUpdateLog(editingLogId, editingSummary); setEditingLogId(null); } };
  const handleEditClick = (log: any) => { setEditingLogId(log.id); setEditingSummary(log.summary); };

  const handleDriveUpload = async () => {
    if (filteredLogs.length === 0) return toast.error("Data kosong");
    setIsUploading(true);
    try {
      const user = JSON.parse(sessionStorage.getItem('user') || '{}');
      const response = await apiFetch('/export?upload_to_drive=true&format=excel', {
        headers: { "Authorization": `Bearer ${user.credential}` }
      });
      const res = await response.json();
      if (res.status === 'success' && res.drive_url) {
        toast.success("Tersimpan di Google Drive!");
        window.open(res.drive_url, '_blank');
      } else { toast.error("Gagal Upload"); }
    } catch { toast.error("Terjadi kesalahan sistem"); } 
    finally { setIsUploading(false); }
  };

  return (
    <div className="w-full">
      {/* TOOLBAR */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" placeholder="Cari dokumen..." 
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10" 
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {/* Filter Jam Popover (Clean Style) */}
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="rounded-xl border-gray-200 dark:border-zinc-700 h-10 text-xs font-medium">
                        <Clock className="w-3.5 h-3.5 mr-2 text-gray-500" />
                        {filterHour !== "ALL" ? `${filterHour}:${filterMinute !== "ALL" ? filterMinute : '00'}` : "Filter Waktu"}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4 rounded-xl shadow-xl border-gray-100 dark:border-zinc-800" align="end">
                    <h4 className="text-xs font-bold uppercase text-gray-500 mb-3">Atur Waktu Spesifik</h4>
                    <div className="flex gap-2">
                        <select value={filterHour} onChange={(e) => setFilterHour(e.target.value)} className="w-full p-2 rounded-lg border text-sm bg-gray-50">
                            <option value="ALL">Jam</option>{hours.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <select value={filterMinute} onChange={(e) => setFilterMinute(e.target.value)} className="w-full p-2 rounded-lg border text-sm bg-gray-50">
                            <option value="ALL">Menit</option>{minutes.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </PopoverContent>
            </Popover>

            <Button onClick={handleDriveUpload} disabled={isUploading} className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-10 text-xs font-bold shadow-sm shadow-green-200 dark:shadow-none">
                {isUploading ? "..." : <><CloudUpload className="w-3.5 h-3.5 mr-2" /> EXPORT DRIVE</>}
            </Button>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 font-medium">
            <tr>
              <th className="px-6 py-4 w-16">No</th>
              <th className="px-6 py-4 w-32">Waktu</th>
              <th className="px-6 py-4 w-24">Foto</th>
              <th className="px-6 py-4">Detail Dokumen</th>
              <th className="px-6 py-4 text-center w-24">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log, index) => (
                <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-6 py-4 text-gray-400">{index + 1}</td>
                  <td className="px-6 py-4">
                     <div className="font-medium text-gray-900 dark:text-white">{log.time}</div>
                     <div className="text-xs text-gray-400">{log.date}</div>
                  </td>
                  <td className="px-6 py-4">
                    {log.imageUrl ? (
                      <div onClick={() => setZoomedImage(log.imageUrl)} className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden cursor-pointer hover:ring-2 ring-gray-200 transition-all">
                          <img src={log.imageUrl} className="w-full h-full object-cover" />
                      </div>
                    ) : <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-300" /></div>}
                  </td>
                  <td className="px-6 py-4">
                    {editingLogId === log.id ? (
                      <div className="flex gap-2">
                        <input value={editingSummary} onChange={(e) => setEditingSummary(e.target.value)} className="w-full border rounded-lg px-2 py-1 text-sm" autoFocus />
                        <Button size="sm" onClick={handleSaveEdit}><Save className="w-3 h-3" /></Button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">{log.docType}</span>
                            <span className="text-xs text-gray-400">by {log.receiver}</span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 line-clamp-1">{log.summary}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(log)} className="h-8 w-8 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-gray-500" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => onDeleteLog(log.id)} className="h-8 w-8 hover:bg-red-50 hover:text-red-600 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Tidak ada data ditemukan.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-[85vh] rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
};

export default DataTable;
