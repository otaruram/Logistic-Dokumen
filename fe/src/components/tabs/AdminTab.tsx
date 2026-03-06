import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, Shield, Coins, Ban, Trash2, Clock, Activity,
    Search, RefreshCw, ChevronDown, ChevronUp, Eye,
    MessageSquare, Scan, AlertTriangle, Plus, Minus,
    X, Check
} from "lucide-react";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface AdminUser {
    id: string;
    email: string;
    name: string;
    picture: string;
    credits: number;
    last_sign_in: string | null;
    created_at: string | null;
    banned: boolean;
    updated_at: string | null;
}

interface AdminStats {
    total_users: number;
    active_today: number;
    total_scans: number;
    total_fraud_scans: number;
    total_chat_sessions: number;
    total_chat_messages: number;
}

interface UserActivity {
    user_id: string;
    total_scans: number;
    total_fraud_scans: number;
    total_chat_sessions: number;
    total_messages: number;
    credits: number;
    recent_fraud_scans: any[];
    recent_chat_sessions: any[];
}

export default function AdminTab() {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [userActivity, setUserActivity] = useState<UserActivity | null>(null);
    const [activityLoading, setActivityLoading] = useState(false);
    const [creditModal, setCreditModal] = useState<{ userId: string; current: number } | null>(null);
    const [creditAmount, setCreditAmount] = useState(10);
    const [retentionModal, setRetentionModal] = useState<string | null>(null);
    const [retentionDays, setRetentionDays] = useState(30);

    const getToken = async () => {
        const { supabase } = await import("@/lib/supabaseClient");
        const { data } = await supabase.auth.getSession();
        return data?.session?.access_token;
    };

    const authHeaders = async () => ({
        "Authorization": `Bearer ${await getToken()}`,
        "Content-Type": "application/json",
    });

    // ── Fetch Data ──
    const fetchAll = async () => {
        setLoading(true);
        try {
            const headers = await authHeaders();
            const [statsRes, usersRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/admin/stats`, { headers }),
                fetch(`${API_BASE_URL}/api/admin/users`, { headers }),
            ]);

            if (statsRes.ok) setStats(await statsRes.json());
            if (usersRes.ok) {
                const data = await usersRes.json();
                setUsers(data.users || []);
            }
        } catch (e) {
            console.error("Admin fetch error:", e);
            toast.error("Failed to load admin data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    // ── User Activity ──
    const fetchActivity = async (userId: string) => {
        if (expandedUser === userId) {
            setExpandedUser(null);
            return;
        }
        setExpandedUser(userId);
        setActivityLoading(true);
        try {
            const headers = await authHeaders();
            const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/activity`, { headers });
            if (res.ok) setUserActivity(await res.json());
        } catch (e) {
            toast.error("Failed to load activity");
        } finally {
            setActivityLoading(false);
        }
    };

    // ── Actions ──
    const handleSetCredits = async () => {
        if (!creditModal) return;
        try {
            const headers = await authHeaders();
            const res = await fetch(`${API_BASE_URL}/api/admin/users/${creditModal.userId}/credits`, {
                method: "POST",
                headers,
                body: JSON.stringify({ credits: creditAmount }),
            });
            if (res.ok) {
                toast.success(`Credits set to ${creditAmount}`);
                setUsers(prev => prev.map(u => u.id === creditModal.userId ? { ...u, credits: creditAmount } : u));
                setCreditModal(null);
            }
        } catch (e) {
            toast.error("Failed to update credits");
        }
    };

    const handleBan = async (userId: string, ban: boolean) => {
        try {
            const headers = await authHeaders();
            const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/ban`, {
                method: "POST",
                headers,
                body: JSON.stringify({ banned: ban }),
            });
            if (res.ok) {
                toast.success(ban ? "User banned" : "User unbanned");
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, banned: ban } : u));
            }
        } catch (e) {
            toast.error("Failed to ban/unban user");
        }
    };

    const handleDelete = async (userId: string, email: string) => {
        if (!confirm(`Delete user ${email} and ALL their data? This cannot be undone.`)) return;
        try {
            const headers = await authHeaders();
            const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
                method: "DELETE",
                headers,
            });
            if (res.ok) {
                toast.success(`User ${email} deleted`);
                setUsers(prev => prev.filter(u => u.id !== userId));
                if (stats) setStats({ ...stats, total_users: stats.total_users - 1 });
            }
        } catch (e) {
            toast.error("Failed to delete user");
        }
    };

    const handleExtendRetention = async () => {
        if (!retentionModal) return;
        try {
            const headers = await authHeaders();
            const res = await fetch(`${API_BASE_URL}/api/admin/users/${retentionModal}/extend-retention`, {
                method: "POST",
                headers,
                body: JSON.stringify({ extra_days: retentionDays }),
            });
            if (res.ok) {
                toast.success(`Retention extended by ${retentionDays} days`);
                setRetentionModal(null);
            }
        } catch (e) {
            toast.error("Failed to extend retention");
        }
    };

    // ── Filtered users ──
    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isOnline = (user: AdminUser) => {
        if (!user.updated_at) return false;
        const diff = Date.now() - new Date(user.updated_at).getTime();
        return diff < 15 * 60 * 1000; // Active in last 15 minutes
    };

    const formatDate = (d: string | null) => {
        if (!d) return "-";
        return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Admin Panel</h2>
                        <p className="text-xs text-gray-500">Manage users, tokens, and monitor activity</p>
                    </div>
                </div>
                <button
                    onClick={fetchAll}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <RefreshCw className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            {/* Stats Grid */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                        { label: "Total Users", value: stats.total_users, icon: Users, color: "text-blue-400" },
                        { label: "Active Today", value: stats.active_today, icon: Activity, color: "text-green-400" },
                        { label: "Total Scans", value: stats.total_scans, icon: Scan, color: "text-purple-400" },
                        { label: "Fraud Scans", value: stats.total_fraud_scans, icon: AlertTriangle, color: "text-yellow-400" },
                        { label: "Chat Sessions", value: stats.total_chat_sessions, icon: MessageSquare, color: "text-cyan-400" },
                        { label: "Messages", value: stats.total_chat_messages, icon: MessageSquare, color: "text-pink-400" },
                    ].map((s, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="p-4 rounded-xl bg-white/[0.03] border border-white/10"
                        >
                            <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
                            <p className="text-2xl font-bold text-white">{s.value}</p>
                            <p className="text-xs text-gray-500">{s.label}</p>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                    type="text"
                    placeholder="Search users by email or name..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-gray-500 outline-none focus:border-white/20 transition-colors text-sm"
                />
            </div>

            {/* User List */}
            <div className="space-y-2">
                <p className="text-xs text-gray-500 px-1">{filteredUsers.length} users</p>

                {filteredUsers.map((user, idx) => (
                    <motion.div
                        key={user.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden"
                    >
                        {/* User Row */}
                        <div className="p-4 flex items-center gap-3">
                            {/* Avatar + Online */}
                            <div className="relative flex-shrink-0">
                                {user.picture ? (
                                    <img src={user.picture} alt="" className="w-9 h-9 rounded-full" />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                                        {user.email[0].toUpperCase()}
                                    </div>
                                )}
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${isOnline(user) ? "bg-green-500" : "bg-gray-600"}`} />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-white truncate">{user.name || user.email}</p>
                                    {user.banned && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">BANNED</span>
                                    )}
                                    {isOnline(user) && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">ONLINE</span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>

                            {/* Credits */}
                            <div className="text-right flex-shrink-0">
                                <p className="text-sm font-bold text-white">{user.credits}</p>
                                <p className="text-[10px] text-gray-500">credits</p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    onClick={() => fetchActivity(user.id)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                    title="View activity"
                                >
                                    <Eye className="w-3.5 h-3.5 text-gray-400" />
                                </button>
                                <button
                                    onClick={() => { setCreditModal({ userId: user.id, current: user.credits }); setCreditAmount(user.credits); }}
                                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                    title="Edit credits"
                                >
                                    <Coins className="w-3.5 h-3.5 text-yellow-400" />
                                </button>
                                <button
                                    onClick={() => handleBan(user.id, !user.banned)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                    title={user.banned ? "Unban" : "Ban"}
                                >
                                    <Ban className={`w-3.5 h-3.5 ${user.banned ? "text-green-400" : "text-orange-400"}`} />
                                </button>
                                <button
                                    onClick={() => setRetentionModal(user.id)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                    title="Extend retention"
                                >
                                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                                </button>
                                <button
                                    onClick={() => handleDelete(user.id, user.email)}
                                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                                    title="Delete user"
                                >
                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                </button>
                            </div>
                        </div>

                        {/* Expanded Activity */}
                        <AnimatePresence>
                            {expandedUser === user.id && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-4 pb-4 pt-2 border-t border-white/5">
                                        {activityLoading ? (
                                            <div className="flex items-center justify-center py-4">
                                                <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                                            </div>
                                        ) : userActivity ? (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div className="p-3 rounded-lg bg-white/[0.03]">
                                                    <p className="text-xs text-gray-500">Scans</p>
                                                    <p className="text-lg font-bold text-white">{userActivity.total_scans}</p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-white/[0.03]">
                                                    <p className="text-xs text-gray-500">Fraud Scans</p>
                                                    <p className="text-lg font-bold text-white">{userActivity.total_fraud_scans}</p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-white/[0.03]">
                                                    <p className="text-xs text-gray-500">Chat Sessions</p>
                                                    <p className="text-lg font-bold text-white">{userActivity.total_chat_sessions}</p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-white/[0.03]">
                                                    <p className="text-xs text-gray-500">Messages</p>
                                                    <p className="text-lg font-bold text-white">{userActivity.total_messages}</p>
                                                </div>
                                                {userActivity.recent_chat_sessions.length > 0 && (
                                                    <div className="col-span-full">
                                                        <p className="text-xs text-gray-500 mb-2">Recent Chat Sessions</p>
                                                        <div className="space-y-1">
                                                            {userActivity.recent_chat_sessions.map((s: any) => (
                                                                <div key={s.id} className="text-xs text-gray-400 flex justify-between p-2 rounded bg-white/[0.02]">
                                                                    <span className="truncate">{s.title}</span>
                                                                    <span className="text-gray-600 flex-shrink-0 ml-2">{formatDate(s.created_at)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ))}
            </div>

            {/* Credit Modal */}
            <AnimatePresence>
                {creditModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => setCreditModal(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-sm p-6 rounded-2xl bg-[#111] border border-white/10"
                        >
                            <h3 className="text-lg font-bold text-white mb-4">Set Credits</h3>
                            <div className="flex items-center gap-3 mb-6">
                                <button
                                    onClick={() => setCreditAmount(Math.max(0, creditAmount - 5))}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10"
                                >
                                    <Minus className="w-4 h-4 text-white" />
                                </button>
                                <input
                                    type="number"
                                    value={creditAmount}
                                    onChange={e => setCreditAmount(parseInt(e.target.value) || 0)}
                                    className="flex-1 text-center text-2xl font-bold bg-white/5 rounded-xl py-3 text-white outline-none border border-white/10"
                                />
                                <button
                                    onClick={() => setCreditAmount(creditAmount + 5)}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10"
                                >
                                    <Plus className="w-4 h-4 text-white" />
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCreditModal(null)}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-medium hover:bg-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSetCredits}
                                    className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-gray-200"
                                >
                                    Set Credits
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Retention Modal */}
            <AnimatePresence>
                {retentionModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => setRetentionModal(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-sm p-6 rounded-2xl bg-[#111] border border-white/10"
                        >
                            <h3 className="text-lg font-bold text-white mb-4">Extend Data Retention</h3>
                            <div className="space-y-3 mb-6">
                                {[7, 30, 90, 365].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setRetentionDays(d)}
                                        className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${retentionDays === d
                                                ? "bg-white text-black"
                                                : "bg-white/5 text-gray-400 hover:bg-white/10"
                                            }`}
                                    >
                                        {d} days
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setRetentionModal(null)}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-medium hover:bg-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleExtendRetention}
                                    className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-gray-200"
                                >
                                    Extend
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
