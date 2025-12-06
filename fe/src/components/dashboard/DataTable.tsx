import { useState, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Download, FileSpreadsheet, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import * as XLSX from "xlsx";

export interface LogEntry {
  id: number;
  time: string;
  date: string;
  docType: string;
  docNumber: string;
  receiver: string;
  imageUrl?: string;
  summary: string;
  status: "SUCCESS" | "PENDING" | "ERROR";
}

interface DataTableProps {
  logs: LogEntry[];
  onDeleteLog?: (logId: number) => void;
}

const ITEMS_PER_PAGE = 5;

const DataTable = ({ logs, onDeleteLog }: DataTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [newLogIds, setNewLogIds] = useState<Set<number>>(new Set());
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const prevLogsLength = useRef(logs.length);

  // Detect new log entries
  useEffect(() => {
    if (logs.length > prevLogsLength.current) {
      const newId = logs[0]?.id;
      if (newId) {
        setNewLogIds(prev => new Set(prev).add(newId));
        // Remove glitch class after animation
        setTimeout(() => {
          setNewLogIds(prev => {
            const updated = new Set(prev);
            updated.delete(newId);
            return updated;
          });
        }, 300);
      }
    }
    prevLogsLength.current = logs.length;
  }, [logs]);

  const getStatusStyle = (status: LogEntry["status"]) => {
    switch (status) {
      case "SUCCESS":
        return "bg-success text-background";
      case "PENDING":
        return "bg-warning text-foreground";
      case "ERROR":
        return "bg-destructive text-destructive-foreground";
    }
  };

  // Filter logs based on search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const query = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.docType.toLowerCase().includes(query) ||
        log.docNumber.toLowerCase().includes(query) ||
        log.receiver.toLowerCase().includes(query) ||
        log.summary.toLowerCase().includes(query)
    );
  }, [logs, searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleExportExcel = () => {
    const exportData = logs.map((log, index) => ({
      NO: index + 1,
      TANGGAL: log.date,
      PENERIMA: log.receiver,
      RINGKASAN: log.summary,
      STATUS: log.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Manifest Log");

    const colWidths = [
      { wch: 5 },
      { wch: 12 },
      { wch: 20 },
      { wch: 10 },
      { wch: 50 },
      { wch: 10 },
    ];
    worksheet["!cols"] = colWidths;

    const today = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `manifest_log_${today}.xlsx`);
  };

  const handleExportCSV = () => {
    const headers = ["NO", "TANGGAL", "PENERIMA", "RINGKASAN", "STATUS"];
    const csvData = logs.map((log, index) => [
      index + 1,
      log.date,
      log.receiver,
      log.summary,
      log.status,
    ]);

    const csvContent = [headers, ...csvData]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const today = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `manifest_log_${today}.csv`);
    link.click();
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= maxVisible; i++) pages.push(i);
      } else if (currentPage >= totalPages - 2) {
        for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) pages.push(i);
      } else {
        for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
      }
    }
    return pages;
  };

  return (
    <>
    <div className="brutal-border overflow-hidden">
      <div className="bg-foreground text-background px-3 md:px-4 py-3 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-xs md:text-sm font-bold uppercase tracking-wide">
            LOG MANIFEST HARIAN
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="bg-background text-foreground text-[10px] md:text-xs h-8 px-2 md:px-3"
            >
              <Download className="w-3 h-3 md:w-4 md:h-4" />
              CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportExcel}
              className="text-[10px] md:text-xs h-8 px-2 md:px-3"
            >
              <FileSpreadsheet className="w-3 h-3 md:w-4 md:h-4" />
              EXCEL
            </Button>
          </div>
        </div>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="CARI TIPE DOKUMEN ATAU NOMOR SURAT..."
            className="w-full pl-10 pr-4 py-2 bg-background text-foreground text-xs md:text-sm border-2 border-background focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-foreground text-background">
              <th className="brutal-border-thin border-t-0 px-2 md:px-4 py-2 md:py-3 text-left text-[10px] md:text-xs font-bold uppercase">
                NO
              </th>
              <th className="brutal-border-thin border-t-0 border-l-0 px-2 md:px-4 py-2 md:py-3 text-left text-[10px] md:text-xs font-bold uppercase">
                TANGGAL
              </th>
              <th className="brutal-border-thin border-t-0 border-l-0 px-2 md:px-4 py-2 md:py-3 text-left text-[10px] md:text-xs font-bold uppercase">
                PENERIMA
              </th>
              <th className="brutal-border-thin border-t-0 border-l-0 px-2 md:px-4 py-2 md:py-3 text-left text-[10px] md:text-xs font-bold uppercase">
                FOTO
              </th>
              <th className="brutal-border-thin border-t-0 border-l-0 px-2 md:px-4 py-2 md:py-3 text-left text-[10px] md:text-xs font-bold uppercase">
                RINGKASAN
              </th>
              <th className="brutal-border-thin border-t-0 border-l-0 px-2 md:px-4 py-2 md:py-3 text-left text-[10px] md:text-xs font-bold uppercase">
                STATUS
              </th>
              <th className="brutal-border-thin border-t-0 border-l-0 border-r-0 px-2 md:px-4 py-2 md:py-3 text-center text-[10px] md:text-xs font-bold uppercase">
                AKSI
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-muted-foreground text-xs md:text-sm uppercase"
                >
                  {searchQuery ? "TIDAK ADA HASIL PENCARIAN" : "TIDAK ADA DATA"}
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log, index) => (
                <tr
                  key={log.id}
                  className={cn(
                    "hover:bg-secondary transition-colors",
                    index % 2 === 0 ? "bg-background" : "bg-secondary/30",
                    newLogIds.has(log.id) && "glitch-reveal"
                  )}
                >
                  <td className="brutal-border-thin border-l-0 px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-bold">
                    {startIndex + index + 1}
                  </td>
                  <td className="brutal-border-thin border-l-0 px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-mono">
                    {log.date}
                  </td>
                  <td className="brutal-border-thin border-l-0 px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-bold uppercase">
                    {log.receiver}
                  </td>
                  <td className="brutal-border-thin border-l-0 px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm">
                    {log.imageUrl ? (
                      <button
                        onClick={() => setZoomedImage(log.imageUrl!)}
                        className="brutal-button px-2 py-1 text-[10px] font-bold"
                      >
                        LIHAT
                      </button>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">-</span>
                    )}
                  </td>
                  <td className="brutal-border-thin border-l-0 px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm">
                    {log.summary}
                  </td>
                  <td className="brutal-border-thin border-l-0 border-r-0 px-2 md:px-4 py-2 md:py-3">
                    <span
                      className={cn(
                        "px-2 md:px-3 py-1 text-[10px] md:text-xs font-bold uppercase",
                        getStatusStyle(log.status)
                      )}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="brutal-border-thin border-l-0 border-r-0 px-2 md:px-4 py-2 md:py-3 text-center">
                    {onDeleteLog && (
                      <Button
                        onClick={() => onDeleteLog(log.id)}
                        variant="outline"
                        size="sm"
                        className="brutal-btn brutal-press h-7 px-2 hover:bg-red-500 hover:text-white hover:border-red-600 transition-colors"
                        title="Hapus log ini"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-secondary/30 px-3 md:px-4 py-3 border-t-2 border-foreground">
          <Pagination>
            <PaginationContent className="gap-1">
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={cn(
                    "cursor-pointer text-[10px] md:text-xs",
                    currentPage === 1 && "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>

              {getPageNumbers().map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer text-[10px] md:text-xs h-8 w-8 md:h-9 md:w-9"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={cn(
                    "cursor-pointer text-[10px] md:text-xs",
                    currentPage === totalPages && "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          
          <p className="text-center text-[10px] md:text-xs text-muted-foreground mt-2">
            HALAMAN {currentPage} DARI {totalPages} - TOTAL {filteredLogs.length} DATA
          </p>
        </div>
      )}
    </div>

    {/* Image Zoom Modal */}
    {zoomedImage && (
      <div 
        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
        onClick={() => setZoomedImage(null)}
      >
        <div className="relative max-w-[90vw] max-h-[90vh]">
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute -top-12 right-0 brutal-button px-4 py-2 text-sm"
          >
            TUTUP
          </button>
          <img 
            src={zoomedImage} 
            alt="Dokumen" 
            className="max-w-full max-h-[85vh] object-contain brutal-border"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    )}
    </>
  );
};

export default DataTable;
