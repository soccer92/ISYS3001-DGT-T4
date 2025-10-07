/* 
ISYS3001 - Managing Software Development A3
-Loads .env (HOST/PORT/DB_PATH)
-Serves stratic UI from /public
-Mounts /api/tasks
*/ 

// Import the modules.
import 'dotenv/config'; //imports configs 
import express from 'express'; // for a webserver (express)
import {fileURLToPath} from 'url';
import path from 'path'; // handle file paths

import tasksRouter from './routes/tasks.js'; // /api/tasks endpoints
import cookieParser from 'cookie-parser';   // Parses Cookie header into req.cookies
import authRouter from './routes/auth.js';  // /api/auth endpoints

// ESM-safe __dirname.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Read .env with fallbacks.
const PORT = Number(process.env.PORT ?? 3030);
const HOST = process.env.HOST ?? 'localhost';

// Body parsers.
app.use(express.json());

// Populate req.cookies so auth middleware can read the token cookie.
app.use(cookieParser());

// Server static files (index,html, app.js, style.css).
app.use(express.static(path.join(__dirname, '../public')));

// API routes.
app.use('/api/tasks', tasksRouter);
app.use('/api/auth', authRouter);

// Start server.
app.listen(PORT, HOST, () => {
  console.log(`Local app running at http://${HOST}:${PORT}`);
});