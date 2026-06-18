import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';

const ESIOS_BASE_URL = process.env.ESIOS_BASE_URL ?? 'https://api.esios.ree.es';
// PVPC indicator ID
const PVPC_INDICATOR = 1001;

async function fetchPVPCPrices(): Promise<{ date: string; value: number }[]> {
  const today = new Date().toISOString().split('T')[0];

  const res = await fetch(
    `${ESIOS_BASE_URL}/indicators/${PVPC_INDICATOR}?start_date=${today}T00:00&end_date=${today}T23:59`,
    {
      headers: {
        'x-api-key': process.env.ESIOS_API_KEY ?? '',
        'Accept': 'application/json',
      },
    }
  );

  if (!res.ok) {
    throw new Error(`ESIOS API error: ${res.status}`);
  }

  const data = await res.json() as {
    indicator?: { values: { datetime: string; value: number; geo_id: number }[] }
  };
  // Only Peninsula (geo_id 8741), discard other zones
  return (data.indicator?.values ?? [])
    .filter((v) => v.geo_id === 8741)
    .map((v) => ({ date: v.datetime, value: v.value }));
}

export async function syncDailyPrices(): Promise<void> {
  logger.info('Iniciando sincronización de precios PVPC');

  try {
    const values = await fetchPVPCPrices();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (values.length === 0) {
      logger.warn('No se obtuvieron datos de ESIOS');
      return;
    }

    // Average hourly price for the day in €/kWh (ESIOS returns MWh)
    const avgPrice = values.reduce((sum, v) => sum + v.value, 0) / values.length / 1000;

    await prisma.price.upsert({
      where: { date_provider: { date: today, provider: 'PVPC' } },
      update: { costPerKwh: avgPrice },
      create: {
        date: today,
        provider: 'PVPC',
        tariffType: 'PVPC',
        costPerKwh: avgPrice,
      },
    });

    logger.info({ avgPrice }, 'Precio PVPC sincronizado');
  } catch (err) {
    logger.error(err, 'Error sincronizando precios ESIOS');
  }
}

export async function cleanOldPrices(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const { count } = await prisma.price.deleteMany({
    where: { date: { lt: cutoff } },
  });

  logger.info({ count }, 'Precios antiguos eliminados');
}
