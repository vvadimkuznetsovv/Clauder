FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata bash curl

# Install Node.js, Git, SSH (required for Claude Code CLI + git ops)
RUN apk add --no-cache nodejs npm git openssh-client

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Copy pre-built Go binary
COPY backend/clauder .

# Copy pre-built frontend
COPY frontend/dist ./static

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
