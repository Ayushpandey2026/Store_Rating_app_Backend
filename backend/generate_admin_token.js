require('dotenv').config();
const pool = require('./src/config/db');
const jwt = require('jsonwebtoken');
(async () => {
  try {
    const result = await pool.query("SELECT id, email, role FROM users WHERE email = 'admin@storerating.com'");
    const user = result.rows[0];
    if (!user) {
      throw new Error('Admin user not found');
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log(token);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
