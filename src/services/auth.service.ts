import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AuthPayload } from '../types';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
  });
}

export function generateRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') as `${number}${'s' | 'm' | 'h' | 'd'}`,
  });
}

export async function saveRefreshToken(token: string, userId: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export async function validateRefreshToken(token: string): Promise<AuthPayload | null> {
  const stored = await prisma.refreshToken.findUnique({ where: { token } });

  if (!stored || stored.expiresAt < new Date()) {
    return null;
  }

  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as AuthPayload;
  } catch {
    return null;
  }
}
