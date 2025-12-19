// ... (Bagian import sama, tambahkan ShieldCheck jika belum ada)

export default function Index() {
  // ... (State & Fetch logic sama)

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-zinc-950 font-sans pb-20">
      <Header user={user} onLogout={handleLogout} onProfile={() => navigate('/profile')} onSettings={() => navigate('/settings')} />

      <main className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800">
                <h2 className="text-xl font-bold mb-1 italic">Halo, {user?.name?.split(" ")[0]}</h2>
                <p className="text-slate-500 text-xs">Aktivitas akun Anda terpantau normal.</p>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 flex items-center gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600"><FileText className="w-5 h-5"/></div>
                <div><p className="text-xs text-slate-500 font-medium uppercase tracking-tighter">Database Logs</p><p className="text-xl font-bold">{logs.length} Dokumen</p></div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 flex items-center gap-4">
                <div className={`p-3 rounded-xl ${user?.resetInfo?.color === 'red' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    <ShieldCheck className="w-5 h-5"/>
                </div>
                <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-tighter">Status Tagihan</p>
                    <p className={`text-sm font-bold ${user?.resetInfo?.color === 'red' ? 'text-red-600' : 'text-green-600'}`}>
                        Reset: {user?.resetInfo?.nextResetDate || "-"}
                    </p>
                </div>
            </div>
        </div>
        {/* ... Rest of UI (Upload & Table) ... */}
      </main>
    </div>
  );
}
