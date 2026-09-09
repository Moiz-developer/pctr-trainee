# Internal Training Platform

A corporate Learning Management System providing an **Admin Portal** and a **User/Trainer Portal** for internal, multi-department company training (Sales, Recruitment, Trainer, and other departments configured dynamically by administrators).

## Source of truth

All architectural decisions — data model, authorization model, API surface, folder structure, and phased delivery plan — are documented in [`SYSTEM_PLAN.md`](./SYSTEM_PLAN.md). That document governs implementation; this README only orients a new contributor.

## Monorepo structure

```text
/
├── apps/
│   ├── web/       # React + Vite + TypeScript frontend (Admin Portal + User Portal)
│   └── api/       # Node.js + Express + TypeScript backend API
├── packages/
│   └── shared/    # Shared TypeScript types and Zod schemas used by web and api
├── prisma/        # Prisma schema and migrations (Supabase PostgreSQL)
├── SYSTEM_PLAN.md
└── README.md
```

## Technology direction

- **Frontend:** React, Vite, TypeScript, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS, shadcn/ui, Lucide icons.
- **Backend:** Node.js, Express, TypeScript, Zod, Prisma.
- **Database/platform:** Supabase (PostgreSQL, Auth, Storage), with Row Level Security as a defense-in-depth authorization layer.
- **Package management:** pnpm workspaces.

See `SYSTEM_PLAN.md` for the full rationale behind each choice.

## Getting started

**Prerequisites:** Node.js 24+, Git, and [pnpm](https://pnpm.io) (`corepack enable` or `npm install -g pnpm`; this repo pins `pnpm@12.3.4` via `packageManager`).

```bash
# 1. Install dependencies for every workspace package
pnpm install

# 2. Configure environment files (placeholders only — see each file's comments)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# The defaults work as-is for local development with no database configured yet.
# DATABASE_URL/SUPABASE_* can stay empty until the Supabase integration step.

# 3. Generate the Prisma client (required before apps/api will typecheck or build —
#    apps/api/src/generated/prisma/ is gitignored, so this must be run after every
#    fresh clone/checkout, not just once)
pnpm run prisma:generate

# 4. Run the dev servers (in separate terminals)
pnpm --filter @internal-training/api dev   # http://localhost:4000
pnpm --filter @internal-training/web dev   # http://localhost:5173
```

Verify the API is up: `curl http://localhost:4000/health` and `curl http://localhost:4000/api/v1/health` should both return `{"data":{"status":"ok"}}`.

**Other useful commands** (run from the repo root):

```bash
pnpm run lint            # ESLint across web/api/shared
pnpm run typecheck       # tsc --noEmit (or -b) across web/api/shared
pnpm run build           # production build for web/api/shared
pnpm run format          # Prettier --write
pnpm run format:check    # Prettier --check (CI-friendly)
pnpm run prisma:validate # validate prisma/schema.prisma
pnpm run prisma:studio   # Prisma Studio (needs a real DATABASE_URL)
```

## Current status

**Foundation — Step 0.9: Phase 0 local foundation verified.**

Monorepo workspace, React/Vite/TypeScript frontend, Express/TypeScript backend, the shared contracts package, Prisma 7 (schema + generated-client architecture, no domain models yet), environment validation, and lint/format tooling are all in place and verified working end-to-end without a live database. Supabase Auth/Storage, RLS, and all business functionality (users, departments, courses, progress, assessments, resources, announcements, queries, policies, dashboards) are intentionally not yet implemented — see `SYSTEM_PLAN.md` for the phased plan.
