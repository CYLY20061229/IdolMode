const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "idol-mode-api",
      cwd: __dirname,
      script: "src/index.mjs",
      exec_mode: "cluster",
      instances: process.env.WEB_CONCURRENCY || "max",
      node_args: "--enable-source-maps",
      max_memory_restart: process.env.MAX_MEMORY_RESTART || "300M",
      kill_timeout: 8000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 8787,
        LOG_DIR: process.env.LOG_DIR || path.join(__dirname, "logs")
      },
      time: true,
      merge_logs: false,
      out_file: path.join(__dirname, "logs", "pm2-out.log"),
      error_file: path.join(__dirname, "logs", "pm2-error.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
