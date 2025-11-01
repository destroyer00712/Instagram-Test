# Dockerfile for Instagram Fact-Checking Bot
# Multi-stage build for optimization

FROM node:20-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Configure npm for faster installs
RUN npm config set fetch-retries 2 && \
    npm config set fetch-retry-mintimeout 5000 && \
    npm config set fetch-retry-maxtimeout 30000 && \
    npm config set fetch-timeout 180000 && \
    npm config set progress false && \
    npm config set loglevel warn && \
    npm config set registry https://registry.npmjs.org/

# Install dependencies with optimizations
# Note: @xenova/transformers downloads large ML models (can take 10+ min)
# Since vector cache is disabled, it won't be used but still installed
RUN echo "Starting npm install..." && \
    echo "This step installs heavy packages (@xenova/transformers, puppeteer) and may take 15-20 minutes..." && \
    echo "Timestamp: $(date)" && \
    if [ -f package-lock.json ]; then \
      echo "Using package-lock.json, running npm ci..." && \
      npm ci --omit=dev --no-audit --no-fund --prefer-offline || \
      (echo "npm ci failed, falling back to npm install..." && \
       npm install --production --no-audit --no-fund --legacy-peer-deps --no-save); \
    else \
      echo "No package-lock.json, running npm install..." && \
      npm install --production --no-audit --no-fund --legacy-peer-deps --no-save; \
    fi && \
    echo "npm install completed! Timestamp: $(date)" && \
    echo "Cleaning npm cache..." && \
    npm cache clean --force && \
    echo "Dependencies installed successfully!"

# Copy application code
COPY . .

# Create temp directories for video processing
RUN mkdir -p temp/videos temp/frames temp/audio

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV TEMP_VIDEO_DIR=./temp/videos/
ENV TEMP_FRAMES_DIR=./temp/frames/
ENV TEMP_AUDIO_DIR=./temp/audio/

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the application
CMD ["node", "server.js"]
