# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM golang:1.24-alpine AS backend-builder
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o clauder .

# Stage 3: Final image
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata bash curl

# Install Node.js, Git, SSH (required for Claude Code CLI + git ops)
RUN apk add --no-cache nodejs npm git openssh-client

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Copy Go binary
COPY --from=backend-builder /app/clauder .

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./static

# Entrypoint: auto-installs persisted packages on startup
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# apk-persist: install packages + save them so they survive restarts
COPY scripts/apk-persist /usr/local/bin/apk-persist
RUN chmod +x /usr/local/bin/apk-persist

# Create workspace directory
RUN mkdir -p /home/clauder/workspace

# Claude Code instructions (entrypoint copies to workspace on first run)
COPY workspace-CLAUDE.md /app/CLAUDE.md

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
CMD ["./clauder"]
