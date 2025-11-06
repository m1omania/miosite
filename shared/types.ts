// Общие типы для frontend и backend

export interface AuditRequest {
  url: string;
}

export interface AuditReport {
  id: string;
  url: string;
  createdAt: string;
  categories: ReportCategory[];
  recommendations: Recommendation[];
  metrics: SiteMetrics;
  screenshots?: {
    desktop: string;
    mobile: string;
  };
  // Детальный отчет
  detailedReport?: DetailedReport;
}

export interface DetailedReport {
  executiveSummary: ExecutiveSummary;
  visualDesign: VisualDesignAnalysis;
  typography: TypographyAnalysis;
  colorsContrast: ColorsContrastAnalysis;
  navigation: NavigationAnalysis;
  ctas: CTADetailedAnalysis;
  forms: FormsAnalysis;
  responsiveness: ResponsivenessAnalysis;
  performance: PerformanceAnalysis;
  accessibility: AccessibilityAnalysis;
  content: ContentAnalysis;
  overallUX: OverallUXAnalysis;
  actionPlan: ActionPlan;
}

export interface ExecutiveSummary {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  summary: string;
}

export interface VisualDesignAnalysis {
  strengths: string[];
  problems: string[];
  score: number;
  observations: string[];
}

export interface TypographyAnalysis {
  minSize: number;
  maxSize: number;
  issues: TypographyIssue[];
  recommendations: string[];
  score: number;
}

export interface TypographyIssue {
  type: 'min' | 'max' | 'readability';
  description: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ColorsContrastAnalysis {
  score: number;
  positivePoints: string[];
  problems: string[];
  recommendations: string[];
}

export interface NavigationAnalysis {
  score: number;
  structure: string;
  menuItems: number;
  observations: string[];
  recommendations: string[];
}

export interface CTADetailedAnalysis {
  count: number;
  buttons: CTADescription[];
  score: number;
  observations: string[];
  recommendations: string[];
}

export interface CTADescription {
  text: string;
  location: string;
  visibility: 'excellent' | 'good' | 'poor';
  color?: string;
}

export interface FormsAnalysis {
  score: number;
  formCount: number;
  observations: string[];
  recommendations: string[];
}

export interface ResponsivenessAnalysis {
  score: number;
  hasViewport: boolean;
  hasResponsiveCSS: boolean;
  observations: string[];
  recommendations: string[];
}

export interface PerformanceAnalysis {
  score: number;
  loadTime: number;
  observations: string[];
  recommendations: string[];
}

export interface AccessibilityAnalysis {
  score: number;
  positivePoints: string[];
  problems: string[];
  recommendations: string[];
  wcagCompliance: 'AA' | 'A' | 'None';
}

export interface ContentAnalysis {
  score: number;
  observations: string[];
  recommendations: string[];
}

export interface OverallUXAnalysis {
  score: number;
  strengths: string[];
  weaknesses: string[];
}

export interface ActionPlan {
  critical: ActionItem[];
  important: ActionItem[];
  desirable: ActionItem[];
}

export interface ActionItem {
  title: string;
  problem: string;
  solution: string;
  impact: string;
  timeframe: string;
}

export interface ReportCategory {
  name: string;
  severity: 'error' | 'warning' | 'info';
  issues: Issue[];
}

export interface Issue {
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  element?: string;
  suggestion?: string;
}

export interface Recommendation {
  title: string;
  description: string;
  impact: string;
  priority: 'high' | 'medium' | 'low';
  steps: string[];
}

export interface SiteMetrics {
  loadTime: number;
  hasViewport: boolean;
  hasTitle: boolean;
  fontSizes: FontSizeAnalysis;
  contrast: ContrastAnalysis;
  ctas: CTAAnalysis;
  responsive: boolean;
}

export interface FontSizeAnalysis {
  minSize: number;
  maxSize: number;
  issues: string[];
}

export interface ContrastAnalysis {
  issues: string[];
  score: number;
}

export interface CTAAnalysis {
  count: number;
  issues: string[];
}

export interface LeadRequest {
  reportId: string;
  name: string;
  phone: string;
  email: string;
  comment?: string;
}

export interface Lead {
  id: string;
  reportId: string;
  name: string;
  phone: string;
  email: string;
  comment?: string;
  createdAt: string;
}

