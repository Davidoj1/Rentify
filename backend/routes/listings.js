import express from 'express';

import Listing from '../models/Listing.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import { auth, requireRole } from '../middleware/auth.js';
import { cleanListing, safeUser } from '../utils/format.js';

const router = express.Router();

const MAX_SEARCH_LENGTH = 100;
const MAX_TITLE_LENGTH = 120;
const MAX_LOCATION_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_RULES_LENGTH = 3000;
const MAX_AMENITIES = 50;
const MAX_IMAGES = 20;

const ALLOWED_CATEGORIES = [
  'Apartments',
  'Houses',
  'Rooms',
  'Offices',
  'Event Spaces',
  'Other'
];

function isValidObjectId(id) {
  return /^[a-fA-F0-9]{24}$/.test(String(id || ''));
}

function escapeRegex(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

function cleanString(value) {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function validateText(
  value,
  field,
  maxLength,
  required = false
) {
  const cleaned = cleanString(value);

  if (required && !cleaned) {
    return `${field} is required.`;
  }

  if (cleaned.length > maxLength) {
    return `${field} must not exceed ${maxLength} characters.`;
  }

  return '';
}

function validatePrice(value) {
  const price = Number(value);

  if (!Number.isFinite(price) || price <= 0) {
    return 'Price must be greater than 0.';
  }

  if (price > 1000000000) {
    return 'Price is too high.';
  }

  return '';
}

function validateImages(images) {
  if (images === undefined) {
    return '';
  }

  if (!Array.isArray(images)) {
    return 'Images must be an array.';
  }

  if (images.length > MAX_IMAGES) {
    return `You can upload a maximum of ${MAX_IMAGES} images.`;
  }

  for (const image of images) {
    if (typeof image !== 'string' || !image.trim()) {
      return 'Each image must be a valid URL.';
    }

    if (image.length > 2000) {
      return 'Image URL is too long.';
    }
  }

  return '';
}

function validateAmenities(amenities) {
  if (amenities === undefined) {
    return '';
  }

  if (!Array.isArray(amenities)) {
    return 'Amenities must be an array.';
  }

  if (amenities.length > MAX_AMENITIES) {
    return `You can specify a maximum of ${MAX_AMENITIES} amenities.`;
  }

  for (const amenity of amenities) {
    if (
      typeof amenity !== 'string' ||
      !amenity.trim()
    ) {
      return 'Each amenity must be a valid text value.';
    }

    if (amenity.length > 100) {
      return 'Each amenity must not exceed 100 characters.';
    }
  }

  return '';
}

function validateCategory(category) {
  if (
    category !== undefined &&
    !ALLOWED_CATEGORIES.includes(category)
  ) {
    return 'Invalid listing category.';
  }

  return '';
}
/*
 * GET /api/listings/host/:id
 * Public host profile + active listings
 */
router.get('/host/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid host ID.'
      });
    }

    const host = await User.findById(req.params.id);

    if (!host) {
      return res.status(404).json({
        message: 'Host not found.'
      });
    }

    const listings = await Listing.find({
      ownerId: host._id,
      available: true,
      status: 'active'
    }).sort({
      createdAt: -1
    });

    res.json({
      host: {
        id: String(host._id),
        name: host.name,
        avatar: host.avatar || '',
        bio: host.bio || '',
        role: host.role,
        verified: host.verified
      },
      listings: listings.map(cleanListing)
    });
  } catch (error) {
    console.error('Get public host profile error:', error);

    res.status(500).json({
      message: 'Could not load host profile.'
    });
  }
});

/*
 * GET /api/listings
 */
router.get('/', async (req, res) => {
  try {
    const {
      q = '',
      category = 'All',
      min,
      max
    } = req.query;

    const search = cleanString(q);

    if (search.length > MAX_SEARCH_LENGTH) {
      return res.status(400).json({
        message: `Search must not exceed ${MAX_SEARCH_LENGTH} characters.`
      });
    }

    if (
      category !== 'All' &&
      !ALLOWED_CATEGORIES.includes(category)
    ) {
      return res.status(400).json({
        message: 'Invalid listing category.'
      });
    }

    const query = {};

    if (category && category !== 'All') {
      query.category = category;
    }

    if (min !== undefined || max !== undefined) {
      query.price = {};
    }

    if (min !== undefined) {
      const minPrice = Number(min);

      if (
        !Number.isFinite(minPrice) ||
        minPrice < 0
      ) {
        return res.status(400).json({
          message: 'Minimum price must be a valid non-negative number.'
        });
      }

      query.price.$gte = minPrice;
    }

    if (max !== undefined) {
      const maxPrice = Number(max);

      if (
        !Number.isFinite(maxPrice) ||
        maxPrice < 0
      ) {
        return res.status(400).json({
          message: 'Maximum price must be a valid non-negative number.'
        });
      }

      query.price.$lte = maxPrice;
    }

    if (
      query.price &&
      query.price.$gte !== undefined &&
      query.price.$lte !== undefined &&
      query.price.$gte > query.price.$lte
    ) {
      return res.status(400).json({
        message: 'Minimum price cannot be greater than maximum price.'
      });
    }

    if (search) {
      const safeSearch = escapeRegex(search);

      query.$or = [
        {
          title: {
            $regex: safeSearch,
            $options: 'i'
          }
        },
        {
          location: {
            $regex: safeSearch,
            $options: 'i'
          }
        },
        {
          description: {
            $regex: safeSearch,
            $options: 'i'
          }
        }
      ];
    }

    const listings = await Listing.find(query)
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      listings: listings.map(cleanListing)
    });
  } catch (error) {
    console.error('Get listings error:', error);

    res.status(500).json({
      message: 'Could not load listings.'
    });
  }
});
/*
 * GET /api/listings/host/:id
 * Public host profile + active/available listings
 */
router.get('/host/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid host ID.'
      });
    }

    const host = await User.findById(req.params.id);

    if (!host) {
      return res.status(404).json({
        message: 'Host not found.'
      });
    }

    const listings = await Listing.find({
      ownerId: host._id,
      available: true,
      status: 'active'
    }).sort({
      createdAt: -1
    });

    res.json({
      host: {
        id: String(host._id),
        name: host.name,
        avatar: host.avatar || '',
        bio: host.bio || '',
        role: host.role,
        verified: host.verified
      },
      listings: listings.map(cleanListing)
    });
  } catch (error) {
    console.error('Get public host profile error:', error);

    res.status(500).json({
      message: 'Could not load host profile.'
    });
  }
});

/*
 * GET /api/listings/:id
 */
router.get('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid listing ID.'
      });
    }

    const listing = await Listing.findById(
      req.params.id
    );

    if (!listing) {
      return res.status(404).json({
        message: 'Listing not found.'
      });
    }

    const owner = await User.findById(
      listing.ownerId
    );

    const reviews = await Review.find({
      listingId: listing._id
    }).sort({
      createdAt: -1
    });

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
  } catch (error) {
    console.error('Get listing error:', error);

    res.status(500).json({
      message: 'Could not load listing.'
    });
  }
});

/*
 * POST /api/listings
 */
router.post(
  '/',
  auth,
  requireRole('owner', 'admin'),
  async (req, res) => {
    try {
      const body = req.body || {};

      const title = cleanString(body.title);
      const location = cleanString(body.location);
      const description = cleanString(
        body.description || ''
      );
      const rules = cleanString(
        body.rules || ''
      );

      const category =
        body.category || 'Apartments';

      const price = Number(body.price);

      const titleError = validateText(
        title,
        'Title',
        MAX_TITLE_LENGTH,
        true
      );

      if (titleError) {
        return res.status(400).json({
          message: titleError
        });
      }

      const locationError = validateText(
        location,
        'Location',
        MAX_LOCATION_LENGTH,
        true
      );

      if (locationError) {
        return res.status(400).json({
          message: locationError
        });
      }

      const descriptionError = validateText(
        description,
        'Description',
        MAX_DESCRIPTION_LENGTH
      );

      if (descriptionError) {
        return res.status(400).json({
          message: descriptionError
        });
      }

      const rulesError = validateText(
        rules,
        'Rules',
        MAX_RULES_LENGTH
      );

      if (rulesError) {
        return res.status(400).json({
          message: rulesError
        });
      }

      const categoryError =
        validateCategory(category);

      if (categoryError) {
        return res.status(400).json({
          message: categoryError
        });
      }

      const priceError =
        validatePrice(body.price);

      if (priceError) {
        return res.status(400).json({
          message: priceError
        });
      }

      const imagesError =
        validateImages(body.images);

      if (imagesError) {
        return res.status(400).json({
          message: imagesError
        });
      }

      const amenitiesError =
        validateAmenities(body.amenities);

      if (amenitiesError) {
        return res.status(400).json({
          message: amenitiesError
        });
      }

      const listing = {
        ownerId: req.user._id,
        title,
        category,
        price,
        location,
        rating: 0,

        images: body.images?.length
          ? body.images
          : [
              'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200'
            ],

        amenities: body.amenities || [],
        description,
        rules,
        available: true,
        status: 'active'
      };

      const created = await Listing.create(
        listing
      );

      res.status(201).json({
        listing: cleanListing(created)
      });
    } catch (error) {
      console.error('Create listing error:', error);

      res.status(500).json({
        message: 'Could not create listing.'
      });
    }
  }
);

/*
 * PUT /api/listings/:id
 */
router.put('/:id', auth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid listing ID.'
      });
    }

    const listing = await Listing.findById(
      req.params.id
    );

    if (!listing) {
      return res.status(404).json({
        message: 'Listing not found.'
      });
    }

    if (
      String(listing.ownerId) !==
        String(req.user._id) &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        message:
          'You can only edit your own listings.'
      });
    }

    const body = req.body || {};

    if (body.title !== undefined) {
      const title = cleanString(body.title);

      const error = validateText(
        title,
        'Title',
        MAX_TITLE_LENGTH,
        true
      );

      if (error) {
        return res.status(400).json({
          message: error
        });
      }

      listing.title = title;
    }

    if (body.category !== undefined) {
      const error =
        validateCategory(body.category);

      if (error) {
        return res.status(400).json({
          message: error
        });
      }

      listing.category = body.category;
    }

    if (body.price !== undefined) {
      const error =
        validatePrice(body.price);

      if (error) {
        return res.status(400).json({
          message: error
        });
      }

      listing.price = Number(body.price);
    }

    if (body.location !== undefined) {
      const location =
        cleanString(body.location);

      const error = validateText(
        location,
        'Location',
        MAX_LOCATION_LENGTH,
        true
      );

      if (error) {
        return res.status(400).json({
          message: error
        });
      }

      listing.location = location;
    }

    if (body.images !== undefined) {
      const error =
        validateImages(body.images);

      if (error) {
        return res.status(400).json({
          message: error
        });
      }

      listing.images = body.images;
    }

    if (body.amenities !== undefined) {
      const error =
        validateAmenities(body.amenities);

      if (error) {
        return res.status(400).json({
          message: error
        });
      }

      listing.amenities = body.amenities;
    }

    if (body.description !== undefined) {
      const description =
        cleanString(body.description);

      const error = validateText(
        description,
        'Description',
        MAX_DESCRIPTION_LENGTH
      );

      if (error) {
        return res.status(400).json({
          message: error
        });
      }

      listing.description = description;
    }

    if (body.rules !== undefined) {
      const rules =
        cleanString(body.rules);

      const error = validateText(
        rules,
        'Rules',
        MAX_RULES_LENGTH
      );

      if (error) {
        return res.status(400).json({
          message: error
        });
      }

      listing.rules = rules;
    }

    if (body.available !== undefined) {
      if (typeof body.available !== 'boolean') {
        return res.status(400).json({
          message:
            'Available must be true or false.'
        });
      }

      listing.available = body.available;
    }

    await listing.save();

    res.json({
      listing: cleanListing(listing)
    });
  } catch (error) {
    console.error('Update listing error:', error);

    res.status(500).json({
      message: 'Could not update listing.'
    });
  }
});

/*
 * DELETE /api/listings/:id
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid listing ID.'
      });
    }

    const listing = await Listing.findById(
      req.params.id
    );

    if (!listing) {
      return res.status(404).json({
        message: 'Listing not found.'
      });
    }

    if (
      String(listing.ownerId) !==
        String(req.user._id) &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        message:
          'You can only delete your own listings.'
      });
    }

    const bookingHistory =
      await Booking.exists({
        listingId: listing._id
      });

    if (bookingHistory) {
      return res.status(400).json({
        message:
          'This listing cannot be deleted because it has booking history. Mark it unavailable instead.'
      });
    }

    await listing.deleteOne();

    res.json({
      message: 'Listing removed successfully.'
    });
  } catch (error) {
    console.error('Delete listing error:', error);

    res.status(500).json({
      message: 'Could not delete listing.'
    });
  }
});

export default router;

