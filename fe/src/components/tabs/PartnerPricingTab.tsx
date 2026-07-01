import React, { useState } from "react";
import { Shield, Zap, TrendingUp, CheckCircle2, AlertTriangle, Lock, Cpu, Phone, X, QrCode } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const TIERS = [
  {
    id: "developer",
    name: "Developer",
    price: "Rp 0",
    cadence: "/ bulan",
    target: "Developer individu atau PoC internal koperasi.",
    volumeLabel: "10 Requests",
    volumeSub: "per bulan — Hard Limit",
    volumeIsHard: true,
    sla: "Best-effort (antrean standar)",
    features: [
      "Core OtaruChain Engine",
      "SHA-256 Document Stamping",
      "Baseline Fraud Filter",
      "1 Akun Developer",
    ],
    popular: false,
    cta: "Gratis Selamanya",
    ctaDisabled: true,
  },
  {
    id: "launch",
    name: "Launch",
    price: "Rp 599.000",
    cadence: "/ bulan",
    target: "Koperasi mikro yang memulai pilot underwriting kredit.",
    volumeLabel: "900 Requests",
    volumeSub: "per bulan",
    volumeIsHard: false,
    sla: "Max 24 jam verifikasi",
    features: [
      "Semua fitur Developer",
      "Unified Decision Gate API",
      "2 Admin Partner Seats",
    ],
    popular: false,
    cta: "Aktivasi & Bayar",
    ctaDisabled: false,
  },
  {
    id: "growth",
    name: "Scale",
    price: "Rp 1.499.000",
    cadence: "/ bulan",
    target: "Koperasi logistik aktif dengan underwriting harian (Tahan fluktuasi infra dollar).",
    volumeLabel: "2.000 Requests",
    volumeSub: "per bulan",
    volumeIsHard: false,
    sla: "Prioritas < 2 jam",
    features: [
      "Semua fitur Launch",
      "Advanced Decision Gate API",
      "Full Analytics Dashboard",
      "Burst Traffic Handling",
      "5 Admin Partner Seats",
    ],
    popular: true,
    cta: "Aktivasi & Bayar",
    ctaDisabled: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Rp 3.999.000",
    cadence: "/ bulan",
    target: "Jaringan koperasi berskala nasional atau volume tinggi.",
    volumeLabel: "10.000 Requests",
    volumeSub: "per bulan",
    volumeIsHard: false,
    sla: "Dedicated 99.9%",
    features: [
      "Semua fitur Scale",
      "Dedicated Support",
      "Custom Integrations",
      "Unlimited Admin Seats",
      "White-label portal",
    ],
    popular: false,
    cta: "Aktivasi & Bayar",
    ctaDisabled: false,
  },
];

const COMPLIANCE_BADGES = [
  { icon: Shield, label: "Banking-Grade Security & Standar OJK/UU PDP" },
  { icon: Lock, label: "Immutable Audit Trail (SHA-256 Stamping)" },
  { icon: Cpu, label: "Gemini 2.5 Flash Fraud Screening Guard" },
  { icon: Phone, label: "Phone-number based identity lookup" },
];

export default function PartnerPricingTab({
  checkoutError,
  checkoutLoadingPlan,
  handleCheckout
}: {
  checkoutError: string | null;
  checkoutLoadingPlan: string | null;
  handleCheckout: (planId: string) => void;
}) {
  const [selectedCheckout, setSelectedCheckout] = useState<{ title: string, price: string, type: string, planId?: string, paymentUrl?: string } | null>(null);
  const [isGeneratingPayment, setIsGeneratingPayment] = useState(false);
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  return (
    <section className="space-y-10 py-10 bg-slate-950 text-slate-200 rounded-[2rem] px-4 sm:px-8 border border-slate-800 relative">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center gap-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          <Zap className="h-3 w-3 text-violet-400" /> Harga Partner OtaruChain
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Harga terprediksi untuk setiap skala
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-slate-400">
          Satu paket untuk dua product layer — OtaruChain document intelligence
          &amp; Otaru Financial credit readiness. Scale underwriting dengan clean business logic.
        </p>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {checkoutError && (
        <div className="mx-auto max-w-xl rounded-xl border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {checkoutError}
        </div>
      )}

      {/* ── Pricing Grid ───────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-4 max-w-7xl mx-auto items-stretch">
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 ${
              tier.popular
                ? "border-violet-500/60 bg-gradient-to-b from-slate-900 to-slate-950 shadow-[0_0_40px_-8px_rgba(139,92,246,0.35)] ring-1 ring-violet-500/20"
                : "border-slate-800 bg-slate-900 hover:border-slate-700"
            }`}
          >
            {/* Popular badge */}
            {tier.popular && (
              <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg">
                  <TrendingUp className="h-2.5 w-2.5" /> Most Popular
                </span>
              </div>
            )}

            {/* Tier name & price */}
            <div className="mb-5">
              <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                tier.popular ? "text-violet-400" : "text-slate-500"
              }`}>{tier.name}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-white">{tier.price}</span>
                <span className="text-xs text-slate-500">{tier.cadence}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">{tier.target}</p>
            </div>

            {/* Volume badge */}
            <div className={`mb-5 rounded-xl border px-4 py-3 ${
              tier.volumeIsHard
                ? "border-amber-700/50 bg-amber-950/40"
                : tier.popular
                ? "border-violet-700/40 bg-violet-950/30"
                : "border-slate-700 bg-slate-800/50"
            }`}>
              <p className={`text-lg font-extrabold tracking-tight ${
                tier.volumeIsHard ? "text-amber-300" : tier.popular ? "text-violet-300" : "text-white"
              }`}>{tier.volumeLabel}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[11px] text-slate-500">{tier.volumeSub}</p>
                {tier.volumeIsHard && (
                  <span className="rounded-full bg-amber-900/60 border border-amber-700/50 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 uppercase tracking-widest">Hard Limit</span>
                )}
              </div>
            </div>

            {/* SLA */}
            <div className="mb-5 flex items-center gap-2">
              <Zap className={`h-3.5 w-3.5 flex-shrink-0 ${tier.popular ? "text-violet-400" : "text-slate-500"}`} />
              <p className="text-xs text-slate-400"><span className="font-semibold text-slate-300">SLA:</span> {tier.sla}</p>
            </div>

            {/* Features */}
            <ul className="mb-5 flex-1 space-y-2.5">
              {tier.features.map((feat) => (
                <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle2 className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                    tier.popular ? "text-violet-400" : "text-emerald-500"
                  }`} />
                  {feat}
                </li>
              ))}
            </ul>

            {/* Compliance badges */}
            <div className={`mb-5 rounded-xl border p-3 space-y-2 ${
              tier.popular ? "border-slate-700 bg-slate-800/40" : "border-slate-800 bg-slate-800/20"
            }`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">Infrastruktur & Compliance</p>
              {COMPLIANCE_BADGES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="h-3 w-3 flex-shrink-0 text-slate-500" />
                  <span className="text-[11px] text-slate-500">{label}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => {
                if (!tier.ctaDisabled) {
                  handleCheckout(tier.id);
                }
              }}
              disabled={tier.ctaDisabled || checkoutLoadingPlan === tier.id}
              className={`w-full rounded-xl py-3 text-sm font-bold tracking-wide transition-all duration-200 ${
                tier.ctaDisabled
                  ? "bg-slate-800 text-slate-600 cursor-default border border-slate-700"
                  : tier.popular
                  ? "bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-900/40 border border-violet-500"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 hover:border-slate-600"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {checkoutLoadingPlan === tier.id ? "Memproses..." : tier.cta}
            </button>
          </div>
        ))}
      </div>

      {/* ── Overage Alert Banner ────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto rounded-2xl border border-amber-800/50 bg-amber-950/30 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-900/50 border border-amber-700/50 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-300 mb-1">Overage Credit System</p>
            <p className="text-xs text-amber-500/90 leading-relaxed max-w-2xl">
              Kuota ekstra di luar paket bulanan akan dikenakan <span className="font-semibold text-amber-400">Pay-per-Query Rp 3.000 – Rp 5.000 per request</span> menggunakan sistem deposit kredit.
              Kredit dapat diisi kapan saja melalui portal Partner tanpa perlu upgrade plan.
            </p>
          </div>
        </div>
        <button
          onClick={() => handleCheckout("topup")}
          disabled={checkoutLoadingPlan === "topup"}
          className="flex-shrink-0 whitespace-nowrap rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-500 transition-colors shadow-lg shadow-amber-900/20 disabled:opacity-60"
        >
          {checkoutLoadingPlan === "topup" ? "Memproses..." : "Top-up Sekarang"}
        </button>
      </div>

      {/* ── Gamification Benefit Context (TBA) ─────────────────────────── */}
      <div className="max-w-7xl mx-auto rounded-2xl border border-slate-700 bg-slate-900/60 p-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Konteks Benefit (TBA) • berlaku sinkron di otaruchain.id dan otaruchain.id/partner
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4">
            <p className="text-sm font-bold text-amber-300">Gold</p>
            <p className="text-xs text-slate-300 mt-1">≥ 150 Dokumen Lolos Audit · Priority</p>
            <p className="text-xs text-amber-200 mt-2">+ Bonus Plafon +Rp 1 Juta</p>
            <p className="text-xs text-amber-200">+ Diskon Biaya Admin Koperasi 0.5%</p>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Benefit aktif berbasis meritokrasi perilaku anggota Koperasi. Evaluasi otomatis dari kualitas dan konsistensi dokumen bulan berjalan.
            </p>
          </div>
          <div className="rounded-xl border border-violet-700/40 bg-violet-950/20 p-4">
            <p className="text-sm font-bold text-violet-300">Platinum</p>
            <p className="text-xs text-slate-300 mt-1">≥ 250 Dokumen Lolos Audit · VIP</p>
            <p className="text-xs text-violet-200 mt-2">+ Bonus Plafon Maksimal up to Rp 20 Juta</p>
            <p className="text-xs text-violet-200">+ Akses Prioritas Pencairan Instan &lt; 5 Menit</p>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Benefit tertinggi berbasis meritokrasi perilaku anggota Koperasi. Performa dokumen sempurna, pencairan instan tanpa antrean.
            </p>
          </div>
        </div>
      </div>

      {/* ── Footer note ────────────────────────────────────────────────── */}
      <p className="text-center text-[11px] text-slate-700">
        Minimisasi data ketat diterapkan. Tidak ada penyimpanan atau transmisi NIK. Semua pencarian murni terikat pada Nomor Handphone.
      </p>

      {/* ── QR Code Payment Modal ──────────────────────────────────────── */}
      {selectedCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {selectedCheckout.type === 'topup' ? 'Top-up Kuota' : 'Aktivasi Layanan'}
                </p>
                <h3 className="text-base font-semibold text-white mt-0.5">{selectedCheckout.title}</h3>
              </div>
              <button
                onClick={() => setSelectedCheckout(null)}
                className="rounded-full bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center text-center">
              <div className="mb-6 rounded-2xl bg-white p-3 shadow-inner">
                {selectedCheckout.paymentUrl ? (
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedCheckout.paymentUrl)}`} 
                    alt="QRIS Payment"
                    className="w-48 h-48 rounded-lg"
                  />
                ) : (
                  <div className="w-48 h-48 rounded-lg bg-slate-100 flex items-center justify-center">
                    {isGeneratingPayment ? "Memuat QRIS..." : (
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=OtaruChain-Payment-${selectedCheckout.price.replace(/\D/g,'')}`} 
                        alt="Simulasi QRIS Payment"
                        className="w-48 h-48 rounded-lg opacity-80"
                      />
                    )}
                  </div>
                )}
              </div>
              
              <p className="text-xs text-slate-400 mb-2">
                {selectedCheckout.paymentUrl ? "Scan QR Code ini untuk membuka halaman pembayaran Louvin." : "Scan QRIS ini menggunakan M-Banking atau E-Wallet Anda."}
              </p>
              
              <div className="w-full rounded-xl border border-slate-700 bg-slate-800/50 p-4 mt-2">
                <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">Total Tagihan</p>
                <p className="mt-1 text-2xl font-extrabold text-white">{selectedCheckout.price}</p>
              </div>

              <button
                onClick={() => {
                  alert("Pembayaran berhasil diverifikasi (Simulasi Hackathon)!");
                  setSelectedCheckout(null);
                }}
                className="mt-6 w-full rounded-xl bg-violet-600 py-3.5 text-sm font-bold text-white hover:bg-violet-500 transition-colors shadow-lg shadow-violet-900/30"
              >
                Saya Sudah Membayar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
