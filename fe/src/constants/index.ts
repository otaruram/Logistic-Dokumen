// Navigation tab configuration
export const NAVIGATION_TABS = [
  { id: "dashboard" as const, label: "Dashboard" },
  { id: "features" as const, label: "Features" },
  { id: "options" as const, label: "Other" },
  { id: "profile" as const, label: "Account" },
] as const;

// Feature configuration (sorted by priority: Premium first)
export const FEATURES: ReadonlyArray<{
  id: "ppt" | "dgtnz" | "invoice" | "compressor" | "quiz";
  title: string;
  description: string;
  premium?: boolean;
}> = [
    {
      id: "ppt",
      title: "ppt.wtf",
      description: "AI-powered presentation builder",
      premium: true,
    },
    {
      id: "dgtnz",
      title: "dgtnz.wtf",
      description: "Scan & digitize documents with OCR",
    },
    {
      id: "invoice",
      title: "audit.wtf",
      description: "AI-powered fraud detection system",
    },
    {
      id: "compressor",
      title: "pdf.wtf",
      description: "Compress PDF files before sending",
    },
    {
      id: "quiz",
      title: "quiz.wtf",
      description: "AI-powered quiz generator with GPT-4",
    },
  ];

// Dashboard data
export const WEEKLY_DATA = [
  { day: "Mon", scans: 12 },
  { day: "Tue", scans: 19 },
  { day: "Wed", scans: 8 },
  { day: "Thu", scans: 25 },
  { day: "Fri", scans: 15 },
  { day: "Sat", scans: 7 },
  { day: "Sun", scans: 4 },
] as const;

// App configuration
export const APP_CONFIG = {
  name: "ocr.wtf",
  userInitials: "U",
  maxWidth: "max-w-lg",
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:8000",
} as const;

// Responsive breakpoints
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// Chart configuration
export const CHART_CONFIG = {
  axis: {
    style: { fill: 'hsl(0 0% 45%)', fontSize: 12 },
  },
  tooltip: {
    style: {
      backgroundColor: 'hsl(0 0% 98%)',
      border: '1px solid hsl(0 0% 90%)',
      borderRadius: '8px',
      color: 'hsl(0 0% 4%)',
    },
  },
  bar: {
    fill: 'hsl(0 0% 9%)',
    radius: [4, 4, 0, 0] as [number, number, number, number],
  },
} as const;
