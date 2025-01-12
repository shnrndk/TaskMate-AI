const express = require('express');
const router = express.Router();
const { getProductivityData, getMonthlyProductivityData, getWeeklyProductivityData } = require('../controllers/productivityController');

router.get('/', getProductivityData);
router.get('/weekly', getWeeklyProductivityData);
router.get('/monthly', getMonthlyProductivityData);

module.exports = router;
