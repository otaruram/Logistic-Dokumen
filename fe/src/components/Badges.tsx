/**
 * Shared badge components used in Partner Portal and other pages.
 */

export function RiskBadge({ label }: { label: string }) {
  const styles: Record<string, string> = {
    PRIME: "border-white bg-white text-black",
    MODERATE: "border-zinc-500 bg-zinc-800 text-white",
    RISK: "border-red-400/30 bg-red-500/10 text-red-100",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold tracking-[0.22em] ${
        styles[label] ?? "border-zinc-700 bg-zinc-900 text-zinc-200"
      }`}
    >
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles =
    normalized === "verified"
      ? "border-white/20 bg-white text-black"
      : normalized === "tampered"
      ? "border-red-500/30 bg-red-500/10 text-red-100"
      : "border-zinc-700 bg-zinc-900 text-zinc-300";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${styles}`}
    >
      {status}
    </span>
  );
}
