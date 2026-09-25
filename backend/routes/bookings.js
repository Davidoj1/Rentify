import express from 'express';

import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import Message from '../models/Message.js';
import { auth } from '../middleware/auth.js';
import { cleanBooking } from '../utils/format.js';
import {
  getPaymentMode,
  initializePayment,
  verifyPayment
} from '../utils/paystack.js';

const router = express.Router();

const MAX_BOOKING_DAYS = 365;
const MAX_DATE_YEARS_AHEAD = 2;

const nights = (a, b) =>
  Math.max(
    1,
    Math.ceil(
      (new Date(`${b}T00:00:00Z`) -
        new Date(`${a}T00:00:00Z`)) /
        (1000 * 60 * 60 * 24)
    )
  );

const overlaps = (
  aStart,
  aEnd,
  bStart,
  bEnd
) =>
  new Date(`${aStart}T00:00:00Z`) <
    new Date(`${bEnd}T00:00:00Z`) &&
  new Date(`${bStart}T00:00:00Z`) <
    new Date(`${aEnd}T00:00:00Z`);

function isValidObjectId(id) {
  return /^[a-fA-F0-9]{24}$/.test(String(id || ''));
}

function isValidDateString(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.toISOString().slice(0, 10) === value
  );
}

function todayDateString() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function maxAllowedStartDateString() {
  const date = new Date();

  date.setUTCFullYear(
    date.getUTCFullYear() +
      MAX_DATE_YEARS_AHEAD
  );

  return date.toISOString().slice(0, 10);
}

function isValidReference(reference) {
  return (
    typeof reference === 'string' &&
    reference.length >= 3 &&
    reference.length <= 100 &&
    /^[A-Za-z0-9_.=-]+$/.test(reference)
  );
}

async function completeExpiredBookings() {
  const today = todayDateString();

  await Booking.updateMany(
    {
      status: 'confirmed',
      endDate: { $lte: today }
    },
    {
      $set: {
        status: 'completed'
      }
    }
  );
}

/*
|--------------------------------------------------------------------------
| GET /api/bookings
|--------------------------------------------------------------------------
| Renting mode:
|   Gets bookings where the user is the renter.
|
| Hosting mode:
|   Gets bookings where the user owns the listing.
|
| Admin:
|   Gets all bookings.
|--------------------------------------------------------------------------
*/
router.get('/', auth, async (req, res) => {
  try {
    await completeExpiredBookings();

    let query;

    if (req.user.role === 'admin') {
      query = {};
    } else if (
      req.user.activeMode === 'hosting'
    ) {
      query = {
        ownerId: req.user._id
      };
    } else {
      query = {
        renterId: req.user._id
      };
    }

    const bookings = await Booking.find(query)
      .populate('listingId')
      .populate('renterId')
      .populate('ownerId')
      .sort({ createdAt: -1 })
      .limit(200);

    res.json({
      bookings: bookings.map(b =>
        cleanBooking(b, b.listingId)
      )
    });
  } catch (error) {
    console.error('Get bookings error:', error);

    res.status(500).json({
      message: 'Could not load bookings.'
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/bookings
|--------------------------------------------------------------------------
| Creates a pending booking and initializes Paystack.
|
| The server calculates the booking amount from:
| listing price × booking days + platform fee.
|
| The client never controls subtotal, fee, total,
| ownerId, renterId, or payment status.
|--------------------------------------------------------------------------
*/
router.post('/', auth, async (req, res) => {
  let booking = null;

  try {
    const body = req.body || {};

    const {
      listingId,
      startDate,
      endDate
    } = body;

    if (!isValidObjectId(listingId)) {
      return res.status(400).json({
        message: 'Invalid listing ID.'
      });
    }

    if (
      !isValidDateString(startDate) ||
      !isValidDateString(endDate)
    ) {
      return res.status(400).json({
        message:
          'Start and end dates must use the YYYY-MM-DD format.'
      });
    }

    if (endDate <= startDate) {
      return res.status(400).json({
        message:
          'End date must be after the start date.'
      });
    }

    const today = todayDateString();

    if (startDate < today) {
      return res.status(400).json({
        message:
          'Booking start date cannot be in the past.'
      });
    }

    const maxStartDate =
      maxAllowedStartDateString();

    if (startDate > maxStartDate) {
      return res.status(400).json({
        message:
          'Booking start date is too far in the future.'
      });
    }

    const days = nights(
      startDate,
      endDate
    );

    if (
      !Number.isInteger(days) ||
      days < 1 ||
      days > MAX_BOOKING_DAYS
    ) {
      return res.status(400).json({
        message:
          `Booking duration must be between 1 and ${MAX_BOOKING_DAYS} days.`
      });
    }

    const listing =
      await Listing.findById(listingId);

    if (!listing) {
      return res.status(404).json({
        message: 'Listing not found.'
      });
    }

    if (
      String(listing.ownerId) ===
      String(req.user._id)
    ) {
      return res.status(400).json({
        message:
          'You cannot book your own listing.'
      });
    }

    if (!listing.available) {
      return res.status(400).json({
        message:
          'This listing is currently unavailable.'
      });
    }

    if (listing.status !== 'active') {
      return res.status(400).json({
        message:
          'This listing is not currently available for booking.'
      });
    }

    const existing = await Booking.find({
      listingId: listing._id,
      status: {
        $in: ['paid', 'confirmed']
      }
    });

    const conflict = existing.some(b =>
      overlaps(
        startDate,
        endDate,
        b.startDate,
        b.endDate
      )
    );

    if (conflict) {
      return res.status(409).json({
        message:
          'These dates are not available. Please select different dates.'
      });
    }

    const listingPrice =
      Number(listing.price);

    if (
      !Number.isFinite(listingPrice) ||
      listingPrice <= 0
    ) {
      return res.status(400).json({
        message:
          'This listing has an invalid price and cannot be booked.'
      });
    }

    const feeRate = Number(
      process.env.PLATFORM_FEE_RATE || 0.04
    );

    if (
      !Number.isFinite(feeRate) ||
      feeRate < 0 ||
      feeRate > 1
    ) {
      console.error(
        'Invalid PLATFORM_FEE_RATE configuration.'
      );

      return res.status(500).json({
        message:
          'Payment configuration is invalid.'
      });
    }

    const subtotal =
      listingPrice * days;

    const platformFee =
      Math.round(
        subtotal * feeRate
      );

    const total =
      subtotal + platformFee;

    if (
      !Number.isFinite(subtotal) ||
      !Number.isFinite(platformFee) ||
      !Number.isFinite(total) ||
      total <= 0
    ) {
      return res.status(400).json({
        message:
          'Could not calculate the booking amount.'
      });
    }

    const reference =
      `RTF-${Date.now()}-${Math.floor(
        Math.random() * 100000
      )}`;

    booking = await Booking.create({
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

    let payment;

    try {
      payment =
        await initializePayment({
          email: req.user.email,
          amount: total,
          reference,

          metadata: {
            bookingId:
              String(booking._id),

            listingId:
              String(listing._id),

            platformFee
          }
        });
    } catch (paymentError) {
      console.error(
        'Paystack initialization error:',
        paymentError
      );

      booking.status = 'failed';
      await booking.save();

      return res.status(502).json({
        message:
          'Could not initialize payment. Please try again.'
      });
    }

    await booking.populate(
      'renterId'
    );

    await booking.populate(
      'ownerId'
    );

    res.status(201).json({
      booking: cleanBooking(
        booking,
        listing
      ),

      payment,

      paymentMode:
        getPaymentMode()
    });
  } catch (error) {
    console.error(
      'Create booking error:',
      error
    );

    if (booking) {
      try {
        booking.status = 'failed';
        await booking.save();
      } catch (saveError) {
        console.error(
          'Could not mark failed booking:',
          saveError
        );
      }
    }

    res.status(500).json({
      message:
        'Could not create booking.'
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/bookings/verify/:reference
|--------------------------------------------------------------------------
| Verifies the Paystack payment.
|
| Only the renter who owns the booking can verify it.
|
| Payment is accepted only when:
|   1. Paystack transaction status is success
|   2. Paystack reference matches the booking reference
|   3. Paystack amount matches booking.total
|   4. Currency is NGN when Paystack provides it
|--------------------------------------------------------------------------
*/
router.post(
  '/verify/:reference',
  auth,
  async (req, res) => {
    try {
      const reference =
        req.params.reference;

      if (
        !isValidReference(reference)
      ) {
        return res.status(400).json({
          message:
            'Invalid payment reference.'
        });
      }

      const booking =
        await Booking.findOne({
          reference,
          renterId: req.user._id
        })
          .populate('listingId')
          .populate('renterId')
          .populate('ownerId');

      if (!booking) {
        return res.status(404).json({
          message:
            'Booking not found.'
        });
      }

      /*
       * Already-paid bookings are idempotent.
       */
      if (
        [
          'paid',
          'confirmed',
          'completed'
        ].includes(booking.status)
      ) {
        return res.json({
          booking: cleanBooking(
            booking,
            booking.listingId
          ),

          verification: {
            reference:
              booking.reference,

            status: 'success',

            amount:
              Math.round(
                booking.total * 100
              )
          }
        });
      }

      if (
        booking.status !==
        'pending_payment'
      ) {
        return res.status(400).json({
          message:
            `This booking cannot be paid because its current status is ${booking.status}`
        });
      }

      let verification;

      try {
        verification =
          await verifyPayment(
            reference
          );
      } catch (verificationError) {
        console.error(
          'Paystack verification error:',
          verificationError
        );

        return res.status(502).json({
          message:
            'Could not verify payment. Please try again.'
        });
      }

      if (
        !verification ||
        verification.status !==
          'success'
      ) {
        booking.status = 'failed';

        await booking.save();

        return res.status(400).json({
          message:
            'Payment was not successful.',

          booking: cleanBooking(
            booking,
            booking.listingId
          )
        });
      }

      /*
       * Never trust the reference supplied by
       * the browser alone.
       */
      if (
        verification.reference !==
        booking.reference
      ) {
        console.error(
          'Paystack reference mismatch:',
          {
            bookingReference:
              booking.reference,
            verificationReference:
              verification.reference
          }
        );

        booking.status = 'failed';

        await booking.save();

        return res.status(400).json({
          message:
            'Payment reference could not be verified.'
        });
      }

      /*
       * Paystack returns amount in the
       * smallest currency unit (kobo for NGN).
       */
      const expectedAmount =
        Math.round(
          booking.total * 100
        );

      const verifiedAmount =
        Number(
          verification.amount
        );

      if (
        !Number.isFinite(
          verifiedAmount
        ) ||
        verifiedAmount !==
          expectedAmount
      ) {
        console.error(
          'Paystack amount mismatch:',
          {
            bookingId:
              String(booking._id),
            expectedAmount,
            verifiedAmount
          }
        );

        booking.status = 'failed';

        await booking.save();

        return res.status(400).json({
          message:
            'Payment amount could not be verified.'
        });
      }

      /*
       * Rentify currently operates in NGN.
       * If Paystack supplies a currency field,
       * it must match NGN.
       */
      if (
        verification.currency &&
        verification.currency !==
          'NGN'
      ) {
        console.error(
          'Paystack currency mismatch:',
          {
            bookingId:
              String(booking._id),
            currency:
              verification.currency
          }
        );

        booking.status = 'failed';

        await booking.save();

        return res.status(400).json({
          message:
            'Payment currency could not be verified.'
        });
      }

      /*
       * Payment is now verified.
       */
      booking.status = 'paid';
      booking.paidAt = new Date();

      await booking.save();

      /*
       * Add one system message to the
       * conversation.
       */
      const existingSystemMessage =
        await Message.findOne({
          bookingId: booking._id,
          from: 'system'
        });

      if (!existingSystemMessage) {
        await Message.create({
          bookingId:
            booking._id,

          listingId:
            booking.listingId._id,

          from: 'system',

          text:
            'Booking payment confirmed. Please keep communication on Rentify for safety and support.'
        });
      }

      res.json({
        booking: cleanBooking(
          booking,
          booking.listingId
        ),

        verification: {
          reference:
            verification.reference,

          status:
            verification.status,

          amount:
            verification.amount
        }
      });
    } catch (error) {
      console.error(
        'Verify booking payment error:',
        error
      );

      res.status(500).json({
        message:
          'Could not verify booking payment.'
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| PATCH /api/bookings/:id/status
|--------------------------------------------------------------------------
| Only the listing owner/admin can manage
| booking lifecycle statuses.
|
| Payment status itself comes only from
| Paystack verification.
|--------------------------------------------------------------------------
*/
router.patch(
  '/:id/status',
  auth,
  async (req, res) => {
    try {
      await completeExpiredBookings();

      if (
        !isValidObjectId(req.params.id)
      ) {
        return res.status(400).json({
          message:
            'Invalid booking ID.'
        });
      }

      const booking =
        await Booking.findById(
          req.params.id
        );

      if (!booking) {
        return res.status(404).json({
          message:
            'Booking not found.'
        });
      }

      const isOwner =
        String(booking.ownerId) ===
        String(req.user._id);

      const isAdmin =
        req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          message:
            'Only the listing owner or an admin can manage this booking.'
        });
      }

      const requestedStatus =
        req.body?.status;

      const allowedStatuses = [
        'confirmed',
        'cancelled',
        'completed'
      ];

      if (
        !allowedStatuses.includes(
          requestedStatus
        )
      ) {
        return res.status(400).json({
          message:
            'Invalid booking status.'
        });
      }

      /*
       * Valid lifecycle transitions:
       *
       * paid      -> confirmed | cancelled
       * confirmed -> completed | cancelled
       * completed/cancelled -> no changes
       */
      const validTransition =
        (
          booking.status === 'paid' &&
          [
            'confirmed',
            'cancelled'
          ].includes(
            requestedStatus
          )
        ) ||
        (
          booking.status ===
            'confirmed' &&
          [
            'completed',
            'cancelled'
          ].includes(
            requestedStatus
          )
        );

      if (!validTransition) {
        return res.status(400).json({
          message:
            `Cannot change booking status from ${booking.status} to ${requestedStatus}`
        });
      }

      /*
       * A paid booking whose rental period
       * has already ended cannot be confirmed
       * after the fact.
       */
      if (
        requestedStatus ===
          'confirmed' &&
        booking.status === 'paid' &&
        new Date(
          `${booking.endDate}T00:00:00Z`
        ) <= new Date()
      ) {
        booking.status =
          'completed';
      } else {
        booking.status =
          requestedStatus;
      }

      await booking.save();

      await booking.populate(
        'listingId'
      );

      await booking.populate(
        'renterId'
      );

      await booking.populate(
        'ownerId'
      );

      res.json({
        booking: cleanBooking(
          booking,
          booking.listingId
        )
      });
    } catch (error) {
      console.error(
        'Update booking status error:',
        error
      );

      res.status(500).json({
        message:
          'Could not update booking status.'
      });
    }
  }
);

export default router;

