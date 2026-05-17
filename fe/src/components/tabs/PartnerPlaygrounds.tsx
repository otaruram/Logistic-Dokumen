import React, { useState, useCallback } from "react";
import { ArrowRight, Search, CheckCircle2, AlertCircle, RefreshCw, Wand2, Loader2, Shield, User, FileCheck, Lock, ExternalLink } from "lucide-react";
import PartnerAuditView from "@/components/PartnerAuditView";
import { supabase } from "@/lib/supabaseClient";

export default function PartnerPlaygrounds({
  apiKey,
  financeApiKey,
  decisionApiKey,
  API,
  fmtNominal
}: {
  apiKey: any;
  financeApiKey: any;
  decisionApiKey?: any;
  API: string;
  fmtNominal: (n?: number) => string;
}) {
  const [chainSearchPhone, setChainSearchPhone] = useState("");
  const [chainSearchLoading, setChainSearchLoading] = useState(false);
  const [chainSearchError, setChainSearchError] = useState<string | null>(null);
  const [chainSearchResult, setChainSearchResult] = useState<any | null>(null);
  const [auditResult, setAuditResult] = useState<any | null>(null);

  const [financeSearchPhone, setFinanceSearchPhone] = useState("");
  const [financeSearchLoading, setFinanceSearchLoading] = useState(false);
  const [financeSearchError, setFinanceSearchError] = useState<string | null>(null);
  const [financeSearchResult, setFinanceSearchResult] = useState<any | null>(null);

  const [decisionSearchPhone, setDecisionSearchPhone] = useState("");
  const [decisionSearchLoading, setDecisionSearchLoading] = useState(false);
  const [decisionSearchError, setDecisionSearchError] = useState<string | null>(null);
  const [decisionSearchResult, setDecisionSearchResult] = useState<any | null>(null);

  const [autoFillLoading, setAutoFillLoading] = useState(false);

  const handleAutoFill = useCallback(async () => {
    setAutoFillLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from("profiles").select("phone_number").eq("id", session.user.id).single();
      if (data?.phone_number) {
        setChainSearchPhone(data.phone_number);
        setFinanceSearchPhone(data.phone_number);
        setDecisionSearchPhone(data.phone_number);
      }
    } catch {
      // ignore
    } finally {
      setAutoFillLoading(false);
    }
  }, []);

  if (!apiKey && !financeApiKey && !decisionApiKey) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-zinc-500">
        Generate API key terlebih dahulu untuk menggunakan Playgrounds.
      </div>
    );
  }

  const handleChainSearch = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const phoneValue = chainSearchPhone.trim().replace(/\+62/, "0").replace(/[-\s]/g, "");
      if (!phoneValue || !apiKey) return;

      if (!/^0\d{9,12}$/.test(phoneValue)) {
        setChainSearchError("Nomor HP harus format 08xxxxxxxxxx (10-13 digit).");
        return;
      }

      setChainSearchLoading(true);
      setChainSearchError(null);
      setChainSearchResult(null);
      setAuditResult(null);

      try {
        const auditResponse = await fetch(
          `${API}/api/partner/v1/user-audit-by-phone/${encodeURIComponent(phoneValue)}`,
          { headers: { "x-api-key": apiKey?.key_value ?? "" } }
        );

        if (auditResponse.ok) {
          const auditData = await auditResponse.json();
          setAuditResult(auditData);
          setChainSearchResult({
            email: auditData.user.email,
            user_id: auditData.user.user_id,
            trust_score: auditData.credit_score.lifetime_score,
            risk_label: auditData.risk.risk_level,
            total_scans: auditData.transactions.total,
            verified_scans: auditData.transactions.verified,
            tampered_scans: auditData.transactions.tampered,
            total_nominal: auditData.transactions.total_nominal,
            recent_scans: [],
          });
        } else if (auditResponse.status === 404) {
          setChainSearchError("User dengan nomor HP tersebut tidak ditemukan.");
        } else if (auditResponse.status === 401) {
          setChainSearchError("API key tidak valid atau sudah tidak aktif.");
        } else {
          const response = await fetch(
            `${API}/api/v1/scoring-by-phone/${encodeURIComponent(phoneValue)}`,
            { headers: { "x-api-key": apiKey?.key_value ?? "" } }
          );
          if (response.ok) {
            setChainSearchResult(await response.json());
          } else if (response.status === 404) {
            setChainSearchError("User dengan nomor HP tersebut tidak ditemukan.");
          } else {
            setChainSearchError("Terjadi error saat mengambil score.");
          }
        }
      } catch {
        setChainSearchError("Network error. Coba lagi.");
      } finally {
        setChainSearchLoading(false);
      }
    },
    [chainSearchPhone, apiKey, API]
  );

  const handleFinanceSearch = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const phoneValue = financeSearchPhone.trim().replace(/\+62/, "0").replace(/[-\s]/g, "");
      if (!phoneValue || !financeApiKey) return;
      if (!/^0\d{9,12}$/.test(phoneValue)) {
        setFinanceSearchError("Nomor HP harus format 08xxxxxxxxxx (10-13 digit).");
        return;
      }

      setFinanceSearchLoading(true);
      setFinanceSearchError(null);
      setFinanceSearchResult(null);

      try {
        const response = await fetch(
          `${API}/api/v1/finance/overview-by-phone/${encodeURIComponent(phoneValue)}`,
          { headers: { "x-api-key": financeApiKey?.key_value ?? "" } }
        );
        if (response.ok) {
          setFinanceSearchResult(await response.json());
        } else if (response.status === 404) {
          setFinanceSearchError("User dengan nomor HP tersebut tidak ditemukan.");
        } else if (response.status === 401) {
          setFinanceSearchError("API key tidak valid atau sudah tidak aktif.");
        } else {
          setFinanceSearchError("Terjadi error saat mengambil financial health.");
        }
      } catch {
        setFinanceSearchError("Network error. Coba lagi.");
      } finally {
        setFinanceSearchLoading(false);
      }
    },
    [financeSearchPhone, financeApiKey, API]
  );

  const handleDecisionSearch = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const phoneValue = decisionSearchPhone.trim().replace(/\+62/, "0").replace(/[-\s]/g, "");
      if (!phoneValue || !decisionApiKey) return;
      if (!/^0\d{9,12}$/.test(phoneValue)) {
        setDecisionSearchError("Nomor HP harus format 08xxxxxxxxxx (10-13 digit).");
        return;
      }

      setDecisionSearchLoading(true);
      setDecisionSearchError(null);
      setDecisionSearchResult(null);

      try {
        const response = await fetch(
          `${API}/api/v1/partner/unified-decision/${encodeURIComponent(phoneValue)}`,
          { headers: { "x-api-key": decisionApiKey?.key_value ?? "" } }
        );
        if (response.ok) {
          setDecisionSearchResult(await response.json());
        } else if (response.status === 404) {
          setDecisionSearchError("User dengan nomor HP tersebut tidak ditemukan.");
        } else if (response.status === 401) {
          setDecisionSearchError("API key tidak valid atau sudah tidak aktif.");
        } else if (response.status === 403) {
          const err = await response.json().catch(() => null);
          setDecisionSearchError(err?.detail || "User belum memberikan consent data (UU PDP).");
        } else {
          setDecisionSearchError("Terjadi error saat mengambil decision score.");
        }
      } catch {
        setDecisionSearchError("Network error. Coba lagi.");
      } finally {
        setDecisionSearchLoading(false);
      }
    },
    [decisionSearchPhone, decisionApiKey, API]
  );

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

      <div className="grid gap-5 lg:grid-cols-3">
      {/* OtaruChain Audit */}
      <div className="rounded-[2rem] border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Playground 1</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-900">OtaruChain Audit by Phone</h2>
          </div>
        </div>
        <form onSubmit={handleChainSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="tel"
            inputMode="numeric"
            maxLength={13}
            value={chainSearchPhone}
            onChange={(event) => setChainSearchPhone(event.target.value.replace(/[^\d+]/g, "").slice(0, 13))}
            placeholder="08xxxx"
            className="w-full rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />

          <button
            type="submit"
            disabled={!chainSearchPhone || !apiKey || chainSearchLoading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {chainSearchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </form>

        {chainSearchError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {chainSearchError}
          </div>
        )}

        {auditResult ? (
          <div className="mt-4">
            <PartnerAuditView data={auditResult} />
          </div>
        ) : chainSearchResult && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm font-semibold">User Score Ditemukan</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Trust Score</p>
                <p className="mt-1 text-xl font-bold text-zinc-900">{chainSearchResult.trust_score}</p>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Risk Level</p>
                <p className="mt-1 text-xl font-bold text-zinc-900">{chainSearchResult.risk_label}</p>
              </div>
              <div className="col-span-2 rounded-xl bg-white p-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Verified Docs</p>
                <p className="mt-1 text-lg font-bold text-zinc-900">{chainSearchResult.verified_scans} <span className="text-sm font-normal text-zinc-500">/ {chainSearchResult.total_scans} total</span></p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Otaru Financial */}
      <div className="rounded-[2rem] border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Playground 2</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-900">Otaru Financial Overview</h2>
          </div>
        </div>
        <form onSubmit={handleFinanceSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="tel"
            inputMode="numeric"
            maxLength={13}
            value={financeSearchPhone}
            onChange={(event) => setFinanceSearchPhone(event.target.value.replace(/[^\d+]/g, "").slice(0, 13))}
            placeholder="08xxxx"
            className="w-full rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />
          <button
            type="submit"
            disabled={!financeSearchPhone || !financeApiKey || financeSearchLoading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {financeSearchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </form>

        {financeSearchError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {financeSearchError}
          </div>
        )}

        {financeSearchResult && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm font-semibold">Financial Health</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Otaru Index</p>
                <p className="mt-1 text-xl font-bold text-zinc-900">{financeSearchResult.otaru_index}</p>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Credit Grade</p>
                <p className="mt-1 text-xl font-bold text-zinc-900">{financeSearchResult.credit_grade}</p>
              </div>
              <div className="col-span-2 rounded-xl bg-white p-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">DSR (Debt Service Ratio)</p>
                <p className="mt-1 text-lg font-bold text-zinc-900">{financeSearchResult.dsr_percent}%</p>
              </div>
              <div className="col-span-2 rounded-xl bg-white p-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Plafon Aman (Rekomendasi)</p>
                <p className="mt-1 text-lg font-bold text-zinc-900 text-emerald-600">{fmtNominal(financeSearchResult.sisa_plafon_aman)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unified Decision Gate */}
      <div className="rounded-[2rem] border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Playground 3</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-900">Unified Decision Gate</h2>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-600">Gabungan chain + financial info menjadi 1 final grade & rekomendasi.</p>
        <form onSubmit={handleDecisionSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="tel"
            inputMode="numeric"
            maxLength={13}
            value={decisionSearchPhone}
            onChange={(event) => setDecisionSearchPhone(event.target.value.replace(/[^\d+]/g, "").slice(0, 13))}
            placeholder="08xxxx"
            className="w-full rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />
          <button
            type="submit"
            disabled={!decisionSearchPhone || !decisionApiKey || decisionSearchLoading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {decisionSearchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </form>

        {decisionSearchError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {decisionSearchError}
          </div>
        )}

        {decisionSearchResult && (() => {
          const d = decisionSearchResult;
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
                  <span className="inline-block mt-1 text-[10px] font-semibold text-zinc-700">{comp.data_source || "Telegram"}</span>
                </div>
              </div>
            </div>

            {/* 👤 KYC & Identity */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-zinc-700" />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">KYC & Identity Verification</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><span className="text-zinc-500">Nama:</span> <span className="font-semibold text-zinc-900">{pd.full_name || "—"}</span></div>
                <div><span className="text-zinc-500">NIK:</span> <span className="font-mono font-semibold text-zinc-900">{pd.nik || "—"}</span></div>
                <div><span className="text-zinc-500">No. HP:</span> <span className="font-mono text-zinc-900">{pd.phone_number || "—"}</span></div>
                <div className="flex items-center gap-3">
                  {kyc.ktp_photo_url ? <a href={kyc.ktp_photo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"><ExternalLink className="h-3 w-3"/>View KTP</a> : <span className="text-xs text-zinc-400">KTP: —</span>}
                  {kyc.selfie_photo_url ? <a href={kyc.selfie_photo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"><ExternalLink className="h-3 w-3"/>View Selfie</a> : <span className="text-xs text-zinc-400">Selfie: —</span>}
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
                    ["Verified Docs", chain.verified_docs ?? 0, "text-emerald-700"],
                    ["Tampered Docs", chain.tampered_docs ?? 0, "text-red-600"],
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
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">Verified Income</span><span className="font-bold text-zinc-900">{fmtNominal(fin.verified_income ?? 0)}</span></div>
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
              {fd.digital_stamp_hash && (
                <div className="rounded-lg bg-zinc-800 text-green-400 p-3 font-mono text-[10px] break-all leading-relaxed">
                  <span className="text-zinc-500">SHA-256 Seal:</span> {fd.digital_stamp_hash}
                </div>
              )}
            </div>
          </div>
          );
        })()}
      </div>
      </div>
    </div>
  );
}
