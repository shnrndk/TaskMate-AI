const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const { getProductivityData, getMonthlyProductivityData, 
    getWeeklyProductivityData, getJSONReport } = require('../controllers/productivityController');

router.use(authenticate); // Apply authentication middleware to all routes

router.get('/', getProductivityData);
router.get('/weekly', getWeeklyProductivityData);
router.get('/monthly', getMonthlyProductivityData);
router.get('/get-csv', getJSONReport);

module.exports = router;
