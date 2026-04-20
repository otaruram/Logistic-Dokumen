import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Bot, Copy, Link2, Shield, HelpCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

const OptionsTab = () => {
  const navigate = useNavigate();
  const [nik, setNik] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const loadStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API_BASE_URL}/api/telegram/connect/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // Silent fail for optional panel
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnectTelegram = async () => {
    if (!/^\d{16}$/.test(nik)) {
      toast.error("NIK harus 16 digit angka");
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please login first");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/telegram/connect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nik }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || "Failed to connect Telegram");
      }

      setStatus({
        connected: json.is_linked,
        has_key: true,
        tele_key: json.tele_key,
        nik_last4: json.nik_last4,
        deep_link: json.deep_link,
        bot_username: json.bot_username,
      });
      toast.success("Tele key siap. Paste ke bot untuk koneksi permanen.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to connect Telegram");
    } finally {
      setLoading(false);
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

  const settingsGroups = [
    {
      title: "Data & Privacy",
      items: [
        {
          icon: Trash2,
          label: "Clear Cache",
          value: "",
          action: () => toast.success("Cache cleared!"),
        },
        {
          icon: Shield,
          label: "Privacy Policy",
          value: "",
          action: () => navigate("/privacy"),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          icon: HelpCircle,
          label: "Help Center",
          value: "",
          action: () => navigate("/help"),
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 pt-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-4"
      >
        <h2 className="text-xl font-bold text-white">Settings</h2>
        <p className="text-gray-400 text-sm mt-1">Integrasi Telegram dan preferensi akun</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mx-4 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5"
      >
        <div className="flex items-center gap-2 mb-3">
          <Bot className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Telegram Bot Connect</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Masukkan NIK untuk generate tele key permanen. Setelah key dipaste ke bot, akses Fraud Scan dan dashboard bisa langsung dari Telegram.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            value={nik}
            onChange={(e) => setNik(e.target.value.replace(/\D/g, "").slice(0, 16))}
            placeholder="NIK (16 digit)"
            className="flex-1 bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40"
          />
          <button
            onClick={handleConnectTelegram}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-white text-black hover:bg-gray-200 disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Generate Key"}
          </button>
        </div>

        {status?.has_key && (
          <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-500">Tele Key</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono text-[11px] truncate max-w-[180px]">{status.tele_key}</span>
                <button onClick={() => handleCopy(status.tele_key, "Tele key")} className="p-1 rounded hover:bg-white/10">
                  <Copy className="w-3.5 h-3.5 text-gray-300" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-500">Bot Link</span>
              <div className="flex items-center gap-2">
                <a
                  href={status.deep_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-300 hover:text-blue-200 inline-flex items-center gap-1"
                >
                  <Link2 className="w-3.5 h-3.5" /> Open Bot
                </a>
                <button onClick={() => handleCopy(status.deep_link, "Deep link")} className="p-1 rounded hover:bg-white/10">
                  <Copy className="w-3.5 h-3.5 text-gray-300" />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-500">
              NIK terdaftar: ****{status.nik_last4 || "----"} • Status: {status.connected ? "Connected" : "Not connected"}
            </p>
          </div>
        )}
      </motion.div>

      {settingsGroups.map((group, groupIndex) => (
        <motion.div
          key={group.title}
          className="space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * (groupIndex + 1) }}
        >
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-5">
            {group.title}
          </h3>
          <div className="bg-[#111] border-y border-white/10 sm:border sm:rounded-xl overflow-hidden divide-y divide-white/5 mx-0 sm:mx-4 hover:border-white/20 transition-colors">
            {group.items.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={item.action}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                      <Icon className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                    </div>
                    <span className="font-medium text-sm text-gray-200">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    {item.value && <span className="text-sm px-2 py-0.5 rounded-md bg-white/5 border border-white/5">{item.value}</span>}
                    <span className="text-xs">Open</span>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center pt-8 pb-8"
      >
        <p className="text-xs text-gray-600 font-mono">
          ocr.wtf v2.1.0 • Connected to SG-1
        </p>
      </motion.div>
    </div>
  );
};

export default OptionsTab;