import React, { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { APP_CONFIG } from "@/constants";
import { toast } from "sonner";

interface AdminAccessManagerProps {
  showModal: boolean;
  onClose: () => void;
  onRequestsUpdated: (requests: any[]) => void;
  userEmail: string | null;
}

export default function AdminAccessManager({ showModal, onClose, onRequestsUpdated, userEmail }: AdminAccessManagerProps) {
  const [adminRequests, setAdminRequests] = useState<any[]>([]);
  const [authorizedAdmins, setAuthorizedAdmins] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  useEffect(() => {
    fetchAdminRequests();
    fetchAdmins();
  }, [userEmail]);

  const fetchAdminRequests = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/kasbon/admin-access-requests`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const requests = data.data || [];
        setAdminRequests(requests);
        onRequestsUpdated(requests);
      }
    } catch {}
  };

  const fetchAdmins = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/kasbon/authorized-admins`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAuthorizedAdmins(data.data || []);
      }
    } catch {}
  };

  const handleApproveAdmin = async (reqId: string, action: "approve" | "reject") => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/kasbon/approve-admin-access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ request_id: reqId, action }),
      });
      if (res.ok) {
        toast.success(`Akses berhasil di-${action}.`);
        fetchAdminRequests();
        fetchAdmins();
      } else {
        const err = await res.json();
        toast.error(`Gagal: ${err.detail || err.message}`);
      }
    } catch (e: any) {
      toast.error("Terjadi kesalahan jaringan.");
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    setIsAddingAdmin(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/kasbon/authorized-admins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: newAdminEmail.trim() }),
      });
      if (res.ok) {
        toast.success(`Admin ${newAdminEmail} berhasil ditambahkan.`);
        setNewAdminEmail("");
        fetchAdmins();
      } else {
        const err = await res.json();
        toast.error(`Gagal: ${err.detail || err.message}`);
      }
    } catch (e: any) {
      toast.error("Terjadi kesalahan.");
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!confirm(`Hapus akses admin untuk ${email}?`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/kasbon/authorized-admins/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        toast.success(`Admin ${email} dihapus.`);
        fetchAdmins();
      } else {
        const err = await res.json();
        toast.error(`Gagal: ${err.detail || err.message}`);
      }
    } catch (e: any) {
      toast.error("Terjadi kesalahan.");
    }
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-6 sticky top-0 bg-white pb-2 border-b border-zinc-100 z-10">
          <h3 className="text-lg font-bold text-zinc-900">Kelola Akses Admin</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 bg-zinc-100 p-1.5 rounded-full">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {/* Add New Admin */}
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Tambah Admin Langsung</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="email@domain.com"
              className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
            <button
              onClick={handleAddAdmin}
              disabled={isAddingAdmin || !newAdminEmail.trim()}
              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              Tambah
            </button>
          </div>
        </div>

        {/* Active Admins */}
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Admin Aktif ({authorizedAdmins.length})</p>
          {authorizedAdmins.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">Belum ada admin lain.</p>
          ) : (
            <div className="space-y-2">
              {authorizedAdmins.map((adm) => (
                <div key={adm.email} className="flex items-center justify-between border border-zinc-200 rounded-xl p-3 bg-zinc-50">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{adm.email}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Disetujui oleh: {adm.approved_by || "-"}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveAdmin(adm.email)}
                    className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Hapus akses admin"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Requests */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Permintaan Akses Baru ({adminRequests.length})</p>
          {adminRequests.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">Tidak ada permintaan akses baru.</p>
          ) : (
            <div className="space-y-3">
              {adminRequests.map((req) => (
                <div key={req.id} className="border border-amber-200 rounded-xl p-3 bg-amber-50">
                  <p className="text-sm font-semibold text-amber-900 truncate">{req.email}</p>
                  <p className="text-[10px] text-amber-700 mb-3">{new Date(req.requested_at).toLocaleString("id-ID")}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveAdmin(req.id, "approve")}
                      className="flex-1 rounded-lg bg-amber-600 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
                    >
                      Setujui
                    </button>
                    <button
                      onClick={() => handleApproveAdmin(req.id, "reject")}
                      className="flex-1 rounded-lg border border-red-200 bg-white py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
