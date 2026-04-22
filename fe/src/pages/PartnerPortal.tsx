import React, { useEffect, useState, useCallback } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Copy,
  KeyRound,
  LayoutDashboard,
  Mail,
  Shield,
  RefreshCw,
  Search,
  ShieldCheck,
  TerminalSquare,
  Trash2,
  Wallet,
  X,
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

type PartnerView = "dashboard" | "api" | "docs" | "pricing";

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
  const [userId, setUserId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<PartnerView>("dashboard");
  const [showAccessPopup, setShowAccessPopup] = useState(false);

  useEffect(() => {
    // onAuthStateChange fires for INITIAL_SESSION (covers page reload after OAuth redirect)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      const loggedIn = !!currentSession;
      const uid = currentSession?.user?.id ?? null;
      setSession(loggedIn);
      setUserId(uid);
      if (uid) {
        const seenKey = `otaru_patner_seen_${uid}`;
        const seen = localStorage.getItem(seenKey);
        setShowAccessPopup(!seen);
        fetchMyKey();
      } else {
        setShowAccessPopup(false);
        setApiKey(null);
      }
      setPageLoading(false);
    });

    fetchStats();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handlePartnerLogin() {
    // Set flag so main dashboard shows "go to partner" popup after login
    localStorage.setItem("redirect_to_partner", "1");
    const redirectTo = `${window.location.origin}/`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: "openid email profile",
      },
    });
  }

  function handleAcknowledgeAccess() {
    if (userId) {
      const seenKey = `otaru_patner_seen_${userId}`;
      localStorage.setItem(seenKey, "1");
    }
    setShowAccessPopup(false);
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
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <Link to="/" className="text-lg font-semibold tracking-tight">ocr.wtf</Link>
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Otaru Patner</p>
          </div>

          <div className="flex items-center gap-2">
            {(
              [
                { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                { id: "api", label: "API Key", icon: KeyRound },
                { id: "docs", label: "Docs", icon: TerminalSquare },
                { id: "pricing", label: "Pricing", icon: Wallet },
              ] as Array<{ id: PartnerView; label: string; icon: React.ComponentType<{ className?: string }> }>
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold sm:inline-flex ${
                    activeView === item.id
                      ? "bg-black text-white"
                      : "border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {item.label}
                </button>
              );
            })}

            <button
              onClick={() => {
                if (!session) {
                  handlePartnerLogin();
                  return;
                }
                window.location.href = "/";
              }}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-400"
            >
              {session ? "Dashboard" : "Sign In"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {showAccessPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Akses aktif</p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-900">Akun kamu bisa akses Otaru Patner</h3>
              </div>
              <button onClick={handleAcknowledgeAccess} className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-zinc-600">
              Popup ini hanya muncul sekali untuk akun ini. Akan muncul lagi kalau kamu login pakai akun berbeda.
            </p>
            <button
              onClick={handleAcknowledgeAccess}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Lanjutkan <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-5 grid grid-cols-1 gap-2 sm:hidden">
          {(
            [
              { id: "dashboard", label: "Dashboard" },
              { id: "api", label: "API Key" },
              { id: "docs", label: "Docs" },
              { id: "pricing", label: "Pricing" },
            ] as Array<{ id: PartnerView; label: string }>
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                activeView === item.id ? "bg-black text-white" : "border border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {!session ? (
          <section className="rounded-3xl border border-zinc-200 bg-white p-8 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Otaru Patner Access</p>
            <h1 className="mt-3 text-3xl font-semibold text-zinc-900">Login untuk lanjut ke portal partner</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              User harus login untuk akses API key management, docs interaktif, dan pricing activation.
            </p>
            <button
              onClick={handlePartnerLogin}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Sign in with Google <ArrowRight className="h-4 w-4" />
            </button>
          </section>
        ) : (
          <>
            {activeView === "dashboard" && (
              <section className="space-y-5">
                <div className="rounded-3xl border border-zinc-200 bg-white p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Dashboard</p>
                  <h1 className="mt-2 text-3xl font-semibold text-zinc-900">Otaru Patner Dashboard</h1>
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
            )}

            {activeView === "api" && (
              <section className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-3xl border border-zinc-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">API key</p>
                        <h2 className="mt-1 text-xl font-semibold text-zinc-900">Generate / rotate key</h2>
                      </div>
                      <button
                        onClick={fetchMyKey}
                        disabled={pageLoading}
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${pageLoading ? "animate-spin" : ""}`} /> Refresh
                      </button>
                    </div>

                    {authError && <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">{authError}</p>}

                    <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      {apiKey ? (
                        <>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Active key</p>
                          <p className="mt-2 break-all font-mono text-sm text-zinc-900">{apiKey.key_value}</p>
                          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-600 sm:grid-cols-2">
                            <p>Created: {fmtDate(apiKey.created_at)}</p>
                            <p>Last used: {fmtDate(apiKey.last_used_at)}</p>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-zinc-600">Belum ada key aktif.</p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={generateKey}
                        disabled={apiKeyLoading}
                        className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                      >
                        <KeyRound className="h-4 w-4" /> {apiKey ? "Rotate Key" : "Generate Key"}
                      </button>
                      <button
                        onClick={revokeKey}
                        disabled={!apiKey || apiKeyLoading}
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" /> Revoke
                      </button>
                      <button
                        onClick={() => apiKey && handleCopy(apiKey.key_value, "api-key")}
                        disabled={!apiKey}
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50"
                      >
                        <Copy className="h-4 w-4" /> Copy
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-zinc-200 bg-white p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Playground</p>
                    <h2 className="mt-1 text-xl font-semibold text-zinc-900">Cek credit score by email</h2>
                    <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="email"
                        value={searchEmail}
                        onChange={(event) => setSearchEmail(event.target.value)}
                        placeholder="user@example.com"
                        required
                        className="h-11 flex-1 rounded-full border border-zinc-300 bg-white px-4 text-sm outline-none focus:border-black"
                      />
                      <button
                        type="submit"
                        disabled={searchLoading || !apiKey}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                      >
                        <Search className="h-4 w-4" /> {searchLoading ? "Checking..." : "Check"}
                      </button>
                    </form>

                    {!apiKey && <p className="mt-2 text-xs text-zinc-500">Generate key dulu untuk aktifkan search.</p>}
                    {searchError && <p className="mt-2 text-sm text-red-600">{searchError}</p>}

                    {searchResult && (
                      <div className="mt-4 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-zinc-900">{searchResult.email}</p>
                          <RiskBadge label={searchResult.risk_label} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-zinc-700">
                          <p>Trust score: <b>{searchResult.trust_score}</b></p>
                          <p>Total scans: <b>{searchResult.total_scans}</b></p>
                          <p>Verified: <b>{searchResult.verified_scans}</b></p>
                          <p>Tampered: <b>{searchResult.tampered_scans}</b></p>
                        </div>
                        <p className="text-sm text-zinc-700">Total nominal: <b>{fmtNominal(searchResult.total_nominal)}</b></p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {activeView === "docs" && (
              <section className="space-y-5">
                <div className="rounded-3xl border border-zinc-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Docs</p>
                      <h3 className="mt-1 text-xl font-semibold text-zinc-900">API integration docs</h3>
                    </div>
                    <button
                      onClick={() => handleCopy(API, "base-url")}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Base URL
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
                      <p><span className="font-semibold">Base URL:</span> <span className="font-mono">{API}</span></p>
                      <p><span className="font-semibold">Endpoint:</span> <span className="font-mono">GET /api/v1/scoring/{`{email}`}</span></p>
                      <p><span className="font-semibold">Header:</span> <span className="font-mono">x-api-key: sk-xxxx</span></p>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">cURL</p>
                        <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-xs text-zinc-900">{scoringExample}</pre>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Response</p>
                        <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-xs text-zinc-900">{responseExample}</pre>
                      </div>
                    </div>
                  </div>
                  {copiedLabel && <p className="mt-3 text-xs text-zinc-500">Copied: {copiedLabel}</p>}
                </div>
              </section>
            )}

            {activeView === "pricing" && (
              <section className="space-y-5">
                <div className="rounded-3xl border border-zinc-200 bg-white p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Pricing</p>
                  <h1 className="mt-2 text-3xl font-semibold text-zinc-900">Pricing Plan Otaru Patner</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                    Paket ini sudah diaktifkan untuk flow partner. Pilih paket sesuai volume, lalu lanjut aktivasi dari tombol action masing-masing.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  {pricingPlans.map((plan, index) => (
                    <div
                      key={plan.name}
                      className={`rounded-3xl border p-5 ${
                        index === 1 ? "border-black bg-black text-white" : "border-zinc-200 bg-white text-zinc-900"
                      }`}
                    >
                      <p className={`text-xs uppercase tracking-[0.22em] ${index === 1 ? "text-zinc-300" : "text-zinc-500"}`}>{plan.name}</p>
                      <p className="mt-3 text-4xl font-semibold">{plan.price}</p>
                      <p className={`mt-1 text-sm ${index === 1 ? "text-zinc-300" : "text-zinc-500"}`}>{plan.cadence}</p>
                      <p className={`mt-4 text-sm ${index === 1 ? "text-zinc-100" : "text-zinc-700"}`}>{plan.volume}</p>
                      <p className={`mt-2 text-sm ${index === 1 ? "text-zinc-200" : "text-zinc-600"}`}>{plan.notes}</p>

                      <button
                        onClick={() => setActiveView("api")}
                        className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${
                          index === 1
                            ? "bg-white text-black hover:bg-zinc-200"
                            : "border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400"
                        }`}
                      >
                        Aktivasi Paket <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
