-- Create Users Table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
    duration INT, -- Estimated duration in minutes
    status ENUM('Pending', 'In Progress', 'Completed', 'Paused') DEFAULT 'Pending',
    start_time DATETIME NULL,
    end_time DATETIME NULL,
    deadline DATETIME NULL,
    subtasks_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE sub_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL, -- Parent task ID
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration INT, -- Estimated duration in minutes
    status ENUM('Pending', 'In Progress', 'Completed', 'Paused') DEFAULT 'Pending',
    start_time DATETIME NULL,
    end_time DATETIME NULL,
    deadline DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);


CREATE TABLE task_timer_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL, -- References the parent task
    sub_task_id INT DEFAULT NULL, -- Nullable reference to sub_tasks table
    user_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    last_paused_time DATETIME, -- Last paused time
    paused_duration INT DEFAULT 0, -- Total paused time in seconds
    pomodoro_cycles INT DEFAULT 0, -- Total Pomodoro cycles completed in this session
    work_duration INT DEFAULT 0, -- Total work time in seconds
    break_duration INT DEFAULT 0, -- Total break time in seconds
    background_time INT DEFAULT 0, -- Total elapsed time in seconds
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (sub_task_id) REFERENCES sub_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE task_statistics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL, -- References the parent task
    sub_task_id INT DEFAULT NULL, -- Nullable reference to sub_tasks table
    user_id INT NOT NULL,
    total_pomodoros INT DEFAULT 0, -- Total Pomodoro cycles completed
    total_work_time INT DEFAULT 0, -- Total work time in seconds
    total_break_time INT DEFAULT 0, -- Total break time in seconds
    total_elapsed_time INT DEFAULT 0, -- Total elapsed time (including pauses)
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (sub_task_id) REFERENCES sub_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed Initial Data
INSERT INTO users (username, email, password)
VALUES ('John Doe', 'john.doe@example.com', 'hashedpassword');

INSERT INTO tasks (user_id, title, description, deadline, priority, category, status)
VALUES
(1, 'Complete Backend Setup', 'Set up Node.js and MySQL', '2024-12-31 23:59:59', 'High', 'Development', 'Pending'),
(1, 'Write Documentation', 'Prepare README for GitHub', '2024-12-25 17:00:00', 'Medium', 'Documentation', 'Pending');
