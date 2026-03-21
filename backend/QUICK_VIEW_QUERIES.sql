-- ==============================================================
-- COMPREHENSIVE USER INFORMATION VIEW
-- ==============================================================
-- This query shows EVERYTHING about users in one table
-- Use this in pgAdmin Query Tool for quick access
-- ==============================================================

-- Option 1: View all user information (recommended)
SELECT * FROM user_complete_info;

-- Option 2: Manual join query (if view doesn't work)
SELECT 
  u.id as "User ID",
  u.name as "Name",
  u.email as "Email",
  u.role as "Role",
  u."emailVerified" as "Verified",
  u.image as "Image",
  a.password as "Password Hash",
  a."providerId" as "Provider",
  a.id as "Account ID",
  u."createdAt" as "Created",
  u."updatedAt" as "Updated",
  COUNT(s.id) as "Sessions"
FROM "user" u
LEFT JOIN "account" a ON a."userId" = u.id
LEFT JOIN "session" s ON s."userId" = u.id
GROUP BY u.id, u.name, u.email, u.role, u."emailVerified", u.image, 
         a.password, a."providerId", a.id, u."createdAt", u."updatedAt"
ORDER BY u."createdAt" DESC;

-- Option 3: Simple view of user + password only
SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  a.password
FROM "user" u
LEFT JOIN "account" a ON a."userId" = u.id;
