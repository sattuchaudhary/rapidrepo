#!/bin/bash

# Complete VPS Deployment Script for RapidRepo
# Run this script on your VPS with: sudo bash deploy-to-vps.sh

set -e  # Exit on any error

DOMAIN="rapidbuddy.cloud"
APP_DIR="/var/www/rapidbuddy.cloud"
REPO_URL="https://github.com/yourusername/rapidrepo.git"  # Change this to your repo
NODE_VERSION="18"  # Change if needed

echo "🚀 Starting RapidRepo VPS Deployment..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "📦 Installing required packages..."
apt install -y curl wget git nginx certbot python3-certbot-nginx ufw mongodb nodejs npm pm2

# Install Node.js 18 (if not already installed)
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 18 ]]; then
    echo "📦 Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi

# Create application directory
echo "📁 Creating application directory..."
mkdir -p $APP_DIR
cd $APP_DIR

# Clone repository (or copy files)
echo "📥 Setting up application files..."
if [ -d ".git" ]; then
    echo "🔄 Updating existing repository..."
    git pull origin main
else
    echo "📥 Cloning repository..."
    git clone $REPO_URL .
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install
cd client && npm install && npm run build
cd ..

# Create production environment file
echo "⚙️  Setting up environment configuration..."
if [ ! -f ".env.production" ]; then
    cp env.production.example .env.production
    echo "⚠️  Please edit .env.production with your production values"
fi

# Set up application user
echo "👤 Creating application user..."
if ! id "rapidrepo" &>/dev/null; then
    useradd -r -s /bin/false -d $APP_DIR rapidrepo
fi

# Set proper permissions
chown -R rapidrepo:rapidrepo $APP_DIR
chmod -R 755 $APP_DIR

# Set up MongoDB security
echo "🗄️  Setting up MongoDB security..."
bash setup-database-security.sh

# Set up SSL
echo "🔒 Setting up SSL certificates..."
bash setup-ssl.sh

# Set up firewall
echo "🔥 Setting up firewall..."
bash setup-firewall.sh

# Configure PM2
echo "⚙️  Configuring PM2..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'rapidrepo-api',
    script: 'server/index.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '2G',
    node_args: '--max-old-space-size=2048',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    kill_timeout: 1200000,
    listen_timeout: 1200000,
    shutdown_with_message: true,
    user: 'rapidrepo',
    cwd: '$APP_DIR',
    log_file: '/var/log/rapidrepo/app.log',
    out_file: '/var/log/rapidrepo/out.log',
    error_file: '/var/log/rapidrepo/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
EOF

# Create log directory
mkdir -p /var/log/rapidrepo
chown -R rapidrepo:rapidrepo /var/log/rapidrepo

# Start application with PM2
echo "🚀 Starting application..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure nginx
echo "⚙️  Configuring nginx..."
cp nginx-production.conf /etc/nginx/sites-available/$DOMAIN
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Reload nginx
systemctl reload nginx
systemctl enable nginx

# Set up log rotation
echo "📝 Setting up log rotation..."
cat > /etc/logrotate.d/rapidrepo << EOF
/var/log/rapidrepo/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 rapidrepo rapidrepo
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Set up monitoring script
echo "📊 Setting up monitoring..."
cat > /usr/local/bin/rapidrepo-monitor.sh << 'EOF'
#!/bin/bash
# RapidRepo Health Monitor

LOG_FILE="/var/log/rapidrepo/health.log"
APP_URL="https://rapidbuddy.cloud/api/health"

# Check if application is responding
if curl -s -f $APP_URL > /dev/null; then
    echo "$(date): Application is healthy" >> $LOG_FILE
else
    echo "$(date): Application is down, restarting..." >> $LOG_FILE
    pm2 restart rapidrepo-api
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$(date): Disk usage is high: ${DISK_USAGE}%" >> $LOG_FILE
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.2f", $3*100/$2}')
if (( $(echo "$MEMORY_USAGE > 90" | bc -l) )); then
    echo "$(date): Memory usage is high: ${MEMORY_USAGE}%" >> $LOG_FILE
fi
EOF

chmod +x /usr/local/bin/rapidrepo-monitor.sh

# Add monitoring to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/rapidrepo-monitor.sh") | crontab -

# Set up backup script
echo "💾 Setting up backup script..."
cat > /usr/local/bin/rapidrepo-backup.sh << 'EOF'
#!/bin/bash
# RapidRepo Backup Script

BACKUP_DIR="/var/backups/rapidrepo"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/var/www/rapidbuddy.cloud"

mkdir -p $BACKUP_DIR

# Backup database
mongodump --db rapidrepo_prod --out $BACKUP_DIR/db_$DATE

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C $APP_DIR .

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "db_*" -mtime +7 -delete
find $BACKUP_DIR -name "app_*" -mtime +7 -delete

echo "$(date): Backup completed" >> /var/log/rapidrepo/backup.log
EOF

chmod +x /usr/local/bin/rapidrepo-backup.sh

# Add backup to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/rapidrepo-backup.sh") | crontab -

# Final checks
echo "🧪 Running final checks..."

# Check if all services are running
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
else
    echo "❌ Nginx is not running"
fi

if systemctl is-active --quiet mongodb; then
    echo "✅ MongoDB is running"
else
    echo "❌ MongoDB is not running"
fi

if pm2 list | grep -q "rapidrepo-api.*online"; then
    echo "✅ Application is running"
else
    echo "❌ Application is not running"
fi

# Test HTTPS
if curl -s -f https://$DOMAIN > /dev/null; then
    echo "✅ HTTPS is working"
else
    echo "❌ HTTPS is not working"
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "🌐 Your application is now available at:"
echo "  - https://$DOMAIN"
echo "  - https://www.$DOMAIN"
echo ""
echo "📊 Health check: https://$DOMAIN/api/health"
echo ""
echo "🔍 Useful commands:"
echo "  Check status: pm2 status"
echo "  View logs: pm2 logs"
echo "  Restart app: pm2 restart rapidrepo-api"
echo "  Check nginx: systemctl status nginx"
echo "  Check MongoDB: systemctl status mongodb"
echo "  View firewall: ufw status"
echo "  Check SSL: certbot certificates"
echo ""
echo "📝 Next steps:"
echo "  1. Update .env.production with your production values"
echo "  2. Test all functionality"
echo "  3. Set up monitoring alerts"
echo "  4. Configure domain DNS if not already done"
