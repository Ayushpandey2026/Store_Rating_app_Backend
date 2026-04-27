const bcrypt = require('bcryptjs');
const pool = require('../config/db');

exports.getDashboardStats = async (req, res) => {
  try {
    // Count directly without complex filters first to test
    const users = await pool.query("SELECT COUNT(*) FROM users WHERE role::text != 'admin'");
    const stores = await pool.query('SELECT COUNT(*) FROM stores');
    const ratings = await pool.query('SELECT COUNT(*) FROM ratings');

    res.json({
      totalUsers: parseInt(users.rows[0].count) || 0,
      totalStores: parseInt(stores.rows[0].count) || 0,
      totalRatings: parseInt(ratings.rows[0].count) || 0,
    });
  } catch (err) {
    console.error("DASHBOARD ERROR:", err.message);
    res.status(500).json({ message: 'Dashboard data fetch failed' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, address, role } = req.body;

    if (!['admin', 'user', 'store_owner'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, address, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, address, role, created_at`,
      [name, email, hashed, address, role]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const { name, email, address, role, sortBy = 'name', sortOrder = 'asc' } = req.query;

    const allowedSortFields = ['name', 'email', 'address', 'role', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'name';
    const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    let baseQuery = `
      SELECT u.id, u.name, u.email, u.address, u.role, u.created_at,
        CASE WHEN u.role = 'store_owner' THEN
          (SELECT ROUND(AVG(r.rating)::numeric, 2) FROM stores s
           LEFT JOIN ratings r ON r.store_id = s.id
           WHERE s.owner_id = u.id)
        ELSE NULL END AS store_rating
      FROM users u
      WHERE u.role::text != 'admin'
    `;

    const baseParams = [];
    let idx = 1;

    if (name) { baseQuery += ` AND u.name ILIKE $${idx++}`; baseParams.push(`%${name}%`); }
    if (email) { baseQuery += ` AND u.email ILIKE $${idx++}`; baseParams.push(`%${email}%`); }
    if (address) { baseQuery += ` AND u.address ILIKE $${idx++}`; baseParams.push(`%${address}%`); }
    if (role) { baseQuery += ` AND u.role::text = $${idx++}`; baseParams.push(role); }

    baseQuery += ` ORDER BY u.${sortField} ${order}`;

    const result = await pool.query(baseQuery, baseParams);
    res.json({ users: result.rows });
  } catch (err) {
    console.error("GET_USERS ERROR:", err.message);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.address, u.role, u.created_at,
        CASE WHEN u.role = 'store_owner' THEN
          (SELECT ROUND(AVG(r.rating)::numeric, 2) FROM stores s
           LEFT JOIN ratings r ON r.store_id = s.id
           WHERE s.owner_id = u.id)
        ELSE NULL END AS store_rating
       FROM users u WHERE u.id = $1`,
      [id]
    );

    if (!result.rows.length) return res.status(404).json({ message: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createStore = async (req, res) => {
  try {
    const { name, email, address, owner_id } = req.body;

    if (!name || name.length < 20 || name.length > 60) {
      return res.status(400).json({ message: 'Store name must be 20-60 characters' });
    }

    // Validate owner is a store_owner
    if (owner_id) {
      const ownerCheck = await pool.query("SELECT id FROM users WHERE id = $1 AND role = 'store_owner'", [owner_id]);
      if (!ownerCheck.rows.length) {
        return res.status(400).json({ message: 'Owner must be a user with store_owner role' });
      }
    }

    const existing = await pool.query('SELECT id FROM stores WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ message: 'Store email already exists' });
    }

    const result = await pool.query(
      `INSERT INTO stores (name, email, address, owner_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, email, address, owner_id || null]
    );

    res.status(201).json({ store: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStores = async (req, res) => {
  try {
    const { name, email, address, sortBy = 'name', sortOrder = 'asc' } = req.query;

    const allowedSortFields = ['name', 'email', 'address', 'avg_rating'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'name';
    const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

    let query = `
      SELECT s.id, s.name, s.email, s.address, s.owner_id,
        u.name AS owner_name,
        ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
        COUNT(r.id) AS rating_count
      FROM stores s
      LEFT JOIN users u ON u.id = s.owner_id
      LEFT JOIN ratings r ON r.store_id = s.id
      WHERE 1=1
    `;

    const params = [];
    let idx = 1;

    if (name) { query += ` AND s.name ILIKE $${idx++}`; params.push(`%${name}%`); }
    if (email) { query += ` AND s.email ILIKE $${idx++}`; params.push(`%${email}%`); }
    if (address) { query += ` AND s.address ILIKE $${idx++}`; params.push(`%${address}%`); }

    query += ` GROUP BY s.id, u.name ORDER BY ${sortField === 'avg_rating' ? 'avg_rating' : `s.${sortField}`} ${order} NULLS LAST`;

    const result = await pool.query(query, params);
    res.json({ stores: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
