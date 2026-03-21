-- Create a comprehensive view that shows all user information in one table
-- This view combines data from user, account, and session tables

CREATE OR REPLACE VIEW public.user_complete_info AS
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
FROM public."user" u
LEFT JOIN public."account" a ON a."userId" = u.id
LEFT JOIN public."session" s ON s."userId" = u.id
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

-- Now you can simply query this view to see everything:
-- SELECT * FROM user_complete_info;
