/*
Express router for /api/tasks
Delegates DB work to the model layer in taskModel.js
*/

import { Router } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask
} from '../models/taskModel.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Return 400 with validation message when needed.
function check(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
}

// requireAuth sets req.user = { id, email } if valid.
router.use(requireAuth);

// POST /api/tasks (create).
router.post(
  '/',
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
  body('status').optional().isIn(['todo', 'in_progress', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('due_at').optional().isISO8601(),
  (req, res) => {
    const v = check(req, res);
    if (v) return v;

    const task = createTask({ ...req.body, user_id: req.user.id });
    res.status(201).json(task);
  }
);

// GET /api/tasks (list with filters).
router.get(
  '/',
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  query('status').optional().isIn(['todo', 'in_progress', 'done']),
  query('priority').optional().isIn(['low', 'medium', 'high']),
  query('q').optional().isString().trim().isLength({ min: 1, max: 200 }),
  (req, res) => {
    const v = check(req, res);
    if (v) return v;

    // Filters.
    const { limit = 20, offset = 0, status, priority, q } = req.query;
    const data = listTasks({ limit, offset, status, priority, q, userId: req.user.id });

    // Normalize shape of array.
    const normalized = Array.isArray(data)
      ? { total: data.length, limit, offset, items: data }
      : data;

    res.json(normalized);
  }
);

// GET /api/tasks/:id (read single).
router.get(
  '/:id',
  param('id').isString().trim().isLength({ min: 8, max: 128 }),
  (req, res) => {
    const v = check(req, res);
    if (v) return v;

    const task = getTask(req.params.id, req.user.id);
    if (!task) return res.status(404).json({ message: 'Not found' });
    res.json(task);
  }
);

// PATCH /api/tasks/:id (update).
router.patch(
  '/:id',
  param('id').isString().trim().isLength({ min: 8, max: 128 }),
  body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('status').optional().isIn(['todo', 'in_progress', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  (req, res) => {
    const v = check(req, res);
    if (v) return v;

    const task = updateTask(req.params.id, req.body || {}, req.user.id);
    if (!task) return res.status(404).json({ message: 'Not found' });
    res.json(task);
  }
);

// DELETE /api/tasks/:id (delete).
router.delete(
  '/:id',
  param('id').isString().trim().isLength({ min: 8, max: 128 }),
  (req, res) => {
    const v = check(req, res);
    if (v) return v;

    const ok = deleteTask(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ message: 'Not found' });
    res.status(204).send();
  }
);

export default router;