# 1. Install dependencies only when needed
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* ./
RUN apk add --no-cache git openssh
RUN yarn --frozen-lockfile

# 2. Rebuild the source code only when needed
FROM node:20-alpine AS builder
WORKDIR /app

# Next.js public env vars must exist at build time (inlined in client bundle)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ENV
ARG NEXT_PUBLIC_ETHEREUM_RPC_URL
ARG NEXT_PUBLIC_GNOSIS_RPC_URL
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ENV=$NEXT_PUBLIC_ENV
ENV NEXT_PUBLIC_ETHEREUM_RPC_URL=$NEXT_PUBLIC_ETHEREUM_RPC_URL
ENV NEXT_PUBLIC_GNOSIS_RPC_URL=$NEXT_PUBLIC_GNOSIS_RPC_URL
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

# 3. Production image, copy all the files and run next
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Writable runtime cache directory (API writes tokens-cache.json)
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# RUN npm i sharp@0.32.6 --ignore-engines
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]