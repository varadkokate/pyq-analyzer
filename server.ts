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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.docx', '.txt', '.md']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 20,
    fileSize: 25 * 1024 * 1024, // 25 MB per file
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

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/analyze', upload.array('files', 20), async (req: Request, res: Response) => {
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) {
        res.status(400).json({ error: 'Please upload at least one exam question paper file.' });
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
        subjectName,
        examTag,
      });

      res.json(result);
    } catch (error) {
      console.error('[POST /api/analyze] Error:', error);
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/model-answer', async (req: Request, res: Response) => {
    try {
      const { questionText, topic, estimatedMarks, subjectName, examTag, appearedIn } =
        req.body ?? {};

      if (typeof questionText !== 'string' || !questionText.trim()) {
        res.status(400).json({ error: 'questionText is required to generate a model answer.' });
        return;
      }

      const answer = await generateModelAnswerWithGemini({
        questionText: questionText.trim(),
        topic: typeof topic === 'string' && topic.trim() ? topic.trim() : 'General',
        estimatedMarks: Number(estimatedMarks) || 5,
        subjectName: typeof subjectName === 'string' ? subjectName : undefined,
        examTag: typeof examTag === 'string' ? examTag : undefined,
        appearedIn: Array.isArray(appearedIn) ? appearedIn : undefined,
      });

      res.json(answer);
    } catch (error) {
      console.error('[POST /api/model-answer] Error:', error);
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Multer and JSON error middleware for /api routes
  app.use('/api', (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'Each file must be 25 MB or smaller.' });
        return;
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        res.status(400).json({ error: 'You can upload up to 20 files per analysis.' });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }

    res.status(400).json({ error: err.message || 'Invalid request.' });
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
