import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Listing from '../models/Listing.js';

export async function seedDefaultData() {
  const count = await User.countDocuments();
  if (count > 0) return;

  const password = await bcrypt.hash('password123', 10);

  const owner = await User.create({
    name: 'Rentify Demo Owner',
    email: 'owner@rentify.ng',
    phone: '+2348031234567',
    password,
    role: 'owner',
    verified: true
  });

  await User.create([
    {
      name: 'Demo Renter',
      email: 'renter@rentify.ng',
      phone: '+2348011112222',
      password,
      role: 'renter',
      verified: true
    },
    {
      name: 'Rentify Admin',
      email: 'admin@rentify.ng',
      phone: '+2348099990000',
      password,
      role: 'admin',
      verified: true
    }
  ]);

  await Listing.create([
    {
      ownerId: owner._id,
      title: 'Luxury 3-Bedroom Apartment in Lekki',
      category: 'Apartments',
      price: 85000,
      location: 'Lekki Phase 1, Lagos',
      rating: 4.8,
      images: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200'],
      amenities: ['24/7 Power', 'WiFi', 'Air Conditioning', 'Pool', 'Security'],
      description: 'A clean and premium short-let apartment suitable for family stays, business trips and weekend relaxation.',
      rules: 'No parties without approval. Valid ID required.'
    },
    {
      ownerId: owner._id,
      title: '2021 Toyota Camry for Hire',
      category: 'Vehicles',
      price: 45000,
      location: 'Ikeja, Lagos',
      rating: 4.7,
      images: ['https://images.unsplash.com/photo-1550355291-bbee04a92027?w=1200'],
      amenities: ['AC', 'GPS', 'Insurance', 'Bluetooth'],
      description: 'Comfortable Toyota Camry available for daily hire within Lagos. Driver available on request.',
      rules: 'Valid driver licence required for self-drive.'
    },
    {
      ownerId: owner._id,
      title: '20KVA Silent Generator',
      category: 'Equipment',
      price: 35000,
      location: 'Wuse 2, Abuja',
      rating: 4.6,
      images: ['https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1200'],
      amenities: ['Low Noise', 'Fuel Efficient', 'Auto Start'],
      description: 'Reliable generator for events, offices and backup power needs.',
      rules: 'Transport fee may apply outside Abuja city centre.'
    }
  ]);

  console.log('Seeded default Rentify users and listings ✅');
}
