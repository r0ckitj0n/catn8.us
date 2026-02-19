module.exports = {
  apps: [
    {
      name: 'catn8-vite',
      script: 'bash',
      args: 'scripts/dev/run-vite-5178.sh',
      env: {
        VITE_DEV_PORT: '5178',
        VITE_HMR_PORT: '5178',
        CATN8_VITE_ORIGIN: 'http://localhost:5178'
      }
    },
    {
      name: 'catn8-mystery-worker',
      script: 'bash',
      args: '-lc "while true; do php scripts/maintenance/run_mystery_generation_worker.php; sleep 1; done"',
      autorestart: true,
      restart_delay: 1000,
      max_restarts: 100000
    }
  ]
};
