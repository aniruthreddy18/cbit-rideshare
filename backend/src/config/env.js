import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Always load backend/.env, no matter which folder the server is started from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath, quiet: true });

function fail(message) {
  console.error(`\n[config] ${message}\n`);
  process.exit(1);
}

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key] || !process.env[key].trim());
if (missing.length) {
  fail(
    `Missing required environment variable(s): ${missing.join(', ')}.\n` +
      `  Expected file: ${envPath}\n` +
      '  Copy backend/.env.example to backend/.env and fill in the values.'
  );
}

const mongoUri = process.env.MONGO_URI.trim();
if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
  fail('MONGO_URI must start with "mongodb+srv://" (Atlas) or "mongodb://" (local MongoDB).');
}
if (/<\s*(db_)?password\s*>|<\s*username\s*>|YOUR_DB_(USER|PASSWORD)|YOUR_CLUSTER/i.test(mongoUri)) {
  fail(
    'MONGO_URI still contains a placeholder (<db_password> / YOUR_DB_USER / YOUR_CLUSTER).\n' +
      '  Replace it with your Atlas *database user* credentials (Database Access page).'
  );
}

const jwtSecret = process.env.JWT_SECRET.trim();
if (jwtSecret.length < 32 || /REPLACE_WITH/i.test(jwtSecret)) {
  fail('JWT_SECRET must be a random string of at least 32 characters. Generate one with the command in backend/.env.example.');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5050,
  mongoUri,
  mongoDbName: (process.env.MONGO_DB_NAME || 'cbit_rideshare').trim(),
  dnsServers: (process.env.DNS_SERVERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwtSecret,
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '7d').trim(),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT) || 50,
};

export const isProduction = env.nodeEnv === 'production';
