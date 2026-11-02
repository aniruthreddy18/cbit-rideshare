import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { bookingsApi, getErrorMessage, ridesApi } from '../api/client.js';
import AlertMessage from '../components/AlertMessage.jsx';
import Loading from '../components/Loading.jsx';
import RouteLine from '../components/RouteLine.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatDateTime, formatMoney, formatTime } from '../utils/format.js';

function RideSummary({ ride }) {
  return (
    <div className="ride-meta">
      <span><i className="bi bi-calendar3" /> {formatDate(ride.date)}</span>
      <span><i className="bi bi-clock" /> {formatTime(ride.time)}</span>
      <span><i className="bi bi-cash-coin" /> {formatMoney(ride.totalCost)} total</span>
    </div>
  );
}

function RequestRow({ booking, busy, onAccept, onReject, canRespond }) {
  return (
    <li className="list-group-item px-0 py-3">
      <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start">
        <div className="me-auto">
          <div className="fw-semibold">
            {booking.passengerName} <StatusBadge status={booking.status} />
          </div>
          <div className="small text-secondary">
            <i className="bi bi-envelope me-1" />{booking.passengerEmail}
            <span className="mx-2">·</span>
            <i className="bi bi-telephone me-1" />
            <a href={`tel:${booking.passengerPhone}`}>{booking.passengerPhone}</a>
          </div>
          {booking.message && <div className="small fst-italic mt-1">“{booking.message}”</div>}
          <div className="small text-secondary mt-1">
            Requested {formatDateTime(booking.createdAt)}
            {booking.status === 'cancelled' && booking.cancelledBy === 'passenger' && ' · cancelled by passenger'}
          </div>
        </div>
        {booking.status === 'pending' && canRespond && (
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={() => onAccept(booking)}>
              {busy === 'accept' ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check-lg me-1" />}
              Accept
            </button>
            <button type="button" className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => onReject(booking)}>
              {busy === 'reject' ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-x-lg me-1" />}
              Reject
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function OfferedRide({ ride, busyId, onAccept, onReject, onCancelRide }) {
  const [showClosed, setShowClosed] = useState(false);
  const open = ride.bookings.filter((b) => b.status === 'pending' || b.status === 'confirmed');
  const closed = ride.bookings.filter((b) => b.status === 'rejected' || b.status === 'cancelled');
  const pending = ride.bookings.filter((b) => b.status === 'pending').length;
  const isActive = ride.status === 'active' && !ride.isPast;

  return (
    <div className={`card border-0 shadow-sm mb-3${isActive ? '' : ' opacity-75'}`}>
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between gap-3 mb-2">
          <div>
            <RouteLine from={ride.from} to={ride.to} />
            <div className="mt-2"><RideSummary ride={ride} /></div>
          </div>
          <div className="text-md-end">
            {ride.status === 'cancelled' ? (
              <StatusBadge status="cancelled" />
            ) : ride.isPast ? (
              <span className="badge rounded-pill text-bg-light border">Completed</span>
            ) : (
              <span className={`badge rounded-pill ${ride.availableSeats ? 'text-bg-primary' : 'text-bg-dark'}`}>
                <i className="bi bi-people me-1" />
                {ride.availableSeats} of {ride.seats} seats free
              </span>
            )}
            {pending > 0 && isActive && (
              <div className="small text-warning-emphasis fw-semibold mt-1">
                <i className="bi bi-bell-fill me-1" />{pending} pending request{pending > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {open.length === 0 ? (
          <p className="small text-secondary mb-0 mt-2">
            {isActive ? 'No requests yet. Students will appear here when they ask to join.' : 'No passengers.'}
          </p>
        ) : (
          <ul className="list-group list-group-flush border-top mt-2">
            {open.map((b) => (
              <RequestRow
                key={b._id}
                booking={b}
                canRespond={isActive}
                busy={busyId?.id === b._id ? busyId.action : null}
                onAccept={onAccept}
                onReject={onReject}
              />
            ))}
          </ul>
        )}

        {closed.length > 0 && (
          <>
            <button type="button" className="btn btn-link btn-sm px-0 text-decoration-none" onClick={() => setShowClosed((s) => !s)}>
              <i className={`bi bi-chevron-${showClosed ? 'up' : 'down'} me-1`} />
              {showClosed ? 'Hide' : 'Show'} {closed.length} rejected/cancelled request{closed.length > 1 ? 's' : ''}
            </button>
            {showClosed && (
              <ul className="list-group list-group-flush">
                {closed.map((b) => <RequestRow key={b._id} booking={b} canRespond={false} />)}
              </ul>
            )}
          </>
        )}

        {isActive && (
          <div className="d-flex justify-content-end gap-2 mt-3 pt-3 border-top">
            <Link to={`/rides/${ride._id}/edit`} className="btn btn-outline-primary btn-sm">
              <i className="bi bi-pencil me-1" />Edit
            </Link>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              disabled={busyId?.id === ride._id}
              onClick={() => onCancelRide(ride)}
            >
              {busyId?.id === ride._id ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-trash me-1" />}
              Cancel ride
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function JoinedBooking({ booking, busy, onCancel }) {
  const ride = booking.ride;
  if (!ride) {
    return (
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body small text-secondary">This ride no longer exists. <StatusBadge status={booking.status} /></div>
      </div>
    );
  }
  const departed = new Date(ride.departureAt).getTime() <= Date.now();
  const canCancel =
    (booking.status === 'pending' || booking.status === 'confirmed') && !(booking.status === 'confirmed' && departed);

  return (
    <div className="card border-0 shadow-sm mb-3">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between gap-3">
          <div>
            <RouteLine from={ride.from} to={ride.to} />
            <div className="mt-2"><RideSummary ride={ride} /></div>
          </div>
          <div className="text-md-end">
            <StatusBadge status={booking.status} />
            <div className="small text-secondary mt-1">Requested {formatDateTime(booking.createdAt)}</div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-top d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="small">
            <i className="bi bi-person-circle text-primary me-1" />
            Offered by <strong>{ride.name}</strong>
            {booking.status === 'confirmed' && ride.phone && (
              <>
                {' · '}
                <a href={`tel:${ride.phone}`}><i className="bi bi-telephone me-1" />{ride.phone}</a>
                {' · '}
                <a href={`mailto:${ride.email}`}>{ride.email}</a>
              </>
            )}
            {booking.status === 'pending' && <span className="text-secondary"> · waiting for the owner to respond</span>}
            {booking.status === 'rejected' && <span className="text-secondary"> · the owner declined this request</span>}
            {booking.status === 'cancelled' && (
              <span className="text-secondary"> · {booking.cancelledBy === 'owner' ? 'the owner cancelled this ride' : 'you cancelled this booking'}</span>
            )}
          </div>
          {canCancel && (
            <button type="button" className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => onCancel(booking)}>
              {busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-x-circle me-1" />}
              {booking.status === 'pending' ? 'Withdraw request' : 'Cancel booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyRides() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState(location.state?.tab || 'offered');
  const [offered, setOffered] = useState([]);
  const [joined, setJoined] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.flash ? { type: 'success', text: location.state.flash } : null);
  const [busyId, setBusyId] = useState(null);

  // Clear one-time flash state so it doesn't reappear on refresh.
  useEffect(() => {
    if (location.state?.flash) navigate(location.pathname, { replace: true, state: { tab: location.state.tab } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [ridesData, bookingsData] = await Promise.all([ridesApi.mine(), bookingsApi.mine()]);
      setOffered(ridesData.rides);
      setJoined(bookingsData.bookings);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your rides.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (id, action, fn) => {
    setBusyId({ id, action });
    setNotice(null);
    try {
      const data = await fn();
      setNotice({ type: 'success', text: data.message });
    } catch (err) {
      setNotice({ type: 'danger', text: getErrorMessage(err) });
    } finally {
      setBusyId(null);
      await load({ silent: true }); // always resync seats/status with the server
    }
  };

  const onAccept = (b) => run(b._id, 'accept', () => bookingsApi.accept(b._id));
  const onReject = (b) => {
    if (window.confirm(`Reject ${b.passengerName}'s request?`)) run(b._id, 'reject', () => bookingsApi.reject(b._id));
  };
  const onCancelBooking = (b) => {
    const prompt = b.status === 'confirmed' ? 'Cancel your confirmed seat? It will be released to other students.' : 'Withdraw your request?';
    if (window.confirm(prompt)) run(b._id, 'cancel', () => bookingsApi.cancel(b._id));
  };
  const onCancelRide = (r) => {
    if (window.confirm('Cancel this ride? All pending and confirmed passengers will be notified via their My Rides page.')) {
      run(r._id, 'cancel-ride', () => ridesApi.cancel(r._id));
    }
  };

  const pendingTotal = offered.reduce(
    (sum, r) => sum + (r.status === 'active' && !r.isPast ? r.bookings.filter((b) => b.status === 'pending').length : 0),
    0
  );
  const upcomingOffered = offered.filter((r) => r.status === 'active' && !r.isPast);
  const pastOffered = offered.filter((r) => !(r.status === 'active' && !r.isPast));

  return (
    <div className="container py-4 py-md-5">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">My rides</h1>
          <p className="text-secondary mb-0">Manage rides you offer and rides you've joined.</p>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => load()} disabled={loading}>
          <i className="bi bi-arrow-clockwise me-1" />Refresh
        </button>
      </div>

      {notice && <AlertMessage type={notice.type} onClose={() => setNotice(null)}>{notice.text}</AlertMessage>}
      {error && <AlertMessage>{error}</AlertMessage>}

      <ul className="nav nav-pills mb-4 gap-2" role="tablist">
        <li className="nav-item" role="presentation">
          <button type="button" role="tab" aria-selected={tab === 'offered'} className={`nav-link${tab === 'offered' ? ' active' : ''}`} onClick={() => setTab('offered')}>
            <i className="bi bi-car-front me-1" />Rides I offered
            <span className="badge rounded-pill text-bg-light ms-2">{offered.length}</span>
            {pendingTotal > 0 && <span className="badge rounded-pill text-bg-warning ms-1">{pendingTotal} new</span>}
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button type="button" role="tab" aria-selected={tab === 'joined'} className={`nav-link${tab === 'joined' ? ' active' : ''}`} onClick={() => setTab('joined')}>
            <i className="bi bi-person-check me-1" />Rides I joined
            <span className="badge rounded-pill text-bg-light ms-2">{joined.length}</span>
          </button>
        </li>
      </ul>

      {loading ? (
        <Loading label="Loading your rides..." />
      ) : tab === 'offered' ? (
        <section aria-label="Rides I offered">
          {offered.length === 0 ? (
            <div className="text-center py-5 empty-state">
              <i className="bi bi-car-front display-5 text-primary opacity-50" />
              <p className="text-secondary mt-3">You haven't offered any rides yet.</p>
              <Link to="/offer-ride" className="btn btn-primary">Offer a ride</Link>
            </div>
          ) : (
            <>
              <h2 className="h6 text-uppercase text-secondary fw-bold mb-3">Upcoming ({upcomingOffered.length})</h2>
              {upcomingOffered.length === 0 && <p className="small text-secondary">No upcoming rides.</p>}
              {upcomingOffered.map((ride) => (
                <OfferedRide key={ride._id} ride={ride} busyId={busyId} onAccept={onAccept} onReject={onReject} onCancelRide={onCancelRide} />
              ))}
              {pastOffered.length > 0 && (
                <>
                  <h2 className="h6 text-uppercase text-secondary fw-bold mb-3 mt-4">Past & cancelled ({pastOffered.length})</h2>
                  {pastOffered.map((ride) => (
                    <OfferedRide key={ride._id} ride={ride} busyId={busyId} onAccept={onAccept} onReject={onReject} onCancelRide={onCancelRide} />
                  ))}
                </>
              )}
            </>
          )}
        </section>
      ) : (
        <section aria-label="Rides I joined">
          {joined.length === 0 ? (
            <div className="text-center py-5 empty-state">
              <i className="bi bi-search display-5 text-primary opacity-50" />
              <p className="text-secondary mt-3">You haven't requested any rides yet.</p>
              <Link to="/find-ride" className="btn btn-primary">Find a ride</Link>
            </div>
          ) : (
            joined.map((booking) => (
              <JoinedBooking key={booking._id} booking={booking} busy={busyId?.id === booking._id} onCancel={onCancelBooking} />
            ))
          )}
        </section>
      )}
    </div>
  );
}
