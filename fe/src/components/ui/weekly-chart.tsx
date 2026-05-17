import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_CONFIG } from "@/constants";
import { WeeklyDataPoint } from "@/types";

interface WeeklyChartProps {
  data: readonly WeeklyDataPoint[];
}

const WeeklyChart = ({ data }: WeeklyChartProps) => {
  return (
    <div className="card-clean p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Weekly Usage</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[...data]}>
            <XAxis 
              dataKey="day" 
              axisLine={false}
              tickLine={false}
              tick={CHART_CONFIG.axis.style}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={CHART_CONFIG.axis.style}
            />
            <Tooltip
              contentStyle={CHART_CONFIG.tooltip.style}
            />
            <Bar 
              dataKey="scans" 
              fill={CHART_CONFIG.bar.fill}
              radius={CHART_CONFIG.bar.radius}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WeeklyChart;
