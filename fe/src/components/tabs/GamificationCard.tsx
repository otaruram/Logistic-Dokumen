import React, { useEffect, useState } from "react";
import { Shield, Trophy, Star, Award, AlertTriangle, Zap, CheckCircle2, FlaskConical } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { APP_CONFIG } from "@/constants";

const API_URL = APP_CONFIG.apiUrl;

// ── Types ─────────────────────────────────────────────────────────────────────
interface BadgeData {
  verified_count: number;
  has_silver: boolean;
  has_gold: boolean;
  has_platinum: boolean;
  silver_threshold?: number;
  gold_threshold?: number;
  platinum_threshold?: number;
  streak_broken: boolean;
  month_year?: string;
  gold_context_tba?: string;
  platinum_context_tba?: string;
}

// ── Tier config ───────────────────────────────────────────────────────────────
const TIERS = [
  {
    key: "silver",
    label: "Silver",
    threshold: 50,
    unit: "Dokumen",
    status: "Trusted",
    benefits: ["Verified Badge"],
    icon: Award,
    activeClasses: "border-slate-400/40 bg-slate-400/5 shadow-[0_0_20px_-4px_rgba(148,163,184,0.2)]",
    glowClasses: "",
    labelColor: "text-slate-300",
    iconColor: "text-slate-300",
    badgeColor: "bg-slate-700 text-slate-300",
    barGradient: "from-slate-400 to-slate-300",
  },
  {
    key: "gold",
    label: "Gold",
    threshold: 150,
    unit: "Dokumen",
    status: "Priority",
    benefits: ["Bonus Plafon +Rp 1 Jt", "Diskon Bunga 0.5%"],
    icon: Star,
    activeClasses: "border-amber-500/40 bg-amber-500/5 shadow-[0_0_24px_-4px_rgba(245,158,11,0.35)]",
    glowClasses: "",
    labelColor: "text-amber-300",
    iconColor: "text-amber-400",
    badgeColor: "bg-amber-900/60 text-amber-300 border border-amber-700/50",
    barGradient: "from-amber-500 to-yellow-400",
  },
  {
    key: "platinum",
    label: "Platinum",
    threshold: 250,
    unit: "Dokumen",
    status: "VIP",
    benefits: ["Bonus Plafon +Rp 2.5 Jt", "Diskon Bunga 1.0%"],
    icon: Trophy,
    activeClasses: "border-violet-500/40 bg-violet-500/5 shadow-[0_0_28px_-4px_rgba(139,92,246,0.4)]",
    glowClasses: "",
    labelColor: "text-violet-300",
    iconColor: "text-violet-400",
    badgeColor: "bg-violet-900/60 text-violet-300 border border-violet-700/50",
    barGradient: "from-indigo-500 to-violet-400",
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function GamificationCard() {
  const [badge, setBadge] = useState<BadgeData | null>(null);
  const [gLoading, setGLoading] = useState(true);

  useEffect(() => {
    const fetchBadge = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(`${API_URL}/api/v1/gamification/progress`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) setBadge(await res.json());
      } catch {
        // Gamification is optional — fail silently
      } finally {
        setGLoading(false);
      }
    };
    fetchBadge();
  }, []);

  const silverThreshold = badge?.silver_threshold ?? 50;
  const goldThreshold = badge?.gold_threshold ?? 150;
  const platinumThreshold = badge?.platinum_threshold ?? 250;
  const verified = badge?.verified_count ?? 148;
  const hasSilver  = badge?.has_silver  ?? (verified >= silverThreshold);
  const hasGold    = badge?.has_gold    ?? (verified >= goldThreshold);
  const hasPlatinum = badge?.has_platinum ?? (verified >= platinumThreshold);
  const hasTamperedDoc = badge?.streak_broken ?? false;
  const goldContext = badge?.gold_context_tba || "TBA: benefit Gold aktif setelah verifikasi risiko internal koperasi.";
  const platinumContext = badge?.platinum_context_tba || "TBA: benefit Platinum aktif setelah validasi partner + governance check.";

  // Current tier for header badge
  const currentTier = hasPlatinum ? TIERS[2] : hasGold ? TIERS[1] : hasSilver ? TIERS[0] : null;

  // Progress toward next threshold
  const nextTarget = verified < silverThreshold
    ? silverThreshold
    : verified < goldThreshold
    ? goldThreshold
    : platinumThreshold;
  const progressPct = Math.min((verified / Math.max(1, nextTarget)) * 100, 100);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 sm:p-6 space-y-4 sm:space-y-5 relative overflow-hidden w-full box-border">

      {/* Ambient glow */}
      {!hasTamperedDoc && currentTier && (
        <div className={`absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-[0.07] blur-3xl pointer-events-none bg-gradient-to-br ${currentTier.barGradient}`} />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            hasTamperedDoc
              ? "bg-slate-800 border border-slate-700"
              : currentTier
              ? `bg-gradient-to-br ${currentTier.barGradient}`
              : "bg-slate-800 border border-slate-700"
          }`}>
            <Trophy className={`w-5 h-5 ${hasTamperedDoc || !currentTier ? "text-slate-600" : "text-black"}`} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-sm truncate">Consistency Mission</h3>
            <p className="text-[11px] text-slate-500 truncate">{badge?.month_year || "Mei 2026"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {currentTier && (
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${currentTier.badgeColor}`}>
              {currentTier.label}
            </span>
          )}
        </div>
      </div>

      {/* ── Zero-Tolerance Alert ────────────────────────────────────────────── */}
      {hasTamperedDoc && (
        <div className="rounded-xl border border-red-800/60 bg-red-950/40 p-3 sm:p-4 flex gap-3 w-full">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 rounded-lg bg-red-900/60 border border-red-800/60 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-red-300">Streak Reset</p>
            <p className="text-xs text-red-400 mt-0.5 leading-relaxed">
              Dokumen <span className="font-bold uppercase tracking-wider">TAMPERED</span> terdeteksi bulan ini.
            </p>
            <p className="text-xs text-red-500/80 mt-1 leading-relaxed">
              Badge dan benefit bulan ini ditangguhkan (Zero-Tolerance Policy).
            </p>
          </div>
        </div>
      )}

      {/* ── Progress Bar ───────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Dokumen Verified</span>
          <span className={`font-bold tabular-nums ${hasTamperedDoc ? "text-red-400" : "text-slate-300"}`}>
            {gLoading ? "—" : verified}
            <span className="text-slate-600 font-normal"> / {nextTarget}</span>
          </span>
        </div>
        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              hasTamperedDoc
                ? "bg-gradient-to-r from-red-600 to-amber-500"
                : `bg-gradient-to-r ${currentTier?.barGradient ?? "from-orange-500 to-amber-400"}`
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-700">
          <span>0</span>
          <span className="flex items-center gap-1"><Award className="w-2.5 h-2.5" />{silverThreshold}</span>
          <span className="flex items-center gap-1"><Star className="w-2.5 h-2.5 text-amber-600" />{goldThreshold}</span>
          <span>💎 {platinumThreshold}</span>
        </div>
      </div>

      {/* ── Tier Cards Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TIERS.map((tier) => {
          const unlocked = (
            tier.key === "silver" ? hasSilver :
            tier.key === "gold"   ? hasGold   : hasPlatinum
          );
          const Icon = tier.icon;
          return (
            <div
              key={tier.key}
              className={`rounded-xl border p-4 transition-all duration-300 ${
                hasTamperedDoc
                  ? unlocked
                    ? "border-red-700/30 bg-red-950/10"
                    : "border-slate-800 bg-slate-900/30 opacity-70"
                  : unlocked
                  ? tier.activeClasses
                  : "border-slate-800 bg-slate-900/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 flex-shrink-0 ${unlocked ? tier.iconColor : "text-slate-700"}`} />
                  <span className={`text-xs font-bold ${unlocked ? tier.labelColor : "text-slate-700"}`}>{tier.label}</span>
                </div>
                {unlocked && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              </div>
              <p className={`text-[10px] mb-2 ${unlocked ? "text-slate-500" : "text-slate-700"}`}>
                ≥ {tier.key === "silver" ? silverThreshold : tier.key === "gold" ? goldThreshold : platinumThreshold} {tier.unit} · {tier.status}
              </p>
              <div className="space-y-1">
                {tier.benefits.map((b) => (
                  <p key={b} className={`text-[11px] font-medium ${unlocked ? tier.labelColor : "text-slate-700"}`}>
                    + {b}
                  </p>
                ))}
              </div>
              {(tier.key === "gold" || tier.key === "platinum") && (
                <p className={`mt-2 text-[10px] leading-relaxed ${unlocked ? "text-slate-500" : "text-slate-700"}`}>
                  {tier.key === "gold" ? goldContext : platinumContext}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Security Footer ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4 flex flex-col sm:flex-row items-start gap-3 w-full">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
          <Shield className="h-4 w-4 text-slate-500" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-[11px] font-bold text-slate-400">Cryptographic Security Active</p>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-[10px] text-slate-600 leading-relaxed">
            Semua dokumen diproses menggunakan algoritma Anti-Fraud (SHA-256).
            Dokumen bertanda Tampered tidak akan dihitung ke dalam Total Pendapatan atau skor kredit.
          </p>
        </div>
      </div>
    </div>
  );
}
