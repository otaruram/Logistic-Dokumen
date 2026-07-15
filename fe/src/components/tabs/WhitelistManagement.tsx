/**
 * WhitelistManagement — Admin tab for managing employee phone whitelist
 *
 * Fitur:
 *   - Table of whitelisted phone numbers (paginated)
 *   - Add single phone number form
 *   - Bulk CSV upload
 *   - Delete/deactivate entries
 *   - Search by phone/name
 *   - Stats counters
 *
 * Design: Light theme, consistent with Portal Mitra
 */
import { useState, useEffect, useCallback } from "react";
import {
  Phone,
  Plus,
  Upload,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Users,
  Building2,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { APP_CONFIG } from "@/constants";

const API = APP_CONFIG.apiUrl;

interface WhitelistEntry {
  id: string;
  phone_number: string;
  company_id: string;
  employee_name: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string | null;
}

interface WhitelistStats {
  total: number;
  companies: Set<string>;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function WhitelistManagement() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setCariQuery] = useState("");
  const [stats, setStats] = useState<WhitelistStats>({
    total: 0,
    companies: new Set(),
  });

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addPhone, setAddPhone] = useState("");
  const [addName, setAddName] = useState("");
  const [addCompany, setAddCompany] = useState("koperasi-maju-bersama");
  const [addLoading, setAddLoading] = useState(false);

  // Bulk upload state
  const [showBulkUnggah, setShowBulkUnggah] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkCompany, setBulkCompany] = useState("koperasi-maju-bersama");

  const PER_PAGE = 15;

  // ── Fetch entries ──────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(PER_PAGE),
      });
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }

      const res = await fetch(`${API}/api/v1/admin/whitelist?${params}`, {
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        setEntries(data.items || []);
        setTotal(data.total || 0);

        // Calculate stats from entries
        const companies = new Set<string>(
          (data.items || []).map((e: WhitelistEntry) => e.company_id)
        );
        setStats({
          total: data.total || 0,
          companies,
        });
      } else {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403) {
          toast.error("Anda tidak memiliki akses admin.");
        } else {
          toast.error(err.detail || "Gagal memuat data whitelist.");
        }
      }
    } catch {
      toast.error("Network error saat memuat whitelist.");
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Add single entry ──────────────────────────────────────────────────

  const handleAddEntry = async () => {
    if (!addPhone.trim()) {
      toast.error("Masukkan nomor HP.");
      return;
    }
    setAddLoading(true);
    try {
      const headers: Record<string, string> = {
        ...(await getAuthHeader()),
        "Content-Type": "application/json",
      };
      const res = await fetch(`${API}/api/v1/admin/whitelist`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          phone_number: addPhone,
          company_id: addCompany,
          employee_name: addName || null,
        }),
      });

      if (res.ok) {
        toast.success("Nomor HP berhasil ditambahkan ke whitelist.");
        setAddPhone("");
        setAddName("");
        setShowAddForm(false);
        fetchEntries();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Gagal menambahkan nomor.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setAddLoading(false);
    }
  };

  // ── Bulk upload ────────────────────────────────────────────────────────

  const handleBulkUnggah = async () => {
    if (!bulkFile) {
      toast.error("Pilih file CSV terlebih dahulu.");
      return;
    }
    setBulkLoading(true);
    try {
      const headers = await getAuthHeader();
      const formData = new FormData();
      formData.append("file", bulkFile);

      const params = new URLSearchParams({ company_id: bulkCompany });
      const res = await fetch(
        `${API}/api/v1/admin/whitelist/bulk?${params}`,
        {
          method: "POST",
          headers,
          body: formData,
        }
      );

      if (res.ok) {
        const data = await res.json();
        toast.success(
          `Upload selesai: ${data.inserted} ditambahkan, ${data.skipped} dilewati.`
        );
        setBulkFile(null);
        setShowBulkUnggah(false);
        fetchEntries();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Gagal upload CSV.");
      }
    } catch {
      toast.error("Network error saat upload.");
    } finally {
      setBulkLoading(false);
    }
  };

  // ── Delete entry ──────────────────────────────────────────────────────

  const handleDelete = async (entryId: string, phone: string) => {
    if (!window.confirm(`Hapus nomor ${phone} dari whitelist?`)) return;

    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API}/api/v1/admin/whitelist/${entryId}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok || res.status === 204) {
        toast.success("Entry dihapus dari whitelist.");
        fetchEntries();
      } else {
        toast.error("Gagal menghapus entry.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────

  const fmtTanggal = (val?: string | null): string => {
    if (!val) return "-";
    const d = new Tanggal(val);
    if (isNaN(d.getTime())) return val;
    return new Intl.TanggalTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  const inputCls =
    "w-full h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 transition-all";
  const labelCls =
    "block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5";

  return (
    <div className="space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">{stats.total}</p>
              <p className="text-xs text-zinc-500">Total Karyawan Whitelist</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">
                {stats.companies.size}
              </p>
              <p className="text-xs text-zinc-500">Perusahaan / Koperasi</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50">
              <CheckCircle2 className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">Aktif</p>
              <p className="text-xs text-zinc-500">Status Whitelist</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search nomor HP atau nama..."
              value={searchQuery}
              onChange={(e) => {
                setCariQuery(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 transition-colors"
            />
          </div>

          {/* Aksis */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setShowBulkUnggah(false);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Manual
            </button>
            <button
              onClick={() => {
                setShowBulkUnggah(!showBulkUnggah);
                setShowAddForm(false);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:border-zinc-400 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload CSV
            </button>
          </div>
        </div>

        {/* Add Single Entry Form */}
        {showAddForm && (
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className={labelCls}>Nomor HP *</label>
                <input
                  className={inputCls}
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="081234567890"
                />
              </div>
              <div>
                <label className={labelCls}>Nama Karyawan</label>
                <input
                  className={inputCls}
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Ahmad Suparman"
                />
              </div>
              <div>
                <label className={labelCls}>ID Perusahaan</label>
                <input
                  className={inputCls}
                  value={addCompany}
                  onChange={(e) => setAddCompany(e.target.value)}
                  placeholder="koperasi-maju-bersama"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddEntry}
                  disabled={addLoading}
                  className="flex-1 h-11 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {addLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "Simpan"
                  )}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="h-11 w-11 rounded-xl border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 transition-colors"
                >
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Upload Form */}
        {showBulkUnggah && (
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-1">
                <label className={labelCls}>File CSV</label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) =>
                      setBulkFile(e.target.files?.[0] || null)
                    }
                    className="w-full h-11 rounded-xl border border-zinc-200 bg-white px-3 pt-2 text-sm text-zinc-900 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-zinc-700 hover:file:bg-zinc-200"
                  />
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">
                  Format: phone_number,nama (satu per baris)
                </p>
              </div>
              <div>
                <label className={labelCls}>ID Perusahaan</label>
                <input
                  className={inputCls}
                  value={bulkCompany}
                  onChange={(e) => setBulkCompany(e.target.value)}
                  placeholder="koperasi-maju-bersama"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkUnggah}
                  disabled={bulkLoading || !bulkFile}
                  className="flex-1 h-11 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
                >
                  {bulkLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4" />
                  )}
                  Upload
                </button>
                <button
                  onClick={() => setShowBulkUnggah(false)}
                  className="h-11 w-11 rounded-xl border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 transition-colors"
                >
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <Phone className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-500">
              Belum ada data whitelist
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Tambahkan nomor HP karyawan untuk memulai.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Nomor HP
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Nama
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Perusahaan
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Ditambahkan
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Oleh
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <span className="font-mono font-medium text-zinc-900">
                            {entry.phone_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-700">
                        {entry.employee_name || (
                          <span className="text-zinc-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                          {entry.company_id}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-zinc-500">
                        {fmtTanggal(entry.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-zinc-500">
                        {entry.created_by || "-"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() =>
                            handleDelete(entry.id, entry.phone_number)
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 bg-zinc-50/30">
                <p className="text-xs text-zinc-500">
                  Menampilkan {(page - 1) * PER_PAGE + 1}–
                  {Math.min(page * PER_PAGE, total)} dari {total} entry
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-medium text-zinc-600 px-3">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
