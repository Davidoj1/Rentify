import express from 'express';
import mongoose from 'mongoose';

import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';

import { auth } from '../middleware/auth.js';

const router = express.Router();

function cleanReview(review) {
  return {
    id: String(review._id),
    bookingId: review.bookingId
      ? String(review.bookingId)
      : null,
    listingId: String(review.listingId),
    userId: String(review.userId),
    userName: review.userName,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt
  };
}


/*
|--------------------------------------------------------------------------
| Refresh listing average rating
|--------------------------------------------------------------------------
*/
async function refreshListingRating(listingId) {
  const result = await Review.aggregate([
    {
      $match: {
        listingId:
          new mongoose.Types.ObjectId(listingId)
      }
    },

    {
      $group: {
        _id: '$listingId',
        average: {
          $avg: '$rating'
        }
      }
    }
  ]);

  const average = result.length
    ? Math.round(
        result[0].average * 10
      ) / 10
    : 0;

  await Listing.findByIdAndUpdate(
    listingId,
    {
      $set: {
        rating: average
      }
    }
  );

  return average;
}


/*
|--------------------------------------------------------------------------
| GET /api/reviews/listing/:listingId
|--------------------------------------------------------------------------
| Public reviews for a listing.
|--------------------------------------------------------------------------
*/
router.get(
  '/listing/:listingId',
  async (req, res) => {
    const {
      listingId
    } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        listingId
      )
    ) {
      return res.status(400).json({
        message:
          'Invalid listing ID.'
      });
    }

    const reviews =
      await Review.find({
        listingId
      }).sort({
        createdAt: -1
      });

    res.json({
      reviews:
        reviews.map(cleanReview)
    });
  }
);


/*
|--------------------------------------------------------------------------
| GET /api/reviews/booking/:bookingId
|--------------------------------------------------------------------------
| Check whether the current renter has already reviewed
| a particular booking.
|--------------------------------------------------------------------------
*/
router.get(
  '/booking/:bookingId',
  auth,
  async (req, res) => {
    const {
      bookingId
    } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        bookingId
      )
    ) {
      return res.status(400).json({
        message:
          'Invalid booking ID.'
      });
    }

    const booking =
      await Booking.findById(
        bookingId
      );

    if (!booking) {
      return res.status(404).json({
        message:
          'Booking not found.'
      });
    }

    if (
      String(booking.renterId) !==
      String(req.user._id)
    ) {
      return res.status(403).json({
        message:
          'Only the renter can view this booking review.'
      });
    }

    const review =
      await Review.findOne({
        bookingId:
          booking._id,

        userId:
          req.user._id
      });

    res.json({
      review: review
        ? cleanReview(review)
        : null
    });
  }
);


/*
|--------------------------------------------------------------------------
| POST /api/reviews
|--------------------------------------------------------------------------
| Create a review.
|
| Security rules:
|
| 1. User must be authenticated.
| 2. User must be the renter on the booking.
| 3. Booking must be completed.
| 4. Rating must be 1-5.
| 5. Comment is required.
| 6. Only one review per booking.
|--------------------------------------------------------------------------
*/
router.post(
  '/',
  auth,
  async (req, res) => {
    const {
      bookingId,
      rating,
      comment
    } = req.body;


    /*
     * Validate booking ID.
     */
    if (!bookingId) {
      return res.status(400).json({
        message:
          'Booking ID is required.'
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        bookingId
      )
    ) {
      return res.status(400).json({
        message:
          'Invalid booking ID.'
      });
    }


    /*
     * Validate rating.
     */
    const numericRating =
      Number(rating);

    if (
      !Number.isInteger(
        numericRating
      ) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        message:
          'Rating must be a whole number from 1 to 5.'
      });
    }


    /*
     * Validate comment.
     */
    if (
      typeof comment !==
      'string'
    ) {
      return res.status(400).json({
        message:
          'Please write a review.'
      });
    }

    const cleanComment =
      comment.trim();

    if (!cleanComment) {
      return res.status(400).json({
        message:
          'Please write a review.'
      });
    }

    if (
      cleanComment.length >
      1000
    ) {
      return res.status(400).json({
        message:
          'Review must be 1000 characters or fewer.'
      });
    }


    /*
     * Load booking.
     */
    const booking =
      await Booking.findById(
        bookingId
      );

    if (!booking) {
      return res.status(404).json({
        message:
          'Booking not found.'
      });
    }


    /*
     * Only the actual renter can review.
     */
    if (
      String(booking.renterId) !==
      String(req.user._id)
    ) {
      return res.status(403).json({
        message:
          'Only the renter who made the booking can review it.'
      });
    }


    /*
     * Reviews are only allowed after
     * the rental has completed.
     */
    if (
      booking.status !==
      'completed'
    ) {
      return res.status(400).json({
        message:
          'You can only review a completed booking.'
      });
    }


    /*
     * Prevent duplicate reviews.
     */
    const existing =
      await Review.findOne({
        bookingId:
          booking._id
      });

    if (existing) {
      return res.status(409).json({
        message:
          'You have already reviewed this booking.',

        review:
          cleanReview(existing)
      });
    }


    /*
     * Get the current renter name.
     */
    const User =
      mongoose.model('User');

    const renter =
      await User.findById(
        req.user._id
      );

    if (!renter) {
      return res.status(404).json({
        message:
          'Renter account not found.'
      });
    }


    /*
     * Create review.
     */
    const review =
      await Review.create({
        bookingId:
          booking._id,

        listingId:
          booking.listingId,

        userId:
          req.user._id,

        userName:
          renter.name,

        rating:
          numericRating,

        comment:
          cleanComment
      });


    /*
     * Recalculate listing rating.
     */
    const averageRating =
      await refreshListingRating(
        booking.listingId
      );


    res.status(201).json({
      review:
        cleanReview(review),

      averageRating
    });
  }
);


export default router;
