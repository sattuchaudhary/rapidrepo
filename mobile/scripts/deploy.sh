#!/bin/bash

# Rapid Repo Mobile App Deployment Script
# This script handles building and deploying the mobile app

set -e

echo "🚀 Starting Rapid Repo Mobile App Deployment..."

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

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    print_error "EAS CLI is not installed. Please install it first:"
    echo "npm install -g @expo/eas-cli"
    exit 1
fi

# Check if user is logged in to Expo
if ! eas whoami &> /dev/null; then
    print_error "You are not logged in to Expo. Please login first:"
    echo "eas login"
    exit 1
fi

# Get deployment type from user
echo "Select deployment type:"
echo "1) Development Build (APK for testing)"
echo "2) Preview Build (APK for internal testing)"
echo "3) Production Build (AAB for Play Store)"
echo "4) iOS Build (for App Store)"
echo "5) Publish OTA Update (for existing builds)"

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        BUILD_TYPE="development"
        print_status "Building development version..."
        eas build --platform android --profile development
        ;;
    2)
        BUILD_TYPE="preview"
        print_status "Building preview version..."
        eas build --platform android --profile preview
        ;;
    3)
        BUILD_TYPE="production"
        print_status "Building production version for Play Store..."
        eas build --platform android --profile production
        ;;
    4)
        BUILD_TYPE="ios"
        print_status "Building iOS version for App Store..."
        eas build --platform ios --profile production
        ;;
    5)
        print_status "Publishing OTA update..."
        eas update --branch production --message "Bug fixes and improvements"
        print_success "OTA update published successfully!"
        exit 0
        ;;
    *)
        print_error "Invalid choice. Please run the script again."
        exit 1
        ;;
esac

if [ $? -eq 0 ]; then
    print_success "Build completed successfully!"
    
    if [ "$BUILD_TYPE" = "production" ] || [ "$BUILD_TYPE" = "ios" ]; then
        echo ""
        print_status "Next steps:"
        echo "1. Download the build from Expo dashboard"
        echo "2. Upload to Play Store/App Store"
        echo "3. Update version configuration in admin panel"
        echo "4. Test the app thoroughly"
    else
        echo ""
        print_status "Build is ready for testing!"
        echo "You can download the APK from the Expo dashboard or scan the QR code."
    fi
else
    print_error "Build failed. Please check the logs and try again."
    exit 1
fi

print_success "Deployment process completed!"
