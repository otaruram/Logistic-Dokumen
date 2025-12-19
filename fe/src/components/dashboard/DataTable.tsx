import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-service";
import { toast } from "sonner";
import { Download } from "lucide-react";

// WAJIB ADA KATA 'DEFAULT' DI SINI
export default function DataTable({ logs, user }: { logs: any[], user: any }) {
  
  const handleExport = async () => {
    try {
      const response = await apiFetch("/export-excel", { 
        method: "POST",
        headers: { "Authorization": `Bearer ${user.credential}` }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OCR_Export_${new Date().getTime()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel berhasil diunduh!");
    } catch (e) {
      toast.error("Gagal export file.");
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-100 dark:border-zinc-800">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold uppercase text-xs tracking-widest opacity-50">Riwayat Scan</h3>
        <Button onClick={handleExport} size="sm" className="rounded-xl bg-black dark:bg-white dark:text-black">
          <Download className="w-4 h-4 mr-2" /> Export
        </Button>
      </div>
      {/* Isi Tabel Mas di sini */}
    </div>
  );
}
