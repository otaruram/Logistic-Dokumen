import React, { useState, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Download, FileSpreadsheet, Search, Trash2, CloudUpload, ExternalLink, Pencil, Save } from "lucide-react";
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
import { toast } from "sonner";

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
  onUpdateLog?: (logId: number, newSummary: string) => void;
}

const ITEMS_PER_PAGE = 5;

const DataTable = ({ logs, onDeleteLog, onUpdateLog }: DataTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [newLogIds, setNewLogIds] = useState<Set<number>>(new Set());
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editingSummary, setEditingSummary] = useState("");
  const [isBlurDelayed, setIsBlurDelayed] = useState(false);
  const prevLogsLength = useRef(logs.length);

  // Debug logging untuk tracking props changes
  React.useEffect(() => {
    console.log("DataTable - Received logs prop:", logs.length, "items");
    if (logs.length > 0) {
      console.log("DataTable - First log summary:", logs[0].summary.substring(0, 50) + "...");
    }
  }, [logs]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedYear, selectedMonth, selectedDate]);

  // Helper function to format date for display
  const formatDateForDisplay = (isoDate: string) => {
    if (!isoDate || !isoDate.includes('-')) return isoDate; // Fallback
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
  };

  // Detect new log entries
  useEffect(() => {
    if (logs.length > prevLogsLength.current) {
      const newId = logs[0]?.id;
      if (newId) {
        setNewLogIds((prev) => new Set(prev).add(newId));
        // Remove glitch class after animation
        setTimeout(() => {
          setNewLogIds((prev) => {
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
    return logs.filter((log) => {
      const query = searchQuery.toLowerCase();
      const searchMatch =
        !searchQuery.trim() ||
        log.docType.toLowerCase().includes(query) ||
        log.docNumber.toLowerCase().includes(query) ||
        log.receiver.toLowerCase().includes(query) ||
        log.summary.toLowerCase().includes(query);

      // Date filtering logic
      const hasDateFilter = selectedYear || selectedMonth || selectedDate;
      if (hasDateFilter) {
        // If a date filter is active, the log must have a valid date to be considered.
        if (!log.date || typeof log.date !== 'string' || !log.date.includes('-')) {
          return false;
        }

        const [logYear, logMonth, logDay] = log.date.split('-').map(Number);

        const yearMatch = selectedYear ? logYear === parseInt(selectedYear, 10) : true;
        const monthMatch = selectedMonth ? logMonth === parseInt(selectedMonth, 10) : true;
        const dateMatch = selectedDate ? logDay === parseInt(selectedDate, 10) : true;

        // Return true only if it matches the search query AND all active date filters.
        return searchMatch && yearMatch && monthMatch && dateMatch;
      }

      // If no date filters are active, just return the result of the text search.
      return searchMatch;
    });
  }, [logs, searchQuery, selectedYear, selectedMonth, selectedDate]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleStartEditing = (log: LogEntry) => {
    setEditingLogId(log.id);
    setEditingSummary(log.summary);
  };

  const handleCancelEditing = () => {
    setEditingLogId(null);
    setEditingSummary("");
  };

  const handleSaveEditing = async () => {
    if (editingLogId === null || !onUpdateLog) return;
    
    console.log("DataTable - Saving edit:", { editingLogId, editingSummary: editingSummary.substring(0, 50) + "..." });
    
    try {
      await onUpdateLog(editingLogId, editingSummary);
      setEditingLogId(null);
      setEditingSummary("");
    } catch (error) {
      console.error("DataTable - Save edit failed:", error);
    }
  };

  // Handler untuk Upload GDrive
  const handleUploadGDrive = async () => {
    if (logs.length === 0) {
      toast.error("Tidak ada data untuk di-upload!");
      return;
    }

    try {
      setIsUploadingToDrive(true);
      toast.info("Mengupload ke Google Drive...");

      // Get token from sessionStorage
      const userStr = sessionStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const token = user?.driveToken || user?.credential || "";

      if (!token) {
        toast.error("Silakan login terlebih dahulu");
        return;
      }

      const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
      // Remove trailing slash to prevent double slash in URL
      const baseURL = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
      const response = await fetch(`${baseURL}/export?upload_to_drive=true`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      // Periksa apakah respons OK dan merupakan JSON
      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const result = await response.json();

        if (result.status === "success" && result.drive_url) {
          toast.success(
            <div className="flex flex-col gap-2">
              <span>✅ Berhasil diupload ke Google Drive!</span>
              <span className="text-xs">Folder: {result.folder_name}</span>
              <a 
                href={result.drive_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-500 hover:underline text-xs"
              >
                Buka di Google Drive <ExternalLink className="w-3 h-3" />
              </a>
            </div>,
            { duration: 8000 }
          );

          // Buka link di tab baru
          window.open(result.drive_url, "_blank");
        } else if (result.status === "info") {
          // Fallback: Drive upload failed, download locally
          toast.warning(result.message);
          handleExportExcel();
        } else {
          throw new Error(result.message || "Gagal mengupload ke Google Drive");
        }
      } else {
        // Jika bukan JSON, anggap sebagai file download langsung (fallback)
        toast.warning("Respons server tidak valid, mencoba download lokal.");
        handleExportExcel();
      }

    } catch (error) {
      console.error("Error uploading to GDrive:", error);
      toast.error("Gagal upload ke Drive. File akan didownload lokal.");
      handleExportExcel(); // Fallback to local download
    } finally {
      setIsUploadingToDrive(false);
    }
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
              {/* Tombol GDrive */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleUploadGDrive}
                disabled={logs.length === 0}
                className="bg-background text-foreground text-[10px] md:text-xs h-8 px-2 md:px-3 hover:bg-blue-600 hover:text-white hover:border-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download Excel untuk upload ke Google Drive"
              >
                <CloudUpload className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                GDRIVE
              </Button>
            </div>
          </div>

          {/* Search Input */}
          <div className="flex flex-col md:flex-row gap-2">
            {/* Search Input */}
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="CARI TIPE DOKUMEN ATAU NOMOR SURAT..."
                className="w-full pl-10 pr-4 py-2 bg-background text-foreground text-xs md:text-sm border-2 border-background focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>

            {/* Date Filters */}
            <div className="flex gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full md:w-auto px-3 py-2 bg-background text-foreground text-xs md:text-sm border-2 border-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Tahun</option>
                {Array.from({ length: 11 }, (_, i) => 2020 + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full md:w-auto px-3 py-2 bg-background text-foreground text-xs md:text-sm border-2 border-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Bulan</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full md:w-auto px-3 py-2 bg-background text-foreground text-xs md:text-sm border-2 border-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Tanggal</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
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
                      {formatDateForDisplay(log.date)}
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
                      {editingLogId === log.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingSummary}
                            onChange={(e) => setEditingSummary(e.target.value)}
                            autoFocus
                            className="w-full p-1 bg-background text-foreground border-2 border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveEditing}
                              className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEditing}
                              className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => handleStartEditing(log)}
                          className="cursor-pointer hover:bg-gray-100 p-1 rounded"
                          title="Klik untuk edit"
                        >
                          {log.summary}
                        </div>
                      )}
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
                      {editingLogId === log.id ? (
                        <div className="flex items-center justify-center gap-2">
                           <Button
                            onClick={handleSaveEditing}
                            variant="outline"
                            size="sm"
                            className="brutal-btn brutal-press h-7 px-2 hover:bg-green-500 hover:text-white hover:border-green-600 transition-colors"
                            title="Simpan perubahan"
                          >
                            <Save className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          {onUpdateLog && (
                            <Button
                              onClick={() => handleStartEditing(log)}
                              variant="outline"
                              size="sm"
                              className="brutal-btn brutal-press h-7 px-2 hover:bg-yellow-500 hover:text-white hover:border-yellow-600 transition-colors"
                              title="Edit log ini"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          )}
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
                        </div>
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