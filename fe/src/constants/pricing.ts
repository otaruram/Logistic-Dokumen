export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  cadence: string;
  volume: string;
  notes: string;
  costBreakdown: string[];
  accent: string;
}

export const pricingPlans: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "Rp128.000",
    cadence: "/bulan",
    volume: "Up to 10.000.000 input tokens + 2.000.000 output tokens / bulan",
    notes: "Cocok untuk pilot koperasi internal dan validasi awal anti-fraud OCR.",
    costBreakdown: [
      "LLM Input: $0.15 / 1M tokens",
      "LLM Output: $0.60 / 1M tokens",
      "VPS aktif: Rp60.000 / bulan",
    ],
    accent: "starter",
  },
  {
    id: "growth",
    name: "Growth",
    price: "Rp349.000",
    cadence: "/bulan",
    volume: "Up to 35.000.000 input tokens + 8.000.000 output tokens / bulan",
    notes: "Untuk partner dengan volume tinggi dan kebutuhan SLA operasional harian.",
    costBreakdown: [
      "LLM Input: $0.15 / 1M tokens",
      "LLM Output: $0.60 / 1M tokens",
      "VPS aktif + observability: Rp60.000 / bulan",
    ],
    accent: "growth",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Rp999.000",
    cadence: "pricing",
    volume: "High volume + SLA + dedicated callback + custom workflow",
    notes: "Untuk multi-unit koperasi, kebutuhan batch besar, dan dukungan prioritas.",
    costBreakdown: [
      "LLM Input: $0.15 / 1M tokens",
      "LLM Output: $0.60 / 1M tokens",
      "VPS aktif dedicated + support prioritas",
    ],
    accent: "enterprise",
  },
];
