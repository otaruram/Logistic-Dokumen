export interface HargaPlan {
  id: string;
  name: string;
  price: string;
  cadence: string;
  volume: string;
  notes: string;
  costBreakdown: string[];
  accent: string;
}

export const pricingPlans: HargaPlan[] = [
  {
    id: "developer",
    name: "Developer",
    price: "Rp 0",
    cadence: "/bulan",
    volume: "10 Request / bulan (Hard Limit)",
    notes: "Developer individu atau pengujian internal Koperasi (PoC).",
    costBreakdown: [
      "Core OtaruChain Engine",
      "SHA-256 Document Stamping",
      "Baseline Fraud Filter",
    ],
    accent: "free",
  },
  {
    id: "launch",
    name: "Launch",
    price: "Rp 599.000",
    cadence: "/bulan",
    volume: "Up to 900 Request / bulan",
    notes: "Koperasi mikro yang memulai pilot underwriting kredit pertama.",
    costBreakdown: [
      "Unified Decision Gate API",
      "2 Admin Seats",
      "SLA Max 24 jam verifikasi",
    ],
    accent: "starter",
  },
  {
    id: "scale",
    name: "Scale",
    price: "Rp 1.499.000",
    cadence: "/bulan",
    volume: "Up to 2.000 Request / bulan",
    notes: "Koperasi logistik aktif dengan underwriting harian & burst handling.",
    costBreakdown: [
      "Advanced Decision Gate API",
      "5 Admin Seats",
      "SLA Prioritas < 2 jam",
    ],
    accent: "growth",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Rp 3.999.000",
    cadence: "/bulan",
    volume: "Up to 10.000 Request / bulan + SLA 99.9%",
    notes: "Jaringan koperasi berskala nasional atau volume tinggi.",
    costBreakdown: [
      "Dedicated Support & Custom Integrations",
      "Unlimited Admin Seats",
      "White-label portal opsional",
    ],
    accent: "enterprise",
  },
];
