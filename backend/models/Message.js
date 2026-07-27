import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    from: { type: String, required: true },
    text: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.model('Message', messageSchema);
