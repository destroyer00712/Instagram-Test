# Docker Deployment Guide

## Quick Start with Docker Compose

### Prerequisites
- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- Docker Compose installed (usually comes with Docker Desktop)

### Setup Steps

1. **Create `.env` file** (copy from `.env.example` if exists):
```bash
# Required - Instagram API
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token_here
INSTAGRAM_APP_SECRET=your_instagram_app_secret_here
INSTAGRAM_VERIFY_TOKEN=your_webhook_verify_token_here

# Required - Google APIs
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_CUSTOM_SEARCH_API_KEY=your_google_custom_search_api_key_here
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_google_custom_search_engine_id_here

# Optional - Qdrant (automatically configured in docker-compose)
QDRANT_URL=http://qdrant:6333
VECTOR_CACHE_COLLECTION=fact_checks

# Optional - Server Configuration
PORT=3000
NODE_ENV=production
```

2. **Build and start all services**:
```bash
docker-compose up -d
```

This will:
- ✅ Build your Instagram bot application
- ✅ Start Qdrant vector database automatically
- ✅ Connect them together
- ✅ Set up persistent storage

3. **Check status**:
```bash
docker-compose ps
```

4. **View logs**:
```bash
# All services
docker-compose logs -f

# Just the bot
docker-compose logs -f instagram-bot

# Just Qdrant
docker-compose logs -f qdrant
```

5. **Stop services**:
```bash
docker-compose down
```

6. **Stop and remove volumes** (clean start):
```bash
docker-compose down -v
```

---

## Using Dockerfile Only (Without Docker Compose)

If you prefer to run Qdrant separately or already have it running:

### Build the Docker image:
```bash
docker build -t instagram-fact-check-bot .
```

### Run the container:
```bash
docker run -d \
  --name instagram-bot \
  -p 3000:3000 \
  --env-file .env \
  instagram-fact-check-bot
```

**Note**: If Qdrant is on a different host, update `QDRANT_URL` in your `.env` file.

---

## Docker Compose Configuration

### Services Included:

1. **instagram-bot**: Your fact-checking application
   - Port: 3000
   - Auto-restarts on failure
   - Health checks enabled

2. **qdrant**: Vector database for caching
   - Port: 6333 (REST API)
   - Port: 6334 (gRPC API)
   - Persistent storage
   - Auto-restarts on failure

### Volumes:

- `qdrant_storage`: Qdrant data persistence
- `qdrant_config`: Qdrant configuration
- `./temp`: Temporary video processing files (optional)

### Networks:

- `fact-check-network`: Internal network for service communication

---

## Environment Variables

### Required Variables:
- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_VERIFY_TOKEN`
- `GEMINI_API_KEY`
- `GOOGLE_CUSTOM_SEARCH_API_KEY`
- `GOOGLE_CUSTOM_SEARCH_ENGINE_ID`

### Optional Variables:
- `QDRANT_URL` (defaults to `http://qdrant:6333` in docker-compose)
- `QDRANT_API_KEY` (only needed for Qdrant Cloud)
- `VECTOR_CACHE_COLLECTION` (defaults to `fact_checks`)
- `PORT` (defaults to `3000`)

---

## Production Deployment

### Using Docker Compose in Production:

1. **Set production environment**:
```bash
export NODE_ENV=production
```

2. **Use specific image tags**:
```yaml
# In docker-compose.yml
services:
  instagram-bot:
    image: instagram-fact-check-bot:v1.0.0
    # ... rest of config
```

3. **Enable resource limits**:
```yaml
services:
  instagram-bot:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

4. **Set up backups**:
```bash
# Backup Qdrant data
docker run --rm -v qdrant_storage:/data -v $(pwd):/backup \
  alpine tar czf /backup/qdrant-backup-$(date +%Y%m%d).tar.gz /data
```

---

## Troubleshooting

### Container won't start:
```bash
# Check logs
docker-compose logs instagram-bot

# Check if port is already in use
lsof -i :3000
```

### Qdrant connection issues:
```bash
# Test Qdrant connectivity
curl http://localhost:6333/health

# Check Qdrant logs
docker-compose logs qdrant
```

### Out of memory:
```bash
# Increase Docker memory limit in Docker Desktop settings
# Or add memory limits in docker-compose.yml
```

### Rebuild after code changes:
```bash
# Rebuild and restart
docker-compose up -d --build
```

### View container stats:
```bash
docker stats
```

---

## Health Checks

The application includes health checks:

- **Bot health**: `http://localhost:3000/health`
- **Qdrant health**: `http://localhost:6333/health`

Check status:
```bash
curl http://localhost:3000/health
curl http://localhost:6333/health
```

---

## Useful Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart a specific service
docker-compose restart instagram-bot

# View logs
docker-compose logs -f

# Execute command in container
docker-compose exec instagram-bot sh

# Scale services (if needed)
docker-compose up -d --scale instagram-bot=2

# Pull latest images
docker-compose pull

# Clean up unused resources
docker system prune -a
```

---

## Performance Tips

1. **Use SSD storage** for Qdrant volumes (better performance)
2. **Allocate sufficient memory** (4GB+ recommended for production)
3. **Enable Docker BuildKit** for faster builds:
   ```bash
   export DOCKER_BUILDKIT=1
   ```
4. **Use .dockerignore** to reduce build context size
5. **Mount volumes** for persistent data (already configured)

---

## Security Considerations

1. **Never commit `.env` file** to version control
2. **Use secrets management** in production (Docker Secrets, AWS Secrets Manager, etc.)
3. **Limit exposed ports** (only 3000 for the bot)
4. **Use firewall rules** to restrict access
5. **Keep Docker images updated**:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

---

## Next Steps

1. ✅ Docker setup complete
2. 📝 Configure `.env` with your API keys
3. 🚀 Run `docker-compose up -d`
4. 🔍 Test your webhook endpoints
5. 📊 Monitor logs and performance
