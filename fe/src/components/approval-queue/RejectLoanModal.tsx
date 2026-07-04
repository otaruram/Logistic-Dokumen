import React, { useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { APP_CONFIG } from "@/constants";
import { fmtRp } from "@/lib/formatters";
import { LoanRequest } from "./types";
import { toast } from "sonner";

interface RejectLoanModalProps {
  loan: LoanRequest;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RejectLoanModal({ loan, onClose, onSuccess }: RejectLoanModalProps) {
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const handleReject = async () => {
    setRejecting(true);
    setRejectError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Login diperlukan.");
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/kasbon/reject-loan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ loan_id: loan.id, reason: rejectReason || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      toast.success("Pengajuan berhasil ditolak.");
      onSuccess();
    } catch (e: unknown) {
      setRejectError(e instanceof Error ? e.message : "Gagal menolak pengajuan.");
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border-2 border-red-100 bg-white shadow-2xl overflow-hidden">
        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <X className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-900">Tolak Pengajuan</h3>
              <p className="text-sm text-red-600/80 mt-0.5 font-medium">
                {loan.nama_lengkap} – {fmtRp(loan.nominal_pengajuan)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="p-6">
          <label className="block text-sm text-zinc-700 font-semibold mb-2">
            Alasan Penolakan <span className="text-zinc-400 font-normal">(Opsional)</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Contoh: Nominal pengajuan melebihi sisa plafon, atau dokumen terindikasi fraud."
            className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-50 focus:border-red-300 resize-none transition-all"
          />
          {rejectError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{rejectError}</p>
            </div>
          )}
          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors">
              Batal
            </button>
            <button onClick={handleReject} disabled={rejecting} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white shadow-lg shadow-red-200 hover:bg-red-700 hover:shadow-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {rejecting ? "Memproses..." : "Konfirmasi Tolak"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
