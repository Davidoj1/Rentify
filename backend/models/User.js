import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    phone: { type: String, default: '' },
    password: { type: String, required: true },
    role: { type: String, enum: ['renter', 'owner', 'admin'], default: 'renter' },
    verified: { type: Boolean, default: false },
    avatar: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
