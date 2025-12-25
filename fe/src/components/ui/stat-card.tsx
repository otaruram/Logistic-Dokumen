import { motion } from "framer-motion";
import { StatCardProps } from "@/types";

const StatCard = ({ icon: Icon, label, value, subtitle, trend }: StatCardProps) => {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-3xl font-bold">{value}</span>
      {subtitle && (
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      )}
      {trend && (
        <div className={`flex items-center gap-1 text-xs ${trend.isPositive ? 'text-success' : 'text-destructive'}`}>
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
