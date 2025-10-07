#!/bin/bash

# Database Security Setup Script for RapidRepo
# Run this script with: sudo bash setup-database-security.sh

echo "🗄️  Setting up MongoDB security for RapidRepo..."

# Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    echo "❌ MongoDB is not installed. Installing MongoDB..."
    
    # Update package list
    apt update
    
    # Install MongoDB
    apt install -y mongodb
    
    # Start and enable MongoDB
    systemctl start mongodb
    systemctl enable mongodb
else
    echo "✅ MongoDB is already installed"
fi

# Stop MongoDB to apply security configuration
systemctl stop mongodb

# Backup original configuration
if [ -f /etc/mongod.conf ]; then
    cp /etc/mongod.conf /etc/mongod.conf.backup
    echo "✅ Original configuration backed up"
fi

# Apply security configuration
cp mongodb-security.conf /etc/mongod.conf
echo "✅ Security configuration applied"

# Create MongoDB data directory with proper permissions
mkdir -p /var/lib/mongodb
chown -R mongodb:mongodb /var/lib/mongodb
chmod 755 /var/lib/mongodb

# Create MongoDB log directory
mkdir -p /var/log/mongodb
chown -R mongodb:mongodb /var/log/mongodb

# Start MongoDB
systemctl start mongodb
systemctl enable mongodb

# Wait for MongoDB to start
sleep 5

# Create admin user
echo "👤 Creating MongoDB admin user..."
mongo --eval "
use admin;
db.createUser({
  user: 'rapidrepo_admin',
  pwd: '$(openssl rand -base64 32)',
  roles: [
    { role: 'userAdminAnyDatabase', db: 'admin' },
    { role: 'readWriteAnyDatabase', db: 'admin' },
    { role: 'dbAdminAnyDatabase', db: 'admin' }
  ]
});
"

# Create application user
echo "👤 Creating MongoDB application user..."
mongo --eval "
use rapidrepo_prod;
db.createUser({
  user: 'rapidrepo_app',
  pwd: '$(openssl rand -base64 32)',
  roles: [
    { role: 'readWrite', db: 'rapidrepo_prod' }
  ]
});
"

# Restart MongoDB with authentication
systemctl restart mongodb

echo "✅ MongoDB security setup complete!"
echo ""
echo "🔐 Security features enabled:"
echo "  - Authentication required"
echo "  - Bound to localhost only"
echo "  - Server-side JavaScript disabled"
echo "  - Connection limits set"
echo "  - Admin and application users created"
echo ""
echo "📝 Important:"
echo "  - Update your .env file with the new MongoDB credentials"
echo "  - The generated passwords are shown above - save them securely"
echo "  - MongoDB is now bound to localhost only for security"
echo ""
echo "🔍 Useful commands:"
echo "  Check status: sudo systemctl status mongodb"
echo "  View logs: sudo tail -f /var/log/mongodb/mongod.log"
echo "  Connect: mongo -u rapidrepo_admin -p --authenticationDatabase admin"
