import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { bookingsApi, getErrorMessage, ridesApi } from '../api/client.js';
import AlertMessage from '../components/AlertMessage.jsx';
import Loading from '../components/Loading.jsx';
import RideCard from '../components/RideCard.jsx';
import RouteLine from '../components/RouteLine.jsx';
import { formatDate, formatMoney, formatTime, pricePerSeatOf, todayIST } from '../utils/format.js';
import { COMMON_PLACES } from '../utils/locations.js';

const FILTER_KEYS = ['q', 'from', 'to', 'date', 'minSeats', 'maxPrice', 'sort'];
const EMPTY_FILTERS = { q: '', from: '', to: '', date: '', minSeats: '1', maxPrice: '', sort: 'soonest' };

function filtersFromParams(params) {
  const filters = { ...EMPTY_FILTERS };
  for (const key of FILTER_KEYS) if (params.get(key)) filters[key] = params.get(key);
  return filters;
}

export default function FindRide() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromParams(searchParams));
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [joinTarget, setJoinTarget] = useState(null);
  const [joinMessage, setJoinMessage] = useState('');
  const [joiningId, setJoiningId] = useState(null);

  const loadRides = useCallback(async (params) => {
    setLoading(true);
    setError('');
    try {
      const query = Object.fromEntries(FILTER_KEYS.filter((k) => params.get(k)).map((k) => [k, params.get(k)]));
      const data = await ridesApi.list(query);
      setRides(data.rides);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load rides.'));
      setRides([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // The URL is the source of truth for filters, so searches survive refresh/back.
  useEffect(() => {
    loadRides(searchParams);
  }, [searchParams, loadRides]);

  const onChange = (e) => setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));

  const applyFilters = (e) => {
    e?.preventDefault();
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = String(filters[key] ?? '').trim();
      if (value && value !== EMPTY_FILTERS[key]) next.set(key, value);
    }
    setSearchParams(next);
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchParams(new URLSearchParams());
  };

  const confirmJoin = async () => {
    const ride = joinTarget;
    setJoiningId(ride._id);
    setNotice(null);
    try {
      const data = await bookingsApi.request(ride._id, joinMessage.trim());
      setRides((list) => list.map((r) => (r._id === ride._id ? { ...r, myBooking: { _id: data.booking._id, status: 'pending' } } : r)));
      setNotice({ type: 'success', text: `${data.message} Track it under My Rides.` });
      setJoinTarget(null);
      setJoinMessage('');
    } catch (err) {
      setNotice({ type: 'danger', text: getErrorMessage(err, 'Could not send the request.') });
      setJoinTarget(null);
      loadRides(searchParams); // seats or status may have changed
    } finally {
      setJoiningId(null);
    }
  };

  const activeFilterCount = FILTER_KEYS.filter((k) => searchParams.get(k)).length;

  return (
    <div className="container py-4 py-md-5">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Find a ride</h1>
          <p className="text-secondary mb-0">Upcoming rides offered by CBIT students with seats available.</p>
        </div>
        <Link to="/offer-ride" className="btn btn-outline-primary"><i className="bi bi-plus-circle me-1" />Offer a ride</Link>
      </div>

      <form className="card border-0 shadow-sm mb-4" onSubmit={applyFilters}>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12">
              <div className="input-group">
                <span className="input-group-text bg-white"><i className="bi bi-search" /></span>
                <input
                  name="q"
                  className="form-control"
                  placeholder="Search by place or rider name..."
                  value={filters.q}
                  onChange={onChange}
                  aria-label="Search rides"
                />
                <button className="btn btn-primary px-4" type="submit">Search</button>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <label className="form-label small fw-semibold" htmlFor="f-from">From</label>
              <input id="f-from" name="from" list="places" className="form-control" placeholder="Any" value={filters.from} onChange={onChange} />
            </div>
            <div className="col-sm-6 col-lg-3">
              <label className="form-label small fw-semibold" htmlFor="f-to">To</label>
              <input id="f-to" name="to" list="places" className="form-control" placeholder="Any" value={filters.to} onChange={onChange} />
            </div>
            <div className="col-sm-4 col-lg-2">
              <label className="form-label small fw-semibold" htmlFor="f-date">Date</label>
              <input id="f-date" name="date" type="date" min={todayIST()} className="form-control" value={filters.date} onChange={onChange} />
            </div>
            <div className="col-sm-4 col-lg-2">
              <label className="form-label small fw-semibold" htmlFor="f-seats">Seats needed</label>
              <select id="f-seats" name="minSeats" className="form-select" value={filters.minSeats} onChange={onChange}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}+</option>)}
              </select>
            </div>
            <div className="col-sm-4 col-lg-2">
              <label className="form-label small fw-semibold" htmlFor="f-cost">Max price / person (₹)</label>
              <input id="f-cost" name="maxPrice" type="number" min="0" step="10" className="form-control" placeholder="Any" value={filters.maxPrice} onChange={onChange} />
            </div>
          </div>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
            <div className="d-flex align-items-center gap-2">
              <label className="small text-secondary" htmlFor="f-sort">Sort by</label>
              <select id="f-sort" name="sort" className="form-select form-select-sm w-auto" value={filters.sort} onChange={onChange}>
                <option value="soonest">Departure (soonest)</option>
                <option value="cheapest">Price per person (lowest)</option>
                <option value="seats">Seats left (most)</option>
              </select>
            </div>
            <div className="d-flex gap-2">
              {activeFilterCount > 0 && (
                <button type="button" className="btn btn-sm btn-link text-decoration-none" onClick={resetFilters}>
                  <i className="bi bi-x-circle me-1" />Clear filters
                </button>
              )}
              <button type="submit" className="btn btn-sm btn-primary"><i className="bi bi-funnel me-1" />Apply filters</button>
            </div>
          </div>
        </div>
        <datalist id="places">
          {COMMON_PLACES.map((p) => <option key={p} value={p} />)}
        </datalist>
      </form>

      {notice && <AlertMessage type={notice.type} onClose={() => setNotice(null)}>{notice.text}</AlertMessage>}
      {error && (
        <AlertMessage>
          {error}{' '}
          <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => loadRides(searchParams)}>Retry</button>
        </AlertMessage>
      )}

      {loading ? (
        <Loading label="Finding rides..." />
      ) : !error && rides.length === 0 ? (
        <div className="text-center py-5 empty-state">
          <i className="bi bi-car-front display-4 text-primary opacity-50" />
          <h2 className="h5 fw-bold mt-3">No rides match your search</h2>
          <p className="text-secondary">
            {activeFilterCount ? 'Try removing some filters, or ' : 'Nobody has offered an upcoming ride yet. '}
            be the first to offer one.
          </p>
          <Link to="/offer-ride" className="btn btn-primary">Offer a ride</Link>
        </div>
      ) : (
        <>
          {!error && <p className="small text-secondary mb-3">{rides.length} ride{rides.length === 1 ? '' : 's'} found</p>}
          <div className="row g-4">
            {rides.map((ride) => (
              <div className="col-md-6 col-xl-4" key={ride._id}>
                <RideCard ride={ride} onJoin={setJoinTarget} joining={joiningId === ride._id} />
              </div>
            ))}
          </div>
        </>
      )}

      {joinTarget && (
        <>
          <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="join-title">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <h2 className="modal-title h5 fw-bold" id="join-title">Request to join</h2>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setJoinTarget(null)} disabled={!!joiningId} />
                </div>
                <div className="modal-body">
                  <RouteLine from={joinTarget.from} to={joinTarget.to} />
                  <p className="small text-secondary mt-3 mb-3">
                    {formatDate(joinTarget.date)} at {formatTime(joinTarget.time)} · <strong>{formatMoney(pricePerSeatOf(joinTarget))} per person</strong> ·
                    offered by <strong>{joinTarget.name}</strong>
                  </p>
                  <label className="form-label small fw-semibold" htmlFor="join-message">Message to the owner (optional)</label>
                  <textarea
                    id="join-message"
                    className="form-control"
                    rows="2"
                    maxLength={200}
                    placeholder="e.g. I'll wait at the main gate"
                    value={joinMessage}
                    onChange={(e) => setJoinMessage(e.target.value)}
                  />
                  <div className="form-text">Your name, email and phone are shared with the ride owner.</div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={() => setJoinTarget(null)} disabled={!!joiningId}>Cancel</button>
                  <button type="button" className="btn btn-primary" onClick={confirmJoin} disabled={!!joiningId}>
                    {joiningId && <span className="spinner-border spinner-border-sm me-2" />}
                    Send request
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      )}
    </div>
  );
}
