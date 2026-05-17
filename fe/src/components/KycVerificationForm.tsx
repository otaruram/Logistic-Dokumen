/**
 * KYC Identity Verification Form — Multi-step wizard
 * Forces new users to complete KTP-based identity verification.
 */
import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, CreditCard, MapPin, Camera, CheckCircle2,
  ArrowRight, ArrowLeft, Upload, X, Loader2, Shield,
} from "lucide-react";
import { APP_CONFIG } from "@/constants";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

const API = APP_CONFIG.apiUrl;

interface KycVerificationFormProps {
  onComplete: () => void;
}

type Step = 0 | 1 | 2 | 3;

const STEPS = [
  { icon: User, label: "Data Pribadi" },
  { icon: MapPin, label: "Alamat" },
  { icon: Camera, label: "Foto" },
  { icon: CheckCircle2, label: "Review" },
];

const GENDER_OPTIONS = ["Laki-laki", "Perempuan"];
const RELIGION_OPTIONS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Lainnya"];
const MARITAL_OPTIONS = ["Belum Kawin", "Kawin", "Cerai Hidup", "Cerai Mati"];


export default function KycVerificationForm({ onComplete }: KycVerificationFormProps) {
  const [step, setStep] = useState<Step>(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Personal
  const [nik, setNik] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [religion, setReligion] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [occupation, setOccupation] = useState("");
  const [nationality, setNationality] = useState("WNI");

  // Step 2: Address
  const [address, setAddress] = useState("");
  const [rtRw, setRtRw] = useState("");
  const [kelurahan, setKelurahan] = useState("");
  const [kecamatan, setKecamatan] = useState("");

  // Step 3: Photos
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [ktpPreview, setKtpPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  // Step 3: Review / Consent
  const [dataConsent, setDataConsent] = useState(false);

  const ktpRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFile = useCallback((file: File, type: "ktp" | "selfie") => {
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (JPG/PNG)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5MB");
      return;
    }
    const url = URL.createObjectURL(file);
    if (type === "ktp") { setKtpFile(file); setKtpPreview(url); }
    else { setSelfieFile(file); setSelfiePreview(url); }
  }, []);

  const validateStep = (s: Step): boolean => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!/^\d{16}$/.test(nik)) e.nik = "NIK harus 16 digit angka";
      if (!fullName.trim()) e.fullName = "Nama lengkap wajib diisi";
      if (!birthPlace.trim()) e.birthPlace = "Tempat lahir wajib diisi";
      if (!birthDate) e.birthDate = "Tanggal lahir wajib diisi";
      if (!gender) e.gender = "Jenis kelamin wajib dipilih";
    }
    if (s === 1) {
      if (!address.trim()) e.address = "Alamat wajib diisi";
      if (!kelurahan.trim()) e.kelurahan = "Kelurahan wajib diisi";
      if (!kecamatan.trim()) e.kecamatan = "Kecamatan wajib diisi";
    }
    if (s === 2) {
      if (!ktpFile) e.ktp = "Foto KTP wajib diupload";
      if (!selfieFile) e.selfie = "Foto selfie wajib diupload";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validateStep(step)) setStep(Math.min(step + 1, 3) as Step);
  };
  const prev = () => setStep(Math.max(step - 1, 0) as Step);

  const handleSubmit = async () => {
    if (!validateStep(2)) { setStep(2); return; }
    setSubmitting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { toast.error("Session expired. Login ulang."); return; }

      const fd = new FormData();
      fd.append("nik", nik);
      fd.append("full_name", fullName);
      fd.append("birth_place", birthPlace);
      fd.append("birth_date", birthDate);
      fd.append("gender", gender);
      fd.append("address", address);
      fd.append("rt_rw", rtRw);
      fd.append("kelurahan", kelurahan);
      fd.append("kecamatan", kecamatan);
      fd.append("religion", religion);
      fd.append("marital_status", maritalStatus);
      fd.append("occupation", occupation);
      fd.append("nationality", nationality);
      fd.append("ktp_photo", ktpFile!);
      fd.append("selfie_photo", selfieFile!);
      fd.append("data_consent", dataConsent ? "true" : "false");

      const res = await fetch(`${API}/api/kyc/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (res.ok) {
        toast.success("Data identitas berhasil dikirim dan diverifikasi otomatis.", { duration: 6000 });
        onComplete();
      } else {
        const err = await res.json().catch(() => ({ detail: "Gagal submit" }));
        toast.error(err.detail || "Gagal submit KYC");
      }
    } catch {
      toast.error("Network error. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 focus:bg-white/[0.07] transition-all";
  const labelCls = "block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5";
  const errCls = "text-[11px] text-red-400 mt-1";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background glow */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-30%] left-[-20%] w-[70%] h-[70%] bg-blue-600/8 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-30%] right-[-20%] w-[70%] h-[70%] bg-purple-600/8 rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white text-black rounded-2xl mb-4 shadow-[0_0_40px_-10px_rgba(255,255,255,0.2)]">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500">
            Verifikasi Identitas
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Lengkapi data KTP untuk melanjutkan</p>
        </motion.div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <div key={i} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-300 ${done ? "bg-white border-white text-black" : active ? "border-white/50 text-white bg-white/10" : "border-white/10 text-zinc-600"}`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                {i < 3 && <div className={`flex-1 h-0.5 mx-1 rounded-full transition-all duration-500 ${done ? "bg-white" : "bg-white/10"}`} />}
              </div>
            );
          })}
        </div>

        {/* Form Card */}
        <motion.div
          className="bg-[#111]/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl"
          layout
        >
          <AnimatePresence mode="wait">
            {/* Step 0: Personal */}
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }} className="space-y-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 font-bold mb-4">Data Pribadi</p>
                <div>
                  <label className={labelCls}>NIK (Nomor Induk Kependudukan)</label>
                  <input className={inputCls} value={nik} onChange={e => setNik(e.target.value.replace(/\D/g, "").slice(0, 16))} placeholder="3201xxxxxxxxxxxx" maxLength={16} />
                  {errors.nik && <p className={errCls}>{errors.nik}</p>}
                </div>
                <div>
                  <label className={labelCls}>Nama Lengkap (sesuai KTP)</label>
                  <input className={inputCls} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nama lengkap" />
                  {errors.fullName && <p className={errCls}>{errors.fullName}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Tempat Lahir</label>
                    <input className={inputCls} value={birthPlace} onChange={e => setBirthPlace(e.target.value)} placeholder="Jakarta" />
                    {errors.birthPlace && <p className={errCls}>{errors.birthPlace}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Tanggal Lahir</label>
                    <input type="date" className={inputCls} value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                    {errors.birthDate && <p className={errCls}>{errors.birthDate}</p>}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Jenis Kelamin</label>
                  <div className="flex gap-2">
                    {GENDER_OPTIONS.map(g => (
                      <button key={g} type="button" onClick={() => setGender(g)} className={`flex-1 h-11 rounded-xl border text-sm font-medium transition-all ${gender === g ? "bg-white text-black border-white" : "bg-white/5 text-zinc-400 border-white/10 hover:border-white/20"}`}>{g}</button>
                    ))}
                  </div>
                  {errors.gender && <p className={errCls}>{errors.gender}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Agama</label>
                    <select className={inputCls + " appearance-none"} value={religion} onChange={e => setReligion(e.target.value)}>
                      <option value="" className="bg-zinc-900">Pilih</option>
                      {RELIGION_OPTIONS.map(r => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Status Perkawinan</label>
                    <select className={inputCls + " appearance-none"} value={maritalStatus} onChange={e => setMaritalStatus(e.target.value)}>
                      <option value="" className="bg-zinc-900">Pilih</option>
                      {MARITAL_OPTIONS.map(m => <option key={m} value={m} className="bg-zinc-900">{m}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Pekerjaan</label>
                    <input className={inputCls} value={occupation} onChange={e => setOccupation(e.target.value)} placeholder="Wiraswasta" />
                  </div>
                  <div>
                    <label className={labelCls}>Kewarganegaraan</label>
                    <input className={inputCls} value={nationality} onChange={e => setNationality(e.target.value)} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 1: Address */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }} className="space-y-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 font-bold mb-4">Alamat Sesuai KTP</p>
                <div>
                  <label className={labelCls}>Alamat</label>
                  <textarea className={inputCls + " h-24 py-3 resize-none"} value={address} onChange={e => setAddress(e.target.value)} placeholder="Jl. Merdeka No. 123" />
                  {errors.address && <p className={errCls}>{errors.address}</p>}
                </div>
                <div>
                  <label className={labelCls}>RT / RW</label>
                  <input className={inputCls} value={rtRw} onChange={e => setRtRw(e.target.value)} placeholder="001/002" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Kelurahan / Desa</label>
                    <input className={inputCls} value={kelurahan} onChange={e => setKelurahan(e.target.value)} placeholder="Menteng" />
                    {errors.kelurahan && <p className={errCls}>{errors.kelurahan}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Kecamatan</label>
                    <input className={inputCls} value={kecamatan} onChange={e => setKecamatan(e.target.value)} placeholder="Menteng" />
                    {errors.kecamatan && <p className={errCls}>{errors.kecamatan}</p>}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Photos */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }} className="space-y-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 font-bold mb-4">Upload Foto</p>
                {/* KTP */}
                <div>
                  <label className={labelCls}>Foto KTP</label>
                  <input ref={ktpRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0], "ktp")} />
                  {ktpPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-white/10">
                      <img src={ktpPreview} alt="KTP" className="w-full h-44 object-cover" />
                      <button onClick={() => { setKtpFile(null); setKtpPreview(null); }} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => ktpRef.current?.click()} className="w-full h-36 rounded-xl border-2 border-dashed border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] flex flex-col items-center justify-center gap-2 transition-all">
                      <CreditCard className="w-8 h-8 text-zinc-500" />
                      <span className="text-xs text-zinc-500">Upload foto KTP (maks 5MB)</span>
                    </button>
                  )}
                  {errors.ktp && <p className={errCls}>{errors.ktp}</p>}
                </div>
                {/* Selfie */}
                <div>
                  <label className={labelCls}>Foto Selfie</label>
                  <input ref={selfieRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0], "selfie")} />
                  {selfiePreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-white/10">
                      <img src={selfiePreview} alt="Selfie" className="w-full h-44 object-cover" />
                      <button onClick={() => { setSelfieFile(null); setSelfiePreview(null); }} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => selfieRef.current?.click()} className="w-full h-36 rounded-xl border-2 border-dashed border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] flex flex-col items-center justify-center gap-2 transition-all">
                      <Camera className="w-8 h-8 text-zinc-500" />
                      <span className="text-xs text-zinc-500">Upload foto selfie (maks 5MB)</span>
                    </button>
                  )}
                  {errors.selfie && <p className={errCls}>{errors.selfie}</p>}
                </div>
              </motion.div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }} className="space-y-4">
                <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 font-bold">Review Data</p>
                <div className="space-y-2 text-sm">
                  {[
                    ["NIK", nik],
                    ["Nama Lengkap", fullName],
                    ["Tempat/Tgl Lahir", `${birthPlace}, ${birthDate}`],
                    ["Jenis Kelamin", gender],
                    ["Alamat", address],
                    ["RT/RW", rtRw],
                    ["Kel/Desa", kelurahan],
                    ["Kecamatan", kecamatan],
                    ["Agama", religion],
                    ["Status", maritalStatus],
                    ["Pekerjaan", occupation],
                    ["Kewarganegaraan", nationality],
                  ].filter(([, v]) => v?.trim()).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-2 border-b border-white/5">
                      <span className="text-zinc-500">{k}</span>
                      <span className="text-white font-medium text-right max-w-[60%]">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {ktpPreview && (
                    <div className="rounded-xl overflow-hidden border border-white/10">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 px-3 py-1.5 bg-white/5">Foto KTP</p>
                      <img src={ktpPreview} alt="KTP" className="w-full h-28 object-cover" />
                    </div>
                  )}
                  {selfiePreview && (
                    <div className="rounded-xl overflow-hidden border border-white/10">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 px-3 py-1.5 bg-white/5">Foto Selfie</p>
                      <img src={selfiePreview} alt="Selfie" className="w-full h-28 object-cover" />
                    </div>
                  )}
                </div>
                <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-300">⚠️ Data yang sudah disubmit tidak bisa diubah. Pastikan semua data sudah benar.</p>
                </div>
                
                <div className="mt-6 border-t border-white/10 pt-4">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-start pt-0.5">
                      <input
                        type="checkbox"
                        checked={dataConsent}
                        onChange={(e) => setDataConsent(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="h-5 w-5 rounded border border-zinc-500 bg-transparent transition-all peer-checked:border-blue-500 peer-checked:bg-blue-500 flex items-center justify-center">
                        <CheckCircle2 className="h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <span className="text-sm text-zinc-300 leading-snug group-hover:text-zinc-200 transition-colors">
                      Saya menyetujui data saya digunakan untuk penilaian kredit alternatif sesuai UU PDP No. 27/2022 dan POJK 13/2018.
                    </span>
                  </label>
                  {errors.dataConsent && <p className={errCls}>{errors.dataConsent}</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
            {step > 0 ? (
              <button onClick={prev} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Kembali
              </button>
            ) : <div />}
            {step < 3 ? (
              <button onClick={next} className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-gray-200 transition-colors">
                Lanjut <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting || !dataConsent} className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black hover:bg-gray-200 transition-colors disabled:opacity-50">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</> : <><CheckCircle2 className="w-4 h-4" /> Kirim</>}
              </button>
            )}
          </div>
        </motion.div>

        <p className="text-center text-[11px] text-zinc-600 mt-6">
          Data disimpan secara aman dan terenkripsi. Hanya digunakan untuk verifikasi identitas.
        </p>
      </div>
    </div>
  );
}
