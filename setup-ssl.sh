#!/bin/bash

# SSL Setup Script for RapidRepo
# Run this script with: sudo bash setup-ssl.sh

DOMAIN="rapidbuddy.cloud"
EMAIL="your-email@example.com"  # Change this to your email

echo "🔒 Setting up SSL certificates for $DOMAIN..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "📦 Installing required packages..."
apt install -y nginx certbot python3-certbot-nginx ufw

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw --force enable

# Stop nginx if running
systemctl stop nginx

# Create basic nginx config for domain validation
cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location / {
        return 200 'Domain validation in progress...';
        add_header Content-Type text/plain;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t

# Start nginx
systemctl start nginx
systemctl enable nginx

# Verify domain is accessible
echo "🌐 Verifying domain accessibility..."
if curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN | grep -q "200"; then
    echo "✅ Domain is accessible"
else
    echo "❌ Domain is not accessible. Please check DNS settings."
    echo "Make sure $DOMAIN points to this server's IP address."
    exit 1
fi

# Generate SSL certificate
echo "🔐 Generating SSL certificate..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive

# Check if certificate was generated successfully
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ SSL certificate generated successfully"
else
    echo "❌ SSL certificate generation failed"
    exit 1
fi

# Apply production nginx configuration
echo "⚙️  Applying production nginx configuration..."
cp nginx-production.conf /etc/nginx/sites-available/$DOMAIN

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration has errors"
    exit 1
fi

# Reload nginx
systemctl reload nginx

# Set up auto-renewal
echo "🔄 Setting up SSL auto-renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx") | crontab -

# Test SSL certificate
echo "🧪 Testing SSL certificate..."
if curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN | grep -q "200"; then
    echo "✅ SSL certificate is working"
else
    echo "❌ SSL certificate test failed"
fi

# Test HTTP to HTTPS redirect
echo "🔄 Testing HTTP to HTTPS redirect..."
if curl -s -I http://$DOMAIN | grep -q "301"; then
    echo "✅ HTTP to HTTPS redirect is working"
else
    echo "❌ HTTP to HTTPS redirect failed"
fi

echo ""
echo "🎉 SSL setup complete!"
echo ""
echo "🔐 SSL Features enabled:"
echo "  - Let's Encrypt certificate installed"
echo "  - HTTP to HTTPS redirect"
echo "  - Strong SSL configuration"
echo "  - Auto-renewal configured"
echo ""
echo "🌐 Your site is now available at:"
echo "  - https://$DOMAIN"
echo "  - https://www.$DOMAIN"
echo ""
echo "📊 SSL Test: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo ""
echo "🔍 Useful commands:"
echo "  Check certificate: sudo certbot certificates"
echo "  Test renewal: sudo certbot renew --dry-run"
echo "  Check nginx: sudo systemctl status nginx"
echo "  View logs: sudo tail -f /var/log/nginx/error.log"
