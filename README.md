# Rentify Nigeria MVP

A Nigeria-focused rental marketplace MVP with renter/owner roles, listings, booking flow, Paystack test-mode placeholder integration, anti-disintermediation messaging, and mobile-first UI.

## Quick Start

```bash
npm run install:all
cp backend/.env.example backend/.env
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:5000

## Demo accounts
- Owner: owner@rentify.ng / password123
- Renter: renter@rentify.ng / password123
- Admin: admin@rentify.ng / password123

## Notes
- Payments are configured for Paystack test mode placeholders. Add real `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` in `backend/.env`.
- Use this for private beta testing before live payments.
