import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import streamifier from "streamifier";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  // Cloudinary Config
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const upload = multer();

  // API Route for image uploads
  app.post("/api/upload", upload.single("image"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      console.warn("Cloudinary not configured. Returning base64 data URL of the uploaded image.");
      const base64Image = req.file.buffer.toString("base64");
      const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;
      return res.json({ url: dataUrl });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "lostlink" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary error:", error);
          return res.status(500).json({ error: "Upload failed" });
        }
        res.json({ url: result?.secure_url });
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  });

  // API Route for sending email notifications
  app.post("/api/send-notification", async (req, res) => {
    const { to, subject, html, itemName, type, reporterName, claimerName } = req.body;

    if (!resend) {
      console.warn("RESEND_API_KEY is not set. Email notification skipped.");
      return res.status(200).json({ success: true, message: "Email skipped (no API key)" });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: "LostLink <notifications@lostlink.students>",
        to: [to],
        subject: subject || `Notification for your item: ${itemName}`,
        html: html || `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #6b705c;">LostLink Update</h2>
            <p>Hi ${reporterName},</p>
            <p>Great news! Your item "<strong>${itemName}</strong>" has been ${type === 'lost' ? 'found' : 'claimed'} by <strong>${claimerName}</strong>.</p>
            <p>Please check the app to coordinate the return.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999;">This is an automated notification from LostLink.</p>
          </div>
        `,
      });

      if (error) {
        console.error("Resend error:", error);
        return res.status(500).json({ error: error.message });
      }

      res.json({ success: true, data });
    } catch (err) {
      console.error("Failed to send email:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Serve static files if build directory exists, otherwise run Vite in development mode
  const distPath = path.join(process.cwd(), "dist");
  const isProduction = process.env.NODE_ENV === "production" || (process.env.NODE_ENV !== "development" && fs.existsSync(distPath));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
