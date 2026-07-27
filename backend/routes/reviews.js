import express from 'express';

import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.post('/', auth, async (req, res) => {
  const { listingId, rating, comment } = req.body;

  const completed = await Booking.findOne({
    listingId,
    renterId: req.user._id,
    status: { $in: ['paid', 'completed'] }
  });

  if (!completed) {
    return res.status(400).json({ message: 'You can review after booking this listing.' });
  }

  const review = await Review.create({
    listingId,
    userId: req.user._id,
    userName: req.user.name,
    rating: Number(rating),
    comment
  });

  res.status(201).json({
    review: {
      id: String(review._id),
      listingId: String(review.listingId),
      userId: String(review.userId),
      userName: review.userName,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt
    }
  });
});

export default router;
