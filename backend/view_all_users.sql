-- Complete User Information Query
-- This shows User ID, Name, Email, Role, Password Hash, and all other details

SELECT 
  u.id as "User ID",
  u.name as "Name",
  u.email as "Email",
  u.role as "Role",
  u."emailVerified" as "Email Verified",
  u.image as "Image",
  a.password as "Password Hash",
  a."providerId" as "Provider",
  a.id as "Account ID",
  u."createdAt" as "Created At",
  u."updatedAt" as "Updated At",
  (SELECT COUNT(*) FROM session s WHERE s."userId" = u.id) as "Active Sessions"
FROM public."user" u
LEFT JOIN public."account" a ON a."userId" = u.id
ORDER BY u."createdAt" DESC;
