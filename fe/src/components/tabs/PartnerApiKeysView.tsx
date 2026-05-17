import React from "react";
import { KeyRound, RefreshCw, Trash2, Copy, Phone, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  apiKey: any;
  financeApiKey: any;
  decisionApiKey?: any;
  apiKeyLoading: boolean;
  financeApiKeyLoading: boolean;
  decisionApiKeyLoading?: boolean;
  pageLoading: boolean;
  authError: string | null;
  fmtDate: (iso?: string) => string;
  isMaskedKey: (key: string) => boolean;
  generateKey: () => void;
  generateFinanceKey: () => void;
  generateDecisionKey?: () => void;
  revokeKey: () => void;
  revokeFinanceKey: () => void;
  fetchMyKey: () => void;
  fetchMyFinanceKey: () => void;
  handleCopy: (value: string, label: string) => void;
}

function KeySkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-3 w-24 rounded bg-zinc-200" />
      <div className="h-5 w-full rounded bg-zinc-200" />
      <div className="flex gap-3">
        <div className="h-3 w-32 rounded bg-zinc-200" />
        <div className="h-3 w-32 rounded bg-zinc-200" />
      </div>
    </div>
  );
}

function KeyCard({
  title,
  subtitle,
  description,
  keyObj,
  loading,
  pageLoading,
  fmtDate,
  isMaskedKey,
  onGenerate,
  onRevoke,
  onCopy,
  onRefresh,
  copyLabel,
  maskedWarning,
}: {
  title: string;
  subtitle: string;
  description: React.ReactNode;
  keyObj: any;
  loading: boolean;
  pageLoading: boolean;
  fmtDate: (iso?: string) => string;
  isMaskedKey?: (key: string) => boolean;
  onGenerate: () => void;
  onRevoke?: () => void;
  onCopy?: () => void;
  onRefresh?: () => void;
  copyLabel?: string;
  maskedWarning?: boolean;
}) {
  return (
    <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">{title}</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900">{subtitle}</h2>
          <div className="mt-3 space-y-2 text-sm text-zinc-600">{description}</div>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} disabled={pageLoading} className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
            <RefreshCw className={`h-3.5 w-3.5 ${pageLoading ? "animate-spin" : ""}`} /> Refresh
          </button>
        )}
      </div>
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        {pageLoading ? (
          <KeySkeleton />
        ) : keyObj ? (
          <>
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Active key</p>
            <p className="mt-2 break-all font-mono text-sm text-zinc-900">{keyObj?.key_value ?? "—"}</p>
            {maskedWarning && isMaskedKey?.(keyObj?.key_value ?? "") && (
              <p className="mt-2 text-xs text-amber-700">
                Key ini termask dari server. Generate ulang agar mendapatkan raw key.
              </p>
            )}
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-600 sm:grid-cols-2">
              <p>Created: {fmtDate(keyObj?.created_at)}</p>
              <p>Last used: {fmtDate(keyObj?.last_used_at)}</p>
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-600">Belum ada key aktif. Generate via form di atas.</p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onGenerate} disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
          <KeyRound className="h-4 w-4" /> {keyObj ? "Rotate Key" : "Generate Key"}
        </button>
        {onRevoke && (
          <button onClick={onRevoke} disabled={!keyObj || loading} className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> Revoke
          </button>
        )}
        {onCopy && (
          <button onClick={onCopy} disabled={!keyObj} className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50">
            <Copy className="h-4 w-4" /> Copy
          </button>
        )}
      </div>
    </div>
  );
}

export default function PartnerApiKeysView(props: Props) {
  const {
    apiKey, financeApiKey, decisionApiKey,
    apiKeyLoading, financeApiKeyLoading, decisionApiKeyLoading,
    pageLoading, authError,
    fmtDate, isMaskedKey,
    generateKey, generateFinanceKey, generateDecisionKey,
    revokeKey, revokeFinanceKey,
    fetchMyKey, fetchMyFinanceKey,
    handleCopy,
  } = props;

  return (
    <div className="space-y-5">

      {authError && <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">{authError}</p>}

      {/* Individual Key Cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <KeyCard
          title="OtaruChain Key"
          subtitle="Document Intelligence Access"
          description={
            <>
              <p>Untuk workflow underwriting yang membutuhkan validasi dokumen secara cepat dan defensible.</p>
              <ul className="space-y-1.5 text-zinc-700">
                <li>Audit dokumen dan fraud screening.</li>
                <li>Trust score berbasis histori transaksi.</li>
                <li>Partner audit yang kuat untuk verifikasi lapangan.</li>
              </ul>
            </>
          }
          keyObj={apiKey}
          loading={apiKeyLoading}
          pageLoading={pageLoading}
          fmtDate={fmtDate}
          onGenerate={generateKey}
          onRevoke={revokeKey}
          onCopy={() => apiKey && handleCopy(apiKey.key_value, "api-key-chain")}
          onRefresh={fetchMyKey}
        />

        <KeyCard
          title="Otaru Financial Key"
          subtitle="Financial Health Access"
          description={
            <>
              <p><b>Kemampuan API:</b> Credit readiness, DSR health, cicilan aktif, plafon aman, salary verification.</p>
              <ul className="space-y-1.5 text-zinc-700 ml-4 list-disc">
                <li>Verifikasi gaji dan repayment signal.</li>
                <li>Capacity to pay assessment via DSR.</li>
                <li>Plafon aman untuk aman lending.</li>
              </ul>
            </>
          }
          keyObj={financeApiKey}
          loading={financeApiKeyLoading}
          pageLoading={pageLoading}
          fmtDate={fmtDate}
          isMaskedKey={isMaskedKey}
          maskedWarning
          onGenerate={generateFinanceKey}
          onRevoke={revokeFinanceKey}
          onCopy={() => financeApiKey && handleCopy(financeApiKey.key_value, "api-key-finance")}
          onRefresh={fetchMyFinanceKey}
        />

        <KeyCard
          title="Otaru Decision Key"
          subtitle="Unified Decision Gate"
          description={
            <>
              <p>Key eksklusif untuk mengakses endpoint terpadu Otaru Decision Gate.</p>
              <ul className="space-y-1.5 text-zinc-700 ml-4 list-disc">
                <li>Menggabungkan metrics OtaruChain & Financial.</li>
                <li>Rekomendasi Trust Grade terpadu.</li>
                <li>Pengecekan lintas-platform nomor HP.</li>
              </ul>
            </>
          }
          keyObj={decisionApiKey}
          loading={decisionApiKeyLoading ?? false}
          pageLoading={pageLoading}
          fmtDate={fmtDate}
          onGenerate={generateDecisionKey ?? (() => {})}
          onCopy={() => decisionApiKey && handleCopy(decisionApiKey.key_value, "api-key-decision")}
        />
      </div>
    </div>
  );
}
