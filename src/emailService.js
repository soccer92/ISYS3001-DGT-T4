import nodemailer from 'nodemailer';

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
    //   from: `"TaskFlow Notifications" <no-reply@taskflow.com>`,
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