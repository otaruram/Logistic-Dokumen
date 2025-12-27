import { useState } from "react";
import * as XLSX from "xlsx";
import { FileDown, Cloud, Search, Trash2, CheckCircle2, XCircle, Clock, Pencil } from "lucide-react";
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

interface ScanRecord {
    id: number;
    no: number;
    tanggal: string;
    namaPenerima: string;
    keterangan: string;
    fotoUrl: string;
    tandaTangan: string;
    status: "pending" | "approved" | "rejected";
}

interface ScanHistoryProps {
    records: ScanRecord[];
    onDelete: (id: number) => void;
    onEdit: (record: ScanRecord) => void;
    onExportGoogleDrive: () => void;
}

export const ScanHistory = ({ records, onDelete, onEdit, onExportGoogleDrive }: ScanHistoryProps) => {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredRecords = records.filter(record =>
        record.namaPenerima.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.keterangan.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
            case 'approved':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
            case 'rejected':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500"><XCircle className="w-3 h-3" /> Rejected</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500"><Clock className="w-3 h-3" /> Pending</span>;
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

            <div className="p-4 border-b border-white/10 bg-white/[0.02]">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                        placeholder="Search recipient or content..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-[#111] border-white/10 text-white placeholder:text-gray-600 focus:border-white/30 h-9 text-sm"
                    />
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
                        {filteredRecords.length > 0 ? (
                            filteredRecords.map((record, idx) => (
                                <TableRow key={record.id} className="border-white/5 hover:bg-white/[0.02]">
                                    <TableCell className="text-gray-500">{idx + 1}</TableCell>
                                    <TableCell className="font-mono text-sm text-gray-400">{record.tanggal}</TableCell>
                                    <TableCell className="font-medium text-white">{record.namaPenerima}</TableCell>
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
                                    <TableCell className="text-gray-400 text-sm max-w-xs truncate" title={record.keterangan}>
                                        {record.keterangan}
                                    </TableCell>
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
                                <TableCell colSpan={8} className="h-32 text-center text-gray-500">
                                    No records found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
};
