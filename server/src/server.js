/**
 * 招投标系统 - 服务启动入口
 */

const app = require('./app');
const { initDatabase, pool } = require('./config/database');

const PORT = process.env.PORT || 3001;

// 初始化数据库并启动服务
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
    console.error('启动失败:', err);
    process.exit(1);
  }
}

startServer();

// 优雅退出
process.on('SIGTERM', async () => {
  console.log('收到 SIGTERM 信号，正在关闭服务...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n收到 SIGINT 信号，正在关闭服务...');
  await pool.end();
  process.exit(0);
});
