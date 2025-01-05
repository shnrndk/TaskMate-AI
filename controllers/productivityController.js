const db = require("../config/db");

const getProductivityData = async (req, res) => {
    const { user_id, start_date, end_date } = req.query;

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

module.exports = { getProductivityData };