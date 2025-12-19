import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Image as ImageIcon } from "lucide-react";
import { apiFetch } from "@/lib/api-service";
import { toast } from "sonner";

export default function DataTable({ logs }: { logs: any[] }) {
  const handleExport = async () => {
    try {
      const response = await apiFetch("/export-excel", { method: "POST" });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OCR_Report.xlsx`;
      document.body.appendChild(a);
      a.click();
      toast.success("Excel Berhasil Diunduh!");
    } catch (e) { toast.error("Gagal export."); }
  };

  return (
    <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
      <div className="p-4 flex justify-between items-center border-b">
        <h3 className="text-xs font-bold uppercase text-zinc-400">Database History</h3>
        <Button onClick={handleExport} size="sm" variant="outline"><Download className="w-4 h-4 mr-2" /> Export</Button>
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead className="text-[10px] font-bold uppercase">Tanggal</TableHead>
          <TableHead className="text-[10px] font-bold uppercase">Summary</TableHead>
          <TableHead className="text-right text-[10px] font-bold uppercase">Foto</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="text-xs">{new Date(log.timestamp).toLocaleDateString()}</TableCell>
              <TableCell className="text-xs truncate max-w-[150px]">{log.summary}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => window.open(log.imagePath, '_blank')}><ImageIcon className="w-4 h-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
