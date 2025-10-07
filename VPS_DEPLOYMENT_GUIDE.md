# RapidRepo VPS Deployment Guide with Security

यह guide आपको RapidRepo project को VPS पर secure तरीके से deploy करने में मदद करेगा।

## 🚀 Quick Start

### 1. VPS Setup
```bash
# VPS पर login करें
ssh root@your-vps-ip

# सभी files को VPS पर copy करें
scp -r . root@your-vps-ip:/root/rapidrepo-deployment/

# VPS पर जाकर deployment script run करें
cd /root/rapidrepo-deployment
sudo bash deploy-to-vps.sh
```

### 2. Manual Step-by-Step Setup

#### Step 1: System Update और Dependencies Install करें
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git nginx certbot python3-certbot-nginx ufw mongodb nodejs npm pm2
```

#### Step 2: Node.js 18 Install करें
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
sudo apt install -y nodejs
```

#### Step 3: Application Setup
```bash
# Application directory बनाएं
sudo mkdir -p /var/www/rapidbuddy.cloud
cd /var/www/rapidbuddy.cloud

# Code copy करें
sudo git clone https://github.com/yourusername/rapidrepo.git .

# Dependencies install करें
sudo npm install
cd client && sudo npm install && sudo npm run build
cd ..
```

#### Step 4: Environment Configuration
```bash
# Production environment file बनाएं
sudo cp env.production.example .env.production
sudo nano .env.production  # अपने values update करें
```

#### Step 5: Database Security Setup
```bash
sudo bash setup-database-security.sh
```

#### Step 6: SSL Certificate Setup
```bash
sudo bash setup-ssl.sh
```

#### Step 7: Firewall Setup
```bash
sudo bash setup-firewall.sh
```

#### Step 8: Application Start करें
```bash
# PM2 के साथ application start करें
sudo pm2 start ecosystem.config.js
sudo pm2 save
sudo pm2 startup
```

## 🔒 Security Features

### 1. SSL/TLS Security
- ✅ Let's Encrypt SSL certificates
- ✅ HTTP to HTTPS redirect
- ✅ Strong SSL configuration
- ✅ Auto-renewal setup

### 2. Firewall Security
- ✅ UFW firewall enabled
- ✅ Only necessary ports open
- ✅ Rate limiting for SSH
- ✅ IP-based access control

### 3. Database Security
- ✅ MongoDB authentication enabled
- ✅ Localhost-only binding
- ✅ User-based access control
- ✅ No server-side JavaScript

### 4. Application Security
- ✅ Helmet.js security headers
- ✅ CORS configuration
- ✅ Rate limiting
- ✅ Input sanitization
- ✅ XSS protection

### 5. Nginx Security
- ✅ Security headers
- ✅ File type restrictions
- ✅ Request size limits
- ✅ Timeout configurations

## 📊 Monitoring और Maintenance

### 1. Application Monitoring
```bash
# Application status check करें
pm2 status

# Logs देखें
pm2 logs

# Application restart करें
pm2 restart rapidrepo-api
```

### 2. System Monitoring
```bash
# System resources check करें
htop
df -h
free -h

# Service status check करें
systemctl status nginx
systemctl status mongodb
```

### 3. Security Monitoring
```bash
# Security monitoring script run करें
sudo bash security-monitor.sh

# Security logs देखें
sudo tail -f /var/log/rapidrepo/security.log
```

### 4. Log Management
```bash
# Application logs
sudo tail -f /var/log/rapidrepo/app.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

## 🔧 Configuration Files

### 1. Environment Variables (.env.production)
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://rapidrepo_app:password@localhost:27017/rapidrepo_prod
JWT_SECRET=your_secure_jwt_secret
CLIENT_URL=https://rapidbuddy.cloud
```

### 2. Nginx Configuration
- File: `/etc/nginx/sites-available/rapidbuddy.cloud`
- Features: SSL, security headers, rate limiting

### 3. MongoDB Configuration
- File: `/etc/mongod.conf`
- Features: Authentication, localhost binding

### 4. PM2 Configuration
- File: `ecosystem.config.js`
- Features: Process management, logging, monitoring

## 🚨 Troubleshooting

### Common Issues और Solutions

#### 1. SSL Certificate Issues
```bash
# Certificate status check करें
sudo certbot certificates

# Manual renewal करें
sudo certbot renew --dry-run

# Nginx configuration test करें
sudo nginx -t
```

#### 2. Application Not Starting
```bash
# PM2 logs check करें
pm2 logs rapidrepo-api

# Environment variables check करें
pm2 show rapidrepo-api

# Manual start करें
node server/index.js
```

#### 3. Database Connection Issues
```bash
# MongoDB status check करें
sudo systemctl status mongodb

# MongoDB logs check करें
sudo tail -f /var/log/mongodb/mongod.log

# Connection test करें
mongo --eval "db.adminCommand('ping')"
```

#### 4. Nginx Issues
```bash
# Configuration test करें
sudo nginx -t

# Nginx restart करें
sudo systemctl restart nginx

# Error logs check करें
sudo tail -f /var/log/nginx/error.log
```

## 📈 Performance Optimization

### 1. Nginx Optimization
- Gzip compression enabled
- Static file caching
- Request size limits
- Timeout configurations

### 2. Node.js Optimization
- PM2 process management
- Memory limits
- Auto-restart on crashes
- Log rotation

### 3. Database Optimization
- Connection pooling
- Index optimization
- Query monitoring

## 🔄 Backup और Recovery

### 1. Automated Backup
```bash
# Backup script run करें
sudo /usr/local/bin/rapidrepo-backup.sh

# Backup status check करें
ls -la /var/backups/rapidrepo/
```

### 2. Manual Backup
```bash
# Database backup
mongodump --db rapidrepo_prod --out /var/backups/rapidrepo/manual_backup

# Application backup
tar -czf /var/backups/rapidrepo/app_backup.tar.gz /var/www/rapidbuddy.cloud
```

### 3. Recovery
```bash
# Database restore
mongorestore --db rapidrepo_prod /var/backups/rapidrepo/db_backup

# Application restore
tar -xzf /var/backups/rapidrepo/app_backup.tar.gz -C /
```

## 🌐 Domain Configuration

### 1. DNS Settings
```
A Record: rapidbuddy.cloud -> your-vps-ip
CNAME: www.rapidbuddy.cloud -> rapidbuddy.cloud
```

### 2. SSL Certificate
- Let's Encrypt certificates automatically generated
- Auto-renewal configured
- HTTP to HTTPS redirect

## 📞 Support और Maintenance

### 1. Regular Maintenance Tasks
- Weekly security updates
- Monthly backup verification
- Quarterly security audit
- Annual certificate renewal

### 2. Monitoring Alerts
- Application downtime
- High resource usage
- Security threats
- SSL certificate expiry

### 3. Contact Information
- Technical support: admin@rapidbuddy.cloud
- Security issues: security@rapidbuddy.cloud

## ✅ Security Checklist

- [ ] SSL certificates installed and working
- [ ] Firewall configured and active
- [ ] Database authentication enabled
- [ ] Application running with PM2
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Monitoring scripts active
- [ ] Backup system working
- [ ] Log rotation configured
- [ ] Updates automated

## 🎉 Deployment Complete!

आपका RapidRepo application अब secure तरीके से VPS पर deployed है। 

**Access URLs:**
- Main site: https://rapidbuddy.cloud
- API health: https://rapidbuddy.cloud/api/health

**Important Notes:**
1. अपने production environment variables को update करना न भूलें
2. Regular security monitoring करते रहें
3. Backups को regularly verify करें
4. SSL certificates automatically renew हो जाएंगे

Happy coding! 🚀
