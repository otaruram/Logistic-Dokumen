/**
 * OtaruChain — Premium Partner Audit Dashboard View
 *
 * Renders a comprehensive, visually stunning banking dashboard
 * from the /api/partner/v1/user-audit/{email} JSON response.
 *
 * Sections:
 * 1. Header with user info + risk badge
 * 2. Credit Score with circular progress (cycle-aware)
 * 3. Transaction summary with period breakdown
 * 4. Integrity Seal status
 * 5. Risk Assessment with factor breakdown
 * 6. Audit Log timeline
 */

import React, { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  Clock,
  FileCheck,
  AlertTriangle,
  Activity,
  Lock,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface PeriodSummary {
  count: number;
  nominal: number;
}

interface AuditData {
  user: { email: string; user_id: string };
  credit_score: {
    current_cycle: number;
    current_cycle_score: number;
    cycle_max: number;
    lifetime_score: number;
    completed_cycles: number;
  };
  risk: {
    risk_level: string;
    risk_score: number;
    factors: Array<{
      name: string;
      score: number;
      max?: number;
      weight?: string;
      detail: string;
    }>;
  };
  transactions: {
    total: number;
    verified: number;
    tampered: number;
    processing: number;
    total_nominal: number;
    by_period: Record<string, PeriodSummary>;
  };
  integrity: {
    total_sealed: number;
    verified_seals: number;
    tampered_seals: number;
    unsealed: number;
    integrity_rate: number;
  };
  audit_log: Array<{
    scan_id: string;
    status: string;
    nominal: number;
    doc_type: string | null;
    vendor_name: string | null;
    created_at: string;
    integrity_status: string;
  }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtNominal(value: number): string {
  if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}jt`;
  return `Rp${value.toLocaleString("id-ID")}`;
}

function fmtDate(isoStr: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoStr));
  } catch {
    return isoStr;
  }
}

function fmtShortDate(isoStr: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
    }).format(new Date(isoStr));
  } catch {
    return isoStr;
  }
}

const RISK_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  LOW: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", glow: "shadow-emerald-500/20" },
  MEDIUM: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", glow: "shadow-amber-500/20" },
  HIGH: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", glow: "shadow-red-500/20" },
};

const STATUS_STYLES: Record<string, string> = {
  verified: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  tampered: "bg-red-500/15 text-red-400 border-red-500/30",
  processing: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const INTEGRITY_STYLES: Record<string, string> = {
  VERIFIED: "text-emerald-400",
  TAMPERED: "text-red-400",
  UNSEALED: "text-zinc-500",
};

// ── Sub-Components ───────────────────────────────────────────────────────────

function RiskBadgeLarge({ level }: { level: string }) {
  const colors = RISK_COLORS[level] || RISK_COLORS.HIGH;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold tracking-[0.2em] ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {level === "LOW" ? (
        <ShieldCheck className="h-4 w-4" />
      ) : level === "MEDIUM" ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <ShieldAlert className="h-4 w-4" />
      )}
      {level} RISK
    </span>
  );
}

function CircularProgress({
  value,
  max,
  size = 180,
  strokeWidth = 12,
  color,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

function FactorBar({ name, score, detail, weight }: {
  name: string;
  score: number;
  detail: string;
  weight?: string;
}) {
  const pct = Math.min(score, 100);
  const barColor =
    pct <= 33 ? "bg-emerald-500" : pct <= 66 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-zinc-300">{name}</span>
        <div className="flex items-center gap-2">
          {weight && (
            <span className="text-zinc-600 text-[10px]">{weight}</span>
          )}
          <span className="font-mono text-zinc-400">{score}/100</span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-zinc-500">{detail}</p>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface PartnerAuditViewProps {
  data: AuditData;
}

export default function PartnerAuditView({ data }: PartnerAuditViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [showAllLogs, setShowAllLogs] = useState(false);

  const { credit_score, risk, transactions, integrity, audit_log } = data;

  const periodData = transactions.by_period[selectedPeriod] || {
    count: transactions.total,
    nominal: transactions.total_nominal,
  };

  const scoreColor =
    credit_score.current_cycle_score >= 800
      ? "#10b981"
      : credit_score.current_cycle_score >= 500
      ? "#f59e0b"
      : credit_score.current_cycle_score >= 300
      ? "#f97316"
      : "#ef4444";

  const integrityColor =
    integrity.integrity_rate >= 90
      ? "#10b981"
      : integrity.integrity_rate >= 70
      ? "#f59e0b"
      : "#ef4444";

  const riskColors = RISK_COLORS[risk.risk_level] || RISK_COLORS.HIGH;

  const visibleLogs = showAllLogs ? audit_log : audit_log.slice(0, 10);

  return (
    <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {/* ── 1. Header ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              OtaruChain · User Audit Report
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {data.user.email}
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-zinc-600">
              UID: {data.user.user_id.slice(0, 12)}...
            </p>
          </div>
          <RiskBadgeLarge level={risk.risk_level} />
        </div>
      </div>

      {/* ── 2. Credit Score + Cycles ──────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-zinc-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">
              Credit Score · Cycle {credit_score.current_cycle}
            </span>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative">
              <CircularProgress
                value={credit_score.current_cycle_score}
                max={credit_score.cycle_max}
                color={scoreColor}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-4xl font-bold text-white"
                  style={{ textShadow: `0 0 30px ${scoreColor}30` }}
                >
                  {credit_score.current_cycle_score}
                </span>
                <span className="text-xs text-zinc-500">
                  / {credit_score.cycle_max}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Lifetime
              </p>
              <p className="text-lg font-bold text-white">
                {credit_score.lifetime_score.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Cycles
              </p>
              <p className="text-lg font-bold text-white">
                {credit_score.completed_cycles}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Current
              </p>
              <p className="text-lg font-bold text-white">
                Cycle {credit_score.current_cycle}
              </p>
            </div>
          </div>
        </div>

        {/* ── Risk Assessment ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-zinc-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">
                Risk Assessment
              </span>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${riskColors.bg} ${riskColors.text} border ${riskColors.border}`}
            >
              Score: {risk.risk_score}/100
            </span>
          </div>

          {/* Risk Gauge */}
          <div className="mb-5">
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${risk.risk_score}%`,
                  background:
                    risk.risk_score <= 33
                      ? "linear-gradient(90deg, #10b981, #34d399)"
                      : risk.risk_score <= 66
                      ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                      : "linear-gradient(90deg, #ef4444, #f87171)",
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
              <span>LOW</span>
              <span>MEDIUM</span>
              <span>HIGH</span>
            </div>
          </div>

          {/* Factor Breakdown */}
          <div className="space-y-3">
            {risk.factors.map((f, i) => (
              <FactorBar
                key={i}
                name={f.name}
                score={f.score}
                detail={f.detail}
                weight={f.weight}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── 3. Transaction Summary ────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-zinc-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">
              Transaction Summary
            </span>
          </div>
          <div className="flex gap-1 rounded-xl bg-white/5 p-1">
            {[
              { key: "30d", label: "30D" },
              { key: "6m", label: "6M" },
              { key: "1y", label: "1Y" },
              { key: "all", label: "All" },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setSelectedPeriod(p.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  selectedPeriod === p.key
                    ? "bg-white text-black shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Transactions
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {periodData.count}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Total Nominal
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {fmtNominal(periodData.nominal)}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wider text-emerald-600">
              Verified
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-400">
              {transactions.verified}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wider text-red-600">
              Tampered
            </p>
            <p className="mt-1 text-2xl font-bold text-red-400">
              {transactions.tampered}
            </p>
          </div>
        </div>
      </div>

      {/* ── 4. Integrity Seal Status ──────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-4 w-4 text-zinc-400" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">
            SHA-256 Integrity Seal
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex-1">
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${integrity.integrity_rate}%`,
                  backgroundColor: integrityColor,
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-white">
                {integrity.integrity_rate}% Integrity
              </span>
              <span className="text-xs text-zinc-500">
                {integrity.verified_seals} / {integrity.total_sealed} seals
                verified
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[
            {
              label: "Sealed",
              value: integrity.total_sealed,
              color: "text-white",
            },
            {
              label: "Verified",
              value: integrity.verified_seals,
              color: "text-emerald-400",
            },
            {
              label: "Tampered",
              value: integrity.tampered_seals,
              color: "text-red-400",
            },
            {
              label: "Unsealed",
              value: integrity.unsealed,
              color: "text-zinc-500",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-white/5 p-2">
              <p className="text-[9px] uppercase tracking-wider text-zinc-600">
                {item.label}
              </p>
              <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. Audit Log Timeline ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">
              Audit Log
            </span>
          </div>
          <span className="text-[10px] text-zinc-600">
            {audit_log.length} entries
          </span>
        </div>

        {visibleLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileCheck className="h-10 w-10 text-zinc-800 mb-2" />
            <p className="text-sm text-zinc-500">No audit records found</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[18px] top-0 bottom-0 w-px bg-zinc-800" />

            <div className="space-y-0">
              {visibleLogs.map((entry, i) => {
                const statusStyle =
                  STATUS_STYLES[entry.status] || STATUS_STYLES.processing;
                const integrityStyle =
                  INTEGRITY_STYLES[entry.integrity_status] ||
                  INTEGRITY_STYLES.UNSEALED;

                return (
                  <div
                    key={entry.scan_id}
                    className="relative flex gap-4 py-3 pl-2 group"
                  >
                    {/* Timeline dot */}
                    <div
                      className={`relative z-10 mt-1 h-[9px] w-[9px] flex-shrink-0 rounded-full border-2 ${
                        entry.status === "verified"
                          ? "border-emerald-500 bg-emerald-500/30"
                          : entry.status === "tampered"
                          ? "border-red-500 bg-red-500/30"
                          : "border-zinc-600 bg-zinc-800"
                      }`}
                    />

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${statusStyle}`}
                        >
                          {entry.status}
                        </span>
                        {entry.doc_type && (
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
                            {entry.doc_type}
                          </span>
                        )}
                        <span className={`text-[10px] ${integrityStyle}`}>
                          {entry.integrity_status === "VERIFIED"
                            ? "🔏 Sealed"
                            : entry.integrity_status === "TAMPERED"
                            ? "⚠️ Broken Seal"
                            : "○ Unsealed"}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-semibold text-white">
                          {fmtNominal(entry.nominal)}
                        </span>
                        {entry.vendor_name && (
                          <span className="text-zinc-500">
                            {entry.vendor_name}
                          </span>
                        )}
                        <span className="text-zinc-600">
                          {fmtDate(entry.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {audit_log.length > 10 && !showAllLogs && (
              <button
                onClick={() => setShowAllLogs(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-white/[0.02] py-2.5 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Show all {audit_log.length} entries
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-800/50 bg-zinc-950/50 px-4 py-3">
        <p className="text-[10px] text-zinc-600">
          Powered by{" "}
          <a
            href="https://otaruchain.my.id"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-white transition-colors"
          >
            otaruchain.my.id
          </a>
        </p>
        <div className="flex items-center gap-1 text-[10px] text-zinc-600">
          <Lock className="h-3 w-3" />
          SHA-256 Verified
        </div>
      </div>
    </div>
  );
}
