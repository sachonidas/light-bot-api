import { Resend } from 'resend';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { BestOffer } from '../types';
import { sendTelegramAlert } from './telegram.service';

const resend = new Resend(process.env.RESEND_API_KEY);
const MIN_SAVINGS = 5; // €/mes mínimo para disparar alerta

export async function evaluateAndNotifyUsers(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pvpcPrice = await prisma.price.findFirst({
    where: { date: today, provider: 'PVPC' },
  });

  if (!pvpcPrice) {
    logger.warn('No hay precio PVPC para hoy, saltando notificaciones');
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [{ notifEmail: true }, { notifTelegram: true }],
    },
  });

  for (const user of users) {
    const userMonthlyWithPVPC = pvpcPrice.costPerKwh * user.monthlyKwh;

    const lastAlert = await prisma.alert.findFirst({
      where: { userId: user.id },
      orderBy: { sentAt: 'desc' },
    });

    // Cooldown de 24h
    if (lastAlert) {
      const hoursSince = (Date.now() - lastAlert.sentAt.getTime()) / 3600000;
      if (hoursSince < 24) continue;
    }

    const bestOffer: BestOffer = {
      provider: 'PVPC',
      costPerKwh: pvpcPrice.costPerKwh,
      estimatedMonthly: userMonthlyWithPVPC,
      savings: 0,
    };

    if (bestOffer.savings < MIN_SAVINGS) continue;

    if (user.notifEmail) {
      await sendEmailAlert(user.email, user.currentProvider, bestOffer);
    }

    if (user.notifTelegram && user.telegramId) {
      const msg =
        `⚡ <b>Nueva tarifa más barata</b>\n\n` +
        `Tu proveedor: <b>${user.currentProvider}</b>\n` +
        `Mejor opción: <b>${bestOffer.provider}</b>\n` +
        `Precio: <b>${bestOffer.costPerKwh.toFixed(4)} €/kWh</b>\n` +
        `Ahorro estimado: <b>${bestOffer.savings.toFixed(2)}€/mes</b>`;
      await sendTelegramAlert(user.telegramId, msg);
    }

    await prisma.alert.create({
      data: {
        userId: user.id,
        oldProvider: user.currentProvider,
        newBestProvider: bestOffer.provider,
        estimatedSavings: bestOffer.savings,
        channel: user.notifEmail ? 'email' : 'telegram',
      },
    });
  }
}

async function sendEmailAlert(email: string, currentProvider: string, offer: BestOffer) {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: email,
      subject: `Ahorra ${offer.savings.toFixed(2)}€/mes cambiando de tarifa`,
      html: `
        <h2>Nueva tarifa más barata disponible</h2>
        <p>Tu proveedor actual: <strong>${currentProvider}</strong></p>
        <p>Mejor opción: <strong>${offer.provider}</strong></p>
        <p>Precio: <strong>${offer.costPerKwh.toFixed(4)} €/kWh</strong></p>
        <p>Ahorro estimado: <strong>${offer.savings.toFixed(2)}€/mes</strong></p>
      `,
    });
  } catch (err) {
    logger.error(err, `Error enviando email a ${email}`);
  }
}
