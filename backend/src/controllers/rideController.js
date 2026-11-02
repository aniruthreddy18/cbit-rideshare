import Booking from '../models/Booking.js';
import Ride from '../models/Ride.js';
import AppError from '../utils/AppError.js';
import { serializeRide } from '../utils/serializers.js';
import {
  MAX_SEATS,
  MAX_TOTAL_COST,
  TIME_REGEX,
  assertObjectId,
  escapeRegex,
  isValidDateString,
  normalizePhone,
  num,
  str,
  throwIfErrors,
  toDepartureDate,
  todayIST,
} from '../utils/validators.js';

const MAX_DAYS_AHEAD = 90;

/** Validate the Offer Ride / Edit Ride form. Returns clean values or throws 400 with field errors. */
function parseRideInput(body = {}, user) {
  const errors = {};
  const from = str(body.from).replace(/\s+/g, ' ');
  const to = str(body.to).replace(/\s+/g, ' ');
  const date = str(body.date);
  const time = str(body.time);
  const seats = num(body.seats);
  const totalCost = num(body.totalCost);
  const notes = str(body.notes);
  const phoneInput = body.phone === undefined || body.phone === '' ? user.phone : body.phone;
  const phone = normalizePhone(phoneInput);

  if (from.length < 2 || from.length > 100) errors.from = 'Pickup location must be 2-100 characters.';
  if (to.length < 2 || to.length > 100) errors.to = 'Destination must be 2-100 characters.';
  if (!errors.from && !errors.to && from.toLowerCase() === to.toLowerCase()) {
    errors.to = 'Destination must be different from the pickup location.';
  }

  let departureAt = null;
  if (!isValidDateString(date)) errors.date = 'Choose a valid date.';
  else if (date < todayIST()) errors.date = 'Date cannot be in the past.';
  if (!TIME_REGEX.test(time)) errors.time = 'Choose a valid time (HH:mm).';
  if (!errors.date && !errors.time) {
    departureAt = toDepartureDate(date, time);
    if (departureAt.getTime() <= Date.now()) errors.time = 'Departure time must be in the future.';
    else if (departureAt.getTime() > Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
      errors.date = `Rides can be offered at most ${MAX_DAYS_AHEAD} days in advance.`;
    }
  }

  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
    errors.seats = `Seats must be a whole number from 1 to ${MAX_SEATS}.`;
  }
  if (!Number.isFinite(totalCost) || totalCost < 0 || totalCost > MAX_TOTAL_COST) {
    errors.totalCost = `Total cost must be between ₹0 and ₹${MAX_TOTAL_COST}.`;
  }
  if (!phone) errors.phone = 'Enter a valid 10-digit contact number.';
  if (notes.length > 300) errors.notes = 'Notes must be at most 300 characters.';

  throwIfErrors(errors);
  return { from, to, date, time, departureAt, seats, totalCost: Math.round(totalCost * 100) / 100, phone, notes };
}

async function findRideOr404(id) {
  assertObjectId(id, 'ride id');
  const ride = await Ride.findById(id);
  if (!ride) throw new AppError(404, 'Ride not found. It may have been removed.');
  return ride;
}

function assertOwner(ride, user, action) {
  if (String(ride.owner) !== String(user._id)) {
    throw new AppError(403, `Only the student who offered this ride can ${action}.`);
  }
}

// POST /api/rides
export async function createRide(req, res) {
  const values = parseRideInput(req.body, req.user);
  const ride = await Ride.create({
    ...values,
    owner: req.user._id,
    name: req.user.name,
    email: req.user.email,
    availableSeats: values.seats,
  });
  res.status(201).json({ success: true, message: 'Ride published successfully.', ride: serializeRide(ride, req.user._id) });
}

// GET /api/rides?from=&to=&date=&minSeats=&maxCost=&q=&sort=
export async function listRides(req, res) {
  const query = req.query || {};
  const filter = { status: 'active', departureAt: { $gt: new Date() } };

  const from = str(query.from);
  const to = str(query.to);
  const date = str(query.date);
  const search = str(query.q);
  if (from) filter.from = { $regex: escapeRegex(from), $options: 'i' };
  if (to) filter.to = { $regex: escapeRegex(to), $options: 'i' };
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ from: rx }, { to: rx }, { name: rx }, { notes: rx }];
  }
  if (date) {
    if (!isValidDateString(date)) throw new AppError(400, 'Invalid date filter. Use YYYY-MM-DD.');
    filter.date = date;
  }

  const minSeats = str(query.minSeats) ? num(query.minSeats) : 1;
  if (!Number.isInteger(minSeats) || minSeats < 1 || minSeats > MAX_SEATS) {
    throw new AppError(400, `Minimum seats must be a whole number from 1 to ${MAX_SEATS}.`);
  }
  filter.availableSeats = { $gte: minSeats };

  if (str(query.maxCost)) {
    const maxCost = num(query.maxCost);
    if (!Number.isFinite(maxCost) || maxCost < 0) throw new AppError(400, 'Maximum cost must be a positive number.');
    filter.totalCost = { $lte: maxCost };
  }

  const sorts = {
    soonest: { departureAt: 1 },
    cheapest: { totalCost: 1, departureAt: 1 },
    seats: { availableSeats: -1, departureAt: 1 },
  };
  const sort = sorts[str(query.sort)] || sorts.soonest;

  const rides = await Ride.find(filter).sort(sort).limit(100);

  // Attach the current user's latest booking on each ride so the UI can show its status.
  const bookings = await Booking.find({ passenger: req.user._id, ride: { $in: rides.map((r) => r._id) } })
    .sort({ createdAt: -1 })
    .select('ride status');
  const latestByRide = new Map();
  for (const b of bookings) if (!latestByRide.has(String(b.ride))) latestByRide.set(String(b.ride), b);

  res.json({
    success: true,
    count: rides.length,
    rides: rides.map((ride) => serializeRide(ride, req.user._id, { booking: latestByRide.get(String(ride._id)) })),
  });
}

// GET /api/rides/mine  (rides offered by me, with every booking request on them)
export async function getMyRides(req, res) {
  const rides = await Ride.find({ owner: req.user._id }).sort({ departureAt: -1 });
  const bookings = await Booking.find({ ride: { $in: rides.map((r) => r._id) } }).sort({ createdAt: 1 });

  const byRide = new Map();
  for (const b of bookings) {
    const key = String(b.ride);
    if (!byRide.has(key)) byRide.set(key, []);
    byRide.get(key).push(b);
  }

  res.json({
    success: true,
    rides: rides.map((ride) => ({
      ...serializeRide(ride, req.user._id),
      isPast: ride.departureAt.getTime() <= Date.now(),
      bookings: byRide.get(String(ride._id)) || [],
    })),
  });
}

// GET /api/rides/:id
export async function getRide(req, res) {
  const ride = await findRideOr404(req.params.id);
  const isOwner = String(ride.owner) === String(req.user._id);
  const booking = await Booking.findOne({ ride: ride._id, passenger: req.user._id }).sort({ createdAt: -1 });

  if (ride.status !== 'active' && !isOwner && !booking) {
    throw new AppError(404, 'This ride is no longer available.');
  }

  const data = serializeRide(ride, req.user._id, { booking });
  if (isOwner) data.bookings = await Booking.find({ ride: ride._id }).sort({ createdAt: 1 });
  res.json({ success: true, ride: data });
}

// PUT /api/rides/:id
export async function updateRide(req, res) {
  const ride = await findRideOr404(req.params.id);
  assertOwner(ride, req.user, 'edit it');
  if (ride.status !== 'active') throw new AppError(409, 'A cancelled ride cannot be edited.');
  if (ride.departureAt.getTime() <= Date.now()) throw new AppError(409, 'This ride has already departed and cannot be edited.');

  const values = parseRideInput(req.body, req.user);
  const booked = ride.seats - ride.availableSeats;
  if (values.seats < booked) {
    throw new AppError(409, `You can't reduce seats to ${values.seats}: ${booked} passenger(s) are already confirmed.`, {
      seats: `At least ${booked} seat(s) are already taken.`,
    });
  }

  // Atomic update: shift availableSeats by the change in total seats, guarded so that
  // a booking accepted at the same moment can never push availableSeats below 0.
  const delta = values.seats - ride.seats;
  const literal = (v) => ({ $literal: v });
  const updated = await Ride.findOneAndUpdate(
    {
      _id: ride._id,
      owner: req.user._id,
      status: 'active',
      seats: ride.seats,
      $expr: { $gte: [{ $add: ['$availableSeats', delta] }, 0] },
    },
    [
      {
        $set: {
          from: literal(values.from),
          to: literal(values.to),
          date: literal(values.date),
          time: literal(values.time),
          departureAt: literal(values.departureAt),
          seats: literal(values.seats),
          availableSeats: { $add: ['$availableSeats', delta] },
          totalCost: literal(values.totalCost),
          phone: literal(values.phone),
          notes: literal(values.notes),
        },
      },
    ],
    { new: true }
  );
  if (!updated) {
    throw new AppError(409, 'Seats changed while you were editing (a request was just accepted). Reload and try again.');
  }

  res.json({ success: true, message: 'Ride updated.', ride: serializeRide(updated, req.user._id) });
}

// DELETE /api/rides/:id  (soft-cancel: keeps history, cancels every open booking)
export async function cancelRide(req, res) {
  const ride = await findRideOr404(req.params.id);
  assertOwner(ride, req.user, 'cancel it');
  if (ride.status === 'cancelled') throw new AppError(409, 'This ride is already cancelled.');
  if (ride.departureAt.getTime() <= Date.now()) throw new AppError(409, 'This ride has already departed.');

  const updated = await Ride.findOneAndUpdate(
    { _id: ride._id, status: 'active' },
    { $set: { status: 'cancelled' } },
    { new: true }
  );
  if (!updated) throw new AppError(409, 'This ride is already cancelled.');

  const result = await Booking.updateMany(
    { ride: ride._id, status: { $in: ['pending', 'confirmed'] } },
    { $set: { status: 'cancelled', cancelledBy: 'owner', cancelledAt: new Date() } }
  );

  res.json({
    success: true,
    message: `Ride cancelled. ${result.modifiedCount} passenger request(s) were cancelled.`,
    ride: serializeRide(updated, req.user._id),
  });
}
