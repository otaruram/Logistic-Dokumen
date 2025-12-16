import { useState } from "react";
import { Search, Trash2, CloudUpload, Pencil, Save, Clock, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-service";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

  // --- STATE FILTER ---
  const [filterDay, setFilterDay] = useState("ALL");
  const [filterMonth, setFilterMonth] = useState("ALL");
  const [filterYear, setFilterYear] = useState("ALL");
  
  // 🔥 STATE WAKTU DETAIL (JAM, MENIT, DETIK)
  const [filterHour, setFilterHour] = useState("ALL");
  const [filterMinute, setFilterMinute] = useState("ALL");
  const [filterSecond, setFilterSecond] = useState("ALL");
  const [isTimeOpen, setIsTimeOpen] = useState(false);

  // Generator Data Dropdown
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const years = Array.from({ length: 5 }, (_, i) => (2025 - i).toString()); 
  
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')); 
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const seconds = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // --- LOGIKA FILTERING ---
  const filteredLogs = logs.filter((log) => {
    // 1. Search
    const matchSearch = 
      (log.docType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.receiver || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.summary || "").toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Date Parsing
    const [y, m, d] = (log.date || "0000-00-00").split("-");
    
    // 3. Time Parsing (Format HH:mm:ss)
    const timeParts = (log.time || "00:00:00").split(":");
    const logH = timeParts[0] || "";
    const logM = timeParts[1] || "";
    const logS = timeParts[2] || "";

    // 4. Matching Logic
    const matchDay = filterDay === "ALL" || parseInt(d).toString() === filterDay;
    const matchMonth = filterMonth === "ALL" || parseInt(m).toString() === (parseInt(filterMonth) + 1).toString();
    const matchYear = filterYear === "ALL" || y === filterYear;

    // 🔥 Match Waktu Detail
    const matchHour = filterHour === "ALL" || logH === filterHour;
    const matchMinute = filterMinute === "ALL" || logM === filterMinute;
    const matchSecond = filterSecond === "ALL" || logS === filterSecond;

    return matchSearch && matchDay && matchMonth && matchYear && matchHour && matchMinute && matchSecond;
  });

  const resetTimeFilter = () => {
    setFilterHour("ALL");
    setFilterMinute("ALL");
    setFilterSecond("ALL");
    setIsTimeOpen(false);
  };

  // Cek apakah ada filter waktu aktif untuk styling tombol
  const isTimeFilterActive = filterHour !== "ALL" || filterMinute !== "ALL" || filterSecond !== "ALL";

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
    <div className="brutal-border overflow-hidden bg-white dark:bg-zinc-900 mt-6 mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
      
      {/* Header Tabel */}
      <div className="bg-black dark:bg-zinc-950 text-white px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-3">
        <h2 className="font-bold uppercase tracking-wide text-xs md:text-sm">LOG HARIAN</h2>
        
        <Button variant="outline" size="sm" onClick={handleDriveUpload} disabled={isUploading} className="text-black bg-yellow-400 h-8 text-[10px] md:text-xs font-bold border-2 border-white hover:bg-yellow-500 hover:text-black w-full md:w-auto transition-transform hover:scale-105 active:scale-95">
            {isUploading ? "..." : <><CloudUpload className="w-3 h-3 mr-2" /> EXPORT DRIVE</>}
        </Button>
      </div>

      {/* --- AREA FILTER (6 KOLOM) --- */}
      <div className="p-4 bg-gray-50 dark:bg-zinc-900 border-b-2 border-black dark:border-white grid grid-cols-2 md:grid-cols-6 gap-3">
        
        {/* Search */}
        <div className="relative col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input 
            type="text" placeholder="Cari..." 
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full pl-9 pr-2 py-1.5 border-2 border-black dark:border-white text-xs font-bold focus:outline-none bg-white dark:bg-zinc-800 dark:text-white transition-colors" 
          />
        </div>

        {/* Filter Tanggal */}
        <select value={filterDay} onChange={(e) => setFilterDay(e.target.value)} className="border-2 border-black dark:border-white py-1.5 px-2 text-xs font-bold bg-white dark:bg-zinc-800 dark:text-white focus:outline-none cursor-pointer hover:bg-yellow-50 dark:hover:bg-zinc-700">
          <option value="ALL">TGL</option>
          {days.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* Filter Bulan */}
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="border-2 border-black dark:border-white py-1.5 px-2 text-xs font-bold bg-white dark:bg-zinc-800 dark:text-white focus:outline-none cursor-pointer hover:bg-yellow-50 dark:hover:bg-zinc-700">
          <option value="ALL">BLN</option>
          {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>

        {/* Filter Tahun */}
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="border-2 border-black dark:border-white py-1.5 px-2 text-xs font-bold bg-white dark:bg-zinc-800 dark:text-white focus:outline-none cursor-pointer hover:bg-yellow-50 dark:hover:bg-zinc-700">
          <option value="ALL">THN</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* 🔥 FILTER WAKTU (POP-UP CARD) 🔥 */}
        <Popover open={isTimeOpen} onOpenChange={setIsTimeOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className={`w-full justify-between border-2 border-black dark:border-white h-[34px] px-2 text-xs font-bold hover:bg-yellow-50 dark:hover:bg-zinc-700 transition-colors ${isTimeFilterActive ? "bg-black text-white dark:bg-white dark:text-black" : "bg-white dark:bg-zinc-800 dark:text-white"}`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                <span>
                   {isTimeFilterActive ? `${filterHour}:${filterMinute}` : "JAM"}
                </span>
              </div>
              {isTimeFilterActive && <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
            </Button>
          </PopoverTrigger>
          
          <PopoverContent className="w-72 brutal-border border-4 border-black dark:border-white shadow-[6px_6px_0px_0px_black] dark:shadow-[6px_6px_0px_0px_white] p-0 bg-white dark:bg-zinc-900" align="end">
            
            {/* Header Pop-up */}
            <div className="bg-black dark:bg-white text-white dark:text-black p-3 flex justify-between items-center border-b-4 border-black dark:border-white">
              <span className="font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                <Filter className="w-3 h-3" /> ATUR WAKTU
              </span>
              {isTimeFilterActive && (
                 <button onClick={resetTimeFilter} className="text-[10px] font-bold hover:text-red-500 underline">RESET</button>
              )}
            </div>

            {/* Body Pop-up (Grid 3 Kolom) */}
            <div className="p-4 grid grid-cols-3 gap-3 bg-white dark:bg-zinc-900">
               
               {/* 1. JAM */}
               <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-bold uppercase text-center dark:text-white">JAM</label>
                 <select 
                    value={filterHour} 
                    onChange={(e) => setFilterHour(e.target.value)}
                    className="border-2 border-black dark:border-white p-1 text-center font-bold text-sm bg-gray-50 dark:bg-zinc-800 dark:text-white focus:bg-yellow-100 dark:focus:bg-zinc-700 focus:outline-none"
                    size={5} // Tampilan List Scroll
                 >
                    <option value="ALL" className="font-mono text-xs py-1">--</option>
                    {hours.map(h => <option key={h} value={h} className="font-mono py-1">{h}</option>)}
                 </select>
               </div>

               {/* 2. MENIT */}
               <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-bold uppercase text-center dark:text-white">MNT</label>
                 <select 
                    value={filterMinute} 
                    onChange={(e) => setFilterMinute(e.target.value)}
                    className="border-2 border-black dark:border-white p-1 text-center font-bold text-sm bg-gray-50 dark:bg-zinc-800 dark:text-white focus:bg-yellow-100 dark:focus:bg-zinc-700 focus:outline-none"
                    size={5}
                 >
                    <option value="ALL" className="font-mono text-xs py-1">--</option>
                    {minutes.map(m => <option key={m} value={m} className="font-mono py-1">{m}</option>)}
                 </select>
               </div>

               {/* 3. DETIK */}
               <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-bold uppercase text-center dark:text-white">DTK</label>
                 <select 
                    value={filterSecond} 
                    onChange={(e) => setFilterSecond(e.target.value)}
                    className="border-2 border-black dark:border-white p-1 text-center font-bold text-sm bg-gray-50 dark:bg-zinc-800 dark:text-white focus:bg-yellow-100 dark:focus:bg-zinc-700 focus:outline-none"
                    size={5}
                 >
                    <option value="ALL" className="font-mono text-xs py-1">--</option>
                    {seconds.map(s => <option key={s} value={s} className="font-mono py-1">{s}</option>)}
                 </select>
               </div>
            </div>

            {/* Footer Pop-up */}
            <div className="p-2 border-t-2 border-black dark:border-white bg-gray-100 dark:bg-zinc-950 text-center">
               <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                  {isTimeFilterActive ? "Filter Aktif" : "Pilih waktu spesifik"}
               </span>
            </div>

          </PopoverContent>
        </Popover>

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
