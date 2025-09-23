/*
Express router for /api/tasks
Delegates DB work to the model layer in taskModel.js
*/

import express from 'express';
import {body, query, param, validationResult} from 'express-validator';
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask
} from '../models/taskModel.js';

const router = express.Router();

//return 400 with validation message when needed
function check(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({errors: errors.array()});
}

//POST /api/tasks (create)
router.post('/',
      //Validates what is required
      body('title').isString().trim().isLength({min:1, max:200}),
      body('status').optional().isIn(['todo','in_progress','done']),
      body('priority').optional().isIn(['low','medium','high']),
      (req, res) => {
        const v = check(req, res); if (v) return v;
        const task = createTask(req.body);
        res.status(201).json(task);
      }
);

//GET /api/tasks (list with filters)
router.get('/',
           query('limit').optional().isInt({min:1, max:100}),
           query('offset').optional().isInt({min:0}),
           query('status').optional().isIn(['todo','in_progress','done']),
           query('priority').optional().isIn(['low','medium','high']),
           (req, res) => {
             const v = check(req, res); if (v) return v;

             //Filters
             const {limit, offset, status, priority, q} = req.query;
             const data = listTasks({
               limit: limit ? parseInt(limit, 10) : 20,
               offset: offset ? parseInt(offset, 10) : 0,
               status, priority, q
             });

             res.json(data);
           }
);

//GET /api/tasks/:id (read single)
router.get('/:id',
           param('id').isString(),
           (req, res) => {
             const v = check(req, res); if (v) return v;

             const task = getTask(req.params.id);
             if (!task) return res.status(404).json({message: 'Not found'});
             res.json(task);
           }
);

//PATCH /api/tasks/:id (update)
router.patch('/:id',
             param('id').isString(),
             (rq, res) => {
               const task = updateTask(req.params.id, req.body);
               if (!task) return res.status(404).json({message: 'Not found'});
               res.json(task);
             }
);

//DELETE /api/tasks/:id (delete)
router.delete('/:id',
              param('id').isString(),
              (req, res) => {
                const ok = deleteTask(req.params.id);
                if (!ok) return res.status(404).json({message: 'Not found'});
                res.status(204).send();
              }
);

export default router;
