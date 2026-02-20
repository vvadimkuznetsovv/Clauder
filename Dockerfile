# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM golang:1.23-alpine AS backend-builder
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o clauder .

# Stage 3: Final image
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata bash curl

# Install Node.js (required for Claude Code CLI)
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy Go binary
COPY --from=backend-builder /app/clauder .

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./static

# Create workspace directory
RUN mkdir -p /home/clauder/workspace

EXPOSE 8080

CMD ["./clauder"]
