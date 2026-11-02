import Booking from '../models/Booking.js';
import Ride from '../models/Ride.js';
import AppError from '../utils/AppError.js';
import { serializePassengerBooking, serializeRide } from '../utils/serializers.js';
import { BOOKING_STATUSES, assertObjectId, str } from '../utils/validators.js';

const ALREADY_HANDLED = {
  confirmed: 'This request has already been accepted.',
  rejected: 'This request has already been rejected.',
  cancelled: 'This request was cancelled.',
};

async function findBookingOr404(id) {
  assertObjectId(id, 'booking id');
  const booking = await Booking.findById(id);
  if (!booking) throw new AppError(404, 'Booking request not found.');
  return booking;
}

function assertRideOwner(booking, user, action) {
  if (String(booking.rideOwner) !== String(user._id)) {
    throw new AppError(403, `Only the ride owner can ${action} this request.`);
  }
}

// POST /api/bookings   body: { rideId, message? }
// POST /api/rides/:id/join  body: { message? }
export async function requestBooking(req, res) {
  const rideId = req.params.id ?? req.body?.rideId;
  assertObjectId(rideId, 'ride id');
  const message = str(req.body?.message);
  if (message.length > 200) throw new AppError(400, 'Message must be at most 200 characters.', { message: 'Too long' });

  const ride = await Ride.findById(rideId);
  if (!ride) throw new AppError(404, 'Ride not found. It may have been removed.');
  if (String(ride.owner) === String(req.user._id)) throw new AppError(400, "You can't join a ride you are offering.");
  if (ride.status !== 'active') throw new AppError(409, 'This ride was cancelled by its owner.');
  if (ride.departureAt.getTime() <= Date.now()) throw new AppError(409, 'This ride has already departed.');
  if (ride.availableSeats <= 0) throw new AppError(409, 'This ride is full. No seats are available.');

  const existing = await Booking.findOne({
    ride: ride._id,
    passenger: req.user._id,
    status: { $in: ['pending', 'confirmed', 'rejected'] },
  }).sort({ createdAt: -1 });
  if (existing?.status === 'pending') {
    throw new AppError(409, "You've already requested to join this ride. Waiting for the owner's response.");
  }
  if (existing?.status === 'confirmed') throw new AppError(409, "You're already confirmed on this ride.");
  if (existing?.status === 'rejected') throw new AppError(409, 'The ride owner declined your request for this ride.');

  // The partial unique index also blocks a duplicate created by a simultaneous request (-> 409).
  const booking = await Booking.create({
    ride: ride._id,
    passenger: req.user._id,
    rideOwner: ride.owner,
    passengerName: req.user.name,
    passengerEmail: req.user.email,
    passengerPhone: req.user.phone,
    message,
    status: 'pending',
  });

  res.status(201).json({
    success: true,
    message: 'Request sent! The ride owner will accept or reject it.',
    booking: { ...booking.toJSON(), ride: serializeRide(ride, req.user._id, { booking }) },
  });
}

// GET /api/bookings/mine   (rides I've requested/joined as a passenger)
export async function getMyBookings(req, res) {
  const bookings = await Booking.find({ passenger: req.user._id }).sort({ createdAt: -1 }).populate('ride');
  res.json({ success: true, bookings: bookings.map((b) => serializePassengerBooking(b, req.user._id)) });
}

// GET /api/bookings/requests?status=pending   (requests on rides I offer)
export async function getOwnerRequests(req, res) {
  const filter = { rideOwner: req.user._id };
  const status = str(req.query?.status);
  if (status) {
    if (!BOOKING_STATUSES.includes(status)) {
      throw new AppError(400, `Invalid status. Use one of: ${BOOKING_STATUSES.join(', ')}.`);
    }
    filter.status = status;
  }
  const bookings = await Booking.find(filter)
    .sort({ createdAt: -1 })
    .populate('ride', 'from to date time departureAt seats availableSeats pricePerSeat totalCost status');
  res.json({ success: true, count: bookings.length, bookings });
}

// PATCH /api/bookings/:id/accept
export async function acceptBooking(req, res) {
  const booking = await findBookingOr404(req.params.id);
  assertRideOwner(booking, req.user, 'accept');
  if (booking.status !== 'pending') throw new AppError(409, ALREADY_HANDLED[booking.status]);

  const ride = await Ride.findById(booking.ride);
  if (!ride || ride.status !== 'active') throw new AppError(409, 'This ride is no longer active.');
  if (ride.departureAt.getTime() <= Date.now()) throw new AppError(409, 'This ride has already departed.');
  if (ride.availableSeats <= 0) throw new AppError(409, 'No seats left on this ride. Reject the request or add seats first.');

  // Step 1: atomically move pending -> confirmed. Only one concurrent accept can win,
  // so a double-click can never take two seats for the same booking.
  const confirmed = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'pending' },
    { $set: { status: 'confirmed', respondedAt: new Date() } },
    { new: true }
  );
  if (!confirmed) {
    const fresh = await Booking.findById(booking._id);
    throw new AppError(409, ALREADY_HANDLED[fresh?.status] || 'This request was already handled.');
  }

  // Step 2: atomically take one seat, only if one is still free.
  const updatedRide = await Ride.findOneAndUpdate(
    { _id: ride._id, status: 'active', availableSeats: { $gt: 0 } },
    { $inc: { availableSeats: -1 } },
    { new: true }
  );
  if (!updatedRide) {
    // Seat was taken by another acceptance in the meantime: undo step 1.
    await Booking.updateOne({ _id: booking._id, status: 'confirmed' }, { $set: { status: 'pending', respondedAt: null } });
    throw new AppError(409, 'No seats left on this ride. Reject the request or add seats first.');
  }

  res.json({
    success: true,
    message: `Accepted ${confirmed.passengerName}. ${updatedRide.availableSeats} seat(s) left.`,
    booking: confirmed,
    ride: serializeRide(updatedRide, req.user._id),
  });
}

// PATCH /api/bookings/:id/reject   (seats are not changed)
export async function rejectBooking(req, res) {
  const booking = await findBookingOr404(req.params.id);
  assertRideOwner(booking, req.user, 'reject');
  if (booking.status !== 'pending') throw new AppError(409, ALREADY_HANDLED[booking.status]);

  const rejected = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'pending' },
    { $set: { status: 'rejected', respondedAt: new Date() } },
    { new: true }
  );
  if (!rejected) {
    const fresh = await Booking.findById(booking._id);
    throw new AppError(409, ALREADY_HANDLED[fresh?.status] || 'This request was already handled.');
  }

  res.json({ success: true, message: `Rejected ${rejected.passengerName}'s request.`, booking: rejected });
}

// PATCH /api/bookings/:id/cancel   (passenger cancels their own booking)
export async function cancelBooking(req, res) {
  const booking = await findBookingOr404(req.params.id);
  if (String(booking.passenger) !== String(req.user._id)) {
    throw new AppError(403, 'You can only cancel your own bookings.');
  }
  if (!['pending', 'confirmed'].includes(booking.status)) {
    throw new AppError(409, `This booking is already ${booking.status} and cannot be cancelled.`);
  }

  const ride = await Ride.findById(booking.ride);
  if (booking.status === 'confirmed' && ride && ride.departureAt.getTime() <= Date.now()) {
    throw new AppError(409, 'This ride has already departed and can no longer be cancelled.');
  }

  // Atomic transition. `new: false` returns the document *before* the update, so we
  // know whether this exact call is the one that cancelled a confirmed booking.
  const previous = await Booking.findOneAndUpdate(
    { _id: booking._id, passenger: req.user._id, status: { $in: ['pending', 'confirmed'] } },
    { $set: { status: 'cancelled', cancelledBy: 'passenger', cancelledAt: new Date() } },
    { new: false }
  );
  if (!previous) {
    const fresh = await Booking.findById(booking._id);
    throw new AppError(409, `This booking is already ${fresh?.status || 'closed'} and cannot be cancelled.`);
  }

  // Restore the seat exactly once: only the call that moved confirmed -> cancelled gets here
  // with previous.status === 'confirmed'. The $expr guard keeps availableSeats <= seats.
  let updatedRide = ride;
  if (previous.status === 'confirmed') {
    updatedRide =
      (await Ride.findOneAndUpdate(
        { _id: previous.ride, $expr: { $lt: ['$availableSeats', '$seats'] } },
        { $inc: { availableSeats: 1 } },
        { new: true }
      )) || (await Ride.findById(previous.ride));
  }

  const cancelled = await Booking.findById(booking._id);
  res.json({
    success: true,
    message: previous.status === 'confirmed' ? 'Booking cancelled. Your seat has been released.' : 'Request cancelled.',
    booking: cancelled,
    ride: updatedRide ? serializeRide(updatedRide, req.user._id, { booking: cancelled }) : null,
  });
}
