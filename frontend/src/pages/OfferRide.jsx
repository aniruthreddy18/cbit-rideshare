import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage, getFieldErrors, ridesApi } from '../api/client.js';
import AlertMessage from '../components/AlertMessage.jsx';
import FormField from '../components/FormField.jsx';
import Loading from '../components/Loading.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatMoney, pricePerSeatOf, todayIST } from '../utils/format.js';
import { COMMON_PLACES } from '../utils/locations.js';

const MAX_SEATS = 6;
const MAX_PRICE = 5000;

// Mirrors parseRideInput() in backend/src/controllers/rideController.js
function validate(form) {
  const errors = {};
  const from = form.from.trim();
  const to = form.to.trim();
  if (from.length < 2) errors.from = 'Enter a pickup location.';
  if (to.length < 2) errors.to = 'Enter a destination.';
  if (!errors.from && !errors.to && from.toLowerCase() === to.toLowerCase()) errors.to = 'Destination must differ from pickup.';

  if (!form.date) errors.date = 'Choose a date.';
  else if (form.date < todayIST()) errors.date = 'Date cannot be in the past.';
  if (!form.time) errors.time = 'Choose a time.';
  if (!errors.date && !errors.time && new Date(`${form.date}T${form.time}:00+05:30`).getTime() <= Date.now()) {
    errors.time = 'Departure time must be in the future.';
  }

  const seats = Number(form.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) errors.seats = `Choose 1-${MAX_SEATS} seats.`;
  const price = Number(form.pricePerSeat);
  if (form.pricePerSeat === '' || !Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
    errors.pricePerSeat = `Enter a price per person between ₹0 and ₹${MAX_PRICE}.`;
  }

  if (!/^(?:\+?91|0)?[6-9]\d{9}$/.test(form.phone.replace(/[\s()-]/g, ''))) errors.phone = 'Enter a valid 10-digit mobile number.';
  return errors;
}

export default function OfferRide() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    from: '',
    to: 'CBIT Campus, Gandipet',
    date: todayIST(),
    time: '',
    seats: '3',
    pricePerSeat: '',
    phone: user?.phone || '',
    notes: '',
  });
  const [bookedSeats, setBookedSeats] = useState(0);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  // Edit mode: load the ride into the form.
  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    ridesApi
      .get(id)
      .then(({ ride }) => {
        if (!active) return;
        if (!ride.isOwner) {
          setError('You can only edit rides you offered.');
          return;
        }
        setForm({
          from: ride.from,
          to: ride.to,
          date: ride.date,
          time: ride.time,
          seats: String(ride.seats),
          pricePerSeat: String(pricePerSeatOf(ride)),
          phone: ride.phone || user?.phone || '',
          notes: ride.notes || '',
        });
        setBookedSeats(ride.seats - ride.availableSeats);
      })
      .catch((err) => active && setError(getErrorMessage(err, 'Could not load this ride.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, isEdit, user?.phone]);

  const onChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((errs) => ({ ...errs, [e.target.name]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate(form);
    if (isEdit && Number(form.seats) < bookedSeats) nextErrors.seats = `${bookedSeats} seat(s) are already taken.`;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError('Please fix the highlighted fields.');
      return;
    }

    setSubmitting(true);
    setError('');
    const payload = {
      ...form,
      from: form.from.trim(),
      to: form.to.trim(),
      seats: Number(form.seats),
      pricePerSeat: Number(form.pricePerSeat),
      notes: form.notes.trim(),
    };
    try {
      const data = isEdit ? await ridesApi.update(id, payload) : await ridesApi.create(payload);
      navigate('/my-rides', { state: { flash: data.message, tab: 'offered' } });
    } catch (err) {
      setError(getErrorMessage(err, isEdit ? 'Could not update the ride.' : 'Could not publish the ride.'));
      setErrors(getFieldErrors(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading label="Loading ride..." />;

  const priceValue = form.pricePerSeat !== '' && Number.isFinite(Number(form.pricePerSeat)) ? Number(form.pricePerSeat) : null;

  return (
    <div className="container py-4 py-md-5">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <h1 className="h3 fw-bold mb-1">{isEdit ? 'Edit your ride' : 'Offer a ride'}</h1>
          <p className="text-secondary mb-4">
            {isEdit ? 'Update the details. Confirmed passengers keep their seats.' : 'Publish your route and let fellow CBIT students share the cost.'}
          </p>

          <AlertMessage onClose={() => setError('')}>{error}</AlertMessage>

          <form className="card border-0 shadow-sm" onSubmit={onSubmit} noValidate>
            <div className="card-body p-4">
              <h2 className="h6 text-uppercase text-secondary fw-bold mb-3">Route</h2>
              <div className="row">
                <div className="col-md-6">
                  <FormField label="From" name="from" icon="geo-alt" list="offer-places" placeholder="e.g. Mehdipatnam" value={form.from} onChange={onChange} error={errors.from} maxLength={100} />
                </div>
                <div className="col-md-6">
                  <FormField label="To" name="to" icon="geo-alt-fill" list="offer-places" placeholder="e.g. CBIT Campus, Gandipet" value={form.to} onChange={onChange} error={errors.to} maxLength={100} />
                </div>
              </div>
              <datalist id="offer-places">
                {COMMON_PLACES.map((p) => <option key={p} value={p} />)}
              </datalist>

              <h2 className="h6 text-uppercase text-secondary fw-bold mb-3 mt-2">Schedule & seats</h2>
              <div className="row">
                <div className="col-sm-6 col-md-3">
                  <FormField label="Date" name="date" type="date" icon="calendar3" min={todayIST()} value={form.date} onChange={onChange} error={errors.date} />
                </div>
                <div className="col-sm-6 col-md-3">
                  <FormField label="Time" name="time" type="time" icon="clock" value={form.time} onChange={onChange} error={errors.time} />
                </div>
                <div className="col-sm-6 col-md-3">
                  <FormField label="Seats offered" name="seats" icon="people" error={errors.seats} hint={isEdit && bookedSeats ? `${bookedSeats} already taken` : undefined}>
                    <select id="field-seats" name="seats" className={`form-select${errors.seats ? ' is-invalid' : ''}`} value={form.seats} onChange={onChange}>
                      {Array.from({ length: MAX_SEATS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </FormField>
                </div>
                <div className="col-sm-6 col-md-3">
                  <FormField label="Price per person (₹)" name="pricePerSeat" type="number" icon="currency-rupee" min="0" max={MAX_PRICE} step="1" placeholder="e.g. 150" value={form.pricePerSeat} onChange={onChange} error={errors.pricePerSeat} />
                </div>
              </div>
              {priceValue !== null && !errors.pricePerSeat && (
                <div className="cost-preview mb-3">
                  <i className="bi bi-calculator me-2" />
                  Each passenger pays <strong>{formatMoney(priceValue)}</strong>. With all {form.seats} seat{form.seats === '1' ? '' : 's'} filled you
                  collect {formatMoney(priceValue)} × {form.seats} = <strong>{formatMoney(priceValue * Number(form.seats))}</strong>.
                </div>
              )}

              <h2 className="h6 text-uppercase text-secondary fw-bold mb-3 mt-2">Contact details</h2>
              <div className="row">
                <div className="col-md-6">
                  <FormField label="Name" name="name" icon="person" value={user?.name || ''} disabled readOnly />
                </div>
                <div className="col-md-6">
                  <FormField label="Email" name="email" icon="envelope" value={user?.email || ''} disabled readOnly />
                </div>
                <div className="col-md-6">
                  <FormField label="Contact phone" name="phone" type="tel" icon="telephone" value={form.phone} onChange={onChange} error={errors.phone} hint="Shown only to passengers you confirm." />
                </div>
                <div className="col-md-6">
                  <FormField label="Notes (optional)" name="notes" icon="chat-left-text" error={errors.notes}>
                    <textarea id="field-notes" name="notes" rows="1" maxLength={300} className="form-control" placeholder="Pickup point, vehicle, luggage..." value={form.notes} onChange={onChange} />
                  </FormField>
                </div>
              </div>

              <div className="d-flex flex-column flex-sm-row justify-content-end gap-2 mt-2">
                <Link to={isEdit ? '/my-rides' : '/find-ride'} className="btn btn-light">Cancel</Link>
                <button type="submit" className="btn btn-primary px-4 fw-semibold" disabled={submitting}>
                  {submitting && <span className="spinner-border spinner-border-sm me-2" />}
                  {isEdit ? 'Save changes' : 'Publish ride'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
