# ECOTrack PLM

A full-stack **Product Lifecycle Management (PLM)** system focused on **Engineering Change Order (ECO)** tracking. Built with a monorepo architecture featuring a modern React frontend and a robust Node.js backend.

## Tech Stack

### Frontend
- **Next.js 16** with React 19
- **TailwindCSS 4** + shadcn/ui components
- **Better Auth** client for authentication
- TypeScript

### Backend
- **Express.js 5** with TypeScript
- **Prisma ORM** with PostgreSQL (NeonDB)
- **Better Auth** for authentication (email/password, OTP, sessions)
- Role-Based Access Control (Admin, Engineering User, Approver, Viewer)

## Features

- **Authentication** — Sign-up, Sign-in, Forgot/Reset Password with OTP verification
- **ECO Management** — Create, list, and review Engineering Change Orders with role-based permissions
- **Admin Dashboard** — User management with session tracking
- **Role-Based Access** — Granular permissions for ECO creation (Admin, Engineering User) and review/approval (Admin, Approver)

## Project Structure

```
ECOTrack-PLM/
├── backend/          # Express.js API server
│   ├── lib/          # Auth config, Prisma client
│   ├── prisma/       # Schema & migrations
│   └── server.ts     # Main server entry point
├── frontend/         # Next.js application
│   ├── app/
│   │   ├── (auth)/   # Sign-in, Sign-up, Password reset pages
│   │   └── (main)/   # Dashboard, ECO, Admin, Profile pages
│   ├── components/   # Reusable UI components
│   └── lib/          # Auth client, utilities
└── .gitignore
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (or NeonDB)

### Setup

1. **Install dependencies**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Configure environment variables**
   - Create `.env` files in both `backend/` and `frontend/` directories
   - Set your database URL, auth secrets, and SMTP config for OTP emails

3. **Run database migrations**
   ```bash
   cd backend && npx prisma migrate dev
   ```

4. **Start development servers**
   ```bash
   # Backend (port 5000)
   cd backend && npm run dev

   # Frontend (port 3000)
   cd frontend && npm run dev
   ```

## License

ISC
