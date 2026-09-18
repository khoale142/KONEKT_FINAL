import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(user) {
  return jwt.sign(
    { userId: user.id },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export function signWorkspaceToken({ userId, workspaceType, workspaceId, tenantId, role }) {
  return jwt.sign(
    { userId, workspaceType, workspaceId, tenantId, role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
