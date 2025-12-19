import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Image as ImageIcon } from "lucide-react";
import { apiFetch } from "@/lib/api-service";
import { toast } from "sonner";

export default function DataTable({ logs, user }: { logs: any[], user: any }) {
  
  const handleExport = async () => {
    try {
      const response = await apiFetch("/export-excel", { method: "POST" });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OCR_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel Berhasil Diunduh!");
    } catch (e) {
      toast.error("Gagal mengekspor data.");
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm font-sans">
      <div className="p-6 flex items-center justify-between border-b dark:border-zinc-800">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Database History</h3>
        <Button onClick={handleExport} size="sm" className="rounded-xl bg-black dark:bg-white dark:text-black">
          <Download className="w-4 h-4 mr-2" /> Export Excel
        </Button>
      </div>

      <Table>
        <TableHeader className="bg-slate-50 dark:bg-zinc-800/50">
          <TableRow>
            <TableHead className="text-[10px] font-bold uppercase">Tanggal</TableHead>
            <TableHead className="text-[10px] font-bold uppercase">Ringkasan</TableHead>
            <TableHead className="text-[10px] font-bold uppercase">Penerima</TableHead>
            <TableHead className="text-right text-[10px] font-bold uppercase">Foto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
              <TableCell className="text-xs font-medium">{new Date(log.timestamp).toLocaleDateString('id-ID')}</TableCell>
              <TableCell className="text-xs max-w-[200px] truncate opacity-70" title={log.summary}>{log.summary}</TableCell>
              <TableCell className="text-xs font-bold uppercase text-blue-600">{log.receiver || "-"}</TableCell>
              <TableCell className="text-right">
                {/* LINK FOTO DENGAN ICON */}
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => window.open(log.imagePath, '_blank')}
                    className="hover:text-blue-600"
                >
                    <ImageIcon className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
