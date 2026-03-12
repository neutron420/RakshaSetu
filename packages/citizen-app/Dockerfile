# Build stage for Expo web app
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci

# Builder stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules node_modules
COPY . .

# Set environment variables for build
ENV NODE_ENV=production
ENV EXPO_PUBLIC_API_URL=http://user-be:5001

# Build the web version
RUN npx expo export --platform web

# Production stage - serve with nginx
FROM nginx:alpine AS runner

# Copy built web app to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config for SPA
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
