import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import mammoth from 'mammoth';
import type { AnalysisResult, ModelAnswer } from '../src/types.ts';

const MODEL_NAME = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'Gemini API key is not configured. Please verify your key in the Settings > Secrets panel.'
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

async function convertFileToParts(file: UploadedPaperFile, index: number): Promise<ContentPart[]> {
  const ext = getExtension(file.originalname);
  const label = `--- FILE ${index + 1}: "${file.originalname}" ---`;

  if (file.mimetype === 'application/pdf' || ext === '.pdf') {
    return [
      { text: `${label} (PDF Document)` },
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
      { text: `${label} (Scanned Exam Paper Image — read all visible questions, marks, headings, and year metadata carefully)` },
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
    const rawText = extracted.value.trim();
    if (!rawText) {
      return [
        {
          text: `${label} (DOCX file appeared to contain no extractable text)`,
        },
      ];
    }
    return [{ text: `${label} (DOCX Content)\n${rawText}` }];
  }

  if (file.mimetype === 'text/plain' || ext === '.txt' || ext === '.md') {
    const rawText = file.buffer.toString('utf-8').trim();
    return [{ text: `${label} (Text Content)\n${rawText}` }];
  }

  const unsupportedError = new Error(
    `Unsupported file format for "${file.originalname}". Please upload PDF, JPG, PNG, DOCX, or TXT files.`
  );
  (unsupportedError as Error & { statusCode?: number }).statusCode = 400;
  throw unsupportedError;
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status =
        (error as { status?: number; statusCode?: number })?.status ??
        (error as { status?: number; statusCode?: number })?.statusCode;
      // Do not retry client auth/validation errors
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw error;
      }
      if (attempt < maxAttempts) {
        const delayMs = 800 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

export function formatGeminiError(error: unknown): { status: number; message: string } {
  const errObj = error as { status?: number; statusCode?: number; message?: string };
  const rawMessage = errObj?.message || 'An unexpected error occurred while contacting Gemini.';
  const status = errObj?.status ?? errObj?.statusCode ?? 500;

  if (
    status === 403 ||
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('API_KEY_INVALID') ||
    rawMessage.includes('API key')
  ) {
    return {
      status: 403,
      message:
        'Gemini API authentication failed. Please check your API key in the Settings > Secrets panel.',
    };
  }

  if (status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        'Gemini API rate limit or quota reached. Please wait a moment and try again, or check your quota in Settings > Secrets.',
    };
  }

  if (status === 400) {
    return {
      status: 400,
      message: rawMessage,
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: rawMessage,
  };
}

const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.OBJECT,
      properties: {
        subjectName: {
          type: Type.STRING,
          description: 'Detected or provided subject name.',
        },
        examTag: {
          type: Type.STRING,
          description: 'Detected or provided exam/university/semester label.',
        },
        totalPapersAnalyzed: {
          type: Type.INTEGER,
          description: 'Count of exam papers analyzed.',
        },
        totalQuestionsExtracted: {
          type: Type.INTEGER,
          description: 'Total individual questions found across all uploaded papers before grouping.',
        },
        totalUniqueConcepts: {
          type: Type.INTEGER,
          description: 'Number of distinct semantically grouped questions returned.',
        },
        highPriorityCount: {
          type: Type.INTEGER,
          description: 'Count of questions marked High priority.',
        },
        keyInsight: {
          type: Type.STRING,
          description: 'A sharp 1-2 sentence exam strategy takeaway summarizing the strongest recurring patterns across these papers.',
        },
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
      description: 'Ranked list of unique questions grouped by semantic meaning, ordered from highest to lowest exam importance.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: 'Unique short slug id such as q-1, q-2.',
          },
          rank: {
            type: Type.INTEGER,
            description: '1-based importance rank.',
          },
          questionText: {
            type: Type.STRING,
            description: 'Clear canonical phrasing of the question representing this recurring concept.',
          },
          topic: {
            type: Type.STRING,
            description: 'Concise chapter, unit, or topic name (consistent across topicWeightage).',
          },
          frequencyCount: {
            type: Type.INTEGER,
            description: 'How many times this concept appeared across the uploaded papers.',
          },
          appearedIn: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Exact years or paper names where this question appeared (e.g., "May 2023", "Dec 2022", or filename if year is absent).',
          },
          estimatedMarks: {
            type: Type.INTEGER,
            description: 'Typical integer marks value (e.g., 2, 5, 8, 10).',
          },
          marksLabel: {
            type: Type.STRING,
            description: 'Formatted marks label such as "10 Marks" or "5–8 Marks".',
          },
          priority: {
            type: Type.STRING,
            description: 'Must be exactly one of: High, Medium, Low.',
          },
          variantExamples: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Up to 3 short examples of alternate wordings found in the source papers if grouped from multiple appearances.',
          },
          studyTip: {
            type: Type.STRING,
            description: 'One concise sentence explaining what the examiner tests and how to score full marks on this question.',
          },
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
      description: 'Breakdown of chapters/topics by percentage of total questions. Percentages should sum to 100.',
      items: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          percentage: {
            type: Type.NUMBER,
            description: 'Percentage of total questions (0 to 100, rounded to 1 decimal or whole number).',
          },
          questionCount: { type: Type.INTEGER },
          totalMarks: { type: Type.INTEGER },
          highPriorityCount: { type: Type.INTEGER },
        },
        required: ['topic', 'percentage', 'questionCount', 'totalMarks', 'highPriorityCount'],
      },
    },
    predictedMockPaper: {
      type: Type.OBJECT,
      description: 'A realistic 1-paper practice exam built from the highest-priority topics and patterns observed.',
      properties: {
        title: { type: Type.STRING },
        subtitle: { type: Type.STRING },
        durationMinutes: { type: Type.INTEGER },
        totalMarks: { type: Type.INTEGER },
        generalInstructions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
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
  subjectName?: string;
  examTag?: string;
}): Promise<AnalysisResult> {
  const ai = getAiClient();
  const { files, subjectName, examTag } = params;

  const filePartsNested = await Promise.all(files.map((file, idx) => convertFileToParts(file, idx)));
  const fileParts: ContentPart[] = filePartsNested.flat();

  const fileManifest = files.map((f, idx) => `${idx + 1}. ${f.originalname}`).join('\n');

  const promptText = [
    `Analyze all ${files.length} uploaded previous-year exam question paper(s) together.`,
    subjectName?.trim() ? `User-provided Subject Name: "${subjectName.trim()}"` : 'User-provided Subject Name: Not provided (infer accurately from the papers).',
    examTag?.trim() ? `User-provided Exam / University Tag: "${examTag.trim()}"` : 'User-provided Exam / University Tag: Not provided (infer accurately from the papers, or use "University Examination" if unclear).',
    `Uploaded File Manifest:\n${fileManifest}`,
    '',
    'Instructions:',
    '1. Extract every exam question from every uploaded paper (including PDFs, scanned images, DOCX, and TXT).',
    '2. Semantically group questions that test the same underlying concept, theorem, derivation, algorithm, or problem type—even when phrased differently across years. Combine their frequency counts and list the exact year/paper labels in `appearedIn` (extract year/session from the paper header or filename).',
    '3. Rank the grouped questions from most important to least important based on frequency across papers, mark weightage, and foundational syllabus importance.',
    '4. Assign `priority` strictly as "High", "Medium", or "Low". Use a realistic distribution: recurring or high-mark core questions are "High", moderate/occasionally tested concepts are "Medium", and one-off minor/short questions are "Low".',
    '5. Normalize topic/unit names so `importantQuestions[].topic` matches `topicWeightage[].topic` cleanly. Ensure `topicWeightage` percentages are accurate and sum to 100.',
    '6. Generate a complete, authentic `predictedMockPaper` modeled on the mark distribution and style of the uploaded papers, prioritizing the highest-weightage topics and most probable recurring concepts. Include 2–3 clear sections (e.g., Section A: Short Answer, Section B: Analytical / Medium, Section C: Long / Applied) with realistic marks totaling the typical exam total.',
    '7. Keep all wording crisp, scholarly, and directly faithful to the uploaded papers.',
  ].join('\n');

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [...fileParts, { text: promptText }],
      },
      config: {
        systemInstruction:
          'You are an expert academic exam analyst and senior university professor specializing in Previous Year Question (PYQ) pattern analysis. You carefully read multi-format exam papers (PDFs, scanned photos, Word documents, and text files), perform accurate semantic deduplication across years, calculate exact topic weightage, and build realistic predicted mock exam papers. Always return strictly valid JSON conforming to the provided schema.',
        responseMimeType: 'application/json',
        responseSchema: analysisResponseSchema,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MEDIUM,
        },
      },
    })
  );

  const rawJson = (response.text ?? '').trim();
  if (!rawJson) {
    throw new Error('Gemini returned an empty response. Please try again with clearer exam files.');
  }

  const parsed = JSON.parse(rawJson) as Omit<AnalysisResult, 'id' | 'createdAt' | 'sourceFiles'>;

  // Normalize priority values and sort ranks defensively
  const normalizedQuestions = (parsed.importantQuestions || [])
    .map((q, index) => {
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
        appearedIn: Array.isArray(q.appearedIn) && q.appearedIn.length > 0 ? q.appearedIn : [files[0]?.originalname ?? 'Uploaded Paper'],
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
    sourceFiles: files.map((f) => f.originalname),
    summary: {
      subjectName: subjectName?.trim() || parsed.summary?.subjectName || 'Analyzed Subject',
      examTag: examTag?.trim() || parsed.summary?.examTag || 'Previous Years Examination',
      totalPapersAnalyzed: files.length,
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
    directAnswer: {
      type: Type.STRING,
      description: 'Concise, well-structured, exam-ready explanation directly answering the question at the appropriate depth for the marks weightage.',
    },
    keyPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '4 to 6 crisp, high-scoring bullet points an examiner checks off while grading.',
    },
    formulaOrDiagramNote: {
      type: Type.STRING,
      description: 'Key equation, theorem, algorithm steps, or labeled diagram to sketch in the exam booklet. Empty string if not applicable.',
    },
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
      description: 'How marks are typically distributed across parts of the answer.',
    },
    commonMistakeToAvoid: {
      type: Type.STRING,
      description: 'One brief, practical warning about a frequent mistake students make on this question.',
    },
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
}): Promise<ModelAnswer> {
  const ai = getAiClient();

  const prompt = [
    `Subject: ${params.subjectName || 'University Course'}`,
    `Exam Context: ${params.examTag || 'University Examination'}`,
    `Topic / Unit: ${params.topic}`,
    `Estimated Weightage: ${params.estimatedMarks} Marks`,
    params.appearedIn && params.appearedIn.length > 0
      ? `Previously Appeared In: ${params.appearedIn.join(', ')}`
      : '',
    '',
    `Question: ${params.questionText}`,
    '',
    'Write a concise, exam-ready model answer that a student can study and reproduce under timed exam conditions to earn full marks. Calibrate length and detail appropriately to the estimated marks.',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction:
          'You are an experienced university examiner writing concise, high-scoring model answer keys. Prioritize clarity, precise technical terminology, structured points, and realistic mark allocation. Avoid fluff.',
        responseMimeType: 'application/json',
        responseSchema: modelAnswerSchema,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
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
