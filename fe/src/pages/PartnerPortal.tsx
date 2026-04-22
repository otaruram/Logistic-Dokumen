import React, { useEffect, useState, useCallback } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Copy,
  KeyRound,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { APP_CONFIG } from "@/constants";
import { supabase } from "@/lib/supabaseClient";

const API = APP_CONFIG.apiUrl;

interface PlatformStats {
  total_scans: number;
  fraud_prevented: number;
  verified_scans: number;
  integrity_rate: number;
}

interface ApiKeyInfo {
  key_value: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface ScanSummary {
  scan_id: string;
  status: string;
  nominal_total: number | null;
  vendor_name: string | null;
  doc_type: string | null;
  created_at: string;
}

interface ScoringResult {
  email: string;
  user_id: string;
  trust_score: number;
  risk_label: "PRIME" | "MODERATE" | "RISK";
  total_scans: number;
  verified_scans: number;
  tampered_scans: number;
  total_nominal: number;
  recent_scans: ScanSummary[];
}

const pricingPlans = [
  {
    name: "Starter",
    price: "Rp29.000",
    cadence: "/bulan",
    volume: "Up to 1.000 scoring request",
    notes: "Cocok untuk validasi awal partner dan integrasi MVP.",
  },
  {
    name: "Growth",
    price: "Rp99.000",
    cadence: "/bulan",
    volume: "Up to 10.000 scoring request",
    notes: "Sudah memperhitungkan biaya GPT-4o-mini, server overhead, dan margin operasional awal.",
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "pricing",
    volume: "High volume + SLA + dedicated flow",
    notes: "Untuk kebutuhan batch, quota besar, callback khusus, dan support prioritas.",
  },
];

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmt(value: number): string {
  return value.toLocaleString("id-ID");
}

function fmtNominal(value: number): string {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  return `Rp ${fmt(value)}`;
}

function fmtDate(value?: string | null): string {
  if (!value) return "Belum pernah dipakai";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function RiskBadge({ label }: { label: "PRIME" | "MODERATE" | "RISK" | string }) {
  const styles: Record<string, string> = {
    PRIME: "border-white bg-white text-black",
    MODERATE: "border-zinc-500 bg-zinc-800 text-white",
    RISK: "border-red-400/30 bg-red-500/10 text-red-100",
  };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold tracking-[0.22em] ${styles[label] ?? "border-zinc-700 bg-zinc-900 text-zinc-200"}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles =
    normalized === "verified"
      ? "border-white/20 bg-white text-black"
      : normalized === "tampered"
      ? "border-red-500/30 bg-red-500/10 text-red-100"
      : "border-zinc-700 bg-zinc-900 text-zinc-300";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${styles}`}>{status}</span>;
}

export default function PartnerPortal() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [apiKey, setApiKey] = useState<ApiKeyInfo | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [searchEmail, setSearchEmail] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<ScoringResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [session, setSession] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(!!currentSession);
      if (currentSession) {
        fetchMyKey();
      }
    });

    fetchStats();
    fetchMyKey().finally(() => setPageLoading(false));

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handlePartnerLogin() {
    const redirectTo = `${window.location.origin}/partner`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: "openid email profile",
      },
    });
  }

  async function fetchStats() {
    try {
      const response = await fetch(`${API}/api/v1/partner/stats`);
      if (response.ok) {
        setStats(await response.json());
      }
    } catch {
      setStats(null);
    }
  }

  async function fetchMyKey() {
    setAuthError(null);
    const headers = await getAuthHeader();
    if (!headers.Authorization) {
      setApiKey(null);
      return;
    }

    try {
      const response = await fetch(`${API}/api/v1/apikeys/me`, { headers });
      if (response.status === 401) {
        setAuthError("Session backend tidak valid. Login ulang lalu coba lagi.");
        setApiKey(null);
        return;
      }
      if (response.ok) {
        setApiKey(await response.json());
      }
    } catch {
      setApiKey(null);
    }
  }

  async function generateKey() {
    setApiKeyLoading(true);
    setAuthError(null);
    try {
      const headers: Record<string, string> = {
        ...(await getAuthHeader()),
        "Content-Type": "application/json",
      };
      if (!headers.Authorization) {
        setAuthError("Login dulu untuk generate API key.");
        return;
      }

      const response = await fetch(`${API}/api/v1/apikeys/generate`, {
        method: "POST",
        headers,
      });

      if (response.status === 401) {
        setAuthError("Token tidak diterima backend. Login ulang lalu generate lagi.");
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setApiKey(data);
      }
    } finally {
      setApiKeyLoading(false);
    }
  }

  async function revokeKey() {
    if (!window.confirm("Revoke API key aktif? Key lama akan langsung tidak bisa dipakai.")) {
      return;
    }

    setApiKeyLoading(true);
    setAuthError(null);
    try {
      const headers = await getAuthHeader();
      if (!headers.Authorization) {
        setAuthError("Login dulu untuk revoke API key.");
        return;
      }

      const response = await fetch(`${API}/api/v1/apikeys/me`, { method: "DELETE", headers });
      if (response.status === 401) {
        setAuthError("Token tidak diterima backend. Login ulang lalu revoke lagi.");
        return;
      }
      setApiKey(null);
      setSearchResult(null);
    } finally {
      setApiKeyLoading(false);
    }
  }

  const handleCopy = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedLabel(label);
      window.setTimeout(() => setCopiedLabel((current) => (current === label ? null : current)), 1800);
    } catch {
      setCopiedLabel(null);
    }
  }, []);

  const handleSearch = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!searchEmail.trim() || !apiKey) return;

      setSearchLoading(true);
      setSearchError(null);
      setSearchResult(null);

      try {
        const response = await fetch(`${API}/api/v1/scoring/${encodeURIComponent(searchEmail.trim())}`, {
          headers: { "x-api-key": apiKey.key_value },
        });

        if (response.status === 404) {
          setSearchError("User dengan email tersebut tidak ditemukan.");
        } else if (response.status === 401) {
          setSearchError("API key tidak valid atau sudah tidak aktif.");
        } else if (!response.ok) {
          setSearchError("Terjadi error saat mengambil score.");
        } else {
          setSearchResult(await response.json());
        }
      } catch {
        setSearchError("Network error. Coba lagi.");
      } finally {
        setSearchLoading(false);
      }
    },
    [searchEmail, apiKey]
  );

  const scoringExample = apiKey
    ? `curl -X GET "${API}/api/v1/scoring/user@example.com" \\
  -H "x-api-key: ${apiKey.key_value}"`
    : `curl -X GET "${API}/api/v1/scoring/user@example.com" \\
  -H "x-api-key: sk-xxxx"`;

  const responseExample = `{
  "email": "user@example.com",
  "user_id": "uuid-user",
  "trust_score": 82,
  "risk_label": "PRIME",
  "total_scans": 24,
  "verified_scans": 19,
  "tampered_scans": 5,
  "total_nominal": 12850000
}`;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute left-[-10%] top-[-10%] h-[32rem] w-[32rem] rounded-full bg-white/6 blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-10%] h-[28rem] w-[28rem] rounded-full bg-white/5 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050505]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <Link to="/" className="text-lg font-semibold tracking-tight text-white">
              ocr.wtf
            </Link>
            <p className="mt-1 text-[11px] uppercase tracking-[0.28em] text-zinc-500">Partner API Console</p>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
            <a href="#console" className="transition-colors hover:text-white">Console</a>
            <a href="#docs" className="transition-colors hover:text-white">Docs</a>
            <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
          </nav>

          <Link
            to={session ? "/" : "/partner"}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/5"
            onClick={(event) => {
              if (!session) {
                event.preventDefault();
                handlePartnerLogin();
              }
            }}
          >
            {session ? "Dashboard" : "Sign In"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-6 pb-12 pt-16">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.24em] text-zinc-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Partner access
              </div>
              <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-6xl md:leading-[1.02]">
                Generate key, paste email, and check credit score in one premium console.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-400 md:text-lg">
                Halaman ini dibuat untuk partner yang butuh akses cepat ke API scoring OCR.WTF. Generate API key, uji endpoint langsung dengan email user, lalu salin base URL dan contoh request dari docs di bawah.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#console" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200">
                  Buka Console <ArrowRight className="h-4 w-4" />
                </a>
                <a href="#docs" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5">
                  Lihat Docs <TerminalSquare className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Total scans", value: stats ? fmt(stats.total_scans) : "...", icon: BarChart3 },
                { label: "Fraud prevented", value: stats ? fmt(stats.fraud_prevented) : "...", icon: ShieldCheck },
                { label: "Verified docs", value: stats ? fmt(stats.verified_scans) : "...", icon: CheckCircle2 },
                { label: "Integrity rate", value: stats ? `${stats.integrity_rate}%` : "...", icon: Mail },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_80px_rgba(255,255,255,0.04)]">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">{item.label}</p>
                      <Icon className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="mt-6 text-3xl font-semibold text-white">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="console" className="mx-auto max-w-7xl px-6 pb-12">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[2rem] border border-white/10 bg-[#0b0b0b] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">API key</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Generate once, pakai langsung</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Setelah key dibuat, user bisa langsung tempel email di panel kanan untuk cek credit score tanpa pindah halaman.
                  </p>
                </div>
                <button
                  onClick={fetchMyKey}
                  disabled={pageLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${pageLoading ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>

              {authError && (
                <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  {authError}
                </div>
              )}

              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.02] p-5">
                {pageLoading ? (
                  <p className="text-sm text-zinc-400">Memuat status API key...</p>
                ) : session ? (
                  apiKey ? (
                    <div className="space-y-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Active key</p>
                          <p className="mt-3 break-all font-mono text-sm text-white">{apiKey.key_value}</p>
                        </div>
                        <button
                          onClick={() => handleCopy(apiKey.key_value, "api-key")}
                          className="rounded-xl border border-white/10 p-2 text-zinc-300 transition hover:bg-white/5"
                          aria-label="Copy API key"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Created</p>
                          <p className="mt-2 text-sm text-white">{fmtDate(apiKey.created_at)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Last used</p>
                          <p className="mt-2 text-sm text-white">{fmtDate(apiKey.last_used_at)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
                        <KeyRound className="h-3.5 w-3.5" /> Belum ada key aktif
                      </div>
                      <p className="text-sm text-zinc-400">Generate key pertama untuk mulai integrasi partner.</p>
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-zinc-300">Login terlebih dulu untuk generate dan rotate API key.</p>
                    <button
                      onClick={handlePartnerLogin}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
                    >
                      Sign in <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={generateKey}
                  disabled={!session || apiKeyLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
                >
                  <KeyRound className="h-4 w-4" />
                  {apiKeyLoading ? "Processing..." : apiKey ? "Rotate API key" : "Generate API key"}
                </button>
                <button
                  onClick={revokeKey}
                  disabled={!apiKey || apiKeyLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/5 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Revoke key
                </button>
              </div>

              {copiedLabel === "api-key" && <p className="mt-3 text-xs text-zinc-400">API key copied.</p>}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[#0b0b0b] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">Live playground</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Tempel email untuk cek credit score</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Setelah key aktif, user tinggal masukkan email target untuk memanggil endpoint scoring secara langsung dari halaman partner.
                </p>
              </div>

              <form onSubmit={handleSearch} className="mt-6 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    value={searchEmail}
                    onChange={(event) => setSearchEmail(event.target.value)}
                    placeholder="user@example.com"
                    required
                    className="h-12 w-full rounded-full border border-white/10 bg-black/40 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/25"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchLoading || !apiKey}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
                >
                  <Search className="h-4 w-4" />
                  {searchLoading ? "Searching..." : "Check score"}
                </button>
              </form>

              {!apiKey && <p className="mt-3 text-xs text-zinc-500">Generate API key dulu agar playground aktif.</p>}
              {searchError && <p className="mt-4 text-sm text-red-200">{searchError}</p>}

              {searchResult ? (
                <div className="mt-6 space-y-5 rounded-[1.5rem] border border-white/10 bg-white/[0.02] p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xl font-semibold text-white">{searchResult.email}</p>
                      <p className="mt-1 font-mono text-xs text-zinc-500">{searchResult.user_id}</p>
                    </div>
                    <RiskBadge label={searchResult.risk_label} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: "Trust score", value: String(searchResult.trust_score) },
                      { label: "Total scans", value: String(searchResult.total_scans) },
                      { label: "Verified", value: String(searchResult.verified_scans) },
                      { label: "Tampered", value: String(searchResult.tampered_scans) },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <p className="text-2xl font-semibold text-white">{item.value}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-zinc-500">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Total nominal verified</p>
                    <p className="mt-2 text-lg font-semibold text-white">{fmtNominal(searchResult.total_nominal)}</p>
                  </div>

                  {searchResult.recent_scans.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Recent scans</p>
                      <div className="mt-3 space-y-3">
                        {searchResult.recent_scans.map((scan) => (
                          <div key={scan.scan_id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                            <div className="min-w-0">
                              <p className="truncate font-mono text-xs text-zinc-500">{scan.scan_id}</p>
                              <p className="mt-1 truncate text-sm text-zinc-200">{scan.vendor_name ?? scan.doc_type ?? "Unknown document"}</p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <StatusBadge status={scan.status} />
                              {scan.nominal_total != null && <p className="mt-1 text-xs text-zinc-400">{fmtNominal(scan.nominal_total)}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-6 rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-zinc-400">
                  Hasil scoring akan muncul di sini setelah email dicari.
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="docs" className="mx-auto max-w-7xl px-6 pb-12">
          <div className="rounded-[2rem] border border-white/10 bg-[#0b0b0b] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">Docs</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Cara pakai endpoint partner</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  Docs singkat ini cukup untuk mulai integrasi. Base URL, endpoint scoring, header autentikasi, dan contoh response semuanya ada di satu section.
                </p>
              </div>
              <button
                onClick={() => handleCopy(API, "base-url")}
                className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/5"
              >
                <Copy className="h-4 w-4" /> Copy Base URL
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Base URL</p>
                  <p className="mt-3 break-all font-mono text-sm text-white">{API}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Endpoint</p>
                  <p className="mt-3 break-all font-mono text-sm text-white">GET /api/v1/scoring/{`{email}`}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Auth header</p>
                  <p className="mt-3 break-all font-mono text-sm text-white">x-api-key: sk-xxxx</p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">cURL example</p>
                    <button
                      onClick={() => handleCopy(scoringExample, "curl")}
                      className="rounded-lg border border-white/10 p-2 text-zinc-300 transition hover:bg-white/5"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-zinc-200">{scoringExample}</pre>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Sample response</p>
                    <button
                      onClick={() => handleCopy(responseExample, "response")}
                      className="rounded-lg border border-white/10 p-2 text-zinc-300 transition hover:bg-white/5"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-zinc-200">{responseExample}</pre>
                </div>
              </div>
            </div>

            {copiedLabel && <p className="mt-4 text-xs text-zinc-500">Copied: {copiedLabel}</p>}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-6 pb-16">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">Pricing</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Simple pricing untuk partner MVP</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Harga awal ini dibuat supaya tetap kompetitif, tapi masih masuk akal terhadap biaya GPT-4o-mini, server bulanan sekitar Rp36.000, dan overhead operasional awal.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {pricingPlans.map((plan, index) => (
              <div
                key={plan.name}
                className={`rounded-[2rem] border p-6 ${index === 1 ? "border-white bg-white text-black shadow-[0_24px_80px_rgba(255,255,255,0.08)]" : "border-white/10 bg-[#0b0b0b] text-white"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`text-xs uppercase tracking-[0.24em] ${index === 1 ? "text-black/60" : "text-zinc-500"}`}>{plan.name}</p>
                    <p className="mt-4 text-4xl font-semibold">{plan.price}</p>
                    <p className={`mt-1 text-sm ${index === 1 ? "text-black/60" : "text-zinc-500"}`}>{plan.cadence}</p>
                  </div>
                  {index === 1 && (
                    <span className="rounded-full bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
                      Recommended
                    </span>
                  )}
                </div>

                <div className={`mt-6 rounded-2xl border p-4 ${index === 1 ? "border-black/10 bg-black/5" : "border-white/10 bg-white/[0.02]"}`}>
                  <p className={`text-sm font-medium ${index === 1 ? "text-black" : "text-white"}`}>{plan.volume}</p>
                  <p className={`mt-2 text-sm leading-6 ${index === 1 ? "text-black/70" : "text-zinc-400"}`}>{plan.notes}</p>
                </div>

                <a
                  href={plan.name === "Enterprise" ? "mailto:partner@ocr.wtf" : "#console"}
                  className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition ${index === 1 ? "bg-black text-white hover:bg-zinc-800" : "border border-white/10 text-white hover:bg-white/5"}`}
                >
                  {plan.name === "Enterprise" ? "Contact sales" : "Start from console"}
                </a>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
