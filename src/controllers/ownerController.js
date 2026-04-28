const pool = require('../config/db');

exports.getMyStoreDashboard = async (req, res) => {
  try {
    const storeResult = await pool.query(
      `SELECT s.id, s.name, s.email, s.address,
        ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
        COUNT(r.id) AS total_ratings
       FROM stores s
       LEFT JOIN ratings r ON r.store_id = s.id
       WHERE s.owner_id = $1
       GROUP BY s.id`,
      [req.user.id]
    );

    if (!storeResult.rows.length) {
      return res.status(404).json({ message: 'No store found for this owner' });
    }

    const store = storeResult.rows[0];

    const ratingsResult = await pool.query(
      `SELECT u.id, u.name, u.email, r.rating, r.created_at, r.updated_at
       FROM ratings r
       JOIN users u ON u.id = r.user_id
       WHERE r.store_id = $1
       ORDER BY r.updated_at DESC`,
      [store.id]
    );

    res.json({
      store,
      ratings: ratingsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
