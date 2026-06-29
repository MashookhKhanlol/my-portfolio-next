import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";

type Data = {
    message: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Data>
) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const {
        name,
        email,
        message,
    }: { name: string; email: string; message: string } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ message: "All fields are required." });
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    const mailOptions = {
        from: `"Portfolio Contact" <${process.env.GMAIL_USER}>`,
        to: "mashookhkhan7862@gmail.com",
        replyTo: email,
        subject: `${name.toUpperCase()} sent you a message from Portfolio`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #7c3aed;">New Portfolio Contact Message</h2>
                <hr style="border-color: #7c3aed;" />
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                <p><strong>Message:</strong></p>
                <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-top: 8px;">
                    ${message.replace(/\n/g, "<br>")}
                </div>
                <hr style="border-color: #e5e7eb; margin-top: 24px;" />
                <p style="color: #9ca3af; font-size: 12px;">Sent from your portfolio contact form</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "Your message was sent successfully." });
    } catch (err) {
        console.error("Mail error:", err);
        res.status(500).json({ message: "There was an error sending your message. Please try again." });
    }
}