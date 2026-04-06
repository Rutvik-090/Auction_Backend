import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";

import { startCronJobs } from "./cron.js";
import adminRoutes from "./routes/admin.js";
import auctionRoutes from "./routes/auctions.js";
import authRoutes from "./routes/auth.js";
import bidRoutes from "./routes/bids.js";
import categoryRoutes from "./routes/categories.js";
import paymentRoutes from "./routes/payments.js";
import uploadRoutes from "./routes/upload.js";

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Start cron daemon
startCronJobs();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io for Real-Time Bidding
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("User connected via Socket.io:", socket.id);

  socket.on("join_auction", (auctionId) => {
    socket.join(auctionId);
    console.log(`User ${socket.id} joined auction ${auctionId}`);
  });

  socket.on("leave_auction", (auctionId) => {
    socket.leave(auctionId);
    console.log(`User ${socket.id} left auction ${auctionId}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Set up io globally for controllers
app.set("io", io);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/auctions", auctionRoutes);
app.use("/api/bids", bidRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/upload", uploadRoutes);

// Basic Route
app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
  );
});
