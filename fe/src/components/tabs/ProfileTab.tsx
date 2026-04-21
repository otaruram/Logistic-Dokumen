import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bot, Copy, HelpCircle, Link2, LogOut, Mail, Shield, Trash2 } from "lucide-react";
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
      const res = await fetch(`${API_BASE_URL}/api/telegram/connect/status`, {
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
  }, []);

  const handleConnectTelegram = async () => {
    setTgLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please login first");
        return;
      }
      // POST /connect — no body needed, identity comes from Bearer token
      const res = await fetch(`${API_BASE_URL}/api/telegram/connect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to generate key");
      setTgStatus({
        connected: json.is_linked,
        has_key: true,
        tele_key: json.tele_key,
        deep_link: json.deep_link,
      });
      toast.success("Key baru di-generate. Paste ke bot untuk reset sesi.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate key");
    } finally {
      setTgLoading(false);
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
          Klik <b>Generate Key</b> untuk membuat kunci baru. Paste kunci ke bot Telegram (<code>/start KEY</code>). Setiap key baru akan mereset sesi Telegram lama.
        </p>

        <button
          onClick={handleConnectTelegram}
          disabled={tgLoading}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-gray-200 disabled:opacity-60"
        >
          {tgLoading ? "Memproses..." : "🔑 Generate / Reset Key"}
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