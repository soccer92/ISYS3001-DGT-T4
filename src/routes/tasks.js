/*
 * Express router for /api/tasks
 * Delegates DB work to the model layer in taskModel.js
 */

import { Router } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import {
  createTask,
  listTasks,
  listTasksOnDate,
  getTask,
  updateTask,
  deleteTask,
  deleteSeriesByTaskId
} from '../models/taskModel.js';
import { requireAuth } from '../middleware/auth.js';

import { sendEmail, sendDailySummary } from '../emailService.js';

import PDFDocument from 'pdfkit'; // PDF export.
import { stringify } from 'csv-stringify/sync'; // CSV export.
import { getDb } from '../db/db.js';

const router = Router();

/*
// TEMP: dev-user for local dev.
router.use((req, res, next) => {
  if (!req.user) {
    req.user = { id: 'dev-user' };
  }
  next();
});
*/

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
  body('due_at').optional().isISO8601(), // Store ISO date (frontend can send 'YYYY-MM-DD').
  body('recur').optional({ nullable: true }).isIn(['daily', 'weekly', 'monthly']),
  body('recur_until').optional({ nullable: true }).isISO8601(),
  (req, res, next) => {
    if (req.body?.recur && !req.body?.due_at) {
      return res.status(400).json({ message: 'due_at is required when recur is set' });
    }
    next();
  },
  (req, res) => {
    const v = check(req, res);
    if (v) return v;

    const task = createTask({ ...req.body, user_id: req.user.id });

    // Send email notification.
    sendEmail(
      req.body.userEmail || process.env.GMAIL_USER, // fallback
      'New Task Created',
      `Your new task "${task.title}" has been created with priority ${task.priority ?? 'none'}.`
    );

    res.status(201).json(task);
  }
);

// GET /api/tasks (filters) + /api/tasks?on=YYYY-MM-DD (due-on-day).
router.get(
  '/',
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  query('status').optional().isIn(['todo', 'in_progress', 'done']),
  query('priority').optional().isIn(['low', 'medium', 'high']),
  query('q').optional().isString().trim().isLength({ min: 1, max: 200 }),
  query('on').optional().isISO8601(),
  (req, res) => {
    const v = check(req, res);
    if (v) return v;

    const { limit = 20, offset = 0, status, priority, q, on } = req.query;

    if (on) {
      const data = listTasksOnDate(req.user.id, on, { limit, offset });
      return res.json(data);
    }

    const data = listTasks({ limit, offset, status, priority, q, userId: req.user.id });
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
  body('due_at').optional().isISO8601(), // Store ISO date (frontend can send 'YYYY-MM-DD').
  body('recur').optional({ nullable: true }).isIn(['daily', 'weekly', 'monthly']),
  body('recur_until').optional().isISO8601(),
  (req, res, next) => {
    if (req.body?.recur && !req.body?.due_at) {
      return res.status(400).json({ message: 'due_at is required when recur is set' });
    }
    next();
  },
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

// DELETE /api/tasks/:id/series -> deletes the entire series of that task (optionally only future).
router.delete(
  '/:id/series',
  param('id').isString().isLength({ min: 8, max: 128 }),
  query('futureOnly').optional().isBoolean().toBoolean(),
  (req, res) => {
    const v = check(req, res);
    if (v) return v;

    const deleted = deleteSeriesByTaskId(req.params.id, req.user.id, { onlyFuture: !!req.query.futureOnly });
    if (!deleted) return res.status(404).json({ message: 'Not found or not a series' });
    res.status(200).json({ deleted });
  }
);

// POST /api/tasks/email-summary -> sends the user an email summary of their overdue and upcoming tasks.
router.post('/email-summary', requireAuth, async (req, res) => {
  try {
    const result = await sendDailySummary(req.user.id);
    res.json({ success: true, message: 'Task summary email sent successfully!', sent: result.sent });
  } catch (err) {
    console.error('Error sending email summary:', err);
    res.status(500).json({ success: false, message: 'Failed to send email summary' });
  }
});

// GET /api/tasks/export/csv -> exports tasks as CSV.
router.get('/export/csv', requireAuth, async (req, res) => {
  const db = getDb();
  const exportTasks = db
    .prepare(
      'SELECT id, title, description, status, priority, due_at, recur, recur_until, created_at, updated_at FROM tasks WHERE user_id = ?'
    )
    .all(req.user.id);

  const csv = stringify(exportTasks, {
    header: true,
    columns: {
      id: 'ID',
      title: 'Title',
      description: 'Description',
      status: 'Status',
      priority: 'Priority',
      due_at: 'Due At',
      recur: 'Recur',
      recur_until: 'Recur Until',
      created_at: 'Created At',
      updated_at: 'Updated At'
    }
  });

  res.setHeader('Content-Disposition', 'attachment; filename="tasks.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

// GET /api/tasks/export/pdf -> exports tasks as PDF.
router.get('/export/pdf', requireAuth, async (req, res) => {
  const db = getDb();
  const exportTasks = db
    .prepare(
      'SELECT id, title, description, status, priority, due_at, recur, recur_until, created_at, updated_at FROM tasks WHERE user_id = ?'
    )
    .all(req.user.id);

  const documentPDF = new PDFDocument();
  const filename = 'tasksExport.pdf';
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/pdf');

  documentPDF.pipe(res);
  documentPDF.fontSize(18).text('Task Export', { align: 'center' });
  documentPDF.moveDown();

  exportTasks.forEach((task, index) => {
    documentPDF.fontSize(12).text(`ID: ${task.id}`);
    documentPDF.text(`Title: ${task.title}`);
    documentPDF.text(`Description: ${task.description}`);
    documentPDF.text(`Status: ${task.status}`);
    documentPDF.text(`Priority: ${task.priority}`);
    documentPDF.text(`Due At: ${task.due_at ? new Date(task.due_at).toLocaleDateString() : 'N/A'}`);
    documentPDF.text(`Recur: ${task.recur || 'N/A'}`);
    documentPDF.text(`Recur Until: ${task.recur_until ? new Date(task.recur_until).toLocaleDateString() : 'N/A'}`);
    documentPDF.text(`Created At: ${new Date(task.created_at).toLocaleString()}`);
    documentPDF.text(`Updated At: ${new Date(task.updated_at).toLocaleString()}`);
    if (index < exportTasks.length - 1) {
      documentPDF.moveDown();
      documentPDF.moveDown();
    }
  });
  documentPDF.end();
});

export default router;