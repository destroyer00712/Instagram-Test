# Qdrant Server Deployment Guide

## Qdrant Deployment Options

You have **3 options** for running Qdrant:

### Option 1: Local Docker (Easiest for Development)
**Best for**: Development, testing, small-scale production

**Requirements**:
- Docker installed on your machine
- **RAM**: Minimum 512MB, Recommended 1-2GB
- **CPU**: 1-2 cores
- **Disk**: ~100MB for Qdrant + ~50MB per 10,000 vectors

**Setup**:
```bash
# Run Qdrant in Docker
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant

# Your app will connect to: http://localhost:6333
```

**Pros**: 
- ✅ Easiest setup
- ✅ No server management
- ✅ Good for development/testing

**Cons**:
- ❌ Requires Docker
- ❌ Not suitable for high-load production
- ❌ Data stored locally (backup needed)

---

### Option 2: Self-Hosted on Your Server (Recommended for Production)
**Best for**: Production deployments, full control

**Requirements**:
- **Server**: Any Linux server (Ubuntu/Debian recommended)
- **RAM**: Minimum 2GB, Recommended 4GB+ 
- **CPU**: 2-4 cores recommended
- **Disk**: SSD recommended, ~100MB base + ~50MB per 10,000 vectors

**Setup**:
```bash
# 1. Download Qdrant binary
wget https://github.com/qdrant/qdrant/releases/download/v1.7.0/qdrant-x86_64-unknown-linux-gnu

# 2. Make executable
chmod +x qdrant-x86_64-unknown-linux-gnu

# 3. Run Qdrant
./qdrant-x86_64-unknown-linux-gnu

# Or use Docker on your server:
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

**Environment Variables**:
```bash
# In your .env file
QDRANT_URL=http://your-server-ip:6333
# Or if using domain:
QDRANT_URL=http://qdrant.yourdomain.com:6333
```

**Systemd Service (for production)**:
```bash
# Create /etc/systemd/system/qdrant.service
[Unit]
Description=Qdrant Vector Database
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/qdrant
ExecStart=/path/to/qdrant/qdrant
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable qdrant
sudo systemctl start qdrant
```

**Pros**:
- ✅ Full control over data
- ✅ No cloud costs
- ✅ Can scale as needed
- ✅ Good performance

**Cons**:
- ❌ Requires server management
- ❌ Need to handle backups
- ❌ Need to monitor uptime

---

### Option 3: Qdrant Cloud (Managed Service)
**Best for**: Production without server management

**Requirements**:
- Account at https://cloud.qdrant.io/
- Monthly subscription (free tier available)

**Setup**:
1. Sign up at https://cloud.qdrant.io/
2. Create a cluster
3. Get your cluster URL and API key

**Environment Variables**:
```bash
# In your .env file
QDRANT_URL=https://your-cluster-id.qdrant.io
QDRANT_API_KEY=your-api-key-here
```

**Pricing**:
- **Free Tier**: 1GB RAM, 1GB disk
- **Paid Plans**: Starting from ~$25/month

**Pros**:
- ✅ Managed service (no server management)
- ✅ Automatic backups
- ✅ High availability
- ✅ Easy scaling

**Cons**:
- ❌ Monthly cost
- ❌ Less control
- ❌ Internet dependency

---

## Recommended Setup Based on Your Use Case

### For Development/Testing:
```bash
# Use Docker locally
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant
```

### For Small Production (< 1000 queries/day):
```bash
# Self-hosted on small VPS (2GB RAM, 1 CPU)
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -v qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

### For Medium Production (1000-10000 queries/day):
- **Self-hosted**: 4GB RAM, 2 CPU cores, SSD
- **Or**: Qdrant Cloud Starter plan

### For Large Production (10000+ queries/day):
- **Self-hosted**: 8GB+ RAM, 4+ CPU cores, SSD
- **Or**: Qdrant Cloud Professional plan

---

## Resource Estimation

### Storage Requirements:
- **Base Qdrant**: ~100MB
- **Per Vector**: ~1.5KB (384 dimensions × 4 bytes)
- **Per Fact-Check Entry**: ~2KB (vector + metadata)

**Example**:
- 10,000 cached fact-checks = ~20MB
- 100,000 cached fact-checks = ~200MB
- 1,000,000 cached fact-checks = ~2GB

### Memory Requirements:
- **Base**: ~500MB for Qdrant
- **Per Active Query**: ~50MB (for embedding generation)
- **Recommended**: 2-4x your dataset size

**Example**:
- 10,000 vectors: 1-2GB RAM minimum
- 100,000 vectors: 4-8GB RAM recommended

---

## Quick Start Guide

### 1. For Development (Local Docker):
```bash
# Start Qdrant
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant

# Verify it's running
curl http://localhost:6333/health

# Your app will automatically connect
npm start
```

### 2. For Production (Self-Hosted):
```bash
# On your server
docker run -d \
  --name qdrant \
  --restart unless-stopped \
  -p 6333:6333 \
  -v /path/to/qdrant/data:/qdrant/storage \
  qdrant/qdrant

# Update .env
QDRANT_URL=http://your-server-ip:6333
```

### 3. For Production (Cloud):
```bash
# Sign up at cloud.qdrant.io
# Get your cluster URL and API key

# Update .env
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-api-key
```

---

## Monitoring & Maintenance

### Health Check:
```bash
curl http://localhost:6333/health
```

### Check Collection Stats:
```bash
curl http://localhost:6333/collections/fact_checks
```

### Backup (Self-Hosted):
```bash
# Backup storage directory
tar -czf qdrant-backup-$(date +%Y%m%d).tar.gz /path/to/qdrant/data
```

---

## Troubleshooting

### Port Already in Use:
```bash
# Change port
docker run -d --name qdrant -p 6334:6333 qdrant/qdrant

# Update .env
QDRANT_URL=http://localhost:6334
```

### Out of Memory:
- Increase Docker memory limit
- Or use a server with more RAM

### Connection Refused:
- Check firewall settings
- Verify Qdrant is running: `docker ps`
- Check logs: `docker logs qdrant`

---

## Recommendation

**For your Instagram fact-checking bot**, I recommend:

1. **Development**: Use Docker locally (`docker run -d --name qdrant -p 6333:6333 qdrant/qdrant`)

2. **Production**: 
   - **Small scale**: Self-hosted on a 2GB RAM VPS (~$5-10/month)
   - **Medium scale**: Self-hosted on a 4GB RAM VPS (~$15-20/month)  
   - **Large scale**: Qdrant Cloud (~$25+/month)

The system is designed to work gracefully even if Qdrant is unavailable, so you can start without it and add it later when needed!
