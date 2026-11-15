const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
if (!fs.existsSync(schemaPath)) process.exit(0);

let schema = fs.readFileSync(schemaPath, 'utf8');
const dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  'file:./dev.db';

const targetProvider =
  dbUrl.startsWith('postgresql:') || dbUrl.startsWith('postgres:')
    ? 'postgresql'
    : 'sqlite';

// Match datasource db provider explicitly (never modify generator client)
const datasourceRegex = /(datasource\s+db\s*\{[^}]*?provider\s*=\s*")([^"]+)(")/;
const currentMatch = schema.match(datasourceRegex);
const currentProvider = currentMatch ? currentMatch[2] : '';

if (currentProvider && currentProvider !== targetProvider) {
  schema = schema.replace(datasourceRegex, `$1${targetProvider}$3`);
  fs.writeFileSync(schemaPath, schema);
  console.log(`[prepare-db] Switched datasource db provider from ${currentProvider} to ${targetProvider}`);
  try {
    execSync('npx prisma generate', { stdio: 'inherit' });
  } catch (err) {
    console.error('[prepare-db] prisma generate warning:', err.message);
  }
}
