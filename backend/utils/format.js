export function safeUser(u) {
  if (!u) return null;
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    verified: u.verified,
    avatar: u.avatar
  };
}

export function cleanListing(l) {
  if (!l) return null;
  return {
    id: String(l._id),
    ownerId: String(l.ownerId),
    title: l.title,
    category: l.category,
    price: l.price,
    location: l.location,
    rating: l.rating,
    images: l.images || [],
    amenities: l.amenities || [],
    description: l.description || '',
    rules: l.rules || '',
    available: l.available,
    status: l.status
  };
}

export function cleanBooking(b, listing = null) {
  if (!b) return null;
  return {
    id: String(b._id),
    listingId: String(b.listingId?._id || b.listingId),
    renterId: String(b.renterId?._id || b.renterId),
    ownerId: String(b.ownerId?._id || b.ownerId),
    startDate: b.startDate,
    endDate: b.endDate,
    days: b.days,
    subtotal: b.subtotal,
    platformFee: b.platformFee,
    total: b.total,
    reference: b.reference,
    status: b.status,
    paidAt: b.paidAt,
    listing: listing ? cleanListing(listing) : b.listingId?.title ? cleanListing(b.listingId) : undefined
  };
}
