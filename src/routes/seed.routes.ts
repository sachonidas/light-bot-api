import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { syncDailyPrices } from '../services/esios.service';

const router = Router();

// Solo disponible en desarrollo
router.post('/', async (_req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Solo disponible en desarrollo' });
  }

  const providers = [
    { provider: 'PVPC', costPerKwh: 0.1423 },
    { provider: 'Iberdrola', costPerKwh: 0.1650 },
    { provider: 'Naturgy', costPerKwh: 0.1580 },
    { provider: 'Repsol', costPerKwh: 0.1510 },
    { provider: 'Holaluz', costPerKwh: 0.1390 },
  ];

  const days = 90;
  const records = [];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    for (const { provider, costPerKwh } of providers) {
      // Variación aleatoria ±5% por día
      const variation = 1 + (Math.random() - 0.5) * 0.1;
      records.push({
        date,
        provider,
        tariffType: provider === 'PVPC' ? 'PVPC' : 'FIXED',
        costPerKwh: Math.round(costPerKwh * variation * 10000) / 10000,
      });
    }
  }

  await prisma.price.createMany({ data: records, skipDuplicates: true });

  return res.json({ message: `${records.length} precios insertados` });
});

router.post('/esios-sync', async (_req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Solo disponible en desarrollo' });
  }
  await syncDailyPrices();
  return res.json({ message: 'Sincronización ESIOS completada' });
});

export default router;
