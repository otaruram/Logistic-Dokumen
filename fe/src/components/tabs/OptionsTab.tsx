import { motion } from "framer-motion";
import { ChevronRight, Bell, Shield, HelpCircle, Trash2, Server, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const OptionsTab = () => {
  const navigate = useNavigate();

  const settingsGroups = [
    {
      title: "Account Overview",
      items: [
        {
          icon: TrendingUp,
          label: "Account Level",
          value: "Pro Plan",
          action: () => toast.info("You are on the Pro Plan"),
        },
        {
          icon: Server,
          label: "System Status",
          value: "All Systems Operational",
          action: () => window.open("https://status.openai.com/", "_blank"),
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
          action: () => navigate("/privacy"),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          icon: HelpCircle,
          label: "Help Center",
          value: "",
          action: () => navigate("/help"),
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 pt-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-4"
      >
        <h2 className="text-xl font-bold text-white">Settings</h2>
        <p className="text-gray-400 text-sm mt-1">Manage app preferences & status</p>
      </motion.div>

      {settingsGroups.map((group, groupIndex) => (
        <motion.div
          key={group.title}
          className="space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * (groupIndex + 1) }}
        >
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-5">
            {group.title}
          </h3>
          <div className="bg-[#111] border-y border-white/10 sm:border sm:rounded-xl overflow-hidden divide-y divide-white/5 mx-0 sm:mx-4 hover:border-white/20 transition-colors cursor-pointer">
            {group.items.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={item.action}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                      <Icon className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                    </div>
                    <span className="font-medium text-sm text-gray-200">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    {item.value && <span className="text-sm px-2 py-0.5 rounded-md bg-white/5 border border-white/5">{item.value}</span>}
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
        className="text-center pt-8 pb-8"
      >
        <p className="text-xs text-gray-600 font-mono">
          ocr.wtf v2.1.0 • Connected to SG-1
        </p>
      </motion.div>
    </div>
  );
};

export default OptionsTab;