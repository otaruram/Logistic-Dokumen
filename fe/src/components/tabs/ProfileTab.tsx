import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, Trash2, LogOut, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const ProfileTab = () => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("user@example.com");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserEmail(data.user.email || "user@example.com");
        setUserName(data.user.user_metadata?.name || data.user.email?.split('@')[0] || "User");
      }
    };
    fetchUser();
  }, []);

  const handleSubmitRating = async () => {
    if (rating === 0) {
      toast.error("Please give a rating first");
      return;
    }

    setIsSubmitting(true);
    toast.loading("Submitting your review...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.dismiss();
        toast.error("Please login first");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/reviews/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          rating,
          feedback: feedback || null
        })
      });

      if (!response.ok) {
        throw new Error("Failed to submit review");
      }

      toast.dismiss();
      toast.success("✅ Thank you for your feedback!");
      setRating(0);
      setFeedback("");
    } catch (error) {
      console.error("Submit review error:", error);
      toast.dismiss();
      toast.error("Failed to submit review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "HAPUS") {
      toast.error('Type "HAPUS" to confirm');
      return;
    }

    toast.loading("Deleting account...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.dismiss();
        toast.error("Please login first");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/users/delete-account`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Failed to delete account");

      toast.dismiss();
      toast.success("✅ Account deleted successfully");
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to delete account.");
    } finally {
      setDeleteConfirm("");
    }
  };

  const handleLogout = async () => {
    toast.loading("Logging out...");
    try {
      await supabase.auth.signOut();
      toast.dismiss();
      window.location.href = "/";
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to logout");
    }
  };

  return (
    <div className="space-y-6 pt-6 px-4 pb-12">
      {/* Profile Header */}
      <motion.div
        className="bg-[#111] border border-white/10 rounded-2xl p-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="w-20 h-20 rounded-full bg-white p-1 mx-auto">
          <div className="w-full h-full rounded-full bg-black flex items-center justify-center border border-white/10">
            <span className="text-2xl font-bold text-white uppercase">{userName.charAt(0)}</span>
          </div>
        </div>
        <h2 className="text-xl font-bold mt-4 text-white">{userName}</h2>
        <div className="flex items-center justify-center gap-2 text-gray-400 mt-1">
          <Mail className="w-4 h-4" />
          <span className="text-sm">{userEmail}</span>
        </div>
      </motion.div>

      {/* Rating Section - Restored */}
      <motion.div
        className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="font-bold text-white flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Rate Us
        </h3>

        <div className="flex justify-center gap-2 py-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`w-8 h-8 ${star <= rating
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-gray-700 hover:text-gray-500"
                  }`}
              />
            </button>
          ))}
        </div>

        <Textarea
          placeholder="Write your feedback here... (optional)"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="min-h-[80px] bg-black border-white/10 text-white placeholder:text-gray-600 focus:border-white/30"
        />

        <Button
          onClick={handleSubmitRating}
          className="w-full bg-white text-black hover:bg-gray-200"
          disabled={isSubmitting || rating === 0}
        >
          {isSubmitting ? "Submitting..." : "Submit Rating"}
        </Button>
      </motion.div>

      {/* Account Actions */}
      <motion.div
        className="space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Button
          variant="outline"
          className="w-full justify-start gap-3 bg-[#111] border-white/10 text-white hover:bg-white/5 hover:text-white h-12"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>

        {/* Delete Account Dialog */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 border-red-900/50 text-red-500 hover:bg-red-950/20 hover:text-red-400 bg-transparent h-12"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account Permanently
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-[#111] border-white/10 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-500">
                Delete Account Permanently
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3 text-gray-400">
                <p>
                  This action cannot be undone. All data will be erased.
                </p>
                <p className="font-medium text-white mt-4">
                  Type <span className="text-red-500 font-bold">HAPUS</span> to confirm:
                </p>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder='Type "HAPUS"'
                  className="bg-black border-white/10 text-white"
                />
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                className="bg-red-600 hover:bg-red-700 text-white border-none"
                disabled={deleteConfirm !== "HAPUS"}
              >
                Delete Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </div>
  );
};

export default ProfileTab;