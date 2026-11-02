import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const STEPS = [
  { icon: 'search', title: 'Find a ride', text: 'Search rides by route, date, seats and cost - all offered by verified CBIT students.' },
  { icon: 'send-check', title: 'Request to join', text: 'Send a request. The ride owner accepts or rejects it, and your seat is confirmed instantly.' },
  { icon: 'cash-stack', title: 'Clear per-person price', text: 'Every ride shows exactly what one seat costs - no hidden calculations.' },
];

const FEATURES = [
  { icon: 'mortarboard', title: 'Made for CBIT students', text: 'Find classmates on your route. Sign up with any email in seconds.' },
  { icon: 'person-check', title: 'Owner approval', text: 'Ride owners decide who joins. Seats update automatically.' },
  { icon: 'telephone', title: 'Private contact details', text: 'Phone numbers are shared only after a booking is confirmed.' },
  { icon: 'arrow-counterclockwise', title: 'Flexible cancellation', text: 'Plans changed? Cancel and the seat goes back to the ride.' },
];

export default function Home() {
  const { user } = useAuth();
  const guard = (path) => (user ? path : '/login');

  return (
    <>
      <section className="hero">
        <div className="container py-5">
          <div className="row align-items-center gx-0 gx-lg-5 gy-5 py-lg-4">
            <div className="col-lg-7 text-center text-lg-start">
              <span className="badge rounded-pill hero-badge mb-3">
                <i className="bi bi-mortarboard-fill me-1" /> Exclusively for CBIT Hyderabad
              </span>
              <h1 className="display-5 fw-bold text-white mb-3">
                Share your ride to campus. <span className="hero-accent">Split the cost.</span>
              </h1>
              <p className="lead text-white-50 mb-4">
                CBIT RideShare connects students travelling the same route to Gandipet and back - safer, cheaper and
                greener than travelling alone.
              </p>
              <div className="d-flex flex-column flex-sm-row gap-3 justify-content-center justify-content-lg-start">
                <Link to={guard('/find-ride')} state={{ from: '/find-ride' }} className="btn btn-light btn-lg text-primary fw-semibold px-4">
                  <i className="bi bi-search me-2" /> Find Ride
                </Link>
                <Link to={guard('/offer-ride')} state={{ from: '/offer-ride' }} className="btn btn-outline-light btn-lg px-4">
                  <i className="bi bi-plus-circle me-2" /> Offer Ride
                </Link>
              </div>
              {!user && (
                <p className="text-white-50 small mt-3 mb-0">
                  New here? <Link to="/register" className="link-light fw-semibold">Create your account</Link> in under a minute.
                </p>
              )}
            </div>
            <div className="col-lg-5 d-none d-lg-block">
              <div className="hero-card shadow-lg">
                <div className="d-flex align-items-center gap-3 mb-3">
                  <span className="hero-card-icon"><i className="bi bi-geo-alt-fill" /></span>
                  <div>
                    <div className="small text-secondary">Daily commute</div>
                    <div className="fw-bold">Your area → CBIT, Gandipet</div>
                  </div>
                </div>
                <ul className="list-unstyled mb-0 small">
                  <li className="mb-2"><i className="bi bi-check2-circle text-success me-2" />Verified student riders</li>
                  <li className="mb-2"><i className="bi bi-check2-circle text-success me-2" />Owner-approved bookings</li>
                  <li><i className="bi bi-check2-circle text-success me-2" />Live seat availability</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5">
        <h2 className="h3 fw-bold text-center mb-2">How it works</h2>
        <p className="text-secondary text-center mb-4">Three steps to your next shared ride.</p>
        <div className="row g-4">
          {STEPS.map((step, i) => (
            <div className="col-md-4" key={step.title}>
              <div className="card h-100 border-0 shadow-sm step-card">
                <div className="card-body p-4">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <span className="step-icon"><i className={`bi bi-${step.icon}`} /></span>
                    <span className="text-secondary small fw-semibold">STEP {i + 1}</span>
                  </div>
                  <h3 className="h5 fw-bold">{step.title}</h3>
                  <p className="text-secondary mb-0">{step.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border-top border-bottom">
        <div className="container py-5">
          <div className="row g-4">
            {FEATURES.map((f) => (
              <div className="col-sm-6 col-lg-3" key={f.title}>
                <i className={`bi bi-${f.icon} fs-3 text-primary`} />
                <h3 className="h6 fw-bold mt-2">{f.title}</h3>
                <p className="small text-secondary mb-0">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
