import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

const ProfileTab = () => {
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("user@example.com");

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
      </motion.div>
    </div>
  );
};

export default ProfileTab;