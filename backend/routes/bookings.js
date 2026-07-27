import express from 'express';

import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import Message from '../models/Message.js';
import { auth } from '../middleware/auth.js';
import { cleanBooking } from '../utils/format.js';
import { getPaymentMode, initializePayment, verifyPayment } from '../utils/paystack.js';

const router = express.Router();

const nights = (a, b) =>
  Math.max(1, Math.ceil((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24)));

const overlaps = (aStart, aEnd, bStart, bEnd) =>
  new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);

router.get('/', auth, async (req, res) => {
  const query =
    req.user.role === 'admin'
      ? {}
      : { $or: [{ renterId: req.user._id }, { ownerId: req.user._id }] };

  const bookings = await Booking.find(query)
    .populate('listingId')
    .sort({ createdAt: -1 });

  res.json({
    bookings: bookings.map(b => cleanBooking(b, b.listingId))
  });
});

router.post('/', auth, async (req, res) => {
  const { listingId, startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'Please select start and end dates.' });
  }

  const listing = await Listing.findById(listingId);

  if (!listing) return res.status(404).json({ message: 'Listing not found.' });

  if (String(listing.ownerId) === String(req.user._id)) {
    return res.status(400).json({ message: 'You cannot book your own listing.' });
  }

  const existing = await Booking.find({
    listingId,
    status: { $in: ['paid', 'confirmed'] }
  });

  const conflict = existing.some(b => overlaps(startDate, endDate, b.startDate, b.endDate));

  if (conflict) {
    return res.status(409).json({ message: 'These dates are not available. Please select different dates.' });
  }

  const days = nights(startDate, endDate);
  const subtotal = listing.price * days;
  const platformFee = Math.round(subtotal * Number(process.env.PLATFORM_FEE_RATE || 0.04));
  const total = subtotal + platformFee;
  const reference = `RTF-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const booking = await Booking.create({
    listingId: listing._id,
    renterId: req.user._id,
    ownerId: listing.ownerId,
    startDate,
    endDate,
    days,
    subtotal,
    platformFee,
    total,
    status: 'pending_payment',
    reference
  });

  const payment = await initializePayment({
    email: req.user.email,
    amount: total,
    reference,
    metadata: {
      bookingId: String(booking._id),
      listingId: String(listing._id),
      platformFee
    }
  });

  res.status(201).json({
    booking: cleanBooking(booking, listing),
    payment,
    paymentMode: getPaymentMode()
  });
});

router.post('/verify/:reference', auth, async (req, res) => {
  const booking = await Booking.findOne({
    reference: req.params.reference,
    renterId: req.user._id
  }).populate('listingId');

  if (!booking) return res.status(404).json({ message: 'Booking not found.' });

  const verification = await verifyPayment(req.params.reference);

  if (verification.status !== 'success') {
    booking.status = 'failed';
    await booking.save();
    return res.status(400).json({ message: 'Payment was not successful.', booking: cleanBooking(booking, booking.listingId) });
  }

  booking.status = 'paid';
  booking.paidAt = new Date();
  await booking.save();

  const existingSystemMessage = await Message.findOne({
    bookingId: booking._id,
    from: 'system'
  });

  if (!existingSystemMessage) {
    await Message.create({
      bookingId: booking._id,
      listingId: booking.listingId._id,
      from: 'system',
      text: 'Booking payment confirmed. Please keep communication on Rentify for safety and support.'
    });
  }

  res.json({
    booking: cleanBooking(booking, booking.listingId),
    verification: {
      reference: verification.reference,
      status: verification.status,
      amount: verification.amount
    }
  });
});

router.patch('/:id/status', auth, async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) return res.status(404).json({ message: 'Booking not found.' });

  if (
    ![String(booking.ownerId), String(booking.renterId)].includes(String(req.user._id)) &&
    req.user.role !== 'admin'
  ) {
    return res.status(403).json({ message: 'Not allowed.' });
  }

  booking.status = req.body.status || booking.status;
  await booking.save();

  res.json({ booking: cleanBooking(booking) });
});

export default router;
