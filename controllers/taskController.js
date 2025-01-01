const db = require('../config/db'); // Import the database connection

const getAllTasks = async (req, res) => {
    try {
        // Replace the user_id with the authenticated user's ID
        const userId = req.user?.id  // Use `req.user.id` for JWT authentication; use `1` for testing.
        // Fetch tasks from the database
        const [tasks] = await db.query('SELECT * FROM tasks WHERE user_id = ?', [userId]);
    
        res.status(200).json(tasks);
    } catch (err) {
        console.error('Error fetching tasks:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getTaskById = async (req, res) => {
    try {
        // Replace the user_id with the authenticated user's ID
        const userId = req.user?.id;
        const taskId = req.params?.id;
        // Fetch tasks from the database
        const [tasks] = await db.query('SELECT * FROM tasks WHERE user_id = ? AND id = ?', [userId, taskId]);
    
        res.status(200).json(tasks);
    } catch (err) {
        console.error('Error fetching tasks:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const createTask = async (req, res) => {
    try {
      const { title, description, startTime, endTime, duration, deadline, priority, category } = req.body;
  
      if (!title) {
        return res.status(400).json({ message: 'Title is required' });
      }
  
      let calculatedDuration = duration;

      // Get user ID from the authenticated request
      const userId = req.user.id;

      // Convert ISO 8601 timestamp to MySQL-compatible DATETIME format
      const formattedDeadline = deadline ? new Date(deadline).toISOString().slice(0, 19).replace('T', ' ') : null;
  
      // Calculate duration if not provided but startTime and endTime are available
      if (!duration && startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        calculatedDuration = Math.abs((end - start) / (1000 * 60)); // Duration in minutes
      }
  
      // Insert task into the database
      const [result] = await db.query(
        `INSERT INTO tasks (user_id, title, description, start_time, end_time, duration, deadline, priority, category, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
        [
          userId,
          title,
          description || null,
          startTime || null,
          endTime || null,
          calculatedDuration || null,
          formattedDeadline || null,
          priority || 'Medium',
          category || null,
        ]
      );
  
      res.status(201).json({ message: 'Task created successfully', taskId: result.insertId });
    } catch (err) {
      console.error('Error creating task:', err.message);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  
  const updateTask = async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, deadline, priority, category, status } = req.body;
  
      // Validate input
      if (!id) {
        return res.status(400).json({ message: 'Task ID is required' });
      }
  
      // Update task in the database
      const [result] = await db.query(
        `UPDATE tasks SET title = ?, description = ?, deadline = ?, priority = ?, category = ?, status = ? WHERE id = ?`,
        [title, description, deadline, priority, category, status, id]
      );
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Task not found' });
      }
  
      res.status(200).json({ message: 'Task updated successfully' });
    } catch (err) {
      console.error('Error updating task:', err.message);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  
  const deleteTask = async (req, res) => {
    try {
      const { id } = req.params;
  
      if (!id) {
        return res.status(400).json({ message: 'Task ID is required' });
      }
  
      // Delete task from the database
      const [result] = await db.query('DELETE FROM tasks WHERE id = ?', [id]);
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Task not found' });
      }
  
      res.status(200).json({ message: 'Task deleted successfully' });
    } catch (err) {
      console.error('Error deleting task:', err.message);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

// Start a task
const startTask = async (req, res) => {
    try {
        const userId = req.user?.id;
        const taskId = req.params?.id;
    
        // Check if the task exists and belongs to the user
        const [task] = await db.query(
          `SELECT * FROM tasks WHERE id = ? AND user_id = ?`,
          [taskId, userId]
        );
      if (task.length === 0) {
        return res.status(404).json({ message: "Task not found or unauthorized" });
      }
      // Ensure the task isn't already in progress or completed
      if (task[0].status === "In Progress" || task[0].status === "Completed") {
        return res
          .status(400)
          .json({ message: "Task is already in progress or completed." });
      }
  
      // Update the task to start it, initializing start_time and setting status
      const [result] = await db.query(
        `UPDATE tasks 
         SET start_time = NOW(), 
             status = 'In Progress' 
         WHERE id = ? AND user_id = ?`,
        [taskId, userId]
      );
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Task not found or unauthorized" });
      }
  
      // Log timer-related data in task_timer_sessions
      const [sessionResult] = await db.query(
        `INSERT INTO task_timer_sessions 
         (task_id, user_id, start_time, paused_duration, work_duration, break_duration, background_time) 
         VALUES (?, ?, NOW(), 0, 0, 0, 0)`,
        [taskId, userId]
      );
  
      res.status(200).json({
        message: "Task started successfully",
        sessionId: sessionResult.insertId,
      });
    } catch (err) {
      console.error("Error starting task:", err.message);
      res.status(500).json({ message: "Internal server error" });
    }
  };

  const pauseTask = async (req, res) => {
    try {
        const userId = req.user?.id;
        const taskId = req.params?.id;
  
      // Get the current task session
      const [session] = await db.query(
        `SELECT * FROM task_timer_sessions WHERE task_id = ? AND user_id = ? AND end_time IS NULL`,
        [taskId, userId]
      );
  
      if (session.length === 0) {
        return res
          .status(404)
          .json({ message: "Task session not found or task is already completed." });
      }
  
      // Calculate the time since the task started
      const now = new Date();
      const startTime = new Date(session[0].start_time);
      const elapsedTime = Math.floor((now - startTime) / 1000); // Time in seconds
  
      // Update the paused duration and mark the task as paused
      const [result] = await db.query(
        `UPDATE task_timer_sessions 
         SET paused_duration = paused_duration + ?, 
             end_time = NOW()
         WHERE id = ?`,
        [elapsedTime, session[0].id]
      );
  
      const [taskUpdate] = await db.query(
        `UPDATE tasks SET status = 'Paused' WHERE id = ? AND user_id = ?`,
        [taskId, userId]
      );
  
      if (result.affectedRows === 0 || taskUpdate.affectedRows === 0) {
        return res.status(404).json({ message: "Failed to pause the task." });
      }
  
      res.status(200).json({
        message: "Task paused successfully",
        pausedDuration: session[0].paused_duration + elapsedTime,
      });
    } catch (err) {
      console.error("Error pausing task:", err.message);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  
  const resumeTask = async (req, res) => {
    try {
        const userId = req.user?.id;
        const taskId = req.params?.id;
  
      // Verify that the task is paused
      const [task] = await db.query(
        `SELECT * FROM tasks WHERE id = ? AND user_id = ? AND status = 'Paused'`,
        [taskId, userId]
      );
  
      if (task.length === 0) {
        return res.status(404).json({ message: "Task is not paused or not found." });
      }
  
      // Start a new timer session
      const [result] = await db.query(
        `INSERT INTO task_timer_sessions 
         (task_id, user_id, start_time, paused_duration, work_duration, break_duration, background_time) 
         VALUES (?, ?, NOW(), 0, 0, 0, 0)`,
        [taskId, userId]
      );
  
      // Update the task status
      const [taskUpdate] = await db.query(
        `UPDATE tasks SET status = 'In Progress' WHERE id = ? AND user_id = ?`,
        [taskId, userId]
      );
  
      if (result.affectedRows === 0 || taskUpdate.affectedRows === 0) {
        return res.status(500).json({ message: "Failed to resume the task." });
      }
  
      res.status(200).json({
        message: "Task resumed successfully",
        sessionId: result.insertId,
      });
    } catch (err) {
      console.error("Error resuming task:", err.message);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  
  const checkTaskStarted = async (req, res) => {
    try {
      const userId = req.user?.id;
      const taskId = req.params?.id;
  
      // Query to check if a task is currently active
      const [rows] = await db.query(
        `SELECT * FROM task_timer_sessions 
         WHERE task_id = ? AND user_id = ? AND end_time IS NULL`,
        [taskId, userId]
      );
  
      if (rows.length > 0) {
        return res.status(200).json({
          message: "Task is currently started.",
          isStarted: true,
          session: rows[0], // Return the session details if needed
        });
      } else {
        return res.status(200).json({
          message: "Task is not started.",
          isStarted: false,
        });
      }
    } catch (err) {
      console.error("Error checking task status:", err.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

module.exports = { getAllTasks, createTask, updateTask, deleteTask,
     startTask, pauseTask, resumeTask, getTaskById, checkTaskStarted};
  