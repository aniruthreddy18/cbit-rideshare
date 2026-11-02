import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { bookingsApi } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  // Close the mobile menu after navigating; refresh the pending-requests badge.
  useEffect(() => {
    setOpen(false);
    if (!user) {
      setPendingCount(0);
      return;
    }
    let active = true;
    bookingsApi
      .requests('pending')
      .then((data) => active && setPendingCount(data.count || 0))
      .catch(() => active && setPendingCount(0));
    return () => {
      active = false;
    };
  }, [location.pathname, user]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const linkClass = ({ isActive }) => `nav-link px-lg-3${isActive ? ' active' : ''}`;

  return (
    <nav className="navbar navbar-expand-lg navbar-dark app-navbar sticky-top">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center gap-2 fw-bold" to="/">
          <span className="brand-mark"><i className="bi bi-car-front-fill" /></span>
          CBIT RideShare
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          aria-controls="mainNav"
          aria-expanded={open}
          aria-label="Toggle navigation"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className={`collapse navbar-collapse${open ? ' show' : ''}`} id="mainNav">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item"><NavLink className={linkClass} to="/" end>Home</NavLink></li>
            <li className="nav-item"><NavLink className={linkClass} to="/find-ride">Find Ride</NavLink></li>
            <li className="nav-item"><NavLink className={linkClass} to="/offer-ride">Offer Ride</NavLink></li>
            <li className="nav-item">
              <NavLink className={linkClass} to="/my-rides">
                My Rides
                {pendingCount > 0 && (
                  <span className="badge rounded-pill text-bg-warning ms-1" title={`${pendingCount} pending request(s)`}>
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            </li>
          </ul>
          {user ? (
            <div className="d-flex align-items-center gap-3 pb-2 pb-lg-0">
              <span className="text-white-50 small d-none d-lg-inline">
                <i className="bi bi-person-circle me-1" />
                {user.name}
              </span>
              <button type="button" className="btn btn-outline-light btn-sm" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right me-1" />
                Logout
              </button>
            </div>
          ) : (
            <div className="d-flex gap-2 pb-2 pb-lg-0">
              <Link className="btn btn-outline-light btn-sm" to="/login">Login</Link>
              <Link className="btn btn-light btn-sm text-primary fw-semibold" to="/register">Register</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
