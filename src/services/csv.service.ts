import Papa from 'papaparse';
import { inArray } from 'drizzle-orm';
import { db } from '../db';
import { chapters, questions, questionTranslations, questionOptions } from '../db/schema';
import {
  checkDuplicate,
  type CreateQuestionInput,
  type Difficulty,
  type QuestionStatus,
  type OptionKey,
} from './question.service';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CSVRowError {
  row: number;
  raw: string;
  reason: string;
}

export interface BulkImportResult {
  total: number;
  inserted: number;
  skipped: number;
  errors: CSVRowError[];
}

// ─── CSV parser (PapaParse) ───────────────────────────────────────────────────

function parseCSV(buffer: Buffer): { headers: string[]; rows: Record<string, string>[] } {
  const text = buffer.toString('utf8');

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.toLowerCase().trim(),
  });

  // PapaParse structural errors (e.g. mismatched column counts) — log but continue
  if (result.errors.length > 0) {
    logger.warn('PapaParse reported errors', { errors: result.errors.slice(0, 5) });
  }

  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
  };
}

// ─── Expected CSV columns ─────────────────────────────────────────────────────
/*
  Required : chapterId, questionEn, optionAEn, optionBEn, optionCEn, optionDEn, correctOption
  Optional : questionBn, explanationEn, explanationBn, difficulty, points, status,
             category, tags, optionABn, optionBBn, optionCBn, optionDBn, imageUrl
*/

const REQUIRED_COLUMNS = [
  'chapterid', 'questionen',
  'optionaen', 'optionben', 'optioncen', 'optionden',
  'correctoption',
];

// ─── Row validator ────────────────────────────────────────────────────────────

function validateRow(
  row: Record<string, string>,
  rowNum: number,
  validChapterIds: Set<number>,
  seenInBatch: Set<string>,
): { data: CreateQuestionInput } | { error: string } {
  const get = (key: string) => (row[key] ?? '').trim();

  // chapterId
  const chapterIdRaw = get('chapterid');
  const chapterId = parseInt(chapterIdRaw, 10);
  if (!chapterIdRaw || isNaN(chapterId) || chapterId <= 0) {
    return { error: 'chapterId is required and must be a positive integer' };
  }
  if (!validChapterIds.has(chapterId)) {
    return { error: `chapterId ${chapterId} does not exist` };
  }

  // questionEn
  const questionEn = get('questionen');
  if (!questionEn) return { error: 'questionEn is required' };

  // In-batch duplicate guard
  const dedupKey = `${chapterId}::${questionEn.toLowerCase()}`;
  if (seenInBatch.has(dedupKey)) {
    return { error: 'Duplicate question within this CSV batch' };
  }

  // difficulty
  const difficultyRaw = get('difficulty').toLowerCase() || 'medium';
  if (!['easy', 'medium', 'hard'].includes(difficultyRaw)) {
    return { error: `Invalid difficulty "${difficultyRaw}". Must be easy, medium, or hard` };
  }

  // points
  const pointsRaw = get('points');
  const points = pointsRaw ? parseInt(pointsRaw, 10) : 10;
  if (isNaN(points) || points <= 0 || points > 1000) {
    return { error: 'points must be a positive integer (1-1000)' };
  }

  // status
  const statusRaw = get('status').toLowerCase() || 'draft';
  if (!['draft', 'published', 'archived'].includes(statusRaw)) {
    return { error: `Invalid status "${statusRaw}". Must be draft, published, or archived` };
  }

  // options
  const optionAEn = get('optionaen');
  const optionBEn = get('optionben');
  const optionCEn = get('optioncen');
  const optionDEn = get('optionden');
  if (!optionAEn || !optionBEn || !optionCEn || !optionDEn) {
    return { error: 'All four option English texts (optionAEn–optionDEn) are required' };
  }

  // correctOption
  const correctOption = get('correctoption').toUpperCase();
  if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
    return { error: `Invalid correctOption "${correctOption}". Must be A, B, C, or D` };
  }

  // tags: comma-separated inside the cell
  const tagsRaw = get('tags');
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];

  const translations: CreateQuestionInput['translations'] = [
    { language: 'en', text: questionEn, explanation: get('explanationen') || null },
  ];
  const questionBn = get('questionbn');
  if (questionBn) {
    translations.push({ language: 'bn', text: questionBn, explanation: get('explanationbn') || null });
  }

  const optionKeys: OptionKey[] = ['A', 'B', 'C', 'D'];
  const optionEnValues = [optionAEn, optionBEn, optionCEn, optionDEn];
  const optionBnKeys = ['optionabn', 'optionbbn', 'optioncbn', 'optiondbn'];

  const options: CreateQuestionInput['options'] = optionKeys.map((key, i) => ({
    optionKey: key,
    textEn: optionEnValues[i],
    textBn: get(optionBnKeys[i]) || null,
    isCorrect: key === correctOption,
    imageUrl: null,
    order: i + 1,
  }));

  seenInBatch.add(dedupKey);

  return {
    data: {
      chapterId,
      difficulty: difficultyRaw as Difficulty,
      points,
      status: statusRaw as QuestionStatus,
      category: get('category') || null,
      tags,
      imageUrl: get('imageurl') || null,
      translations,
      options,
    },
  };
}

// ─── Bulk import ──────────────────────────────────────────────────────────────

export async function bulkImportFromCSV(buffer: Buffer): Promise<BulkImportResult> {
  const { headers, rows } = parseCSV(buffer);

  logger.info('Starting CSV bulk import', { rowCount: rows.length });

  if (rows.length === 0) {
    return { total: 0, inserted: 0, skipped: 0, errors: [] };
  }

  // Validate all required columns are present
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missingColumns.length > 0) {
    throw new Error(`CSV is missing required columns: ${missingColumns.join(', ')}`);
  }

  // Pre-fetch all chapter IDs referenced in the CSV in a single query
  const chapterIdsInCSV = new Set<number>();
  rows.forEach((row) => {
    const id = parseInt((row['chapterid'] ?? '').trim(), 10);
    if (!isNaN(id)) chapterIdsInCSV.add(id);
  });

  const existingChapters = await db
    .select({ id: chapters.id })
    .from(chapters)
    .where(inArray(chapters.id, [...chapterIdsInCSV]));
  const validChapterIds = new Set(existingChapters.map((c) => c.id));

  // Validate rows, collect valid inputs and error report
  const validRows: CreateQuestionInput[] = [];
  const errors: CSVRowError[] = [];
  const seenInBatch = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // 1-based + header row offset
    const row = rows[i];
    const result = validateRow(row, rowNum, validChapterIds, seenInBatch);

    if ('error' in result) {
      errors.push({ row: rowNum, raw: JSON.stringify(row), reason: result.error });
      continue;
    }

    // DB-level duplicate check
    const duplicateId = await checkDuplicate(result.data.chapterId, result.data.translations[0].text);
    if (duplicateId !== null) {
      errors.push({
        row: rowNum,
        raw: JSON.stringify(row),
        reason: `Duplicate: matches existing question ID ${duplicateId} in chapter ${result.data.chapterId}`,
      });
      continue;
    }

    validRows.push(result.data);
  }

  // Insert all valid rows inside a single transaction
  let inserted = 0;
  if (validRows.length > 0) {
    await db.transaction(async (tx) => {
      for (const questionData of validRows) {
        const [q] = await tx
          .insert(questions)
          .values({
            chapterId: questionData.chapterId,
            difficulty: questionData.difficulty,
            points: questionData.points,
            status: questionData.status,
            category: questionData.category ?? null,
            tags: questionData.tags,
            imageUrl: questionData.imageUrl ?? null,
          })
          .returning();

        await tx.insert(questionTranslations).values(
          questionData.translations.map((t) => ({
            questionId: q.id,
            language: t.language,
            text: t.text,
            explanation: t.explanation ?? null,
          })),
        );

        await tx.insert(questionOptions).values(
          questionData.options.map((o) => ({
            questionId: q.id,
            optionKey: o.optionKey,
            textEn: o.textEn,
            textBn: o.textBn ?? null,
            isCorrect: o.isCorrect,
            imageUrl: o.imageUrl ?? null,
            order: o.order,
          })),
        );

        inserted++;
      }
    });
  }

  const skipped = rows.length - inserted - errors.length;

  logger.info('CSV bulk import complete', {
    total: rows.length,
    inserted,
    skipped,
    errorCount: errors.length,
  });

  return { total: rows.length, inserted, skipped, errors };
}
