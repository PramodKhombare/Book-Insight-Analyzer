export interface TimelessInsight {
  insight: string;
  description: string;
  actionableTakeaway: string;
}

export interface PracticalApplication {
  habits: string[];
  rituals: string[];
  systems: string[];
  principles: string[];
}

export interface Top5Evaluation {
  isTop5: boolean;
  rankingJustification: string;
}

export interface BookAnalysisResult {
  title: string;
  author: string;
  category: string;
  summary: string;
  timelessInsights: TimelessInsight[];
  practicalApplication: PracticalApplication;
  top5Evaluation: Top5Evaluation;
  // Metadata added by server
  wasTruncated?: boolean;
  fileAnalyzed: string;
  charCount?: number;
  analyzedAt: string; // ISO string added by client
}
