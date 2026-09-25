import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import mongoose from 'mongoose';
import helmet from 'helmet';

import authRoutes from './routes/auth.js';
import accountRoutes from './routes/account.js';
import listingRoutes from './routes/listings.js';
import bookingRoutes from './routes/bookings.js';
import messageRoutes from './routes/messages.js';
import reviewRoutes from './routes/reviews.js';
import cloudinaryRoutes from './routes/cloudinary.js';

import { getPaymentMode } from './utils/paystack.js';
import { seedDefaultData } from './utils/seed.js';

dotenv.config();

const app = express();

app.disable('x-powered-by');
app.use(helmet());

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173'
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no Origin header, such as
      // direct server-to-server requests and local tools.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error('Not allowed by CORS')
      );
    }
  })
);

// Higher limit is temporarily kept for compatibility
// with existing beta functionality.
// Listing images are now uploaded directly to Cloudinary.
app.use(
  express.json({
    limit: '15mb'
  })
);

app.use(morgan('dev'));

app.get('/api/health', (_, res) => {
  res.json({
    ok: true,
    app: 'Rentify',
    database:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'not_connected',
    payment: getPaymentMode()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/cloudinary', cloudinaryRoutes);

const PORT =
  process.env.PORT || 5000;

const MONGO_URI =
  process.env.MONGO_URI;

async function start() {
  try {
    if (!MONGO_URI) {
      console.warn(
        '⚠️ MONGO_URI is missing. Add it to backend/.env before launch.'
      );
    } else {
      await mongoose.connect(
        MONGO_URI
      );

      console.log(
        'MongoDB connected ✅'
      );

      await seedDefaultData();
    }

    app.listen(
      PORT,
      () => {
        console.log(
          `Rentify backend running on ${PORT}`
        );
      }
    );
  } catch (err) {
    console.error(
      'Backend startup failed:',
      err.message
    );

    process.exit(1);
  }
}

start();
