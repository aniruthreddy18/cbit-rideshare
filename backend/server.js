import { env } from './src/config/env.js';
import { connectDB } from './src/config/db.js';
import app from './src/app.js';
import Booking from './src/models/Booking.js';
import Ride from './src/models/Ride.js';
import User from './src/models/User.js';

async function ensureIndexes() {
  for (const Model of [User, Ride, Booking]) {
    try {
      await Model.createIndexes();
    } catch (err) {
      console.warn(
        `[db] Could not build indexes for ${Model.collection.collectionName}: ${err.message}\n` +
          '     The app still checks for duplicates, but clean up the conflicting documents/indexes in Atlas.'
      );
    }
  }
}

async function start() {
  try {
    await connectDB({ uri: env.mongoUri, dbName: env.mongoDbName, dnsServers: env.dnsServers });
  } catch (err) {
    console.error(`\n[db] ${err.message}\n`);
    process.exit(1);
  }
  await ensureIndexes();

  const server = app.listen(env.port, () => {
    console.log(`[api] CBIT RideShare API running at http://localhost:${env.port}/api (${env.nodeEnv})`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n[api] Port ${env.port} is already in use. Stop the other process or set PORT in backend/.env.\n` +
          `      macOS/Linux: lsof -i :${env.port}    Windows: netstat -ano | findstr :${env.port}\n` +
          '      On macOS, port 5000 is used by AirPlay Receiver (System Settings > General > AirDrop & Handoff).\n'
      );
    } else {
      console.error('[api] Server error:', err);
    }
    process.exit(1);
  });
}

process.on('unhandledRejection', (reason) => console.error('[api] Unhandled promise rejection:', reason));

start();
