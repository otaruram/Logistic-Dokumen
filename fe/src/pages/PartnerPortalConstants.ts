export const pricingPlans = [
  {
    id: 'free',
    name: 'GRATIS SELAMANYA',
    price: 'Rp 0',
    cadence: '/ bulan',
    volume: '50 Request / bulan',
    target: 'Cocok untuk mencoba dan mengenal sistem dasar.',
    coreValue: 'Validasi manual admin, Tanpa AI/ML scoring.',
    limitations: 'Waktu respons best-effort (Antrean standar), 1 Akun Developer.',
    notes: [
      'Banking-Grade Security & Standar OJK/UU PDP',
      'Immutable Jejak Audit (SHA-256 Stamping)',
      'Pencarian data murni menggunakan Nomor HP',
    ],
    accent: 'free',
  },
  {
    id: 'launch',
    name: 'LAUNCH',
    price: 'Rp 599.000',
    cadence: '/ bulan',
    volume: '600 request ekstraksi AI',
    target: 'Ditujukan untuk Kopkar skala kecil.',
    coreValue: 'Semua fitur Developer + Unified Decision Gate API.',
    limitations: 'Max 24 jam verifikasi, 2 Admin Partner Seats.',
    notes: [
      'Banking-Grade Security & Standar OJK/UU PDP',
      'Immutable Jejak Audit (SHA-256 Stamping)',
      'Gemini 2.5 Flash Screening',
      'Akses Rekaman Video Edukasi Eksklusif',
      'Standard Operational SOP Templates',
      'Akses OtaruChain Mitra Community',
    ],
    accent: 'starter',
  },
  {
    id: 'growth',
    name: 'SCALE',
    price: 'Rp 1.290.000',
    cadence: '/ bulan',
    volume: '2.000 request ekstraksi AI',
    target: 'Ditujukan untuk Kopkar skala menengah.',
    coreValue: 'Semua fitur Launch + Advanced Decision Gate API & Full Analytics Dasbor.',
    limitations: 'Prioritas < 2 jam, Kemampuan Burst Handling, 5 Akses Admin Partner.',
    notes: [
      'Banking-Grade Security & Standar OJK/UU PDP',
      'Immutable Jejak Audit (SHA-256 Stamping)',
      'Gemini 2.5 Flash Screening',
      '1x Sesi Live Workshop/Konsultasi Tatap Maya',
      'Sertifikat Implementasi Digital OtaruChain',
      'OtaruChain Mitra Community (Priority Access)',
    ],
    accent: 'growth',
  },
  {
    id: 'enterprise',
    name: 'ENTERPRISE',
    price: 'Custom',
    cadence: '',
    volume: '10.000+ Request / bulan',
    target: 'Kapasitas tak terbatas dan dukungan khusus untuk Koperasi berskala besar.',
    coreValue: 'Semua fitur Scale + Dedicated Support dan Custom Integrations.',
    limitations: 'Unlimited Admin Partner, White-label portal opsional, Private Slack channel.',
    notes: [
      'Banking-Grade Security & Standar OJK/UU PDP',
      'Immutable Jejak Audit (SHA-256 Stamping)',
      'Gemini 2.5 Flash Screening',
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
