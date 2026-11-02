import dns from 'node:dns';
import mongoose from 'mongoose';

/** Hide the password when printing a connection string. */
export function redactUri(uri) {
  return uri.replace(/\/\/([^:/@]+):([^@]+)@/, '//$1:****@');
}

/** Turn low-level driver errors into an actionable explanation. */
export function explainMongoError(err, uri) {
  const msg = `${err?.message || err}`;
  const lines = [`MongoDB connection failed: ${msg}`, `  URI: ${redactUri(uri)}`, '  How to fix:'];

  if (/bad auth|authentication failed|auth.*failed/i.test(msg)) {
    lines.push(
      '  - The username or password in MONGO_URI is wrong. Use a *database user* from',
      '    Atlas > Security > Database Access (NOT your Atlas website login).',
      '  - If the password has special characters (@ : / ? # [ ] %), URL-encode them,',
      '    e.g. "p@ss" -> "p%40ss". Easiest: use a letters+digits password.'
    );
  } else if (/querySrv|ENOTFOUND|ESERVFAIL|EREFUSED|ECONNREFUSED.*_mongodb\._tcp/i.test(msg)) {
    lines.push(
      '  - Your DNS could not resolve the Atlas SRV record. Check the cluster host name in',
      '    MONGO_URI (copy it again from Atlas > Connect > Drivers).',
      '  - Some Wi-Fi/ISP DNS servers block SRV lookups. Add this line to backend/.env:',
      '        DNS_SERVERS=8.8.8.8,1.1.1.1',
      '    or switch to a mobile hotspot and try again.'
    );
  } else if (
    err?.name === 'MongoServerSelectionError' ||
    /Server selection timed out|ReplicaSetNoPrimary|Could not connect to any servers|ETIMEDOUT/i.test(msg)
  ) {
    lines.push(
      '  - Atlas is rejecting your IP address. Go to Atlas > Security > Network Access and',
      '    "Add Current IP Address" (or 0.0.0.0/0 for development only). Wait ~1 minute.',
      '  - College/office networks often block port 27017. Try a mobile hotspot.',
      '  - Make sure the cluster is not paused (Atlas > Database > Clusters).'
    );
  } else if (/ECONNREFUSED/i.test(msg)) {
    lines.push(
      '  - Nothing is listening at that address. If you use local MongoDB, start the',
      '    "MongoDB" Windows service; otherwise use your Atlas mongodb+srv:// URI.'
    );
  } else if (/Invalid scheme|URI malformed|Invalid connection string|Password contains unescaped/i.test(msg)) {
    lines.push(
      '  - MONGO_URI is malformed. Copy it again from Atlas > Connect > Drivers and',
      '    URL-encode special characters in the password.'
    );
  } else {
    lines.push('  - Re-check MONGO_URI in backend/.env and your Atlas Network Access list.');
  }
  return lines.join('\n');
}

export async function connectDB({ uri, dbName, dnsServers = [] }) {
  if (dnsServers.length) {
    dns.setServers(dnsServers);
    console.log(`[db] Using custom DNS servers: ${dnsServers.join(', ')}`);
  }

  mongoose.set('strictQuery', true);

  try {
    const conn = await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
    console.log(`[db] Connected to MongoDB host=${conn.connection.host} db=${conn.connection.name}`);
    // Report connection drops that happen while the server is running.
    conn.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected - retrying...'));
    conn.connection.on('reconnected', () => console.log('[db] MongoDB reconnected'));
    conn.connection.on('error', (err) => console.error(`[db] MongoDB error: ${err.message}`));
    return conn;
  } catch (err) {
    const wrapped = new Error(explainMongoError(err, uri));
    wrapped.cause = err;
    throw wrapped;
  }
}
