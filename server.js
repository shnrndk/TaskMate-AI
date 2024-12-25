const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const taskRoutes = require('./routes/taskRoutes');
const path = require('path');

dotenv.config();

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, process.env.WEBAPP_PATH)));

// Catch-all handler for any request not handled by the server API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, process.env.WEBAPP_PATH, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
