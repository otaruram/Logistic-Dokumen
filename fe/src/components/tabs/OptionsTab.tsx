import { motion } from "framer-motion";
import { Moon, Sun, ChevronRight, Bell, Shield, HelpCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const OptionsTab = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const navigate = useNavigate();


  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
    toast.success(`Theme changed to ${isDarkMode ? "Light" : "Dark"}`);
  };

  const settingsGroups = [
    {
      title: "Appearance",
      items: [
        {
          icon: isDarkMode ? Moon : Sun,
          label: "Theme",
          value: isDarkMode ? "Dark" : "Light",
          action: toggleTheme,
        },
      ],
    },
    {
      title: "Notifications",
      items: [
        {
          icon: Bell,
          label: "Push Notifications",
          value: "Active",
          action: () => toast.info("Notification settings"),
        },
      ],
    },
    {
      title: "Data & Privacy",
      items: [
        {
          icon: Trash2,
          label: "Clear Cache",
          value: "",
          action: () => toast.success("Cache cleared!"),
        },
        {
          icon: Shield,
          label: "Privacy Policy",
          value: "",
          action: () => navigate("/privacy"), // Real navigation
        },
      ],
    },
    {
      title: "Help",
      items: [
        {
          icon: HelpCircle,
          label: "Help Center",
          value: "",
          action: () => navigate("/help"), // Real navigation
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage app preferences</p>
      </motion.div>

      {settingsGroups.map((group, groupIndex) => (
        <motion.div
          key={group.title}
          className="space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * (groupIndex + 1) }}
        >
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            {group.title}
          </h3>
          <div className="card-clean overflow-hidden divide-y divide-border">
            {group.items.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={item.action}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {item.value && <span className="text-sm">{item.value}</span>}
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center pt-4"
      >
        <p className="text-xs text-muted-foreground">
          ocr.wtf v1.0.0
        </p>
      </motion.div>
    </div>
  );
};

export default OptionsTab;