const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const taskController = require('../controllers/taskController');

router.use(authenticate); // Apply authentication middleware to all routes

router.get('/', taskController.getAllTasks);
router.post('/', taskController.createTask);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
