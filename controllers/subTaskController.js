const db = require("../config/db");

// Get all sub-tasks for a parent task
const getSubTasks = async (req, res) => {
  try {
    const { taskId } = req.params;

    const [subTasks] = await db.query(
      `SELECT * FROM sub_tasks WHERE task_id = ?`,
      [taskId]
    );
    res.status(200).json(subTasks);
  } catch (err) {
    console.error("Error fetching sub-tasks:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getSubTaskById = async (req, res) => {
    try {
      const { subTaskId } = req.params;
  
      const [subTasks] = await db.query(
        `SELECT * FROM sub_tasks WHERE id = ?`,
        [subTaskId]
      );
      res.status(200).json(subTasks);
    } catch (err) {
      console.error("Error fetching sub-tasks:", err.message);
      res.status(500).json({ message: "Internal server error" });
    }
  };

// Add a new sub-task
const createSubTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, status } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const [result] = await db.query(
      `INSERT INTO sub_tasks (task_id, title, description, status) VALUES (?, ?, ?, ?)`,
      [taskId, title, description || null, status || "Pending"]
    );

    res.status(201).json({
      message: "Sub-task created successfully",
      subTaskId: result.insertId,
    });
  } catch (err) {
    console.error("Error creating sub-task:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a sub-task
const updateSubTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, start_time, end_time } = req.body;

    // Convert ISO 8601 to MySQL datetime format
    const formatDateTime = (isoString) => {
      const date = new Date(isoString);
      return date.toISOString().slice(0, 19).replace('T', ' '); // `YYYY-MM-DD HH:MM:SS`
    };

    const formattedStartTime = start_time ? formatDateTime(start_time) : null;
    const formattedEndTime = end_time ? formatDateTime(end_time) : null;

    const [result] = await db.query(
      `UPDATE sub_tasks SET 
        title = ?, 
        description = ?, 
        status = ?, 
        start_time = ?, 
        end_time = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [title, description, status, formattedStartTime, formattedEndTime, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Sub-task not found" });
    }

    res.status(200).json({ message: "Sub-task updated successfully" });
  } catch (err) {
    console.error("Error updating sub-task:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};


// Delete a sub-task
const deleteSubTask = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(`DELETE FROM sub_tasks WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Sub-task not found" });
    }

    res.status(200).json({ message: "Sub-task deleted successfully" });
  } catch (err) {
    console.error("Error deleting sub-task:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Start a sub-task
const startSubTask = async (req, res) => {
    try {
        const subTaskId = req.params?.subTaskId;
        const userId = req.user?.id;

        // Check if the sub-task exists and belongs to the user
        const [subTask] = await db.query(
          `SELECT * FROM sub_tasks WHERE id = ?`,
          [subTaskId]
        );

        if (subTask.length === 0) {
          return res.status(404).json({ message: "Sub-task not found or unauthorized" });
        }

        // Ensure the sub-task isn't already in progress or completed
        if (subTask[0].status === "In Progress" || subTask[0].status === "Completed") {
          return res
            .status(400)
            .json({ message: "Sub-task is already in progress or completed." });
        }

        // Update the sub-task to start it, initializing start_time and setting status
        const [result] = await db.query(
          `UPDATE sub_tasks 
           SET start_time = NOW(), 
               status = 'In Progress' 
           WHERE id = ?`,
          [subTaskId]
        );

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Sub-task not found or unauthorized" });
        }

        // Log timer-related data in task_timer_sessions
        const [sessionResult] = await db.query(
          `INSERT INTO task_timer_sessions 
           (task_id, sub_task_id, user_id, start_time, paused_duration, work_duration, break_duration, background_time) 
           VALUES (?, ?, ?, NOW(), 0, 0, 0, 0)`,
          [subTask[0].task_id, subTaskId, userId]
        );

        res.status(200).json({
          message: "Sub-task started successfully",
          sessionId: sessionResult.insertId,
        });
    } catch (err) {
      console.error("Error starting sub-task:", err.message);
      res.status(500).json({ message: "Internal server error" });
    }
};

const pauseSubTask = async (req, res) => {
    try {
        const userId = req.user?.id;
        const subTaskId = req.params?.subTaskId;
        // Get the current sub-task session
        const [session] = await db.query(
          `SELECT * FROM task_timer_sessions WHERE sub_task_id = ? AND user_id = ? AND end_time IS NULL`,
          [subTaskId, userId]
        );

        if (session.length === 0) {
          return res
            .status(404)
            .json({ message: "Sub-task session not found or sub-task is already completed." });
        }

        // Calculate the time since the sub-task started
        const now = new Date();
        const startTime = new Date(session[0].start_time);
        const elapsedTime = Math.floor((now - startTime) / 1000); // Time in seconds

        // Update the paused duration and mark the sub-task as paused
        const [result] = await db.query(
          `UPDATE task_timer_sessions 
           SET paused_duration = paused_duration + ?, 
               end_time = NOW()
           WHERE id = ?`,
          [elapsedTime, session[0].id]
        );

        const [subTaskUpdate] = await db.query(
          `UPDATE sub_tasks SET status = 'Paused' WHERE id = ?`,
          [subTaskId]
        );

        if (result.affectedRows === 0 || subTaskUpdate.affectedRows === 0) {
          return res.status(404).json({ message: "Failed to pause the sub-task." });
        }

        res.status(200).json({
          message: "Sub-task paused successfully",
          pausedDuration: session[0].paused_duration + elapsedTime,
        });
    } catch (err) {
      console.error("Error pausing sub-task:", err.message);
      res.status(500).json({ message: "Internal server error" });
    }
};

const resumeSubTask = async (req, res) => {
    try {
        const userId = req.user?.id;
        const subTaskId = req.params?.subTaskId;

        // Verify that the sub-task is paused
        const [subTask] = await db.query(
          `SELECT * FROM sub_tasks WHERE id = ? AND status = 'Paused'`,
          [subTaskId]
        );

        if (subTask.length === 0) {
          return res.status(404).json({ message: "Sub-task is not paused or not found." });
        }

        // Start a new timer session
        const [result] = await db.query(
          `INSERT INTO task_timer_sessions 
           (task_id, sub_task_id, user_id, start_time, paused_duration, work_duration, break_duration, background_time) 
           VALUES (?, ?, ?, NOW(), 0, 0, 0, 0)`,
          [subTask[0].task_id, subTaskId, userId]
        );

        // Update the sub-task status
        const [subTaskUpdate] = await db.query(
          `UPDATE sub_tasks SET status = 'In Progress' WHERE id = ?`,
          [subTaskId]
        );

        if (result.affectedRows === 0 || subTaskUpdate.affectedRows === 0) {
          return res.status(500).json({ message: "Failed to resume the sub-task." });
        }

        res.status(200).json({
          message: "Sub-task resumed successfully",
          sessionId: result.insertId,
        });
    } catch (err) {
      console.error("Error resuming sub-task:", err.message);
      res.status(500).json({ message: "Internal server error" });
    }
};

const checkSubTaskStarted = async (req, res) => {
  try {
    const userId = req.user?.id;
    const subTaskId = req.params?.subTaskId;

    // Query to check if a sub task is currently active
    const [rows] = await db.query(
      `SELECT * FROM task_timer_sessions 
       WHERE sub_task_id = ? AND user_id = ? AND end_time IS NULL`,
      [subTaskId, userId]
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

module.exports = {
  getSubTasks,
  createSubTask,
  updateSubTask,
  deleteSubTask,
  startSubTask,
  pauseSubTask,
  resumeSubTask,
  getSubTaskById,
  checkSubTaskStarted
};
