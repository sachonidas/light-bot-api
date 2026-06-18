import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import pricesRoutes from './routes/prices.routes';
import userRoutes from './routes/user.routes';
import seedRoutes from './routes/seed.routes';
import { startScheduler } from './services/scheduler.service';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.use(
  '/api/auth',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Demasiadas solicitudes' } })
);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/prices', pricesRoutes);
app.use('/api/user', userRoutes);
app.use('/api/seed', seedRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Servidor corriendo en puerto ${PORT}`);
  startScheduler();
});
