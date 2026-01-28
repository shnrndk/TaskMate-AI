const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const { getProductivityData, getMonthlyProductivityData, 
    getWeeklyProductivityData, getJSONReport, getStatPerTask } = require('../controllers/productivityController');

router.use(authenticate); // Apply authentication middleware to all routes

router.get('/', getProductivityData);
router.get('/weekly', getWeeklyProductivityData);
router.get('/monthly', getMonthlyProductivityData);
router.get('/get-csv', getJSONReport);
router.get('/get-csv', getJSONReport);
router.get('/:task_id/stats', getStatPerTask);

module.exports = router;
