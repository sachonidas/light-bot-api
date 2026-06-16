import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  saveRefreshToken,
  revokeRefreshToken,
  validateRefreshToken,
} from '../services/auth.service';
import { AuthRequest } from '../types';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  monthlyKwh: z.number().min(0).max(10000),
  currentProvider: z.string().min(1),
  zipCode: z.string().regex(/^\d{5}$/, 'Código postal inválido'),
  notifEmail: z.boolean().default(true),
  notifTelegram: z.boolean().default(false),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function register(req: Request, res: Response) {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten() });
  }

  const { email, password, ...rest } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email ya registrado' });
  }

  const passwordHash = await hashPassword(password);
  const telegramToken = crypto.randomUUID();

  const user = await prisma.user.create({
    data: { email, passwordHash, telegramToken, ...rest },
    select: { id: true, email: true, telegramToken: true },
  });

  const accessToken = generateAccessToken({ userId: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });
  await saveRefreshToken(refreshToken, user.id);

  return res.status(201).json({ user, accessToken, refreshToken });
}

export async function login(req: Request, res: Response) {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten() });
  }

  const { email, password } = result.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const accessToken = generateAccessToken({ userId: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });
  await saveRefreshToken(refreshToken, user.id);

  return res.json({
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken,
  });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token requerido' });
  }

  const payload = await validateRefreshToken(refreshToken);
  if (!payload) {
    return res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }

  await revokeRefreshToken(refreshToken);

  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);
  await saveRefreshToken(newRefreshToken, payload.userId);

  return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
}

export async function logout(req: AuthRequest, res: Response) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  } 
  return res.json({ message: 'Sesión cerrada' });
}
