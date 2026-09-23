module.exports = {
  apps: [
    {
      name: 'carisma_backend',
      script: 'index.js',
      cwd: __dirname,
      watch: false,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '600M',
      kill_timeout: 30000,
      restart_delay: 2000,
    },
    {
      name: 'carisma_carparts',
      script: 'integrations/carparts/worker.js',
      cwd: __dirname,
      watch: false,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '1400M',
      kill_timeout: 30000,
      restart_delay: 5000,
    },
  ],
};
