import express from 'express';

import Booking from '../models/Booking.js';
import Message from '../models/Message.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.get('/:bookingId', auth, async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId);

  if (!booking) return res.status(404).json({ message: 'Booking not found.' });

  if (
    ![String(booking.ownerId), String(booking.renterId)].includes(String(req.user._id)) &&
    req.user.role !== 'admin'
  ) {
    return res.status(403).json({ message: 'Not allowed.' });
  }

  const messages = await Message.find({ bookingId: booking._id }).sort({ createdAt: 1 });

  res.json({
    messages: messages.map(m => ({
      id: String(m._id),
      bookingId: String(m.bookingId),
      listingId: String(m.listingId),
      from: m.from,
      text: m.text,
      createdAt: m.createdAt
    }))
  });
});

router.post('/:bookingId', auth, async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId);

  if (!booking) return res.status(404).json({ message: 'Booking not found.' });

  if (![String(booking.ownerId), String(booking.renterId)].includes(String(req.user._id))) {
    return res.status(403).json({ message: 'Only booking parties can chat.' });
  }

  const msg = await Message.create({
    bookingId: booking._id,
    listingId: booking.listingId,
    from: String(req.user._id),
    text: req.body.text
  });

  res.status(201).json({
    message: {
      id: String(msg._id),
      bookingId: String(msg.bookingId),
      listingId: String(msg.listingId),
      from: msg.from,
      text: msg.text,
      createdAt: msg.createdAt
    }
  });
});

export default router;
