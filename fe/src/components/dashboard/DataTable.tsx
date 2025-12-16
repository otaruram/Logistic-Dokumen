import { useState } from "react";
import { Search, Trash2, CloudUpload, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-config";

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

  const filteredLogs = logs.filter((log) => 
    (log.docType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.receiver || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.summary || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditClick = (log: any) => {
    setEditingLogId(log.id);
    setEditingSummary(log.summary);
  };

  // 🔥 ACTION SAVE YANG DIINGINKAN
  const handleSaveEdit = async () => {
    if (editingLogId) {
      await onUpdateLog(editingLogId, editingSummary);
      setEditingLogId(null);
      // Toast sudah di-handle di Index.tsx
    }
  };

  const handleDriveUpload = async () => {
    if (logs.length === 0) return toast({ title: "Data kosong", variant: "destructive" });
    setIsUploading(true);
    try {
      const user = JSON.parse(sessionStorage.getItem('user') || '{}');
      const response = await apiFetch('/export?upload_to_drive=true', {
        headers: { "Authorization": `Bearer ${user?.credential}` }
      });
      const res = await response.json();
      if (res.status === 'success') {
        toast({ title: "Sukses Export", description: "File terupload ke Drive." });
        window.open(res.drive_url, '_blank');
      } else {
        toast({ title: "Gagal", description: res.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Cek koneksi internet", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="brutal-border overflow-hidden bg-white mt-6">
      <div className="bg-black text-white px-4 py-3 flex justify-between items-center">
        <h2 className="font-bold uppercase tracking-wide text-sm">LOG HARIAN</h2>
        <Button variant="outline" size="sm" onClick={handleDriveUpload} disabled={isUploading} className="text-black bg-white h-8 text-xs font-bold">
          {isUploading ? "LOADING..." : <><CloudUpload className="w-3 h-3 mr-2" /> EXPORT DRIVE</>}
        </Button>
      </div>

      <div className="p-4 bg-gray-50 border-b-2 border-black">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text" placeholder="Cari..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border-2 border-black focus:outline-none focus:ring-0 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-100 border-b-2 border-black">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-black uppercase w-10 border-r border-black">No</th>
              <th className="px-4 py-2 text-left text-xs font-black uppercase w-24 border-r border-black">Tanggal</th>
              <th className="px-4 py-2 text-left text-xs font-black uppercase w-32 border-r border-black">Foto</th>
              <th className="px-4 py-2 text-left text-xs font-black uppercase border-r border-black">Keterangan</th>
              <th className="px-4 py-2 text-center text-xs font-black uppercase w-24">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log, index) => (
              <tr key={log.id} className="border-b border-black hover:bg-yellow-50">
                <td className="px-4 py-3 text-sm font-bold border-r border-black">{index + 1}</td>
                <td className="px-4 py-3 text-xs font-mono border-r border-black">{log.date}<br/>{log.time}</td>
                <td className="px-4 py-3 border-r border-black">
                  {log.imageUrl ? (
                    <img src={log.imageUrl} onClick={() => setZoomedImage(log.imageUrl)} className="w-16 h-10 object-cover border border-black cursor-pointer" />
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
                      <div className="text-gray-600">{log.summary}</div>
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
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-[80vh] border-2 border-white" />
        </div>
      )}
    </div>
  );
};

export default DataTable;
