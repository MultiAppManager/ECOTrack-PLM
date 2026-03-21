CREATE OR REPLACE VIEW user_complete_info AS
SELECT 
  u.id as user_id,
  u.name as user_name,
  u.email,
  u.role,
  u."emailVerified" as email_verified,
  u.image,
  a.password as password_hash,
  a."providerId" as auth_provider,
  a."accountId" as account_id,
  u."createdAt" as created_at,
  u."updatedAt" as updated_at,
  COUNT(DISTINCT s.id) as active_sessions
FROM "user" u
LEFT JOIN "account" a ON a."userId" = u.id
LEFT JOIN "session" s ON s."userId" = u.id
GROUP BY 
  u.id, 
  u.name, 
  u.email, 
  u.role, 
  u."emailVerified", 
  u.image, 
  a.password, 
  a."providerId", 
  a."accountId",
  u."createdAt",
  u."updatedAt"
ORDER BY u."createdAt" DESC;
