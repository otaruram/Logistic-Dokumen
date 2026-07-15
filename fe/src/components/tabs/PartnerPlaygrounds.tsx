import React, { useState, useCallback } from "react";
import { ArrowRight, Search, CheckCircle2, AlertCircle, RefreshCw, Wand2, Loader2, Shield, User, FileCheck, Lock, ExternalLink } from "lucide-react";
import PartnerAuditView from "@/components/PartnerAuditView";
import { supabase } from "@/lib/supabaseClient";

export default function PartnerPlaygrounds({
  apiKey,
  decisionApiKey,
  API,
  fmtNominal
}: {
  apiKey: any;
  decisionApiKey?: any;
  API: string;
  fmtNominal: (n?: number) => string;
}) {


  const [decisionCariPhone, setDecisionCariPhone] = useState("");
  const [decisionCariLoading, setDecisionCariLoading] = useState(false);
  const [decisionCariError, setDecisionCariError] = useState<string | null>(null);
  const [decisionCariHasil, setDecisionCariHasil] = useState<any | null>(null);

  const [autoFillLoading, setAutoFillLoading] = useState(false);

  const handleAutoFill = useCallback(async () => {
    setAutoFillLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from("profiles").select("phone_number").eq("id", session.user.id).single();
      if (data?.phone_number) {
        setDecisionCariPhone(data.phone_number);
      }
    } catch {
      // ignore
    } finally {
      setAutoFillLoading(false);
    }
  }, []);

  const handleDecisionCari = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const phoneValue = decisionCariPhone.trim().replace(/\+62/, "0").replace(/[-\s]/g, "");
      if (!phoneValue || !decisionApiKey) return;
      if (!/^0\d{9,12}$/.test(phoneValue)) {
        setDecisionCariError("Nomor HP harus format 08xxxxxxxxxx (10-13 digit).");
        return;
      }

      setDecisionCariLoading(true);
      setDecisionCariError(null);
      setDecisionCariHasil(null);

      try {
        const response = await fetch(
          `${API}/api/v1/partner/unified-decision/${encodeURIComponent(phoneValue)}`,
          { headers: { "x-api-key": decisionApiKey?.key_value ?? "" } }
        );
        if (response.ok) {
          setDecisionCariHasil(await response.json());
        } else if (response.status === 404) {
          setDecisionCariError("User dengan nomor HP tersebut tidak ditemukan.");
        } else if (response.status === 401) {
          setDecisionCariError("API key tidak valid atau sudah tidak aktif.");
        } else if (response.status === 403) {
          const err = await response.json().catch(() => null);
          setDecisionCariError(err?.detail || "User belum memberikan consent data (UU PDP).");
        } else {
          setDecisionCariError("Terjadi error saat mengambil decision score.");
        }
      } catch {
        setDecisionCariError("Network error. Coba lagi.");
      } finally {
        setDecisionCariLoading(false);
      }
    },
    [decisionCariPhone, decisionApiKey, API]
  );

  if (!decisionApiKey) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-zinc-500">
        Generate API key terlebih dahulu untuk menggunakan Playgrounds.
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">Test Integration</h3>
        <button
          onClick={handleAutoFill}
          disabled={autoFillLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50 transition-colors"
        >
          {autoFillLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          Auto Fill
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-1">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Playground</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-900">Unified Decision Gate</h2>
          </div>
          <p className="mt-2 text-xs text-zinc-600">Gabungan chain + financial info menjadi 1 final grade & rekomendasi.</p>
        <form onSubmit={handleDecisionCari} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="tel"
            inputMode="numeric"
            maxLength={13}
            value={decisionCariPhone}
            onChange={(event) => setDecisionCariPhone(event.target.value.replace(/[^\d+]/g, "").slice(0, 13))}
            placeholder="08xxxx"
            className="w-full rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />
          <button
            type="submit"
            disabled={!decisionCariPhone || !decisionApiKey || decisionCariLoading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {decisionCariLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </form>

        {decisionCariError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {decisionCariError}
          </div>
        )}

        {decisionCariHasil && (() => {
          const d = decisionCariHasil;
          const fd = d.final_decision ?? {};
          const pd = d.personal_data ?? {};
          const kyc = d.kyc_media ?? {};
          const comp = d.compliance ?? {};
          const chain = d.otaruchain_metric ?? {};
          const fin = d.otarufinancial_metric ?? {};
          const tg = fd.trust_grade ?? "—";
          const gradeColor = tg === "A" || tg === "B" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                             tg === "C" ? "bg-amber-100 text-amber-800 border-amber-300" :
                             "bg-red-100 text-red-800 border-red-300";
          const recCode = fd.recommendation ?? "";
          const recColor = recCode === "LAYAK_KREDIT" ? "text-emerald-700" :
                           recCode === "RISIKO_MENENGAH" ? "text-amber-700" : "text-red-700";
          return (
          <div className="mt-4 space-y-3">
            {/* 🛡️ Compliance Banner */}
            <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-700">Legal & Compliance</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/80 px-3 py-2 text-center border border-indigo-100">
                  <p className="text-[10px] uppercase text-indigo-500 font-medium">UU PDP Consent</p>
                  <span className="inline-block mt-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{comp.consent_label || "GRANTED"}</span>
                </div>
                <div className="rounded-lg bg-white/80 px-3 py-2 text-center border border-indigo-100">
                  <p className="text-[10px] uppercase text-indigo-500 font-medium">OJK PKA Proxy</p>
                  <span className="inline-block mt-1 text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{comp.ojk_pka_proxy || "ACTIVE"}</span>
                </div>
                <div className="rounded-lg bg-white/80 px-3 py-2 text-center border border-indigo-100">
                  <p className="text-[10px] uppercase text-indigo-500 font-medium">Data Source</p>
                  <span className="inline-block mt-1 text-[10px] font-semibold text-zinc-700">{comp.data_source || "HRD Whitelist + Google Auth"}</span>
                </div>
              </div>
            </div>

            {/* 👤 KYC & Identity */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">Identitas Karyawan (Terverifikasi)</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><span className="text-zinc-500">Nama Lengkap:</span> <span className="font-semibold text-zinc-900">{pd.full_name || "—"}</span></div>
                <div><span className="text-zinc-500">No. Handphone:</span> <span className="font-mono text-zinc-900">{pd.phone_number || "—"}</span></div>
                <div className="col-span-2 flex items-center gap-2 mt-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600">Data Minimization Applied — Identitas divalidasi silang secara internal tanpa mengoleksi KTP/NIK baru.</span>
                </div>
              </div>
            </div>

            {/* 📊 Unified Metrics — Two Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileCheck className="h-4 w-4 text-teal-600" />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">Operational Integrity</span>
                </div>
                <div className="space-y-2">
                  {[
                    ["Terverifikasi Docs", chain.verified_docs ?? 0, "text-emerald-700"],
                    ["Memproses Docs", chain.processing_docs ?? 0, "text-amber-600"],
                    ["Dimanipulasi Docs", chain.tampered_docs ?? 0, "text-red-600"],
                    ["Fraud Flags", chain.fraud_flags ?? 0, "text-red-600"],
                  ].map(([label, val, cls]) => (
                    <div key={String(label)} className="flex justify-between text-sm"><span className="text-zinc-500">{label}</span><span className={`font-bold ${cls}`}>{String(val)}</span></div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">Financial Capacity</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">DSR Ratio</span><span className="font-bold text-amber-600">{fin.dsr_percent ?? 0}%</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">Terverifikasi Income</span><span className="font-bold text-zinc-900">{fmtNominal(fin.verified_income ?? 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">Active Installments</span><span className="font-bold text-zinc-900">{fmtNominal(fin.active_installments ?? 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">Plafon Aman</span><span className="font-bold text-emerald-600">{fmtNominal(fin.sisa_plafon ?? 0)}</span></div>
                </div>
              </div>
            </div>

            {/* ⚖️ Final Decision & Seal */}
            <div className="rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-zinc-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-4 w-4 text-zinc-700" />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">Final Decision & Cryptographic Seal</span>
              </div>
              <div className="flex items-center justify-between bg-white rounded-xl border border-zinc-200 p-4 mb-3 shadow-sm">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Trust Grade</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-extrabold border ${gradeColor}`}>{tg}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500 mb-1">Recommendation</p>
                  <span className={`text-sm font-bold ${recColor}`}>{recCode.replace(/_/g, " ")}</span>
                </div>
              </div>
              <p className="text-sm text-zinc-700 leading-relaxed mb-3">{fd.description || "—"}</p>
            </div>
          </div>
          );
        })()}
      </div>
      </div>
    </div>
  );
}
