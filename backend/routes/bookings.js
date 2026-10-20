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

import {
  sendPaymentConfirmationEmail,
  sendOwnerNewBookingEmail,
  sendBookingStatusEmail
} from '../utils/email.js';

const router = express.Router();

const MAX_BOOKING_DAYS = 365;
const MAX_DATE_YEARS_AHEAD = 2;

async function sendEmailSafely(label, send) {
  try {
    await send();
  } catch (error) {
    console.error(`${label} error:`, error);
  }
}

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
  startA,
  endA,
  startB,
  endB
) =>
  startA < endB &&
  endA > startB;

function isValidObjectId(value) {
  return /^[a-f\d]{24}$/i.test(
    String(value || '')
  );
}

function isValidDateOnly(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00Z`
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) ===
      value
  );
}

function startOfTodayUtc() {
  const now = new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    )
  );
}

function maxAllowedStartDateUtc() {
  const today = startOfTodayUtc();

  return new Date(
    Date.UTC(
      today.getUTCFullYear() +
        MAX_DATE_YEARS_AHEAD,
      today.getUTCMonth(),
      today.getUTCDate()
    )
  );
}

function isValidReference(reference) {
  return (
    typeof reference === 'string' &&
    reference.length >= 8 &&
    reference.length <= 100 &&
    /^[A-Za-z0-9._:-]+$/.test(
      reference
    )
  );
}

function toNumber(value) {
  const number =
    typeof value === 'number'
      ? value
      : Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

/*
|--------------------------------------------------------------------------
| Automatically complete expired bookings
|--------------------------------------------------------------------------
*/
async function completeExpiredBookings() {
  const today =
    startOfTodayUtc()
      .toISOString()
      .slice(0, 10);

  await Booking.updateMany(
    {
      endDate: {
        $lt: today
      },

      status: {
        $in: [
          'paid',
          'confirmed'
        ]
      }
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
*/
router.get(
  '/',
  auth,
  async (req, res) => {
    try {
      await completeExpiredBookings();

      const userId =
        req.user._id;

      const role =
        req.user.role;

      let query;

      const isAdmin =
        role === 'admin' ||
        req.userRoles?.includes('admin');

      const isHosting =
        req.user.activeMode === 'hosting';

      if (isAdmin) {
        query = {};
      } else if (isHosting) {
        query = {
          ownerId: userId
        };
      } else {
        query = {
          renterId: userId
        };
      }

      const bookings =
        await Booking.find(query)
          .populate('listingId')
          .populate('renterId')
          .populate('ownerId')
          .sort({
            createdAt: -1
          });

      res.json({
        bookings:
          bookings.map(
            booking =>
              cleanBooking(
                booking,
                booking.listingId
              )
          )
      });
    } catch (error) {
      console.error(
        'Get bookings error:',
        error
      );

      res.status(500).json({
        message:
          'Could not load bookings.'
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/bookings
|--------------------------------------------------------------------------
| Creates a pending booking and initializes
| the Paystack payment.
|--------------------------------------------------------------------------
*/
router.post(
  '/',
  auth,
  async (req, res) => {
    let booking = null;

    try {
      const body =
        req.body || {};

      const {
        listingId,
        startDate,
        endDate
      } = body;

      /*
       * Validate listing ID.
       */
      if (
        !isValidObjectId(
          listingId
        )
      ) {
        return res.status(400).json({
          message:
            'Invalid listing ID.'
        });
      }

      /*
       * Validate dates.
       */
      if (
        !isValidDateOnly(
          startDate
        ) ||
        !isValidDateOnly(
          endDate
        )
      ) {
        return res.status(400).json({
          message:
            'Dates must use YYYY-MM-DD format.'
        });
      }

      const start =
        new Date(
          `${startDate}T00:00:00Z`
        );

      const end =
        new Date(
          `${endDate}T00:00:00Z`
        );

      /*
       * End date must be after
       * start date.
       */
      if (end <= start) {
        return res.status(400).json({
          message:
            'End date must be after start date.'
        });
      }

      /*
       * Start date cannot be in
       * the past.
       */
      if (
        start < startOfTodayUtc()
      ) {
        return res.status(400).json({
          message:
            'Booking start date cannot be in the past.'
        });
      }

      /*
       * Do not allow bookings
       * more than two years ahead.
       */
      if (
        start >
        maxAllowedStartDateUtc()
      ) {
        return res.status(400).json({
          message:
            `Booking start date cannot be more than ${MAX_DATE_YEARS_AHEAD} years ahead.`
        });
      }

      const days =
        nights(
          startDate,
          endDate
        );

      /*
       * Prevent excessively long
       * bookings.
       */
      if (
        days >
        MAX_BOOKING_DAYS
      ) {
        return res.status(400).json({
          message:
            `Booking duration cannot exceed ${MAX_BOOKING_DAYS} days.`
        });
      }

      /*
       * Load listing.
       */
      const listing =
        await Listing.findById(
          listingId
        );

      if (!listing) {
        return res.status(404).json({
          message:
            'Listing not found.'
        });
      }

      /*
       * The renter cannot book
       * their own listing.
       */
      if (
        String(
          listing.ownerId
        ) ===
        String(
          req.user._id
        )
      ) {
        return res.status(400).json({
          message:
            'You cannot book your own listing.'
        });
      }

      /*
       * Listing must be available.
       */
      if (
        listing.available ===
        false
      ) {
        return res.status(400).json({
          message:
            'This listing is currently unavailable.'
        });
      }

      /*
       * Only active listings
       * can be booked.
       */
      if (
        listing.status &&
        listing.status !==
          'active'
      ) {
        return res.status(400).json({
          message:
            'This listing is not available for booking.'
        });
      }

      /*
       * Validate listing price.
       */
      const price =
        toNumber(
          listing.price
        );

      if (
        price === null ||
        price < 0
      ) {
        return res.status(500).json({
          message:
            'Listing has an invalid price.'
        });
      }

      /*
       * Platform fee.
       */
      const feeRate =
        Number(
          process.env.PLATFORM_FEE_RATE ||
            0.04
        );

      if (
        !Number.isFinite(
          feeRate
        ) ||
        feeRate < 0 ||
        feeRate > 1
      ) {
        return res.status(500).json({
          message:
            'Platform fee configuration is invalid.'
        });
      }

      const subtotal =
        price * days;

      const platformFee =
        subtotal * feeRate;

      const total =
        subtotal +
        platformFee;

      /*
       * Check for overlapping
       * bookings.
       */
      const existingBookings =
        await Booking.find({
          listingId,
          status: {
            $in: [
              'pending_payment',
              'paid',
              'confirmed'
            ]
          }
        });

      const hasOverlap =
        existingBookings.some(
          existing =>
            overlaps(
              startDate,
              endDate,
              existing.startDate,
              existing.endDate
            )
        );

      if (hasOverlap) {
        return res.status(409).json({
          message:
            'This listing is already booked for part or all of those dates.'
        });
      }

      /*
       * Create unique payment
       * reference.
       */
      const reference =
        `RNT-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)
          .toUpperCase()}`;

      booking =
        await Booking.create({
          listingId:
            listing._id,

          renterId:
            req.user._id,

          ownerId:
            listing.ownerId,

          startDate,
          endDate,

          days,

          subtotal:
            Math.round(
              subtotal * 100
            ) / 100,

          platformFee:
            Math.round(
              platformFee * 100
            ) / 100,

          total:
            Math.round(
              total * 100
            ) / 100,

          reference,

          status:
            'pending_payment'
        });

      /*
       * Initialize Paystack.
       */
      let payment;

      try {
        payment =
          await initializePayment({
            email:
              req.user.email,

            amount:
              booking.total,

            reference:
              booking.reference,

            metadata: {
              bookingId:
                String(
                  booking._id
                ),

              listingId:
                String(
                  listing._id
                ),

              renterId:
                String(
                  req.user._id
                ),

              ownerId:
                String(
                  listing.ownerId
                )
            }
          });
      } catch (paymentError) {
        console.error(
          'Paystack initialization error:',
          paymentError
        );

        booking.status =
          'failed';

        await booking.save();

        return res.status(502).json({
          message:
            'Could not initialize payment. Please try again.'
        });
      }

      res.status(201).json({
        booking:
          cleanBooking(
            booking,
            listing
          ),

        payment: {
          authorizationUrl:
            payment.authorization_url,

          accessCode:
            payment.access_code,

          reference:
            payment.reference
        },

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
          booking.status =
            'failed';

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
  }
);

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
        !isValidReference(
          reference
        )
      ) {
        return res.status(400).json({
          message:
            'Invalid payment reference.'
        });
      }

      const booking =
        await Booking.findOne({
          reference
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
       * Only the renter who created
       * the booking may verify payment.
       */
      if (
        String(
          booking.renterId?._id ||
            booking.renterId
        ) !==
        String(
          req.user._id
        )
      ) {
        return res.status(403).json({
          message:
            'You are not allowed to verify this booking.'
        });
      }

      /*
       * Idempotent handling for
       * already completed payment.
       */
      if (
        [
          'paid',
          'confirmed',
          'completed'
        ].includes(
          booking.status
        )
      ) {
        return res.json({
          booking:
            cleanBooking(
              booking,
              booking.listingId
            ),

          verification: {
            reference:
              booking.reference,

            status:
              'success',

            amount:
              Math.round(
                booking.total *
                  100
              )
          }
        });
      }

      /*
       * Only pending payments
       * may be verified.
       */
      if (
        booking.status !==
        'pending_payment'
      ) {
        return res.status(400).json({
          message:
            `Cannot verify payment for booking with status ${booking.status}.`
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
            'Could not verify payment with Paystack. Please try again.'
        });
      }

      /*
       * Paystack transaction must
       * report success.
       */
      if (
        verification?.status !==
        'success'
      ) {
        booking.status =
          'failed';

        await booking.save();

        return res.status(400).json({
          message:
            'Paystack payment was not successful.'
        });
      }

      /*
       * Reference must match exactly.
       */
      if (
        verification.reference !==
        booking.reference
      ) {
        booking.status =
          'failed';

        await booking.save();

        return res.status(400).json({
          message:
            'Payment reference does not match this booking.'
        });
      }

      /*
       * Paystack amount is in
       * the smallest currency unit.
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
        booking.status =
          'failed';

        await booking.save();

        return res.status(400).json({
          message:
            'Payment amount does not match this booking.'
        });
      }

      /*
       * When Paystack provides
       * currency, require NGN.
       */
      if (
        verification.currency &&
        verification.currency !==
          'NGN'
      ) {
        booking.status =
          'failed';

        await booking.save();

        return res.status(400).json({
          message:
            'Payment currency does not match this booking.'
        });
      }

      /*
       * Payment is now verified.
       */
      booking.status =
        'paid';

      booking.paidAt =
        new Date();

      await booking.save();

      /*
       * Existing system message.
       */
      const existingSystemMessage =
        await Message.findOne({
          bookingId:
            booking._id,

          from: 'system'
        });

      if (
        !existingSystemMessage
      ) {
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

      /*
       * Renter payment confirmation email.
       *
       * Email failure must never
       * break the successful payment.
       */
      await sendEmailSafely(
        'Payment confirmation email',
        () =>
          sendPaymentConfirmationEmail({
            email:
              booking.renterId?.email,

            name:
              booking.renterId?.name,

            bookingReference:
              booking.reference,

            listingTitle:
              booking.listingId?.title,

            startDate:
              booking.startDate,

            endDate:
              booking.endDate,

            total:
              booking.total
          })
      );

      /*
       * Owner new paid booking email.
       *
       * Email failure must never
       * break the successful payment.
       */
      await sendEmailSafely(
        'Owner new booking email',
        () =>
          sendOwnerNewBookingEmail({
            email:
              booking.ownerId?.email,

            name:
              booking.ownerId?.name,

            bookingReference:
              booking.reference,

            listingTitle:
              booking.listingId?.title,

            renterName:
              booking.renterId?.name,

            startDate:
              booking.startDate,

            endDate:
              booking.endDate,

            total:
              booking.total
          })
      );

      res.json({
        booking:
          cleanBooking(
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

      const bookingId =
        req.params.id;

      if (
        !isValidObjectId(
          bookingId
        )
      ) {
        return res.status(400).json({
          message:
            'Invalid booking ID.'
        });
      }

      const body =
        req.body || {};

      const requestedStatus =
        body.status;

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
       * Only owner/admin can
       * manage booking status.
       */
      const isAdmin =
        req.user.role ===
        'admin';

      const isOwner =
        String(
          booking.ownerId
        ) ===
        String(
          req.user._id
        );

      if (
        !isAdmin &&
        !isOwner
      ) {
        return res.status(403).json({
          message:
            'You are not allowed to update this booking.'
        });
      }

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
          booking.status ===
            'paid' &&
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
        booking.status ===
          'paid' &&
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

      /*
       * Notify renter about
       * booking lifecycle changes.
       */
      if (
        [
          'confirmed',
          'cancelled',
          'completed'
        ].includes(
          booking.status
        )
      ) {
        await sendEmailSafely(
          `Renter ${booking.status} email`,
          () =>
            sendBookingStatusEmail({
              email:
                booking.renterId?.email,

              name:
                booking.renterId?.name,

              bookingReference:
                booking.reference,

              listingTitle:
                booking.listingId?.title,

              status:
                booking.status,

              startDate:
                booking.startDate,

              endDate:
                booking.endDate
            })
        );
      }

      /*
       * Notify owner when a
       * booking is cancelled.
       */
      if (
        booking.status ===
        'cancelled'
      ) {
        await sendEmailSafely(
          'Owner cancellation email',
          () =>
            sendBookingStatusEmail({
              email:
                booking.ownerId?.email,

              name:
                booking.ownerId?.name,

              bookingReference:
                booking.reference,

              listingTitle:
                booking.listingId?.title,

              status:
                booking.status,

              startDate:
                booking.startDate,

              endDate:
                booking.endDate
            })
        );
      }

      res.json({
        booking:
          cleanBooking(
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