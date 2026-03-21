-- One-time repair: ensure exactly one Active + isLatest row per productCode / bomCode.
-- Run in psql or your DB client after backing up. Fixes duplicate LATEST flags from stale ECO productId/bomId.

-- PRODUCTS: keep highest version (tie-break: newest createdAt) as Active + Latest
UPDATE product p
SET
  "isLatest" = (r.rn = 1),
  status = CASE WHEN r.rn = 1 THEN 'Active' ELSE 'Archived' END,
  "updatedAt" = NOW()
FROM (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "productCode"
      ORDER BY version DESC, "createdAt" DESC
    ) AS rn
  FROM product
) r
WHERE p.id = r.id;

-- BOMs: same by bomCode
UPDATE bill_of_materials b
SET
  "isLatest" = (r.rn = 1),
  status = CASE WHEN r.rn = 1 THEN 'Active' ELSE 'Archived' END,
  "updatedAt" = NOW()
FROM (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "bomCode"
      ORDER BY version DESC, "createdAt" DESC
    ) AS rn
  FROM bill_of_materials
) r
WHERE b.id = r.id;
