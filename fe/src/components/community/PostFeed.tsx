import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import PostCard from "./PostCard";
import { Loader2 } from "lucide-react";

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

interface PostFeedProps {
  scope: "INTERNAL" | "GLOBAL";
  refreshTrigger: number;
}

const PostFeed = ({ scope, refreshTrigger }: PostFeedProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      
      // Get current user ID
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        setCurrentUserId(userData.user.id);
      }

      const endpoint = scope === "INTERNAL" 
        ? `${API_BASE_URL}/api/community/posts/internal`
        : `${API_BASE_URL}/api/community/posts/global`;

      const response = await fetch(endpoint);
      
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (error) {
      console.error("Fetch posts error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [scope, refreshTrigger]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📭</span>
        </div>
        <p className="text-gray-600 font-medium">
          {scope === "INTERNAL" 
            ? "Belum ada postingan internal. Jadilah yang pertama!"
            : "Belum ada postingan publik. Mulai percakapan!"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            onDelete={fetchPosts}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default PostFeed;
