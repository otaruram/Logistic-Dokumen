// Tab types
export type TabType = "dashboard" | "dgtnz" | "otaru" | "profile" | "admin";

export type FeatureType = "dgtnz";


// Navigation types
export interface NavigationTab {
  id: TabType;
  label: string;
}

export interface Feature {
  id: FeatureType;
  title: string;
  description: string;
  premium?: boolean;
}

// Dasbor types
export interface WeeklyDataPoint {
  day: string;
  scans: number;
}

export interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

// Component props
export interface TabComponentProps {
  onBack?: () => void;
}

export interface FiturDropupProps {
  onSelect: (feature: FeatureType) => void;
  onClose: () => void;
}
