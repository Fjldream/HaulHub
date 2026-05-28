FROM node:20-alpine AS app

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages

ARG NEXT_PUBLIC_API_BASE_URL=/api
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

RUN npm ci
RUN npm --workspace apps/api run db:generate
RUN npm --workspace apps/admin-web run build

ENV NODE_ENV=production

EXPOSE 3000 4000
