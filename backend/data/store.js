import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

const password = bcrypt.hashSync('password123', 10);

export const db = {
  users: [
    { id: 'u_owner', name: 'Rentify Demo Owner', email: 'owner@rentify.ng', phone: '+2348031234567', password, role: 'owner', verified: true, avatar: '' },
    { id: 'u_renter', name: 'Demo Renter', email: 'renter@rentify.ng', phone: '+2348011112222', password, role: 'renter', verified: true, avatar: '' },
    { id: 'u_admin', name: 'Rentify Admin', email: 'admin@rentify.ng', phone: '+2348099990000', password, role: 'admin', verified: true, avatar: '' }
  ],
  listings: [
    { id:'l1', ownerId:'u_owner', title:'Luxury 3-Bedroom Apartment in Lekki', category:'Apartments', price:85000, location:'Lekki Phase 1, Lagos', rating:4.8, images:['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200'], amenities:['24/7 Power','WiFi','Air Conditioning','Pool','Security'], description:'A clean and premium short-let apartment suitable for family stays, business trips and weekend relaxation.', rules:'No parties without approval. Valid ID required.', available:true },
    { id:'l2', ownerId:'u_owner', title:'2021 Toyota Camry for Hire', category:'Vehicles', price:45000, location:'Ikeja, Lagos', rating:4.7, images:['https://images.unsplash.com/photo-1550355291-bbee04a92027?w=1200'], amenities:['AC','GPS','Insurance','Bluetooth'], description:'Comfortable Toyota Camry available for daily hire within Lagos. Driver available on request.', rules:'Valid driver licence required for self-drive.', available:true },
    { id:'l3', ownerId:'u_owner', title:'20KVA Silent Generator', category:'Equipment', price:35000, location:'Wuse 2, Abuja', rating:4.6, images:['https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1200'], amenities:['Low Noise','Fuel Efficient','Auto Start'], description:'Reliable generator for events, offices and backup power needs.', rules:'Transport fee may apply outside Abuja city centre.', available:true },
    { id:'l4', ownerId:'u_owner', title:'Secure 500sqm Warehouse', category:'Warehouses', price:120000, location:'Apapa, Lagos', rating:4.9, images:['https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200'], amenities:['CCTV','Loading Bay','24/7 Security','Truck Access'], description:'Large secure warehouse for storage, logistics and inventory overflow.', rules:'Inspection required before long-term booking.', available:true },
    { id:'l5', ownerId:'u_owner', title:'Event Canopy & Chairs - 200 Capacity', category:'Event Items', price:75000, location:'Gwarinpa, Abuja', rating:4.5, images:['https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200'], amenities:['Setup Included','Chairs','Tables Available','Canopies'], description:'Complete event setup for birthdays, church events, school functions and small weddings.', rules:'Booking must be made at least 24 hours before event.', available:true }
  ],
  bookings: [],
  reviews: [],
  messages: [],
  favorites: []
};

export const newId = () => uuid();
export const safeUser = (u) => u ? ({ id:u.id, name:u.name, email:u.email, phone:u.phone, role:u.role, verified:u.verified, avatar:u.avatar }) : null;
