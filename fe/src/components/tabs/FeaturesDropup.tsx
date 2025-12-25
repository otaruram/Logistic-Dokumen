import { motion } from "framer-motion";
import { Scan, FileText, FileDown, Brain, Presentation, X } from "lucide-react";
import { FEATURES } from "@/constants";
import { FeaturesDropupProps } from "@/types";

const FEATURE_ICONS = {
  dgtnz: Scan,
  invoice: FileText,
  compressor: FileDown,
  quiz: Brain,
  ppt: Presentation,
} as const;

const FeaturesDropup = ({ onSelect, onClose }: FeaturesDropupProps) => {

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-20 left-4 right-4 z-50 max-w-lg mx-auto"
    >
      <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="font-semibold text-sm">Choose Feature</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-2">
          {FEATURES.map((feature) => {
            const Icon = FEATURE_ICONS[feature.id];
            return (
              <button
                key={feature.id}
                onClick={() => onSelect(feature.id)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="w-5 h-5 text-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{feature.title}</p>
                    {feature.premium && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full">
                        Premium
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default FeaturesDropup;