/**
 * Validates all committed static data files against their Zod schemas.
 * Run via `pnpm --filter etl run validate`.
 * Exits with code 1 if any record fails validation.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApplianceSchema, TariffPresetSchema, RegionSchema } from '@energysaver/schema';
import type { ZodTypeAny } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../data');

function loadJson(filename: string): unknown[] {
  const raw = readFileSync(resolve(DATA_DIR, filename), 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`${filename} must be a JSON array`);
  return parsed;
}

function validateFile<T>(
  filename: string,
  schema: ZodTypeAny,
  threshold = 0.01,
): { valid: T[]; skipped: number } {
  const records = loadJson(filename);
  const valid: T[] = [];
  let skipped = 0;

  for (const record of records) {
    const result = schema.safeParse(record);
    if (result.success) {
      valid.push(result.data as T);
    } else {
      // ponytail: log the id field if present to make errors actionable
      const id = typeof record === 'object' && record !== null && 'id' in record
        ? String((record as Record<string, unknown>)['id'])
        : JSON.stringify(record).slice(0, 60);
      console.error(`[SKIP] ${filename} → ${id}: ${result.error.message}`);
      skipped++;
    }
  }

  const skipRate = records.length > 0 ? skipped / records.length : 0;
  if (skipRate > threshold) {
    throw new Error(
      `${filename}: ${skipped}/${records.length} records invalid (${(skipRate * 100).toFixed(1)}%) — exceeds ${threshold * 100}% threshold`,
    );
  }

  return { valid, skipped };
}

const results = [
  validateFile(
    'appliances.json',
    ApplianceSchema,
  ),
  validateFile(
    'tariffs.json',
    TariffPresetSchema,
  ),
  validateFile(
    'regions.json',
    RegionSchema,
  ),
];

const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
const totalValid = results.reduce((sum, r) => sum + r.valid.length, 0);

console.log(`Validation complete: ${totalValid} valid, ${totalSkipped} skipped.`);
if (totalSkipped > 0) {
  console.warn(`Warning: ${totalSkipped} records skipped. Review errors above.`);
  process.exit(1);
}
