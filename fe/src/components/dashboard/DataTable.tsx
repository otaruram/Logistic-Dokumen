import { useState, useMemo } from "react";
import { Search, Trash2, CloudUpload, Pencil, Save, Clock, ImageIcon, FileText } from "lucide-react";
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

  // --- FILTER STATES ---
  const [filterDay, setFilterDay] = useState("ALL");
  const [filterMonth, setFilterMonth] = useState("ALL");
  const [filterYear, setFilterYear] = useState("ALL");
  const [filterHour, setFilterHour] = useState("ALL");
  const [filterMinute, setFilterMinute] = useState("ALL");

  // --- DATA GENERATOR (Auto Realtime) ---
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // --- FILTER LOGIC ---
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Search Logic
      const matchSearch = 
        (log.docType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.receiver || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.summary || "").toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Date Parsing (Asumsi format: YYYY-MM-DD)
      const [y, m, d] = (log.date || "0000-00-00").split("-");
      const timeParts = (log.time || "00:00:00").split(":"); // HH:mm:ss
      
      // 3. Match Filters
      const matchDay = filterDay === "ALL" || d === filterDay;
      // Note: Month di data "01" sampe "12", filterMonth index 0-11. Jadi (index+1) di-pad.
      const matchMonth = filterMonth === "ALL" || m === (parseInt(filterMonth) + 1).toString().padStart(2, '0');
      const matchYear = filterYear === "ALL" || y === filterYear;
      
      const matchHour = filterHour === "ALL" || timeParts[0] === filterHour;
      const matchMinute = filterMinute === "ALL" || timeParts[1] === filterMinute;

      return matchSearch && matchDay && matchMonth && matchYear && matchHour && matchMinute;
    });
  }, [logs, searchQuery, filterDay, filterMonth, filterYear, filterHour, filterMinute]);

  const handleSaveEdit = async () => { if (editingLogId) { await onUpdateLog(editingLogId, editingSummary); setEditingLogId(null); } };
  const handleEditClick = (log: any) => { setEditingLogId(log.id); setEditingSummary(log.summary); };

  const handleDriveUpload = async () => {
    if (filteredLogs.length === 0) return toast.error("Tidak ada data untuk di-export.");
    setIsUploading(true);
    try {
      const user = JSON.parse(sessionStorage.getItem('user') || '{}');
      const response = await apiFetch('/export?upload_to_drive=true&format=excel', {
        headers: { "Authorization": `Bearer ${user.credential}` }
      });
      const res = await response.json();
      if (res.status === 'success' && res.drive_url) {
        toast.success("Berhasil Export ke Drive!");
        window.open(res.drive_url, '_blank');
      } else { toast.error("Gagal Upload"); }
    } catch { toast.error("Terjadi kesalahan sistem"); } 
    finally { setIsUploading(false); }
  };

  return (
    <div className="w-full space-y-4">
      {/* --- TOOLBAR & FILTER --- */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
        
        {/* Baris 1: Search & Export */}
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
            <div className="relative w-full md:w-1/2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                    type="text" placeholder="Cari No. Dokumen, Penerima, Ringkasan..." 
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-black/5" 
                />
            </div>
            <Button onClick={handleDriveUpload} disabled={isUploading} className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-10 text-xs font-bold w-full md:w-auto">
                {isUploading ? <span className="animate-pulse">Mengupload...</span> : <><CloudUpload className="w-3.5 h-3.5 mr-2" /> EXPORT EXCEL</>}
            </Button>
        </div>

        {/* Baris 2: Filter Dropdowns (Grid di HP, Flex di PC) */}
        <div className="grid grid-cols-2 md:flex gap-2">
            
            {/* TGL */}
            <select value={filterDay} onChange={(e) => setFilterDay(e.target.value)} className="p-2 rounded-lg bg-gray-50 dark:bg-zinc-800 text-sm border-none cursor-pointer">
                <option value="ALL">Tgl Semua</option>
                {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            {/* BLN */}
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="p-2 rounded-lg bg-gray-50 dark:bg-zinc-800 text-sm border-none cursor-pointer">
                <option value="ALL">Bln Semua</option>
                {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>

            {/* THN */}
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="p-2 rounded-lg bg-gray-50 dark:bg-zinc-800 text-sm border-none cursor-pointer">
                <option value="ALL">Thn Semua</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            {/* JAM (Popover) */}
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="border-none bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 h-9 md:h-auto col-span-1">
                        <Clock className="w-3.5 h-3.5 mr-2" />
                        {filterHour !== "ALL" ? `${filterHour}:${filterMinute !== "ALL" ? filterMinute : '00'}` : "Jam"}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 rounded-xl border-gray-100 dark:border-zinc-700">
                    <div className="flex gap-2">
                        <select value={filterHour} onChange={(e) => setFilterHour(e.target.value)} className="w-full p-2 bg-gray-50 rounded text-sm"><option value="ALL">Jam</option>{hours.map(h => <option key={h} value={h}>{h}</option>)}</select>
                        <select value={filterMinute} onChange={(e) => setFilterMinute(e.target.value)} className="w-full p-2 bg-gray-50 rounded text-sm"><option value="ALL">Menit</option>{minutes.map(m => <option key={m} value={m}>{m}</option>)}</select>
                    </div>
                </PopoverContent>
            </Popover>

            {/* Reset Filter Button */}
            {(filterDay !== "ALL" || filterMonth !== "ALL" || filterYear !== "ALL" || filterHour !== "ALL") && (
                <Button variant="ghost" onClick={() => { setFilterDay("ALL"); setFilterMonth("ALL"); setFilterYear("ALL"); setFilterHour("ALL"); setFilterMinute("ALL"); }} className="text-red-500 hover:text-red-600 hover:bg-red-50 h-9 md:h-auto col-span-2 md:col-span-1">
                    Reset
                </Button>
            )}
        </div>
      </div>

      {/* --- TABEL SCROLLABLE --- */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
        
        {/* 🔥 PENTING: overflow-x-auto DISINI AGAR BISA DIGESER */}
        <div className="overflow-x-auto w-full"> 
            <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 font-medium">
                <tr>
                <th className="px-6 py-4 w-16">No</th>
                <th className="px-6 py-4">Waktu</th>
                <th className="px-6 py-4">Foto</th>
                <th className="px-6 py-4">Dokumen</th>
                <th className="px-6 py-4">Ringkasan AI</th>
                <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                {filteredLogs.length > 0 ? (
                filteredLogs.map((log, index) => (
                    <tr key={log.id} className="hover:bg-blue-50/30 dark:hover:bg-zinc-800/50 transition-colors group">
                    <td className="px-6 py-4 text-gray-400">{index + 1}</td>
                    <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 dark:text-white">{log.time}</div>
                        <div className="text-xs text-gray-400">{log.date}</div>
                    </td>
                    <td className="px-6 py-4">
                        {log.imageUrl ? (
                        <div onClick={() => setZoomedImage(log.imageUrl)} className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden cursor-pointer hover:ring-2 ring-blue-500 transition-all">
                            <img src={log.imageUrl} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                        ) : <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-300" /></div>}
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md w-fit mb-1">{log.docType}</span>
                            <span className="text-xs text-gray-500">To: {log.receiver}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs whitespace-normal">
                        {editingLogId === log.id ? (
                        <div className="flex gap-2">
                            <textarea value={editingSummary} onChange={(e) => setEditingSummary(e.target.value)} className="w-full border rounded-lg px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500" rows={2} autoFocus />
                            <Button size="icon" className="h-8 w-8 shrink-0 bg-green-500 hover:bg-green-600" onClick={handleSaveEdit}><Save className="w-3 h-3 text-white" /></Button>
                        </div>
                        ) : (
                        <div className="text-gray-600 dark:text-gray-300 text-sm leading-snug line-clamp-2" title={log.summary}>
                            {log.summary || "-"}
                        </div>
                        )}
                    </td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(log)} className="h-8 w-8 hover:bg-yellow-50 hover:text-yellow-600 rounded-lg"><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => onDeleteLog(log.id)} className="h-8 w-8 hover:bg-red-50 hover:text-red-600 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                    </td>
                    </tr>
                ))
                ) : (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 flex flex-col items-center justify-center gap-2"><FileText className="w-8 h-8 opacity-20" /><span>Tidak ada data ditemukan.</span></td></tr>
                )}
            </tbody>
            </table>
        </div>
      </div>

      {/* Image Zoom */}
      {zoomedImage && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-[85vh] rounded-xl shadow-2xl animate-in zoom-in-95" />
          <button className="absolute top-4 right-4 text-white/70 hover:text-white"><Trash2 className="w-8 h-8 rotate-45" /></button>
        </div>
      )}
    </div>
  );
};

export default DataTable;
