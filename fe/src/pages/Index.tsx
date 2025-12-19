import { useState, useEffect } from "react";
import Header from "@/components/dashboard/Header";
import FileUploadZone from "@/components/dashboard/FileUploadZone";
import DataTable from "@/components/dashboard/DataTable";
import { apiFetch } from "@/lib/api-service";

export default function Index() {
  const [view, setView] = useState("dashboard");
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState([]);

  const loadData = async () => {
    const pRes = await apiFetch("/me");
    const pJson = await pRes.json();
    if (pJson.status === "success") setUser(pJson.data);
    
    const hRes = await apiFetch("/history");
    const hJson = await hRes.json();
    setLogs(hJson);
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="min-h-screen bg-zinc-50">
      <Header user={user} onLogout={() => {localStorage.clear(); window.location.href="/";}} onProfile={() => setView("profile")} onSettings={() => setView("settings")} />
      
      <main className="max-w-4xl mx-auto p-6">
        {view === "dashboard" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase">Usage Stats</h3>
                <p className="text-3xl font-black">{logs.length} Scanned</p>
            </div>
            <FileUploadZone onUploadSuccess={loadData} />
            <DataTable logs={logs} />
          </div>
        )}
        {view === "settings" && <div className="p-8 bg-white rounded-2xl border"><h2>Settings</h2><Button onClick={() => setView("dashboard")}>Back</Button></div>}
      </main>
    </div>
  );
}
