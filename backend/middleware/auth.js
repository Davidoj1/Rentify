import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/*
 * Return the effective capabilities for a user.
 *
 * Existing users were created before the unified-account
 * system existed, so some documents may not have `roles`.
 *
 * We derive safe capabilities from the legacy `role` field
 * instead of requiring a database migration before beta.
 */
export function getUserRoles(user) {
  const roles = Array.isArray(user?.roles)
    ? [...user.roles]
    : [];

  const legacyRole = user?.role;

  if (legacyRole === 'admin' && !roles.includes('admin')) {
    roles.push('admin');
  }

  if (legacyRole === 'owner' && !roles.includes('owner')) {
    roles.push('owner');
  }

  /*
   * Every normal Rentify owner is also a renter.
   */
  if (
    (legacyRole === 'owner' || roles.includes('owner')) &&
    !roles.includes('renter')
  ) {
    roles.push('renter');
  }

  if (
    legacyRole === 'renter' &&
    !roles.includes('renter')
  ) {
    roles.push('renter');
  }

  return [...new Set(roles)];
}

/*
 * Authentication middleware.
 */
export async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      message: 'Please sign in to continue.'
    });
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev_secret'
    );

    const user = await User.findById(payload.id);

    if (!user) {
      return res.status(401).json({
        message: 'Account not found.'
      });
    }

    /*
     * Normalize legacy users in memory.
     *
     * We don't have to immediately migrate every existing
     * MongoDB document just to make the new authorization
     * system work.
     */
    const effectiveRoles = getUserRoles(user);

    req.user = user;

    /*
     * Make effective roles available to routes without
     * changing the persisted user document.
     */
    req.userRoles = effectiveRoles;

    next();
  } catch {
    return res.status(401).json({
      message: 'Session expired. Please sign in again.'
    });
  }
}

/*
 * Role/capability authorization.
 *
 * Supports both the new roles array and the legacy role field.
 */
export const requireRole = (...roles) => (req, res, next) => {
  const userRoles =
    req.userRoles || getUserRoles(req.user);

  const allowed = roles.some(role =>
    userRoles.includes(role)
  );

  if (!allowed) {
    return res.status(403).json({
      message:
        'You do not have permission to perform this action.'
    });
  }

  next();
};

/*
 * Convenience helper for route-level authorization.
 */
export function hasRole(user, role) {
  const roles = getUserRoles(user);
  return roles.includes(role);
}
