FROM node:20-alpine AS app

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages

ARG NEXT_PUBLIC_API_BASE_URL=/api
ARG NEXT_PUBLIC_BASE_PATH=
ARG VITE_API_BASE_URL=/api
ARG VITE_H5_BASE=/app/
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_H5_BASE=${VITE_H5_BASE}

RUN npm ci
RUN npm --workspace apps/api run db:generate
RUN npm --workspace apps/admin-web run build
RUN npm --workspace apps/driver-uni run build:h5

ENV NODE_ENV=production

EXPOSE 3000 4000 5174
