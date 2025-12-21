import { motion } from "framer-motion";
import { X, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface TeamJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TeamJoinModal = ({ isOpen, onClose, onSuccess }: TeamJoinModalProps) => {
  const [joinCode, setJoinCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleJoin = async () => {
    if (!joinCode.trim() || joinCode.length < 5) {
      toast.error("Kode join tidak valid");
      return;
    }

    setIsSubmitting(true);
    toast.loading("Bergabung ke kantor...");

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.dismiss();
        toast.error("Please login first");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/community/teams/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ join_code: joinCode.toUpperCase() })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to join team");
      }

      const data = await response.json();
      
      toast.dismiss();
      toast.success(`✅ Berhasil bergabung ke "${data.name}"!`);
      
      setJoinCode("");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Join team error:", error);
      toast.dismiss();
      toast.error(error.message || "Kode join salah atau kantor tidak ditemukan");
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
        className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-black">Gabung Kantor</h3>
              <p className="text-sm text-gray-600">Masukkan kode dari rekan kantor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="joinCode" className="text-sm font-medium text-black">
              Kode Join
            </Label>
            <Input
              id="joinCode"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="DGTNZ-88"
              className="mt-1.5 border-2 border-black focus:ring-2 focus:ring-black rounded-lg font-mono text-center text-lg tracking-wider"
              disabled={isSubmitting}
              maxLength={50}
            />
            <p className="text-xs text-gray-500 mt-1">
              Contoh format: ABCDE-12 (huruf kapital & angka)
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-2 border-black rounded-lg hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              onClick={handleJoin}
              disabled={isSubmitting || !joinCode.trim() || joinCode.length < 5}
              className="flex-1 bg-black text-white hover:bg-gray-800 rounded-lg"
            >
              {isSubmitting ? "Bergabung..." : "Gabung"}
            </Button>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
          <p className="text-xs text-gray-600 leading-relaxed">
            💡 <strong>Kode Join</strong> didapat dari admin atau rekan kantor yang sudah tergabung. Setiap kantor punya kode unik.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default TeamJoinModal;
