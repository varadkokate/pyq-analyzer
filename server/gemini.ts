import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import mammoth from 'mammoth';
import type { AnalysisResult, ModelAnswer } from '../src/types.ts';

const MODEL_NAME = 'gemini-3.1-flash-lite';
const MAX_RETRIES = 2; // Up to 2 automatic retries (3 total attempts)

function getAiClient(customApiKey?: string): GoogleGenAI {
  const trimmedCustom = customApiKey?.trim();
  const apiKey = trimmedCustom || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'Gemini API key is not configured. Add a fallback key in API Key Settings or check Settings > Secrets.'
    );
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface UploadedPaperFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface ExtractedPaperText {
  filename: string;
  format: string;
  text: string;
  pageCount?: number;
}

interface ContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
}

function compactExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function convertFileToParts(file: UploadedPaperFile, index: number): Promise<ContentPart[]> {
  const ext = getExtension(file.originalname);
  const label = `--- PAPER ${index + 1}: "${file.originalname}" ---`;

  if (file.mimetype === 'application/pdf' || ext === '.pdf') {
    return [
      { text: `${label} (Scanned PDF — read all visible questions, marks, headings, and year metadata)` },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: file.buffer.toString('base64'),
        },
      },
    ];
  }

  if (
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/webp' ||
    ext === '.jpg' ||
    ext === '.jpeg' ||
    ext === '.png' ||
    ext === '.webp'
  ) {
    let mimeType = file.mimetype;
    if (!mimeType || mimeType === 'application/octet-stream' || mimeType === 'image/jpg') {
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else mimeType = 'image/jpeg';
    }
    return [
      { text: `${label} (Scanned Image — OCR all questions, marks, headings, and year metadata)` },
      {
        inlineData: {
          mimeType,
          data: file.buffer.toString('base64'),
        },
      },
    ];
  }

  if (
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    const extracted = await mammoth.extractRawText({ buffer: file.buffer });
    const rawText = compactExtractedText(extracted.value);
    if (!rawText) {
      return [{ text: `${label} (DOCX contained no extractable text)` }];
    }
    return [{ text: `${label} (DOCX Text)\n${rawText}` }];
  }

  if (file.mimetype === 'text/plain' || ext === '.txt' || ext === '.md') {
    const rawText = compactExtractedText(file.buffer.toString('utf-8'));
    return [{ text: `${label} (Plain Text)\n${rawText}` }];
  }

  const unsupportedError = new Error(
    `Unsupported file format for "${file.originalname}". Upload PDF, JPG, PNG, DOCX, or TXT files.`
  );
  (unsupportedError as Error & { statusCode?: number }).statusCode = 400;
  throw unsupportedError;
}

function isRetryableError(error: unknown): boolean {
  const errObj = error as { status?: number; statusCode?: number; message?: string };
  const status = errObj?.status ?? errObj?.statusCode;
  const msg = errObj?.message ?? '';

  if (status === 429 || status === 503 || status === 500 || status === 502 || status === 504) {
    return true;
  }
  if (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('overloaded') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('fetch failed')
  ) {
    return true;
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = MAX_RETRIES): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }
      // Exponential backoff: 1.5s, then 3s (+ small jitter)
      const baseDelay = 1500 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 400);
      await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
    }
  }
  throw lastError;
}

export type ApiErrorCode =
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'AUTH_ERROR'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR';

export interface FormattedApiError {
  status: number;
  code: ApiErrorCode;
  message: string;
  retryAfterSeconds?: number;
}

export function formatGeminiError(error: unknown, usedCustomKey = false): FormattedApiError {
  const errObj = error as { status?: number; statusCode?: number; message?: string };
  const rawMessage = errObj?.message || 'An unexpected error occurred while contacting Gemini.';
  const status = errObj?.status ?? errObj?.statusCode ?? 500;

  if (
    status === 429 ||
    rawMessage.includes('RESOURCE_EXHAUSTED') ||
    rawMessage.includes('429') ||
    rawMessage.toLowerCase().includes('quota')
  ) {
    const matchSeconds = rawMessage.match(/retry in (\d+(?:\.\d+)?)s/i);
    const retryAfterSeconds = matchSeconds ? Math.min(90, Math.max(15, Math.ceil(Number(matchSeconds[1])))) : 30;
    return {
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterSeconds,
      message: usedCustomKey
        ? 'Your custom Gemini API key has reached its rate limit. Wait for the countdown to retry or switch keys.'
        : 'The shared Gemini API quota is temporarily busy. Wait for the countdown to retry, or add your own Gemini API key in API Key Settings.',
    };
  }

  if (
    status === 503 ||
    rawMessage.includes('UNAVAILABLE') ||
    rawMessage.includes('503') ||
    rawMessage.toLowerCase().includes('overloaded')
  ) {
    return {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      retryAfterSeconds: 20,
      message:
        'Gemini is experiencing temporary high demand. Please wait a few seconds and try again.',
    };
  }

  if (
    status === 403 ||
    status === 401 ||
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('API_KEY_INVALID') ||
    rawMessage.toLowerCase().includes('api key')
  ) {
    return {
      status: 403,
      code: 'AUTH_ERROR',
      message: usedCustomKey
        ? 'Your custom Gemini API key appears invalid or lacks permission. Verify it in API Key Settings.'
        : 'Gemini API authentication failed. Check Settings > Secrets or add a fallback key in API Key Settings.',
    };
  }

  if (status === 400) {
    return {
      status: 400,
      code: 'BAD_REQUEST',
      message: rawMessage,
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    code: 'INTERNAL_ERROR',
    message: rawMessage,
  };
}

const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.OBJECT,
      properties: {
        subjectName: { type: Type.STRING },
        examTag: { type: Type.STRING },
        totalPapersAnalyzed: { type: Type.INTEGER },
        totalQuestionsExtracted: { type: Type.INTEGER },
        totalUniqueConcepts: { type: Type.INTEGER },
        highPriorityCount: { type: Type.INTEGER },
        keyInsight: { type: Type.STRING },
      },
      required: [
        'subjectName',
        'examTag',
        'totalPapersAnalyzed',
        'totalQuestionsExtracted',
        'totalUniqueConcepts',
        'highPriorityCount',
        'keyInsight',
      ],
    },
    importantQuestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          rank: { type: Type.INTEGER },
          questionText: { type: Type.STRING },
          topic: { type: Type.STRING },
          frequencyCount: { type: Type.INTEGER },
          appearedIn: { type: Type.ARRAY, items: { type: Type.STRING } },
          estimatedMarks: { type: Type.INTEGER },
          marksLabel: { type: Type.STRING },
          priority: { type: Type.STRING },
          variantExamples: { type: Type.ARRAY, items: { type: Type.STRING } },
          studyTip: { type: Type.STRING },
        },
        required: [
          'id',
          'rank',
          'questionText',
          'topic',
          'frequencyCount',
          'appearedIn',
          'estimatedMarks',
          'marksLabel',
          'priority',
          'variantExamples',
          'studyTip',
        ],
      },
    },
    topicWeightage: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          percentage: { type: Type.NUMBER },
          questionCount: { type: Type.INTEGER },
          totalMarks: { type: Type.INTEGER },
          highPriorityCount: { type: Type.INTEGER },
        },
        required: ['topic', 'percentage', 'questionCount', 'totalMarks', 'highPriorityCount'],
      },
    },
    predictedMockPaper: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        subtitle: { type: Type.STRING },
        durationMinutes: { type: Type.INTEGER },
        totalMarks: { type: Type.INTEGER },
        generalInstructions: { type: Type.ARRAY, items: { type: Type.STRING } },
        sections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sectionName: { type: Type.STRING },
              description: { type: Type.STRING },
              instructions: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    number: { type: Type.STRING },
                    questionText: { type: Type.STRING },
                    topic: { type: Type.STRING },
                    marks: { type: Type.INTEGER },
                    priority: { type: Type.STRING },
                    hint: { type: Type.STRING },
                  },
                  required: ['number', 'questionText', 'topic', 'marks', 'priority', 'hint'],
                },
              },
            },
            required: ['sectionName', 'description', 'instructions', 'questions'],
          },
        },
      },
      required: ['title', 'subtitle', 'durationMinutes', 'totalMarks', 'generalInstructions', 'sections'],
    },
  },
  required: ['summary', 'importantQuestions', 'topicWeightage', 'predictedMockPaper'],
};

export async function analyzePapersWithGemini(params: {
  files: UploadedPaperFile[];
  extractedTexts: ExtractedPaperText[];
  subjectName?: string;
  examTag?: string;
  customApiKey?: string;
}): Promise<AnalysisResult> {
  const ai = getAiClient(params.customApiKey);
  const { files, extractedTexts, subjectName, examTag } = params;

  const textParts: ContentPart[] = extractedTexts.map((item, idx) => {
    const cleanText = compactExtractedText(item.text);
    const pageMeta = item.pageCount ? `, ${item.pageCount} pages` : '';
    return {
      text: `--- PAPER ${idx + 1}: "${item.filename}" (${item.format.toUpperCase()} extracted text${pageMeta}) ---\n${cleanText}`,
    };
  });

  const binaryPartsNested = await Promise.all(
    files.map((file, idx) => convertFileToParts(file, extractedTexts.length + idx))
  );
  const binaryParts: ContentPart[] = binaryPartsNested.flat();

  const allFilenames = [
    ...extractedTexts.map((t) => t.filename),
    ...files.map((f) => f.originalname),
  ];
  const totalPapers = allFilenames.length;

  const promptText = [
    `Analyze all ${totalPapers} previous-year exam paper(s) in ONE comprehensive JSON response.`,
    subjectName?.trim() ? `Subject: "${subjectName.trim()}"` : 'Subject: Infer from papers.',
    examTag?.trim() ? `Exam/University: "${examTag.trim()}"` : 'Exam/University: Infer from papers.',
    `Papers: ${allFilenames.join(', ')}`,
    'Rules:',
    '1. Extract all questions across every paper and semantically merge questions testing the same concept even if worded differently.',
    '2. Rank importantQuestions by frequency, marks, and syllabus weight. Priority must be "High", "Medium", or "Low". Include exact years/papers in appearedIn, up to 2 short variantExamples when merged, and a 1-sentence studyTip.',
    '3. Compute topicWeightage using identical normalized topic names; percentages must sum to 100.',
    '4. Build 1 realistic predictedMockPaper (2-3 sections) weighted toward the highest-priority topics.',
    '5. Be concise and accurate.',
  ].join('\n');

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [...textParts, ...binaryParts, { text: promptText }],
      },
      config: {
        systemInstruction:
          'You are an academic exam analyst specializing in Previous Year Question (PYQ) pattern analysis. Semantically deduplicate repeated questions across years, calculate exact topic weightage, and synthesize a realistic predicted mock paper in one concise, strictly valid JSON response.',
        responseMimeType: 'application/json',
        responseSchema: analysisResponseSchema,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    })
  );

  const rawJson = (response.text ?? '').trim();
  if (!rawJson) {
    throw new Error('Gemini returned an empty response. Please try again with clearer exam files.');
  }

  const parsed = JSON.parse(rawJson) as Omit<AnalysisResult, 'id' | 'createdAt' | 'sourceFiles'>;

  const normalizedQuestions = (parsed.importantQuestions || []).map((q, index) => {
    const normalizedPriority =
      q.priority === 'High' || q.priority === 'Medium' || q.priority === 'Low'
        ? q.priority
        : 'Medium';
    return {
      ...q,
      id: q.id || `q-${index + 1}`,
      rank: index + 1,
      priority: normalizedPriority,
      frequencyCount: Math.max(1, Number(q.frequencyCount) || 1),
      estimatedMarks: Math.max(1, Number(q.estimatedMarks) || 5),
      appearedIn:
        Array.isArray(q.appearedIn) && q.appearedIn.length > 0
          ? q.appearedIn
          : [allFilenames[0] ?? 'Uploaded Paper'],
      variantExamples: Array.isArray(q.variantExamples) ? q.variantExamples : [],
    };
  });

  const normalizedWeightage = (parsed.topicWeightage || [])
    .map((item) => ({
      ...item,
      percentage: Math.max(0, Math.round(Number(item.percentage) * 10) / 10),
      questionCount: Math.max(0, Number(item.questionCount) || 0),
      totalMarks: Math.max(0, Number(item.totalMarks) || 0),
      highPriorityCount: Math.max(0, Number(item.highPriorityCount) || 0),
    }))
    .sort((a, b) => b.percentage - a.percentage);

  const highCount = normalizedQuestions.filter((q) => q.priority === 'High').length;

  return {
    id: `analysis-${Date.now()}`,
    createdAt: new Date().toISOString(),
    sourceFiles: allFilenames,
    summary: {
      subjectName: subjectName?.trim() || parsed.summary?.subjectName || 'Analyzed Subject',
      examTag: examTag?.trim() || parsed.summary?.examTag || 'Previous Years Examination',
      totalPapersAnalyzed: totalPapers,
      totalQuestionsExtracted: Math.max(
        normalizedQuestions.length,
        Number(parsed.summary?.totalQuestionsExtracted) || normalizedQuestions.length
      ),
      totalUniqueConcepts: normalizedQuestions.length,
      highPriorityCount: highCount,
      keyInsight:
        parsed.summary?.keyInsight ||
        'Focus revision on the top recurring concepts that represent the highest share of exam marks.',
    },
    importantQuestions: normalizedQuestions,
    topicWeightage: normalizedWeightage,
    predictedMockPaper: parsed.predictedMockPaper,
  };
}

const modelAnswerSchema = {
  type: Type.OBJECT,
  properties: {
    directAnswer: { type: Type.STRING },
    keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    formulaOrDiagramNote: { type: Type.STRING },
    markingSchemeBreakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          point: { type: Type.STRING },
          marks: { type: Type.STRING },
        },
        required: ['point', 'marks'],
      },
    },
    commonMistakeToAvoid: { type: Type.STRING },
  },
  required: [
    'directAnswer',
    'keyPoints',
    'formulaOrDiagramNote',
    'markingSchemeBreakdown',
    'commonMistakeToAvoid',
  ],
};

export async function generateModelAnswerWithGemini(params: {
  questionText: string;
  topic: string;
  estimatedMarks: number;
  subjectName?: string;
  examTag?: string;
  appearedIn?: string[];
  customApiKey?: string;
}): Promise<ModelAnswer> {
  const ai = getAiClient(params.customApiKey);

  const prompt = [
    `Subject: ${params.subjectName || 'University Course'}`,
    `Exam: ${params.examTag || 'University Examination'}`,
    `Topic: ${params.topic} | Weightage: ${params.estimatedMarks} Marks`,
    params.appearedIn && params.appearedIn.length > 0
      ? `Appeared in: ${params.appearedIn.join(', ')}`
      : '',
    `Question: ${params.questionText}`,
    'Provide a concise, high-scoring, exam-ready model answer calibrated to the marks.',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction:
          'You are an experienced university examiner writing concise, high-scoring model answer keys. Prioritize clarity, precise terminology, structured scoring points, and realistic mark allocation.',
        responseMimeType: 'application/json',
        responseSchema: modelAnswerSchema,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
      },
    })
  );

  const rawJson = (response.text ?? '').trim();
  if (!rawJson) {
    throw new Error('Could not generate a model answer. Please try again.');
  }

  return JSON.parse(rawJson) as ModelAnswer;
}
