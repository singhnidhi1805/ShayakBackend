const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, '../backups', `backup-${timestamp}`);

  if (!fs.existsSync(path.dirname(backupPath))) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  }

  const command = `mongodump --uri="${process.env.MONGODB_URI}" --out="${backupPath}"`;

  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        logger.error('Database backup error:', error);
        reject(error);
        return;
      }
      logger.info('Database backup completed successfully');
      resolve(backupPath);
    });
  });
}

module.exports = {
  backupDatabase,
  
};