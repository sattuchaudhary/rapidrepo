// PM2 Ecosystem Configuration for RapidRepo Production
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
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
      MONGODB_URI: 'mongodb://rapidrepo_app:password@localhost:27017/rapidrepo_prod',
      JWT_SECRET: 'your_production_jwt_secret',
      CLIENT_URL: 'https://rapidbuddy.cloud'
    },
    // Process management
    kill_timeout: 1200000, // 20 minutes
    listen_timeout: 1200000, // 20 minutes
    shutdown_with_message: true,
    
    // User and working directory
    user: 'rapidrepo',
    cwd: '/var/www/rapidbuddy.cloud',
    
    // Logging
    log_file: '/var/log/rapidrepo/app.log',
    out_file: '/var/log/rapidrepo/out.log',
    error_file: '/var/log/rapidrepo/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Auto restart settings
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Health monitoring
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true,
    
    // Advanced settings
    merge_logs: true,
    time: true,
    
    // Environment variables
    env_file: '.env.production',
    
    // Source map support
    source_map_support: true,
    
    // Instance variables
    instance_var: 'INSTANCE_ID',
    
    // Error handling
    error_file: '/var/log/rapidrepo/error.log',
    out_file: '/var/log/rapidrepo/out.log',
    log_file: '/var/log/rapidrepo/combined.log',
    
    // Process title
    process_title: 'rapidrepo-api'
  }],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'rapidrepo',
      host: 'your-vps-ip',
      ref: 'origin/main',
      repo: 'https://github.com/yourusername/rapidrepo.git',
      path: '/var/www/rapidbuddy.cloud',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && cd client && npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
