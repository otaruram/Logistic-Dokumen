import React from "react";
import { Copy } from "lucide-react";
import { PortalTheme } from "../../pages/PartnerPortalConstants";

export default function PartnerDocsTab({
  apiKey,

  isMaskedKey,
  API,
  copiedLabel,
  handleCopy,
  th,
  theme
}: {
  apiKey: any;

  isMaskedKey: (k: string) => boolean;
  API: string;
  copiedLabel: string | null;
  handleCopy: (val: string, label: string) => void;
  th: any;
  theme: PortalTheme;
}) {

  const chainScoringExample = apiKey
    ? `curl -X GET "${API}/api/partner/v1/user-audit-by-phone/08xxxxxxxxxx" \\
  -H "x-api-key: ${apiKey.key_value}"`
    : `curl -X GET "${API}/api/partner/v1/user-audit-by-phone/08xxxxxxxxxx" \\
  -H "x-api-key: sk-xxxx"`;



  const decisionScoringExample = apiKey
    ? `curl -X GET "${API}/api/v1/partner/lookup-by-phone/08xxxxxxxxxx" \\
  -H "x-api-key: ${apiKey.key_value}"`
    : `curl -X GET "${API}/api/v1/partner/lookup-by-phone/08xxxxxxxxxx" \\
  -H "x-api-key: uk-xxxx"`;

  const chainResponsExample = `{
  "user": { "email": "user@example.com", "user_id": "uuid" },
  "identity": {
    "full_name": "Budi Santoso",
    "nik": "3201xxxxxxxxxxxx",
    "ktp_photo_url": "https://...",
    "selfie_photo_url": "https://..."
  },
  "credit_score": { "lifetime_score": 820 },
  "financial_credit_score": {
    "final_score": 781,
    "grade": "B",
    "formula": "CR = DSR(0-300) + Consistency(0-300) + Integrity(0-400)",
    "components": { "dsr_score": 250, "consistency_score": 241, "integrity_score": 290 },
    "metrics": { "dsr_percent": 24.5, "tampered_attempts": 1 }
  },
  "risk": { "risk_level": "LOW", "risk_score": 15 },
  "transactions": { "total": 24, "verified": 19 }
}`;



  const decisionResponsExample = `{
  "phone_number": "081234567890",
  "nik": "3201xxxxxxxxxxxx",
  "full_name": "Budi Santoso",
  "address": "Jl. Contoh No. 1",
  "ktp_photo_url": "https://...",
  "selfie_photo_url": "https://...",
  "otaruchain_metrics": {
    "trust_score": 820,
    "verified_docs": 19,
    "tampered_docs": 1,
    "fraud_flags": 0
  },
  "financial_metrics": {
    "otaru_index": 781,
    "credit_grade": "B",
    "dsr_percent": 24.5,
    "sisa_plafon": 3800000,
    "integrity_level": "HIGH"
  },
  "trust_grade": "PRIME",
  "recommendation": "Pengajuan disetujui otomatis. Kapasitas bayar dan integritas terverifikasi baik."
}`;

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Partner Integrations</p>
            <h3 className="mt-1 text-xl font-semibold text-zinc-900">Integrated product docs</h3>
          </div>
          <button
            onClick={() => handleCopy(API, "base-url")}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700"
          >
            <Copy className="h-3.5 w-3.5" /> Copy Base URL
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-1">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Unified Decision Gate API</p>
            <h4 className="mt-2 text-lg font-semibold text-zinc-900">Combined chain & financial data</h4>
            <ul className="mt-4 space-y-2 text-sm text-zinc-700">
              <li>Base URL: <span className="font-mono">{API}</span></li>
              <li>Header: <span className="font-mono">x-api-key: OtaruChain Key (Decision Access)</span></li>
              <li>Endpoint utama: <span className="font-mono">GET /api/v1/partner/lookup-by-phone/{`{phone}`}</span></li>
              <li>Output: Rekomendasi final, foto verifikasi, dan gabungan metrics.</li>
            </ul>
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">cURL</p>
              <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-xs text-zinc-900">{decisionScoringExample}</pre>
            </div>
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Output</p>
              <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-xs text-zinc-900">{decisionResponsExample}</pre>
            </div>
          </div>
        </div>
        {copiedLabel && <p className="mt-3 text-xs text-zinc-500">Copied: {copiedLabel}</p>}
      </div>

      <div className={`rounded-3xl border ${th.cardBorder} ${th.cardBg} p-5`}>
        <p className={`text-xs uppercase tracking-[0.24em] ${th.subtleText}`}>Kustomisasi Portal</p>
        <h3 className={`mt-1 text-xl font-semibold ${th.accentText}`}>Portal ini bisa didesain bebas sesuai brand kamu</h3>
        <p className={`mt-3 text-sm leading-6 ${theme === "enterprise" ? "text-slate-300" : "text-zinc-600"}`}>
          Tampilan portal sepenuhnya dapat dikustomisasi. Semua style, warna, dan layout bisa disesuaikan dengan brand identity partner — mulai dari white-label sederhana hingga integrasi penuh ke platform internal.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className={`rounded-2xl border ${th.cardBorder} p-4 ${theme === "enterprise" ? "bg-slate-800" : "bg-zinc-50"}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${th.subtleText}`}>Cara kustomisasi tema portal</p>
            <ul className={`mt-3 space-y-2 text-sm ${theme === "enterprise" ? "text-slate-300" : "text-zinc-700"}`}>
              <li>1. Pilih tema dari picker di header (Classic / Modern / Minimal / Enterprise).</li>
              <li>2. Preferensi tema disimpan di localStorage secara otomatis.</li>
              <li>3. Untuk white-label penuh: fork repo frontend, edit <code className="font-mono text-xs bg-zinc-200 px-1 py-0.5 rounded">themeConfig</code> di <code className="font-mono text-xs bg-zinc-200 px-1 py-0.5 rounded">PartnerPortal.tsx</code>.</li>
              <li>4. Ganti warna, font, dan logo sesuai brand guideline kamu.</li>
            </ul>
          </div>
          <div className={`rounded-2xl border ${th.cardBorder} p-4 ${theme === "enterprise" ? "bg-slate-800" : "bg-zinc-50"}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${th.subtleText}`}>Opsi integrasi</p>
            <ul className={`mt-3 space-y-2 text-sm ${theme === "enterprise" ? "text-slate-300" : "text-zinc-700"}`}>
              <li>• <b>Embed widget</b>: Tampilkan credit score di platform kamu via iFrame atau micro-frontend.</li>
              <li>• <b>White-label penuh</b>: Deploy versi fork dengan domain dan brand sendiri.</li>
              <li>• <b>API-first</b>: Gunakan API key langsung tanpa portal — semua data di endpoint JSON.</li>
              <li>• <b>Custom branding</b>: Hubungi tim Otaru untuk setup white-label yang terkelola.</li>
            </ul>
          </div>
        </div>
        <p className={`mt-4 text-xs ${th.subtleText}`}>
          Untuk white-label setup atau branded deployment, hubungi tim di <span className="font-mono">partner@otaru.id</span>.
        </p>
      </div>
    </section>
  );
}
