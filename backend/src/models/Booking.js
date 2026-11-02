import mongoose from 'mongoose';
import { BOOKING_STATUSES } from '../utils/validators.js';

const bookingSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Copied from the ride so an owner's requests can be fetched with one indexed query.
    rideOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Passenger details snapshot, shown to the ride owner.
    passengerName: { type: String, required: true, trim: true },
    passengerEmail: { type: String, required: true, lowercase: true, trim: true },
    passengerPhone: { type: String, required: true },

    message: { type: String, trim: true, maxlength: 200, default: '' },

    status: { type: String, enum: BOOKING_STATUSES, default: 'pending', index: true },
    respondedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, enum: ['passenger', 'owner', null], default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Database-level guard against duplicate bookings: a passenger can have at most one
// pending/confirmed booking per ride. Cancelled/rejected bookings don't count.
bookingSchema.index(
  { ride: 1, passenger: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } },
    name: 'one_active_booking_per_ride',
  }
);

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
export default Booking;
