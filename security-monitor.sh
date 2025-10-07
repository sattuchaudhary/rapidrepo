#!/bin/bash

# Security Monitoring Script for RapidRepo
# Run this script regularly to monitor security

LOG_FILE="/var/log/rapidrepo/security.log"
ALERT_EMAIL="admin@rapidbuddy.cloud"  # Change this to your email

echo "🔒 Starting security monitoring check..."

# Function to log security events
log_security_event() {
    echo "$(date): $1" >> $LOG_FILE
}

# Check for failed login attempts
check_failed_logins() {
    echo "🔍 Checking for failed login attempts..."
    
    # Check nginx logs for 401/403 errors
    FAILED_ATTEMPTS=$(grep -c " 401\| 403 " /var/log/nginx/access.log 2>/dev/null || echo "0")
    if [ "$FAILED_ATTEMPTS" -gt 10 ]; then
        log_security_event "WARNING: High number of failed login attempts: $FAILED_ATTEMPTS"
    fi
    
    # Check for suspicious IPs
    SUSPICIOUS_IPS=$(grep " 401\| 403 " /var/log/nginx/access.log 2>/dev/null | awk '{print $1}' | sort | uniq -c | sort -nr | head -5)
    if [ ! -z "$SUSPICIOUS_IPS" ]; then
        log_security_event "Suspicious IPs detected: $SUSPICIOUS_IPS"
    fi
}

# Check SSL certificate expiry
check_ssl_certificate() {
    echo "🔍 Checking SSL certificate..."
    
    DOMAIN="rapidbuddy.cloud"
    EXPIRY_DATE=$(openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
    
    if [ ! -z "$EXPIRY_DATE" ]; then
        EXPIRY_TIMESTAMP=$(date -d "$EXPIRY_DATE" +%s)
        CURRENT_TIMESTAMP=$(date +%s)
        DAYS_UNTIL_EXPIRY=$(( (EXPIRY_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
        
        if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
            log_security_event "WARNING: SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
        else
            log_security_event "SSL certificate is valid for $DAYS_UNTIL_EXPIRY more days"
        fi
    else
        log_security_event "ERROR: Could not check SSL certificate"
    fi
}

# Check system security
check_system_security() {
    echo "🔍 Checking system security..."
    
    # Check if firewall is active
    if ufw status | grep -q "Status: active"; then
        log_security_event "Firewall is active"
    else
        log_security_event "WARNING: Firewall is not active"
    fi
    
    # Check for root login attempts
    ROOT_LOGINS=$(grep "Failed password for root" /var/log/auth.log 2>/dev/null | wc -l)
    if [ "$ROOT_LOGINS" -gt 0 ]; then
        log_security_event "WARNING: $ROOT_LOGINS failed root login attempts detected"
    fi
    
    # Check for suspicious processes
    SUSPICIOUS_PROCS=$(ps aux | grep -E "(nc|netcat|nmap|nikto|sqlmap)" | grep -v grep | wc -l)
    if [ "$SUSPICIOUS_PROCS" -gt 0 ]; then
        log_security_event "WARNING: Suspicious processes detected"
    fi
}

# Check application security
check_application_security() {
    echo "🔍 Checking application security..."
    
    # Check if application is running
    if pm2 list | grep -q "rapidrepo-api.*online"; then
        log_security_event "Application is running"
    else
        log_security_event "ERROR: Application is not running"
    fi
    
    # Check for error logs
    ERROR_COUNT=$(grep -c "ERROR" /var/log/rapidrepo/error.log 2>/dev/null || echo "0")
    if [ "$ERROR_COUNT" -gt 10 ]; then
        log_security_event "WARNING: High number of application errors: $ERROR_COUNT"
    fi
    
    # Check database connectivity
    if mongo --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        log_security_event "Database is accessible"
    else
        log_security_event "ERROR: Database is not accessible"
    fi
}

# Check disk space and memory
check_resources() {
    echo "🔍 Checking system resources..."
    
    # Check disk space
    DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $DISK_USAGE -gt 80 ]; then
        log_security_event "WARNING: Disk usage is high: ${DISK_USAGE}%"
    else
        log_security_event "Disk usage is normal: ${DISK_USAGE}%"
    fi
    
    # Check memory usage
    MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ $MEMORY_USAGE -gt 90 ]; then
        log_security_event "WARNING: Memory usage is high: ${MEMORY_USAGE}%"
    else
        log_security_event "Memory usage is normal: ${MEMORY_USAGE}%"
    fi
}

# Check for updates
check_updates() {
    echo "🔍 Checking for system updates..."
    
    UPDATES_AVAILABLE=$(apt list --upgradable 2>/dev/null | wc -l)
    if [ $UPDATES_AVAILABLE -gt 1 ]; then
        log_security_event "INFO: $((UPDATES_AVAILABLE-1)) updates available"
    else
        log_security_event "System is up to date"
    fi
}

# Main execution
main() {
    echo "Starting security monitoring at $(date)"
    
    check_failed_logins
    check_ssl_certificate
    check_system_security
    check_application_security
    check_resources
    check_updates
    
    echo "Security monitoring completed at $(date)"
    echo "Log saved to: $LOG_FILE"
    
    # Send alert if critical issues found
    if grep -q "ERROR\|WARNING" $LOG_FILE; then
        echo "⚠️  Security issues detected. Check the log file."
        # Uncomment to send email alerts
        # mail -s "RapidRepo Security Alert" $ALERT_EMAIL < $LOG_FILE
    fi
}

# Run the monitoring
main
