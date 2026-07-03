/**
 * PhoneOnboardingPage — Phone number verification for new users
 *
 * Replaces the old KYC form (NIK + KTP photo). After Google login,
 * new users must verify their phone number against the employee whitelist.
 *
 * Design: Dark mode glassmorphism, consistent with LoginPage.tsx
 */
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Shield,
  AlertTriangle,
  Loader2,
  Building2,
  LogOut,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { APP_CONFIG } from "@/constants";

const API = APP_CONFIG.apiUrl;

/** Demo phone numbers for sandbox testing */
const DEMO_PHONES = {
  valid: "+6281234567890",   // Matches seed data in employee_whitelist
  invalid: "+628999111222",  // Random number — guaranteed not in whitelist
} as const;

interface PhoneOnboardingPageProps {
  onComplete: () => void;
  onBack: () => void;
}

type OnboardingState = "input" | "verifying" | "success" | "error";

export default function PhoneOnboardingPage({
  onComplete,
  onBack,
}: PhoneOnboardingPageProps) {
  const [phoneInput, setPhoneInput] = useState("");
  const [state, setState] = useState<OnboardingState>("input");
  const [errorMessage, setErrorMessage] = useState("");
  const [showSandbox, setShowSandbox] = useState(false);

  /**
   * Format raw input into display format:
   *   "81234567890" → "+62 812-3456-7890"
   *   "081234567890" → "+62 812-3456-7890"
   */
  const formatDisplayPhone = useCallback((raw: string): string => {
    const digits = raw.replace(/\D/g, "");

    let normalized = digits;
    if (normalized.startsWith("62")) {
      normalized = normalized.slice(2);
    } else if (normalized.startsWith("0")) {
      normalized = normalized.slice(1);
    }

    // Cap at 13 digits
    normalized = normalized.slice(0, 13);

    // Format: 812-3456-7890
    if (normalized.length <= 3) return normalized;
    if (normalized.length <= 7)
      return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }, []);

  /**
   * Extract raw digits for API submission.
   * Always returns format: +62XXXXXXXXXX
   */
  const getApiPhone = useCallback((): string => {
    const digits = phoneInput.replace(/\D/g, "");
    let normalized = digits;
    if (normalized.startsWith("62")) {
      normalized = normalized.slice(2);
    } else if (normalized.startsWith("0")) {
      normalized = normalized.slice(1);
    }
    return `+62${normalized}`;
  }, [phoneInput]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d\-\s\+]/g, "");
    setPhoneInput(raw);
    setErrorMessage("");
  };

  const isPhoneValid = (): boolean => {
    const digits = phoneInput.replace(/\D/g, "");
    let normalized = digits;
    if (normalized.startsWith("62")) {
      normalized = normalized.slice(2);
    } else if (normalized.startsWith("0")) {
      normalized = normalized.slice(1);
    }
    return normalized.length >= 9 && normalized.length <= 13 && normalized.startsWith("8");
  };

  const handleSubmit = async () => {
    if (!isPhoneValid()) {
      setErrorMessage("Format nomor HP tidak valid. Gunakan format 08xx atau +62xx.");
      return;
    }

    setState("verifying");
    setErrorMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error("Sesi login habis. Silakan login ulang.");
        setState("input");
        return;
      }

      const res = await fetch(`${API}/api/v1/auth/verify-whitelist`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone_number: getApiPhone() }),
      });

      if (res.ok) {
        setState("success");
        toast.success("Verifikasi berhasil! Selamat datang di OtaruChain.", {
          duration: 4000,
        });
        // Short delay for success animation, then redirect
        setTimeout(() => onComplete(), 1800);
      } else {
        const err = await res.json().catch(() => ({ detail: "Verifikasi gagal" }));
        setState("error");
        setErrorMessage(
          err.detail ||
          "Nomor HP tidak ditemukan di sistem. Hubungi admin Koperasi Anda."
        );
      }
    } catch {
      setState("error");
      setErrorMessage("Koneksi bermasalah. Coba lagi dalam beberapa saat.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onBack();
  };

  const handleRetry = () => {
    setState("input");
    setErrorMessage("");
  };

  /** Demo sandbox: autofill a phone number and reset state */
  const handleDemoAutofill = (phone: string, label: string) => {
    setPhoneInput(phone);
    setState("input");
    setErrorMessage("");
    toast.info(`Demo: nomor ${label} terisi otomatis`, { duration: 2000 });
  };

  const displayPhone = formatDisplayPhone(phoneInput);
  const valid = isPhoneValid();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-white selection:text-black">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-emerald-600/10 rounded-full blur-[120px] animate-pulse"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"
          style={{ animationDuration: "10s", animationDelay: "1s" }}
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back / Logout */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors group"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Keluar</span>
          </button>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/10 p-8 sm:p-12 rounded-3xl shadow-2xl ring-1 ring-white/5"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-2xl mb-6 shadow-[0_0_40px_-10px_rgba(16,185,129,0.4)]">
              <Phone className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500 mb-2">
              Verifikasi Nomor HP
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Masukkan nomor HP yang terdaftar di sistem HRD Koperasi Anda untuk
              mengaktifkan akun.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {/* Input State */}
            {(state === "input" || state === "error") && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Phone Input */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Nomor HP
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-emerald-400">+62</span>
                      <div className="h-5 w-px bg-white/10" />
                    </div>
                    <input
                      type="tel"
                      value={displayPhone}
                      onChange={handlePhoneChange}
                      placeholder="812-3456-7890"
                      className="w-full h-14 rounded-xl border border-white/10 bg-white/5 pl-[4.5rem] pr-4 text-lg font-mono text-white placeholder-zinc-600 outline-none focus:border-emerald-500/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      autoFocus
                      maxLength={20}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-2">
                    Contoh: 081234567890 atau +6281234567890
                  </p>
                </div>

                {/* Error Message */}
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-4 rounded-xl bg-red-500/10 border border-red-500/20"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-red-300 font-medium">
                          Verifikasi Gagal
                        </p>
                        <p className="text-xs text-red-400/80 mt-1">
                          {errorMessage}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Submit Button */}
                <Button
                  onClick={state === "error" ? handleRetry : handleSubmit}
                  disabled={!valid && state !== "error"}
                  className={`w-full h-14 text-base font-medium rounded-xl transition-all duration-200 shadow-lg active:scale-[0.98] group relative overflow-hidden ${
                    valid
                      ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20"
                      : "bg-white/10 text-zinc-500 cursor-not-allowed"
                  }`}
                >
                  {state === "error" ? (
                    <div className="flex items-center gap-2">
                      <ArrowLeft className="w-4 h-4" />
                      <span>Coba Nomor Lain</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <span>Verifikasi Nomor HP</span>
                      <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </div>
                  )}
                </Button>

                {/* Trust Badges */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-gray-400">UU PDP Compliant</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-gray-400">Verified by HRD</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Verifying State */}
            {state === "verifying" && (
              <motion.div
                key="verifying"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center py-8"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-4">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                </div>
                <p className="text-lg font-semibold text-white">
                  Memverifikasi nomor HP...
                </p>
                <p className="text-sm text-zinc-500 mt-2">
                  Mengecek database HRD Koperasi
                </p>
              </motion.div>
            )}

            {/* Success State */}
            {state === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 15,
                    delay: 0.1,
                  }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 mb-4"
                >
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </motion.div>
                <p className="text-xl font-bold text-white">
                  Verifikasi Berhasil!
                </p>
                <p className="text-sm text-zinc-400 mt-2">
                  Akun Anda sudah aktif. Mengalihkan ke dashboard...
                </p>
                <div className="mt-4">
                  <div className="w-48 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-500 rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1.5, ease: "linear" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <p className="text-center text-[11px] text-zinc-600 mt-6 leading-relaxed">
          Hanya nomor HP yang terdaftar di sistem HRD Koperasi yang dapat diverifikasi.
          <br />
          Hubungi admin Koperasi jika nomor Anda belum terdaftar.
        </p>

        {/* ── Demo Sandbox Helper ─────────────────────────────────── */}
        <div className="mt-5 flex flex-col items-center">
          <button
            onClick={() => setShowSandbox((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors select-none"
            aria-label="Toggle demo sandbox"
          >
            <FlaskConical className="w-3 h-3" />
            <span className="tracking-wider uppercase font-medium">
              {showSandbox ? "Tutup Sandbox" : "Sandbox"}
            </span>
          </button>

          <AnimatePresence>
            {showSandbox && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-semibold">
                    Demo Autofill
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleDemoAutofill(DEMO_PHONES.valid, "valid")
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/10 bg-emerald-500/5 px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-emerald-300 hover:border-emerald-500/25 transition-colors"
                    >
                      <span>💡</span>
                      <span>Success Demo</span>
                    </button>
                    <button
                      onClick={() =>
                        handleDemoAutofill(DEMO_PHONES.invalid, "invalid")
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/10 bg-red-500/5 px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-red-300 hover:border-red-500/25 transition-colors"
                    >
                      <span>⚠️</span>
                      <span>Fraud Demo</span>
                    </button>
                  </div>
                  <p className="text-[9px] text-zinc-700 text-center leading-relaxed max-w-[280px]">
                    Klik untuk mengisi nomor HP otomatis, lalu tekan Verifikasi.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
