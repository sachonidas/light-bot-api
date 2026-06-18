import { Telegraf } from 'telegraf';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';

let bot: Telegraf | null = null;

export function getTelegramBot(): Telegraf | null {
  return bot;
}

export function startTelegramBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'your_telegram_bot_token') {
    logger.warn('TELEGRAM_BOT_TOKEN no configurado, bot desactivado');
    return;
  }

  bot = new Telegraf(token);

  bot.start((ctx) => {
    ctx.reply(
      '¡Hola! Soy LuzBot 🔌\n\n' +
      'Te aviso cuando encuentre una tarifa de luz más barata para ti.\n\n' +
      'Para vincular tu cuenta usa:\n/vincular <tu-token>\n\n' +
      'Puedes obtener tu token en la sección de Ajustes de la web.'
    );
  });

  bot.command('vincular', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 2 || !parts[1].trim()) {
      return ctx.reply('Uso: /vincular <token>\n\nObtén tu token en Ajustes → Notificaciones → Telegram.');
    }

    const token = parts[1].trim();
    const telegramId = String(ctx.from.id);

    try {
      const user = await prisma.user.findUnique({ where: { telegramToken: token } });

      if (!user) {
        return ctx.reply('Token no válido. Comprueba que lo copiaste correctamente desde los Ajustes.');
      }

      if (user.telegramId) {
        return ctx.reply('Esta cuenta ya tiene Telegram vinculado.');
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { telegramId },
      });

      logger.info(`Telegram vinculado: user ${user.email} → ${telegramId}`);
      return ctx.reply(
        '✅ ¡Cuenta vinculada correctamente!\n\n' +
        `A partir de ahora te avisaré cuando encuentre una tarifa que te ahorre más de 5€/mes.`
      );
    } catch (err) {
      logger.error(err, 'Error vinculando Telegram');
      return ctx.reply('Error interno. Inténtalo de nuevo más tarde.');
    }
  });

  bot.command('estado', async (ctx) => {
    const telegramId = String(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      return ctx.reply('No tienes ninguna cuenta vinculada. Usa /vincular <token>.');
    }

    return ctx.reply(
      `✅ Cuenta vinculada: ${user.email}\n` +
      `📊 Consumo: ${user.monthlyKwh} kWh/mes\n` +
      `⚡ Proveedor actual: ${user.currentProvider}`
    );
  });

  bot.command('desvincular', async (ctx) => {
    const telegramId = String(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      return ctx.reply('No tienes ninguna cuenta vinculada.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { telegramId: null },
    });

    return ctx.reply('Cuenta desvinculada. Puedes volver a vincularla desde los Ajustes.');
  });

  bot.launch();
  logger.info('Bot de Telegram iniciado (@luz_app_bot)');

  process.once('SIGINT', () => bot?.stop('SIGINT'));
  process.once('SIGTERM', () => bot?.stop('SIGTERM'));
}

export async function sendTelegramAlert(telegramId: string, message: string): Promise<void> {
  if (!bot) return;
  try {
    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML' });
  } catch (err) {
    logger.error(err, `Error enviando mensaje Telegram a ${telegramId}`);
  }
}
