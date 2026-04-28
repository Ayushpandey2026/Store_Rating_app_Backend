require('dotenv').config();
const pool = require('./src/config/db');
(async () => {
  try {
    const result = await pool.query('SELECT id, email, role FROM users ORDER BY id');
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
