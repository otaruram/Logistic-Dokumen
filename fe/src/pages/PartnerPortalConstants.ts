export const pricingPlans = [
  {
    id: 'free',
    name: 'GRATIS',
    price: 'Rp 0',
    cadence: '/ bulan',
    volume: '10 Request / bulan',
    target: 'Developer individu atau pengujian internal Koperasi (PoC).',
    coreValue: 'Akses ke Core OtaruChain Engine, SHA-256 Data Stamping, dan Baseline Fraud Filter.',
    limitations: 'Waktu respons best-effort (Antrean standar), 1 Akun Developer.',
    notes: [
      'Banking-Grade Security & Standar OJK/UU PDP',
      'Immutable Audit Trail (SHA-256 Stamping)',
      'Fraud Screening / Verification Guard',
      'Pencarian data murni menggunakan Nomor HP',
    ],
    accent: 'free',
  },
  {
    id: 'launch',
    name: 'LAUNCH',
    price: 'Rp 299.000',
    cadence: '/ bulan',
    volume: '30 Request / hari (~900/bulan)',
    target: 'Koperasi kecil atau LJK mikro yang memulai pilot underwriting kredit pertama mereka.',
    coreValue: 'Semua fitur Gratis + Akses ke Unified Decision Gate (Credit Readiness).',
    limitations: 'SLA Standar (Maksimal 24 jam verifikasi dokumen via Human-in-the-loop), 2 Akses Admin Partner.',
    notes: [
      'Banking-Grade Security & Standar OJK/UU PDP',
      'Immutable Audit Trail (SHA-256 Stamping)',
      'Fraud Screening / Verification Guard',
      'Pencarian data murni menggunakan Nomor HP',
    ],
    accent: 'starter',
  },
  {
    id: 'growth',
    name: 'GROWTH',
    price: 'Rp 999.000',
    cadence: '/ bulan',
    volume: '2.000 Request / bulan',
    target: 'Koperasi atau Jaringan Partner Logistik yang sedang berkembang dengan proses underwriting harian aktif.',
    coreValue: 'Semua fitur Launch + Advanced Decision Gate API.',
    limitations: 'SLA Respons Prioritas (Di bawah 2 jam), Kemampuan Burst Handling, 5 Akses Admin Partner, dashboard analitik penuh.',
    notes: [
      'Banking-Grade Security & Standar OJK/UU PDP',
      'Immutable Audit Trail (SHA-256 Stamping)',
      'Fraud Screening / Verification Guard',
      'Pencarian data murni menggunakan Nomor HP',
    ],
    accent: 'growth',
  },
  {
    id: 'enterprise',
    name: 'ENTERPRISE',
    price: 'Rp 2.499.000',
    cadence: '/ bulan',
    volume: '10.000 Request / bulan',
    target: 'Jaringan koperasi berskala nasional atau LJK dengan volume transaksi tinggi.',
    coreValue: 'Semua fitur Growth + Dedicated Support, SLA 99.9%, dan Custom Integrations.',
    limitations: 'Unlimited Admin Partner, White-label portal opsional, Private Slack channel.',
    notes: [
      'Banking-Grade Security & Standar OJK/UU PDP',
      'Immutable Audit Trail (SHA-256 Stamping)',
      'Fraud Screening / Verification Guard',
      'Pencarian data murni menggunakan Nomor HP',
    ],
    accent: 'enterprise',
  },
];

export const partnerProducts = [
  {
    name: 'OtaruChain API',
    subtitle: 'Document intelligence + fraud signal',
    targetMarket: 'P2P lending, koperasi, aggregator invoice, dan partner yang perlu validasi dokumen cepat.',
    bullets: [
      'Audit dokumen dan fraud signal untuk screening awal.',
      'Trust score berbasis transaksi dan integrity seal.',
    ],
    endpoints: [
      'GET /api/partner/v1/user-audit-by-phone/{phone}',
    ],
    keyLabel: 'OtaruChain Key',
  },

  {
    name: 'Unified Decision Gate API',
    subtitle: 'Combined chain & financial data',
    bullets: [
      'Gabungan trust score dokumen dan financial capacity.',
      'Satu lookup mendapatkan credit grade final.',
      'Sangat optimal untuk automated decision underwriting.',
    ],
    targetMarket: 'Institusi yang butuh complete credit intelligence dalam satu integrasi.',
    endpoints: [
      'GET /api/v1/partner/lookup-by-phone/{phone}',
    ],
    keyLabel: 'Otaru Decision Key',
  },
];

export type PortalTheme = "classic" | "modern" | "minimal" | "enterprise";

export const themeConfig: Record<PortalTheme, {
  label: string;
  bg: string;
  headerBg: string;
  cardBg: string;
  cardBorder: string;
  primaryBtn: string;
  accentText: string;
  subtleText: string;
  badge: string;
}> = {
  classic: {
    label: "Classic",
    bg: "bg-zinc-100",
    headerBg: "bg-white/90",
    cardBg: "bg-white",
    cardBorder: "border-zinc-200",
    primaryBtn: "bg-black text-white hover:bg-zinc-800",
    accentText: "text-zinc-900",
    subtleText: "text-zinc-500",
    badge: "bg-black text-white",
  },
  modern: {
    label: "Modern",
    bg: "bg-gradient-to-br from-violet-50 via-white to-blue-50",
    headerBg: "bg-white/80 backdrop-blur",
    cardBg: "bg-white",
    cardBorder: "border-violet-100",
    primaryBtn: "bg-violet-600 text-white hover:bg-violet-700",
    accentText: "text-violet-900",
    subtleText: "text-violet-400",
    badge: "bg-violet-600 text-white",
  },
  minimal: {
    label: "Minimal",
    bg: "bg-white",
    headerBg: "bg-white",
    cardBg: "bg-gray-50",
    cardBorder: "border-gray-100",
    primaryBtn: "bg-gray-900 text-white hover:bg-gray-700",
    accentText: "text-gray-900",
    subtleText: "text-gray-400",
    badge: "bg-gray-900 text-white",
  },
  enterprise: {
    label: "Enterprise",
    bg: "bg-slate-950",
    headerBg: "bg-slate-900/95",
    cardBg: "bg-slate-900",
    cardBorder: "border-slate-700",
    primaryBtn: "bg-blue-600 text-white hover:bg-blue-500",
    accentText: "text-slate-100",
    subtleText: "text-slate-400",
    badge: "bg-blue-600 text-white",
  },
};
