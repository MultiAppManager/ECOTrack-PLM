# Status columns (PostgreSQL enums)

## `product.status` → enum `ProductStatus`

- **`Active`** — current revision in use  
- **`Archived`** — superseded / read-only row  

This is **not** ECO approval. It is the product master lifecycle.

## `eco_request.status` → enum `EcoRequestStatus`

Exactly four values (DB + app):

- `Draft` — created, not yet reviewed  
- `Reviewed` — in review  
- `Rejected` — rejected  
- `Approved` — approved (includes “final stage complete” and version bumps)

The **`product`** table still uses **`Active` / `Archived`** only (lifecycle, not ECO approval).

## Apply migration

From `backend/`:

```bash
npx prisma migrate deploy
```

Or during development:

```bash
npx prisma migrate dev
```
