import { motion } from "framer-motion";
import { User, Trash2, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface Post {
  id: number;
  content: string;
  scope: "INTERNAL" | "GLOBAL";
  author_name: string;
  author_role?: string;
  created_at: string;
  user_id: string;
}

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  onDelete: () => void;
}

const PostCard = ({ post, currentUserId, onDelete }: PostCardProps) => {
  const isOwner = currentUserId && post.user_id === currentUserId;
  const postDate = new Date(post.created_at);
  const formattedDate = postDate.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const handleDelete = async () => {
    if (!confirm("Yakin hapus postingan ini?")) return;

    toast.loading("Menghapus...");

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.dismiss();
        toast.error("Please login first");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/community/posts/${post.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to delete post");
      }

      toast.dismiss();
      toast.success("✅ Postingan berhasil dihapus");
      onDelete();
    } catch (error) {
      console.error("Delete post error:", error);
      toast.dismiss();
      toast.error("Gagal menghapus postingan");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white border-2 border-black rounded-xl p-6 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold">
            {post.author_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-black">{post.author_name}</p>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>{formattedDate}</span>
              <span>•</span>
              <div className="flex items-center gap-1">
                {post.scope === "INTERNAL" ? (
                  <>
                    <Lock className="w-3 h-3" />
                    <span>Internal</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3 h-3" />
                    <span>Publik</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Delete Button (only for post owner) */}
        {isOwner && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className="text-gray-400 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
        {post.content}
      </div>
    </motion.div>
  );
};

export default PostCard;
