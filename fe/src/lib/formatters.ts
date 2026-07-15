/**
 * Number and date formatting utilities — shared across Portal Mitra and other pages.
 */

export function fmt(value: number): string {
  return value.toLocaleString("id-ID");
}

export function fmtRp(value: number): string {
  return "Rp " + fmt(value);
}

export function fmtNominal(value: number): string {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  return fmtRp(value);
}

export function fmtTanggal(value?: string | null): string {
  if (!value) return "Belum pernah dipakai";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
