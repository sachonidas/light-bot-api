import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';

const ESIOS_BASE_URL = process.env.ESIOS_BASE_URL ?? 'https://api.esios.ree.es';
// PVPC indicator ID
const PVPC_INDICATOR = 1001;

type EsiosValue = { datetime: string; value: number; geo_id: number };

async function fetchPVPCRange(startDate: string, endDate: string): Promise<EsiosValue[]> {
  const res = await fetch(
    `${ESIOS_BASE_URL}/indicators/${PVPC_INDICATOR}?start_date=${startDate}T00:00&end_date=${endDate}T23:59`,
    {
      headers: {
        'x-api-key': process.env.ESIOS_API_KEY ?? '',
        'Accept': 'application/json',
      },
    }
  );

  if (!res.ok) throw new Error(`ESIOS API error: ${res.status}`);

  const data = await res.json() as { indicator?: { values: EsiosValue[] } };
  return (data.indicator?.values ?? []).filter((v) => v.geo_id === 8741);
}

function groupByDay(values: EsiosValue[]): Record<string, number> {
  const byDay: Record<string, number[]> = {};

  for (const v of values) {
    const day = v.datetime.split('T')[0];
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(v.value);
  }

  return Object.fromEntries(
    Object.entries(byDay).map(([day, vals]) => [
      day,
      vals.reduce((s, v) => s + v, 0) / vals.length / 1000, // €/kWh
    ])
  );
}

export async function syncDailyPrices(): Promise<void> {
  logger.info('Iniciando sincronización de precios PVPC');

  try {
    const today = new Date().toISOString().split('T')[0];
    const values = await fetchPVPCRange(today, today);

    if (values.length === 0) {
      logger.warn('No se obtuvieron datos de ESIOS');
      return;
    }

    const byDay = groupByDay(values);
    const avgPrice = byDay[today];

    const date = new Date(today);
    date.setUTCHours(0, 0, 0, 0);

    await prisma.price.upsert({
      where: { date_provider: { date, provider: 'PVPC' } },
      update: { costPerKwh: avgPrice },
      create: { date, provider: 'PVPC', tariffType: 'PVPC', costPerKwh: avgPrice },
    });

    logger.info({ avgPrice }, 'Precio PVPC sincronizado');
  } catch (err) {
    logger.error(err, 'Error sincronizando precios ESIOS');
  }
}

export async function syncHistoricalPrices(days = 90): Promise<number> {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // hasta ayer
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];

  logger.info({ start, end }, 'Sincronizando histórico PVPC');

  const values = await fetchPVPCRange(start, end);
  const byDay = groupByDay(values);

  const records = Object.entries(byDay).map(([day, avgPrice]) => {
    const date = new Date(day);
    date.setUTCHours(0, 0, 0, 0);
    return { date, provider: 'PVPC', tariffType: 'PVPC', costPerKwh: avgPrice };
  });

  await prisma.price.createMany({ data: records, skipDuplicates: true });

  logger.info({ count: records.length }, 'Histórico PVPC sincronizado');
  return records.length;
}

export async function cleanOldPrices(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const { count } = await prisma.price.deleteMany({
    where: { date: { lt: cutoff } },
  });

  logger.info({ count }, 'Precios antiguos eliminados');
}
