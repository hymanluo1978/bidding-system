/**
 * 招投标系统 - 服务启动入口
 */

const app = require('./app');
const { initDatabase, pool } = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3001;

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason: reason?.message || reason, stack: reason?.stack });
});

async function startServer() {
  try {
    await initDatabase();
    
    const { initSeedData } = require('./config/seed');
    await initSeedData();
    
    app.listen(PORT, () => {
      const deployUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
      console.log('=================================');
      console.log('  招投标系统后端服务已启动');
      console.log(`  地址: ${deployUrl}`);
      console.log(`  环境: ${process.env.NODE_ENV || 'production'}`);
      console.log('=================================');
    });
  } catch (err) {
    logger.error('启动失败:', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', async () => {
  logger.info('收到 SIGTERM 信号，正在关闭服务...');
  try { await pool.end(); } catch (e) { /* ignore */ }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('收到 SIGINT 信号，正在关闭服务...');
  try { await pool.end(); } catch (e) { /* ignore */ }
  process.exit(0);
});
