import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Globe, Lock, Building2, Plus, Copy, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import TeamCreateModal from "@/components/community/TeamCreateModal";
import TeamJoinModal from "@/components/community/TeamJoinModal";
import PostModal from "@/components/community/PostModal";
import PostFeed from "@/components/community/PostFeed";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface Team {
  id: number;
  name: string;
  join_code: string;
  member_count: number;
}

const CommunityTab = () => {
  const [activeTab, setActiveTab] = useState<"internal" | "global">("global");
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [refreshPosts, setRefreshPosts] = useState(0);

  const fetchTeam = async () => {
    setIsLoadingTeam(true);
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/community/teams/my-team`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTeam(data);
      } else {
        setTeam(null);
      }
    } catch (error) {
      console.error("Fetch team error:", error);
      setTeam(null);
    } finally {
      setIsLoadingTeam(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleCopyJoinCode = () => {
    if (team?.join_code) {
      navigator.clipboard.writeText(team.join_code);
      toast.success("✅ Kode join berhasil disalin!");
    }
  };

  const handleLeaveTeam = async () => {
    if (!confirm(`Yakin keluar dari "${team?.name}"?`)) return;

    toast.loading("Keluar dari kantor...");

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.dismiss();
        toast.error("Please login first");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/community/teams/leave`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Failed to leave team");

      toast.dismiss();
      toast.success("✅ Berhasil keluar dari kantor");
      setTeam(null);
      setActiveTab("global");
    } catch (error) {
      console.error("Leave team error:", error);
      toast.dismiss();
      toast.error("Gagal keluar dari kantor");
    }
  };

  const handleModalSuccess = () => {
    fetchTeam();
    setRefreshPosts(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-black">Community</h2>
              <p className="text-gray-600 mt-1">Connect with your team & the world</p>
            </div>
            <Button
              onClick={() => setShowPostModal(true)}
              className="bg-black text-white hover:bg-gray-800 rounded-full px-6 gap-2"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Tulis Postingan</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Team Info Card (if has team) */}
        {team && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-black text-white rounded-2xl p-6 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-black" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{team.name}</h3>
                  <p className="text-gray-300 text-sm mt-1">
                    {team.member_count} member{team.member_count > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleCopyJoinCode}
                  variant="outline"
                  size="sm"
                  className="border-white text-white hover:bg-white hover:text-black gap-2"
                >
                  <Copy className="w-4 h-4" />
                  <span className="font-mono">{team.join_code}</span>
                </Button>
                <Button
                  onClick={handleLeaveTeam}
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setActiveTab("internal")}
            disabled={!team && !isLoadingTeam}
            className={`flex-1 py-4 px-6 rounded-xl border-2 font-semibold transition-all ${
              activeTab === "internal"
                ? "bg-black text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                : !team
                ? "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
                : "bg-white text-black border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Lock className="w-5 h-5" />
              <span>Kantor Kita</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("global")}
            className={`flex-1 py-4 px-6 rounded-xl border-2 font-semibold transition-all ${
              activeTab === "global"
                ? "bg-black text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                : "bg-white text-black border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Globe className="w-5 h-5" />
              <span>Lounge GA</span>
            </div>
          </button>
        </div>

        {/* Content Area */}
        {activeTab === "internal" && !team ? (
          /* ZERO STATE: Belum Punya Tim */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-blue-300 flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-black mb-2">Anda Belum Memiliki Tim</h3>
            <p className="text-gray-600 mb-10 max-w-md mx-auto text-sm">
              Buat ruang kerja digital untuk kantormu atau gabung dengan tim yang sudah ada.
            </p>
            
            {/* 2 Pilihan Besar (Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {/* Card: Buat Tim Baru */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="group bg-white border-2 border-black rounded-2xl p-8 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all text-left"
              >
                <div className="w-14 h-14 rounded-xl bg-black flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Plus className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-xl font-bold text-black mb-2">Buat Tim Baru</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Jadi admin dan buat kantor digitalmu sendiri. Dapatkan kode unik untuk invite rekan kerja.
                </p>
                <div className="flex items-center text-sm font-semibold text-black group-hover:underline">
                  Mulai Buat
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Card: Gabung Tim */}
              <button
                onClick={() => setShowJoinModal(true)}
                className="group bg-white border-2 border-black rounded-2xl p-8 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all text-left"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-xl font-bold text-black mb-2">Gabung Tim</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Punya kode join dari rekan kantor? Masukkan kode untuk bergabung ke tim yang sudah ada.
                </p>
                <div className="flex items-center text-sm font-semibold text-black group-hover:underline">
                  Masukkan Kode
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>

            {/* Info Tambahan */}
            <div className="mt-10 max-w-xl mx-auto bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
              <p className="text-xs text-gray-700 leading-relaxed">
                <strong>💡 Kenapa perlu Tim?</strong>
                <br />
                Tim memungkinkan kamu berbagi postingan internal khusus dengan rekan satu kantor. 
                Cocok untuk koordinasi GA, pengumuman internal, atau diskusi tim yang private.
              </p>
            </div>
          </motion.div>
        ) : (
          <PostFeed 
            scope={activeTab === "internal" ? "INTERNAL" : "GLOBAL"} 
            refreshTrigger={refreshPosts}
          />
        )}
      </div>

      {/* Modals */}
      <TeamCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleModalSuccess}
      />
      <TeamJoinModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSuccess={handleModalSuccess}
      />
      <PostModal
        isOpen={showPostModal}
        onClose={() => setShowPostModal(false)}
        onSuccess={() => {
          setRefreshPosts(prev => prev + 1);
        }}
        defaultScope={activeTab === "internal" ? "INTERNAL" : "GLOBAL"}
        onRequestCreateTeam={() => {
          setShowPostModal(false);
          setTimeout(() => setShowCreateModal(true), 200);
        }}
        onRequestJoinTeam={() => {
          setShowPostModal(false);
          setTimeout(() => setShowJoinModal(true), 200);
        }}
      />
    </div>
  );
};

export default CommunityTab;
