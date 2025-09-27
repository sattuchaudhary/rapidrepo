#!/bin/bash

# Rapid Repo Server Deployment Script
# This script deploys the server code to VPS

echo "🚀 Starting Rapid Repo Server Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "server/index.js" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Deploying server with CORS fixes..."

# Method 1: If you have direct access to VPS
echo "Select deployment method:"
echo "1) Upload files via SCP/SFTP"
echo "2) Git pull on VPS (if using Git)"
echo "3) Manual instructions"

read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        print_status "Preparing files for SCP upload..."
        
        # Create a temporary directory with server files
        mkdir -p temp_deploy/server
        cp -r server/* temp_deploy/server/
        cp package.json temp_deploy/
        cp package-lock.json temp_deploy/
        
        echo "Files prepared in temp_deploy/ directory"
        echo "Upload commands:"
        echo "scp -r temp_deploy/* user@your-vps-ip:/path/to/your/app/"
        echo ""
        echo "After upload, run on VPS:"
        echo "cd /path/to/your/app && npm install && pm2 restart all"
        
        # Clean up
        rm -rf temp_deploy
        ;;
    2)
        print_status "Git deployment method..."
        echo "On your VPS, run these commands:"
        echo "cd /path/to/your/app"
        echo "git pull origin main"
        echo "npm install"
        echo "pm2 restart all"
        ;;
    3)
        print_status "Manual deployment instructions..."
        echo ""
        echo "1. Copy the updated server/index.js file to your VPS"
        echo "2. SSH into your VPS: ssh user@your-vps-ip"
        echo "3. Navigate to your app directory: cd /path/to/your/app"
        echo "4. Replace server/index.js with the updated version"
        echo "5. Restart the application:"
        echo "   - If using PM2: pm2 restart all"
        echo "   - If using systemd: sudo systemctl restart your-app-name"
        echo "6. Check logs: pm2 logs (or journalctl -u your-app-name)"
        echo ""
        echo "The key changes made to fix CORS:"
        echo "- Enhanced CORS configuration with explicit methods and headers"
        echo "- Added explicit OPTIONS request handling"
        echo "- Disabled problematic Helmet policies"
        ;;
    *)
        print_error "Invalid choice. Please run the script again."
        exit 1
        ;;
esac

print_success "Deployment instructions provided!"
print_warning "After deploying, test the login functionality to verify CORS is working."
