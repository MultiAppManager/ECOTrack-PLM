import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { auth } from './lib/auth.js';
import { toNodeHandler } from 'better-auth/node';
import prisma from './lib/prisma.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.BACKEND_PORT || 5000;
const ECO_ALLOWED_CREATE_ROLES = new Set(['Admin', 'Engineering User']);
const ECO_ALLOWED_REVIEW_ROLES = new Set(['Admin', 'Approver']);
const ECO_ALLOWED_STATUSES = new Set(['Draft', 'Reviewed', 'Rejected', 'Approved', 'New', 'In Progress']);

// Middleware
app.use(cors({
  origin: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Check if this is a successful sign-up request
    if (req.path === '/api/auth/sign-up/email' && req.method === 'POST' && res.statusCode === 200) {
      try {
        const responseData = typeof data === 'string' ? JSON.parse(data) : data;
        if (responseData?.user?.id) {
          // Store the user ID for the after-request handler
          (res as any).newUserId = responseData.user.id;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    if (res.statusCode >= 400) {
      console.error(`[${res.statusCode}] ${req.method} ${req.path}`, {
        body: req.body,
        error: typeof data === 'string' ? data : JSON.stringify(data)
      });
    }
    res.send = originalSend;
    return res.send(data);
  };
  
  next();
});

// After-response middleware to copy password hash to User table
app.use((req, res, next) => {
  res.on('finish', async () => {
    if (req.path === '/api/auth/sign-up/email' && req.method === 'POST' && res.statusCode === 200) {
      try {
        const userId = (res as any).newUserId;
        if (userId) {
          // Get the account with password hash
          const account = await prisma.account.findFirst({
            where: { userId }
          });
          
          if (account?.password) {
            // Update user's password field with the hash from account
            await prisma.user.update({
              where: { id: userId },
              data: { password: account.password }
            });
            console.log(`✅ Password hash stored in User table for user: ${userId}`);
          }
        }
      } catch (error) {
        console.error("Error storing password in User table:", error);
      }
    }
  });
  
  next();
});
// Better Auth handler - handles all /api/auth/* routes
app.use('/api/auth', toNodeHandler(auth));

// Custom API routes

// Get user details with password (for admin purposes)
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await auth.api.getSession({
      headers: req.headers as any
    });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user with account details (including password hash)
    const userDetails = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: {
          select: {
            id: true,
            providerId: true,
            password: true,
            createdAt: true,
            updatedAt: true,
          }
        },
        sessions: {
          select: {
            id: true,
            token: true,
            expiresAt: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
          }
        }
      }
    });

    if (!userDetails) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(userDetails);
  } catch (error: any) {
    console.error('Error fetching user details:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch user details'
    });
  }
});

// Get all users (for admin dashboard)
app.get('/api/users', async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as any
    });

    if (!session || session.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = await prisma.user.findMany({
      include: {
        accounts: {
          select: {
            id: true,
            providerId: true,
            password: true,
            createdAt: true,
            updatedAt: true,
          }
        },
        _count: {
          select: {
            sessions: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json(users);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch users'
    });
  }
});

// ECO list (visible to all authenticated users)
app.get('/api/eco-requests', async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as any
    });

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requests = await prisma.$queryRawUnsafe(`
      SELECT 
        id,
        "ecoCode",
        title,
        "ecoType",
        product,
        bom,
        "requestedById",
        "requestedBy",
        "effectiveDate",
        "versionUpdate",
        status,
        "createdAt",
        "updatedAt"
      FROM eco_request
      ORDER BY "createdAt" DESC
    `);
    return res.json(requests);
  } catch (error: any) {
    console.error('Error fetching ECO requests:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch ECO requests'
    });
  }
});

// Create ECO request (Admin + Engineering User only)
app.post('/api/eco-requests', async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as any
    });

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!ECO_ALLOWED_CREATE_ROLES.has(session.user.role || '')) {
      return res.status(403).json({ error: 'Only Admin or Engineering User can create ECO requests' });
    }

    const { title, ecoType, product, bom, effectiveDate, versionUpdate, status } = req.body || {};
    if (!title || !ecoType || !product || !bom) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const countRows = await prisma.$queryRawUnsafe<{ count: number }[]>(`SELECT COUNT(*)::int AS count FROM eco_request`);
    const count = countRows?.[0]?.count || 0;
    const ecoCode = `ECO-${String(count + 1).padStart(3, '0')}`;
    const id = randomUUID();
    const nextStatus = ECO_ALLOWED_STATUSES.has(status) ? String(status) : 'Draft';

    await prisma.$executeRaw`
      INSERT INTO eco_request (
        id, "ecoCode", title, "ecoType", product, bom, "requestedById", "requestedBy",
        "effectiveDate", "versionUpdate", status, "createdAt", "updatedAt"
      )
      VALUES (
        ${id}, ${ecoCode}, ${String(title)}, ${String(ecoType)}, ${String(product)}, ${String(bom)},
        ${session.user.id}, ${session.user.name || session.user.email || 'Unknown'},
        ${effectiveDate ? new Date(effectiveDate) : null}, ${Boolean(versionUpdate)}, ${nextStatus}, NOW(), NOW()
      )
    `;

    const createdRows = await prisma.$queryRaw<{ 
      id: string
      ecoCode: string
      title: string
      ecoType: string
      product: string
      bom: string
      requestedById: string
      requestedBy: string
      effectiveDate: Date | null
      versionUpdate: boolean
      status: string
      createdAt: Date
      updatedAt: Date
    }[]>`
      SELECT 
        id,
        "ecoCode",
        title,
        "ecoType",
        product,
        bom,
        "requestedById",
        "requestedBy",
        "effectiveDate",
        "versionUpdate",
        status,
        "createdAt",
        "updatedAt"
      FROM eco_request
      WHERE id = ${id}
      LIMIT 1
    `;
    const created = createdRows[0];

    return res.status(201).json(created);
  } catch (error: any) {
    console.error('Error creating ECO request:', error);
    return res.status(500).json({
      error: error.message || 'Failed to create ECO request'
    });
  }
});

// Update ECO request status (Admin + Approver only)
app.patch('/api/eco-requests/:id/status', async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as any
    });

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!ECO_ALLOWED_REVIEW_ROLES.has(session.user.role || '')) {
      return res.status(403).json({ error: 'Only Approver or Admin can update ECO status' });
    }

    const { id } = req.params;
    const { status } = req.body || {};
    if (!ECO_ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Invalid ECO status' });
    }

    const updatedRows = await prisma.$queryRaw<{ 
      id: string
      ecoCode: string
      title: string
      ecoType: string
      product: string
      bom: string
      requestedById: string
      requestedBy: string
      effectiveDate: Date | null
      versionUpdate: boolean
      status: string
      createdAt: Date
      updatedAt: Date
    }[]>`
      UPDATE eco_request
      SET status = ${String(status)}, "updatedAt" = NOW()
      WHERE id = ${id}
      RETURNING 
        id,
        "ecoCode",
        title,
        "ecoType",
        product,
        bom,
        "requestedById",
        "requestedBy",
        "effectiveDate",
        "versionUpdate",
        status,
        "createdAt",
        "updatedAt"
    `;
    const updated = updatedRows[0];
    if (!updated) {
      return res.status(404).json({ error: 'ECO request not found' });
    }

    return res.json(updated);
  } catch (error: any) {
    console.error('Error updating ECO status:', error);
    return res.status(500).json({
      error: error.message || 'Failed to update ECO status'
    });
  }
});

app.use('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    await auth.api.sendVerificationOTP({
      body: {
        email,
        type: 'forget-password',
      }
    });

    return res.json({ 
      success: true, 
      message: 'Password reset OTP sent to your email' 
    });
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({
      error: error.message || 'Failed to send OTP. Please try again.'
    });
  }
});
// ==================== PRODUCT MASTER API ====================

const PRODUCT_ALLOWED_WRITE_ROLES = new Set(['Admin', 'Engineering User']);

// Seed dummy products if table is empty
async function seedDummyProducts() {
  try {
    const countRows = await prisma.$queryRawUnsafe<{ count: number }[]>(`SELECT COUNT(*)::int AS count FROM product`);
    if ((countRows?.[0]?.count || 0) === 0) {
      const dummyProducts = [
        { name: 'Hydraulic Pump Assembly', salePrice: 1250.00, costPrice: 780.00, version: 3, archived: false },
        { name: 'CNC Spindle Motor Unit', salePrice: 3400.00, costPrice: 2100.00, version: 2, archived: false },
        { name: 'Industrial Gearbox 5-Speed', salePrice: 2750.00, costPrice: 1680.00, version: 5, archived: false },
        { name: 'Servo Control Module X200', salePrice: 890.00, costPrice: 540.00, version: 1, archived: false },
        { name: 'Pneumatic Actuator Gen-3', salePrice: 620.00, costPrice: 390.00, version: 3, archived: false },
        { name: 'Conveyor Drive Roller Kit', salePrice: 480.00, costPrice: 290.00, version: 1, archived: false },
        { name: 'Linear Ball Screw Assembly', salePrice: 1100.00, costPrice: 660.00, version: 2, archived: false },
        { name: 'Rotary Encoder Module', salePrice: 340.00, costPrice: 195.00, version: 4, archived: false },
        { name: 'Pressure Valve XR-9 Pro', salePrice: 560.00, costPrice: 320.00, version: 2, archived: false },
        { name: 'Legacy Conveyor Belt v1', salePrice: 200.00, costPrice: 130.00, version: 1, archived: true },
      ];

      for (const p of dummyProducts) {
        const { randomUUID: uuid } = await import('crypto');
        const id = uuid();
        await prisma.$executeRawUnsafe(
          `INSERT INTO product (id, name, "salePrice", "costPrice", attachments, "currentVersion", status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, '[]'::json, $5, $6, NOW(), NOW())`,
          id, p.name, p.salePrice, p.costPrice, p.version, p.archived ? 'Archived' : 'Active'
        );
      }
      console.log('✅ Seeded 10 dummy products');
    }
  } catch (error) {
    console.error('Error seeding dummy products:', error);
  }
}

// GET all products
app.get('/api/products', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const products = await prisma.$queryRawUnsafe(`
      SELECT id, name, "salePrice", "costPrice", attachments, "currentVersion", status, "createdAt", "updatedAt"
      FROM product ORDER BY "createdAt" DESC
    `);
    return res.json(products);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch products' });
  }
});

// GET single product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, name, "salePrice", "costPrice", attachments, "currentVersion", status, "createdAt", "updatedAt"
      FROM product WHERE id = $1 LIMIT 1
    `, req.params.id);
    if (!rows?.[0]) return res.status(404).json({ error: 'Product not found' });
    return res.json(rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch product' });
  }
});

// POST create product (Admin + Engineering User only)
app.post('/api/products', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (!PRODUCT_ALLOWED_WRITE_ROLES.has(session.user.role || ''))
      return res.status(403).json({ error: 'Only Admin or Engineering User can create products' });

    const { name, salePrice, costPrice, attachments } = req.body || {};
    if (!name || String(name).length > 255)
      return res.status(400).json({ error: 'Product name is required (max 255 chars)' });

    const id = randomUUID();
    const attachJson = JSON.stringify(Array.isArray(attachments) ? attachments : []);
    const sp = parseFloat(salePrice) || 0;
    const cp = parseFloat(costPrice) || 0;

    await prisma.$executeRawUnsafe(
      `INSERT INTO product (id, name, "salePrice", "costPrice", attachments, "currentVersion", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::json, 1, 'Active', NOW(), NOW())`,
      id, String(name), sp, cp, attachJson
    );

    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM product WHERE id = $1`, id);
    return res.status(201).json(rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create product' });
  }
});

// PUT update product (name, prices, attachments — version is read-only, managed by ECO)
app.put('/api/products/:id', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (!PRODUCT_ALLOWED_WRITE_ROLES.has(session.user.role || ''))
      return res.status(403).json({ error: 'Only Admin or Engineering User can update products' });

    const { id } = req.params;
    const existing = await prisma.$queryRawUnsafe<any[]>(`SELECT status FROM product WHERE id = $1`, id);
    if (!existing?.[0]) return res.status(404).json({ error: 'Product not found' });
    if (existing[0].status === 'Archived')
      return res.status(400).json({ error: 'Archived products are read-only' });

    const { name, salePrice, costPrice, attachments } = req.body || {};
    if (!name || String(name).length > 255)
      return res.status(400).json({ error: 'Product name is required (max 255 chars)' });

    const attachJson = JSON.stringify(Array.isArray(attachments) ? attachments : []);
    const sp = parseFloat(salePrice) || 0;
    const cp = parseFloat(costPrice) || 0;

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      UPDATE product
      SET name = $1, "salePrice" = $2, "costPrice" = $3, attachments = $4::json, "updatedAt" = NOW()
      WHERE id = $5
      RETURNING id, name, "salePrice", "costPrice", attachments, "currentVersion", status, "createdAt", "updatedAt"
    `, String(name), sp, cp, attachJson, id);

    return res.json(rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update product' });
  }
});

// PATCH archive / restore
app.patch('/api/products/:id/status', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (!PRODUCT_ALLOWED_WRITE_ROLES.has(session.user.role || ''))
      return res.status(403).json({ error: 'Only Admin or Engineering User can archive products' });

    const { id } = req.params;
    const { status } = req.body || {};
    if (status !== 'Active' && status !== 'Archived')
      return res.status(400).json({ error: 'Status must be Active or Archived' });

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      UPDATE product SET status = $1, "updatedAt" = NOW() WHERE id = $2
      RETURNING id, name, "salePrice", "costPrice", attachments, "currentVersion", status, "createdAt", "updatedAt"
    `, status, id);

    if (!rows?.[0]) return res.status(404).json({ error: 'Product not found' });
    return res.json(rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update product status' });
  }
});

// PATCH increment version (triggered by ECO approval)
app.patch('/api/products/:id/version', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      UPDATE product SET "currentVersion" = "currentVersion" + 1, "updatedAt" = NOW()
      WHERE id = $1 AND status = 'Active'
      RETURNING id, name, "salePrice", "costPrice", attachments, "currentVersion", status, "createdAt", "updatedAt"
    `, id);

    if (!rows?.[0]) return res.status(404).json({ error: 'Product not found or archived' });
    return res.json(rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to increment version' });
  }
});

// ==================== / PRODUCT MASTER API ====================

// Sync password hashes from Account table to User table
app.post('/api/sync-passwords', async (req, res) => {
  try {
    console.log('🔄 Syncing password hashes from Account to User table...');
    
    // Get all users and their accounts
    const users = await prisma.user.findMany({
      include: {
        accounts: {
          where: {
            password: { not: null }
          }
        }
      }
    });
    
    let syncedCount = 0;
    for (const user of users) {
      if (user.accounts.length > 0 && user.accounts[0].password) {
        const account = user.accounts[0];
        const passwordHash = account.password as string;
        
        // Only update if User.password is empty
        if (!user.password || user.password.length === 0) {
          await prisma.user.update({
            where: { id: user.id },
            data: { password: passwordHash }
          });
          syncedCount++;
          console.log(`✅ Synced password for user: ${user.email}`);
        }
      }
    }
    
    return res.json({
      success: true,
      message: `Synced passwords for ${syncedCount} users`
    });
  } catch (error: any) {
    console.error('Error syncing passwords:', error);
    return res.status(500).json({
      error: error.message || 'Failed to sync passwords'
    });
  }
});
// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📧 Auth endpoint: http://localhost:${PORT}/api/auth`);
  // Seed dummy products if needed
  seedDummyProducts();
});
