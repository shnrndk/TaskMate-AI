const express = require('express');
const router = express.Router();
const { getProductivityData } = require('../controllers/productivityController');

router.get('/', getProductivityData);

module.exports = router;
