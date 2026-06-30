import React, { useState } from 'react';
import { Copy, ExternalLink, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Mock Data
const MOCK_TRANSACTIONS = [
  {
    id: 'TRX-101',
    date: '2026-07-01T08:30:00',
    workerName: 'Budi Santoso',
    phone: '+62 812-3456-7890',
    nominal: 500000,
    status: 'APPROVED',
    fileUrl: 'https://ik.imagekit.io/demo/tr:w-300/sample_receipt.jpg',
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  },
  {
    id: 'TRX-102',
    date: '2026-07-01T09:15:22',
    workerName: 'Siti Aminah',
    phone: '+62 813-9876-5432',
    nominal: 750000,
    status: 'REVISION',
    fileUrl: 'https://ik.imagekit.io/demo/tr:w-300/sample_receipt2.jpg',
    hash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
  },
  {
    id: 'TRX-103',
    date: '2026-07-01T10:05:10',
    workerName: 'Agus Pratama',
    phone: '+62 819-1122-3344',
    nominal: 1200000,
    status: 'REJECTED',
    fileUrl: 'https://ik.imagekit.io/demo/tr:w-300/sample_receipt3.jpg',
    hash: '4a0a19218e082a343a1b17e5333409af9d98f0f5b4d45d9475148006b52865b4'
  },
  // Add more items to demonstrate pagination
];

// Generate extra mock data to reach more than 10 rows
for (let i = 4; i <= 25; i++) {
  MOCK_TRANSACTIONS.push({
    id: `TRX-10${i}`,
    date: new Date(new Date('2026-07-01T10:05:10').getTime() + i * 15 * 60000).toISOString(),
    workerName: `Worker ${i}`,
    phone: `+62 851-0000-00${i.toString().padStart(2, '0')}`,
    nominal: Math.floor(Math.random() * 10 + 1) * 100000,
    status: i % 3 === 0 ? 'REJECTED' : i % 5 === 0 ? 'REVISION' : 'APPROVED',
    fileUrl: 'https://ik.imagekit.io/demo/tr:w-300/sample_receipt.jpg',
    hash: Array(64).fill(0).map(() => Math.random().toString(16)[2]).join('').padEnd(64, '0')
  });
}

const ITEMS_PER_PAGE = 10;

const TransactionTable: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(MOCK_TRANSACTIONS.length / ITEMS_PER_PAGE);

  const paginatedData = MOCK_TRANSACTIONS.slice(
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

  const formatDate = (isoString: string) => {
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
    if (!hash || hash.length < 16) return hash;
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
    <div className="w-full bg-[#0a0a0a] min-h-screen p-6 text-zinc-100 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Master Data / Audit Trail</h1>
            <p className="text-sm text-zinc-400 mt-1">Supa Ledger immutable transaction logs.</p>
          </div>
        </div>

        {/* Table Container with Glassmorphism */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white/[0.04] border-b border-white/10 text-zinc-400">
                <tr>
                  <th className="px-6 py-4 font-semibold tracking-wider">Tanggal & Waktu</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Nama Pengaju</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Nominal Kasbon</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                  <th className="px-6 py-4 font-semibold tracking-wider text-center">Nota / File</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Kriptografi SHA-256</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedData.map((trx) => (
                  <tr key={trx.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-zinc-300 font-medium">{formatDate(trx.date)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-zinc-200 font-semibold">{trx.workerName}</span>
                        <span className="text-xs text-zinc-500 font-mono mt-0.5">{trx.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-zinc-200 font-semibold">{formatRupiah(trx.nominal)}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(trx.status)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <a
                        href={trx.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition-all group"
                        title="View Document"
                      >
                        <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-zinc-400 bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
                          {truncateHash(trx.hash)}
                        </code>
                        <button
                          onClick={() => copyToClipboard(trx.hash)}
                          className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors"
                          title="Copy full hash"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.01]">
            <span className="text-sm text-zinc-400 font-medium">
              Page <span className="text-white">{currentPage}</span> of <span className="text-white">{totalPages}</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 text-zinc-300 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 text-zinc-300 transition-all"
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
