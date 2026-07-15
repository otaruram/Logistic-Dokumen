import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { APP_CONFIG } from "@/constants";
import TransactionTable, { Transaction } from "../TransactionTable";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      const res = await fetch(`${API_URL}/api/kasbon/audit-trail?scope=all`, {
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

  const downloadCsv = () => {
    if (!auditTrail || auditTrail.length === 0) return;
    
    const headers = ["ID", "Tanggal", "Nama Pekerja", "No HP", "Nominal", "Status", "Link Foto"];
    
    const csvContent = [
      headers.join(","),
      ...auditTrail.map(tx => [
        tx.id || "",
        `"${tx.date || ""}"`,
        `"${tx.workerName || ""}"`,
        `"${tx.phone || ""}"`,
        tx.nominal || 0,
        tx.status || "",
        `"${tx.fileUrl || ""}"`
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_trail_${new Tanggal().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 flex justify-between items-start">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Jejak Audit</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-900">Master Data Transaksi</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
            Riwayat lengkap pengajuan kasbon (Approved, Rejected, Revision) beserta bukti kriptografi SHA-256.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={downloadCsv} 
          disabled={auditTrailLoading || auditTrail.length === 0}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <TransactionTable transactions={auditTrail} loading={auditTrailLoading} />
      </div>
    </section>
  );
}
