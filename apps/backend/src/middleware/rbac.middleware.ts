import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

export function authorize(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden - insufficient permissions' });
      return;
    }
    next();
  };
}

// Role hierarchy for convenience
export const AdminOnly = authorize('SUPER_ADMIN');
export const StaffOrAbove = authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'COUNCIL_MEMBER', 'STAFF');
export const RepOrAbove = authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'COUNCIL_MEMBER', 'WARD_REP');
export const AuthenticatedRoles = authorize(
  'SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'COUNCIL_MEMBER',
  'STAFF', 'WARD_REP', 'CITIZEN', 'VOLUNTEER', 'AUDITOR', 'MEDIA'
);
