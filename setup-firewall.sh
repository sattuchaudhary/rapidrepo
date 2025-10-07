#!/bin/bash

# Firewall Setup Script for RapidRepo VPS
# Run this script with: sudo bash setup-firewall.sh

echo "🔥 Setting up UFW Firewall for RapidRepo..."

# Reset UFW to defaults
ufw --force reset

# Set default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (be careful with this!)
echo "⚠️  WARNING: Make sure you have SSH access before running this!"
read -p "Do you want to allow SSH on port 22? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ufw allow 22/tcp
    echo "✅ SSH (port 22) allowed"
else
    echo "❌ SSH not allowed - you may lose access!"
fi

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp
echo "✅ HTTP (port 80) and HTTPS (port 443) allowed"

# Allow Node.js application port (if not using reverse proxy)
read -p "Do you want to allow direct access to Node.js on port 5000? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ufw allow 5000/tcp
    echo "✅ Node.js (port 5000) allowed"
fi

# Allow MongoDB (if running locally)
read -p "Do you want to allow MongoDB on port 27017? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Only allow from localhost
    ufw allow from 127.0.0.1 to any port 27017
    echo "✅ MongoDB (port 27017) allowed from localhost only"
fi

# Rate limiting rules
ufw limit ssh
echo "✅ SSH rate limiting enabled"

# Enable logging
ufw logging on
echo "✅ UFW logging enabled"

# Enable the firewall
ufw --force enable

echo "🔥 Firewall configuration complete!"
echo "📊 Current status:"
ufw status verbose

echo ""
echo "🔍 Useful commands:"
echo "  Check status: sudo ufw status"
echo "  Check logs: sudo ufw status numbered"
echo "  View logs: sudo tail -f /var/log/ufw.log"
echo "  Disable firewall: sudo ufw disable"
echo "  Reset firewall: sudo ufw --force reset"
