import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true
    },

    phone: {
      type: String,
      default: ''
    },

    password: {
      type: String,
      required: true
    },

    /*
     * Primary / legacy role.
     *
     * Kept because the existing Rentify backend still uses
     * this field for some authorization checks.
     */
    role: {
      type: String,
      enum: ['renter', 'owner', 'admin'],
      default: 'renter'
    },

    /*
     * Account capabilities.
     *
     * Normal new renter:
     *   ['renter']
     *
     * Unified renter + owner:
     *   ['renter', 'owner']
     *
     * Owner-only account:
     *   ['owner']
     *
     * Owner can later enable renting, becoming:
     *   ['owner', 'renter']
     */
    roles: {
      type: [String],
      enum: ['renter', 'owner', 'admin'],
      default: ['renter']
    },

    /*
     * Current account experience.
     *
     * renting = renter side
     * hosting = owner side
     */
    activeMode: {
      type: String,
      enum: ['renting', 'hosting'],
      default: 'renting'
    },

    verified: {
      type: Boolean,
      default: false
    },

    avatar: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('User', userSchema);

