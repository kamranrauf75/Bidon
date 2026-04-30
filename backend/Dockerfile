FROM node:20-alpine AS base
WORKDIR /app
ENV DATABASE_URL=postgresql://paynest:paynest@postgres:5432/paynest?schema=public

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run prisma:generate
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && npm run prisma:seed && npm run start:prod"]
