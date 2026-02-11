# Account Mall

> A card-key auto-delivery platform built with Next.js 16 + Prisma 7 + PostgreSQL + better-auth + Tailwind CSS 4

## Tech Stack

| Category | Choice | Description |
|----------|--------|-------------|
| Framework | Next.js 16 (App Router) | SSR + API Routes |
| Frontend | React 19 | Server Components + Client Components |
| Language | TypeScript 5 | Full-stack type safety |
| Styling | Tailwind CSS 4 | Atomic CSS |
| UI Library | shadcn/ui (New York) | Radix UI based, customizable |
| Database | PostgreSQL 17 | Docker deployment |
| ORM | Prisma 7 | Schema-first, type-safe queries |
| Auth | better-auth | Admin-only authentication |
| Validation | Zod | TypeScript-first schema validation |
| Testing | Jest + Testing Library | Unit & integration tests |
| Icons | Lucide React | Modern icon library |

## Prerequisites

- **Node.js** >= 18
- **Docker** & **Docker Compose** (for PostgreSQL)
- **pnpm** / **npm** / **yarn**

## Getting Started

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd account-mall
npm install
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb"
POSTGRES_USER=johndoe
POSTGRES_PASSWORD=randompassword
POSTGRES_DB=mydb

# Auth (better-auth)
BETTER_AUTH_SECRET=<your-secret>
BETTER_AUTH_URL=http://localhost:3000
```

### 3. Start Database

```bash
docker compose up -d
```

### 4. Run Migrations & Seed

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed initial data (admin user)
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the storefront.  
Admin panel is available at [http://localhost:3000/admin](http://localhost:3000/admin).

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Generate Prisma client & build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema changes to database |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run db:seed` | Seed database with initial data |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

## Project Structure

```
account-mall/
├── app/                        # Next.js App Router
│   ├── admin/                  # Admin panel pages
│   │   ├── (main)/             # Admin layout group
│   │   │   ├── dashboard/      # Dashboard page
│   │   │   ├── products/       # Product management
│   │   │   ├── orders/         # Order management
│   │   │   ├── cards/          # Card-key management
│   │   │   └── layout.tsx      # Admin sidebar layout
│   │   └── login/              # Admin login page
│   ├── api/                    # API routes
│   │   └── auth/               # better-auth endpoints
│   ├── components/             # App-level components
│   ├── generated/              # Prisma generated client
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Storefront homepage
│   └── globals.css             # Global styles (Tailwind)
├── components/
│   └── ui/                     # shadcn/ui components
├── hooks/                      # Custom React hooks
├── lib/                        # Shared utilities
│   ├── auth.ts                 # Auth server config
│   ├── auth-client.ts          # Auth client config
│   ├── prisma.ts               # Prisma client instance
│   └── utils.ts                # General utilities
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── migrations/             # Migration files
│   └── seed.ts                 # Database seed script
├── types/                      # TypeScript type definitions
├── __tests__/                  # Test files
├── docker-compose.yml          # PostgreSQL service
├── components.json             # shadcn/ui configuration
└── package.json
```

## Database Schema

The application uses the following core models:

- **User / Session / Account** — Admin authentication (better-auth)
- **Product** — Store products with name, slug, price, description, status
- **Tag** — Product categorization (many-to-many with Product)
- **Card** — Card-keys bound to products (UNSOLD → RESERVED → SOLD)
- **Order** — Purchase orders with email, password hash, quantity, amount

## License

Private project — All rights reserved.
