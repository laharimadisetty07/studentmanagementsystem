# ─────────────────────────────────────────────
# Stage 1: Build the React app
# ─────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency files first for better layer caching
COPY package.json ./

# Install all node modules
# --legacy-peer-deps: needed for react-scripts@5 peer dep conflicts
# ajv is pinned in package.json to fix the 'ajv/dist/compile/codegen' error
# that occurs with react-scripts@5 + Node 18
RUN npm install --legacy-peer-deps

# Copy the rest of the source code
COPY . .

# Disable ESLint errors that would fail the build in CI
# (only affects the build output, not the app functionality)
ENV DISABLE_ESLINT_PLUGIN=true
ENV CI=false

# Build the production bundle
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Serve with Nginx
# ─────────────────────────────────────────────
FROM nginx:alpine AS production

# Remove the default Nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy our custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built React app from the builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
