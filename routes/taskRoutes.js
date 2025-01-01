const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const taskController = require('../controllers/taskController');
const subTaskController = require("../controllers/subTaskController");

router.use(authenticate); // Apply authentication middleware to all routes

router.get('/', taskController.getAllTasks);
router.get('/:id', taskController.getTaskById);
router.post('/', taskController.createTask);
router.put('/:id', taskController.updateTask);
router.put('/:id/start', taskController.startTask);
router.put('/:id/pause', taskController.pauseTask);
router.put('/:id/resume', taskController.resumeTask);
router.delete('/:id', taskController.deleteTask);
router.get("/:id/status", taskController.checkTaskStarted);

// Get all sub-tasks for a specific task
router.get("/:taskId/sub-tasks", subTaskController.getSubTasks);
router.get("/sub-tasks/:subTaskId", subTaskController.getSubTaskById);
router.put("/sub-tasks/:subTaskId/start", subTaskController.startSubTask);
router.put("/sub-tasks/:subTaskId/pause", subTaskController.pauseSubTask);
router.put("/sub-tasks/:subTaskId/resume", subTaskController.resumeSubTask);
// Create a new sub-task for a specific task
router.post("/:taskId/sub-tasks", subTaskController.createSubTask);
// Update a sub-task
router.put("/sub-tasks/:id", subTaskController.updateSubTask);
// Delete a sub-task
router.delete("/sub-tasks/:id", subTaskController.deleteSubTask);

module.exports = router;
