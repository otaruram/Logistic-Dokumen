// Tab types
export type TabType = "dashboard" | "features" | "dgtnz" | "invoice" | "qr" | "compressor" | "quiz" | "community" | "options" | "profile";

export type FeatureType = "dgtnz" | "invoice" | "qr" | "compressor" | "quiz";

// Navigation types
export interface NavigationTab {
  id: TabType;
  label: string;
}

export interface Feature {
  id: FeatureType;
  title: string;
  description: string;
}

// Dashboard types
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

export interface FeaturesDropupProps {
  onSelect: (feature: FeatureType) => void;
  onClose: () => void;
}
