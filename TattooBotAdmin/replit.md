# Telegram Bot Booking System - Admin Panel

## Overview

This is a web-based admin panel for managing a Telegram bot booking system designed for tattoo studios. The application allows administrators to manage masters (artists), services, client bookings, portfolio images, bot messages, and system settings. The frontend is built with React and shadcn/ui components, while the backend uses Express with PostgreSQL/Neon database via Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tool**
- **React 18** with TypeScript for type safety and modern development
- **Vite** as the build tool and dev server for fast HMR and optimized builds
- **Wouter** for lightweight client-side routing instead of React Router

**UI Component System**
- **shadcn/ui** components (New York style) built on Radix UI primitives
- **Tailwind CSS** with custom design tokens following Material Design 3 principles
- **Theme system** supporting light/dark modes via context provider
- Custom CSS variables for consistent theming across components

**State Management**
- **TanStack Query (React Query)** for server state management and caching
- **React Context** for theme and authentication state
- Local storage for simple persistence (auth state, theme preference)

**Design System**
- Material Design 3 inspired admin dashboard patterns
- Inter font family for UI, Roboto Mono for dates/times
- Custom color palette with HSL values for light/dark mode support
- Hover and active elevation effects using CSS custom properties

### Backend Architecture

**Server Framework**
- **Express.js** with TypeScript for API routes
- **HTTP server** created via Node's `http.createServer()` for potential WebSocket support
- Development-only Vite middleware integration for HMR

**Data Layer**
- **Drizzle ORM** for type-safe database queries and schema management
- **PostgreSQL** via Neon serverless driver with WebSocket support
- Schema defined in `shared/schema.ts` for type sharing between frontend/backend
- Migration support via `drizzle-kit`

**Storage Pattern**
- Abstract `IStorage` interface defining CRUD operations
- `MemStorage` in-memory implementation for development/testing
- Designed to be swapped with database-backed storage implementation

**Session Management**
- Currently using localStorage for basic authentication
- `connect-pg-simple` included for PostgreSQL session storage (not yet implemented)
- Protected routes via `ProtectedRoute` component wrapper

### Application Structure

**Project Layout**
```
/client          - Frontend React application
  /src
    /components  - Reusable UI components
    /pages       - Route page components
    /lib         - Utilities and shared logic
    /hooks       - Custom React hooks
/server          - Backend Express application
  routes.ts      - API route definitions
  storage.ts     - Data access layer
  db.ts          - Database connection
/shared          - Code shared between frontend/backend
  schema.ts      - Database schema and types
```

**Component Architecture**
- Functional components with hooks throughout
- Component composition via shadcn/ui primitives
- Separation of presentation (UI components) and container components (pages)
- Example components provided for development/testing

**Key Features**
- Masters management (tattoo artists)
- Services catalog with duration and pricing
- Booking calendar and list views with filtering
- Portfolio image gallery
- Bot message templates editor
- Excel import/export functionality (UI only)
- Settings configuration (bot token, studio info, location)

### External Dependencies

**Database**
- **Neon PostgreSQL** - Serverless PostgreSQL database
- Requires `DATABASE_URL` environment variable
- WebSocket connection support for serverless environments

**Telegram Bot Process Control**
- Configure `BOT_RESTART_SCRIPT` with the shell command that (re)launches the Telegram bot.
- Optionally specify `BOT_STOP_SCRIPT` when stopping the bot requires a different command.
- The scripts receive `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_PREVIOUS_TOKEN`, and `TELEGRAM_BOT_ACTION` (`start`, `restart`, or `stop`) as environment variables.
- When the API token changes in the admin panel, the backend runs the configured script so the bot reloads with fresh credentials.

**UI Component Library**
- **Radix UI** - Headless accessible component primitives (dialogs, dropdowns, etc.)
- **shadcn/ui** - Pre-built styled components on top of Radix UI
- **Lucide React** - Icon library

**Form & Validation**
- **React Hook Form** with **Zod** resolvers for form state and validation
- **drizzle-zod** for generating Zod schemas from database schema

**Date Handling**
- **date-fns** for date manipulation and formatting

**Development Tools**
- **Replit-specific plugins** for dev banner, cartographer, and runtime error overlay
- **tsx** for running TypeScript in Node.js during development
- **esbuild** for production server bundling

**Styling**
- **Tailwind CSS** with custom configuration
- **class-variance-authority (CVA)** for component variant styling
- **clsx** and **tailwind-merge** for conditional class handling

**Data Fetching**
- **TanStack Query** for async state management
- Custom `apiRequest` wrapper for fetch with error handling
- Credential-based requests for session support

**Type Safety**
- Full TypeScript coverage across frontend and backend
- Shared types via `shared/` directory
- Path aliases configured for clean imports (@/, @shared/, @assets/)