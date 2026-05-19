# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (needed for TypeScript compilation)
RUN npm ci && \
    npm cache clean --force

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install security updates, git (clone/push repos), curl (fetch sealed-secrets cert)
RUN apk --no-cache upgrade && apk --no-cache add git curl ca-certificates

# Install kubeseal CLI for sealing secrets via /api/reseal-secret endpoint.
# Version pinned to match cluster sealed-secrets app version (v0.36.6).
ARG KUBESEAL_VERSION=0.36.6
RUN curl -fsSL "https://github.com/bitnami-labs/sealed-secrets/releases/download/v${KUBESEAL_VERSION}/kubeseal-${KUBESEAL_VERSION}-linux-amd64.tar.gz" \
      | tar -xz -C /usr/local/bin kubeseal && \
    chmod +x /usr/local/bin/kubeseal

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Environment
ENV NODE_ENV=production \
    PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Start application
CMD ["node", "dist/index.js"]
