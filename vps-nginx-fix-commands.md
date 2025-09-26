# VPS पर तुरंत करने वाले Commands

## 1. Nginx Configuration Check और Fix

```bash
# Check current nginx configuration
sudo nginx -t

# Edit nginx configuration
sudo nano /etc/nginx/nginx.conf
```

**Add या Update करें:**
```nginx
# HTTP block में add करें
http {
    # Remove file size limit
    client_max_body_size 0;
    
    # Increase timeouts to 20 minutes
    client_body_timeout 1200s;
    client_header_timeout 1200s;
    send_timeout 1200s;
    
    # Increase buffer sizes
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 4k;
    
    # Your existing server block
    server {
        # Your existing configuration
        
        # Add these location blocks
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
    }
}
```

## 2. Nginx Restart

```bash
# Test configuration
sudo nginx -t

# If test passes, restart nginx
sudo systemctl restart nginx

# Check nginx status
sudo systemctl status nginx
```

## 3. Node.js Application Restart

```bash
# If using PM2
pm2 restart all
pm2 logs

# If using systemd
sudo systemctl restart your-app-name
sudo systemctl status your-app-name
```

## 4. Check Logs

```bash
# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check nginx access logs
sudo tail -f /var/log/nginx/access.log

# Check application logs
pm2 logs
```

## 5. Test Upload

1. Browser में जाकर file upload करें
2. Developer console check करें
3. Network tab में request देखें
4. Server logs monitor करें

## 6. Alternative: Direct Server Test

```bash
# Test direct server (bypass nginx)
curl -X POST http://localhost:5000/api/health
```

## 7. Emergency Fix (if nginx config is complex)

```bash
# Create a simple nginx config for testing
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# Create minimal config
sudo nano /etc/nginx/nginx.conf
```

**Minimal nginx config:**
```nginx
events {
    worker_connections 1024;
}

http {
    client_max_body_size 0;
    client_body_timeout 1200s;
    
    server {
        listen 80;
        server_name your-domain.com;
        
        location / {
            proxy_pass http://localhost:5000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 1200s;
            proxy_send_timeout 1200s;
            proxy_read_timeout 1200s;
        }
    }
}
```

## 8. Verify Changes

```bash
# Check nginx configuration
sudo nginx -T | grep client_max_body_size

# Should show: client_max_body_size 0;

# Check if nginx is running
sudo systemctl status nginx

# Check if your app is running
pm2 status
```
