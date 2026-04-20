import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { FileDown, Cloud, Search, Trash2, CheckCircle2, XCircle, Clock, Pencil, ShieldAlert, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { appCache, cacheKeys } from "@/lib/cacheService";
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

interface ScanHistoryProps {
    records: ScanRecord[];
    onDelete: (id: number | string) => void;
    onEdit: (record: ScanRecord) => void;
    onExportGoogleDrive: () => void;
}

export const ScanHistory = ({ records, onDelete, onEdit, onExportGoogleDrive }: ScanHistoryProps) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDate, setFilterDate] = useState("all");
    const [filterMonth, setFilterMonth] = useState("all");
    const [filterYear, setFilterYear] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [analyzingId, setAnalyzingId] = useState<number | string | null>(null);
    const [insightData, setInsightData] = useState<{ id: number | string; text: string } | null>(null);
    const ITEMS_PER_PAGE = 10;

    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

    const handleAnalyze = async (record: ScanRecord) => {
        setAnalyzingId(record.id);
        setInsightData(null);
        try {
            const { data: { session } } = await (await import("@/lib/supabaseClient")).supabase.auth.getSession();
            if (!session) return;

            const cacheKey = cacheKeys.dgtnzAnalysis(session.user.id, String(record.id));
            
            // Check cache first
            const cachedInsight = appCache.get<{ analysis: string }>(cacheKey, {
                scan_type: "dgtnz",
                extracted_text: record.keterangan,
                status: record.status,
            });
            
            if (cachedInsight) {
                setInsightData({ id: record.id, text: cachedInsight.analysis || "Analisis tidak tersedia." });
                setAnalyzingId(null);
                return;
            }

            const res = await fetch(`${API_URL}/api/insight/analyze`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    scan_type: "dgtnz",
                    extracted_text: record.keterangan || "",
                    confidence: record.fraudFields?.confidence || "medium",
                    status: record.status,
                    nominal_total: record.fraudFields?.nominal_total || 0,
                    nama_klien: record.fraudFields?.nama_klien || null,
                    nomor_surat_jalan: record.fraudFields?.nomor_surat_jalan || null,
                    tanggal_jatuh_tempo: record.fraudFields?.tanggal_jatuh_tempo || null,
                    recipient_name: record.namaPenerima || null,
                }),
            });
            const json = await res.json();
            
            // Cache the result
            appCache.set(cacheKey, { analysis: json.analysis });
            
            setInsightData({ id: record.id, text: json.analysis || "Analisis tidak tersedia." });
        } catch {
            setInsightData({ id: record.id, text: "❌ Gagal menganalisis. Coba lagi nanti." });
        } finally {
            setAnalyzingId(null);
        }
    };

    // Reset to page 1 when records change
    useEffect(() => { setCurrentPage(1); }, [records.length]);

    const filteredRecords = records.filter(record => {
        const matchesSearch = record.namaPenerima.toLowerCase().includes(searchTerm.toLowerCase()) ||
            record.keterangan.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        // Parse DD/MM/YYYY
        const parts = record.tanggal.split('/');
        if (parts.length === 3) {
            const [d, m, y] = parts;
            // Compare as integers to handle "01" vs "1"
            if (filterDate !== "all" && parseInt(d) !== parseInt(filterDate)) return false;
            if (filterMonth !== "all" && parseInt(m) !== parseInt(filterMonth)) return false;
            if (filterYear !== "all" && y !== filterYear) return false;
        }
        return true;
    });

    // Pagination
    const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
    const paginatedRecords = filteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleExportExcel = () => {
        if (filteredRecords.length === 0) return;

        const exportData = filteredRecords.map((r, i) => ({
            No: i + 1,
            Date: r.tanggal,
            Recipient: r.namaPenerima,
            Details: r.keterangan,
            ImageLink: r.fotoUrl,
            SignatureLink: r.tandaTangan,
            Status: r.status.toUpperCase()
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Scans");
        XLSX.writeFile(wb, `scans-${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success("Excel exported successfully");
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'verified':
            case 'approved':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.2)]"><CheckCircle2 className="w-3 h-3" /> VERIFIED</span>;
            case 'tampered':
            case 'rejected':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]"><XCircle className="w-3 h-3" /> TAMPERED</span>;
            case 'processing':
            case 'pending':
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"><Clock className="w-3 h-3 animate-pulse" /> PROCESSING</span>;
        }
    };

    return (
        <Card className="border-white/10 bg-[#0a0a0a] text-white">
            <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between gap-4">
                <div>
                    <h3 className="font-semibold text-lg">Scan History</h3>
                    <p className="text-sm text-gray-500">Track and manage your digitized documents</p>
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

            <div className="p-4 border-b border-white/10 bg-white/[0.02] flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                        placeholder="Search recipient or content..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-[#111] border-white/10 text-white placeholder:text-gray-600 focus:border-white/30 h-10"
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

            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-white/[0.02]">
                        <TableRow className="border-white/10 hover:bg-white/5">
                            <TableHead className="w-[50px] text-gray-400">No</TableHead>
                            <TableHead className="text-gray-400">Date</TableHead>
                            <TableHead className="text-gray-400">Recipient</TableHead>
                            <TableHead className="text-gray-400 w-[100px]">Photo</TableHead>
                            <TableHead className="text-gray-400 w-[100px]">Signature</TableHead>
                            <TableHead className="text-gray-400 w-[30%]">Content</TableHead>
                            <TableHead className="text-gray-400">Status</TableHead>
                            <TableHead className="text-right text-gray-400">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedRecords.length > 0 ? (
                            paginatedRecords.map((record, idx) => (
                                <React.Fragment key={record.id}>
                                    <TableRow className="border-white/5 hover:bg-white/[0.02]">
                                        <TableCell className="text-gray-500">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</TableCell>
                                        <TableCell className="font-mono text-sm text-gray-400">{record.tanggal}</TableCell>
                                        <TableCell className="font-medium text-white">
                                            <div className="flex items-center gap-2">
                                                {record.namaPenerima}
                                                {record.isFraudScan && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-bold flex-shrink-0">
                                                        <ShieldAlert className="w-2.5 h-2.5" />FRAUD
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {record.fotoUrl ? (
                                                <a href={record.fotoUrl} target="_blank" rel="noreferrer" className="block w-12 h-12 rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-all">
                                                    <img src={record.fotoUrl} alt="Scan" className="w-full h-full object-cover" />
                                                </a>
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-xs text-gray-600">No Img</div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {record.tandaTangan ? (
                                                <a href={record.tandaTangan} target="_blank" rel="noreferrer" className="block w-12 h-12 rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-all bg-white">
                                                    <img src={record.tandaTangan} alt="Sig" className="w-full h-full object-contain p-1" />
                                                </a>
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-xs text-gray-600">No Sig</div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-gray-400 text-sm max-w-xs" title={record.keterangan}>
                                            <div className="space-y-1">
                                                <p className="truncate">{record.keterangan}</p>
                                                {record.isFraudScan && record.fraudFields && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {record.fraudFields.nominal_total && (
                                                            <span className="text-[10px] bg-white/5 text-gray-300 px-1.5 py-0.5 rounded">
                                                                Rp {record.fraudFields.nominal_total.toLocaleString('id-ID')}
                                                            </span>
                                                        )}
                                                        {record.fraudFields.nama_klien && (
                                                            <span className="text-[10px] bg-white/5 text-gray-300 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                                                                {record.fraudFields.nama_klien}
                                                            </span>
                                                        )}
                                                        {record.fraudFields.confidence && (
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${record.fraudFields.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                                                                record.fraudFields.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                    'bg-gray-500/20 text-gray-400'
                                                                }`}>
                                                                {record.fraudFields.confidence}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleAnalyze(record)} disabled={analyzingId === record.id} className="p-2 hover:bg-purple-500/20 rounded-full transition-colors" title="Analyze with Otaru">
                                                    {analyzingId === record.id ? <Loader2 className="w-4 h-4 text-purple-400 animate-spin" /> : <Sparkles className="w-4 h-4 text-purple-400" />}
                                                </button>
                                                {!record.isFraudScan && (
                                                    <button onClick={() => onEdit(record)} className="p-2 hover:bg-yellow-500/20 rounded-full transition-colors" title="Edit">
                                                        <Pencil className="w-4 h-4 text-yellow-500" />
                                                    </button>
                                                )}
                                                <button onClick={() => onDelete(record.id)} className="p-2 hover:bg-red-900/20 rounded-full transition-colors" title="Delete">
                                                    <Trash2 className="w-4 h-4 text-red-400" />
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    {insightData?.id === record.id && (
                                        <TableRow>
                                            <TableCell colSpan={8} className="p-0">
                                                <div className="mx-4 my-2 p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Sparkles className="w-4 h-4 text-purple-400" />
                                                        <span className="text-sm font-bold text-purple-300">Otaru AI Insight</span>
                                                        <button onClick={() => setInsightData(null)} className="ml-auto text-xs text-gray-500 hover:text-white">✕</button>
                                                    </div>
                                                    <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                                                        {insightData.text}
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={8} className="h-32 text-center text-gray-500">
                                    No records found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {
                totalPages > 1 && (
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
                )
            }
        </Card >
    );
};
