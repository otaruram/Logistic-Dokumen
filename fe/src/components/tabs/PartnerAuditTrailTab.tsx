import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { APP_CONFIG } from "@/constants";
import TransactionTable, { Transaction } from "../TransactionTable";

const API_URL = APP_CONFIG.apiUrl;

export default function PartnerAuditTrailTab() {
  const [auditTrail, setAuditTrail] = useState<Transaction[]>([]);
  const [auditTrailLoading, setAuditTrailLoading] = useState(true);

  const fetchAuditTrail = useCallback(async () => {
    setAuditTrailLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAuditTrail([]);
        return;
      }
      const res = await fetch(`${API_URL}/api/kasbon/audit-trail`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setAuditTrail([]);
        return;
      }
      const data = await res.json();
      setAuditTrail(data?.transactions || []);
    } catch {
      setAuditTrail([]);
    } finally {
      setAuditTrailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditTrail();
  }, [fetchAuditTrail]);

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Audit Trail</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">Master Data Transaksi</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          Riwayat lengkap pengajuan kasbon (Approved, Rejected, Revision) beserta bukti kriptografi SHA-256.
        </p>
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <TransactionTable transactions={auditTrail} loading={auditTrailLoading} />
      </div>
    </section>
  );
}
