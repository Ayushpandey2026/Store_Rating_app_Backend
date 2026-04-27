const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const ownerController = require('../controllers/ownerController');
const { authenticate, authorize } = require('../middleware/auth');

// Normal user routes
router.get('/', authenticate, authorize('user'), storeController.getStores);
router.post('/:storeId/rate', authenticate, authorize('user'), storeController.submitRating);

// Store owner routes
router.get('/owner/dashboard', authenticate, authorize('store_owner'), ownerController.getMyStoreDashboard);

module.exports = router;
