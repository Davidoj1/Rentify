import express from 'express';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';
import { safeUser } from '../utils/format.js';

const router = express.Router();

/*
|--------------------------------------------------------------------------
| POST /api/account/become-owner
|--------------------------------------------------------------------------
| Converts a normal renter account into a unified renter + owner account.
|
| Existing renter capability is preserved.
| The account receives owner capability and enters Hosting mode.
|--------------------------------------------------------------------------
*/
router.post('/become-owner', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User account not found.'
      });
    }

    const roles =
      Array.isArray(user.roles) && user.roles.length
        ? [...user.roles]
        : [user.role || 'renter'];

    if (!roles.includes('renter')) {
      roles.push('renter');
    }

    if (!roles.includes('owner')) {
      roles.push('owner');
    }

    user.roles = roles;

    // Keep admin accounts as admin.
    // Everyone else who becomes an owner gets owner as the
    // legacy/current primary role for backend compatibility.
    user.role = user.role === 'admin' ? 'admin' : 'owner';

    user.activeMode = 'hosting';

    await user.save();

    return res.json({
      message: 'Your account is now enabled for hosting.',
      user: safeUser(user)
    });
  } catch (error) {
    console.error('Become owner error:', error);

    return res.status(500).json({
      message: 'Could not enable hosting for this account.'
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/account/enable-renting
|--------------------------------------------------------------------------
| Gives an owner-only account renter capability.
|
| No second account is created.
|--------------------------------------------------------------------------
*/
router.post('/enable-renting', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User account not found.'
      });
    }

    const roles =
      Array.isArray(user.roles) && user.roles.length
        ? [...user.roles]
        : [user.role || 'owner'];

    if (!roles.includes('renter')) {
      roles.push('renter');
    }

    user.roles = roles;
    user.activeMode = 'renting';

    await user.save();

    return res.json({
      message: 'Renting access enabled.',
      user: safeUser(user)
    });
  } catch (error) {
    console.error('Enable renting error:', error);

    return res.status(500).json({
      message: 'Could not enable renting for this account.'
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/account/mode
|--------------------------------------------------------------------------
| Switch between:
|
|   renting  -> renter experience
|   hosting  -> owner experience
|
| IMPORTANT:
| Legacy owner accounts may have:
|
|   role: 'owner'
|   roles: missing / ['renter'] / otherwise incomplete
|
| Therefore we recognize BOTH the legacy role field and the
| new roles array.
|--------------------------------------------------------------------------
*/
router.post('/mode', auth, async (req, res) => {
  try {
    const mode = req.body?.mode;

    if (!['renting', 'hosting'].includes(mode)) {
      return res.status(400).json({
        message: 'Invalid account mode.'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User account not found.'
      });
    }

    let roles =
      Array.isArray(user.roles) && user.roles.length
        ? [...user.roles]
        : [];

    /*
     * Backwards compatibility:
     *
     * If the database says role === 'owner', that account is
     * already an owner even if the newer roles array has not
     * been populated yet.
     */
    const legacyOwner =
      user.role === 'owner';

    const legacyAdmin =
      user.role === 'admin';

    const canHost =
      legacyAdmin ||
      legacyOwner ||
      roles.includes('owner') ||
      roles.includes('admin');

    const canRent =
      user.role === 'renter' ||
      roles.includes('renter');

    /*
     * If this is an old owner account, repair the roles array
     * while we are switching modes.
     *
     * This does NOT remove any existing capability.
     */
    if (canHost && legacyOwner && !roles.includes('owner')) {
      roles.push('owner');
    }

    /*
     * An owner account is also given renter capability when
     * using the unified Rentify account model.
     *
     * This preserves the intended one-account design:
     * renter + owner capabilities on the same account.
     */
    if (legacyOwner && !roles.includes('renter')) {
      roles.push('renter');
    }

    if (legacyAdmin && !roles.includes('admin')) {
      roles.push('admin');
    }

    if (mode === 'hosting' && !canHost) {
      return res.status(403).json({
        message:
          'Enable hosting on your account before switching to Hosting mode.'
      });
    }

    if (mode === 'renting' && !canRent && !legacyOwner) {
      return res.status(403).json({
        message:
          'Create renter access before switching to Renting mode.'
      });
    }

    /*
     * Persist the repaired roles and requested mode.
     */
    if (roles.length) {
      user.roles = [...new Set(roles)];
    }

    user.activeMode = mode;

    await user.save();

    return res.json({
      message:
        mode === 'hosting'
          ? 'Hosting mode activated.'
          : 'Renting mode activated.',
      user: safeUser(user)
    });
  } catch (error) {
    console.error('Mode switch error:', error);

    return res.status(500).json({
      message: 'Could not change account mode.'
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/account/normalize-legacy-owner
|--------------------------------------------------------------------------
| Repairs old owner accounts when they first sign in.
|
| This route is deliberately conservative:
| it only operates on accounts whose primary role is owner.
|--------------------------------------------------------------------------
*/
router.post('/normalize-legacy-owner', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User account not found.'
      });
    }

    if (user.role === 'owner') {
      const roles =
        Array.isArray(user.roles) && user.roles.length
          ? [...user.roles]
          : [];

      if (!roles.includes('renter')) {
        roles.push('renter');
      }

      if (!roles.includes('owner')) {
        roles.push('owner');
      }

      user.roles = [...new Set(roles)];

      /*
       * Only move the legacy owner to Hosting automatically
       * when there is no valid active mode yet.
       *
       * This avoids forcing newer unified accounts out of
       * Renting mode every time they sign in.
       */
      if (!['renting', 'hosting'].includes(user.activeMode)) {
        user.activeMode = 'hosting';
      }

      await user.save();
    }

    return res.json({
      message: 'Account checked successfully.',
      user: safeUser(user)
    });
  } catch (error) {
    console.error('Legacy owner migration error:', error);

    return res.status(500).json({
      message: 'Could not update the legacy owner account.'
    });
  }
});

export default router;
