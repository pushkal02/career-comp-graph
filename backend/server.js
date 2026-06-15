import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import configurations and routes
import { verifyToken } from './middleware/auth.js';
import { signup, login, getProfile, updateSettings } from './controllers/authController.js';
import {
  getEvents,
  syncEvents,
  createSalaryEvent,
  updateSalaryEvent,
  deleteSalaryEvent,
  createCompEvent,
  updateCompEvent,
  deleteCompEvent
} from './controllers/eventController.js';

// Load environmental variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware configuration
app.use(cors());
app.use(express.json());

// API Authentication Routes
app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);
app.get('/api/auth/profile', verifyToken, getProfile);
app.put('/api/auth/settings', verifyToken, updateSettings);

// API Event Routes
app.get('/api/events', verifyToken, getEvents);
app.post('/api/events/sync', verifyToken, syncEvents);

app.post('/api/events/salary', verifyToken, createSalaryEvent);
app.put('/api/events/salary/:id', verifyToken, updateSalaryEvent);
app.delete('/api/events/salary/:id', verifyToken, deleteSalaryEvent);

app.post('/api/events/comp', verifyToken, createCompEvent);
app.put('/api/events/comp/:id', verifyToken, updateCompEvent);
app.delete('/api/events/comp/:id', verifyToken, deleteCompEvent);

// Serve Static Production Build Files
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

app.get(/.*/, (req, res) => {
  // Exclude API calls from wildcard redirect
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found.' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start listening
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
