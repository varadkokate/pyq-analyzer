import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzePapersWithGemini,
  formatGeminiError,
  generateModelAnswerWithGemini,
} from './server/gemini.ts';
import type { ExtractedPaperText } from './server/gemini.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // 15 MB total limit
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.docx', '.txt', '.md']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_FILES,
    fileSize: MAX_TOTAL_BYTES,
    fieldSize: MAX_TOTAL_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file "${file.originalname}". Accepted formats: PDF, JPG, PNG, DOCX, TXT.`
        )
      );
    }
  },
});

function readCustomApiKey(req: Request): string | undefined {
  const headerVal = req.headers['x-gemini-api-key'];
  if (typeof headerVal === 'string' && headerVal.trim().length > 0) {
    return headerVal.trim();
  }
  return undefined;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/analyze', upload.array('files', MAX_FILES), async (req: Request, res: Response) => {
    const customApiKey = readCustomApiKey(req);
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      let extractedTexts: ExtractedPaperText[] = [];

      if (typeof req.body?.extractedTexts === 'string' && req.body.extractedTexts.trim()) {
        try {
          const parsed = JSON.parse(req.body.extractedTexts);
          if (Array.isArray(parsed)) {
            extractedTexts = parsed
              .filter(
                (item): item is ExtractedPaperText =>
                  Boolean(item) &&
                  typeof item.filename === 'string' &&
                  typeof item.text === 'string' &&
                  item.text.trim().length > 0
              )
              .map((item) => ({
                filename: item.filename,
                format: typeof item.format === 'string' ? item.format : 'txt',
                text: item.text,
                pageCount: typeof item.pageCount === 'number' ? item.pageCount : undefined,
              }));
          }
        } catch {
          res.status(400).json({
            code: 'BAD_REQUEST',
            error: 'Invalid extractedTexts payload format.',
          });
          return;
        }
      }

      const totalPaperCount = files.length + extractedTexts.length;
      if (totalPaperCount === 0) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          error: 'Please upload at least one exam question paper file.',
        });
        return;
      }

      if (totalPaperCount > MAX_FILES) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          error: `Upload limit exceeded: maximum ${MAX_FILES} files allowed per analysis.`,
        });
        return;
      }

      const binaryBytes = files.reduce((sum, f) => sum + f.size, 0);
      const textBytes = extractedTexts.reduce((sum, t) => sum + Buffer.byteLength(t.text, 'utf8'), 0);
      if (binaryBytes + textBytes > MAX_TOTAL_BYTES) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          error: 'Total upload size exceeds the 15 MB limit. Please remove or compress large files.',
        });
        return;
      }

      const subjectName = typeof req.body?.subjectName === 'string' ? req.body.subjectName : '';
      const examTag = typeof req.body?.examTag === 'string' ? req.body.examTag : '';

      const result = await analyzePapersWithGemini({
        files: files.map((file) => ({
          originalname: file.originalname,
          mimetype: file.mimetype,
          buffer: file.buffer,
          size: file.size,
        })),
        extractedTexts,
        subjectName,
        examTag,
        customApiKey,
      });

      res.json(result);
    } catch (error) {
      console.error('[POST /api/analyze] Error:', error instanceof Error ? error.message : error);
      const formatted = formatGeminiError(error, Boolean(customApiKey));
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
        retryAfterSeconds: formatted.retryAfterSeconds,
      });
    }
  });

  app.post('/api/model-answer', async (req: Request, res: Response) => {
    const customApiKey = readCustomApiKey(req);
    try {
      const { questionText, topic, estimatedMarks, subjectName, examTag, appearedIn } =
        req.body ?? {};

      if (typeof questionText !== 'string' || !questionText.trim()) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          error: 'questionText is required to generate a model answer.',
        });
        return;
      }

      const answer = await generateModelAnswerWithGemini({
        questionText: questionText.trim(),
        topic: typeof topic === 'string' && topic.trim() ? topic.trim() : 'General',
        estimatedMarks: Number(estimatedMarks) || 5,
        subjectName: typeof subjectName === 'string' ? subjectName : undefined,
        examTag: typeof examTag === 'string' ? examTag : undefined,
        appearedIn: Array.isArray(appearedIn) ? appearedIn : undefined,
        customApiKey,
      });

      res.json(answer);
    } catch (error) {
      console.error('[POST /api/model-answer] Error:', error instanceof Error ? error.message : error);
      const formatted = formatGeminiError(error, Boolean(customApiKey));
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
        retryAfterSeconds: formatted.retryAfterSeconds,
      });
    }
  });

  // Multer and JSON error middleware for /api routes
  app.use('/api', (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          code: 'BAD_REQUEST',
          error: 'Upload exceeds the 15 MB size limit. Please upload smaller files.',
        });
        return;
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        res.status(400).json({
          code: 'BAD_REQUEST',
          error: `You can upload up to ${MAX_FILES} files per analysis.`,
        });
        return;
      }
      res.status(400).json({ code: 'BAD_REQUEST', error: err.message });
      return;
    }

    res.status(400).json({ code: 'BAD_REQUEST', error: err.message || 'Invalid request.' });
  });

  if (IS_PROD) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PYQ Analyzer server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start PYQ Analyzer server:', err);
  process.exit(1);
});
