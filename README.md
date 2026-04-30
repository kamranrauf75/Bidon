# PayNest Real-Time Bidding System

Minimal full-stack simulation of a live auction platform built for the PayNest interview task.

## Live Deployment

- Frontend: `TO_BE_ADDED_AFTER_DEPLOYMENT`
- Backend API: `TO_BE_ADDED_AFTER_DEPLOYMENT`
- GitHub repository: `TO_BE_ADDED_AFTER_PUSH`

## Stack

- Backend: NestJS + Prisma + PostgreSQL + Socket.IO
- Frontend: React (Vite + TypeScript) + Socket.IO client
- DevOps: Docker + Docker Compose + GitHub Actions + Render deploy hooks

## Features Implemented

- Create auction items with:
  - name
  - description
  - starting price
  - auction duration
- Hardcoded 100 users in database (seeded, no CRUD)
- Place bids with validation:
  - user must exist
  - bid must be strictly higher than current highest bid (or starting price)
  - bids after auction expiration are rejected
- Real-time highest bid updates over WebSockets
- Dashboard with:
  - create auction form
  - list of all auctions
  - current highest bid
  - remaining time
- Auction detail page with live updates and bid form
- Meaningful error messages for invalid bids/actions

## Project Structure

```text
.
├── backend/
│   ├── prisma/
│   └── src/
├── frontend/
├── docker-compose.yml
└── .github/workflows/ci-cd.yml
```

## Local Setup (without Docker)

### Prerequisites

- Node.js 20+ recommended
- npm
- PostgreSQL

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
```

Backend runs on `http://localhost:3000`.

### 2) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Docker Instructions

### Build and run everything

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Postgres: `localhost:5432`

The backend container runs:

- `prisma migrate deploy`
- `prisma seed`
- starts Nest API

### Stop

```bash
docker compose down
```

## API Endpoints

- `POST /auctions`
  - body: `{ "name", "description", "startingPrice", "durationSeconds" }`
- `GET /auctions`
- `GET /auctions/:id`
- `POST /bids`
  - body: `{ "itemId", "userId", "amount" }`

## Real-Time Events

- Client emits: `auction.subscribe` with `{ itemId }`
- Server emits: `bid.updated` with:
  - `itemId`
  - `amount`
  - `userId`
  - `createdAt`

## Testing

### Backend

```bash
cd backend
npm test -- --runInBand
```

Included coverage for:

- lower/equal bid rejection
- expired auction rejection
- simulated concurrent bidding acceptance behavior

### Frontend

```bash
cd frontend
npm test
```

Included coverage for:

- rendering key auction fields on dashboard
- showing user-facing error message for invalid create action

## Development Approach and Decisions

- Kept architecture intentionally simple:
  - single API service
  - single frontend app
  - one relational DB
- Used Prisma + PostgreSQL for strong transactional behavior on bids.
- Used Socket.IO because it is straightforward to integrate with NestJS and React for real-time updates.
- Calculated auction expiration from `endsAt` and also update stale active rows to `ENDED` during reads/writes for graceful status handling.

## Robustness and Scalability Notes

- Multiple auctions are naturally supported by separate `AuctionItem` rows and auction-specific websocket rooms.
- Bid placement is wrapped in a DB transaction.
- Auction row is locked (`FOR UPDATE`) before validating and writing bids to avoid race conditions from simultaneous bid requests.
- Only the request that passes validation inside the lock can persist its bid.

## Race Condition Handling

Potential issue: two users submit bids nearly simultaneously.

Mitigation used:

1. Start transaction
2. Lock target auction row
3. Read highest bid within transaction
4. Validate new amount
5. Insert bid
6. Commit

This prevents dual-accept for conflicting bids and preserves consistency.

## CI/CD Pipeline

Workflow file: `.github/workflows/ci-cd.yml`

Pipeline behavior:

- On pull request and pushes:
  - install deps (backend and frontend)
  - generate Prisma client
  - run backend tests
  - run frontend tests
  - build backend/frontend
  - build backend/frontend Docker images
- On push to `main`:
  - trigger Render deploy hooks for backend and frontend

Required GitHub Secrets:

- `RENDER_BACKEND_DEPLOY_HOOK_URL`
- `RENDER_FRONTEND_DEPLOY_HOOK_URL`

## Render Deployment Steps

1. Create PostgreSQL service on Render.
2. Create backend web service:
   - root: `backend`
   - build command: `npm install && npm run build`
   - start command: `npx prisma migrate deploy && npm run prisma:seed && npm run start:prod`
3. Create frontend static service:
   - root: `frontend`
   - build command: `npm install && npm run build`
   - publish directory: `dist`
4. Set env vars:
   - backend `DATABASE_URL`, `PORT`
   - frontend `VITE_API_URL`, `VITE_WS_URL`
5. Add deploy hooks from Render to GitHub secrets.
6. Push to `main` to trigger automatic deployment.

## Notes

- 100 users are seeded with stable IDs `1..100`.
- This solution intentionally avoids extra infrastructure (queues/caches/microservices) to stay interview-friendly and easy to explain.