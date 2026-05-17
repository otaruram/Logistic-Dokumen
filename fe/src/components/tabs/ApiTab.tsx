import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Code2, Copy, KeyRound, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

type ApiKeyResponse = {
  key_value: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string | null;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const pricingPlans = [
  {
    name: "Starter",
    price: "Rp29.000",
    cadence: "/bulan",
    volume: "Up to 1.000 request scoring",
    notes: "Cocok untuk validasi awal partner dan integrasi MVP.",
  },
  {
    name: "Growth",
    price: "Rp99.000",
    cadence: "/bulan",
    volume: "Up to 10.000 request scoring",
    notes: "Sudah memperhitungkan biaya model GPT-4o-mini dan overhead VPS.",
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "pricing",
    volume: "High volume + SLA",
    notes: "Untuk kebutuhan batch, limit khusus, dan callback dedicated.",
  },
];

const formatDate = (value?: string | null) => {
  if (!value) return "Belum pernah dipakai";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const ApiTab = () => {
  const [apiKey, setApiKey] = useState<ApiKeyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"generate" | "revoke" | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const authHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setAuthError("Session login tidak ditemukan. Silakan login ulang.");
      return null;
    }
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const loadApiKey = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const headers = await authHeader();
      if (!headers) {
        setApiKey(null);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/apikeys/me`, { headers });
      if (response.status === 401) {
        setAuthError("Session backend tidak valid. Login ulang lalu coba lagi.");
        setApiKey(null);
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "Gagal mengambil API key.");
      }

      const payload = await response.json();
      setApiKey(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil API key.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApiKey();
  }, []);

  const handleGenerate = async () => {
    setActionLoading("generate");
    setAuthError(null);
    try {
      const headers = await authHeader();
      if (!headers) return;

      const response = await fetch(`${API_BASE_URL}/api/v1/apikeys/generate`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        setAuthError("Token tidak diterima backend. Login ulang lalu generate lagi.");
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "Gagal membuat API key.");
      }

      const payload = await response.json();
      setApiKey(payload);
      toast.success("API key baru berhasil dibuat.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal membuat API key.";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm("Revoke API key aktif? Key lama akan langsung tidak bisa dipakai.")) {
      return;
    }

    setActionLoading("revoke");
    setAuthError(null);
    try {
      const headers = await authHeader();
      if (!headers) return;

      const response = await fetch(`${API_BASE_URL}/api/v1/apikeys/me`, {
        method: "DELETE",
        headers,
      });

      if (response.status === 401) {
        setAuthError("Token tidak diterima backend. Login ulang lalu revoke lagi.");
        return;
      }
      if (!response.ok && response.status !== 204) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "Gagal revoke API key.");
      }

      setApiKey(null);
      toast.success("API key berhasil direvoke.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal revoke API key.";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} berhasil disalin.`);
    } catch {
      toast.error(`Gagal menyalin ${label}.`);
    }
  };

  const codeExample = apiKey
    ? `curl -X GET "${API_BASE_URL}/api/v1/scoring/user@example.com" \\
  -H "x-api-key: ${apiKey.key_value}"`
    : `curl -X GET "${API_BASE_URL}/api/v1/scoring/user@example.com" \\
  -H "x-api-key: sk-xxxx"`;

  return (
    <div className="space-y-6 pt-6 pb-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-6"
      >
        <div className="flex items-center gap-2 text-emerald-300">
          <KeyRound className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-[0.24em]">API Access</span>
        </div>
        <h2 className="mt-4 text-2xl font-bold text-white">Generate API key untuk partner integration</h2>
        <p className="mt-2 max-w-2xl text-sm text-gray-300">
          Gunakan key ini untuk akses endpoint scoring partner tanpa perlu membuka dashboard utama. Satu user hanya punya satu key aktif, jadi generate ulang akan otomatis merotasi key lama.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"
      >
        <section className="rounded-2xl border border-white/10 bg-[#111] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Your API key</h3>
              <p className="mt-1 text-sm text-gray-400">Kelola key untuk partner portal atau integrasi server-to-server.</p>
            </div>
            <button
              onClick={loadApiKey}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          {authError && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {authError}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
            {loading ? (
              <p className="text-sm text-gray-400">Memuat API key...</p>
            ) : apiKey ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Active key</p>
                    <p className="mt-2 break-all font-mono text-sm text-white">{apiKey.key_value}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(apiKey.key_value, "API key")}
                    className="rounded-lg border border-white/10 p-2 text-gray-300 hover:bg-white/5"
                    aria-label="Copy API key"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-3 text-sm text-gray-300 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Created at</p>
                    <p className="mt-2 text-white">{formatDate(apiKey.created_at)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Last used</p>
                    <p className="mt-2 text-white">{formatDate(apiKey.last_used_at)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-gray-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Belum ada key aktif
                </div>
                <p className="text-sm text-gray-400">Generate key pertama untuk mulai integrasi ke partner system.</p>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handleGenerate}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" />
              {actionLoading === "generate" ? "Generating..." : apiKey ? "Rotate API Key" : "Generate API Key"}
            </button>
            <button
              onClick={handleRevoke}
              disabled={!apiKey || actionLoading !== null}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-500/15 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {actionLoading === "revoke" ? "Revoking..." : "Revoke Key"}
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#111] p-5">
            <div className="flex items-center gap-2 text-white">
              <Code2 className="h-4 w-4 text-cyan-300" />
              <h3 className="text-lg font-semibold">Contoh penggunaan</h3>
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/50 p-4">
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-gray-200">{codeExample}</pre>
            </div>
            <button
              onClick={() => handleCopy(codeExample, "curl example")}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
            >
              <Copy className="h-4 w-4" /> Copy example
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#111] p-5">
            <h3 className="text-lg font-semibold text-white">Pricing</h3>
            <p className="mt-1 text-sm text-gray-400">Pricing awal untuk MVP. Bisa dinaikkan setelah usage pattern partner sudah kelihatan.</p>
            <div className="mt-4 space-y-3">
              {pricingPlans.map((plan) => (
                <div key={plan.name} className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{plan.name}</p>
                      <p className="mt-1 text-xs text-gray-400">{plan.volume}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">{plan.price}</p>
                      <p className="text-xs text-gray-500">{plan.cadence}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-300">{plan.notes}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default ApiTab;