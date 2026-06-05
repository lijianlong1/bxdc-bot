'use strict';
/**
 * Reads skills-export.csv (from H2 CSVWRITE) and writes src/main/resources/data.sql
 * using INSERT..WHERE NOT EXISTS + UPDATE (idempotent, safe for spring.sql.init.mode=always).
 *
 * Usage: export DB to skills-export.csv, then: node scripts/csv-to-merge.cjs
 */
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'skills-export.csv');
const outPath = path.join(__dirname, '..', 'src', 'main', 'resources', 'data.sql');

const text = fs.readFileSync(csvPath, 'utf8');
const lines = text.split(/\r?\n/).filter(Boolean);

function parseCsvLine(line) {
  const cols = [];
  let cur = '';
  let inQ = false;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (c === '"') {
      if (inQ && line[j + 1] === '"') {
        cur += '"';
        j++;
        continue;
      }
      inQ = !inQ;
      continue;
    }
    if (c === ',' && !inQ) {
      cols.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  cols.push(cur);
  return cols;
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

let out = '';
out += `-- skill-gateway: schema is created by Hibernate (ddl-auto=update), then this script runs (defer-datasource-initialization).
-- Full skill seed: INSERT when missing, UPDATE to match repo (idempotent). Regenerate from DB: export skills to skills-export.csv, run node scripts/csv-to-merge.cjs

-- Migration: legacy rows missing execution_mode
UPDATE skills
SET execution_mode = 'CONFIG',
    updated_at = CURRENT_TIMESTAMP
WHERE (execution_mode IS NULL OR TRIM(execution_mode) = '')
  AND UPPER(type) = 'EXTENSION';

`;

for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  if (cols.length < 10) continue;
  const [, name, desc, type, exec, cfg, en, req] = cols;
  const n = esc(name);
  const d = esc(desc);
  const t = esc(type);
  const e = esc(exec);
  const c = esc(cfg);
  out += `INSERT INTO skills (
    name,
    description,
    type,
    execution_mode,
    configuration,
    enabled,
    requires_confirmation,
    created_at,
    updated_at
)
SELECT
    '${n}',
    '${d}',
    '${t}',
    '${e}',
    '${c}',
    ${en},
    ${req},
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM skills WHERE name = '${n}'
);

UPDATE skills
SET description = '${d}',
    type = '${t}',
    execution_mode = '${e}',
    configuration = '${c}',
    enabled = ${en},
    requires_confirmation = ${req},
    updated_at = CURRENT_TIMESTAMP
WHERE name = '${n}';

`;
}

fs.writeFileSync(outPath, out);
console.log('Wrote', outPath, 'skills:', lines.length - 1);
