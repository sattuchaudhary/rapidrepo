# VPS Environment Setup for Unlimited File Uploads

## 1. Nginx Configuration
Add these settings to your nginx configuration file (usually `/etc/nginx/nginx.conf` or `/etc/nginx/sites-available/your-site`):

```nginx
# Remove client max body size limit (unlimited)
client_max_body_size 0;

# Increase timeout settings to 20 minutes
client_body_timeout 1200s;
client_header_timeout 1200s;
send_timeout 1200s;

# Increase buffer sizes
client_body_buffer_size 128k;
client_header_buffer_size 1k;
large_client_header_buffers 4 4k;

# Proxy settings for Node.js backend
location /api/ {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Increase proxy timeouts to 20 minutes
    proxy_connect_timeout 1200s;
    proxy_send_timeout 1200s;
    proxy_read_timeout 1200s;
    
    # Increase proxy buffer sizes
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;
}
```

After making changes, restart nginx:
```bash
sudo systemctl restart nginx
```

## 2. PM2 Configuration (if using PM2)
Create or update your PM2 ecosystem file:

```javascript
module.exports = {
  apps: [{
    name: 'rapidrepo-api',
    script: 'server/index.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '2G', // Increased for large file processing
    node_args: '--max-old-space-size=2048', // Increased memory
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    // Increase timeout for large file uploads to 20 minutes
    kill_timeout: 1200000,
    listen_timeout: 1200000,
    shutdown_with_message: true
  }]
}
```

## 3. System Limits
Check and increase system limits if needed:

```bash
# Check current limits
ulimit -a

# Increase file descriptor limits
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# Increase process limits
echo "* soft nproc 32768" >> /etc/security/limits.conf
echo "* hard nproc 32768" >> /etc/security/limits.conf

# Increase memory limits
echo "* soft as unlimited" >> /etc/security/limits.conf
echo "* hard as unlimited" >> /etc/security/limits.conf
```

## 4. Firewall Configuration
Make sure your firewall allows the necessary ports:

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow your Node.js port (if not using reverse proxy)
sudo ufw allow 5000
```

## 5. Environment Variables
Create or update your `.env` file on VPS:

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLIENT_URL=https://your-domain.com
```

## 6. Testing the Configuration
After implementing all changes:

1. Restart your Node.js application
2. Restart nginx
3. Test with a very large file (100MB+)
4. Check logs for any errors:
   - Node.js logs: `pm2 logs`
   - Nginx logs: `sudo tail -f /var/log/nginx/error.log`
   - Nginx access logs: `sudo tail -f /var/log/nginx/access.log`

## 7. Monitoring
Monitor your application for:
- Memory usage (should be higher for large files)
- CPU usage
- Disk space (ensure sufficient space for large files)
- Network connections

Use these commands:
```bash
# Check PM2 status
pm2 status

# Check system resources
htop

# Check disk space
df -h

# Check nginx status
sudo systemctl status nginx

# Monitor memory usage
free -h

# Check for large files in temp directories
du -sh /tmp/*
```

## 8. Important Notes
- With unlimited file size, ensure you have sufficient disk space
- Monitor memory usage as large files will consume more RAM
- Consider implementing file cleanup for temporary files
- Test with progressively larger files to find your system's practical limits
- Consider implementing chunked upload for very large files (>500MB)