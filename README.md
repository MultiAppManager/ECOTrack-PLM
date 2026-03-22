# 🏭 ECOTrack-PLM: Engineering Change Order System

![Hackathon](https://img.shields.io/badge/Built%20For-Odoo%20Hackathon%202026-orange?style=for-the-badge)

## 📋 What is ECOTrack-PLM?

**ECOTrack-PLM** is a **Product Lifecycle Management system** for managing Engineering Change Orders (ECOs) in manufacturing. It ensures controlled, versioned, and approval-driven changes to Products and Bills of Materials (BoMs).

### Problem Solved
- ✅ **Version Control**: All changes create new versions; old versions archived
- ✅ **Approval Workflows**: Multi-stage ECOs with role-based access control
- ✅ **Change Tracking**: Side-by-side comparison before approval
- ✅ **Audit Trail**: Complete traceability of all actions
- ✅ **Safe Operations**: Only approved changes reach live systems

---

## 🛠️ Tech Stack

### **Frontend**
- Next.js 16.0.10 (React 19.2.1)
- TypeScript 5.x
- Tailwind CSS 4
- Better Auth + NextAuth.js
- Radix UI, Lucide Icons
- Zod (validation)
- Prisma Client

### **Backend**
- Express.js 5.2.1
- TypeScript 5.x
- Better Auth 1.4.7
- PostgreSQL 16
- Prisma ORM 5.22.0
- Bcrypt (password hashing)
- Nodemailer (SMTP)
- Zod (validation)

### **Database**
- PostgreSQL 16+
- Prisma migrations

### **DevOps**
- Node.js 22.x LTS
- npm 10.x

---

## 🎯 Key Features

1. **Product Master** - Version-controlled products with pricing & attachments
2. **Bill of Materials** - Component tracking with operations & work centers
3. **Engineering Change Orders** - Create ECOs for Product or BoM changes
4. **Approval Workflows** - Multi-stage approvals with role validation
5. **Change Comparison** - Visual diff (before/after) with indicators
6. **Audit Trail** - Complete logging of all actions
7. **Reports** - ECO status, version history, change analysis

---

## 🚀 Quick Start

### Prerequisites
- Node.js 22.x
- npm 10.x
- PostgreSQL 16+

### Setup

**1. Clone & install:**
```bash
git clone https://github.com/MultiAppManager/ECOTrack-PLM.git
cd ECOTrack-PLM
```

**2. Backend setup:**
```bash
cd backend
npm install
npm run prisma:generate
npm run migrate
```

Create `backend/.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/ahemadabd_final_hacathon"
BETTER_AUTH_SECRET=your_generated_secret_key_min_32_chars
BETTER_AUTH_URL=http://localhost:3000
BACKEND_PORT=5000
NODE_ENV=development

# Email (for OTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
```

**3. Frontend setup:**
```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

**4. Run both:**

Terminal 1 - Backend:
```bash
cd backend && npm run dev
# Backend: http://localhost:5000
```

Terminal 2 - Frontend:
```bash
cd frontend && npm run dev
# Frontend: http://localhost:3000
```

---

## 🔐 User Roles

| Role | Permissions |
|------|-------------|
| **Engineering User** | Create ECOs, propose changes, initiate approvals |
| **Approver** | Review & approve ECOs, control effective dates |
| **Operations User** | View active products & BoMs (read-only) |
| **Admin** | Full access, configure stages & approval rules |

---

## 📊 Core Workflows

### BoM Change Example
1. **Engineering User** creates ECO
   - Product: Wooden Table (BoM v1)
   - Change: 12 screws → 16 screws
2. **System** shows comparison (Red indicator: quantity changed)
3. **Approver** reviews and approves
4. **System** creates BoM v2, archives v1
5. **Operations** uses updated BoM for new orders

### Product Price Change
1. **Engineering User** creates ECO
   - Product: Wooden Table
   - Change: Update cost price (premium material)
2. **Approver** validates & approves
3. **System** creates new product version
4. **Operations** uses updated pricing

---

## 🔄 Authentication

- **Sign Up**: Email + password (with strong validation)
- **Sign In**: Email + password or OAuth (Google/GitHub)
- **Forgot Password**: OTP via email (6-digit, 5-min expiry, 3 attempts max)
- **Sessions**: Stored in database with token validation

---

## 📝 Key Endpoints

```
Authentication (Better Auth):
  POST   /api/auth/sign-up/email
  POST   /api/auth/sign-in/email
  POST   /api/auth/sign-out
  GET    /api/auth/session
  POST   /api/send-otp

ECO Management:
  GET    /api/eco-requests          (all authenticated users)
  POST   /api/eco-requests          (admin, engineering user)
  PATCH  /api/eco-requests/:id/status  (admin, approver)

User Management:
  GET    /api/users                 (admin only)
  GET    /api/users/:userId         (admin only)
```

---

## 🔒 Security

✅ Strong password validation (8-25 chars, uppercase, lowercase, number, special)  
✅ Bcrypt hashing  
✅ Role-based access control  
✅ OTP rate limiting  
✅ CORS protection  
✅ SQL injection prevention (Prisma ORM)  
✅ Audit logging  

---

## 📁 Project Structure

```
ECOTrack-PLM/
├── backend/
│   ├── lib/
│   │   ├── auth.ts          (Better Auth config)
│   │   ├── prisma.ts        (DB client)
│   │   └── validation.ts    (Zod schemas)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── server.ts            (Express + routes)
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── (auth)/          (Sign in/up/forgot-password)
│   │   └── (main)/          (Dashboard, ECO, admin)
│   ├── components/ui/       (Reusable components)
│   ├── lib/
│   │   ├── auth-client.ts
│   │   └── validation.ts
│   └── package.json
│
├── .tool-versions.md        (Version compatibility)
├── README.md
└── .gitignore
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend won't start | Check PostgreSQL running, DATABASE_URL in `.env` |
| Email OTP not sending | Verify EMAIL_USER/PASSWORD, check SMTP (use app password for Gmail) |
| Frontend can't connect | Ensure backend on port 5000, check CORS in `server.ts` |
| DB migrations fail | Run `npx prisma migrate reset`, check PostgreSQL version |

---

## 📚 More Info

- **Version Compatibility**: See `.tool-versions.md`
- **Backend Auth**: `backend/lib/auth.ts`
- **Database Schema**: `backend/prisma/schema.prisma`
- **Frontend Routes**: `frontend/app/(auth)` & `frontend/app/(main)`

---

## 🤝 Team

Built for **Odoo Hackathon 2026**:

- **Rathod Himanshu**
- **Vatsal Sarvaiya**
- **Diya Shah**

---

<div align="center">

**Made with ❤️ for the Odoo Hackathon 2026**

*Empowering controlled, auditable, version-managed product changes in manufacturing.*

</div>
