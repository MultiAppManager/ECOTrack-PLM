import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { auth } from './lib/auth.js';
import { toNodeHandler } from 'better-auth/node';
import prisma from './lib/prisma.js';

dotenv.config();

const app = express();
const PORT = process.env.BACKEND_PORT || 5000;

const ECO_ALLOWED_CREATE_ROLES = new Set(['Admin', 'Engineering User']);
const ECO_ALLOWED_REVIEW_ROLES  = new Set(['Admin', 'Approver']);
const ECO_ALLOWED_STATUSES      = new Set(['Draft', 'Reviewed', 'Rejected', 'Approved', 'New', 'In Progress']);
const WRITE_ROLES               = new Set(['Admin', 'Engineering User']);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.BETTER_AUTH_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Log errors + capture sign-up userId
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function (data) {
    if (req.path === '/api/auth/sign-up/email' && req.method === 'POST' && res.statusCode === 200) {
      try {
        const rd = typeof data === 'string' ? JSON.parse(data) : data;
        if (rd?.user?.id) (res as any).newUserId = rd.user.id;
      } catch { /* ignore */ }
    }
    if (res.statusCode >= 400) console.error(`[${res.statusCode}] ${req.method} ${req.path}`);
    res.send = originalSend;
    return res.send(data);
  };
  next();
});

// Copy password hash to User table after sign-up
app.use((req, res, next) => {
  res.on('finish', async () => {
    if (req.path === '/api/auth/sign-up/email' && req.method === 'POST' && res.statusCode === 200) {
      try {
        const userId = (res as any).newUserId;
        if (userId) {
          const account = await prisma.account.findFirst({ where: { userId } });
          if (account?.password) {
            await prisma.user.update({ where: { id: userId }, data: { password: account.password } });
          }
        }
      } catch (e) { console.error('Error syncing password hash:', e); }
    }
  });
  next();
});

// Auth
app.use('/api/auth', toNodeHandler(auth));

// ─── User endpoints ───────────────────────────────────────────────────────────
app.get('/api/users/:userId', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      include: { accounts: { select: { id: true, providerId: true, password: true, createdAt: true, updatedAt: true } }, sessions: { select: { id: true, token: true, expiresAt: true, ipAddress: true, userAgent: true, createdAt: true } } }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/users', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session || session.user.role !== 'Admin') return res.status(403).json({ error: 'Admin access required' });
    const users = await prisma.user.findMany({ include: { accounts: { select: { id: true, providerId: true, password: true, createdAt: true, updatedAt: true } }, _count: { select: { sessions: true } } }, orderBy: { createdAt: 'desc' } });
    return res.json(users);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ─── Dashboard statistics (live data) ──────────────────────────────────────────
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    // ECO counts by status
    const ecoByStatus = await prisma.$queryRawUnsafe<{ status: string; count: string }[]>(`
      SELECT status, COUNT(*)::text AS count FROM eco_request GROUP BY status
    `);

    // ECO counts by type
    const ecoByType = await prisma.$queryRawUnsafe<{ ecoType: string; count: string }[]>(`
      SELECT "ecoType" AS "ecoType", COUNT(*)::text AS count FROM eco_request GROUP BY "ecoType"
    `);

    // ECO created per month (last 6 months)
    const ecoTrend = await prisma.$queryRawUnsafe<{ month: string; count: string }[]>(`
      SELECT TO_CHAR("createdAt", 'YYYY-MM') AS month, COUNT(*)::text AS count
      FROM eco_request
      WHERE "createdAt" >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
      ORDER BY month ASC
    `);

    // Product count (active latest only)
    const productCount = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM product WHERE "isLatest" = true AND status = 'Active'`
    );

    // BOM count (active latest only)
    const bomCount = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM bill_of_materials WHERE "isLatest" = true AND status = 'Active'`
    );

    // User count
    const userCount = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM "user"`
    );

    // Total ECO count
    const totalEco = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM eco_request`
    );

    // Pending (Draft + Reviewed)
    const pendingEco = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM eco_request WHERE status IN ('Draft', 'Reviewed')`
    );

    // Recent ECOs (last 5)
    const recentEcos = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "ecoCode", title, status, "ecoType", "createdAt"
      FROM eco_request ORDER BY "createdAt" DESC LIMIT 5
    `);

    return res.json({
      ecoByStatus: ecoByStatus.map((r) => ({ status: r.status, count: parseInt(r.count, 10) })),
      ecoByType: ecoByType.map((r) => ({ ecoType: r.ecoType, count: parseInt(r.count, 10) })),
      ecoTrend: ecoTrend.map((r) => ({ month: r.month, count: parseInt(r.count, 10) })),
      productCount: parseInt(productCount[0]?.count || '0', 10),
      bomCount: parseInt(bomCount[0]?.count || '0', 10),
      userCount: parseInt(userCount[0]?.count || '0', 10),
      totalEco: parseInt(totalEco[0]?.count || '0', 10),
      pendingEco: parseInt(pendingEco[0]?.count || '0', 10),
      recentEcos: recentEcos.map((r) => ({
        id: r.id,
        ecoCode: r.ecoCode,
        title: r.title,
        status: r.status,
        ecoType: r.ecoType,
        createdAt: r.createdAt,
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  PRODUCT MASTER
// ════════════════════════════════════════════════════════════════════════════

// GET all products — role-filtered
// Operations User: only isLatest=true AND status='Active'
// Admin / Engineering / Approver: all rows (full version history)
app.get('/api/products', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const role = session.user.role || 'Operations User';
    const isOperations = role === 'Operations User';

    const whereClause = isOperations
      ? `WHERE "isLatest" = true AND status = 'Active'`
      : '';

    const products = await prisma.$queryRawUnsafe(`
      SELECT id, "productCode", name, "salePrice", "costPrice", attachments,
             version, status, "isLatest", "versionDiff", "priceDifference", "itemDifference", "createdAt", "updatedAt"
      FROM product ${whereClause}
      ORDER BY "productCode" ASC, version DESC
    `);
    return res.json(products);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// GET only active latest products — for ECO form dropdown
app.get('/api/products/active-latest', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const products = await prisma.$queryRawUnsafe(`
      SELECT id, "productCode", name, "salePrice", "costPrice", version
      FROM product WHERE "isLatest" = true AND status = 'Active'
      ORDER BY name ASC
    `);
    return res.json(products);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// GET version history for a product family
app.get('/api/products/:productCode/versions', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, "productCode", name, "salePrice", "costPrice", attachments,
             version, status, "isLatest", "versionDiff", "priceDifference", "itemDifference", "createdAt", "updatedAt"
      FROM product WHERE "productCode" = $1
      ORDER BY version DESC
    `, req.params.productCode);
    return res.json(rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// GET single product by id
app.get('/api/products/by-id/:id', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "productCode", name, "salePrice", "costPrice", attachments,
             version, status, "isLatest", "versionDiff", "priceDifference", "itemDifference", "createdAt", "updatedAt"
      FROM product WHERE id = $1 LIMIT 1
    `, req.params.id);
    if (!rows?.[0]) return res.status(404).json({ error: 'Product not found' });
    return res.json(rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// GET all versions for the same product family given ANY version's id (one-hop)
app.get('/api/products/versions-by-id/:id', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    // Step 1: resolve productCode from given row
    const ref = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "productCode" FROM product WHERE id = $1 LIMIT 1`, req.params.id
    );
    if (!ref?.[0]) return res.status(404).json({ error: 'Product not found' });
    // Step 2: fetch ALL versions in that family
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "productCode", name, "salePrice", "costPrice", attachments,
             version, status, "isLatest", "versionDiff", "priceDifference", "itemDifference", "createdAt", "updatedAt"
      FROM product WHERE "productCode" = $1
      ORDER BY version DESC
    `, ref[0].productCode);
    return res.json(rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// POST create new product (v1, Active, isLatest=true)
app.post('/api/products', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (!WRITE_ROLES.has(session.user.role || '')) return res.status(403).json({ error: 'Only Admin or Engineering User can create products' });

    const { name, salePrice, costPrice, attachments } = req.body || {};
    if (!name || String(name).length > 255) return res.status(400).json({ error: 'Product name is required (max 255 chars)' });

    // Generate productCode
    const countRows = await prisma.$queryRawUnsafe<{ count: number }[]>(`SELECT COUNT(*)::int AS count FROM product`);
    const count = countRows?.[0]?.count || 0;
    const productCode = `PROD-${String(count + 1).padStart(3, '0')}`;

    const id = randomUUID();
    const attachJson = JSON.stringify(Array.isArray(attachments) ? attachments : []);
    const sp = parseFloat(salePrice) || 0;
    const cp = parseFloat(costPrice) || 0;

    await prisma.$executeRawUnsafe(
      `INSERT INTO product (id, "productCode", name, "salePrice", "costPrice", attachments, version, status, "isLatest", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6::json, 1, 'Active', true, NOW(), NOW())`,
      id, productCode, String(name), sp, cp, attachJson
    );

    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM product WHERE id = $1`, id);
    return res.status(201).json(rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// PUT update product (only isLatest + Active)
app.put('/api/products/:id', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (!WRITE_ROLES.has(session.user.role || '')) return res.status(403).json({ error: 'Only Admin or Engineering User can update products' });

    const existing = await prisma.$queryRawUnsafe<any[]>(`SELECT status, "isLatest" FROM product WHERE id = $1`, req.params.id);
    if (!existing?.[0]) return res.status(404).json({ error: 'Product not found' });
    if (existing[0].status === 'Archived') return res.status(400).json({ error: 'Archived products are read-only' });
    if (!existing[0].isLatest) return res.status(400).json({ error: 'Only the latest version can be edited' });

    const { name, salePrice, costPrice, attachments } = req.body || {};
    if (!name || String(name).length > 255) return res.status(400).json({ error: 'Product name required (max 255 chars)' });

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      UPDATE product SET name=$1, "salePrice"=$2, "costPrice"=$3, attachments=$4::json, "updatedAt"=NOW()
      WHERE id=$5
      RETURNING id, "productCode", name, "salePrice", "costPrice", attachments, version, status, "isLatest", "createdAt", "updatedAt"
    `, String(name), parseFloat(salePrice)||0, parseFloat(costPrice)||0, JSON.stringify(Array.isArray(attachments)?attachments:[]), req.params.id);
    return res.json(rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// PATCH archive / restore
app.patch('/api/products/:id/status', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (!WRITE_ROLES.has(session.user.role || '')) return res.status(403).json({ error: 'Insufficient permissions' });

    const { status } = req.body || {};
    if (status !== 'Active' && status !== 'Archived') return res.status(400).json({ error: 'Status must be Active or Archived' });

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      UPDATE product SET status=$1, "updatedAt"=NOW() WHERE id=$2
      RETURNING id, "productCode", name, "salePrice", "costPrice", attachments, version, status, "isLatest", "createdAt", "updatedAt"
    `, status, req.params.id);
    if (!rows?.[0]) return res.status(404).json({ error: 'Product not found' });
    return res.json(rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  BILL OF MATERIALS
// ════════════════════════════════════════════════════════════════════════════

// GET all BOMs — role-filtered
app.get('/api/boms', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const role = session.user.role || 'Operations User';
    const isOperations = role === 'Operations User';
    const whereClause = isOperations ? `WHERE "isLatest" = true AND status = 'Active'` : '';

    const boms = await prisma.$queryRawUnsafe(`
      SELECT id, "bomCode", name, "productCode", version, components, notes, status, "isLatest", "versionDiff", "createdAt", "updatedAt"
      FROM bill_of_materials ${whereClause}
      ORDER BY "bomCode" ASC, version DESC
    `);
    return res.json(boms);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// GET active latest BOMs — for ECO form dropdown
app.get('/api/boms/active-latest', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const boms = await prisma.$queryRawUnsafe(`
      SELECT id, "bomCode", name, "productCode", version
      FROM bill_of_materials WHERE "isLatest" = true AND status = 'Active'
      ORDER BY name ASC
    `);
    return res.json(boms);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// GET version history for a BOM family
app.get('/api/boms/:bomCode/versions', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, "bomCode", name, "productCode", version, components, notes, status, "isLatest", "versionDiff", "createdAt", "updatedAt"
      FROM bill_of_materials WHERE "bomCode" = $1
      ORDER BY version DESC
    `, req.params.bomCode);
    return res.json(rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// GET single BOM by id
app.get('/api/boms/by-id/:id', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "bomCode", name, "productCode", version, components, notes, status, "isLatest", "versionDiff", "createdAt", "updatedAt"
      FROM bill_of_materials WHERE id = $1 LIMIT 1
    `, req.params.id);
    if (!rows?.[0]) return res.status(404).json({ error: 'BOM not found' });
    return res.json(rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// GET all versions for the same BOM family given ANY version's id (one-hop)
app.get('/api/boms/versions-by-id/:id', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const ref = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "bomCode" FROM bill_of_materials WHERE id = $1 LIMIT 1`, req.params.id
    );
    if (!ref?.[0]) return res.status(404).json({ error: 'BOM not found' });
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "bomCode", name, "productCode", version, components, notes, status, "isLatest", "versionDiff", "createdAt", "updatedAt"
      FROM bill_of_materials WHERE "bomCode" = $1
      ORDER BY version DESC
    `, ref[0].bomCode);
    return res.json(rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// POST create new BOM
app.post('/api/boms', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (!WRITE_ROLES.has(session.user.role || '')) return res.status(403).json({ error: 'Only Admin or Engineering User can create BOMs' });

    const { name, productCode, components, notes } = req.body || {};
    if (!name || String(name).length > 255) return res.status(400).json({ error: 'BOM name required (max 255 chars)' });

    const countRows = await prisma.$queryRawUnsafe<{ count: number }[]>(`SELECT COUNT(*)::int AS count FROM bill_of_materials`);
    const count = countRows?.[0]?.count || 0;
    const bomCode = `BOM-${String(count + 1).padStart(3, '0')}`;

    const id = randomUUID();
    const compJson = JSON.stringify(Array.isArray(components) ? components : []);

    await prisma.$executeRawUnsafe(
      `INSERT INTO bill_of_materials (id, "bomCode", name, "productCode", version, components, notes, status, "isLatest", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 1, $5::json, $6, 'Active', true, NOW(), NOW())`,
      id, bomCode, String(name), productCode || '', compJson, notes || null
    );

    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM bill_of_materials WHERE id = $1`, id);
    return res.status(201).json(rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// PUT update BOM (only isLatest + Active)
app.put('/api/boms/:id', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (!WRITE_ROLES.has(session.user.role || '')) return res.status(403).json({ error: 'Insufficient permissions' });

    const existing = await prisma.$queryRawUnsafe<any[]>(`SELECT status, "isLatest" FROM bill_of_materials WHERE id = $1`, req.params.id);
    if (!existing?.[0]) return res.status(404).json({ error: 'BOM not found' });
    if (existing[0].status === 'Archived') return res.status(400).json({ error: 'Archived BOMs are read-only' });
    if (!existing[0].isLatest) return res.status(400).json({ error: 'Only the latest version can be edited' });

    const { name, productCode, components, notes } = req.body || {};
    if (!name) return res.status(400).json({ error: 'BOM name required' });

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      UPDATE bill_of_materials SET name=$1, "productCode"=$2, components=$3::json, notes=$4, "updatedAt"=NOW()
      WHERE id=$5
      RETURNING id, "bomCode", name, "productCode", version, components, notes, status, "isLatest", "createdAt", "updatedAt"
    `, String(name), productCode||'', JSON.stringify(Array.isArray(components)?components:[]), notes||null, req.params.id);
    return res.json(rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// PATCH archive / restore BOM
app.patch('/api/boms/:id/status', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (!WRITE_ROLES.has(session.user.role || '')) return res.status(403).json({ error: 'Insufficient permissions' });

    const { status } = req.body || {};
    if (status !== 'Active' && status !== 'Archived') return res.status(400).json({ error: 'Invalid status' });

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      UPDATE bill_of_materials SET status=$1, "updatedAt"=NOW() WHERE id=$2
      RETURNING id, "bomCode", name, "productCode", version, components, notes, status, "isLatest", "createdAt", "updatedAt"
    `, status, req.params.id);
    if (!rows?.[0]) return res.status(404).json({ error: 'BOM not found' });
    return res.json(rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  ECO REQUESTS
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/eco-requests', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (session.user.role === 'Operations User') return res.status(403).json({ error: 'Operations users do not have access to ECO records' });

    const requests = await prisma.$queryRawUnsafe(`
      SELECT id, "ecoCode", title, "ecoType", product, bom, "productId", "bomId",
             "requestedById", "requestedBy", "effectiveDate", "versionUpdate",
             status, changes, "stageId", "stageStatus", "createdAt", "updatedAt"
      FROM eco_request ORDER BY "createdAt" DESC
    `);
    return res.json(requests);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/eco-requests/:id', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (session.user.role === 'Operations User') return res.status(403).json({ error: 'Operations users do not have access to ECO records' });

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "ecoCode", title, "ecoType", product, bom, "productId", "bomId",
             "requestedById", "requestedBy", "effectiveDate", "versionUpdate",
             status, changes, "stageId", "stageStatus", "createdAt", "updatedAt"
      FROM eco_request WHERE id = $1
    `, req.params.id);
    if (!rows?.[0]) return res.status(404).json({ error: 'ECO not found' });
    return res.json(rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

app.post('/api/eco-requests', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (!ECO_ALLOWED_CREATE_ROLES.has(session.user.role || '')) return res.status(403).json({ error: 'Only Admin or Engineering User can create ECO requests' });

    const { title, ecoType, product, bom, productId, bomId, effectiveDate, versionUpdate, status, changes } = req.body || {};
    if (!title || !ecoType) return res.status(400).json({ error: 'Title and ECO type are required' });

    // Resolve display names from DB if IDs provided
    let productName = product || '';
    let bomName     = bom || '';

    if (productId) {
      const pRows = await prisma.$queryRawUnsafe<any[]>(`SELECT name, "productCode", version FROM product WHERE id = $1`, productId);
      if (pRows?.[0]) productName = `${pRows[0].name} (v${pRows[0].version})`;
    }
    if (bomId) {
      const bRows = await prisma.$queryRawUnsafe<any[]>(`SELECT name, "bomCode", version FROM bill_of_materials WHERE id = $1`, bomId);
      if (bRows?.[0]) bomName = `${bRows[0].name} (v${bRows[0].version})`;
    }

    if (!productName) return res.status(400).json({ error: 'Product is required' });
    if (!bomName) return res.status(400).json({ error: 'Bill of Materials is required' });

    const countRows = await prisma.$queryRawUnsafe<{ count: number }[]>(`SELECT COUNT(*)::int AS count FROM eco_request`);
    const count = countRows?.[0]?.count || 0;
    const ecoCode = `ECO-${String(count + 1).padStart(3, '0')}`;
    const id = randomUUID();
    const nextStatus = ECO_ALLOWED_STATUSES.has(status) ? String(status) : 'Draft';
    const changesJson = JSON.stringify(changes || null);

    // Get first stage to assign automatically
    const firstStageRows = await prisma.$queryRawUnsafe<any[]>(`SELECT id FROM eco_stage ORDER BY sequence ASC LIMIT 1`);
    const stageId = firstStageRows?.[0]?.id || null;

    await prisma.$executeRawUnsafe(`
      INSERT INTO eco_request (id, "ecoCode", title, "ecoType", product, bom, "productId", "bomId",
        "requestedById", "requestedBy", "effectiveDate", "versionUpdate", status, changes, "stageId", "stageStatus", "createdAt", "updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::json,$15,$16,NOW(),NOW())
    `,
      id, ecoCode, String(title), String(ecoType), productName, bomName,
      productId || null, bomId || null,
      session.user.id, session.user.name || session.user.email || 'Unknown',
      effectiveDate ? new Date(effectiveDate) : null,
      Boolean(versionUpdate), nextStatus, changesJson, stageId, 'open'
    );

    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM eco_request WHERE id = $1`, id);
    return res.status(201).json(rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// PATCH status — version bump ONLY on Approved
app.patch('/api/eco-requests/:id/status', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (!ECO_ALLOWED_REVIEW_ROLES.has(session.user.role || '')) return res.status(403).json({ error: 'Only Approver or Admin can update ECO status' });

    const { status } = req.body || {};
    if (!ECO_ALLOWED_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid status' });

    const ecoRows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM eco_request WHERE id = $1`, req.params.id);
    if (!ecoRows?.[0]) return res.status(404).json({ error: 'ECO not found' });
    const eco = ecoRows[0];

    // Version creation ONLY on Approved — Draft/Reviewed/Rejected do NOT create new versions
    if (status === 'Approved') {
      let proposedChanges: Record<string, any> = {};
      try {
        proposedChanges = typeof eco.changes === 'object' && eco.changes !== null
          ? eco.changes : (eco.changes ? JSON.parse(eco.changes) : {});
      } catch { proposedChanges = {}; }

      // ── Product: new version
      if (eco.productId) {
        const prodRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id, "productCode", name, "salePrice", "costPrice", attachments, version FROM product WHERE id = $1`, eco.productId
        );
        if (prodRows?.[0]) {
          const old = prodRows[0];
          const newId = randomUUID();
          const newVersion = Number(old.version) + 1;

          // Build new values — proposed values override old
          const pc = proposedChanges || {};
          const newName      = pc.name      !== undefined ? String(pc.name)          : old.name;
          const newSalePrice = pc.salePrice !== undefined ? parseFloat(pc.salePrice) : Number(old.salePrice);
          const newCostPrice = pc.costPrice !== undefined ? parseFloat(pc.costPrice) : Number(old.costPrice);
          const newAttach    = pc.attachments !== undefined ? pc.attachments         : (Array.isArray(old.attachments) ? old.attachments : []);

          // Compute field-level diff
          const diff: Record<string, { from: any; to: any }> = {};
          if (newName      !== old.name)               diff.name      = { from: old.name,              to: newName };
          if (newSalePrice !== Number(old.salePrice))  diff.salePrice = { from: Number(old.salePrice), to: newSalePrice };
          if (newCostPrice !== Number(old.costPrice))  diff.costPrice = { from: Number(old.costPrice), to: newCostPrice };
          if (JSON.stringify(newAttach) !== JSON.stringify(old.attachments))
                                                       diff.attachments = { from: old.attachments,     to: newAttach };

          // priceDifference: newSalePrice − oldSalePrice (positive = price up, negative = price down)
          const priceDiff = parseFloat((newSalePrice - Number(old.salePrice)).toFixed(2));

          // itemDifference: count of fields that actually changed
          const itemDiff = Object.keys(diff).length;

          // Archive old version — only the old row, not creating a new one yet
          await prisma.$executeRawUnsafe(
            `UPDATE product SET "isLatest"=false, status='Archived', "updatedAt"=NOW() WHERE id=$1`, old.id
          );

          // Insert new version — ONLY created here on approval
          await prisma.$executeRawUnsafe(
            `INSERT INTO product
               (id,"productCode",name,"salePrice","costPrice",attachments,version,status,"isLatest",
                "versionDiff","priceDifference","itemDifference","createdAt","updatedAt")
             VALUES ($1,$2,$3,$4,$5,$6::json,$7,'Active',true,$8::json,$9,$10,NOW(),NOW())`,
            newId, old.productCode, newName, newSalePrice, newCostPrice,
            JSON.stringify(newAttach), newVersion,
            itemDiff > 0 ? JSON.stringify(diff) : null,
            itemDiff > 0 ? priceDiff : null,      // null if nothing changed
            itemDiff > 0 ? itemDiff : null
          );
          console.log(`✅ Product ${old.productCode} → v${newVersion} | priceDiff=${priceDiff} | itemDiff=${itemDiff}`);
        }
      }

      // ── BOM version bump ───────────────────────────────────────────────────
      if (eco.bomId) {
        const bomRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id,"bomCode",name,"productCode",version,components,notes FROM bill_of_materials WHERE id = $1`, eco.bomId
        );
        if (bomRows?.[0]) {
          const old = bomRows[0];
          const newId  = randomUUID();
          const newVersion = Number(old.version) + 1;

          const pc = proposedChanges || {};
          const newComponents = pc.components !== undefined ? pc.components : (Array.isArray(old.components) ? old.components : []);
          const newNotes      = pc.notes      !== undefined ? pc.notes      : old.notes;
          const newBomName    = pc.bomName    !== undefined ? pc.bomName    : old.name;

          // Compute BOM diff
          const diff: Record<string, { from: any; to: any }> = {};
          if (JSON.stringify(newComponents) !== JSON.stringify(old.components))
            diff.components = { from: Array.isArray(old.components) ? old.components : [], to: newComponents };
          if (newNotes   !== old.notes)    diff.notes   = { from: old.notes,   to: newNotes };
          if (newBomName !== old.name)     diff.bomName = { from: old.name,     to: newBomName };

          await prisma.$executeRawUnsafe(
            `UPDATE bill_of_materials SET "isLatest"=false, status='Archived', "updatedAt"=NOW() WHERE id=$1`, old.id
          );
          await prisma.$executeRawUnsafe(
            `INSERT INTO bill_of_materials (id,"bomCode",name,"productCode",version,components,notes,status,"isLatest","versionDiff","createdAt","updatedAt")
             VALUES ($1,$2,$3,$4,$5,$6::json,$7,'Active',true,$8::json,NOW(),NOW())`,
            newId, old.bomCode, newBomName, old.productCode, newVersion,
            JSON.stringify(newComponents), newNotes || null,
            Object.keys(diff).length > 0 ? JSON.stringify(diff) : null
          );
          console.log(`✅ BOM ${old.bomCode} → v${newVersion}`, diff);
        }
      }
    }

    // Update ECO status
    const updated = await prisma.$queryRawUnsafe<any[]>(`
      UPDATE eco_request SET status=$1, "updatedAt"=NOW() WHERE id=$2
      RETURNING *
    `, String(status), req.params.id);

    return res.json(updated[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  ECO STAGE ADVANCE  (move ECO to next stage or mark Applied)
// ════════════════════════════════════════════════════════════════════════════
app.patch('/api/eco-requests/:id/advance-stage', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (!ECO_ALLOWED_REVIEW_ROLES.has(session.user.role || '')) return res.status(403).json({ error: 'Only Approver or Admin can advance ECO stages' });

    const ecoRows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM eco_request WHERE id = $1`, req.params.id);
    if (!ecoRows?.[0]) return res.status(404).json({ error: 'ECO not found' });
    const eco = ecoRows[0];

    // Get all stages ordered by sequence
    const allStages = await prisma.$queryRawUnsafe<any[]>(`
      SELECT s.*, json_agg(a.*) FILTER (WHERE a.id IS NOT NULL) AS approvals
      FROM eco_stage s
      LEFT JOIN eco_stage_approval a ON a."stageId" = s.id
      GROUP BY s.id ORDER BY s.sequence ASC
    `);

    if (!allStages || allStages.length === 0)
      return res.status(400).json({ error: 'No stages configured. Please configure ECO Stages first.' });

    // Find current stage index
    let currentIdx = -1;
    if (eco.stageId) {
      currentIdx = allStages.findIndex((s: any) => s.id === eco.stageId);
    }

    const nextIdx = currentIdx + 1;
    if (nextIdx >= allStages.length)
      return res.status(400).json({ error: 'ECO is already at the final stage.' });

    // The requirement check for "Approve" vs "Validate" should be based on the CURRENT stage's status?
    // User says: "Approving an ECO: Moves it to the next stage."
    // And "If approval is mandatory: Approval button is shown".
    // This implies that for the current stage, we see a button to move to next.
    // If current stage has required approvals, we call it "Approve".
    
    // BUT, the advance-stage endpoint is what DOES the advancement.
    // We should probably check if the current user HAS authority or if required signatures are present
    // (For this simple version, clicking the button IS the approval/validation).

    const nextStage = allStages[nextIdx];
    const isFinalStage = nextStage.isFinal;

    // Advance to next stage
    const newStatus = isFinalStage ? 'Applied' : eco.status;
    const newStageStatus = isFinalStage ? 'applied' : (requiredApprovals.length > 0 ? 'open' : 'open');

    const updated = await prisma.$queryRawUnsafe<any[]>(`
      UPDATE eco_request
      SET "stageId"=$1, "stageStatus"=$2, status=$3, "updatedAt"=NOW()
      WHERE id=$4
      RETURNING *
    `, nextStage.id, newStageStatus, newStatus, req.params.id);

    // If final stage, also run the version bump (reuse existing approval logic)
    if (isFinalStage && eco.status !== 'Applied') {
      // Trigger version creation by calling the approve path
      let proposedChanges: Record<string, any> = {};
      try {
        proposedChanges = typeof eco.changes === 'object' && eco.changes !== null
          ? eco.changes : (eco.changes ? JSON.parse(eco.changes) : {});
      } catch { proposedChanges = {}; }

      if (eco.productId) {
        const prodRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id,"productCode",name,"salePrice","costPrice",attachments,version FROM product WHERE id=$1`, eco.productId
        );
        if (prodRows?.[0]) {
          const old = prodRows[0];
          const newId = randomUUID();
          const newVersion = Number(old.version) + 1;
          const pc = proposedChanges || {};
          const newName      = pc.name      !== undefined ? String(pc.name)          : old.name;
          const newSalePrice = pc.salePrice !== undefined ? parseFloat(pc.salePrice) : Number(old.salePrice);
          const newCostPrice = pc.costPrice !== undefined ? parseFloat(pc.costPrice) : Number(old.costPrice);
          const newAttach    = pc.attachments !== undefined ? pc.attachments : (Array.isArray(old.attachments) ? old.attachments : []);
          const diff: Record<string, {from:any;to:any}> = {};
          if (newName !== old.name)                diff.name      = { from: old.name, to: newName };
          if (newSalePrice !== Number(old.salePrice)) diff.salePrice = { from: Number(old.salePrice), to: newSalePrice };
          if (newCostPrice !== Number(old.costPrice)) diff.costPrice = { from: Number(old.costPrice), to: newCostPrice };
          const priceDiff = parseFloat((newSalePrice - Number(old.salePrice)).toFixed(2));
          const itemDiff  = Object.keys(diff).length;
          await prisma.$executeRawUnsafe(`UPDATE product SET "isLatest"=false, status='Archived', "updatedAt"=NOW() WHERE id=$1`, old.id);
          await prisma.$executeRawUnsafe(
            `INSERT INTO product (id,"productCode",name,"salePrice","costPrice",attachments,version,status,"isLatest","versionDiff","priceDifference","itemDifference","createdAt","updatedAt")
             VALUES ($1,$2,$3,$4,$5,$6::json,$7,'Active',true,$8::json,$9,$10,NOW(),NOW())`,
            newId, old.productCode, newName, newSalePrice, newCostPrice,
            JSON.stringify(newAttach), newVersion,
            itemDiff > 0 ? JSON.stringify(diff) : null,
            itemDiff > 0 ? priceDiff : null,
            itemDiff > 0 ? itemDiff : null
          );
        }
      }

      if (eco.bomId) {
        const bomRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id,"bomCode",name,"productCode",version,components,notes FROM bill_of_materials WHERE id=$1`, eco.bomId
        );
        if (bomRows?.[0]) {
          const old = bomRows[0];
          const newId = randomUUID();
          const newVersion = Number(old.version) + 1;
          const pc = proposedChanges || {};
          const newComponents = pc.components !== undefined ? pc.components : (Array.isArray(old.components) ? old.components : []);
          const newNotes      = pc.notes !== undefined ? pc.notes : old.notes;
          const newBomName    = pc.bomName !== undefined ? pc.bomName : old.name;
          const diff: Record<string,any> = {};
          if (JSON.stringify(newComponents) !== JSON.stringify(old.components)) diff.components = { from: old.components, to: newComponents };
          if (newNotes !== old.notes) diff.notes = { from: old.notes, to: newNotes };
          await prisma.$executeRawUnsafe(`UPDATE bill_of_materials SET "isLatest"=false,status='Archived',"updatedAt"=NOW() WHERE id=$1`, old.id);
          await prisma.$executeRawUnsafe(
            `INSERT INTO bill_of_materials (id,"bomCode",name,"productCode",version,components,notes,status,"isLatest","versionDiff","createdAt","updatedAt")
             VALUES ($1,$2,$3,$4,$5,$6::json,$7,'Active',true,$8::json,NOW(),NOW())`,
            newId, old.bomCode, newBomName, old.productCode, newVersion,
            JSON.stringify(newComponents), newNotes || null,
            Object.keys(diff).length > 0 ? JSON.stringify(diff) : null
          );
        }
      }
    }

    return res.json({ ...updated[0], nextStage, isFinalStage });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  ECO STAGES CRUD  (Settings → ECO Stages)
// ════════════════════════════════════════════════════════════════════════════

// GET all stages with their approvals
app.get('/api/eco-stages', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (session.user.role === 'Operations User') return res.status(403).json({ error: 'Access denied' });
    const stages = await prisma.$queryRawUnsafe<any[]>(`
      SELECT s.*, COALESCE(json_agg(a.* ORDER BY a."createdAt" ASC) FILTER (WHERE a.id IS NOT NULL), '[]') AS approvals
      FROM eco_stage s
      LEFT JOIN eco_stage_approval a ON a."stageId" = s.id
      GROUP BY s.id ORDER BY s.sequence ASC
    `);
    return res.json(stages);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// GET single stage
app.get('/api/eco-stages/:id', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT s.*, COALESCE(json_agg(a.* ORDER BY a."createdAt" ASC) FILTER (WHERE a.id IS NOT NULL), '[]') AS approvals
      FROM eco_stage s
      LEFT JOIN eco_stage_approval a ON a."stageId" = s.id
      WHERE s.id = $1
      GROUP BY s.id
    `, req.params.id);
    if (!rows?.[0]) return res.status(404).json({ error: 'Stage not found' });
    return res.json(rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// POST create stage
app.post('/api/eco-stages', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session || session.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
    const { name, sequence, isFinal } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO eco_stage (id, name, sequence, "isFinal", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW())`,
      id, String(name), Number(sequence) || 0, Boolean(isFinal)
    );
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT s.*, '[]'::json AS approvals FROM eco_stage s WHERE s.id=$1`, id);
    return res.status(201).json(rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// PUT update stage
app.put('/api/eco-stages/:id', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session || session.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
    const { name, sequence, isFinal } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name is required' });
    await prisma.$executeRawUnsafe(
      `UPDATE eco_stage SET name=$1, sequence=$2, "isFinal"=$3, "updatedAt"=NOW() WHERE id=$4`,
      String(name), Number(sequence) || 0, Boolean(isFinal), req.params.id
    );
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT s.*, COALESCE(json_agg(a.* ORDER BY a."createdAt" ASC) FILTER (WHERE a.id IS NOT NULL), '[]') AS approvals
      FROM eco_stage s LEFT JOIN eco_stage_approval a ON a."stageId"=s.id
      WHERE s.id=$1 GROUP BY s.id`, req.params.id);
    return res.json(rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// DELETE stage
app.delete('/api/eco-stages/:id', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session || session.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
    await prisma.$executeRawUnsafe(`DELETE FROM eco_stage WHERE id=$1`, req.params.id);
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// POST add approval to stage
app.post('/api/eco-stages/:id/approvals', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session || session.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
    const { userId, userName, category } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const cat = category === 'Optional' ? 'Optional' : 'Required';
    // Resolve user name if not provided
    let resolvedName = userName || '';
    if (!resolvedName) {
      const uRows = await prisma.$queryRawUnsafe<any[]>(`SELECT name FROM "user" WHERE id=$1`, userId);
      resolvedName = uRows?.[0]?.name || userId;
    }
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO eco_stage_approval (id, "stageId", "userId", "userName", category, "createdAt") VALUES ($1,$2,$3,$4,$5,NOW())`,
      id, req.params.id, userId, resolvedName, cat
    );
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM eco_stage_approval WHERE id=$1`, id);
    return res.status(201).json(rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// DELETE approval from stage
app.delete('/api/eco-stages/:stageId/approvals/:approvalId', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session || session.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
    await prisma.$executeRawUnsafe(
      `DELETE FROM eco_stage_approval WHERE id=$1 AND "stageId"=$2`,
      req.params.approvalId, req.params.stageId
    );
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// GET all users (for approval user picker — any logged-in user)
app.get('/api/users-list', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const users = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, email, role FROM "user" ORDER BY name ASC`
    );
    return res.json(users);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});



// ─── OTP / Sync password endpoints ───────────────────────────────────────────
app.use('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    await auth.api.sendVerificationOTP({ body: { email, type: 'forget-password' } });
    return res.json({ success: true, message: 'OTP sent' });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

app.post('/api/sync-passwords', async (req, res) => {
  try {
    const users = await prisma.user.findMany({ include: { accounts: { where: { password: { not: null } } } } });
    let count = 0;
    for (const user of users) {
      if (user.accounts?.[0]?.password && !user.password) {
        await prisma.user.update({ where: { id: user.id }, data: { password: user.accounts[0].password as string } });
        count++;
      }
    }
    return res.json({ success: true, message: `Synced ${count} users` });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ─── Seed function ────────────────────────────────────────────────────────────
async function seedDemoData() {
  // ── Products ──────────────────────────────────────────────────────────────
  const prodCount = await prisma.$queryRawUnsafe<{count:number}[]>(`SELECT COUNT(*)::int AS count FROM product`);
  if ((prodCount?.[0]?.count || 0) === 0) {
    const products = [
      { name: 'Hydraulic Pump Assembly',    sp: 1250, cp: 780,  v: 3 },
      { name: 'CNC Spindle Motor Unit',     sp: 3400, cp: 2100, v: 2 },
      { name: 'Industrial Gearbox 5-Speed', sp: 2750, cp: 1680, v: 5 },
      { name: 'Servo Control Module X200',  sp: 890,  cp: 540,  v: 1 },
      { name: 'Pneumatic Actuator Gen-3',   sp: 620,  cp: 390,  v: 3 },
      { name: 'Conveyor Drive Roller Kit',  sp: 480,  cp: 290,  v: 1 },
      { name: 'Linear Ball Screw Assembly', sp: 1100, cp: 660,  v: 2 },
      { name: 'Rotary Encoder Module',      sp: 340,  cp: 195,  v: 4 },
      { name: 'Pressure Valve XR-9 Pro',    sp: 560,  cp: 320,  v: 2 },
      { name: 'Legacy Conveyor Belt',       sp: 200,  cp: 130,  v: 1, archived: true },
    ];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const code = `PROD-${String(i + 1).padStart(3, '0')}`;
      if (p.v > 1 && !p.archived) {
        for (let ver = 1; ver < p.v; ver++) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO product (id,"productCode",name,"salePrice","costPrice",attachments,version,status,"isLatest","createdAt","updatedAt")
             VALUES ($1,$2,$3,$4,$5,'[]'::json,$6,'Archived',false,NOW() - INTERVAL '${(p.v-ver)*30} days',NOW())`,
            randomUUID(), code, p.name, p.sp * 0.9, p.cp * 0.9, ver
          );
        }
      }
      await prisma.$executeRawUnsafe(
        `INSERT INTO product (id,"productCode",name,"salePrice","costPrice",attachments,version,status,"isLatest","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,'[]'::json,$6,$7,true,NOW(),NOW())`,
        randomUUID(), code, p.name, p.sp, p.cp, p.v, p.archived ? 'Archived' : 'Active'
      );
    }
    console.log('✅ Seeded 10 products (with version history)');
  }

  // ── BOMs — seeded independently of products ────────────────────────────────
  const bomCount = await prisma.$queryRawUnsafe<{count:number}[]>(`SELECT COUNT(*)::int AS count FROM bill_of_materials`);
  if ((bomCount?.[0]?.count || 0) === 0) {
    const boms = [
      { pc: 'PROD-001', name: 'Pump Housing Kit',          components: [{name:'Steel Ring',qty:6,unit:'pcs'},{name:'O-Ring Seal',qty:12,unit:'pcs'},{name:'Pump Shaft',qty:1,unit:'pcs'},{name:'Impeller Blade',qty:4,unit:'pcs'}] },
      { pc: 'PROD-002', name: 'Motor Rotor-Stator Set',    components: [{name:'Copper Wind Wire',qty:2.5,unit:'m'},{name:'Rotor Core',qty:1,unit:'pcs'},{name:'Insulation Film',qty:0.5,unit:'m²'},{name:'Bearing 6204',qty:2,unit:'pcs'}] },
      { pc: 'PROD-003', name: 'Gear Train Assembly',       components: [{name:'Helical Gear 48T',qty:2,unit:'pcs'},{name:'Pinion Gear 16T',qty:2,unit:'pcs'},{name:'Grease EP2',qty:75,unit:'ml'},{name:'Gear Housing',qty:1,unit:'pcs'}] },
      { pc: 'PROD-004', name: 'Servo PCB Assembly',        components: [{name:'Capacitor 100µF',qty:14,unit:'pcs'},{name:'DSP Chip TMS320',qty:1,unit:'pcs'},{name:'MOSFET IRF540N',qty:4,unit:'pcs'},{name:'PCB FR4 2-Layer',qty:1,unit:'pcs'}] },
      { pc: 'PROD-005', name: 'Actuator Linkage Set',      components: [{name:'Pneumatic Cylinder',qty:2,unit:'pcs'},{name:'Seal Kit',qty:1,unit:'set'},{name:'Mounting Bracket',qty:2,unit:'pcs'},{name:'Clevis Pin M10',qty:4,unit:'pcs'}] },
      { pc: 'PROD-006', name: 'Conveyor Roller Kit',       components: [{name:'Drive Roller Ø80',qty:4,unit:'pcs'},{name:'PVC Belt 400mm',qty:2,unit:'m'},{name:'Bearing Block UCP',qty:8,unit:'pcs'},{name:'Drive Chain 08B',qty:0.5,unit:'m'}] },
      { pc: 'PROD-007', name: 'Linear Ball Screw Kit',     components: [{name:'Ball Screw SFU1610',qty:1,unit:'pcs'},{name:'Ball Nut Flange',qty:1,unit:'pcs'},{name:'End Support BK12',qty:1,unit:'pcs'},{name:'End Support BF12',qty:1,unit:'pcs'}] },
      { pc: 'PROD-008', name: 'Encoder Mounting Pack',     components: [{name:'Encoder Disc 1000ppr',qty:1,unit:'pcs'},{name:'Flexible Coupling',qty:1,unit:'pcs'},{name:'Mounting Bracket SS',qty:1,unit:'pcs'}] },
      { pc: 'PROD-009', name: 'Valve Assembly Kit',        components: [{name:'Valve Body Brass',qty:1,unit:'pcs'},{name:'Compression Spring',qty:3,unit:'pcs'},{name:'Seal Washer PTFE',qty:4,unit:'pcs'},{name:'Lock Nut M18',qty:2,unit:'pcs'}] },
      { pc: 'PROD-010', name: 'Conveyor Belt Legacy Kit',  components: [{name:'Rubber Belt 300mm',qty:3,unit:'m'},{name:'Lace Clip',qty:20,unit:'pcs'}] },
    ];

    for (let i = 0; i < boms.length; i++) {
      const b = boms[i];
      const bomCode = `BOM-${String(i + 1).padStart(3, '0')}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO bill_of_materials (id,"bomCode",name,"productCode",version,components,notes,status,"isLatest","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,1,$5::json,null,'Active',true,NOW(),NOW())`,
        randomUUID(), bomCode, b.name, b.pc, JSON.stringify(b.components)
      );
    }
    console.log('✅ Seeded 10 BOMs (matched to products)');
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  seedDemoData();
});
