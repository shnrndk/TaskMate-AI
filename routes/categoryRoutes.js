const express = require('express');
const { getCategories, createCategory } = require('../controllers/categoryController');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authenticateToken, getCategories);
router.post('/', authenticateToken, createCategory);

module.exports = router;
