import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, HardDrive, Image as ImageIcon, Save, CheckCircle2, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api-service";
import { toast } from "sonner";

export default function DataTable({ logs, onDeleteLog, onUpdateLog }: { logs: any[], onDeleteLog: (id: number) => void, onUpdateLog: (id: number, summary: string) => void }) {
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [searchDate, setSearchDate] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [tempSummary, setTempSummary] = useState("");

  // --- LOGIC FILTER ---
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const date = new Date(log.date);
      const monthMatch = filterMonth === "all" || (date.getMonth() + 1).toString() === filterMonth;
      const dateMatch = !searchDate || log.date.includes(searchDate);
      return monthMatch && dateMatch;
    });
  }, [logs, filterMonth, searchDate]);

  // --- LOGIC EXPORT (GDRIVE -> FALLBACK EXCEL) ---
  const handleExportProcess = async () => {
    toast.promise(async () => {
      try {
        // 1. Coba Export ke GDrive
        const driveRes = await apiFetch("/export-drive", { method: "POST" });
        if (driveRes.ok) return "Berhasil simpan di Google Drive!";

        // 2. Fallback ke Local Excel Download jika GDrive gagal
        const excelRes = await apiFetch("/export-excel", { method: "POST" });
        const blob = await excelRes.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `OCR_Report_${new Date().getTime()}.xlsx`;
        a.click();
        return "Drive penuh/error. File diunduh secara lokal.";
      } catch (e) { throw new Error("Semua metode export gagal."); }
    }, { loading: "Memproses export...", success: (m) => m, error: (e) => e.message });
  };

  return (
    <div className="space-y-4">
      {/* FILTER BAR */}
      <div className="flex flex-wrap gap-3 bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800">
        <div className="flex-1 min-w-[200px]">
          <Input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} className="bg-white dark:bg-zinc-900" />
        </div>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900">
            <SelectValue placeholder="Pilih Bulan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Bulan</SelectItem>
            {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((m, i) => (
              <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleExportProcess} variant="default" className="bg-blue-600 hover:bg-blue-700">
          <HardDrive className="w-4 h-4 mr-2" /> Export
        </Button>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-zinc-800/50">
            <TableRow>
              <TableHead className="w-12 text-[10px] font-black uppercase tracking-widest text-center">No</TableHead>
              <TableHead className="w-32 text-[10px] font-black uppercase tracking-widest text-center">Waktu</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Keterangan (Editable)</TableHead>
              <TableHead className="w-24 text-[10px] font-black uppercase tracking-widest text-center">Status</TableHead>
              <TableHead className="w-20 text-right text-[10px] font-black uppercase tracking-widest">Foto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log, index) => (
              <TableRow key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                <TableCell className="text-center text-xs font-bold text-slate-400">{index + 1}</TableCell>
                <TableCell className="text-center">
                    <div className="text-xs font-bold">{log.date}</div>
                    <div className="text-[10px] text-slate-400">{log.time}</div>
                </TableCell>
                <TableCell>
                  {editId === log.id ? (
                    <div className="flex gap-2">
                      <Input value={tempSummary} onChange={(e) => setTempSummary(e.target.value)} className="h-8 text-xs" />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => { onUpdateLog(log.id, tempSummary); setEditId(null); }}>
                        <Save className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="group flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[300px]">{log.summary || "Tidak ada keterangan"}</span>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-6 px-2 text-[10px]" onClick={() => { setEditId(log.id); setTempSummary(log.summary); }}>Edit</Button>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" /> SUCCESS
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600" onClick={() => window.open(log.imageUrl, '_blank')}>
                    <ImageIcon className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredLogs.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center gap-2 opacity-30">
            <Clock className="w-10 h-10" />
            <p className="text-xs font-bold uppercase tracking-widest">Belum ada data di bulan ini</p>
          </div>
        )}
      </div>
    </div>
  );
}
