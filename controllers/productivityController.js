const db = require("../config/db");
const fs = require('fs');
const path = require('path');

const getProductivityData = async (req, res) => {
    const { start_date, end_date } = req.query;
    const user_id = req.user?.id;
    // Default date range: Last year
    const startDate = start_date || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    try {
        // Query to fetch daily productivity data
        const [rows] = await db.query(
            `
        SELECT 
          DATE(task_timer_sessions.start_time) AS day,
          COUNT(tasks.id) AS tasks_completed,
          SUM(task_timer_sessions.pomodoro_cycles) AS pomodoro_cycles,
          SUM(task_timer_sessions.work_duration) AS work_duration,
          SUM(task_timer_sessions.break_duration) AS break_duration
        FROM task_timer_sessions
        LEFT JOIN tasks ON task_timer_sessions.task_id = tasks.id
        WHERE tasks.user_id = ? 
          AND task_timer_sessions.start_time BETWEEN ? AND ?
        GROUP BY DATE(task_timer_sessions.start_time)
        ORDER BY day
        `,
            [user_id, startDate, endDate]
        );

        // Constants for efficiency score
        const MAX_WORK_DURATION = 8 * 3600; // 8 hours in seconds
        const w1 = 1, w2 = 0.5, w3 = 1, w4 = 0.5;

        // Calculate metrics
        const totalTasksCompleted = rows.reduce((sum, row) => sum + (row.tasks_completed || 0), 0);
        const totalPomodoroCycles = rows.reduce((sum, row) => sum + (row.pomodoro_cycles || 0), 0);
        const totalWorkDuration = rows.reduce((sum, row) => sum + (row.work_duration || 0), 0);
        const totalBreakDuration = rows.reduce((sum, row) => sum + (row.break_duration || 0), 0);
        const totalDays = rows.length;

        const averageTasksPerDay = totalDays ? (totalTasksCompleted / totalDays).toFixed(2) : 0;
        const averagePomodoroCyclesPerDay = totalDays ? (totalPomodoroCycles / totalDays).toFixed(2) : 0;
        const breakToWorkRatio = totalWorkDuration
            ? (totalBreakDuration / totalWorkDuration).toFixed(2)
            : 0;

        // Add efficiency score for each day
        const dailyData = rows.map(row => {
            const tasksCompleted = row.tasks_completed || 0;
            const pomodoroCycles = row.pomodoro_cycles || 0;
            const workDuration = row.work_duration || 0; // in seconds
            const breakDuration = row.break_duration || 0; // in seconds

            const workDurationScore = workDuration / MAX_WORK_DURATION; // Normalize to an 8-hour day
            const breakDurationScore = breakDuration / MAX_WORK_DURATION; // Normalize to an 8-hour day

            const efficiencyScore = (
                w1 * tasksCompleted +
                w2 * pomodoroCycles +
                w3 * workDurationScore -
                w4 * breakDurationScore
            ).toFixed(2);

            return {
                day: row.day,
                tasks_completed: tasksCompleted,
                pomodoro_cycles: pomodoroCycles,
                work_duration: workDuration,
                break_duration: breakDuration,
                efficiency_score: parseFloat(efficiencyScore)
            };
        });

        // Format the response
        const result = {
            daily_data: dailyData,
            metrics: {
                total_tasks_completed: totalTasksCompleted,
                total_pomodoro_cycles: totalPomodoroCycles,
                total_work_duration: totalWorkDuration, // in seconds
                total_break_duration: totalBreakDuration, // in seconds
                average_tasks_per_day: averageTasksPerDay,
                average_pomodoro_cycles_per_day: averagePomodoroCyclesPerDay,
                break_to_work_ratio: breakToWorkRatio
            }
        };

        res.json(result);
    } catch (error) {
        console.error('Error fetching productivity data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getWeeklyProductivityData = async (req, res) => {
    const { start_date, end_date } = req.query;
    const user_id = req.user?.id;

    try {
        const [rows] = await db.query(
            `
            WITH RECURSIVE date_series AS (
                SELECT DATE(?) as date
                UNION ALL
                SELECT DATE_ADD(date, INTERVAL 1 DAY)
                FROM date_series
                WHERE date < DATE(?)
            )
            SELECT 
                ds.date AS day,
                COALESCE(SUM(tts.work_duration), 0) AS work_duration,
                COALESCE(SUM(tts.break_duration), 0) AS break_duration,
                COALESCE(COUNT(DISTINCT tasks.id), 0) AS tasks_completed,
                COALESCE(SUM(tts.pomodoro_cycles), 0) AS pomodoro_cycles
            FROM date_series ds
            LEFT JOIN task_timer_sessions tts ON DATE(tts.start_time) = ds.date
            LEFT JOIN tasks ON tts.task_id = tasks.id AND tasks.user_id = ?
            GROUP BY ds.date
            ORDER BY ds.date
            `,
            [start_date, end_date, user_id]
        );

        const dailyWorkData = rows.map(row => ({
            day: row.day,
            work_duration: row.work_duration.toString(), // Convert to string to match existing format
            break_duration: row.break_duration.toString(),
            tasks_completed: row.tasks_completed,
            pomodoro_cycles: row.pomodoro_cycles.toString()
        }));

        // Calculate totals from the complete data set
        const metrics = {
            total_work_duration: dailyWorkData.reduce((sum, day) => sum + parseInt(day.work_duration), 0).toString().padStart(5, '0'),
            total_break_duration: dailyWorkData.reduce((sum, day) => sum + parseInt(day.break_duration), 0).toString().padStart(4, '0'),
            total_tasks_completed: dailyWorkData.reduce((sum, day) => sum + day.tasks_completed, 0),
            total_pomodoro_cycles: dailyWorkData.reduce((sum, day) => sum + parseInt(day.pomodoro_cycles), 0).toString().padStart(2, '0')
        };

        res.json({
            weekly_data: dailyWorkData,
            metrics
        });
    } catch (error) {
        console.error('Error fetching weekly productivity data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getMonthlyProductivityData = async (req, res) => {
    const { start_date, end_date } = req.query;
    const user_id = req.user?.id;

    try {
        const [rows] = await db.query(
            `
            WITH RECURSIVE week_series AS (
                SELECT 
                    YEARWEEK(?, 1) as week_number,
                    ? as start_date,
                    ? as end_date
                UNION ALL
                SELECT 
                    YEARWEEK(DATE_ADD(start_date, INTERVAL 7 DAY), 1),
                    DATE_ADD(start_date, INTERVAL 7 DAY),
                    end_date
                FROM week_series
                WHERE DATE_ADD(start_date, INTERVAL 7 DAY) <= ?
            )
            SELECT 
                ws.week_number AS week,
                COALESCE(SUM(tts.work_duration), 0) AS work_duration,
                COALESCE(SUM(tts.break_duration), 0) AS break_duration,
                COALESCE(COUNT(DISTINCT tasks.id), 0) AS tasks_completed,
                COALESCE(SUM(tts.pomodoro_cycles), 0) AS pomodoro_cycles
            FROM week_series ws
            LEFT JOIN task_timer_sessions tts 
                ON YEARWEEK(tts.start_time, 1) = ws.week_number
            LEFT JOIN tasks 
                ON tts.task_id = tasks.id 
                AND tasks.user_id = ?
            GROUP BY ws.week_number
            ORDER BY ws.week_number
            `,
            [start_date, start_date, end_date, end_date, user_id]
        );

        const weeklyWorkData = rows.map(row => ({
            week: row.week.toString(), // Convert to string to match existing format
            work_duration: row.work_duration.toString(), // Convert to string to match existing format
            break_duration: row.break_duration.toString(),
            tasks_completed: row.tasks_completed,
            pomodoro_cycles: row.pomodoro_cycles.toString()
        }));

        // Calculate totals and format them with leading zeros
        const metrics = {
            total_work_duration: weeklyWorkData.reduce((sum, week) => sum + parseInt(week.work_duration), 0).toString().padStart(5, '0'),
            total_break_duration: weeklyWorkData.reduce((sum, week) => sum + parseInt(week.break_duration), 0).toString().padStart(4, '0'),
            total_tasks_completed: weeklyWorkData.reduce((sum, week) => sum + week.tasks_completed, 0),
            total_pomodoro_cycles: weeklyWorkData.reduce((sum, week) => sum + parseInt(week.pomodoro_cycles), 0).toString().padStart(2, '0')
        };

        res.json({
            monthly_data: weeklyWorkData,
            metrics
        });
    } catch (error) {
        console.error('Error fetching monthly productivity data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getJSONReport = async (req, res) => {
    const { start_date, end_date } = req.query;
    const user_id = req.user?.id;
    
      try {
        // Fetch daily data
        const [dailyRows] = await db.query(
          `
          SELECT 
            DATE(task_timer_sessions.start_time) AS day,
            SUM(task_timer_sessions.work_duration) AS work_duration,
            SUM(task_timer_sessions.break_duration) AS break_duration,
            COUNT(tasks.id) AS tasks_completed,
            SUM(task_timer_sessions.pomodoro_cycles) AS pomodoro_cycles
          FROM task_timer_sessions
          LEFT JOIN tasks ON task_timer_sessions.task_id = tasks.id
          WHERE tasks.user_id = ?
          GROUP BY DATE(task_timer_sessions.start_time)
          ORDER BY day
          `,
          [user_id]
        );
    
        // Fetch weekly data
        const [weeklyRows] = await db.query(
          `
          SELECT 
            YEARWEEK(task_timer_sessions.start_time, 1) AS week,
            SUM(task_timer_sessions.work_duration) AS work_duration,
            SUM(task_timer_sessions.break_duration) AS break_duration,
            COUNT(tasks.id) AS tasks_completed,
            SUM(task_timer_sessions.pomodoro_cycles) AS pomodoro_cycles
          FROM task_timer_sessions
          LEFT JOIN tasks ON task_timer_sessions.task_id = tasks.id
          WHERE tasks.user_id = ?
          GROUP BY YEARWEEK(task_timer_sessions.start_time, 1)
          ORDER BY week
          `,
          [user_id]
        );
    
        // Fetch monthly data
        const [monthlyRows] = await db.query(
          `
          SELECT 
            DATE_FORMAT(task_timer_sessions.start_time, '%Y-%m') AS month,
            SUM(task_timer_sessions.work_duration) AS work_duration,
            SUM(task_timer_sessions.break_duration) AS break_duration,
            COUNT(tasks.id) AS tasks_completed,
            SUM(task_timer_sessions.pomodoro_cycles) AS pomodoro_cycles
          FROM task_timer_sessions
          LEFT JOIN tasks ON task_timer_sessions.task_id = tasks.id
          WHERE tasks.user_id = ?
          GROUP BY DATE_FORMAT(task_timer_sessions.start_time, '%Y-%m')
          ORDER BY month
          `,
          [user_id]
        );
    
        // Format the data for JSON
        const dailyData = dailyRows.map((row) => ({
          date: row.day,
          workDuration: (row.work_duration / 3600).toFixed(2), // Convert to hours
          breakDuration: (row.break_duration / 3600).toFixed(2), // Convert to hours
          tasksCompleted: row.tasks_completed,
          pomodoroCycles: row.pomodoro_cycles,
        }));
    
        const weeklyData = weeklyRows.map((row) => ({
          week: row.week,
          workDuration: (row.work_duration / 3600).toFixed(2),
          breakDuration: (row.break_duration / 3600).toFixed(2),
          tasksCompleted: row.tasks_completed,
          pomodoroCycles: row.pomodoro_cycles,
        }));
    
        const monthlyData = monthlyRows.map((row) => ({
          month: row.month,
          workDuration: (row.work_duration / 3600).toFixed(2),
          breakDuration: (row.break_duration / 3600).toFixed(2),
          tasksCompleted: row.tasks_completed,
          pomodoroCycles: row.pomodoro_cycles,
        }));
    
        // Combine all data into a JSON object
        const responseData = {
          userId: user_id,
          dailyData,
          weeklyData,
          monthlyData,
        };
    
        // Send the JSON response
        res.status(200).json(responseData);
      } catch (error) {
        console.error('Error generating JSON:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
  };

const getStatPerTask = async (req, res) => {
    const { task_id } = req.params;

    if (!task_id) {
        return res.status(400).json({ error: 'Task ID is required' });
    }

    try {
        // Fetch task details
        const [taskRows] = await db.query(
            `
    SELECT 
        id, title, description, category, priority, duration, status, 
        start_time, end_time, deadline, subtasks_count, created_at 
    FROM tasks 
    WHERE id = ?
    `,
            [task_id]
        );

        if (taskRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = taskRows[0];

        // Fetch task timer sessions for the task
        const [timerRows] = await db.query(
            `
    SELECT 
        SUM(work_duration) AS total_work_duration,
        SUM(break_duration) AS total_break_duration,
        SUM(paused_duration) AS total_paused_duration,
        SUM(pomodoro_cycles) AS total_pomodoro_cycles,
        COUNT(id) AS total_sessions
    FROM task_timer_sessions 
    WHERE task_id = ?
    `,
            [task_id]
        );

        const timerStats = timerRows[0];

        // Calculate efficiency stats
        const estimatedWorkDuration = task.duration * 60; // Convert minutes to seconds
        const actualWorkDuration = timerStats.total_work_duration || 0;
        const breakDuration = timerStats.total_break_duration || 0;

        const efficiencyScore =
            actualWorkDuration && estimatedWorkDuration
                ? ((actualWorkDuration / estimatedWorkDuration) * 100).toFixed(2)
                : 0;

        const totalTimeSpent = actualWorkDuration + breakDuration;

        // Format response
        const response = {
            task: {
                id: task.id,
                title: task.title,
                description: task.description,
                category: task.category,
                priority: task.priority,
                estimatedDuration: task.duration, // in minutes
                status: task.status,
                startTime: task.start_time,
                endTime: task.end_time,
                deadline: task.deadline,
                subtasksCount: task.subtasks_count,
                createdAt: task.created_at,
            },
            stats: {
                totalWorkDuration: (actualWorkDuration / 3600).toFixed(2), // in hours
                totalBreakDuration: (breakDuration / 3600).toFixed(2), // in hours
                totalPausedDuration: (timerStats.total_paused_duration / 3600).toFixed(2), // in hours
                totalPomodoroCycles: timerStats.total_pomodoro_cycles || 0,
                totalSessions: timerStats.total_sessions || 0,
                efficiencyScore: `${efficiencyScore}%`,
                totalTimeSpent: (totalTimeSpent / 3600).toFixed(2), // in hours
            },
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching task stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { getProductivityData, getWeeklyProductivityData, 
    getMonthlyProductivityData, getJSONReport, getStatPerTask };