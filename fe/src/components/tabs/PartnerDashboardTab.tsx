import React from "react";
import { BarChart3, ShieldCheck, CheckCircle2, Mail, ArrowRight } from "lucide-react";

export default function PartnerDashboardTab({
  stats,
  setActiveView
}: {
  stats: any;
  setActiveView: (view: string) => void;
}) {
  const fmt = (n?: number) => (n == null ? "0" : new Intl.NumberFormat("id-ID").format(n));

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">OtaruChain Partner Dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          Ringkasan performa platform untuk partner dan shortcut cepat ke API.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total scans", value: stats ? fmt(stats.total_scans) : "...", icon: BarChart3 },
          { label: "Fraud prevented", value: stats ? fmt(stats.fraud_prevented) : "...", icon: ShieldCheck },
          { label: "Verified docs", value: stats ? fmt(stats.verified_scans) : "...", icon: CheckCircle2 },
          { label: "Integrity rate", value: stats ? `${stats.integrity_rate}%` : "...", icon: Mail },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{item.label}</p>
                <Icon className="h-4 w-4 text-zinc-500" />
              </div>
              <p className="mt-4 text-2xl font-semibold text-zinc-900">{item.value}</p>
            </div>
          );
        })}
      </div>

      {/* Gamification Consistency Tracker (Ecosystem Rules) */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-50/50 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Gamification & Zero-Tolerance Policy
            </h2>
            <p className="mt-1 text-sm text-blue-700/80">
              Kriteria Integrity Badge & Threshold per Bulan untuk Pengguna (Driver)
            </p>
          </div>
        </div>
        
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-4 border border-zinc-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <ShieldCheck className="w-12 h-12" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tier 1</p>
            <h3 className="text-xl font-bold text-slate-700 mt-1">Silver</h3>
            <p className="text-sm text-zinc-600 mt-2">50 - 149 Dokumen</p>
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-1">
              <p className="text-xs text-slate-600 flex justify-between"><span>Status:</span> <span className="font-medium">Trusted</span></p>
            </div>
          </div>
          
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-white p-4 border border-amber-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <ShieldCheck className="w-12 h-12 text-amber-600" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Tier 2</p>
            <h3 className="text-xl font-bold text-amber-700 mt-1">Gold</h3>
            <p className="text-sm text-zinc-600 mt-2">150 - 249 Dokumen</p>
            <div className="mt-4 pt-3 border-t border-amber-100 flex flex-col gap-1">
              <p className="text-xs text-amber-800 flex justify-between"><span>Status:</span> <span className="font-medium">Priority</span></p>
              <p className="text-xs text-amber-800 flex justify-between"><span>Bonus Plafon:</span> <span className="font-medium">+ Rp 1Jt</span></p>
              <p className="text-xs text-amber-800 flex justify-between"><span>Diskon Bunga:</span> <span className="font-medium">0.5%</span></p>
            </div>
          </div>
          
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-white p-4 border border-indigo-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <ShieldCheck className="w-12 h-12 text-indigo-600" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Tier 3</p>
            <h3 className="text-xl font-bold text-indigo-700 mt-1">Platinum</h3>
            <p className="text-sm text-zinc-600 mt-2">&ge; 250 Dokumen</p>
            <div className="mt-4 pt-3 border-t border-indigo-100 flex flex-col gap-1">
              <p className="text-xs text-indigo-800 flex justify-between"><span>Status:</span> <span className="font-medium">VIP</span></p>
              <p className="text-xs text-indigo-800 flex justify-between"><span>Bonus Plafon:</span> <span className="font-medium">+ Rp 2.5Jt</span></p>
              <p className="text-xs text-indigo-800 flex justify-between"><span>Diskon Bunga:</span> <span className="font-medium">1.0%</span></p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex gap-3 items-start">
          <div className="mt-0.5 w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <p className="text-xs text-red-800 leading-relaxed">
            <strong className="font-semibold">Zero-Tolerance Policy:</strong> Ditemukannya 1 (satu) dokumen terindikasi manipulasi (TAMPERED) dalam bulan berjalan akan secara otomatis membekukan progress tier dan membatalkan pemberian badge serta benefit untuk bulan tersebut.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="text-sm text-zinc-700">Lanjut ke pengelolaan API key dan docs.</p>
        <button
          onClick={() => setActiveView("api")}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Buka API Key <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
