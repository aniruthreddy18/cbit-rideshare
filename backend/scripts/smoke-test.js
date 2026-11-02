/**
 * End-to-end check of the whole booking flow against a RUNNING backend.
 *
 *   1. Start the API in one terminal:   npm run dev
 *   2. Run this in another terminal:    npm run smoke
 *
 * It registers temporary users (smoketest.*@cbit.ac.in), exercises every rule
 * (validation, duplicates, accept/reject/cancel, seat counts, concurrency) and
 * finally deletes every user, ride and booking it created from MongoDB.
 */
import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import Booking from '../src/models/Booking.js';
import Ride from '../src/models/Ride.js';
import User from '../src/models/User.js';

const API = (process.env.API_URL || `http://localhost:${env.port}/api`).replace(/\/$/, '');
const RUN = Date.now().toString(36);
const PASSWORD = 'Test12345';
let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✘ ${label}${detail ? `  -> ${detail}` : ''}`);
  }
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, data };
}

function expectStatus(label, res, status) {
  check(`${label} (HTTP ${status})`, res.status === status, `got ${res.status}: ${res.data?.message}`);
}

function istDate(daysAhead) {
  return new Date(Date.now() + 5.5 * 3600 * 1000 + daysAhead * 86400 * 1000).toISOString().slice(0, 10);
}

async function register(tag) {
  const body = {
    name: `Smoke ${tag}`,
    email: `smoketest.${tag}.${RUN}@cbit.ac.in`,
    phone: '9876543210',
    password: PASSWORD,
    confirmPassword: PASSWORD,
  };
  const res = await call('POST', '/auth/register', { body });
  expectStatus(`register ${tag}`, res, 201);
  return { token: res.data.token, user: res.data.user, email: body.email };
}

async function seatsOf(rideId, token) {
  const res = await call('GET', `/rides/${rideId}`, { token });
  return res.data?.ride?.availableSeats;
}

async function main() {
  console.log(`\nCBIT RideShare smoke test against ${API}\n`);

  const health = await call('GET', '/health').catch((err) => ({ status: 0, data: { message: err.message } }));
  if (health.status !== 200) {
    console.error(`API is not reachable/healthy at ${API} (${health.status}: ${JSON.stringify(health.data)}).`);
    console.error('Start the backend first with:  npm run dev');
    process.exit(1);
  }
  check('health: API up and database connected', health.data.database === 'connected');

  console.log('\nAuthentication');
  let res = await call('POST', '/auth/register', {
    body: { name: 'X', email: 'someone@gmail.com', phone: '123', password: 'short', confirmPassword: 'nope' },
  });
  expectStatus('rejects invalid registration', res, 400);
  check('returns field errors for name/email/phone/password/confirm',
    ['name', 'email', 'phone', 'password', 'confirmPassword'].every((f) => res.data.errors?.[f]),
    JSON.stringify(res.data.errors));

  const owner = await register('owner');
  const alice = await register('alice');
  const bob = await register('bob');
  const extra = await Promise.all([register('p3'), register('p4'), register('p5')]);
  check('password hash is not returned', owner.user && owner.user.password === undefined);

  const stored = await User.findOne({ email: owner.email }).select('+password');
  check('password is stored as a bcrypt hash', /^\$2[aby]\$/.test(stored?.password || ''));

  res = await call('POST', '/auth/register', {
    body: { name: 'Dup', email: owner.email, phone: '9876543210', password: PASSWORD, confirmPassword: PASSWORD },
  });
  expectStatus('blocks duplicate email', res, 409);

  res = await call('POST', '/auth/login', { body: { email: owner.email, password: 'Wrong1234' } });
  expectStatus('rejects wrong password', res, 401);
  res = await call('POST', '/auth/login', { body: { email: owner.email.toUpperCase(), password: PASSWORD } });
  expectStatus('logs in (email case-insensitive)', res, 200);
  check('login returns a token', typeof res.data.token === 'string');

  res = await call('GET', '/rides');
  expectStatus('protected route without token', res, 401);
  res = await call('GET', '/auth/me', { token: 'not-a-real-token' });
  expectStatus('protected route with bad token', res, 401);
  res = await call('POST', '/auth/login', { body: { email: { $gt: '' }, password: { $gt: '' } } });
  expectStatus('NoSQL-injection login attempt is rejected', res, 400);

  console.log('\nOffer ride');
  res = await call('POST', '/rides', {
    token: owner.token,
    body: { from: 'CBIT', to: 'cbit', date: '2000-01-01', time: '25:00', seats: 0, totalCost: -5 },
  });
  expectStatus('rejects invalid ride', res, 400);
  check('ride field errors returned', ['to', 'date', 'time', 'seats', 'totalCost'].every((f) => res.data.errors?.[f]),
    JSON.stringify(res.data.errors));

  const rideBody = {
    from: `CBIT Gandipet ${RUN}`,
    to: 'Mehdipatnam',
    date: istDate(1),
    time: '08:30',
    seats: 2,
    totalCost: 300,
    notes: 'Smoke test ride',
  };
  res = await call('POST', '/rides', { token: owner.token, body: rideBody });
  expectStatus('creates ride', res, 201);
  const ride = res.data.ride;
  check('new ride has availableSeats = seats = 2', ride?.availableSeats === 2 && ride?.seats === 2);
  check('ride saved in MongoDB', !!(await Ride.findById(ride?._id)));

  console.log('\nFind ride');
  res = await call('GET', `/rides?from=${encodeURIComponent(`gandipet ${RUN}`)}&to=mehdi&date=${rideBody.date}`, { token: alice.token });
  expectStatus('search rides', res, 200);
  const found = res.data.rides?.find((r) => r._id === ride._id);
  check('search finds the ride (case-insensitive, partial)', !!found);
  check("owner's phone hidden from non-passengers", found && found.phone === undefined);
  res = await call('GET', `/rides?from=${encodeURIComponent(`gandipet ${RUN}`)}&maxCost=100`, { token: alice.token });
  check('maxCost filter excludes the ride', res.data.rides?.length === 0);

  console.log('\nJoin + duplicate protection');
  res = await call('POST', '/bookings', { token: owner.token, body: { rideId: ride._id } });
  expectStatus("owner can't join own ride", res, 400);
  res = await call('POST', '/bookings', { token: alice.token, body: { rideId: ride._id, message: 'Near gate 2' } });
  expectStatus('alice requests to join', res, 201);
  const aliceBooking = res.data.booking;
  check('booking starts as pending', aliceBooking?.status === 'pending');
  res = await call('POST', `/rides/${ride._id}/join`, { token: alice.token });
  expectStatus('duplicate request blocked', res, 409);
  check('requesting does not change seats', (await seatsOf(ride._id, owner.token)) === 2);

  console.log('\nOwner requests');
  res = await call('GET', '/bookings/requests?status=pending', { token: owner.token });
  expectStatus('owner fetches pending requests', res, 200);
  check("alice's request appears for the owner", res.data.bookings?.some((b) => b._id === aliceBooking._id));
  res = await call('GET', '/rides/mine', { token: owner.token });
  check('My Rides (offered) includes the request', res.data.rides?.find((r) => r._id === ride._id)?.bookings?.length === 1);

  console.log('\nAccept');
  res = await call('PATCH', `/bookings/${aliceBooking._id}/accept`, { token: alice.token });
  expectStatus('passenger cannot accept own request', res, 403);
  const [acc1, acc2] = await Promise.all([
    call('PATCH', `/bookings/${aliceBooking._id}/accept`, { token: owner.token }),
    call('PATCH', `/bookings/${aliceBooking._id}/accept`, { token: owner.token }),
  ]);
  check('double-click accept: exactly one succeeds', [acc1.status, acc2.status].sort().join() === '200,409',
    `${acc1.status}/${acc2.status}`);
  check('accept -> seats 2 -> 1', (await seatsOf(ride._id, owner.token)) === 1);
  res = await call('GET', '/bookings/mine', { token: alice.token });
  const aliceView = res.data.bookings?.find((b) => b._id === aliceBooking._id);
  check('alice sees status confirmed', aliceView?.status === 'confirmed');
  check('confirmed passenger can see owner phone', aliceView?.ride?.phone === '9876543210');

  console.log('\nReject');
  res = await call('POST', '/bookings', { token: bob.token, body: { rideId: ride._id } });
  expectStatus('bob requests to join', res, 201);
  const bobBooking = res.data.booking;
  res = await call('PATCH', `/bookings/${bobBooking._id}/reject`, { token: owner.token });
  expectStatus('owner rejects bob', res, 200);
  check('booking status rejected', res.data.booking?.status === 'rejected');
  check('reject leaves seats at 1', (await seatsOf(ride._id, owner.token)) === 1);
  res = await call('PATCH', `/bookings/${bobBooking._id}/accept`, { token: owner.token });
  expectStatus('cannot accept a rejected request', res, 409);
  res = await call('POST', '/bookings', { token: bob.token, body: { rideId: ride._id } });
  expectStatus('rejected passenger cannot spam re-requests', res, 409);

  console.log('\nCancel');
  res = await call('PATCH', `/bookings/${aliceBooking._id}/cancel`, { token: bob.token });
  expectStatus("cannot cancel someone else's booking", res, 403);
  const [c1, c2] = await Promise.all([
    call('PATCH', `/bookings/${aliceBooking._id}/cancel`, { token: alice.token }),
    call('PATCH', `/bookings/${aliceBooking._id}/cancel`, { token: alice.token }),
  ]);
  check('double-click cancel: exactly one succeeds', [c1.status, c2.status].sort().join() === '200,409',
    `${c1.status}/${c2.status}`);
  check('cancel confirmed -> seat restored exactly once (1 -> 2)', (await seatsOf(ride._id, owner.token)) === 2);
  res = await call('PATCH', `/bookings/${aliceBooking._id}/cancel`, { token: alice.token });
  expectStatus('cancel again blocked', res, 409);
  check('seats still 2 after repeated cancel', (await seatsOf(ride._id, owner.token)) === 2);

  res = await call('POST', '/bookings', { token: alice.token, body: { rideId: ride._id } });
  expectStatus('alice can request again after cancelling', res, 201);
  const alice2 = res.data.booking;
  res = await call('PATCH', `/bookings/${alice2._id}/cancel`, { token: alice.token });
  expectStatus('cancel pending request', res, 200);
  check('cancelling a pending request does not add seats', (await seatsOf(ride._id, owner.token)) === 2);

  console.log('\nSeat limit under concurrency');
  const requests = await Promise.all(
    [alice, ...extra].map((p) => call('POST', '/bookings', { token: p.token, body: { rideId: ride._id } }))
  );
  check('4 passengers request a 2-seat ride', requests.every((r) => r.status === 201));
  const accepts = await Promise.all(
    requests.map((r) => call('PATCH', `/bookings/${r.data.booking._id}/accept`, { token: owner.token }))
  );
  const ok = accepts.filter((r) => r.status === 200).length;
  check('accepting all 4 at once confirms exactly 2', ok === 2, `confirmed ${ok}`);
  check('availableSeats is 0, never negative', (await seatsOf(ride._id, owner.token)) === 0);
  const leftovers = await Booking.countDocuments({ ride: ride._id, status: 'pending' });
  check('the 2 that did not fit stay pending', leftovers === 2, `pending ${leftovers}`);
  res = await call('GET', `/rides?from=${encodeURIComponent(`gandipet ${RUN}`)}`, { token: bob.token });
  check('full ride disappears from Find Ride', res.data.rides?.length === 0);

  console.log('\nEdit and cancel ride');
  res = await call('PUT', `/rides/${ride._id}`, { token: owner.token, body: { ...rideBody, seats: 1 } });
  expectStatus('cannot reduce seats below confirmed passengers', res, 409);
  res = await call('PUT', `/rides/${ride._id}`, { token: owner.token, body: { ...rideBody, seats: 3, totalCost: 450 } });
  expectStatus('owner adds a seat', res, 200);
  check('seats 3, available 1 after edit', res.data.ride?.seats === 3 && res.data.ride?.availableSeats === 1);
  res = await call('PUT', `/rides/${ride._id}`, { token: alice.token, body: rideBody });
  expectStatus('non-owner cannot edit', res, 403);
  res = await call('DELETE', `/rides/${ride._id}`, { token: owner.token });
  expectStatus('owner cancels ride', res, 200);
  const open = await Booking.countDocuments({ ride: ride._id, status: { $in: ['pending', 'confirmed'] } });
  check('all open bookings cancelled with the ride', open === 0);

  res = await call('PATCH', '/bookings/123/accept', { token: owner.token });
  expectStatus('malformed id gives a clear 400', res, 400);
  res = await call('GET', '/does-not-exist', { token: owner.token });
  expectStatus('unknown API route gives 404', res, 404);
}

async function cleanup() {
  const users = await User.find({ email: new RegExp(`^smoketest\\..+\\.${RUN}@cbit\\.ac\\.in$`) }).select('_id');
  const ids = users.map((u) => u._id);
  const rides = await Ride.find({ owner: { $in: ids } }).select('_id');
  const b = await Booking.deleteMany({ $or: [{ passenger: { $in: ids } }, { ride: { $in: rides.map((r) => r._id) } }] });
  const r = await Ride.deleteMany({ owner: { $in: ids } });
  const u = await User.deleteMany({ _id: { $in: ids } });
  console.log(`\nCleanup: removed ${u.deletedCount} users, ${r.deletedCount} rides, ${b.deletedCount} bookings.`);
}

if (env.dnsServers.length) dns.setServers(env.dnsServers);
await mongoose.connect(env.mongoUri, { dbName: env.mongoDbName, serverSelectionTimeoutMS: 10000 });
try {
  await main();
} catch (err) {
  failed += 1;
  console.error('\nSmoke test crashed:', err);
} finally {
  await cleanup().catch((err) => console.error('Cleanup failed:', err.message));
  await mongoose.disconnect();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}
