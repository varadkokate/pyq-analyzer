export interface ExtractedTextPayload {
  filename: string;
  format: string;
  text: string;
  pageCount?: number;
}

export interface PreparedPaper {
  file: File;
  mode: 'text' | 'binary';
  reason: string;
  extracted?: ExtractedTextPayload;
}

export interface ExtractionBatchResult {
  prepared: PreparedPaper[];
  extractedTexts: ExtractedTextPayload[];
  binaryFiles: File[];
  savedBytesEstimate: number;
}

function getExt(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

function compactText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractPdfTextClientSide(
  file: File
): Promise<{ text: string; pageCount: number } | null> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const lines = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      if (lines.trim()) {
        pageTexts.push(`[Page ${pageNum}]\n${lines.trim()}`);
      }
    }

    const combined = compactText(pageTexts.join('\n\n'));
    const meaningfulChars = combined.replace(/\s+/g, '').length;

    // If very few selectable characters were found, treat as scanned PDF and let Gemini Vision read it
    if (meaningfulChars < 60) {
      return null;
    }

    return { text: combined, pageCount: pdf.numPages };
  } catch {
    return null;
  }
}

async function extractDocxTextClientSide(file: File): Promise<string | null> {
  try {
    const mammothModule = await import('mammoth');
    const mammoth = mammothModule.default ?? mammothModule;
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const cleaned = compactText(result.value || '');
    if (cleaned.replace(/\s+/g, '').length < 20) {
      return null;
    }
    return cleaned;
  } catch {
    return null;
  }
}

export async function preparePapersForUpload(files: File[]): Promise<ExtractionBatchResult> {
  const prepared: PreparedPaper[] = [];
  const extractedTexts: ExtractedTextPayload[] = [];
  const binaryFiles: File[] = [];
  let savedBytesEstimate = 0;

  for (const file of files) {
    const ext = getExt(file.name);

    // Plain text files
    if (ext === '.txt' || ext === '.md' || file.type === 'text/plain') {
      const raw = compactText(await file.text());
      if (raw.length > 0) {
        const extracted: ExtractedTextPayload = {
          filename: file.name,
          format: 'txt',
          text: raw,
        };
        extractedTexts.push(extracted);
        prepared.push({
          file,
          mode: 'text',
          reason: 'Plain text extracted locally',
          extracted,
        });
        continue;
      }
    }

    // DOCX files -> client-side mammoth extraction
    if (
      ext === '.docx' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const text = await extractDocxTextClientSide(file);
      if (text) {
        const extracted: ExtractedTextPayload = {
          filename: file.name,
          format: 'docx',
          text,
        };
        extractedTexts.push(extracted);
        savedBytesEstimate += Math.max(0, file.size - text.length);
        prepared.push({
          file,
          mode: 'text',
          reason: 'DOCX text extracted locally',
          extracted,
        });
        continue;
      }
    }

    // PDF files -> try client-side digital PDF extraction; fallback to binary for scanned PDFs
    if (ext === '.pdf' || file.type === 'application/pdf') {
      const pdfResult = await extractPdfTextClientSide(file);
      if (pdfResult) {
        const extracted: ExtractedTextPayload = {
          filename: file.name,
          format: 'pdf',
          text: pdfResult.text,
          pageCount: pdfResult.pageCount,
        };
        extractedTexts.push(extracted);
        savedBytesEstimate += Math.max(0, file.size - pdfResult.text.length);
        prepared.push({
          file,
          mode: 'text',
          reason: `Digital PDF (${pdfResult.pageCount}p) text extracted locally`,
          extracted,
        });
        continue;
      }

      binaryFiles.push(file);
      prepared.push({
        file,
        mode: 'binary',
        reason: 'Scanned PDF — sent directly for Vision OCR',
      });
      continue;
    }

    // Scanned images or fallback binary
    binaryFiles.push(file);
    prepared.push({
      file,
      mode: 'binary',
      reason: 'Scanned image — sent directly for Vision OCR',
    });
  }

  return {
    prepared,
    extractedTexts,
    binaryFiles,
    savedBytesEstimate,
  };
}

function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function computePapersFingerprint(params: {
  files: File[];
  subjectName: string;
  examTag: string;
  extractedTexts?: ExtractedTextPayload[];
}): Promise<string> {
  const sortedFiles = [...params.files]
    .sort((a, b) => a.name.localeCompare(b.name) || a.size - b.size)
    .map((f) => `${f.name.toLowerCase()}|${f.size}|${f.type}`);

  const extractedSnippets = (params.extractedTexts ?? [])
    .slice()
    .sort((a, b) => a.filename.localeCompare(b.filename))
    .map((t) => `${t.filename}:${t.text.length}:${fnv1aHash(t.text)}`);

  const canonical = JSON.stringify({
    v: 2,
    subject: params.subjectName.trim().toLowerCase(),
    exam: params.examTag.trim().toLowerCase(),
    files: sortedFiles,
    extracted: extractedSnippets,
  });

  try {
    if (window.crypto?.subtle) {
      const encoded = new TextEncoder().encode(canonical);
      const digest = await window.crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32);
    }
  } catch {
    // Fallback below
  }

  return `${fnv1aHash(canonical)}-${fnv1aHash(canonical.split('').reverse().join(''))}`;
}
