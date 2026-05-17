import React from "react";
import { ArrowRight } from "lucide-react";
import { pricingPlans } from "../../pages/PartnerPortalConstants";

export default function PartnerPricingTab({
  checkoutError,
  checkoutLoadingPlan,
  handleCheckout,
  th
}: {
  checkoutError: string | null;
  checkoutLoadingPlan: string | null;
  handleCheckout: (planId: string) => void;
  th: any;
}) {
  return (
    <section className="space-y-12 py-12 bg-white text-black rounded-[2.5rem] px-4 sm:px-8 border border-zinc-200 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-black ring-1 ring-inset ring-zinc-300">
          Harga Partner Otaru
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-black sm:text-5xl">
          Harga terprediksi untuk skala
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
          Satu paket partner untuk mengakses dua product layer: OtaruChain untuk document intelligence dan Otaru Financial untuk credit readiness. Cocok untuk scale underwriting dengan clean business logic.
        </p>
      </div>

      {checkoutError && (
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
          {checkoutError}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3 max-w-6xl mx-auto">
        {pricingPlans.map((plan) => {
          const isHighlight = plan.id === "growth";
          const isDefaultActive = plan.id === "launch";
          return (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-[2rem] p-8 ring-1 transition-all duration-300 ${
                isHighlight 
                  ? "bg-black text-white ring-black shadow-2xl scale-105 z-10" 
                  : "bg-white text-black ring-zinc-200 hover:ring-zinc-300 shadow-sm hover:shadow-md"
              }`}
            >
              {isHighlight && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="rounded-full bg-white px-4 py-1 text-xs font-semibold text-black tracking-wide uppercase border border-black shadow-sm">
                    Paling Populer
                  </span>
                </div>
              )}
              {isDefaultActive && (
                <div className="absolute top-6 right-6">
                  <span className="rounded-full bg-black px-3 py-1 text-[10px] font-bold text-white uppercase tracking-widest ring-1 ring-inset ring-black">
                    Plan Aktif
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className={`text-sm font-semibold uppercase tracking-wider ${isHighlight ? "text-zinc-400" : "text-zinc-500"}`}>
                  {plan.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-x-2">
                  <span className={`text-4xl font-bold tracking-tight ${isHighlight ? "text-white" : "text-black"}`}>{plan.price}</span>
                  <span className={`text-sm font-semibold ${isHighlight ? "text-zinc-400" : "text-zinc-500"}`}>{plan.cadence}</span>
                </div>
                <p className={`mt-4 text-sm leading-6 font-medium border-b pb-4 ${isHighlight ? "text-zinc-400 border-zinc-800" : "text-zinc-600 border-zinc-200"}`}>
                  {plan.target}
                </p>
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${isHighlight ? "text-zinc-500" : "text-zinc-500"}`}>Volume & Kapasitas</p>
                  <p className={`mt-2 text-sm font-medium ${isHighlight ? "text-white" : "text-black"}`}>{plan.volume}</p>
                </div>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${isHighlight ? "text-zinc-500" : "text-zinc-500"}`}>Nilai Inti</p>
                  <p className={`mt-2 text-sm leading-relaxed ${isHighlight ? "text-zinc-300" : "text-zinc-700"}`}>{plan.coreValue}</p>
                </div>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${isHighlight ? "text-zinc-500" : "text-zinc-500"}`}>Tingkat Layanan & Akses</p>
                  <p className={`mt-2 text-sm leading-relaxed ${isHighlight ? "text-zinc-300" : "text-zinc-700"}`}>{plan.limitations}</p>
                </div>
                
                <div className={`pt-4 mt-4 border-t ${isHighlight ? "border-zinc-800" : "border-zinc-200"}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-4 ${isHighlight ? "text-zinc-500" : "text-zinc-500"}`}>Standar Keamanan (Termasuk)</p>
                  <ul className="space-y-3">
                    {plan.notes.map((item) => (
                      <li key={item} className={`flex gap-x-3 text-sm ${isHighlight ? "text-zinc-400" : "text-zinc-600"}`}>
                        <svg className={`h-5 w-5 flex-none ${isHighlight ? "text-white" : "text-black"}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <button
                onClick={() => (plan.id === "free" || plan.id === "launch") ? undefined : handleCheckout(plan.id)}
                disabled={plan.id === "free" || plan.id === "launch" || checkoutLoadingPlan === plan.id}
                className={`mt-8 block w-full rounded-full px-3 py-3.5 text-center text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors border ${
                  plan.id === "free"
                    ? "bg-zinc-100 text-zinc-500 border-zinc-200 cursor-default"
                    : plan.id === "launch"
                    ? "bg-black text-white border-black cursor-default"
                    : isHighlight
                    ? "bg-white text-black border-white hover:bg-zinc-200 focus-visible:outline-white"
                    : "bg-transparent text-black border-black hover:bg-black hover:text-white focus-visible:outline-black"
                }`}
              >
                {plan.id === "free" ? "Gratis selamanya" : plan.id === "launch" ? "✓ Plan Aktif Anda" : checkoutLoadingPlan === plan.id ? "Memproses..." : "Aktivasi & Bayar"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-zinc-500 mt-8 font-medium">
        Minimisasi data ketat diterapkan. Tidak ada penyimpanan atau transmisi NIK. Semua pencarian murni terikat pada Nomor Handphone.
      </p>
    </section>
  );
}
