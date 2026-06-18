import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types';

const updateSchema = z.object({
  monthlyKwh: z.number().min(0).max(10000).optional(),
  currentProvider: z.string().min(1).optional(),
  zipCode: z.string().regex(/^\d{5}$/, 'Código postal inválido').optional(),
  notifEmail: z.boolean().optional(),
  notifTelegram: z.boolean().optional(),
});

export async function getProfile(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      email: true,
      monthlyKwh: true,
      currentProvider: true,
      zipCode: true,
      notifEmail: true,
      notifTelegram: true,
      telegramId: true,
      telegramToken: true,
      createdAt: true,
    },
  });

  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  return res.json(user);
}

export async function updateProfile(req: AuthRequest, res: Response) {
  const result = updateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten() });
  }

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: result.data,
    select: {
      id: true,
      email: true,
      monthlyKwh: true,
      currentProvider: true,
      zipCode: true,
      notifEmail: true,
      notifTelegram: true,
      telegramId: true,
      telegramToken: true,
    },
  });

  return res.json(user);
}
