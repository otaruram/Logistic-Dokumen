import React, { useState } from 'react';
import { Copy, ExternalLink, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export interface Transaction {
  id: string;
  date: string;
  workerName: string;
  phone: string;
  nominal: number;
  status: string;
  fileUrl: string;
  hash: string;
}

interface TransactionTableProps {
  transactions: Transaction[];
  loading?: boolean;
}

const ITEMS_PER_PAGE = 10;

const TransactionTable: React.FC<TransactionTableProps> = ({ transactions, loading = false }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(transactions.length / ITEMS_PER_PAGE));

  const paginatedData = transactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(nominal);
  };

  const formatTanggal = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Hash tersalin ke clipboard!');
    } catch (err) {
      toast.error('Gagal menyalin hash');
    }
  };

  const truncateHash = (hash: string) => {
    if (!hash || hash.length < 16) return hash || "—";
    // Detect mojibake / non-hex placeholders (â€", —, etc.)
    if (!/^[0-9a-fA-F]+$/.test(hash.replace(/\.\.\./g, ""))) return "Menunggu verifikasi...";
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      case 'REVISION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            Revision
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
            Pending
          </span>
        );
    }
  };

  return (
    <div className="w-full font-sans">
      <div className="w-full space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Master Data / Jejak Audit</h1>
            <p className="text-sm text-zinc-600 mt-1">OtaruChain immutable transaction logs.</p>
          </div>
        </div>

        {/* Table Container */}
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
                <tr>
                  <th className="px-6 py-4 font-semibold tracking-wider">Tanggal & Waktu</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Nama Pengaju</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Nominal Dokumen</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                  <th className="px-6 py-4 font-semibold tracking-wider text-center">Nota / File</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Kriptografi SHA-256</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                      Memuat data transaksi...
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                      Belum ada transaksi untuk client ini.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((trx) => (
                  <tr key={trx.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-zinc-800 font-medium">{formatTanggal(trx.date)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-zinc-900 font-bold">{trx.workerName}</span>
                        <span className="text-xs text-zinc-500 font-mono mt-0.5">{trx.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-zinc-900 font-bold">{formatRupiah(trx.nominal)}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(trx.status)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {trx.fileUrl && trx.fileUrl.startsWith("http") ? (
                      <a
                        href={trx.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-all group"
                        title="Lihat Document"
                      >
                        <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      </a>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-zinc-700 bg-zinc-100 px-2.5 py-1.5 rounded-lg border border-zinc-200 font-semibold">
                          {truncateHash(trx.hash)}
                        </code>
                        <button
                          onClick={() => copyToClipboard(trx.hash)}
                          className="p-1.5 rounded-md hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors"
                          title="Copy full hash"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50">
            <span className="text-sm text-zinc-600 font-medium">
              Page <span className="text-zinc-900 font-bold">{currentPage}</span> of <span className="text-zinc-900 font-bold">{totalPages}</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-white hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-200 text-zinc-700 transition-all shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-white hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-200 text-zinc-700 transition-all shadow-sm"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionTable;
