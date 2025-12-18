import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Trash2, FileEdit, ExternalLink, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-service";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Log {
  id: number;
  date: string;
  time: string;
  docType: string;
  summary: string;
  receiver?: string;
  imageUrl: string;
}

interface DataTableProps {
  logs: Log[];
  onDeleteLog: (id: number) => void;
  onUpdateLog: (id: number, summary: string) => void;
}

export default function DataTable({ logs, onDeleteLog, onUpdateLog }: DataTableProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [newSummary, setNewSummary] = useState("");

  // --- LOGIKA EXPORT KE DRIVE BOT ---
  const handleExport = async () => {
    if (logs.length === 0) {
      toast.error("Tidak ada data untuk diexport.");
      return;
    }

    setIsExporting(true);
    toast.info("Sedang membuat laporan Excel Rapi...", { duration: 3000 });

    try {
      // Panggil API Export
      const res = await apiFetch("/export-excel", { method: "POST" });
      const json = await res.json();

      if (json.status === "success" && json.link) {
        toast.success("Laporan Siap!", {
          description: "Membuka Google Drive...",
        });
        
        // BUKA LINK GOOGLE DRIVE DI TAB BARU
        window.open(json.link, "_blank");
      } else {
        toast.error("Gagal Export", {
          description: json.message || "Terjadi kesalahan server.",
        });
      }
    } catch (e) {
      toast.error("Kesalahan Koneksi");
    } finally {
      setIsExporting(false);
    }
  };

  const openEdit = (log: Log) => {
    setEditingLog(log);
    setNewSummary(log.summary);
  };

  const saveEdit = () => {
    if (editingLog) {
      onUpdateLog(editingLog.id, newSummary);
      setEditingLog(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER TABLE & TOMBOL EXPORT */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          Menampilkan {logs.length} dokumen terbaru
        </div>
        <Button 
          onClick={handleExport} 
          disabled={isExporting || logs.length === 0}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isExporting ? (
            <>⏳ Memproses Excel...</>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" /> Export ke Excel
            </>
          )}
        </Button>
      </div>

      {/* TABEL DATA */}
      <div className="rounded-md border border-slate-200 dark:border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-zinc-900">
            <TableRow>
              <TableHead className="w-[100px]">Tanggal</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Penerima</TableHead>
              <TableHead className="w-[40%]">Ringkasan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                  Belum ada data scan.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{log.date}</span>
                      <span className="text-xs text-slate-400">{log.time}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
                      {log.docType}
                    </Badge>
                  </TableCell>
                  <TableCell className="uppercase text-xs font-bold text-slate-600 dark:text-slate-400">
                    {log.receiver || "-"}
                  </TableCell>
                  <TableCell>
                    <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300" title={log.summary}>
                      {log.summary}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => window.open(log.imageUrl, '_blank')} title="Lihat Foto">
                        <ImageIcon className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(log)} title="Edit Ringkasan">
                        <FileEdit className="h-4 w-4 text-orange-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDeleteLog(log.id)} title="Hapus">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* DIALOG EDIT RINGKASAN */}
      <Dialog open={!!editingLog} onOpenChange={(open) => !open && setEditingLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Ringkasan</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="summary">Ringkasan AI</Label>
              <Input
                id="summary"
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLog(null)}>Batal</Button>
            <Button onClick={saveEdit}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
