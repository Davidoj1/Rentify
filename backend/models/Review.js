import mongoose from 'mongoose';

const reviewSchema =
  new mongoose.Schema(
    {
      /*
       * Links the review directly to the
       * completed rental transaction.
       *
       * This is what allows Rentify to enforce
       * one review per booking.
       */
      bookingId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: 'Booking',

        required: true
      },


      listingId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: 'Listing',

        required: true,

        index: true
      },


      userId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: 'User',

        required: true,

        index: true
      },


      userName: {
        type: String,

        required: true
      },


      rating: {
        type: Number,

        required: true,

        min: 1,

        max: 5
      },


      comment: {
        type: String,

        default: '',

        maxlength: 1000
      }
    },

    {
      timestamps: true
    }
  );


/*
|--------------------------------------------------------------------------
| One review per booking
|--------------------------------------------------------------------------
|
| The partial index is intentional.
|
| It protects against duplicate reviews for new records
| without causing problems if an older review document
| exists from before bookingId was introduced.
|--------------------------------------------------------------------------
*/
reviewSchema.index(
  {
    bookingId: 1
  },
  {
    unique: true,

    partialFilterExpression: {
      bookingId: {
        $exists: true
      }
    }
  }
);


export default mongoose.model(
  'Review',
  reviewSchema
);
