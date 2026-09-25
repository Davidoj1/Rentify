import express from 'express';

import { auth, requireRole } from '../middleware/auth.js';
import cloudinary from '../utils/cloudinary.js';

const router = express.Router();

/*
|--------------------------------------------------------------------------
| POST /api/cloudinary/signature
|--------------------------------------------------------------------------
| Creates a short-lived signed upload payload for the frontend.
|
| The browser receives:
| - cloud name
| - API key
| - timestamp
| - signature
| - upload folder
|
| The browser NEVER receives:
| - Cloudinary API secret
|--------------------------------------------------------------------------
*/

router.post(
  '/signature',
  auth,
  requireRole('owner', 'admin'),
  async (req, res) => {
    try {
      if (
        !process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
      ) {
        return res.status(500).json({
          message: 'Cloudinary is not configured on the backend.'
        });
      }

      const timestamp = Math.round(Date.now() / 1000);

      const folder =
        req.user.role === 'admin'
          ? 'rentify/listings/admin'
          : `rentify/listings/${req.user._id}`;

      const signature = cloudinary.utils.api_sign_request(
        {
          timestamp,
          folder
        },
        process.env.CLOUDINARY_API_SECRET
      );

      return res.json({
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        signature,
        folder
      });
    } catch (error) {
      console.error('Cloudinary signature error:', error);

      return res.status(500).json({
        message: 'Could not prepare Cloudinary upload.'
      });
    }
  }
);

export default router;