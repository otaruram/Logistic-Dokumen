import { motion } from "framer-motion";
import { X, Building2, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface TeamCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TeamCreateModal = ({ isOpen, onClose, onSuccess }: TeamCreateModalProps) => {
  const [teamName, setTeamName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [createdTeamName, setCreatedTeamName] = useState("");

  const handleCreate = async () => {
    if (!teamName.trim() || teamName.length < 3) {
      toast.error("Nama kantor minimal 3 karakter");
      return;
    }

    setIsSubmitting(true);
    toast.loading("Membuat kantor...");

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.dismiss();
        toast.error("Please login first");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/community/teams/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: teamName })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create team");
      }

      const data = await response.json();
      
      toast.dismiss();
      
      // JANGAN tutup modal, tapi tampilkan kode
      setGeneratedCode(data.join_code || data.team?.join_code);
      setCreatedTeamName(teamName);
      onSuccess(); // Refresh data parent
    } catch (error: any) {
      console.error("Create team error:", error);
      toast.dismiss();
      toast.error(error.message || "Gagal membuat kantor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCode);
    toast.success("✅ Kode berhasil disalin!");
  };

  const handleClose = () => {
    setGeneratedCode("");
    setTeamName("");
    setCreatedTeamName("");
    onClose();
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
        {/* KONDISI 1: Form Input (Belum ada kode) */}
        {!generatedCode ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black">Buat Kantor Baru</h3>
                  <p className="text-sm text-gray-600">Jadi admin kantor kamu</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="teamName" className="text-sm font-medium text-black">
                  Nama Kantor
                </Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="PT. Digital Nusantara"
                  className="mt-1.5 border-2 border-black focus:ring-2 focus:ring-black rounded-lg"
                  disabled={isSubmitting}
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimal 3 karakter. Contoh: PT ABC, CV XYZ
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 border-2 border-black rounded-lg hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={isSubmitting || !teamName.trim() || teamName.length < 3}
                  className="flex-1 bg-black text-white hover:bg-gray-800 rounded-lg"
                >
                  {isSubmitting ? "Membuat..." : "Buat Kantor"}
                </Button>
              </div>
            </div>

            {/* Info */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
              <p className="text-xs text-gray-600 leading-relaxed">
                💡 <strong>Setelah dibuat:</strong> Kamu akan dapat <strong>Kode Join</strong> unik yang bisa dibagikan ke rekan kantor untuk bergabung.
              </p>
            </div>
          </>
        ) : (
          /* KONDISI 2: Sukses & Tampilkan Kode */
          <>
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              
              <h3 className="text-2xl font-bold text-black mb-2">Tim Berhasil Dibuat!</h3>
              <p className="text-gray-600 mb-6 text-sm">
                Kantor <strong>"{createdTeamName}"</strong> sudah aktif. Bagikan kode ini ke rekan kerja untuk bergabung.
              </p>
              
              {/* Kode Join Box */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl mb-4 border-2 border-blue-300 relative">
                <p className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide">Kode Join Kantor</p>
                <div className="text-3xl font-mono font-bold tracking-widest text-blue-600 mb-3">
                  {generatedCode}
                </div>
                
                <Button
                  onClick={copyToClipboard}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Salin Kode
                </Button>
              </div>

              {/* Instruksi */}
              <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200 mb-4 text-left">
                <p className="text-xs text-gray-700 leading-relaxed">
                  <strong>📋 Cara Share:</strong>
                  <br />
                  1. Salin kode di atas<br />
                  2. Kirim ke grup WA/Telegram kantor<br />
                  3. Rekan kerja buka app → Community → Gabung Kantor → Paste kode
                </p>
              </div>

              <Button
                onClick={handleClose}
                variant="outline"
                className="w-full border-2 border-black hover:bg-gray-50"
              >
                Tutup & Masuk ke Kantor
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default TeamCreateModal;
