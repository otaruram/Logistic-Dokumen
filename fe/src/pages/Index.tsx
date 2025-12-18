import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-service";
import Header from "@/components/dashboard/Header";
import FileUploadZone from "@/components/dashboard/FileUploadZone";
import DataTable from "@/components/dashboard/DataTable";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, Loader2 } from "lucide-react"; // Icon baru
import { Button } from "@/components/ui/button";

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false); // Loading state untuk export
  const [initLoading, setInitLoading] = useState(true);

  // --- 1. SETUP & FETCH DATA ---
  const fetchUserProfile = async () => {
    try {
        const storedUser = localStorage.getItem('user');
        
        if (!storedUser) { navigate('/landing'); return; }

        const localUser = JSON.parse(storedUser);
        const token = localUser?.credential;
        
        if (!token) { navigate('/landing'); return; }

        setUser(localUser);

        // Fetch Data Terbaru
        const profileRes = await apiFetch("/me", { 
            headers: { "Authorization": `Bearer ${token}` } 
        });
        
        if (profileRes.status === 401) {
            localStorage.clear();
            navigate('/landing');
            return;
        }

        if (profileRes.ok) {
            const profileJson = await profileRes.json();
            if (profileJson && profileJson.status === "success") {
                const updatedUser = { 
                    ...localUser, 
                    ...profileJson.data,
                    creditBalance: profileJson.data.creditBalance,
                    resetInfo: profileJson.data.resetInfo // Penting untuk notifikasi header
                };
                setUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
            }
        } 

        // Fetch History
        const historyRes = await apiFetch("/history", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (historyRes.ok) {
            const historyData = await historyRes.json();
            if (Array.isArray(historyData)) {
                const formattedLogs = historyData.map((item: any) => ({
                    id: item.id,
                    date: item.timestamp.split("T")[0],
                    time: new Date(item.timestamp).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }),
                    docType: item.kategori,
                    summary: item.summary,
                    receiver: item.receiver,
                    imageUrl: item.imagePath
                }));
                setLogs(formattedLogs);
            }
        }
    } catch (e) {
        console.error("Sync Error:", e);
    } finally {
        setInitLoading(false);
    }
  };

  useEffect(() => { fetchUserProfile(); }, []);

  // --- 2. LOGIKA SCAN ---
  const handleScan = async (file: File) => {
    if (!user) return;
    if (user.creditBalance < 1) {
        toast.error("Kredit Habis!", { description: "Tunggu reset otomatis atau hubungi admin." });
        return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("receiver", user.name || "User");

    try {
      toast.info("Memproses...", { description: "AI sedang membaca dokumen..." });
      
      const res = await apiFetch("/scan", {
        method: "POST",
        body: formData,
        headers: { "Authorization": `Bearer ${user.credential}` },
        timeout: 90000 
      });

      if (!res.ok) throw new Error(`Status Server: ${res.status}`);

      let json;
      try { json = await res.json(); } catch { throw new Error("Format respon tidak valid."); }

      if (json && json.status === "success") {
        toast.success("Berhasil!");
        
        // Update Kredit Realtime
        const newBalance = json.remaining_credits;
        setUser((prevUser: any) => {
            const updated = { ...prevUser, creditBalance: newBalance };
            localStorage.setItem('user', JSON.stringify(updated));
            return updated;
        });

        // Update Table Log
        if (json.data) {
            const newLog = {
                id: json.data.id,
                date: new Date().toISOString().split("T")[0],
                time: new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }),
                docType: json.data.kategori,
                summary: json.data.summary,
                receiver: user.name,
                imageUrl: json.data.imagePath
            };
            setLogs(prev => [newLog, ...prev]);
        }
      } else {
        throw new Error(json?.message || "Gagal memproses data.");
      }
    } catch (error: any) {
      toast.error("Gagal", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // 🔥 3. LOGIKA EXPORT EXCEL (BARU) 🔥
  const handleExport = async () => {
    if (logs.length === 0) {
        toast.error("Belum ada data untuk diexport.");
        return;
    }
    
    setExporting(true);
    toast.info("Membuat Laporan Excel...", { description: "Mohon tunggu sebentar." });

    try {
        const res = await apiFetch("/export-excel", {
            method: "POST",
            headers: { "Authorization": `Bearer ${user.credential}` }
        });

        const json = await res.json();
        
        if (json.status === "success") {
            toast.success("Export Berhasil!", {
                description: "File tersimpan di Google Drive.",
                action: {
                    label: "Buka File",
                    onClick: () => window.open(json.link, "_blank") // Buka link GDrive
                },
                duration: 5000,
            });
        } else {
            toast.error("Gagal Export", { description: json.message });
        }
    } catch (e) {
        toast.error("Error", { description: "Gagal terhubung ke server." });
    } finally {
        setExporting(false);
    }
  };

  // --- HELPER LAINNYA ---
  const handleDeleteLog = async (id: number) => {
    if(!confirm("Hapus data ini?")) return;
    try {
        await apiFetch(`/logs/${id}`, { 
            method: "DELETE",
            headers: { "Authorization": `Bearer ${user.credential}` }
        });
        setLogs(prev => prev.filter(l => l.id !== id));
        toast.success("Data dihapus.");
    } catch (e) { toast.error("Gagal menghapus."); }
  };

  const handleUpdateLog = async (id: number, summary: string) => {
    try {
        await apiFetch(`/logs/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.credential}` },
            body: JSON.stringify({ summary })
        });
        setLogs(prev => prev.map(l => l.id === id ? { ...l, summary } : l));
        toast.success("Tersimpan.");
    } catch (e) { toast.error("Gagal menyimpan."); }
  };

  if (initLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]"><div className="animate-spin text-2xl">⏳</div></div>;

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 font-sans text-[#1A1A1A] dark:text-white pb-20">
      <Header 
        user={user} 
        onLogout={() => { localStorage.clear(); navigate('/landing'); }} 
        onProfile={() => navigate('/profile')} 
        onSettings={() => navigate('/settings')} 
      />

      <main className="container mx-auto px-4 py-6 max-w-5xl flex flex-col gap-6">
        <div className="w-full text-left">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Halo, {user?.name?.split(" ")[0]} 👋</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Siap mendigitalkan dokumen?</p>
        </div>

        {/* INPUT ZONE */}
        <div className="w-full bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
                 <h2 className="font-bold text-lg">Input Dokumen</h2>
                 {loading && <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full animate-pulse">Memproses...</span>}
            </div>
            <div className="w-full">
                <FileUploadZone onFileSelect={handleScan} />
            </div>
        </div>

        {/* RIWAYAT & EXPORT */}
        <div className="w-full bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h2 className="font-bold text-lg">Riwayat Digitalisasi</h2>
                
                {/* 🔥 TOMBOL EXPORT EXCEL 🔥 */}
                <Button 
                    onClick={handleExport} 
                    disabled={exporting || logs.length === 0}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-full text-xs px-4"
                >
                    {exporting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                    )}
                    {exporting ? "MENGEKSPOR..." : "EXPORT KE EXCEL"}
                </Button>
            </div>

            <div className="w-full overflow-x-auto">
                 <div className="min-w-[600px]">
                    <DataTable logs={logs} onDeleteLog={handleDeleteLog} onUpdateLog={handleUpdateLog} />
                 </div>
            </div>
        </div>
      </main>
    </div>
  );
}
