import { Route, Routes } from 'react-router-dom';
import Footer from './components/Footer.jsx';
import Navbar from './components/Navbar.jsx';
import { GuestRoute, ProtectedRoute } from './components/ProtectedRoute.jsx';
import FindRide from './pages/FindRide.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import MyRides from './pages/MyRides.jsx';
import NotFound from './pages/NotFound.jsx';
import OfferRide from './pages/OfferRide.jsx';
import Register from './pages/Register.jsx';

export default function App() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <main className="flex-grow-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/find-ride" element={<FindRide />} />
            <Route path="/offer-ride" element={<OfferRide />} />
            <Route path="/rides/:id/edit" element={<OfferRide />} />
            <Route path="/my-rides" element={<MyRides />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
