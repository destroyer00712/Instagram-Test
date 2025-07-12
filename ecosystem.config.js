module.exports = {
  apps: [
    {
      name: 'instagram-chatbot',
      script: 'server.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      // Logging
      log_file: 'logs/combined.log',
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      
      // Auto-restart settings
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      
      // Monitoring
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      
      // Advanced settings
      kill_timeout: 5000,
      listen_timeout: 8000,
      
      // Environment variables
      env_file: '.env'
    }
  ]
}; 