const pool = require('../config/db');

exports.getStores = async (req, res) => {
  try {
    const { name, address, sortBy = 'name', sortOrder = 'asc' } = req.query;

    const allowedSortFields = ['name', 'address', 'avg_rating'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'name';
    const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

    let query = `
      SELECT s.id, s.name, s.address,
        ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
        COUNT(r.id) AS rating_count,
        ur.rating AS user_rating
      FROM stores s
      LEFT JOIN ratings r ON r.store_id = s.id
      LEFT JOIN ratings ur ON ur.store_id = s.id AND ur.user_id = $1
      WHERE 1=1
    `;

    const params = [req.user.id];
    let idx = 2;

    if (name) { query += ` AND s.name ILIKE $${idx++}`; params.push(`%${name}%`); }
    if (address) { query += ` AND s.address ILIKE $${idx++}`; params.push(`%${address}%`); }

    query += ` GROUP BY s.id, ur.rating ORDER BY ${sortField === 'avg_rating' ? 'avg_rating' : `s.${sortField}`} ${order} NULLS LAST`;

    const result = await pool.query(query, params);
    res.json({ stores: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.submitRating = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const storeCheck = await pool.query('SELECT id FROM stores WHERE id = $1', [storeId]);
    if (!storeCheck.rows.length) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const result = await pool.query(
      `INSERT INTO ratings (user_id, store_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, store_id)
       DO UPDATE SET rating = $3, updated_at = NOW()
       RETURNING *`,
      [req.user.id, storeId, rating]
    );

    res.json({ rating: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
