import mongoose from 'mongoose';
import {
  DATE_REGEX,
  EMAIL_REGEX,
  MAX_PRICE_PER_SEAT,
  MAX_SEATS,
  PHONE_REGEX,
  TIME_REGEX,
  toDepartureDate,
} from '../utils/validators.js';

const rideSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Contact details of the ride owner (copied at creation time).
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, lowercase: true, trim: true, match: EMAIL_REGEX },
    phone: { type: String, required: true, match: [PHONE_REGEX, 'Enter a valid 10-digit mobile number'] },

    from: { type: String, required: [true, 'Pickup location is required'], trim: true, maxlength: 100 },
    to: { type: String, required: [true, 'Destination is required'], trim: true, maxlength: 100 },

    // Stored as plain strings so dates never shift because of time zones.
    date: { type: String, required: [true, 'Date is required'], match: [DATE_REGEX, 'Date must be YYYY-MM-DD'] },
    time: { type: String, required: [true, 'Time is required'], match: [TIME_REGEX, 'Time must be HH:mm'] },
    // Exact departure moment (IST), derived from date + time. Used for sorting/filtering.
    departureAt: { type: Date, required: true, index: true },

    // Total seats offered to passengers, and how many are still free.
    seats: {
      type: Number,
      required: [true, 'Number of seats is required'],
      min: [1, 'Offer at least 1 seat'],
      max: [MAX_SEATS, `At most ${MAX_SEATS} seats`],
      validate: { validator: Number.isInteger, message: 'Seats must be a whole number' },
    },
    availableSeats: {
      type: Number,
      min: [0, 'Available seats cannot be negative'],
      validate: {
        validator(value) {
          return Number.isInteger(value) && value <= this.seats;
        },
        message: 'Available seats cannot exceed total seats',
      },
    },

    // What each passenger pays. The owner enters this; totalCost is derived from it.
    pricePerSeat: {
      type: Number,
      required: [true, 'Price per person is required'],
      min: [0, 'Price cannot be negative'],
      max: [MAX_PRICE_PER_SEAT, `Price cannot exceed ₹${MAX_PRICE_PER_SEAT} per person`],
    },
    // pricePerSeat x seats (what the owner collects when every seat is filled).
    totalCost: { type: Number, min: 0 },
    notes: { type: String, trim: true, maxlength: 300, default: '' },

    status: { type: String, enum: ['active', 'cancelled'], default: 'active', index: true },
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

rideSchema.pre('validate', function deriveFields() {
  if (typeof this.pricePerSeat === 'number' && typeof this.seats === 'number') {
    this.totalCost = Math.round(this.pricePerSeat * this.seats * 100) / 100;
  }
  if (this.isNew && (this.availableSeats === undefined || this.availableSeats === null)) {
    this.availableSeats = this.seats;
  }
  if (this.date && this.time && (this.isModified('date') || this.isModified('time') || !this.departureAt)) {
    const departure = toDepartureDate(this.date, this.time);
    if (!Number.isNaN(departure.getTime())) this.departureAt = departure;
  }
});

rideSchema.index({ status: 1, departureAt: 1 });

const Ride = mongoose.models.Ride || mongoose.model('Ride', rideSchema);
export default Ride;
