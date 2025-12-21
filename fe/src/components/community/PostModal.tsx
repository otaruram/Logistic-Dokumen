import { motion } from "framer-motion";
import { X, Globe, Users, Plus, LogIn } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultScope?: "INTERNAL" | "GLOBAL";
  onRequestCreateTeam: () => void;
  onRequestJoinTeam: () => void;
}

const PostModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  defaultScope = "GLOBAL",
  onRequestCreateTeam,
  onRequestJoinTeam
}: PostModalProps) => {
  const [content, setContent] = useState("");
  const [scope, setScope] = useState<"INTERNAL" | "GLOBAL">(defaultScope);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);
  const [checkingTeam, setCheckingTeam] = useState(true);
  const [authorName, setAuthorName] = useState("");

  useEffect(() => {
    if (isOpen) {
      checkUserTeam();
    }
  }, [isOpen]);

  const checkUserTeam = async () => {
    setCheckingTeam(true);
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) {
        setCheckingTeam(false);
        return;
      }

      const userName = sessionData?.session?.user?.user_metadata?.full_name || 
                      sessionData?.session?.user?.email?.split('@')[0] || 
                      "User";
      setAuthorName(userName);

      const response = await fetch(`${API_BASE_URL}/api/community/teams/my-team`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setHasTeam(!!data);
      } else {
        setHasTeam(false);
      }
    } catch (error) {
      console.error("Check team error:", error);
      setHasTeam(false);
    } finally {
      setCheckingTeam(false);
    }
  };

  const handlePost = async () => {
    if (!content.trim()) {
      toast.error("Isi postingan tidak boleh kosong");
      return;
    }

    setIsSubmitting(true);
    toast.loading("Posting...");

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.dismiss();
        toast.error("Please login first");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/community/posts/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          content: content.trim(),
          scope,
          author_name: authorName
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create post");
      }

      toast.dismiss();
      toast.success(`✅ Postingan ${scope === "INTERNAL" ? "internal" : "publik"} berhasil dibuat!`);
      
      setContent("");
      setScope("GLOBAL");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Create post error:", error);
      toast.dismiss();
      toast.error(error.message || "Gagal membuat postingan");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-black">Buat Postingan Baru ✍️</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <div className="flex gap-3">
            <button
              onClick={() => setScope("GLOBAL")}
              disabled={isSubmitting}
              className={`flex-1 p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
                scope === "GLOBAL"
                  ? "border-black bg-black text-white shadow-lg"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className={`p-2 rounded-full ${scope === "GLOBAL" ? "bg-white/20" : "bg-gray-100"}`}>
                <Globe className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm">Lounge GA</div>
                <div className="text-xs opacity-80">Publik untuk semua</div>
              </div>
            </button>

            <button
              onClick={() => setScope("INTERNAL")}
              disabled={isSubmitting}
              className={`flex-1 p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
                scope === "INTERNAL"
                  ? "border-blue-600 bg-blue-600 text-white shadow-lg"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className={`p-2 rounded-full ${scope === "INTERNAL" ? "bg-white/20" : "bg-gray-100"}`}>
                <Users className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm">Kantor Kita</div>
                <div className="text-xs opacity-80">Internal Tim</div>
              </div>
            </button>
          </div>
        </div>

        <div className="relative">
          {scope === "INTERNAL" && !checkingTeam && !hasTeam ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-50 border-2 border-blue-200 rounded-xl p-8 text-center"
            >
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Anda Belum Punya Tim</h3>
              <p className="text-gray-600 text-sm mb-6">
                Fitur ini khusus untuk diskusi internal kantor. Silakan buat tim baru atau gabung tim yang sudah ada.
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => {
                    onClose();
                    setTimeout(() => onRequestCreateTeam(), 200);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  <Plus className="w-4 h-4" /> Buat Tim
                </Button>
                <Button
                  onClick={() => {
                    onClose();
                    setTimeout(() => onRequestJoinTeam(), 200);
                  }}
                  variant="outline"
                  className="border-2 border-black gap-2"
                >
                  <LogIn className="w-4 h-4" /> Gabung Tim
                </Button>
              </div>
            </motion.div>
          ) : (
            <>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  scope === "GLOBAL"
                    ? "Contoh: Ada rekomendasi vendor catering murah di Jakarta Selatan?"
                    : "Contoh: Guys, jangan lupa meeting jam 2 siang ya!"
                }
                className="min-h-[150px] border-2 border-black focus:ring-2 focus:ring-black resize-none"
                disabled={isSubmitting}
                maxLength={5000}
              />
              <div className="text-right mt-2 text-xs text-gray-400">
                {content.length}/5000 karakter
              </div>
            </>
          )}
        </div>

        {!(scope === "INTERNAL" && !hasTeam) && (
          <div className="flex gap-3 pt-6">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 border-2 border-black rounded-lg hover:bg-gray-50"
            >
              Batal
            </Button>
            <Button
              onClick={handlePost}
              disabled={isSubmitting || !content.trim()}
              className="flex-1 bg-black text-white hover:bg-gray-800 rounded-lg"
            >
              {isSubmitting ? "Posting..." : "Posting Sekarang 🚀"}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PostModal;
