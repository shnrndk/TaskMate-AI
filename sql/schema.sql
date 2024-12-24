-- Create Users Table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Tasks Table
CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  deadline DATETIME,
  priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
  category VARCHAR(100),
  status ENUM('Pending', 'Completed') DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed Initial Data
INSERT INTO users (username, email, password)
VALUES ('John Doe', 'john.doe@example.com', 'hashedpassword');

INSERT INTO tasks (user_id, title, description, deadline, priority, category, status)
VALUES
(1, 'Complete Backend Setup', 'Set up Node.js and MySQL', '2024-12-31 23:59:59', 'High', 'Development', 'Pending'),
(1, 'Write Documentation', 'Prepare README for GitHub', '2024-12-25 17:00:00', 'Medium', 'Documentation', 'Pending');
