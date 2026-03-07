import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { FileDown, Cloud, Search, Trash2, CheckCircle2, XCircle, Clock, Pencil, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface ScanRecord {
    id: number | string;
    no: number;
    tanggal: string;
    namaPenerima: string;
    keterangan: string;
    fotoUrl: string;
    tandaTangan: string;
    status: "processing" | "verified" | "tampered" | "pending" | "approved" | "rejected";
    isFraudScan?: boolean;
    fraudFields?: {
        nominal_total?: number | null;
        nama_klien?: string | null;
        nomor_surat_jalan?: string | null;
        tanggal_jatuh_tempo?: string | null;
        confidence?: string;
    } | null;
}

interface FraudScanHistoryProps {
    records: ScanRecord[];
    onDelete: (id: number | string) => void;
    onEdit: (record: ScanRecord) => void;
    onExportGoogleDrive: () => void;
}

export const FraudScanHistory = ({ records, onDelete, onEdit, onExportGoogleDrive }: FraudScanHistoryProps) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDate, setFilterDate] = useState("all");
    const [filterMonth, setFilterMonth] = useState("all");
    const [filterYear, setFilterYear] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Reset to page 1 when records change
    useEffect(() => { setCurrentPage(1); }, [records.length]);

    const filteredRecords = records.filter(record => {
        const matchesSearch = record.namaPenerima.toLowerCase().includes(searchTerm.toLowerCase()) ||
            record.keterangan.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (record.fraudFields?.nama_klien || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (record.fraudFields?.nomor_surat_jalan || "").toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        // Parse DD/MM/YYYY
        const parts = record.tanggal.split('/');
        if (parts.length === 3) {
            const [d, m, y] = parts;
            if (filterDate !== "all" && parseInt(d) !== parseInt(filterDate)) return false;
            if (filterMonth !== "all" && parseInt(m) !== parseInt(filterMonth)) return false;
            if (filterYear !== "all" && y !== filterYear) return false;
        }

        // Status filter
        if (filterStatus !== "all") {
            const normalizedStatus = getNormalizedStatus(record.status);
            if (normalizedStatus !== filterStatus) return false;
        }

        return true;
    });

    const getNormalizedStatus = (status: string): string => {
        switch (status) {
            case 'verified':
            case 'approved':
                return 'verified';
            case 'tampered':
            case 'rejected':
                return 'tampered';
            case 'processing':
            case 'pending':
            default:
                return 'processing';
        }
    };

    // Pagination
    const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
    const paginatedRecords = filteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // Count by status
    const statusCounts = {
        verified: records.filter(r => getNormalizedStatus(r.status) === 'verified').length,
        processing: records.filter(r => getNormalizedStatus(r.status) === 'processing').length,
        tampered: records.filter(r => getNormalizedStatus(r.status) === 'tampered').length,
    };

    const handleExportExcel = () => {
        if (filteredRecords.length === 0) return;

        const exportData = filteredRecords.map((r, i) => ({
            No: i + 1,
            Date: r.tanggal,
            Recipient: r.namaPenerima,
            Client: r.fraudFields?.nama_klien || "-",
            "Surat Jalan": r.fraudFields?.nomor_surat_jalan || "-",
            "Nominal Total": r.fraudFields?.nominal_total || "-",
            "Jatuh Tempo": r.fraudFields?.tanggal_jatuh_tempo || "-",
            Confidence: r.fraudFields?.confidence || "-",
            Details: r.keterangan,
            ImageLink: r.fotoUrl,
            SignatureLink: r.tandaTangan,
            Status: getNormalizedStatus(r.status).toUpperCase()
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Fraud Scans");
        XLSX.writeFile(wb, `fraud-scans-${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success("Excel exported successfully");
    };

    const getStatusBadge = (status: string) => {
        const normalized = getNormalizedStatus(status);
        switch (normalized) {
            case 'verified':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                        <CheckCircle2 className="w-3 h-3" /> VERIFIED
                    </span>
                );
            case 'tampered':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                        <XCircle className="w-3 h-3" /> TAMPERED
                    </span>
                );
            case 'processing':
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                        <Clock className="w-3 h-3 animate-pulse" /> PROCESSING
                    </span>
                );
        }
    };

    const getConfidenceBadge = (confidence?: string) => {
        if (!confidence) return <span className="text-gray-600 text-xs">-</span>;
        switch (confidence) {
            case 'high':
                return <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-green-500/20 text-green-400 border border-green-500/30">HIGH</span>;
            case 'medium':
                return <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">MEDIUM</span>;
            default:
                return <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30">LOW</span>;
        }
    };

    return (
        <Card className="border-red-500/20 bg-[#0a0a0a] text-white">
            {/* Header */}
            <div className="p-6 border-b border-white/10">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                            <ShieldAlert className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Fraud Detection History</h3>
                            <p className="text-sm text-gray-500">AI-powered fraud analysis results</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!records.length} className="border-white/10 hover:bg-white/5 text-gray-300">
                            <FileDown className="w-4 h-4 mr-2" /> Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={onExportGoogleDrive} disabled={!records.length} className="border-white/10 hover:bg-white/5 text-gray-300">
                            <Cloud className="w-4 h-4 mr-2" /> Drive
                        </Button>
                    </div>
                </div>

                {/* Status Indicator Cards */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                    <button
                        onClick={() => setFilterStatus(filterStatus === 'verified' ? 'all' : 'verified')}
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${filterStatus === 'verified'
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-white/[0.02] border-white/10 hover:border-green-500/30'
                            }`}
                    >
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <div className="text-left">
                            <p className="text-lg font-bold text-green-400">{statusCounts.verified}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Verified</p>
                        </div>
                    </button>
                    <button
                        onClick={() => setFilterStatus(filterStatus === 'processing' ? 'all' : 'processing')}
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${filterStatus === 'processing'
                            ? 'bg-yellow-500/10 border-yellow-500/30'
                            : 'bg-white/[0.02] border-white/10 hover:border-yellow-500/30'
                            }`}
                    >
                        <Clock className="w-4 h-4 text-yellow-400" />
                        <div className="text-left">
                            <p className="text-lg font-bold text-yellow-400">{statusCounts.processing}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Processing</p>
                        </div>
                    </button>
                    <button
                        onClick={() => setFilterStatus(filterStatus === 'tampered' ? 'all' : 'tampered')}
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${filterStatus === 'tampered'
                            ? 'bg-red-500/10 border-red-500/30'
                            : 'bg-white/[0.02] border-white/10 hover:border-red-500/30'
                            }`}
                    >
                        <XCircle className="w-4 h-4 text-red-400" />
                        <div className="text-left">
                            <p className="text-lg font-bold text-red-400">{statusCounts.tampered}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tampered</p>
                        </div>
                    </button>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="p-4 border-b border-white/10 bg-white/[0.02] flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                        placeholder="Search recipient, client, or surat jalan..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-[#111] border-white/10 text-white placeholder:text-gray-600 focus:border-red-500/30 h-10"
                    />
                </div>

                <div className="flex gap-2">
                    {/* Date 1-31 */}
                    <Select value={filterDate} onValueChange={setFilterDate}>
                        <SelectTrigger className="w-[70px] bg-[#111] border-white/10 text-white h-10">
                            <SelectValue placeholder="Tgl" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#111] border-white/10 text-white">
                            <SelectItem value="all">All</SelectItem>
                            {Array.from({ length: 31 }, (_, i) => (
                                <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Month Jan-Dec */}
                    <Select value={filterMonth} onValueChange={setFilterMonth}>
                        <SelectTrigger className="w-[100px] bg-[#111] border-white/10 text-white h-10">
                            <SelectValue placeholder="Bulan" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#111] border-white/10 text-white">
                            <SelectItem value="all">All</SelectItem>
                            {["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"].map((m, i) => (
                                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Year 2025-2040 */}
                    <Select value={filterYear} onValueChange={setFilterYear}>
                        <SelectTrigger className="w-[90px] bg-[#111] border-white/10 text-white h-10">
                            <SelectValue placeholder="Thn" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#111] border-white/10 text-white">
                            <SelectItem value="all">All</SelectItem>
                            {Array.from({ length: 16 }, (_, i) => (
                                <SelectItem key={i} value={String(2025 + i)}>{2025 + i}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-white/[0.02]">
                        <TableRow className="border-white/10 hover:bg-white/5">
                            <TableHead className="w-[50px] text-gray-400">No</TableHead>
                            <TableHead className="text-gray-400">Date</TableHead>
                            <TableHead className="text-gray-400">Recipient</TableHead>
                            <TableHead className="text-gray-400 w-[100px]">Photo</TableHead>
                            <TableHead className="text-gray-400 w-[100px]">Signature</TableHead>
                            <TableHead className="text-gray-400">Fraud Analysis</TableHead>
                            <TableHead className="text-gray-400">Confidence</TableHead>
                            <TableHead className="text-gray-400">Status</TableHead>
                            <TableHead className="text-right text-gray-400">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedRecords.length > 0 ? (
                            paginatedRecords.map((record, idx) => (
                                <TableRow key={record.id} className="border-white/5 hover:bg-white/[0.02]">
                                    <TableCell className="text-gray-500">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</TableCell>
                                    <TableCell className="font-mono text-sm text-gray-400">{record.tanggal}</TableCell>
                                    <TableCell className="font-medium text-white">
                                        <div className="flex items-center gap-2">
                                            {record.namaPenerima}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {record.fotoUrl ? (
                                            <a href={record.fotoUrl} target="_blank" rel="noreferrer" className="block w-12 h-12 rounded-lg overflow-hidden border border-white/10 hover:border-red-500/30 transition-all">
                                                <img src={record.fotoUrl} alt="Scan" className="w-full h-full object-cover" />
                                            </a>
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-xs text-gray-600">No Img</div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {record.tandaTangan ? (
                                            <a href={record.tandaTangan} target="_blank" rel="noreferrer" className="block w-12 h-12 rounded-lg overflow-hidden border border-white/10 hover:border-red-500/30 transition-all bg-white">
                                                <img src={record.tandaTangan} alt="Sig" className="w-full h-full object-contain p-1" />
                                            </a>
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-xs text-gray-600">No Sig</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm max-w-xs">
                                        <div className="space-y-1.5">
                                            {record.fraudFields ? (
                                                <>
                                                    {record.fraudFields.nominal_total != null && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] text-gray-500 uppercase w-14 flex-shrink-0">Nominal</span>
                                                            <span className="text-xs font-semibold text-white">
                                                                Rp {record.fraudFields.nominal_total.toLocaleString('id-ID')}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {record.fraudFields.nama_klien && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] text-gray-500 uppercase w-14 flex-shrink-0">Klien</span>
                                                            <span className="text-xs text-gray-300 truncate max-w-[150px]">{record.fraudFields.nama_klien}</span>
                                                        </div>
                                                    )}
                                                    {record.fraudFields.nomor_surat_jalan && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] text-gray-500 uppercase w-14 flex-shrink-0">SJ No.</span>
                                                            <span className="text-xs text-gray-300 font-mono">{record.fraudFields.nomor_surat_jalan}</span>
                                                        </div>
                                                    )}
                                                    {record.fraudFields.tanggal_jatuh_tempo && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] text-gray-500 uppercase w-14 flex-shrink-0">Tempo</span>
                                                            <span className="text-xs text-gray-300">{record.fraudFields.tanggal_jatuh_tempo}</span>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <p className="text-gray-500 text-xs truncate">{record.keterangan || "-"}</p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{getConfidenceBadge(record.fraudFields?.confidence ?? undefined)}</TableCell>
                                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => onEdit(record)} className="p-2 hover:bg-yellow-500/20 rounded-full transition-colors" title="Edit">
                                                <Pencil className="w-4 h-4 text-yellow-500" />
                                            </button>
                                            <button onClick={() => onDelete(record.id)} className="p-2 hover:bg-red-900/20 rounded-full transition-colors" title="Delete">
                                                <Trash2 className="w-4 h-4 text-red-400" />
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={9} className="h-32 text-center text-gray-500">
                                    {records.length === 0
                                        ? "No fraud scan records yet. Use Deteksi Fraud mode to analyze documents."
                                        : "No records match the current filters."
                                    }
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="p-4 border-t border-white/10 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                        Halaman {currentPage} dari {totalPages} ({filteredRecords.length} record)
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-2 py-1 text-xs rounded border border-white/10 text-gray-400 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            ←
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                            .map((page, idx, arr) => (
                                <span key={page}>
                                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                                        <span className="text-gray-600 px-1">...</span>
                                    )}
                                    <button
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-7 h-7 text-xs rounded ${currentPage === page
                                            ? 'bg-white text-black font-bold'
                                            : 'border border-white/10 text-gray-400 hover:bg-white/5'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                </span>
                            ))}
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 text-xs rounded border border-white/10 text-gray-400 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            →
                        </button>
                    </div>
                </div>
            )}
        </Card>
    );
};
