# SSL Setup Commands for rapidbuddy.cloud

## 1. Install Certbot और SSL Certificate Generate करें

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Generate SSL certificate
sudo certbot --nginx -d rapidbuddy.cloud -d www.rapidbuddy.cloud

# Test certificate renewal
sudo certbot renew --dry-run
```

## 2. Nginx Configuration Update करें

```bash
# Backup current config
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# Copy new SSL config
sudo nano /etc/nginx/sites-available/rapidbuddy.cloud
```

**नई nginx configuration paste करें (nginx-ssl-config.conf से)**

```bash
# Enable the site
sudo ln -sf /etc/nginx/sites-available/rapidbuddy.cloud /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
sudo systemctl status nginx
```

## 3. Environment Variables Update करें

```bash
# Edit .env file
sudo nano /var/www/rapidbuddy.cloud/.env
```

**Add these lines:**
```env
NODE_ENV=production
CLIENT_URL=https://rapidbuddy.cloud
SSL_CERT_PATH=/etc/letsencrypt/live/rapidbuddy.cloud/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/rapidbuddy.cloud/privkey.pem
```

## 4. Application Restart करें

```bash
# If using PM2
pm2 restart all
pm2 logs

# If using systemd
sudo systemctl restart your-app-name
sudo systemctl status your-app-name
```

## 5. Firewall Configuration

```bash
# Allow HTTPS traffic
sudo ufw allow 443
sudo ufw allow 80

# Check firewall status
sudo ufw status
```

## 6. Test SSL Setup

```bash
# Test SSL certificate
openssl s_client -connect rapidbuddy.cloud:443 -servername rapidbuddy.cloud

# Test HTTP to HTTPS redirect
curl -I http://rapidbuddy.cloud

# Test HTTPS
curl -I https://rapidbuddy.cloud
```

## 7. Auto-renewal Setup

```bash
# Add to crontab
sudo crontab -e

# Add this line for auto-renewal
0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx
```

## 8. Verify Everything Works

1. Browser में जाकर `https://rapidbuddy.cloud` check करें
2. Green lock icon दिखना चाहिए
3. "Not secure" warning गायब हो जाना चाहिए
4. API calls भी HTTPS पर work करने चाहिए

## Troubleshooting

### अगर SSL certificate generate नहीं हो रहा:

```bash
# Check domain DNS
nslookup rapidbuddy.cloud

# Check if ports are open
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
```

### अगर nginx restart नहीं हो रहा:

```bash
# Check nginx config syntax
sudo nginx -t

# Check for conflicting configurations
sudo nginx -T | grep server_name

# Restart nginx forcefully
sudo systemctl stop nginx
sudo systemctl start nginx
```

### अगर application HTTPS पर नहीं चल रहा:

```bash
# Check if SSL paths are correct
ls -la /etc/letsencrypt/live/rapidbuddy.cloud/

# Check application logs
pm2 logs
# or
sudo journalctl -u your-app-name -f
```
