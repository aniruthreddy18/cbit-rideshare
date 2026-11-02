const idOf = (value) => String(value?._id ?? value);

/**
 * Shape a ride for a given viewer. The owner's phone number is only revealed to the
 * owner and to passengers whose booking is confirmed.
 */
export function serializeRide(ride, viewerId, { booking = null } = {}) {
  const data = typeof ride.toJSON === 'function' ? ride.toJSON() : { ...ride };
  const isOwner = idOf(data.owner) === String(viewerId);
  const canSeeContact = isOwner || booking?.status === 'confirmed';

  const result = {
    ...data,
    owner: idOf(data.owner),
    isOwner,
    myBooking: booking ? { _id: idOf(booking), status: booking.status } : null,
  };
  if (!canSeeContact) delete result.phone;
  return result;
}

/** Bookings as seen by the passenger: includes the ride, with contact only if confirmed. */
export function serializePassengerBooking(booking, viewerId) {
  const data = typeof booking.toJSON === 'function' ? booking.toJSON() : { ...booking };
  const ride = booking.ride && typeof booking.ride === 'object' && booking.ride.from !== undefined
    ? serializeRide(booking.ride, viewerId, { booking })
    : null;
  return { ...data, ride };
}
