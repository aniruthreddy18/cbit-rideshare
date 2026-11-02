import { formatDate, formatMoney, formatTime, pricePerSeatOf } from '../utils/format.js';
import RouteLine from './RouteLine.jsx';
import StatusBadge from './StatusBadge.jsx';

/** A ride in the Find Ride list, with the Join Ride action. */
export default function RideCard({ ride, onJoin, joining }) {
  const booking = ride.myBooking;
  const price = pricePerSeatOf(ride);
  const canRequest = !ride.isOwner && (!booking || booking.status === 'cancelled') && ride.availableSeats > 0;

  let action;
  if (ride.isOwner) {
    action = <span className="badge rounded-pill text-bg-light border"><i className="bi bi-person-badge me-1" />Your ride</span>;
  } else if (booking && booking.status !== 'cancelled') {
    action = <StatusBadge status={booking.status} />;
  } else {
    action = (
      <button type="button" className="btn btn-primary btn-sm px-3" disabled={!canRequest || joining} onClick={() => onJoin(ride)}>
        {joining ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-person-plus me-1" />}
        Join Ride
      </button>
    );
  }

  return (
    <article className="card ride-card h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-3 gap-2">
          <RouteLine from={ride.from} to={ride.to} />
          <div className="text-end flex-shrink-0">
            <div className="fs-5 fw-bold text-primary">{formatMoney(price)}</div>
            <div className="small text-secondary">per person</div>
          </div>
        </div>

        <div className="ride-meta mb-3">
          <span><i className="bi bi-calendar3" /> {formatDate(ride.date)}</span>
          <span><i className="bi bi-clock" /> {formatTime(ride.time)}</span>
          <span className={ride.availableSeats <= 1 ? 'text-danger fw-semibold' : ''}>
            <i className="bi bi-people" /> {ride.availableSeats} of {ride.seats} seat{ride.seats === 1 ? '' : 's'} left
          </span>
          <span><i className="bi bi-cash-coin" /> {formatMoney(price)} × {ride.seats} seat{ride.seats === 1 ? '' : 's'} = {formatMoney(price * ride.seats)}</span>
        </div>

        {ride.notes && <p className="small text-secondary mb-3 fst-italic">“{ride.notes}”</p>}

        <div className="mt-auto d-flex justify-content-between align-items-center gap-2 pt-2 border-top">
          <div className="small text-truncate">
            <i className="bi bi-person-circle text-primary me-1" />
            <span className="fw-semibold">{ride.name}</span>
            {ride.phone && <span className="text-secondary"> · {ride.phone}</span>}
          </div>
          {action}
        </div>
      </div>
    </article>
  );
}
