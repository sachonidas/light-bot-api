import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types';

const router = Router();

router.get('/current', async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prices = await prisma.price.findMany({
    where: { date: today },
    orderBy: { costPerKwh: 'asc' },
  });

  return res.json(prices);
});

router.get('/history', authMiddleware, async (req: AuthRequest, res) => {
  const from = new Date();
  from.setDate(from.getDate() - 90);

  const prices = await prisma.price.findMany({
    where: { date: { gte: from } },
    orderBy: { date: 'asc' },
  });

  return res.json(prices);
});

router.get('/best', authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prices = await prisma.price.findMany({
    where: {
      date: today,
      provider: { not: user.currentProvider },
    },
    orderBy: { costPerKwh: 'asc' },
  });

  const ranked = prices.map((p) => ({
    ...p,
    estimatedMonthly: p.costPerKwh * user.monthlyKwh,
    savings: 0,
  }));

  return res.json(ranked[0] ?? null);
});

export default router;
