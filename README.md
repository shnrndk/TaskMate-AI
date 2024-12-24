# TaskMate-AI

### Log in as the root user
mysql -u root -p

### Create a new database:
CREATE DATABASE productivity_db;

### Create a new user for your app with permissions:
CREATE USER 'appuser'@'localhost' IDENTIFIED BY 'securepassword';
GRANT ALL PRIVILEGES ON productivity_db.* TO 'appuser'@'localhost';
FLUSH PRIVILEGES;

### Run the SQL Script
mysql -u appuser -p productivity_db < sql/schema.sql