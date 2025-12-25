import { motion } from "framer-motion";
import { Scan } from "lucide-react";
import { APP_CONFIG } from "@/constants";
import { supabase } from "@/lib/supabaseClient";
import { useState, useEffect } from "react";

const Header = () => {
  const [userInitials, setUserInitials] = useState(APP_CONFIG.userInitials);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get initials from email or metadata
        const email = user.email || "";
        const name = user.user_metadata?.full_name || email.split("@")[0];
        const initials = name
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        setUserInitials(initials || user.id.slice(0, 2).toUpperCase());
      }
    };
    loadUser();
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border">
      <div className={`${APP_CONFIG.maxWidth} mx-auto px-4 py-3 flex items-center justify-between`}>
        <motion.div 
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
            <Scan className="w-4 h-4 text-background" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            {APP_CONFIG.name}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center text-sm font-medium text-background">
            {userInitials}
          </div>
        </motion.div>
      </div>
    </header>
  );
};

export default Header;