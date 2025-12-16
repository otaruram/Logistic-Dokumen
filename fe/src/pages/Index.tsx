import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-service";
import Header from "@/components/dashboard/Header";
import FileUploadZone from "@/components/dashboard/FileUploadZone";
import DataTable from "@/components/dashboard/DataTable";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. LOAD DATA SAAT PERTAMA BUKA
  useEffect(() => {
    const loadData = async () => {
      try {
        // Cek Sesi Lokal
        const storedUser = sessionStorage.getItem('user');
        if (!storedUser) { navigate('/login'); return; }
        
        const localUser = JSON.parse(storedUser);
        
        // 🔥 FETCH PROFILE TERBARU DARI BACKEND (BIAR DATA SINKRON)
        const profileRes = await apiFetch("/me");
        const profileJson = await profileRes.json();
        
        if (profileJson.status === "success") {
            // Gabungkan data lokal dengan data terbaru dari server (Credit & CreatedAt)
            const updatedUser = { ...localUser, ...profileJson.data };
            setUser(updatedUser);
            sessionStorage.setItem('user', JSON.stringify(updatedUser)); // Simpan yang baru
        } else {
            setUser(localUser); // Fallback kalau server error
        }

        // Load History
        const historyRes = await apiFetch("/history");
        const historyData = await historyRes.json();
        if (Array.isArray(historyData)) {
            // Format data untuk tabel
            const formattedLogs = historyData.map((item: any) => ({
                id: item.id,
                date: item.timestamp.split("T")[0],
                time: new Date(item.timestamp).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                docType: item.kategori,
                summary: item.summary,
                receiver: item.receiver,
                imageUrl: item.imagePath
            }));
            setLogs(formattedLogs);
        }
      } catch (error) {
        console.error("Gagal load data:", error);
      }
    };
    loadData();
  }, [navigate]);

  // 2. FUNGSI SCAN DOKUMEN
  const handleScan = async (file: File) => {
    if (!user) return;
    
    // Cek kredit dulu di frontend biar gak buang kuota upload
    if (user.creditBalance < 1) {
        toast({ title: "Kredit Habis!", description: "Silakan topup atau tunggu besok.", variant: "destructive" });
        return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("receiver", user.name || "User");

    try {
      toast({ title: "Memproses...", description: "Sedang membaca dokumen (AI OCR)..." });
      
      const res = await apiFetch("/scan", {
        method: "POST",
        body: formData,
        timeout: 90000 // 90 Detik timeout
      });

      const json = await res.json();

      if (json.status === "success") {
        toast({ title: "Berhasil!", description: "Dokumen berhasil discan." });

        // 🔥 UPDATE KREDIT SECARA REALTIME (PENTING!)
        const newBalance = json.remaining_credits;
        const updatedUser = { ...user, creditBalance: newBalance };
        setUser(updatedUser);
        sessionStorage.setItem('user', JSON.stringify(updatedUser));

        // Tambah log baru ke tabel paling atas
        const newLog = {
            id: json.data.id,
            date: new Date().toISOString().split("T")[0],
            time: new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            docType: json.data.kategori,
            summary: json.data.summary,
            receiver: user.name,
            imageUrl: json.data.imagePath
        };
        setLogs(prev => [newLog, ...prev]);

      } else {
        throw new Error(json.message || "Gagal memproses gambar");
      }
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // 3. FUNGSI DELETE LOG
  const handleDeleteLog = async (id: number) => {
    if(!confirm("Yakin hapus log ini?")) return;
    try {
        await apiFetch(`/logs/${id}`, { method: "DELETE" });
        setLogs(prev => prev.filter(l => l.id !== id));
        toast({ title: "Terhapus", description: "Log berhasil dihapus." });
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
  };

  // 4. FUNGSI UPDATE LOG
  const handleUpdateLog = async (id: number, summary: string) => {
    try {
        await apiFetch(`/logs/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ summary })
        });
        setLogs(prev => prev.map(l => l.id === id ? { ...l, summary } : l));
        toast({ title: "Tersimpan", description: "Ringkasan diperbarui." });
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
  };

  if (!user) return <div className="flex h-screen items-center justify-center font-bold animate-pulse">MEMUAT DATA...</div>;

  return (
    <div className="min-h-screen bg-[#F4F4F0] dark:bg-black text-black dark:text-white font-sans transition-colors duration-300">
      <Header 
        user={user} 
        onLogout={() => { sessionStorage.clear(); navigate('/landing'); }} 
        onProfile={() => console.log("Profile")} 
        onSettings={() => navigate('/settings')} 
      />

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* ZONA INPUT */}
        <div className="brutal-border bg-white dark:bg-zinc-900 p-1">
            <div className="bg-black dark:bg-zinc-800 text-white p-2 mb-4">
                <h2 className="font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                    📦 ZONA INPUT {loading && <span className="animate-spin">⏳</span>}
                </h2>
            </div>
            
            <div className="p-4">
                <FileUploadZone onFileSelect={handleScan} />
            </div>
        </div>

        {/* TABEL DATA */}
        <DataTable 
            logs={logs} 
            onDeleteLog={handleDeleteLog} 
            onUpdateLog={handleUpdateLog} 
        />
      </main>
    </div>
  );
}
