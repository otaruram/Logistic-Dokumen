import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, Trash2, LogOut, Mail } from "lucide-react";
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

  // Get user data
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
      toast.success("✅ Thank you for your feedback! Your review will appear on the landing page soon.");
      setRating(0);
      setFeedback("");
    } catch (error) {
      console.error("Submit review error:", error);
      toast.dismiss();
      toast.error("Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "HAPUS") {
      toast.error('Type "HAPUS" to confirm');
      return;
    }

    toast.loading("Deleting account and all data...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.dismiss();
        toast.error("Please login first");
        return;
      }

      // Call backend to delete account
      const response = await fetch(`${API_BASE_URL}/api/users/delete-account`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      toast.dismiss();
      toast.success("✅ Account deleted successfully");
      
      // Logout and redirect
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Delete account error:", error);
      toast.dismiss();
      toast.error("Failed to delete account. Please try again.");
    } finally {
      setDeleteConfirm("");
    }
  };

  const handleLogout = async () => {
    toast.loading("Logging out...");
    try {
      await supabase.auth.signOut();
      toast.dismiss();
      toast.success("✅ Logged out successfully");
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      toast.dismiss();
      toast.error("Failed to logout");
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <motion.div
        className="card-clean p-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center mx-auto text-2xl font-bold text-background">
          {userName.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-xl font-semibold mt-4">{userName}</h2>
        <div className="flex items-center justify-center gap-2 text-muted-foreground mt-1">
          <Mail className="w-4 h-4" />
          <span className="text-sm">{userEmail}</span>
        </div>
      </motion.div>

      {/* Rating Section */}
      <motion.div
        className="card-clean p-5 space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="font-semibold flex items-center gap-2">
          <Star className="w-5 h-5" />
          Rate Us
        </h3>
        
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`w-8 h-8 ${
                  star <= rating
                    ? "text-foreground fill-foreground"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>

        <Textarea
          placeholder="Write your feedback here... (optional)"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="min-h-[80px]"
        />

        <Button 
          onClick={handleSubmitRating} 
          className="w-full"
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
          className="w-full justify-start gap-3"
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
              className="w-full justify-start gap-3 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account Permanently
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">
                Delete Account Permanently
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  This action cannot be undone. All data including:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Scan history</li>
                  <li>Remaining credits</li>
                  <li>Ratings and feedback</li>
                </ul>
                <p className="font-medium text-foreground mt-4">
                  Type <span className="text-destructive font-bold">HAPUS</span> to confirm:
                </p>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder='Type "HAPUS"'
                />
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                className="bg-destructive hover:bg-destructive/90"
                disabled={deleteConfirm !== "HAPUS"}
              >
                Delete Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>

      {/* Danger Zone Info */}
      <motion.div
        className="card-clean p-4 border-destructive/30"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <p className="text-xs text-muted-foreground text-center">
          Danger Zone: Account deletion is permanent and will remove all related data from our system.
        </p>
      </motion.div>
    </div>
  );
};

export default ProfileTab;