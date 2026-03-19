# Nairobi Delivery Management Platform - Backend

Backend API for the Nairobi Delivery Management Platform, built with Express.js, TypeScript, and MongoDB.

## Features

- RESTful API with Express.js
- TypeScript for type safety
- MongoDB with Mongoose ODM
- JWT authentication
- M-Pesa payment integration
- SMS notifications (Africa's Talking)
- Role-based access control (business_owner, customer, agent, admin)
- Request logging with Morgan + Winston
- Rate limiting and security headers (Helmet)

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (v6 or higher)
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and configure your environment variables:
   ```bash
   cp .env.example .env
   ```

4. Initialize the database (creates admin user and coverage areas):
   ```bash
   npm run db:init
   ```

## Development

Start the development server with hot reload:

```bash
npm run dev
```

The server will start on `http://localhost:5000`.

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

## Building

```bash
npm run build
```

## Production

```bash
npm start
```

## Docker

```bash
# Start all services (MongoDB + backend + frontend)
docker-compose up -d

# Stop all services
docker-compose down
```

## Environment Variables

See `.env.example` for all required variables. Key ones:

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWT tokens (min 32 chars) |
| `MPESA_CONSUMER_KEY` | M-Pesa API consumer key |
| `MPESA_CONSUMER_SECRET` | M-Pesa API consumer secret |
| `MPESA_CALLBACK_URL` | Public URL for M-Pesa payment callbacks |
| `SMS_API_KEY` | Africa's Talking API key |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/verify-phone` | Verify phone OTP |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/packages` | List packages |
| POST | `/api/packages` | Create package |
| PATCH | `/api/packages/:id/status` | Update package status |
| POST | `/api/payments/callback` | M-Pesa callback |
| GET | `/api/agents` | List agents |
| GET | `/api/notifications` | Get notifications |
| GET | `/api/reports/delivery-stats` | Delivery statistics |
| GET | `/health` | Health check |

## Project Structure

```
src/
├── index.ts          # Application entry point
├── routes/           # API route definitions
├── services/         # Business logic layer
├── models/           # Mongoose models and schemas
├── middleware/       # Express middleware (auth, validation, etc.)
├── utils/            # Utility functions and helpers
└── tests/            # Integration and property-based tests
scripts/
└── init-db.ts        # Database initialization script
```

## License

ISC
