import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-service";
import Header from "@/components/dashboard/Header";
import FileUploadZone from "@/components/dashboard/FileUploadZone";
import DataTable from "@/components/dashboard/DataTable";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { triggerCreditUpdate, triggerCreditUsage, showCreditWarning } from "@/event"; 
import { FileText, Clock, ShieldCheck } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  // --- FETCH DATA (SAMA SEPERTI SEBELUMNYA) ---
  const fetchUserProfile = async () => {
    try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) { navigate('/landing'); return; }
        const localUser = JSON.parse(storedUser);
        const token = localUser?.credential;
        if (!token) { navigate('/landing'); return; }

        if (!user) setUser(localUser);

        const profileRes = await apiFetch("/me", { headers: { "Authorization": `Bearer ${token}` } });
        if (profileRes.status === 401) { localStorage.clear(); navigate('/landing'); return; }

        if (profileRes.ok) {
            const profileJson = await profileRes.json();
            if (profileJson.status === "success") {
                const updatedUser = { ...localUser, ...profileJson.data };
                setUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                showCreditWarning(updatedUser.creditBalance);
            }
        } 

        const historyRes = await apiFetch("/history", { headers: { "Authorization": `Bearer ${token}` } });
        if (historyRes.ok) {
            const historyData = await historyRes.json();
            if (Array.isArray(historyData)) {
                setLogs(historyData.map((item: any) => ({
                    id: item.id,
                    date: item.timestamp.split("T")[0],
                    time: new Date(item.timestamp).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }),
                    docType: item.kategori,
                    summary: item.summary,
                    receiver: item.receiver,
                    imageUrl: item.imagePath
                })));
            }
        }
    } catch (e) { console.error("Sync Error:", e); } finally { setInitLoading(false); }
  };

  useEffect(() => { 
      fetchUserProfile();
      const handleCreditUpdate = () => fetchUserProfile();
      window.addEventListener('creditUpdated', handleCreditUpdate);
      return () => window.removeEventListener('creditUpdated', handleCreditUpdate);
  }, []);

  // --- LOGIC SCAN (SAMA) ---
  const handleScan = async (file: File) => {
    if (!user || user.creditBalance < 1) { toast.error("Kredit Habis!"); return; }
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("receiver", user.name || "User");

    try {
      toast.info("Sedang memproses dokumen...");
      const res = await apiFetch("/scan", { method: "POST", body: formData, headers: { "Authorization": `Bearer ${user.credential}` }, timeout: 90000 });
      if (!res.ok) throw new Error("Gagal");
      const json = await res.json();

      if (json.status === "success") {
        toast.success("Dokumen berhasil didigitalkan!");
        const newBalance = json.remaining_credits;
        setUser((prev:any) => { const u = { ...prev, creditBalance: newBalance }; localStorage.setItem('user', JSON.stringify(u)); return u; });
        triggerCreditUpdate();
        triggerCreditUsage('ocr_scan', `Scan: ${file.name}`);
        showCreditWarning(newBalance);
        if (json.data) {
            setLogs(prev => [{
                id: json.data.id,
                date: new Date().toISOString().split("T")[0],
                time: new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }),
                docType: json.data.kategori,
                summary: json.data.summary,
                receiver: user.name,
                imageUrl: json.data.imagePath
            }, ...prev]);
        }
      } else { throw new Error(json?.message); }
    } catch (error: any) { toast.error("Gagal Scan", { description: error.message }); } finally { setLoading(false); }
  };

  const handleDeleteLog = async (id: number) => {
    if(!confirm("Hapus?")) return;
    try { await apiFetch(`/logs/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${user.credential}` } }); setLogs(prev => prev.filter(l => l.id !== id)); toast.success("Dihapus."); } catch { toast.error("Gagal."); }
  };
  const handleUpdateLog = async (id: number, summary: string) => {
    try { await apiFetch(`/logs/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.credential}` }, body: JSON.stringify({ summary }) }); setLogs(prev => prev.map(l => l.id === id ? { ...l, summary } : l)); toast.success("Tersimpan."); } catch { toast.error("Gagal."); }
  };

  if (initLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950"><div className="animate-spin text-4xl">💠</div></div>;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-zinc-950 font-sans text-slate-900 dark:text-slate-50 pb-20">
      <Header user={user} onLogout={() => { localStorage.clear(); navigate('/landing'); }} onProfile={() => navigate('/profile')} onSettings={() => navigate('/settings')} />

      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {/* STATS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 flex flex-col justify-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">Halo, {user?.name?.split(" ")[0]}!</h2>
                <p className="text-slate-500 text-sm">Selamat datang kembali di workspace Anda.</p>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 flex items-center gap-4">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full text-blue-600">
                    <FileText className="w-6 h-6"/>
                </div>
                <div>
                    <p className="text-sm text-slate-500 font-medium">Total Dokumen</p>
                    <p className="text-2xl font-bold">{logs.length}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 flex items-center gap-4">
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full text-green-600">
                    <ShieldCheck className="w-6 h-6"/>
                </div>
                <div>
                    <p className="text-sm text-slate-500 font-medium">Status Akun</p>
                    <p className="text-lg font-bold text-green-600">Active / Free Tier</p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* KOLOM KIRI: UPLOAD */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-zinc-800 sticky top-24">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                             🚀 Upload Dokumen
                        </h3>
                        {loading && <span className="text-xs font-bold text-blue-600 animate-pulse">Scanning...</span>}
                    </div>
                    <FileUploadZone onFileSelect={handleScan} />
                    <p className="text-xs text-slate-400 mt-4 text-center">
                        Format: JPG, PNG. Max 5MB. <br/> Dokumen akan otomatis di-scan AI.
                    </p>
                </div>
            </div>

            {/* KOLOM KANAN: DATA TABLE */}
            <div className="lg:col-span-2">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-zinc-800 min-h-[500px]">
                    <div className="flex items-center gap-2 mb-6">
                        <Clock className="w-5 h-5 text-slate-400"/>
                        <h3 className="font-bold text-lg">Riwayat Digitalisasi</h3>
                    </div>
                    <div className="w-full overflow-hidden">
                         <DataTable logs={logs} onDeleteLog={handleDeleteLog} onUpdateLog={handleUpdateLog} />
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}
