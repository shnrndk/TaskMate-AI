const db = require("../config/db");
const fetch = require("node-fetch"); 
const axios = require("axios");         
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  fetch,                                     
});

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

    // Create the sub-task
    const [result] = await db.query(
      `INSERT INTO sub_tasks (task_id, title, description, status) VALUES (?, ?, ?, ?)`,
      [taskId, title, description || null, status || "Pending"]
    );

    if (result.affectedRows === 0) {
      return res.status(500).json({ message: "Failed to create sub-task." });
    }

    // Increment the sub_task_count in the tasks table
    const [taskUpdate] = await db.query(
      `UPDATE tasks SET subtasks_count = subtasks_count + 1 WHERE id = ?`,
      [taskId]
    );

    if (taskUpdate.affectedRows === 0) {
      return res.status(500).json({
        message: "Sub-task created, but failed to update the sub-task count.",
      });
    }

    res.status(201).json({
      message: "Sub-task created successfully and sub-task count updated.",
      subTaskId: result.insertId,
    });
  } catch (err) {
    console.error("Error creating sub-task:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/tasks/:taskId/sub-tasks/bulk
const createMultipleSubTasks = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { subTasks } = req.body;

    if (!Array.isArray(subTasks) || subTasks.length === 0) {
      return res
        .status(400)
        .json({ message: "subTasks must be a non-empty array." });
    }

    // Prepare values: [ [task_id, title, description, priority, duration, status], ... ]
    const values = subTasks.map((st) => [
      taskId,
      st.title,
      st.description || null,
      st.duration || null,
      st.status || "Pending",
    ]);

    const [result] = await db.query(
      `INSERT INTO sub_tasks (task_id, title, description, duration, status)
       VALUES ?`,
      [values]
    );

    // Update subtasks_count += number of new subtasks
    const [taskUpdate] = await db.query(
      `UPDATE tasks SET subtasks_count = subtasks_count + ? WHERE id = ?`,
      [subTasks.length, taskId]
    );

    if (taskUpdate.affectedRows === 0) {
      return res.status(500).json({
        message:
          "Sub-tasks created, but failed to update the sub-task count.",
      });
    }

    res.status(201).json({
      message: "Sub-tasks created successfully and sub-task count updated.",
      insertedCount: subTasks.length,
    });
  } catch (err) {
    console.error("Error creating multiple sub-tasks:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};


// POST /api/tasks/:taskId/sub-tasks/generate
const generateSubTasks = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, duration, category, priority } = req.body;

    const userContext = `
Task: ${title}
Description: ${description || "N/A"}
Category: ${category || "N/A"}
Priority: ${priority || "N/A"}
Planned duration (mins): ${duration || "N/A"}
    `;

    const systemPrompt = `
You are an assistant that breaks a task into 3–7 sub-tasks.
Each sub-task must have:
- title (short, action oriented)
- duration (minutes, integer)
- priority ("Low", "Medium", or "High").

Return ONLY valid JSON in the form:
{
  "subTasks": [
    { "title": "...", "duration": 30, "priority": "High" },
    ...
  ]
}
    `;

    const openaiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContext },
        ],
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const completion = openaiRes.data;
    const raw = completion.choices[0].message.content;
    const parsed = JSON.parse(raw);

    if (!parsed.subTasks || !Array.isArray(parsed.subTasks)) {
      return res
        .status(500)
        .json({ message: "Model response did not contain subTasks array." });
    }

    return res.json({
      taskId,
      subTasks: parsed.subTasks,
    });
  } catch (err) {
    console.error("Error generating sub-tasks:", err.response?.data || err);
    res.status(500).json({ message: "Failed to generate sub-tasks." });
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
    const { id, subTaskId } = req.params;
    console.log(id)
    const [result] = await db.query(`DELETE FROM sub_tasks WHERE id = ?`, [subTaskId]);
    // Decrement the sub_task_count in the tasks table
    const [taskUpdate] = await db.query(
      `UPDATE tasks SET subtasks_count = subtasks_count - 1 WHERE id = ?`,
      [id]
    );

    if (taskUpdate.affectedRows === 0) {
      return res.status(500).json({
        message: "Sub-task deleted, but failed to update the sub-task count.",
      });
    }
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
      return res.status(400).json({ message: "Sub-task is already in progress or completed." });
    }

    // Update the sub-task to start it
    await db.query(
      `UPDATE sub_tasks 
       SET start_time = NOW(), 
           status = 'In Progress' 
       WHERE id = ?`,
      [subTaskId]
    );

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

// Pause a sub-task
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
      return res.status(404).json({
        message: "Sub-task session not found or sub-task is already completed.",
      });
    }

    // Calculate the time since the sub-task started
    const now = new Date();
    const startTime = new Date(session[0].start_time);
    const elapsedTime = Math.floor((now - startTime) / 1000); // Time in seconds

    const updatedWorkDuration = session[0].work_duration + elapsedTime;
    const incrementPomodoro = elapsedTime >= 25 * 60 ? 1 : 0; // Increment pomodoro if work session exceeds 25 mins

    // Update session and sub-task statistics
    await db.query(
      `UPDATE task_timer_sessions 
       SET work_duration = ?, 
           pomodoro_cycles = pomodoro_cycles + ?, 
           last_paused_time = NOW()
       WHERE id = ?`,
      [updatedWorkDuration, incrementPomodoro, session[0].id]
    );

    const [subTaskUpdate] = await db.query(
      `UPDATE sub_tasks SET status = 'Paused' WHERE id = ?`,
      [subTaskId]
    );

    if (subTaskUpdate.affectedRows === 0) {
      return res.status(404).json({ message: "Failed to pause the sub-task." });
    }

    res.status(200).json({
      message: "Sub-task paused successfully",
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
      return res.status(404).json({
        message: "Sub-task is not paused or not found.",
      });
    }

    // Get the most recent session for this sub-task
    const [session] = await db.query(
      `SELECT * FROM task_timer_sessions WHERE sub_task_id = ? AND user_id = ? ORDER BY end_time DESC LIMIT 1`,
      [subTaskId, userId]
    );

    if (session.length === 0) {
      return res.status(404).json({ message: "No previous session found for this sub-task." });
    }

    // Calculate the paused duration
    const now = new Date();
    const lastSessionEndTime = new Date(session[0].last_paused_time);
    const pausedElapsedTime = Math.floor((now - lastSessionEndTime) / 1000); // Time in seconds

    // Update the paused duration and last_paused_time of the existing session
    await db.query(
      `UPDATE task_timer_sessions 
       SET paused_duration = paused_duration + ?, last_paused_time = NOW() 
       WHERE id = ?`,
      [pausedElapsedTime, session[0].id]
    );

    // Update the sub-task status to 'In Progress'
    const [subTaskUpdate] = await db.query(
      `UPDATE sub_tasks SET status = 'In Progress' WHERE id = ?`,
      [subTaskId]
    );

    if (subTaskUpdate.affectedRows === 0) {
      return res.status(500).json({ message: "Failed to resume the sub-task." });
    }

    res.status(200).json({
      message: "Sub-task resumed successfully",
      pausedDuration: session[0].paused_duration + pausedElapsedTime,
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

const finishSubTask = async (req, res) => {
  try {
    const userId = req.user?.id;
    const subTaskId = req.params?.subTaskId;

    // Verify that the sub-task exists and is in progress or paused
    const [subTask] = await db.query(
      `SELECT * FROM sub_tasks WHERE id = ? AND (status = 'In Progress' OR status = 'Paused')`,
      [subTaskId]
    );

    if (subTask.length === 0) {
      return res.status(404).json({ message: "Sub-task is not in progress, paused, or not found." });
    }

    // Get the most recent session for this sub-task
    const [session] = await db.query(
      `SELECT * FROM task_timer_sessions WHERE sub_task_id = ? AND user_id = ? ORDER BY start_time DESC LIMIT 1`,
      [subTaskId, userId]
    );

    if (session.length === 0) {
      return res.status(404).json({ message: "No active session found for this sub-task." });
    }

    const now = new Date();
    const startTime = new Date(session[0].start_time);

    // Calculate `background_time`
    const backgroundTime = Math.floor((now - startTime) / 1000); // Time in seconds

    // Calculate `break_time` using Pomodoro logic
    const pomodoroCycleDuration = 25 * 60; // 25 minutes in seconds
    const breakDurationPerCycle = 5 * 60; // 5 minutes in seconds
    const numberOfPomodoroCycles = Math.floor(backgroundTime / pomodoroCycleDuration);

    // Calculate break time
    const breakTime = numberOfPomodoroCycles * breakDurationPerCycle;

    // Update the session with background time and break time
    await db.query(
      `UPDATE task_timer_sessions 
       SET background_time = ?, break_duration = ?, end_time = NOW() 
       WHERE id = ?`,
      [backgroundTime, breakTime, session[0].id]
    );

    // Mark the sub-task as completed
    const [subTaskUpdate] = await db.query(
      `UPDATE sub_tasks SET status = 'Completed' WHERE id = ?`,
      [subTaskId]
    );

    if (subTaskUpdate.affectedRows === 0) {
      return res.status(500).json({ message: "Failed to complete the sub-task." });
    }

    res.status(200).json({
      message: "Sub-task completed successfully",
      backgroundTime,
      breakTime,
      numberOfPomodoroCycles,
    });
  } catch (err) {
    console.error("Error finishing sub-task:", err.message);
    res.status(500).json({ message: "Internal server error" });
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
  checkSubTaskStarted,
  finishSubTask,
  generateSubTasks,
  createMultipleSubTasks
};
