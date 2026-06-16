# light-bot-api

REST API para comparación de tarifas de luz en España. Obtiene precios PVPC oficiales de ESIOS (Red Eléctrica), los compara por usuario y envía alertas cuando hay una opción más barata.

## Stack

- Node.js + TypeScript + Express
- PostgreSQL + Prisma ORM
- JWT (access + refresh tokens)
- node-cron (scheduler diario)
- Resend (notificaciones email)
- Telegraf (bot Telegram)

## Requisitos

- Node.js 20+
- Docker (para PostgreSQL local)
- API key de ESIOS — solicitar en [esios.ree.es](https://www.esios.ree.es)
- Cuenta en [Resend](https://resend.com) para emails

## Instalación

```bash
npm install
cp .env.example .env   # Rellenar variables
docker compose up -d   # Levantar PostgreSQL
npm run db:migrate     # Crear tablas
npm run dev            # Servidor en puerto 3000
```

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Cadena de conexión PostgreSQL |
| `JWT_SECRET` | Secret para access tokens |
| `JWT_REFRESH_SECRET` | Secret para refresh tokens |
| `ESIOS_API_KEY` | API key de Red Eléctrica |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram |
| `RESEND_API_KEY` | API key de Resend |
| `EMAIL_FROM` | Dirección de envío de emails |
| `FRONTEND_URL` | URL del frontend (CORS) |

## Endpoints

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registro de usuario |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Renovar tokens |
| POST | `/api/auth/logout` | Cerrar sesión |

### Precios
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/prices/current` | No | Precios del día |
| GET | `/api/prices/history` | Sí | Histórico 90 días |
| GET | `/api/prices/best` | Sí | Mejor oferta para el usuario |

### Otros
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/seed` | Insertar datos de prueba (solo desarrollo) |

## Scripts

```bash
npm run dev          # Servidor en modo desarrollo
npm run build        # Compilar TypeScript
npm run db:migrate   # Ejecutar migraciones
npm run db:studio    # Abrir Prisma Studio
```

## Colección Postman

Importa `luz-bot-api.postman_collection.json` para probar todos los endpoints. Los tokens JWT se guardan automáticamente en variables de colección al hacer login o registro.
