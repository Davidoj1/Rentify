import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    category: {
      type: String,
      enum: ['Apartments', 'Vehicles', 'Equipment', 'Warehouses', 'Event Items'],
      default: 'Apartments'
    },
    price: { type: Number, required: true },
    location: { type: String, required: true },
    rating: { type: Number, default: 0 },
    images: [{ type: String }],
    amenities: [{ type: String }],
    description: { type: String, default: '' },
    rules: { type: String, default: '' },
    available: { type: Boolean, default: true },
    status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'active' }
  },
  { timestamps: true }
);

export default mongoose.model('Listing', listingSchema);
