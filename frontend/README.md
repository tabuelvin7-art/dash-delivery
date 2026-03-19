# Nairobi Delivery Platform - Frontend

React + TypeScript frontend application for the Nairobi Delivery Management Platform.

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router DOM** - Client-side routing
- **Axios** - HTTP client
- **React Hook Form** - Form validation and management

## Project Structure

```
src/
├── components/     # Reusable React components
├── pages/          # Page-level components for routing
├── services/       # API service modules and external integrations
├── contexts/       # React Context providers for state management
├── types/          # TypeScript type definitions and interfaces
├── utils/          # Utility functions and helper modules
└── assets/         # Static assets (images, icons, etc.)
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
```
VITE_API_BASE_URL=http://localhost:3000/api
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build

Create a production build:
```bash
npm run build
```

The build output will be in the `dist/` directory.

### Preview Production Build

Preview the production build locally:
```bash
npm run preview
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Configuration

### TypeScript

TypeScript configuration is split into:
- `tsconfig.json` - Base configuration
- `tsconfig.app.json` - Application-specific settings
- `tsconfig.node.json` - Node.js-specific settings (for Vite config)

### Tailwind CSS

Tailwind is configured in `tailwind.config.js`. The configuration includes:
- Content paths for purging unused styles
- Theme customization
- Plugin configuration

### API Client

The Axios API client is configured in `src/services/api.ts` with:
- Base URL from environment variables
- Request interceptor for authentication tokens
- Response interceptor for error handling
- Automatic token refresh on 401 errors

## Type Definitions

All TypeScript interfaces and types are defined in `src/types/index.ts`, including:
- User types (User, UserRole)
- Package types (Package, PackageStatus, DeliveryMethod)
- Payment types (Payment, PaymentType, PaymentStatus)
- Agent types (Agent)
- Shelf Rental types (ShelfRental, RentalStatus)
- Notification types (Notification, NotificationType)
- API Response types (ApiResponse, PaginatedResponse)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:3000/api` |
| `VITE_APP_NAME` | Application name | `Nairobi Delivery Platform` |

## Next Steps

1. Implement authentication components (login, register, phone verification)
2. Create package management components
3. Build payment integration components
4. Develop dashboard pages for different user roles
5. Add routing with React Router
6. Implement state management with Context API

## Requirements Validated

This task validates the following requirements:
- **20.1**: RESTful API integration
- **23.1**: Mobile responsive design (320px-768px)
- **23.2**: Tablet responsive design (768px-1024px)
- **23.3**: Desktop responsive design (1024px+)
