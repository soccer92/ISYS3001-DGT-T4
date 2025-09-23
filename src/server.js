/* 
ISYS3001 - Managing Software Development A3
-Loads .env (HOST/PORT/DB_PATH)
-Serves stratic UI from /public
-Mounts /api/tasks
*/ 

//import the modules
import 'dotenv/config'; //imports configs 
import express from 'express'; // for a webserver (express)
import {fileURLToPath} from 'url';
import path from 'path'; // handle file paths
import tasksRouter from './routes/tasks.js';

//ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

//Read .env with fall backs
const PORT = parseInt(process.env.PORT || '3030', 10);
const HOST = process.env.HOST || '127.0.0.1';

//body parsers
app.use(express.json());

//Server static files (index,html, app.js, style.css)
app.use(express.static(path.join(__dirname, '../public')));

//API routes
app.use('/api/tasks', tasksRouter);

//Start server
app.listen(PORT, HOST, () => {
  console.log('Local app running at http://${HOST}:${PORT}');
});
