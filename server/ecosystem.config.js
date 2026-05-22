const path = require('path')

module.exports = {
  apps: [
    {
      name: 'seraphyn-api',
      script: 'index.js',
      cwd: '/var/www/seraphyn/server',
      env_file: path.resolve(__dirname, '..', '.env'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '350M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
}
