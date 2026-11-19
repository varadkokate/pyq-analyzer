export type PriorityTier = 'High' | 'Medium' | 'Low';

export interface AnalysisSummary {
  subjectName: string;
  examTag: string;
  totalPapersAnalyzed: number;
  totalQuestionsExtracted: number;
  totalUniqueConcepts: number;
  highPriorityCount: number;
  keyInsight: string;
}

export interface ImportantQuestion {
  id: string;
  rank: number;
  questionText: string;
  topic: string;
  frequencyCount: number;
  appearedIn: string[];
  estimatedMarks: number;
  marksLabel: string;
  priority: PriorityTier;
  variantExamples: string[];
  studyTip: string;
}

export interface TopicWeightageItem {
  topic: string;
  percentage: number;
  questionCount: number;
  totalMarks: number;
  highPriorityCount: number;
}

export interface MockQuestion {
  number: string;
  questionText: string;
  topic: string;
  marks: number;
  priority: PriorityTier;
  hint: string;
}

export interface MockSection {
  sectionName: string;
  description: string;
  instructions: string;
  questions: MockQuestion[];
}

export interface PredictedMockPaper {
  title: string;
  subtitle: string;
  durationMinutes: number;
  totalMarks: number;
  generalInstructions: string[];
  sections: MockSection[];
}

export interface AnalysisResult {
  id: string;
  createdAt: string;
  sourceFiles: string[];
  summary: AnalysisSummary;
  importantQuestions: ImportantQuestion[];
  topicWeightage: TopicWeightageItem[];
  predictedMockPaper: PredictedMockPaper;
}

export interface MarkingSchemePoint {
  point: string;
  marks: string;
}

export interface ModelAnswer {
  directAnswer: string;
  keyPoints: string[];
  formulaOrDiagramNote: string;
  markingSchemeBreakdown: MarkingSchemePoint[];
  commonMistakeToAvoid: string;
}
