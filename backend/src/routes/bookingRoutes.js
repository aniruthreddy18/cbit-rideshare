import { Router } from 'express';
import {
  acceptBooking,
  cancelBooking,
  getMyBookings,
  getOwnerRequests,
  rejectBooking,
  requestBooking,
} from '../controllers/bookingController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.post('/', requestBooking);
router.get('/mine', getMyBookings);
router.get('/requests', getOwnerRequests);
router.patch('/:id/accept', acceptBooking);
router.patch('/:id/reject', rejectBooking);
router.patch('/:id/cancel', cancelBooking);

export default router;
