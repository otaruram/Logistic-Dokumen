import React, { useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { APP_CONFIG } from "@/constants";
import { fmtRp } from "@/lib/formatters";
import { LoanRequest } from "./types";
import { toast } from "sonner";

interface ReviseLoanModalProps {
  loan: LoanRequest;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReviseLoanModal({ loan, onClose, onSuccess }: ReviseLoanModalProps) {
  const [revisionNotes, setRevisionNotes] = useState("");
  const [revisioning, setRevisioning] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);

  const handleRevision = async () => {
    setRevisioning(true);
    setRevisionError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Login diperlukan.");
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/kasbon/need-revision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ loan_id: loan.id, notes: revisionNotes || "Harap perbaiki dokumen." }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      toast.success("Catatan revisi berhasil dikirim.");
      onSuccess();
    } catch (e: unknown) {
      setRevisionError(e instanceof Error ? e.message : "Gagal mengirim notif revisi.");
    } finally {
      setRevisioning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border-2 border-amber-100 bg-white shadow-2xl overflow-hidden">
        <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-900">Minta Revisi</h3>
              <p className="text-sm text-amber-600/80 mt-0.5 font-medium">
                {loan.nama_lengkap} – {fmtRp(loan.nominal_pengajuan)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-amber-400 hover:bg-amber-100 hover:text-amber-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="p-6">
          <label className="block text-sm text-zinc-700 font-semibold mb-2">
            Catatan Revisi untuk Peminjam <span className="text-red-500">*</span>
          </label>
          <textarea
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
            rows={3}
            placeholder="Berikan instruksi yang jelas. Contoh: Foto KTP terpotong, harap upload ulang dengan pencahayaan terang."
            className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-50 focus:border-amber-400 resize-none transition-all"
          />
          {revisionError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{revisionError}</p>
            </div>
          )}
          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors">
              Batal
            </button>
            <button onClick={handleRevision} disabled={revisioning || !revisionNotes.trim()} className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-bold text-white shadow-lg shadow-amber-200 hover:bg-amber-600 hover:shadow-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {revisioning ? "Mengirim Notif..." : "Kirim Catatan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
