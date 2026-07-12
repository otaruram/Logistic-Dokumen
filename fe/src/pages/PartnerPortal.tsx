import React, { useEffect, useState, useCallback, useRef } from "react";
import PartnerAuditView from "@/components/PartnerAuditView";
import ApprovalQueueTab from "@/components/tabs/ApprovalQueueTab";
import PartnerDocsTab from "@/components/tabs/PartnerDocsTab";
import PartnerPricingTab from "@/components/tabs/PartnerPricingTab";
import PartnerDashboardTab from "@/components/tabs/PartnerDashboardTab";
import PartnerPlaygrounds from "@/components/tabs/PartnerPlaygrounds";
import PartnerApiKeysView from "@/components/tabs/PartnerApiKeysView";
import PartnerAuditTrailTab from "@/components/tabs/PartnerAuditTrailTab";
import WhitelistManagement from "@/components/tabs/WhitelistManagement";
import { pricingPlans, partnerProducts, themeConfig, PortalTheme } from "./PartnerPortalConstants";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  Copy,
  KeyRound,
  LayoutDashboard,
  Mail,
  PenLine,
  Shield,
  RefreshCw,
  Search,
  ShieldCheck,
  TerminalSquare,
  Trash2,
  Users,
  Wallet,
  X,
  Wand2,
  Home,
  User,
  LogOut,
  Menu,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { APP_CONFIG } from "@/constants";
import { supabase } from "@/lib/supabaseClient";
import ScrollNavigator from "@/components/ui/ScrollNavigator";

const API = APP_CONFIG.apiUrl;
const CHAIN_RAW_KEY_STORAGE = "otaru_chain_raw_key";
const DECISION_RAW_KEY_STORAGE = "otaru_decision_raw_key";

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

// Full audit data from /api/partner/v1/user-audit/{email}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuditResult = any; // matches AuditData in PartnerAuditView

interface ScoringResult {
  email: string;
  user_id: string;
  trust_score: number;
  risk_label: string;
  total_scans: number;
  verified_scans: number;
  tampered_scans: number;
  total_nominal: number;
  recent_scans: ScanSummary[];
}

interface DecisionGateResult {
  phone_number: string;
  nik: string;
  full_name: string;
  address: string;
  ktp_photo_url: string;
  selfie_photo_url: string;
  otaruchain_metrics: {
    trust_score: number;
    verified_docs: number;
    tampered_docs: number;
    fraud_flags: number;
  };
  financial_metrics: {
    otaru_index: number;
    credit_grade: string;
    dsr_percent: number;
    sisa_plafon: number;
    integrity_level: string;
  };
  trust_grade: string;
  recommendation: string;
  generated_at: string;
}

interface BadgeProgress {
  user_id: string;
  month_year: string;
  verified_count: number;
  silver_threshold: number;
  gold_threshold: number;
  has_silver: boolean;
  has_gold: boolean;
  silver_unlocked_at: string | null;
  gold_unlocked_at: string | null;
  interest_discount_pct: number;
  plafon_bonus: number;
  progress_pct: number;
}
type PartnerView = "dashboard" | "api" | "docs" | "pricing" | "queue" | "audit-trail" | "whitelist";

function fmt(value: number): string {
  return value.toLocaleString('id-ID');
}

function fmtNominal(value: number): string {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  return `Rp ${fmt(value)}`;
}

function fmtDate(value?: string | null): string {
  if (!value) return 'Belum pernah dipakai';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function isMaskedKey(value?: string | null): boolean {
  return !!value && value.includes("...");
}

function RiskBadge({ label }: { label: string }) {
  const styles: Record<string, string> = {
    PRIME: 'border-white bg-white text-black',
    MODERATE: 'border-zinc-500 bg-zinc-800 text-white',
    RISK: 'border-red-400/30 bg-red-500/10 text-red-100',
  };
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold tracking-[0.22em] ${styles[label] ?? 'border-zinc-700 bg-zinc-900 text-zinc-200'}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles =
    normalized === 'verified' ? 'border-white/20 bg-white text-black'
    : normalized === 'tampered' ? 'border-red-500/30 bg-red-500/10 text-red-100'
    : 'border-zinc-700 bg-zinc-900 text-zinc-300';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${styles}`}>{status}</span>;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const THEME_STORAGE_KEY = "otaru_portal_theme";

export default function PartnerPortal() {
  const [theme, setTheme] = useState<PortalTheme>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(THEME_STORAGE_KEY) as PortalTheme : null;
    return (saved && themeConfig[saved]) ? saved : "classic";
  });
  const th = themeConfig[theme];

  const handleThemeChange = (t: PortalTheme) => {
    setTheme(t);
    localStorage.setItem(THEME_STORAGE_KEY, t);
  };
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [apiKey, setApiKey] = useState<ApiKeyInfo | null>(null);
  const [decisionApiKey, setDecisionApiKey] = useState<any | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [decisionApiKeyLoading, setDecisionApiKeyLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profilePhone, setProfilePhone] = useState("");
  const [phoneSyncLoading, setPhoneSyncLoading] = useState(false);



  // Gamification badge progress
  const [badgeProgress, setBadgeProgress] = useState<BadgeProgress | null>(null);

  // API Credits tracking
  const [apiCredits, setApiCredits] = useState<number | null>(null);

  const [session, setSession] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [activeView, setActiveViewState] = useState<PartnerView>(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view");
    return (viewParam as PartnerView) || "dashboard";
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get("view");
      setActiveViewState((viewParam as PartnerView) || "dashboard");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const setActiveView = useCallback((viewId: PartnerView) => {
    setActiveViewState(viewId);
    const url = new URL(window.location.href);
    url.searchParams.set("view", viewId);
    window.history.pushState({}, "", url);
  }, []);

  const [showAccessPopup, setShowAccessPopup] = useState(false);
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Partner API Quota — separate from user scan credits (10)
  // Maps subscription_plan → monthly API requests
  const PARTNER_QUOTA: Record<string, number> = {
    free: 50,
    launch: 900,
    scale: 2000,
    enterprise: 10000,
  };

  const [maxApiCredits, setMaxApiCredits] = useState(50);

  useEffect(() => {
    if (!userId) {
      setApiCredits(null);
      return;
    }
    // Read partner_api_credits to determine remaining quota, and subscription_plan for max quota
    supabase.from('profiles').select('subscription_plan, partner_api_credits').eq('id', userId).single()
      .then(({ data }) => {
        const plan = data?.subscription_plan ?? 'free';
        setMaxApiCredits(PARTNER_QUOTA[plan] ?? 50);
        setApiCredits(data?.partner_api_credits ?? 50);
      })
      .catch(() => {
        setApiCredits(50);
        setMaxApiCredits(50);
      });

    // Real-time: if partner_api_credits or subscription_plan changes
    const channel = supabase.channel(`partner-quota:${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, (payload) => {
        const plan = (payload.new as any)?.subscription_plan ?? 'free';
        setMaxApiCredits(PARTNER_QUOTA[plan] ?? 50);
        
        const credits = (payload.new as any)?.partner_api_credits;
        if (credits !== undefined) {
          setApiCredits(credits);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    const close = () => setShowProfileMenu(false);
    if (showProfileMenu) {
      window.addEventListener("click", close);
    }
    return () => window.removeEventListener("click", close);
  }, [showProfileMenu]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  useEffect(() => {
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
        fetchMyDecisionKey();
      } else {
        setShowAccessPopup(false);
        setApiKey(null);
        setDecisionApiKey(null);
      }
      setPageLoading(false);
    });

    fetchStats();

    return () => {
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePartnerLogin() {
    localStorage.setItem("redirect_to_partner", "1");
    const redirectTo = `${window.location.origin}/`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, scopes: "openid email profile" },
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
      if (response.ok) setStats(await response.json());
    } catch {
      setStats(null);
    }
  }

  async function fetchMyKey() {
    setAuthError(null);
    const headers = await getAuthHeader();
    if (!headers.Authorization) { setApiKey(null); return; }
    try {
      const response = await fetch(`${API}/api/v1/apikeys/me`, { headers });
      if (response.status === 401) {
        setAuthError("Session backend tidak valid. Login ulang lalu coba lagi.");
        setApiKey(null);
        return;
      }
      if (response.ok) {
        const data = await response.json();
        const storedRaw = localStorage.getItem(CHAIN_RAW_KEY_STORAGE);
        if (data && isMaskedKey(data.key_value) && storedRaw) {
          setApiKey({ ...data, key_value: storedRaw });
        } else {
          if (data?.key_value && !isMaskedKey(data.key_value)) {
            localStorage.setItem(CHAIN_RAW_KEY_STORAGE, data.key_value);
          }
          setApiKey(data);
        }
      }
    } catch {
      setApiKey(null);
    }
  }


  async function generateKey() {
    setApiKeyLoading(true);
    setAuthError(null);
    try {
      const headers: Record<string, string> = { ...(await getAuthHeader()), "Content-Type": "application/json" };
      if (!headers.Authorization) { setAuthError("Login dulu untuk generate API key."); return; }
      const response = await fetch(`${API}/api/v1/apikeys/generate`, { method: "POST", headers });
      if (response.status === 401) { setAuthError("Token tidak diterima backend. Login ulang lalu generate lagi."); return; }
      if (response.ok) {
        const data = await response.json();
        if (data?.key_value) localStorage.setItem(CHAIN_RAW_KEY_STORAGE, data.key_value);
        setApiKey(data);
      }
    } finally {
      setApiKeyLoading(false);
    }
  }


  async function revokeKey() {
    if (!window.confirm("Revoke API key aktif? Key lama akan langsung tidak bisa dipakai.")) return;
    setApiKeyLoading(true);
    setAuthError(null);
    try {
      const headers = await getAuthHeader();
      if (!headers.Authorization) { setAuthError("Login dulu untuk revoke API key."); return; }
      const response = await fetch(`${API}/api/v1/apikeys/me`, { method: "DELETE", headers });
      if (response.status === 401) { setAuthError("Token tidak diterima backend. Login ulang lalu revoke lagi."); return; }
      setApiKey(null);
    } finally {
      setApiKeyLoading(false);
    }
  }


  async function fetchMyDecisionKey() {
    setAuthError(null);
    const headers = await getAuthHeader();
    if (!headers.Authorization) { setDecisionApiKey(null); return; }
    try {
      const response = await fetch(`${API}/api/v1/decision/apikeys/me`, { headers });
      if (response.status === 401) {
        setDecisionApiKey(null);
        return;
      }
      if (response.ok) {
        const data = await response.json();
        const storedRaw = localStorage.getItem(DECISION_RAW_KEY_STORAGE);
        if (data && isMaskedKey(data.key_value) && storedRaw?.startsWith("dk-")) {
          setDecisionApiKey({ ...data, key_value: storedRaw });
        } else {
          setDecisionApiKey(data);
        }
      }
    } catch {
      setDecisionApiKey(null);
    }
  }

  async function generateDecisionKey() {
    setDecisionApiKeyLoading(true);
    setAuthError(null);
    try {
      const headers: Record<string, string> = { ...(await getAuthHeader()), "Content-Type": "application/json" };
      if (!headers.Authorization) { setAuthError("Login dulu untuk generate Decision key."); return; }
      const response = await fetch(`${API}/api/v1/decision/apikeys/generate`, { method: "POST", headers });
      if (response.status === 401) { setAuthError("Token tidak diterima backend."); return; }
      if (response.ok) {
        const data = await response.json();
        if (data?.key_value) localStorage.setItem(DECISION_RAW_KEY_STORAGE, data.key_value);
        setDecisionApiKey(data);
      }
    } finally {
      setDecisionApiKeyLoading(false);
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

  async function autoFillProfilePhone() {
    setPhoneSyncLoading(true);
    setAuthError(null);
    try {
      const response = await fetch(`${API}/api/v1/profiles/phone/autofill`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAuthError(data.detail || "Gagal auto fill nomor HP.");
        return;
      }
      setProfilePhone(String(data.phone_number || ""));
    } catch {
      setAuthError("Network error saat auto fill nomor HP.");
    } finally {
      setPhoneSyncLoading(false);
    }
  }

  async function saveProfilePhone() {
    setPhoneSyncLoading(true);
    setAuthError(null);
    try {
      const headers: Record<string, string> = {
        ...(await getAuthHeader()),
        "Content-Type": "application/json",
      };
      if (!headers.Authorization) {
        setAuthError("Login dulu untuk simpan nomor HP.");
        return;
      }

      const normalized = profilePhone.replace(/\D/g, "");
      const response = await fetch(`${API}/api/v1/profiles/phone`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phone_number: normalized }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAuthError(data.detail || "Gagal simpan nomor HP.");
        return;
      }

      setProfilePhone(String(data.phone_number || normalized));
    } catch {
      setAuthError("Network error saat simpan nomor HP.");
    } finally {
      setPhoneSyncLoading(false);
    }
  }
  async function handleCheckout(planId: string) {
    setCheckoutError(null);
    setCheckoutLoadingPlan(planId);
    try {
      const headers: Record<string, string> = {
        ...(await getAuthHeader()),
        "Content-Type": "application/json",
      };
      if (!headers.Authorization) {
        setCheckoutError("Login dulu untuk aktivasi paket.");
        return;
      }

      const resp = await fetch(`${API}/api/v1/payment/checkout`, {
        method: "POST",
        headers,
        body: JSON.stringify({ plan: planId }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setCheckoutError(err.detail || "Gagal membuat transaksi pembayaran.");
        return;
      }

      const data = await resp.json();
      if (data?.payment_url) {
        window.location.href = data.payment_url;
        return;
      }
      setCheckoutError("Payment URL tidak ditemukan dari gateway.");
    } catch {
      setCheckoutError("Koneksi ke payment gateway gagal. Coba lagi.");
    } finally {
      setCheckoutLoadingPlan(null);
    }
  }

  return (
    <div className={`min-h-screen ${th.bg} ${theme === "enterprise" ? "text-slate-100" : "text-zinc-900"}`}>
      <header className={`sticky top-0 z-30 border-b ${th.cardBorder} ${th.headerBg} backdrop-blur`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {session && (
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-1.5 -ml-1.5 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div>
              <Link to="/" className="text-lg font-semibold tracking-tight">OtaruChain</Link>
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Partner Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Navigation moved to sidebar */}

            {!session ? (
              <button
                onClick={handlePartnerLogin}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-400"
              >
                Sign In
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                {apiCredits !== null && (
                  <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1.5 sm:px-3 text-xs font-semibold text-blue-700 shadow-sm transition-all cursor-help" title="Sisa Kuota API Validation (Realtime)">
                    <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
                    <span className="hidden sm:inline-block">{apiCredits} / {maxApiCredits} Req</span>
                    <span className="inline-block sm:hidden">{apiCredits}</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    window.location.href = "/";
                  }}
                  title="Ke Dashboard Utama"
                  className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white p-2 text-zinc-700 hover:border-zinc-400 transition-colors"
                >
                  <Home className="h-4 w-4" />
                </button>

                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowProfileMenu(!showProfileMenu);
                    }}
                    title="Profil"
                    className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white p-2 text-zinc-700 hover:border-zinc-400 transition-colors"
                  >
                    <User className="h-4 w-4" />
                  </button>

                  {showProfileMenu && (
                    <div 
                      className="absolute right-0 mt-2 w-40 rounded-xl border border-zinc-200 bg-white shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-zinc-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}


          </div>
        </div>
      </header>

      {showAccessPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Akses aktif</p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-900">Akun kamu bisa akses OtaruChain Partner</h3>
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

      <div className="mx-auto flex max-w-7xl flex-col md:flex-row gap-8 px-4 py-6 sm:px-6 relative">
        {session && isSidebarOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
              onClick={() => setIsSidebarOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-64 shrink-0 bg-white border-r border-zinc-200 p-6 shadow-2xl md:sticky md:top-24 md:z-0 md:h-auto md:bg-transparent md:border-r-0 md:p-0 md:shadow-none animate-in slide-in-from-left-4 md:animate-none">
              <div className="flex items-center justify-between md:hidden mb-6">
                <span className="font-semibold text-zinc-900">Menu</span>
                <button onClick={() => setIsSidebarOpen(false)} className="p-1 text-zinc-500 hover:bg-zinc-100 rounded-full">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex flex-col gap-2">
                {(
                  [
                    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                    { id: "api", label: "API Key", icon: KeyRound },
                    { id: "docs", label: "Docs", icon: TerminalSquare },
                    { id: "pricing", label: "Pricing", icon: Wallet },
                    { id: "queue", label: "Approval Queue", icon: ClipboardList },
                    { id: "audit-trail", label: "Audit Trail", icon: BarChart3 },
                    { id: "whitelist", label: "Whitelist HP", icon: Users },
                  ] as Array<{ id: PartnerView; label: string; icon: React.ComponentType<{ className?: string }> }>
                ).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveView(item.id);
                        if (window.innerWidth < 768) setIsSidebarOpen(false);
                      }}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                        activeView === item.id
                          ? "bg-black text-white"
                          : "border border-transparent text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      <Icon className="h-4 w-4" /> {item.label}
                    </button>
                  );
                })}
              </nav>
            </aside>
          </>
        )}

        <main className="flex-1 min-w-0">

        {!session ? (
          <section className="rounded-3xl border border-zinc-200 bg-white p-8 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">OtaruChain Partner Access</p>
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
              <PartnerDashboardTab stats={stats} setActiveView={setActiveView as any} />
            )}

            {activeView === "api" && (
              <section className="space-y-5">
                <PartnerApiKeysView
                  apiKey={apiKey}
                  decisionApiKey={decisionApiKey}
                  apiKeyLoading={apiKeyLoading}
                  decisionApiKeyLoading={decisionApiKeyLoading}
                  pageLoading={pageLoading}
                  authError={authError}
                  fmtDate={fmtDate}
                  isMaskedKey={isMaskedKey}
                  generateKey={generateKey}
                  generateDecisionKey={generateDecisionKey}
                  revokeKey={revokeKey}
                  fetchMyKey={fetchMyKey}
                  handleCopy={handleCopy}
                  profilePhone={profilePhone}
                  phoneSyncLoading={phoneSyncLoading}
                  onProfilePhoneChange={setProfilePhone}
                  onAutoFillPhone={autoFillProfilePhone}
                  onSavePhone={saveProfilePhone}
                />

                <PartnerPlaygrounds
                  apiKey={apiKey}
                  decisionApiKey={decisionApiKey}
                  API={API}
                  fmtNominal={fmtNominal}
                />
              </section>
            )}

            {activeView === "docs" && (
              <PartnerDocsTab
                apiKey={apiKey}
                isMaskedKey={isMaskedKey}
                API={API}
                copiedLabel={copiedLabel}
                handleCopy={handleCopy}
                th={th}
                theme={theme}
              />
            )}

            {activeView === "pricing" && (
              <PartnerPricingTab
                checkoutError={checkoutError}
                checkoutLoadingPlan={checkoutLoadingPlan}
                handleCheckout={handleCheckout}
              />
            )}

            { activeView === "queue" && (
              <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <ApprovalQueueTab />
              </section>
            )}

            { activeView === "audit-trail" && (
              <PartnerAuditTrailTab />
            )}

            { activeView === "whitelist" && (
              <section className="space-y-5">
                <div className="mb-2">
                  <h2 className="text-xl font-semibold text-zinc-900">Kelola Whitelist Karyawan</h2>
                  <p className="text-sm text-zinc-500 mt-1">
                    Tambah, hapus, atau upload daftar nomor HP karyawan yang berhak mengakses OtaruChain.
                  </p>
                </div>
                <WhitelistManagement />
              </section>
            )}
          </>
        )}
        </main>
      </div>
      <ScrollNavigator bottomOffsetClass="bottom-6" />
    </div>
  );
}
