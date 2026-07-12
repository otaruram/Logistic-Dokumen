import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bot, Copy, HelpCircle, Link2, LogOut, Mail, Shield, Trash2, Loader2, Wand2, Award, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";

const ProfileTab = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("user@example.com");
  const [tgLoading, setTgLoading] = useState(false);
  const [tgStatus, setTgStatus] = useState<any>(null);
  const [selectedBot, setSelectedBot] = useState<"otaruchain" | "otaru_finance">("otaruchain");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [rewardItems, setRewardItems] = useState<any[]>([]);
  const [rewardContext, setRewardContext] = useState<{ gold?: string; platinum?: string }>({});
  const isPhoneValid = /^[1-9]\d{8,11}$/.test(phoneNumber); // 9-12 digits, no leading 0
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";



  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserEmail(data.user.email || "user@example.com");
        setUserName(data.user.user_metadata?.name || data.user.email?.split('@')[0] || "User");
      }
    };
    fetchUser();
  }, []);

  const loadTelegramStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API_BASE_URL}/api/telegram/connect/status?bot=${selectedBot}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setTgStatus(await res.json());
      }
    } catch {
      // Optional panel
    }
  };

  useEffect(() => {
    loadTelegramStatus();
  }, [selectedBot]);

  useEffect(() => {
    const loadRewards = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(`${API_BASE_URL}/api/v1/gamification/rewards/gallery`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        setRewardItems(Array.isArray(json.items) ? json.items : []);
        setRewardContext({
          gold: json.gold_context_tba,
          platinum: json.platinum_context_tba,
        });
      } catch {
        // Rewards panel is optional.
      }
    };
    loadRewards();
  }, []);

  const handleConnectTelegram = async () => {
    setTgLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please login first");
        return;
      }
      // POST /connect — send phone_number in body for identity gate
      const res = await fetch(`${API_BASE_URL}/api/telegram/connect?bot=${selectedBot}`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone_number: `0${phoneNumber}` }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to generate key");
      setTgStatus({
        connected: json.is_linked,
        has_key: true,
        tele_key: json.tele_key,
        deep_link: json.deep_link,
        selected_bot: json.selected_bot,
      });
      toast.success("Key baru di-generate. Paste ke bot untuk reset sesi.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate key");
    } finally {
      setTgLoading(false);
    }
  };

  const handleAutoFillPhone = async () => {
    setAutoFillLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      
      const res = await fetch(`${API_BASE_URL}/api/v1/profiles/phone/autofill`, {
        headers,
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Gagal auto fill nomor HP");

      const phone = String(json.phone_number || "");
      if (phone.startsWith("0")) {
        setPhoneNumber(phone.slice(1));
      } else {
        setPhoneNumber(phone);
      }

      setTgStatus((prev: any) => ({ ...(prev || {}), phone_number: phone }));
      toast.success("Nomor HP berhasil diisi otomatis dari profil.");
    } catch (e: any) {
      toast.error(e?.message || "Gagal auto fill nomor HP");
    } finally {
      setAutoFillLoading(false);
    }
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleOpenCertificate = async (monthYear: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Silakan login ulang untuk membuka sertifikat");
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/v1/gamification/certificate/${monthYear}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Gagal membuka sertifikat");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 30_000);
    } catch (e: any) {
      toast.error(e?.message || "Gagal membuka sertifikat");
    }
  };

  const handleLogout = async () => {
    toast.loading("Logging out...");
    try {
      await supabase.auth.signOut();
      toast.dismiss();
      window.location.href = "/";
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to logout");
    }
  };

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not logged in");
    return { Authorization: `Bearer ${session.access_token}` };
  };

  return (
    <div className="space-y-6 pt-6 px-4 pb-12">
      {/* Profile Header */}
      <motion.div
        className="bg-[#111] border border-white/10 rounded-2xl p-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="w-20 h-20 rounded-full bg-white p-1 mx-auto">
          <div className="w-full h-full rounded-full bg-black flex items-center justify-center border border-white/10">
            <span className="text-2xl font-bold text-white uppercase">{userName.charAt(0)}</span>
          </div>
        </div>
        <h2 className="text-xl font-bold mt-4 text-white">{userName}</h2>
        <div className="flex items-center justify-center gap-2 text-gray-400 mt-1">
          <Mail className="w-4 h-4" />
          <span className="text-sm">{userEmail}</span>
        </div>
      </motion.div>

      {/* Telegram + Settings */}
      <motion.div
        className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-blue-400" />
          <h3 className="font-bold text-white">Telegram Bot Connect</h3>
        </div>
        <p className="text-xs text-gray-400">
          Masukkan <b>Nomor HP</b> terlebih dahulu, lalu klik <b>Generate Key</b>. Paste kunci ke bot Telegram (<code>/start KEY</code>). Nomor HP akan disimpan dan menjadi identitas utama di seluruh API.
        </p>

        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => setSelectedBot("otaruchain")}
            className="px-3 py-2 rounded-lg text-xs font-semibold border bg-white text-black border-white"
          >
            OtaruChain Bot
          </button>
        </div>

        {/* Phone Number Gate */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Nomor HP <span className="text-red-400">*</span></label>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-xs text-gray-500 bg-white/5 border border-white/10 rounded-lg px-2 sm:px-3 py-2.5 font-mono shrink-0">📱</span>
            <input
              type="tel"
              placeholder="812xxxxxxxx"
              value={phoneNumber}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 12);
                setPhoneNumber(v);
              }}
              className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-2 sm:px-3 py-2.5 text-sm text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
            />
            <button
              type="button"
              onClick={handleAutoFillPhone}
              disabled={autoFillLoading}
              title="Auto Fill Nomor HP"
              className="inline-flex items-center justify-center shrink-0 rounded-lg border border-white/15 bg-white/5 p-2.5 text-gray-200 hover:bg-white/10 disabled:opacity-60 transition-colors"
            >
              {autoFillLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            </button>
          </div>
          {phoneNumber && !isPhoneValid && (
            <p className="text-[11px] text-red-400">Nomor HP harus 9-12 digit (tanpa 0 di depan).</p>
          )}
          {isPhoneValid && (
            <p className="text-[11px] text-emerald-400">✓ Nomor valid: {phoneNumber}</p>
          )}
        </div>

        <button
          onClick={handleConnectTelegram}
          disabled={tgLoading || !isPhoneValid}
          className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            isPhoneValid
              ? "bg-white text-black hover:bg-gray-200"
              : "bg-white/10 text-gray-500 cursor-not-allowed"
          } disabled:opacity-60`}
        >
          {tgLoading ? "Memproses..." : !isPhoneValid ? "🔒 Masukkan Nomor HP dulu" : "🔑 Generate / Reset Key"}
        </button>

        {tgStatus?.has_key && (
          <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-500">Tele Key</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono text-[11px] truncate max-w-[180px]">{tgStatus.tele_key}</span>
                <button onClick={() => handleCopy(tgStatus.tele_key, "Tele key")} className="p-1 rounded hover:bg-white/10">
                  <Copy className="w-3.5 h-3.5 text-gray-300" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-500">Bot Link</span>
              <div className="flex items-center gap-2">
                <a href={tgStatus.deep_link} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200 inline-flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5" /> Open Bot
                </a>
                <button onClick={() => handleCopy(tgStatus.deep_link, "Deep link")} className="p-1 rounded hover:bg-white/10">
                  <Copy className="w-3.5 h-3.5 text-gray-300" />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-500">Status: {tgStatus.connected ? "🟢 Connected" : "🔴 Belum terhubung ke bot"}</p>
            <p className="text-[11px] text-gray-500">Bot aktif: @otaruchain_bot</p>
            {tgStatus.phone_number && (
              <p className="text-[11px] text-emerald-400">📱 HP: {tgStatus.phone_number}</p>
            )}
          </div>
        )}

        <div className="pt-2 space-y-2 border-t border-white/10">
          <button
            onClick={() => { toast.success("Cache cleared!"); }}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/10 hover:bg-white/5"
          >
            <span className="flex items-center gap-2 text-sm text-gray-200"><Trash2 className="w-4 h-4 text-gray-400" /> Clear Cache</span>
            <span className="text-xs text-gray-500">Open</span>
          </button>
          <button
            onClick={() => navigate("/privacy")}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/10 hover:bg-white/5"
          >
            <span className="flex items-center gap-2 text-sm text-gray-200"><Shield className="w-4 h-4 text-gray-400" /> Privacy Policy</span>
            <span className="text-xs text-gray-500">Open</span>
          </button>
          <button
            onClick={() => navigate("/help")}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/10 hover:bg-white/5"
          >
            <span className="flex items-center gap-2 text-sm text-gray-200"><HelpCircle className="w-4 h-4 text-gray-400" /> Help Center</span>
            <span className="text-xs text-gray-500">Open</span>
          </button>
        </div>
      </motion.div>

      {/* Reward Gallery */}
      <motion.div
        className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-300" />
          <h3 className="font-bold text-white">Badge & Sertifikat</h3>
        </div>
        <p className="text-xs text-gray-400">
          Reward ditampilkan sebagai kartu gambar ringan (asset dari URL), tidak menumpuk, dan bisa dibuka sertifikatnya.
        </p>

        {rewardItems.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-gray-500">
            Belum ada reward bulan ini. Capai minimal Silver untuk membuka badge pertama.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {rewardItems.map((item) => (
              <div key={`${item.badge_type}-${item.month_year}`} className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{item.badge_label} • {item.month_year}</p>
                  <span className="text-[11px] text-gray-400">{item.verified_count} doc</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Badge</p>
                    <img
                      src={item.badge_image_url}
                      alt={`Badge ${item.badge_label}`}
                      loading="lazy"
                      className="w-full aspect-[16/9] rounded-lg border border-white/10 object-cover"
                    />
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Preview Sertifikat</p>
                    <img
                      src={item.certificate_preview_url}
                      alt={`Sertifikat ${item.badge_label}`}
                      loading="lazy"
                      className="w-full aspect-[16/9] rounded-lg border border-white/10 object-cover"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-gray-500">Bonus plafon: Rp {Number(item.plafon_bonus || 0).toLocaleString("id-ID")}</p>
                  <button
                    type="button"
                    onClick={() => handleOpenCertificate(item.month_year)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-gray-200 hover:bg-white/10"
                  >
                    Sertifikat <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(rewardContext.gold || rewardContext.platinum) && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-gray-400 space-y-1">
            {rewardContext.gold && <p>Gold Benefit: {rewardContext.gold}</p>}
            {rewardContext.platinum && <p>Platinum Benefit: {rewardContext.platinum}</p>}
          </div>
        )}
      </motion.div>

      {/* Account Actions */}
      <motion.div
        className="space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Button
          variant="outline"
          className="w-full justify-start gap-3 bg-[#111] border-white/10 text-white hover:bg-white/5 hover:text-white h-12"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </motion.div>
    </div>
  );
};

export default ProfileTab;