import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    renterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    days: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    total: { type: Number, required: true },
    reference: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['pending_payment', 'paid', 'confirmed', 'cancelled', 'completed', 'failed'],
      default: 'pending_payment'
    },
    paidAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model('Booking', bookingSchema);
