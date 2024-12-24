const db = require('../config/db'); // Import the database connection

const getAllTasks = async (req, res) => {
    try {
        // Replace the user_id with the authenticated user's ID
        const userId = req.user?.id // Use `req.user.id` for JWT authentication; use `1` for testing.
    
        // Fetch tasks from the database
        const [tasks] = await db.query('SELECT * FROM tasks WHERE user_id = ?', [userId]);
    
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
  
      // Calculate duration if not provided but startTime and endTime are available
      if (!duration && startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        calculatedDuration = Math.abs((end - start) / (1000 * 60)); // Duration in minutes
      }
  
      // Insert task into the database
      const [result] = await db.query(
        `INSERT INTO tasks (title, description, start_time, end_time, duration, deadline, priority, category, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
        [
          title,
          description || null,
          startTime || null,
          endTime || null,
          calculatedDuration || null,
          deadline || null,
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

  
module.exports = { getAllTasks, createTask, updateTask, deleteTask };
  