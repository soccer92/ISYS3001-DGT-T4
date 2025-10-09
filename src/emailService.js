import nodemailer from 'nodemailer';
import dayjs from 'dayjs';
import { getDb } from './db/db.js';

// get database
const db = getDb();

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER, // username
        pass: process.env.GMAIL_PASS // app password
    }
});

// helper function
export async function sendEmail(to, subject, text) {
    try {
        let info = await transporter.sendMail({
            from: `"TaskFlow Notifications (No Reply)" <${process.env.GMAIL_USER}>`,
            // from: `"TaskFlow Notifications" <no-reply@taskflow.com>`,
            to,
            subject,
            text,
            replyTo: "no-reply@taskflow.com", // ignored unless you own the domain
        });

        console.log("Email sent: " + info.response);
    } catch (err) {
        console.error("Error sending email:", err);
    }
}

// daily task summary function (run via cron, e.g. 8am daily)
export async function sendDailySummary() {

    // get current date and 24hrs later
    const today = dayjs();
    const tomorrow = today.add(1, 'day');

    // fetch overdue tasks with SQLite & store in an array - overdueTasks
    const overdueTasks = db.prepare(`
    SELECT t.title, t.due_at, u.email
    FROM tasks t
    JOIN users u ON t.user_id = u.id
    WHERE t.due_at < ? AND t.status != 'done'
    `).all(today.toISOString()); // format as ISO string, e.g. '2019-01-25T02:00:00.000Z'

    // fetch upcoming tasks (due within next 24 hrs) & store in an array - upcomingTasks
    const upcomingTasks = db.prepare(`
    SELECT t.title, t.due_at, u.email
    FROM tasks t
    JOIN users u ON t.user_id = u.id
    WHERE t.due_at BETWEEN ? AND ? AND t.status != 'done'
    `).all(today.toISOString(), tomorrow.toISOString()); // between now and 24hrs

    // create a map to group tasks by user
    const tasksByUser = new Map(); // { email: { overdue: [], upcoming: [] } }

    // loop through and group overdue tasks for each user
    for (const t of overdueTasks) {
        if (!tasksByUser.has(t.email)) {
            tasksByUser.set(t.email, { overdue: [], upcoming: [] }); // creates a new entry if not exists
        }
        tasksByUser.get(t.email).overdue.push(t); // adds task to the user's overdue list
    }

    // loop through and group upcoming tasks for each user
    for (const t of upcomingTasks) {
        if (!tasksByUser.has(t.email)) {
            tasksByUser.set(t.email, { overdue: [], upcoming: [] }); // creates a new entry if not exists
        }
        tasksByUser.get(t.email).upcoming.push(t); // adds task to the user's upcoming list
    }

    // if no tasks, skip sending emails
    if (tasksByUser.size == 0) {
        console.log('No overdue or upcoming tasks. No emails sent.');
        return;
    }

    // loop through the map and send emails
    for (const [email, userTasks] of tasksByUser.entries()) {
        
        const overdueList = userTasks.overdue.length
            ? userTasks.overdue.map(t => `• ${t.title} (due ${t.due_at})`).join('\n')
            : 'None 🎉';

        const upcomingList = userTasks.upcoming.length
            ? userTasks.upcoming.map(t => `• ${t.title} (due ${t.due_at})`).join('\n')
            : 'None';

        const message = `
        Hi there 👋,

        Here's your daily TaskFlow summary:

        ⏰ **Overdue Tasks:**
        ${overdueList}

        📅 **Upcoming Tasks (Next 24h):**
        ${upcomingList}

        Keep up the good work!
        - The TaskFlow Team
        `;

        await sendEmail(email, '📬 Your TaskFlow Daily Summary', message);
    }

    console.log('Daily summary emails sent!');
}