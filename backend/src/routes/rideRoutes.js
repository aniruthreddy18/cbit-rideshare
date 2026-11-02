import { Router } from 'express';
import { requestBooking } from '../controllers/bookingController.js';
import { cancelRide, createRide, getMyRides, getRide, listRides, updateRide } from '../controllers/rideController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', listRides);
router.post('/', createRide);
router.get('/mine', getMyRides); // must stay above '/:id'
router.get('/:id', getRide);
router.put('/:id', updateRide);
router.delete('/:id', cancelRide);
router.post('/:id/join', requestBooking);

export default router;
