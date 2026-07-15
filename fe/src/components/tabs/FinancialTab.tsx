/**
 * FinancialTab — Otaru Financial Dasbor
 * Mode: Manual Input (profil, cicilan) + OCR Upload (slip gaji / struk belanja)
 */

import { useState, useEffect, useRef } from "react";
import {
  TrendingUp, Upload, FileText, Trash2,
  AlertCircle, CheckCircle2, Loader2,
  Wallet, BarChart3, ShieldCheck, RefreshCw, Camera,
  Download, MessageSquare, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

function getToken() {
  const u = localStorage.getItem("user");
  if (!u) return "";
  const p = JSON.parse(u);
  return p.credential || p.driveToken || p.access_token || "";
}

function fmtIDR(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function gradeColor(grade: string) {
  return { A: "text-emerald-400", B: "text-green-400", C: "text-yellow-400", D: "text-orange-400", E: "text-red-400" }[grade] ?? "text-gray-400";
}


// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoreData {
  otaru_index: number;
  credit_grade: string;
  dsr_score: number;
  consistency_score: number;
  integrity_score: number;
  dsr_percent: number;
  salary: number;
  salary_source: string;
  cicilan_aktif_total: number;
  sisa_plafon_aman: number;
  tampered_attempts: number;
  integrity_level: string;
}

interface Installment {
  id: string;
  nama_pinjaman: string;
  cicilan_bulanan: number;
  lembaga?: string;
  status: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ value, max = 1000 }: { value: number; max?: number }) {
  const pct = Math.min(value / max, 1);
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  return (
    <svg width={110} height={110} className="mx-auto -rotate-90">
      <circle cx={55} cy={55} r={r} stroke="#1f2937" strokeWidth={10} fill="none" />
      <circle
        cx={55} cy={55} r={r}
        stroke={value >= 700 ? "#34d399" : value >= 500 ? "#facc15" : "#f87171"}
        strokeWidth={10} fill="none"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Section = "overview" | "manual" | "ocr" | "catatan" | "tanya";
type DummyDocType = "slip_gaji" | "invoice" | null;

interface ChatMessage {
  role: "user" | "otaru";
  text: string;
}

export default function FinancialTab() {
  const [section, setSection] = useState<Section>("overview");
  const [score, setScore] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(false);

  // Tanya Otaru chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "otaru", text: "Halo! Saya Otaru, konsultan keuangan personalmu. Tanyakan apa saja tentang Skor Kepercayaan, Otaru Index, atau strategi keuanganmu. Saya punya akses ke semua data profilmu." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [scoreLoading, setScoreLoading] = useState(true);

  // Catatan keuangan (local)
  const [catatanEntries, setCatatanEntries] = useState<{ id: string; type: "pemasukan" | "pengeluaran"; nominal: number; keterangan: string; created_at: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem("otaru_catatan") || "[]"); } catch { return []; }
  });
  const [catatanForm, setCatatanForm] = useState({ type: "pemasukan" as "pemasukan" | "pengeluaran", nominal: "", keterangan: "" });

  // Manual profile form
  const [profil, setProfil] = useState({ gaji_bulanan: "", tanggungan: "", pekerjaan: "", nama_perusahaan: "", pengeluaran_rutin: "" });
  const [profilLoading, setProfilLoading] = useState(false);

  // OCR upload
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [ocrHasil, setOcrHasil] = useState<any>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchScore();
  }, []);

  async function authFetch(path: string, opts: RequestInit = {}) {
    const token = getToken();
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function fetchScore() {
    setScoreLoading(true);
    try {
      const data = await authFetch("/api/v1/finance/score");
      setScore(data);
    } catch (e: any) {
      toast.error("Gagal ambil skor: " + e.message);
    } finally {
      setScoreLoading(false);
    }
  }

  async function handleSaveProfil() {
    setProfilLoading(true);
    try {
      const body: any = {};
      if (profil.gaji_bulanan) body.gaji_bulanan = parseInt(profil.gaji_bulanan.replace(/\D/g, ""));
      if (profil.tanggungan) body.tanggungan = parseInt(profil.tanggungan);
      if (profil.pekerjaan) body.pekerjaan = profil.pekerjaan;
      if (profil.nama_perusahaan) body.nama_perusahaan = profil.nama_perusahaan;
      if (profil.pengeluaran_rutin) body.pengeluaran_rutin = parseInt(profil.pengeluaran_rutin.replace(/\D/g, ""));
      await authFetch("/api/v1/finance/profile", { method: "POST", body: JSON.stringify(body) });
      toast.success("Profil tersimpan!");
      setProfil({ gaji_bulanan: "", tanggungan: "", pekerjaan: "", nama_perusahaan: "", pengeluaran_rutin: "" });
      fetchScore();
    } catch (e: any) {
      toast.error("Gagal simpan: " + e.message);
    } finally {
      setProfilLoading(false);
    }
  }


  async function handleOcrUnggah() {
    if (!ocrFile) return;
    setOcrLoading(true);
    setOcrHasil(null);
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append("file", ocrFile);
      const res = await fetch(`${API}/api/v1/finance/upload-doc`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOcrHasil(data);
      toast.success("Dokumen diproses!");
      fetchScore();
    } catch (e: any) {
      toast.error("Gagal upload: " + e.message);
    } finally {
      setOcrLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setOcrFile(f);
    setOcrHasil(null);
    const reader = new FileReader();
    reader.onloadend = () => setOcrPreview(reader.result as string);
    reader.readAsDataURL(f);
  }


  // ── Tanya Otaru chat handler ──
  async function handleChatSend() {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: q }]);
    setChatLoading(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/v1/finance/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Gagal mendapat jawaban");
      setChatMessages(prev => [...prev, { role: "otaru", text: data.answer }]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: "otaru", text: `Maaf, saya tidak bisa menjawab saat ini: ${e.message}` }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }

  // ── Render sections ──

  const renderTanya = () => (
    <div className="flex flex-col gap-0" style={{ height: "calc(100vh - 220px)" }}>
      {/* Chat history */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4 pr-1" style={{ minHeight: 0 }}>
        {chatMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "otaru" && (
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                <span className="text-[10px] font-bold text-emerald-400">O</span>
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-white text-black rounded-br-sm"
                  : "bg-[#111] border border-white/10 text-white/90 rounded-bl-sm"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
              <span className="text-[10px] font-bold text-emerald-400">O</span>
            </div>
            <div className="bg-[#111] border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested questions */}
      {chatMessages.length <= 1 && (
        <div className="flex flex-wrap gap-2 py-3">
          {[
            "Kenapa skor saya segini?",
            "Cara naik ke grade A?",
            "Apakah aman ambil kasbon?",
            "Apa itu DSR?",
          ].map(q => (
            <button
              key={q}
              onClick={() => { setChatInput(q); }}
              className="text-[11px] bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t border-white/10">
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChatSend()}
          placeholder="Tanya Otaru..."
          className="flex-1 bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
          disabled={chatLoading}
        />
        <button
          onClick={handleChatSend}
          disabled={!chatInput.trim() || chatLoading}
          className="w-10 h-10 bg-white rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-white/90 transition-colors flex-shrink-0 self-center"
        >
          {chatLoading ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Send className="w-4 h-4 text-black" />}
        </button>
      </div>
    </div>
  );

  const renderRingkasan = () => (
    <div className="space-y-4">
      {/* Score Card */}
      <div className="bg-[#111] border border-white/10 rounded-2xl p-5">
        {scoreLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-white/40" /></div>
        ) : score ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">Otaru Integrity Index</h3>
              <button onClick={fetchScore} className="text-white/40 hover:text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="relative flex items-center justify-center">
              <ScoreRing value={score.otaru_index} />
              <div className="absolute text-center">
                <div className="text-2xl font-bold text-white">{score.otaru_index}</div>
                <div className={`text-xs font-bold ${gradeColor(score.credit_grade)}`}>Grade {score.credit_grade}</div>
              </div>
            </div>
            {/* 3 component bars */}
            <div className="mt-4 space-y-2">
              {[
                { label: "DSR Score", val: score.dsr_score, max: 300, color: "bg-blue-500" },
                { label: "Konsistensi", val: score.consistency_score, max: 300, color: "bg-purple-500" },
                { label: "Integritas", val: score.integrity_score, max: 400, color: "bg-emerald-500" },
              ].map(({ label, val, max, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs text-white/60 mb-1">
                    <span>{label}</span><span>{val}/{max}</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${(val / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-white/40 text-sm">Login untuk melihat skor</div>
        )}
      </div>

      {/* Plafon card */}
      {score && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-white/40 mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" /> Gaji</div>
            <div className="text-sm font-semibold text-white">{fmtIDR(score.salary)}</div>
            <div className="text-[10px] text-white/30 mt-0.5">{score.salary_source === "ocr_verified" ? "✅ OCR Terverifikasi" : "✏️ Manual"}</div>
          </div>
          <div className="bg-[#111] border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-white/40 mb-1 flex items-center gap-1"><BarChart3 className="w-3 h-3" /> DSR</div>
            <div className="text-sm font-semibold text-white">{score.dsr_percent}%</div>
            <div className="text-[10px] text-white/30 mt-0.5">Cicilan: {fmtIDR(score.cicilan_aktif_total)}</div>
          </div>
          <div className="col-span-2 bg-[#111] border border-emerald-500/20 rounded-2xl p-4">
            <div className="text-xs text-emerald-400/70 mb-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Sisa Plafon Aman</div>
            <div className="text-lg font-bold text-emerald-400">{fmtIDR(score.sisa_plafon_aman)}</div>
            <div className="text-[10px] text-white/30 mt-0.5">Integrity: {score.integrity_level} · Dimanipulasi: {score.tampered_attempts}x</div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: FileText, label: "Input Manual", section: "manual" as Section },
          { icon: Camera, label: "Upload OCR", section: "ocr" as Section },
        ].map(({ icon: Icon, label, section: s }) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className="bg-[#111] border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-white/30 transition-colors"
          >
            <Icon className="w-5 h-5 text-white/70" />
            <span className="text-[11px] text-white/60">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderManual = () => (
    <div className="space-y-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2"><FileText className="w-4 h-4" /> Input Profil Manual</h3>
        <p className="text-xs text-white/40">Data ini dipakai jika belum ada verifikasi OCR.</p>

        <div className="space-y-3">
          <div>
            <Label className="text-white/60 text-xs">Gaji Bulanan (IDR)</Label>
            <Input
              placeholder="contoh: 5000000"
              value={profil.gaji_bulanan}
              onChange={e => setProfil(p => ({ ...p, gaji_bulanan: e.target.value }))}
              className="bg-[#1a1a1a] border-white/10 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-white/60 text-xs">Pengeluaran Rutin (IDR/bln)</Label>
            <Input
              placeholder="contoh: 2000000"
              value={profil.pengeluaran_rutin}
              onChange={e => setProfil(p => ({ ...p, pengeluaran_rutin: e.target.value }))}
              className="bg-[#1a1a1a] border-white/10 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-white/60 text-xs">Jumlah Tanggungan</Label>
            <Input
              placeholder="contoh: 2"
              type="number"
              value={profil.tanggungan}
              onChange={e => setProfil(p => ({ ...p, tanggungan: e.target.value }))}
              className="bg-[#1a1a1a] border-white/10 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-white/60 text-xs">Pekerjaan</Label>
            <Input
              placeholder="contoh: Karyawan Swasta"
              value={profil.pekerjaan}
              onChange={e => setProfil(p => ({ ...p, pekerjaan: e.target.value }))}
              className="bg-[#1a1a1a] border-white/10 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-white/60 text-xs">Nama Perusahaan</Label>
            <Input
              placeholder="contoh: PT Maju Bersama"
              value={profil.nama_perusahaan}
              onChange={e => setProfil(p => ({ ...p, nama_perusahaan: e.target.value }))}
              className="bg-[#1a1a1a] border-white/10 text-white mt-1"
            />
          </div>
        </div>

        <Button
          onClick={handleSaveProfil}
          disabled={profilLoading}
          className="w-full bg-white text-black hover:bg-white/90"
        >
          {profilLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Profil"}
        </Button>
      </div>
    </div>
  );

  const renderOCR = () => (
    <div className="space-y-4">

      <div className="bg-[#111] border border-white/10 rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2"><Camera className="w-4 h-4" /> Upload Dokumen OCR</h3>
        <p className="text-xs text-white/40">
          AI akan otomatis mendeteksi jenis dokumen dan mengekstrak data.<br />
          <span className="text-emerald-400">Slip Gaji</span> → update gaji verified (bobot lebih tinggi di skor).<br />
          <span className="text-blue-400">Struk Belanja</span> → verifikasi pola pengeluaran.
        </p>

        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer hover:border-white/40 transition-colors"
        >
          {ocrPreview ? (
            <img src={ocrPreview} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
          ) : (
            <div className="space-y-2">
              <Upload className="w-8 h-8 mx-auto text-white/30" />
              <p className="text-sm text-white/40">Tap untuk pilih foto</p>
              <p className="text-xs text-white/20">JPG, PNG, WEBP</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

        {ocrFile && (
          <div className="flex items-center justify-between text-xs text-white/50 bg-white/5 rounded-lg px-3 py-2">
            <span className="truncate">{ocrFile.name}</span>
            <button onClick={() => { setOcrFile(null); setOcrPreview(null); setOcrHasil(null); }} className="ml-2 text-white/30 hover:text-red-400">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <Button
          onClick={handleOcrUnggah}
          disabled={!ocrFile || ocrLoading}
          className="w-full bg-white text-black hover:bg-white/90"
        >
          {ocrLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Memproses AI...</> : "Proses Dokumen"}
        </Button>
        <p className="text-[11px] text-white/35">
          Catatan: Untuk dokumen OtaruChain, format diasumsikan sudah diisi user saat submit sehingga lolos format check.
        </p>
      </div>

      {/* OCR Hasil */}
      {ocrHasil && (
        <div className={`bg-[#111] border rounded-2xl p-5 space-y-3 ${ocrHasil.ai_indicator === "TAMPERED" ? "border-red-500/40" : "border-emerald-500/20"}`}>
          <h4 className="font-semibold text-white flex items-center gap-2">
            {ocrHasil.ai_indicator === "TAMPERED"
              ? <AlertCircle className="w-4 h-4 text-red-400" />
              : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            Hasil OCR
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-white/40">Jenis Dokumen</div>
              <div className="text-white font-medium">
                {ocrHasil.doc_type === "slip_gaji" ? "📑 Slip Gaji" : ocrHasil.doc_type === "struk_belanja" ? "🧾 Struk Belanja" : "📄 Tidak Dikenal"}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/40">Nominal OCR</div>
              <div className="text-white font-medium">{fmtIDR(ocrHasil.extracted_nominal || 0)}</div>
            </div>
            <div>
              <div className="text-xs text-white/40">Confidence</div>
              <div className={`font-medium ${ocrHasil.confidence === "high" ? "text-emerald-400" : ocrHasil.confidence === "medium" ? "text-yellow-400" : "text-red-400"}`}>
                {ocrHasil.confidence?.toUpperCase()}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/40">Status AI</div>
              <div className={`font-medium ${ocrHasil.ai_indicator === "TAMPERED" ? "text-red-400" : "text-emerald-400"}`}>
                {ocrHasil.ai_indicator}
              </div>
            </div>
          </div>
          {ocrHasil.doc_type === "slip_gaji" && ocrHasil.ai_indicator === "CLEAN" && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-xs text-emerald-300">
              ✅ Gaji berhasil diverifikasi via OCR. Skor kamu sekarang menggunakan gaji verified.
            </div>
          )}
          {ocrHasil.ai_indicator === "TAMPERED" && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-300">
              ⚠️ Dokumen terdeteksi manipulasi. Integrity Score berkurang.
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderCatatan = () => {
    function saveCatatan(newEntries: typeof catatanEntries) {
      setCatatanEntries(newEntries);
      localStorage.setItem("otaru_catatan", JSON.stringify(newEntries));
    }

    function handleAdd() {
      const nom = parseInt(catatanForm.nominal.replace(/\D/g, ""));
      if (!nom || nom <= 0) { toast.error("Nominal harus diisi"); return; }
      const entry = { id: Tanggal.now().toString(), type: catatanForm.type, nominal: nom, keterangan: catatanForm.keterangan, created_at: new Tanggal().toISOString() };
      saveCatatan([entry, ...catatanEntries]);
      setCatatanForm({ type: "pemasukan", nominal: "", keterangan: "" });
      toast.success("Catatan ditambahkan!");
    }

    function handleDelete(id: string) {
      saveCatatan(catatanEntries.filter(e => e.id !== id));
    }

    const total = catatanEntries.reduce((sum, e) => sum + (e.type === "pemasukan" ? e.nominal : -e.nominal), 0);

    return (
      <div className="space-y-4">
        {/* Balance */}
        <div className={`bg-[#111] border rounded-2xl p-5 ${total >= 0 ? "border-emerald-500/20" : "border-red-500/20"}`}>
          <div className="text-xs text-white/40 mb-1">Saldo Saat Ini</div>
          <div className={`text-2xl font-bold ${total >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtIDR(Math.abs(total))}</div>
          <div className="text-[10px] text-white/30 mt-0.5">{total >= 0 ? "Surplus" : "Defisit"}</div>
        </div>

        {/* Add form */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-white text-sm">Tambah Catatan</h3>
          <div className="grid grid-cols-2 gap-2">
            {(["pemasukan", "pengeluaran"] as const).map(t => (
              <button key={t} onClick={() => setCatatanForm(f => ({ ...f, type: t }))}
                className={`py-2 rounded-xl text-xs font-medium transition-colors ${catatanForm.type === t ? (t === "pemasukan" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30") : "bg-white/5 text-white/40 border border-white/10"}`}>
                {t === "pemasukan" ? "➕ Pemasukan" : "➖ Pengeluaran"}
              </button>
            ))}
          </div>
          <Input placeholder="Nominal (IDR)" value={catatanForm.nominal} onChange={e => setCatatanForm(f => ({ ...f, nominal: e.target.value }))} className="bg-[#1a1a1a] border-white/10 text-white" />
          <Input placeholder="Keterangan (opsional)" value={catatanForm.keterangan} onChange={e => setCatatanForm(f => ({ ...f, keterangan: e.target.value }))} className="bg-[#1a1a1a] border-white/10 text-white" />
          <Button onClick={handleAdd} className="w-full bg-white text-black hover:bg-white/90 text-sm">Simpan</Button>
        </div>

        {/* List */}
        {catatanEntries.length > 0 && (
          <div className="bg-[#111] border border-white/10 rounded-2xl p-5 space-y-2">
            <h4 className="text-sm font-semibold text-white/70 mb-3">Riwayat</h4>
            {catatanEntries.map(e => (
              <div key={e.id} className="flex items-center justify-between py-2 border-t border-white/5">
                <div>
                  <div className="text-sm text-white">{e.keterangan || (e.type === "pemasukan" ? "Pemasukan" : "Pengeluaran")}</div>
                  <div className="text-[10px] text-white/30">{new Tanggal(e.created_at).toLocaleTanggalString("id-ID")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${e.type === "pemasukan" ? "text-emerald-400" : "text-red-400"}`}>
                    {e.type === "pemasukan" ? "+" : "-"}{fmtIDR(e.nominal)}
                  </span>
                  <button onClick={() => handleDelete(e.id)} className="text-white/20 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Nav tabs ──

  const navTabs: { id: Section; label: string; icon: any }[] = [
    { id: "overview", label: "Skor", icon: TrendingUp },
    { id: "tanya", label: "Tanya", icon: MessageSquare },
    { id: "manual", label: "Manual", icon: FileText },
    { id: "ocr", label: "OCR", icon: Camera },
    { id: "catatan", label: "Catatan", icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-white">💳 Otaru Financial</h1>
        <p className="text-xs text-white/40 mt-0.5">Kelola profil kredit kamu</p>
      </div>

      {/* Sub navigation */}
      <div className="px-4 mb-4">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {navTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-medium transition-colors ${
                section === id ? "bg-white text-black" : "text-white/40 hover:text-white/70"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        {section === "overview" && renderRingkasan()}
        {section === "tanya" && renderTanya()}
        {section === "manual" && renderManual()}
        {section === "ocr" && renderOCR()}
        {section === "catatan" && renderCatatan()}
      </div>
    </div>
  );
}
