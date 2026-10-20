import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import User from '../models/User.js';
import { auth } from '../middleware/auth.js';
import { safeUser } from '../utils/format.js';
import { sendWelcomeEmail } from '../utils/email.js';

const router = express.Router();

const signToken = user => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign(
    {
      id: String(user._id),

      /*
       * Keep the legacy role in the JWT for compatibility.
       *
       * Authorization itself is performed against the
       * authenticated database user.
       */
      role: user.role,

      /*
       * Include capabilities for clients that need them.
       */
      roles: Array.isArray(user.roles)
        ? user.roles
        : [user.role]
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
};

const isValidEmail = email => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/*
|--------------------------------------------------------------------------
| SIGN UP
|--------------------------------------------------------------------------
|
| Every new account starts as a renter.
|
| The client cannot choose owner/admin during signup.
| Hosting is enabled later through /api/account/become-owner.
|
*/
router.post('/signup', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password
    } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        message:
          'Name, email and password are required.'
      });
    }

    const cleanName =
      String(name).trim();

    const normalizedEmail =
      String(email)
        .trim()
        .toLowerCase();

    const cleanPhone =
      phone
        ? String(phone).trim()
        : '';

    const passwordString =
      String(password);

    if (
      cleanName.length < 2 ||
      cleanName.length > 100
    ) {
      return res.status(400).json({
        message:
          'Name must be between 2 and 100 characters.'
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        message:
          'Please enter a valid email address.'
      });
    }

    if (normalizedEmail.length > 254) {
      return res.status(400).json({
        message:
          'Email address is too long.'
      });
    }

    if (cleanPhone.length > 30) {
      return res.status(400).json({
        message:
          'Phone number is too long.'
      });
    }

    if (passwordString.length < 8) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters.'
      });
    }

    if (passwordString.length > 128) {
      return res.status(400).json({
        message:
          'Password is too long.'
      });
    }

    const exists =
      await User.findOne({
        email: normalizedEmail
      });

    if (exists) {
      return res.status(409).json({
        message:
          'An account with this email already exists.'
      });
    }

    const user =
      await User.create({
        name: cleanName,

        email: normalizedEmail,

        phone: cleanPhone,

        password:
          await bcrypt.hash(
            passwordString,
            10
          ),

        /*
         * Unified account defaults.
         */
        role: 'renter',
        roles: ['renter'],
        activeMode: 'renting',

        verified: false,
        avatar: ''
      });

      try {
        await sendWelcomeEmail({
          email: user.email,
          name: user.name
        });
      } catch (emailError) {
        console.error(
          'Welcome email error:',
          emailError
        );
      }

    res.json({
      user: safeUser(user),
      token: signToken(user)
    });
  } catch (error) {
    console.error(
      'Signup error:',
      error
    );

    res.status(500).json({
      message:
        'Could not create your account.'
    });
  }
});

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/
router.post('/login', async (req, res) => {
  try {
    const {
      email,
      password
    } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        message:
          'Email and password are required.'
      });
    }

    const normalizedEmail =
      String(email)
        .trim()
        .toLowerCase();

    if (
      !isValidEmail(normalizedEmail) ||
      normalizedEmail.length > 254
    ) {
      return res.status(400).json({
        message:
          'Please enter a valid email address.'
      });
    }

    const user =
      await User.findOne({
        email: normalizedEmail
      });

    if (
      !user ||
      !(await bcrypt.compare(
        String(password),
        user.password
      ))
    ) {
      return res.status(401).json({
        message:
          'Invalid email or password.'
      });
    }

    /*
     * Gracefully normalize legacy accounts when they log in.
     *
     * This progressively upgrades old documents without
     * requiring a manual database migration.
     */
    let changed = false;

    if (!Array.isArray(user.roles)) {
      if (user.role === 'owner') {
        user.roles = [
          'renter',
          'owner'
        ];
      } else if (user.role === 'admin') {
        user.roles = ['admin'];
      } else {
        user.roles = ['renter'];
      }

      changed = true;
    }

    if (!user.activeMode) {
      user.activeMode =
        user.role === 'owner'
          ? 'hosting'
          : 'renting';

      changed = true;
    }

    if (
      user.role === 'owner' &&
      !user.roles.includes('renter')
    ) {
      user.roles.push('renter');
      changed = true;
    }

    if (changed) {
      await user.save();
    }

    res.json({
      user: safeUser(user),
      token: signToken(user)
    });
  } catch (error) {
    console.error(
      'Login error:',
      error
    );

    res.status(500).json({
      message:
        'Could not sign you in.'
    });
  }
});

/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
*/
router.get('/me', auth, (req, res) => {
  res.json({
    user: safeUser(req.user)
  });
});

/*
|--------------------------------------------------------------------------
| UPDATE PROFILE
|--------------------------------------------------------------------------
*/
router.patch(
  '/profile',
  auth,
  async (req, res) => {
    try {
      const {
        name,
        email,
        phone,
        avatar,
        bio
      } = req.body || {};

      const user =
        await User.findById(
          req.user._id
        );

      if (!user) {
        return res.status(404).json({
          message:
            'Account not found.'
        });
      }

      /*
       * Name
       */
      if (name !== undefined) {
        const cleanName =
          String(name).trim();

        if (
          cleanName.length < 2 ||
          cleanName.length > 100
        ) {
          return res.status(400).json({
            message:
              'Name must be between 2 and 100 characters.'
          });
        }

        user.name = cleanName;
      }

      /*
       * Email
       */
      if (email !== undefined) {
        const normalizedEmail =
          String(email)
            .trim()
            .toLowerCase();

        if (
          !normalizedEmail ||
          !isValidEmail(normalizedEmail)
        ) {
          return res.status(400).json({
            message:
              'Please enter a valid email address.'
          });
        }

        if (
          normalizedEmail.length > 254
        ) {
          return res.status(400).json({
            message:
              'Email address is too long.'
          });
        }

        const emailOwner =
          await User.findOne({
            email: normalizedEmail,
            _id: {
              $ne: user._id
            }
          });

        if (emailOwner) {
          return res.status(409).json({
            message:
              'That email address is already being used by another account.'
          });
        }

        user.email =
          normalizedEmail;
      }

      /*
       * Phone
       */
      if (phone !== undefined) {
        const cleanPhone =
          String(phone).trim();

        if (cleanPhone.length > 30) {
          return res.status(400).json({
            message:
              'Phone number is too long.'
          });
        }

        user.phone =
          cleanPhone;
      }

      /*
       * Avatar
       */
      if (avatar !== undefined) {
        if (avatar === '') {
          user.avatar = '';
        } else {
          const avatarString =
            String(avatar);

          if (
            !avatarString.startsWith(
              'data:image/'
            )
          ) {
            return res.status(400).json({
              message:
                'Profile picture must be an image.'
            });
          }

          if (
            avatarString.length >
            2.8 * 1024 * 1024
          ) {
            return res.status(400).json({
              message:
                'Profile picture is too large. Please choose an image under 2 MB.'
            });
          }

          user.avatar =
            avatarString;
        }
      }

      if (bio !== undefined) {
        const cleanBio =
          String(bio).trim();

        if (cleanBio.length > 200) {
          return res.status(400).json({
            message:
              'Bio is too long.'
          });
        }

        user.bio = cleanBio;
      }

      await user.save();

      res.json({
        message:
          'Profile updated successfully.',
        user: safeUser(user)
      });
    } catch (error) {
      console.error(
        'Profile update error:',
        error
      );

      res.status(500).json({
        message:
          'Could not update your profile.'
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| CHANGE PASSWORD
|--------------------------------------------------------------------------
*/
router.patch(
  '/password',
  auth,
  async (req, res) => {
    try {
      const {
        currentPassword,
        newPassword
      } = req.body || {};

      if (
        !currentPassword ||
        !newPassword
      ) {
        return res.status(400).json({
          message:
            'Current password and new password are required.'
        });
      }

      const newPasswordString =
        String(newPassword);

      if (
        newPasswordString.length < 8
      ) {
        return res.status(400).json({
          message:
            'New password must be at least 8 characters.'
        });
      }

      if (
        newPasswordString.length > 128
      ) {
        return res.status(400).json({
          message:
            'New password is too long.'
        });
      }

      const user =
        await User.findById(
          req.user._id
        );

      if (!user) {
        return res.status(404).json({
          message:
            'Account not found.'
        });
      }

      const passwordMatches =
        await bcrypt.compare(
          String(currentPassword),
          user.password
        );

      if (!passwordMatches) {
        return res.status(401).json({
          message:
            'Current password is incorrect.'
        });
      }

      user.password =
        await bcrypt.hash(
          newPasswordString,
          10
        );

      await user.save();

      res.json({
        message:
          'Password changed successfully.'
      });
    } catch (error) {
      console.error(
        'Password change error:',
        error
      );

      res.status(500).json({
        message:
          'Could not change your password.'
      });
    }
  }
);

export default router;
