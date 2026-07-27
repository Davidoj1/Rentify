import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import User from '../models/User.js';
import { auth } from '../middleware/auth.js';
import { safeUser } from '../utils/format.js';

const router = express.Router();

const signToken = user =>
  jwt.sign({ id: String(user._id), role: user.role }, process.env.JWT_SECRET || 'dev_secret', {
    expiresIn: '7d'
  });

router.post('/signup', async (req, res) => {
  const { name, email, phone, password, role = 'renter' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required.' });
  }

  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const user = await User.create({
    name,
    email: String(email).toLowerCase(),
    phone: phone || '',
    password: await bcrypt.hash(password, 10),
    role,
    verified: false,
    avatar: ''
  });

  res.json({ user: safeUser(user), token: signToken(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase() });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  res.json({ user: safeUser(user), token: signToken(user) });
});

router.get('/me', auth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

export default router;
