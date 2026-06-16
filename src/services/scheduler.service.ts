import cron from 'node-cron';
import { logger } from '../lib/logger';
import { syncDailyPrices, cleanOldPrices } from './esios.service';
import { evaluateAndNotifyUsers } from './notification.service';

export function startScheduler(): void {
  // Fetch precios diarios a las 8:00am
  cron.schedule('0 8 * * *', async () => {
    logger.info('Cron: sincronizando precios ESIOS');
    await syncDailyPrices();
    await evaluateAndNotifyUsers();
  });

  // Limpieza de precios viejos cada domingo a las 2:00am
  cron.schedule('0 2 * * 0', async () => {
    logger.info('Cron: limpiando precios antiguos');
    await cleanOldPrices();
  });

  logger.info('Scheduler iniciado');
}
