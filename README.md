# Better Auth Login System

A complete authentication system built with Next.js 15, Better Auth, and Prisma. Features secure email/password authentication, social login (Google & GitHub), password reset with email tokens, and role-based access control.

## ✨ Features

- 🔐 **Email/Password Authentication** - Secure credential-based login with password strength validation
- 🌐 **Social Login** - Sign in with Google and GitHub
- 📧 **Password Reset** - Token-based password reset flow with email notifications
- 👁️ **Password Visibility Toggle** - Eye icons to show/hide passwords
- 🔒 **Role-Based Access Control** - Admin and user roles with protected routes
- 🎨 **Modern UI** - Beautiful, responsive design with Tailwind CSS
- ⚡ **Type-Safe** - Full TypeScript support
- 🗄️ **Database** - PostgreSQL with Prisma ORM
- 🔔 **Toast Notifications** - User feedback with Sonner

## 📊 Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Backend:** Express.js 5.2, Better Auth 1.4.7
- **Database:** PostgreSQL (NeonDB compatible)
- **ORM:** Prisma 5.22.0
- **Authentication:** Better Auth (Email/Password, OAuth, Email OTP)
- **Validation:** Zod 4.3.4
- **Security:** bcrypt, middleware-based route protection
- **Email:** Nodemailer 7.0.11
- **Notifications:** Sonner (Toast notifications)

## 🛠️ Technology Details

### **Frontend**
- **Framework:** Next.js 16.0.10 (App Router)
- **UI Library:** React 19.2.1
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **UI Components:** Custom components with Radix UI primitives (Button, Card, Input, Label)
- **Notifications:** Sonner - Toast notifications
- **Icons:** Lucide React

### **Backend**
- **Server:** Express.js 5.2.1 (Port 5000)
- **Authentication:** Better Auth 1.4.7 (Email/Password, OAuth: Google & GitHub, Email OTP plugin)
- **ORM:** Prisma 5.22.0
- **Database:** PostgreSQL (vidhyapith_hacathon)
- **Email Service:** Nodemailer 7.0.11
- **Password Security:** bcrypt 6.0.0, bcryptjs 3.0.3
- **CORS:** cors 3.0.0

### **Validation & Security**
- **Schema Validation:** Zod 4.3.4
- **Route Protection:** Custom Next.js middleware (cookie-based)
- **Password Requirements:** 8+ chars, uppercase, lowercase, number, special character
- **Environment Config:** dotenv

### **Development**
- **Package Manager:** npm
- **Node.js:** 18+
- **Dev Tools:** tsx, nodemon, ESLint
- **Database Tools:** Prisma Studio, Prisma Migrate

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- Node.js 18+ and npm/yarn/pnpm
- PostgreSQL database
- Git

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd betterauth-login-main
```

### 2. Install Dependencies

This project has **separate frontend and backend folders**. Install dependencies for both:

#### **Frontend Dependencies**
```bash
cd frontend
npm install
```

#### **Backend Dependencies**
```bash
cd backend
npm install
```

### 3. Environment Variables

Create a `.env` file **only in the `backend` directory**.

#### **Backend `.env`** (`backend/.env`)

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/vidhyapith_hacathon"

# Better Auth
BETTER_AUTH_SECRET="your-secret-key-min-32-characters-long"
BETTER_AUTH_URL="http://localhost:5000"

# Server
BACKEND_PORT=5000

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# GitHub OAuth (optional)
GITHUB_ID="your-github-client-id"
GITHUB_SECRET="your-github-client-secret"

# Email Configuration (for password reset)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASSWORD="your-app-specific-password"
EMAIL_FROM="noreply@yourapp.com"
```

> **Note:** The frontend does NOT need a `.env` file. It automatically connects to the backend at `http://localhost:5000` during development.

#### 📝 Notes:

- **DATABASE_URL**: Replace with your PostgreSQL connection string
  - Current database: `vidhyapith_hacathon`
  - Default password: `odoo` (change for production!)
- **BETTER_AUTH_SECRET**: Generate a secure random string (min 32 chars)
- **BACKEND_PORT**: Backend Express server port (default: 5000)
- **Frontend Config**: No `.env` needed! Frontend automatically connects to `http://localhost:5000`
- **Google/GitHub OAuth**: Optional - Get credentials from:
  - [Google Cloud Console](https://console.cloud.google.com/)
  - [GitHub Developer Settings](https://github.com/settings/developers)
- **Email**: For Gmail, use [App Passwords](https://support.google.com/accounts/answer/185833)

### 4. Database Setup

Run Prisma migrations from the **backend** directory:

```bash
cd backend

# Generate Prisma Client
npx prisma generate

# Run migrations to create database tables
npx prisma migrate dev

# (Optional) Open Prisma Studio to view your database
npx prisma studio
```

**Database Tables Created:**
- `User` - User accounts and profiles
- `Session` - Active user sessions
- `Account` - OAuth provider accounts
- `Verification` - Email OTP and password reset tokens

# Run migrations
npx prisma migrate dev

# (Optional) Open Prisma Studio to view your database
npx prisma studio
```

### 5. Run the Development Server

**Important:** This project requires running **TWO separate servers**:

#### **Backend Server (Port 5000)**
```bash
cd backend
npm run dev
# Server will start at http://localhost:5000
```

#### **Frontend Server (Port 3000)**
```bash
cd frontend
npm run dev
# App will start at http://localhost:3000
```

**💡 Tip:** Open two terminal windows/tabs to run both servers simultaneously.

Open [http://localhost:3000](http://localhost:3000) in your browser once both servers are running.

### 6. Verify Setup

- ✅ Backend running on `http://localhost:5000`
- ✅ Frontend running on `http://localhost:3000`
- ✅ Database connection successful
- ✅ Can access sign-in page

## 🔑 Authentication Flow

### Sign Up
1. Navigate to `/sign-up`
2. Enter email and password (must meet strength requirements)
3. Account created with role assignment

### Sign In
1. Navigate to `/sign-in`
2. Sign in with email/password or use social login
3. Redirects to dashboard on success

### Password Reset
1. Click "Forgot Password?" on sign-in page
2. Enter your email address
3. Receive reset link via email (valid for 15 minutes)
4. Click link and enter new password
5. Password updated successfully

### Social Login
1. Click "Continue with Google" or "Continue with GitHub"
2. Authorize the application
3. Automatically signed in and redirected

## 📁 Project Structure

```
betterauth-login-main/
├── frontend/                    # Next.js Frontend (Port 3000)
│   ├── app/
│   │   ├── (auth)/             # Authentication routes
│   │   │   ├── layout.tsx      # Auth layout with session check
│   │   │   ├── sign-in/        # Login page
│   │   │   ├── sign-up/        # Registration page
│   │   │   ├── forgot-password/ # Password reset request
│   │   │   └── reset-password/ # Password reset with OTP
│   │   ├── (main)/             # Protected routes
│   │   │   ├── layout.tsx      # Main layout with sidebar
│   │   │   ├── sidebar.tsx     # Left navigation sidebar
│   │   │   ├── dashboard/      # User dashboard
│   │   │   └── admin/          # Admin panel (role-based)
│   │   ├── unauthorized/       # 401 error page
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page (redirects to sign-in)
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   └── ui/                 # Reusable UI components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       └── label.tsx
│   ├── lib/
│   │   ├── auth-client.ts      # Better Auth client configuration
│   │   ├── get-session.ts      # Server-side session helper
│   │   ├── utils.ts            # Utility functions
│   │   └── validation.ts       # Zod validation schemas
│   ├── middleware.ts           # Route protection middleware
│   ├── .env                    # Frontend environment variables
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                     # Express.js Backend (Port 5000)
│   ├── lib/
│   │   ├── auth.ts             # Better Auth server configuration
│   │   ├── prisma.ts           # Prisma client instance
│   │   └── validation.ts       # Server-side validation
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── migrations/         # Database migrations
│   ├── server.ts               # Express server entry point
│   ├── .env                    # Backend environment variables
│   ├── package.json
│   └── tsconfig.json
│
└── README.md                    # This file
```

### **Key Files Explained**

**Frontend:**
- `middleware.ts` - Protects routes, checks authentication cookies
- `lib/auth-client.ts` - Better Auth client for sign-in, sign-up, OAuth
- `lib/get-session.ts` - Fetches session from backend API
- `app/(auth)/` - Public authentication pages
- `app/(main)/` - Protected pages requiring authentication

**Backend:**
- `server.ts` - Express server with Better Auth integration
- `lib/auth.ts` - Authentication configuration (OAuth, email OTP, password rules)
- `lib/prisma.ts` - Database client with connection pooling
- `prisma/schema.prisma` - Database models (User, Session, Account, Verification)

## 🔐 Password Requirements

Passwords must meet the following criteria:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## 🎯 Protected Routes

- `/dashboard` - Available to all authenticated users
- `/admin` - Only accessible to users with admin role

## 🔧 Configuration

### Adding New Roles

Edit the user schema in `lib/auth.ts`:

```typescript
user: {
  additionalFields: {
    role: {
      type: "string",
      input: false,
    }
  }
}
```

### Customizing Email Templates

Edit email templates in `app/api/send-otp/route.ts`:

```typescript
const mailOptions = {
  // Customize HTML email template here
}
```

### Password Hashing

This project uses Better Auth's built-in scrypt hashing. Passwords are automatically hashed using industry-standard practices.

## 🐛 Troubleshooting

### Database Connection Issues
- Verify your `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check firewall/network settings

### Email Not Sending
- Verify SMTP credentials
- For Gmail, ensure "Less secure app access" is enabled or use App Passwords
- Check spam folder

### OAuth Not Working
- Verify redirect URIs in OAuth provider settings
- Check client ID and secret are correct
- Ensure callback URL matches your app URL

## 📦 Database Schema

The application uses the following main tables:

- **user** - User account information
- **session** - Active user sessions
- **account** - Authentication providers and credentials
- **verification** - Password reset tokens and email verification

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy

### Environment Variables for Production

Remember to update these for production:
- `BETTER_AUTH_URL` - Your production domain
- `APP_URL` - Your production domain
- `DATABASE_URL` - Production database connection

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📧 Support

For support, email your-email@example.com or open an issue in the repository.

---

Built with ❤️ using Next.js and Better Auth
