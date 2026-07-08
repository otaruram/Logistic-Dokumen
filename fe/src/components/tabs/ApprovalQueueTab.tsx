import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, ClipboardList, RefreshCw, Bell } from "lucide-react";
import { APP_CONFIG } from "@/constants";
import { supabase } from "@/lib/supabaseClient";

import { LoanRequest } from "../approval-queue/types";
import QueueItemCard from "../approval-queue/QueueItemCard";
import ApproveLoanModal from "../approval-queue/ApproveLoanModal";
import RejectLoanModal from "../approval-queue/RejectLoanModal";
import ReviseLoanModal from "../approval-queue/ReviseLoanModal";
import AdminAccessManager from "../approval-queue/AdminAccessManager";

export default function ApprovalQueueTab() {
  const [queue, setQueue] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Admin access
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showAdminRequests, setShowAdminRequests] = useState(false);
  const [adminRequestCount, setAdminRequestCount] = useState(0);
  const [showQueueTooltip, setShowQueueTooltip] = useState(false);
  
  // Modals state
  const [modalLoan, setModalLoan] = useState<LoanRequest | null>(null);
  const [rejectLoan, setRejectLoan] = useState<LoanRequest | null>(null);
  const [revisionLoan, setRevisionLoan] = useState<LoanRequest | null>(null);
  
  const [authToken, setAuthToken] = useState<string>("");

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("Login diperlukan.");
        return;
      }
      setUserEmail(session.user.email ?? null);
      setAuthToken(token);
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/kasbon/queue`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setQueue(data.queue ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat antrian.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  return (
    <div className="w-full">
      {/* Header section */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-zinc-600" />
            Antrean Pengajuan <span className="text-zinc-400 font-normal">({queue.length})</span>
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Data terenkripsi dan diverifikasi oleh Otaru Chain.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Admin Management Button & Tooltip */}
          <div className="relative">
            <button
              onClick={() => {
                setShowQueueTooltip(!showQueueTooltip);
                setTimeout(() => setShowQueueTooltip(false), 5000);
              }}
              className="relative p-2 bg-zinc-100 hover:bg-zinc-200 rounded-full transition-colors"
              title="Notifikasi & Akses Admin"
            >
              <Bell className="w-5 h-5 text-zinc-600" />
              <span className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${adminRequestCount > 0 ? "bg-red-500" : "bg-amber-500"}`} />
            </button>
            {showQueueTooltip && (
              <div className="absolute -right-2 sm:right-0 top-full mt-2 w-[280px] sm:w-64 max-w-[90vw] rounded-xl bg-white border border-zinc-200 shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full mt-0.5 ${adminRequestCount > 0 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 mb-1">Queue Security</h4>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      Antrean ini bersifat tertutup. Hanya admin Koperasi yang ter-whitelist yang dapat melihatnya.
                    </p>
                    <button 
                      onClick={() => { setShowQueueTooltip(false); setShowAdminRequests(true); }}
                      className="mt-3 w-full rounded-lg bg-black text-white px-3 py-2 text-xs font-semibold hover:bg-zinc-800 transition-colors"
                    >
                      Kelola Akses Admin {adminRequestCount > 0 && `(${adminRequestCount} Baru)`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={fetchQueue}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-zinc-400" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-red-50 p-4 border border-red-100">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Queue List */}
      {!loading && queue.length === 0 && !error && (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 mb-4">
            <ClipboardList className="h-8 w-8 text-zinc-400" />
          </div>
          <h3 className="text-zinc-900 font-semibold mb-1">Antrean Kosong</h3>
          <p className="text-sm text-zinc-500">Tidak ada pengajuan kasbon yang menunggu persetujuan.</p>
        </div>
      )}

      {!loading && queue.length > 0 && (
        <div className="space-y-3">
          {queue.map((loan) => (
            <QueueItemCard
              key={loan.id}
              loan={loan}
              isExpanded={expandedId === loan.id}
              onToggleExpand={() => setExpandedId(expandedId === loan.id ? null : loan.id)}
              onApprove={() => setModalLoan(loan)}
              onReject={() => setRejectLoan(loan)}
              onRevise={() => setRevisionLoan(loan)}
            />
          ))}
        </div>
      )}

      {/* Admin Access Manager */}
      <AdminAccessManager
        showModal={showAdminRequests}
        onClose={() => setShowAdminRequests(false)}
        userEmail={userEmail}
        onRequestsUpdated={(reqs) => setAdminRequestCount(reqs.length)}
      />

      {/* Modals */}
      {modalLoan && (
        <ApproveLoanModal
          modalLoan={modalLoan}
          authToken={authToken}
          onClose={() => setModalLoan(null)}
          onSuccess={() => {
            setModalLoan(null);
            fetchQueue();
          }}
        />
      )}

      {rejectLoan && (
        <RejectLoanModal
          loan={rejectLoan}
          onClose={() => setRejectLoan(null)}
          onSuccess={() => {
            setRejectLoan(null);
            fetchQueue();
          }}
        />
      )}

      {revisionLoan && (
        <ReviseLoanModal
          loan={revisionLoan}
          onClose={() => setRevisionLoan(null)}
          onSuccess={() => {
            setRevisionLoan(null);
            fetchQueue();
          }}
        />
      )}
    </div>
  );
}
