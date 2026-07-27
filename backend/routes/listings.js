import express from 'express';

import Listing from '../models/Listing.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import { auth, requireRole } from '../middleware/auth.js';
import { cleanListing, safeUser } from '../utils/format.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { q = '', category = 'All', min, max } = req.query;

  const query = {};

  if (category && category !== 'All') query.category = category;
  if (min || max) query.price = {};
  if (min) query.price.$gte = Number(min);
  if (max) query.price.$lte = Number(max);

  if (q) {
    query.$or = [
      { title: { $regex: q, $options: 'i' } },
      { location: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } }
    ];
  }

  const listings = await Listing.find(query).sort({ createdAt: -1 });
  res.json({ listings: listings.map(cleanListing) });
});

router.get('/:id', async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.status(404).json({ message: 'Listing not found.' });

  const owner = await User.findById(listing.ownerId);
  const reviews = await Review.find({ listingId: listing._id }).sort({ createdAt: -1 });

  res.json({
    listing: cleanListing(listing),
    owner: safeUser(owner),
    reviews: reviews.map(r => ({
      id: String(r._id),
      listingId: String(r.listingId),
      userId: String(r.userId),
      userName: r.userName,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt
    }))
  });
});

router.post('/', auth, requireRole('owner', 'admin'), async (req, res) => {
  const body = req.body;

  const listing = {
    ownerId: req.user._id,
    title: body.title,
    category: body.category || 'Apartments',
    price: Number(body.price || 0),
    location: body.location,
    rating: 0,
    images: body.images?.length
      ? body.images
      : ['https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200'],
    amenities: body.amenities || [],
    description: body.description || '',
    rules: body.rules || '',
    available: true,
    status: 'active'
  };

  if (!listing.title || !listing.location || !listing.price) {
    return res.status(400).json({ message: 'Title, location and price are required.' });
  }

  const created = await Listing.create(listing);
  res.status(201).json({ listing: cleanListing(created) });
});

router.put('/:id', auth, async (req, res) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing) return res.status(404).json({ message: 'Listing not found.' });

  if (String(listing.ownerId) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You can only edit your own listings.' });
  }

  listing.title = req.body.title ?? listing.title;
  listing.category = req.body.category ?? listing.category;
  listing.price = Number(req.body.price ?? listing.price);
  listing.location = req.body.location ?? listing.location;
  listing.images = req.body.images ?? listing.images;
  listing.amenities = req.body.amenities ?? listing.amenities;
  listing.description = req.body.description ?? listing.description;
  listing.rules = req.body.rules ?? listing.rules;
  listing.available = req.body.available ?? listing.available;

  await listing.save();

  res.json({ listing: cleanListing(listing) });
});

router.delete('/:id', auth, async (req, res) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing) return res.status(404).json({ message: 'Listing not found.' });

  if (String(listing.ownerId) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not allowed.' });
  }

  await listing.deleteOne();
  res.json({ message: 'Listing removed.' });
});

export default router;
