import React, { useEffect, useState, useCallback } from "react";
import { APP_CONFIG } from "@/constants";
import { supabase } from "@/lib/supabaseClient";

const API = APP_CONFIG.apiUrl;

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmt(n: number): string {
  return n.toLocaleString("id-ID");
}

function fmtNominal(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  return `Rp ${fmt(n)}`;
}

// ─── Components ──────────────────────────────────────────────────────────────

function RiskBadge({ label }: { label: "PRIME" | "MODERATE" | "RISK" | string }) {
  const styles: Record<string, string> = {
    PRIME: "bg-black text-white",
    MODERATE: "bg-gray-600 text-white",
    RISK: "border border-black text-black bg-white",
  };
  return (
    <span className={`inline-block px-3 py-0.5 text-xs font-bold tracking-widest rounded-full ${styles[label] ?? "bg-gray-200 text-gray-800"}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const c =
    s === "verified"
      ? "bg-black text-white"
      : s === "tampered"
      ? "border border-black text-black"
      : "bg-gray-100 text-gray-500";
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded uppercase tracking-wide ${c}`}>
      {status}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PartnerPortal() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [apiKey, setApiKey] = useState<ApiKeyInfo | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [searchEmail, setSearchEmail] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<ScoringResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [session, setSession] = useState<boolean>(false);

  // ── Load session & initial data
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
    });
    fetchStats();
    fetchMyKey();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch(`${API}/api/v1/partner/stats`);
      if (res.ok) setStats(await res.json());
    } catch {
      /* ignore */
    }
  }

  async function fetchMyKey() {
    const headers = await getAuthHeader();
    if (!headers.Authorization) return;
    try {
      const res = await fetch(`${API}/api/v1/apikeys/me`, { headers });
      if (res.ok) {
        const data = await res.json();
        setApiKey(data);
      }
    } catch {
      /* ignore */
    }
  }

  async function generateKey() {
    setApiKeyLoading(true);
    try {
      const headers = { ...(await getAuthHeader()), "Content-Type": "application/json" };
      const res = await fetch(`${API}/api/v1/apikeys/generate`, {
        method: "POST",
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setApiKey(data);
      }
    } finally {
      setApiKeyLoading(false);
    }
  }

  async function revokeKey() {
    if (!confirm("Revoke this API key? It cannot be used anymore.")) return;
    setApiKeyLoading(true);
    try {
      const headers = await getAuthHeader();
      await fetch(`${API}/api/v1/apikeys/me`, { method: "DELETE", headers });
      setApiKey(null);
    } finally {
      setApiKeyLoading(false);
    }
  }

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey.key_value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchEmail.trim() || !apiKey) return;
      setSearchLoading(true);
      setSearchError(null);
      setSearchResult(null);
      try {
        const res = await fetch(
          `${API}/api/v1/scoring/${encodeURIComponent(searchEmail.trim())}`,
          { headers: { "x-api-key": apiKey.key_value } }
        );
        if (res.status === 404) {
          setSearchError("User not found.");
        } else if (res.status === 401) {
          setSearchError("Invalid API key.");
        } else if (!res.ok) {
          setSearchError("Error fetching score.");
        } else {
          setSearchResult(await res.json());
        }
      } catch {
        setSearchError("Network error.");
      } finally {
        setSearchLoading(false);
      }
    },
    [searchEmail, apiKey]
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {/* Nav */}
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <a href="/" className="font-bold text-xl tracking-tight">ocr.wtf</a>
        <nav className="flex gap-6 text-sm">
          <a href="#stats" className="hover:underline">Stats</a>
          <a href="#apikey" className="hover:underline">API Key</a>
          <a href="#scoring" className="hover:underline">Scoring</a>
          <a href="#pricing" className="hover:underline">Pricing</a>
          {session ? (
            <a href="/" className="underline font-semibold">Dashboard →</a>
          ) : (
            <a href="/" className="underline font-semibold">Login →</a>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-b border-gray-100">
        <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-4">
          Partner Access
        </p>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
          B2B Document<br />Intelligence API
        </h1>
        <p className="text-gray-500 max-w-xl text-base mb-8">
          Real-time logistics document verification and credit scoring for cooperatives,
          banks, and financial institutions. One API key, unlimited queries.
        </p>
        <a
          href="#apikey"
          className="inline-block bg-black text-white text-sm font-semibold px-6 py-3 rounded-none hover:bg-gray-800 transition"
        >
          Get API Key
        </a>
      </section>

      {/* Platform Stats */}
      <section id="stats" className="max-w-6xl mx-auto px-6 py-14 border-b border-gray-100">
        <h2 className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-8">
          Platform Stats
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "Total Scans", value: stats ? fmt(stats.total_scans) : "—" },
            { label: "Fraud Prevented", value: stats ? fmt(stats.fraud_prevented) : "—" },
            { label: "Verified Docs", value: stats ? fmt(stats.verified_scans) : "—" },
            { label: "Integrity Rate", value: stats ? `${stats.integrity_rate}%` : "—" },
          ].map((s) => (
            <div key={s.label} className="border border-gray-200 p-6">
              <p className="text-3xl font-bold mb-1">{s.value}</p>
              <p className="text-xs text-gray-500 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* API Key Management */}
      <section id="apikey" className="max-w-6xl mx-auto px-6 py-14 border-b border-gray-100">
        <h2 className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-8">
          API Key Management
        </h2>
        {!session ? (
          <div className="border border-gray-200 p-8 text-center text-gray-400">
            <p className="mb-4">Sign in to manage your API key.</p>
            <a href="/" className="underline text-black font-semibold">Go to Login</a>
          </div>
        ) : (
          <div className="border border-gray-200 p-8 max-w-2xl">
            {apiKey ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Active Key</span>
                  <span className="w-2 h-2 bg-black rounded-full inline-block" />
                </div>
                <div className="flex items-stretch gap-2 mb-4">
                  <code className="flex-1 bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-mono break-all">
                    {apiKey.key_value}
                  </code>
                  <button
                    onClick={copyKey}
                    className="border border-black px-4 text-xs font-semibold hover:bg-black hover:text-white transition whitespace-nowrap"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-6">
                  Created: {new Date(apiKey.created_at).toLocaleDateString("id-ID")}
                  {apiKey.last_used_at && (
                    <> · Last used: {new Date(apiKey.last_used_at).toLocaleDateString("id-ID")}</>
                  )}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={generateKey}
                    disabled={apiKeyLoading}
                    className="border border-black px-5 py-2 text-xs font-semibold hover:bg-black hover:text-white transition disabled:opacity-40"
                  >
                    Rotate Key
                  </button>
                  <button
                    onClick={revokeKey}
                    disabled={apiKeyLoading}
                    className="border border-gray-300 px-5 py-2 text-xs font-semibold text-gray-500 hover:border-black hover:text-black transition disabled:opacity-40"
                  >
                    Revoke
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-sm mb-6">No active API key. Generate one to get started.</p>
                <button
                  onClick={generateKey}
                  disabled={apiKeyLoading}
                  className="bg-black text-white px-6 py-2 text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-40"
                >
                  {apiKeyLoading ? "Generating…" : "Generate API Key"}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {/* Scoring / Search */}
      <section id="scoring" className="max-w-6xl mx-auto px-6 py-14 border-b border-gray-100">
        <h2 className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-8">
          User Credit Scoring
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2 mb-8 max-w-xl">
          <input
            type="email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            placeholder="user@example.com"
            required
            className="flex-1 border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:border-black"
          />
          <button
            type="submit"
            disabled={searchLoading || !apiKey}
            className="bg-black text-white px-6 py-2 text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-40"
          >
            {searchLoading ? "…" : "Search"}
          </button>
        </form>
        {!apiKey && (
          <p className="text-xs text-gray-400">Generate an API key first to use the scoring endpoint.</p>
        )}
        {searchError && (
          <p className="text-sm text-red-600 mb-4">{searchError}</p>
        )}
        {searchResult && (
          <div className="border border-gray-200 p-6 max-w-2xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-lg font-bold">{searchResult.email}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{searchResult.user_id}</p>
              </div>
              <RiskBadge label={searchResult.risk_label} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Trust Score", value: String(searchResult.trust_score) },
                { label: "Total Scans", value: String(searchResult.total_scans) },
                { label: "Verified", value: String(searchResult.verified_scans) },
                { label: "Tampered", value: String(searchResult.tampered_scans) },
              ].map((s) => (
                <div key={s.label} className="border border-gray-100 p-3">
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Total Nominal (Verified): <span className="text-black font-semibold">{fmtNominal(searchResult.total_nominal)}</span>
            </p>
            {searchResult.recent_scans.length > 0 && (
              <>
                <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-3">Recent Scans</p>
                <div className="border border-gray-100 divide-y divide-gray-100 text-sm">
                  {searchResult.recent_scans.map((s) => (
                    <div key={s.scan_id} className="flex items-center justify-between px-3 py-2 gap-4">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-gray-400 truncate">{s.scan_id.slice(0, 8)}…</p>
                        <p className="text-xs truncate">{s.vendor_name ?? s.doc_type ?? "—"}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <StatusBadge status={s.status} />
                        {s.nominal_total != null && (
                          <p className="text-xs text-gray-500 mt-0.5">{fmtNominal(s.nominal_total)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-14 border-b border-gray-100">
        <h2 className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-2">Pricing</h2>
        <p className="text-gray-500 text-sm mb-10 max-w-md">
          Simple, transparent pricing. All plans include unlimited scans for end-users.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free */}
          <div className="border border-gray-200 p-8 flex flex-col">
            <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-4">Free</p>
            <p className="text-4xl font-bold mb-1">Rp 0</p>
            <p className="text-xs text-gray-400 mb-8">/ bulan</p>
            <ul className="text-sm text-gray-600 space-y-2 flex-1">
              <li>✓ Scan dokumen tak terbatas</li>
              <li>✓ Dashboard & histori</li>
              <li>✓ Telegram bot</li>
              <li className="text-gray-300">✗ Akses API scoring</li>
              <li className="text-gray-300">✗ Bulk export</li>
            </ul>
            <a
              href="/"
              className="mt-8 border border-black text-center py-2 text-sm font-semibold hover:bg-black hover:text-white transition"
            >
              Mulai Gratis
            </a>
          </div>
          {/* Cooperative */}
          <div className="border-2 border-black p-8 flex flex-col relative">
            <span className="absolute top-0 right-0 bg-black text-white text-xs px-3 py-1 font-semibold tracking-widest">
              POPULER
            </span>
            <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-4">Koperasi</p>
            <p className="text-4xl font-bold mb-1">Rp 499k</p>
            <p className="text-xs text-gray-400 mb-8">/ bulan</p>
            <ul className="text-sm text-gray-600 space-y-2 flex-1">
              <li>✓ Semua fitur Free</li>
              <li>✓ 1 API key</li>
              <li>✓ 10.000 scoring queries/bulan</li>
              <li>✓ Real-time risk label</li>
              <li className="text-gray-300">✗ SLA support</li>
            </ul>
            <a
              href="mailto:partner@ocr.wtf"
              className="mt-8 bg-black text-white text-center py-2 text-sm font-semibold hover:bg-gray-800 transition"
            >
              Hubungi Kami
            </a>
          </div>
          {/* Enterprise */}
          <div className="border border-gray-200 p-8 flex flex-col">
            <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-4">Enterprise / Bank</p>
            <p className="text-4xl font-bold mb-1">Custom</p>
            <p className="text-xs text-gray-400 mb-8">negosiasi langsung</p>
            <ul className="text-sm text-gray-600 space-y-2 flex-1">
              <li>✓ Semua fitur Koperasi</li>
              <li>✓ Multiple API keys</li>
              <li>✓ Unlimited queries</li>
              <li>✓ Dedicated SLA &amp; support</li>
              <li>✓ On-premise option</li>
            </ul>
            <a
              href="mailto:partner@ocr.wtf"
              className="mt-8 border border-black text-center py-2 text-sm font-semibold hover:bg-black hover:text-white transition"
            >
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-gray-400">
        <span>© 2025 ocr.wtf</span>
        <div className="flex gap-6">
          <a href="/privacy" className="hover:underline">Privacy</a>
          <a href="/terms" className="hover:underline">Terms</a>
          <a href="/help" className="hover:underline">Help</a>
        </div>
      </footer>
    </div>
  );
}
