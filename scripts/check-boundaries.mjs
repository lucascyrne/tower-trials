import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, 'src');
const violations = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next') {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const relativePath = path.relative(projectRoot, fullPath);

    if (content.includes('NEXT_PUBLIC_SERVICE_ROLE')) {
      violations.push(
        `${relativePath}: found deprecated NEXT_PUBLIC_SERVICE_ROLE reference`
      );
    }

    const isClientComponent =
      content.includes("'use client'") || content.includes('"use client"');

    if (
      isClientComponent &&
      (content.includes("@/utils/supabase/admin") ||
        content.includes('getSupabaseAdminClient'))
    ) {
      violations.push(
        `${relativePath}: client component importing privileged Supabase admin boundary`
      );
    }
  }
}

walk(srcRoot);

if (violations.length > 0) {
  console.error('Architecture boundary violations found:');
  violations.forEach(v => console.error(`- ${v}`));
  process.exit(1);
}

console.log('Boundary check passed.');
