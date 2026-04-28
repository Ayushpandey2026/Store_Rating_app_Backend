const bcrypt = require('bcryptjs');
require('dotenv').config();
const pool = require('./db');

const initDb = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create ENUM
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'user', 'store_owner');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Users table (Name check: 20–60 chars to match app validation)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(60) NOT NULL CHECK (char_length(name) >= 20),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        address VARCHAR(400),
        role user_role NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add address column if it doesn't exist
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(400);
    `);

    // Stores table (Name check: 20–60 chars to match app validation)
    await client.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        name VARCHAR(60) NOT NULL CHECK (char_length(name) >= 20),
        email VARCHAR(255) UNIQUE NOT NULL,
        address VARCHAR(400),
        owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Ratings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, store_id)
      );
    `);

    // Seed Admin (update password if admin already exists)
    const hashedPassword = await bcrypt.hash('Admin@1234', 12);
    await client.query(`
      INSERT INTO users (name, email, password, address, role)
      VALUES ($1, $2, $3, $4, 'admin')
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password;
    `, ['System Administrator', 'admin@storerating.com', hashedPassword, 'HQ Address']);

    await client.query('COMMIT');
    console.log('✅ Database initialized successfully');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database init failed:', err.message);
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
};

module.exports = { initDb };
