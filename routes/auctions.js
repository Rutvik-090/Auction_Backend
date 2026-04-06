import express from "express";
import { protect } from "../middleware/auth.js";
import Auction from "../models/Auction.js";
import User from "../models/User.js";
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();

// @route   GET /api/auctions
// @access  Public
router.get("/", async (req, res) => {
  try {
    const auctions = await Auction.find({})
      .populate("seller", "name email")
      .populate("highestBidder", "name");
    res.json(auctions);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

// @route   GET /api/auctions/:id
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate("seller", "name email")
      .populate("highestBidder", "name");

    if (auction) {
      res.json(auction);
    } else {
      res.status(404).json({ message: "Auction not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

// @route   POST /api/auctions
// @access  Private (Sellers/Users)
router.post("/", protect, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      startingBid,
      reservePrice,
      images,
      endTime,
    } = req.body;

    const auction = new Auction({
      title,
      description,
      category,
      startingBid,
      reservePrice: reservePrice || 0,
      currentBid: startingBid,
      images: images || [],
      endTime,
      seller: req.user._id,
    });

    const createdAuction = await auction.save();

    // Broadcast email to all users (Fire and Forget)
    User.find({})
      .select("email name")
      .then((users) => {
        users.forEach((u) => {
          if (u.email) {
            sendEmail({
              email: u.email,
              subject: "New Auction Available!",
              message: `<h1>New Masterpiece listed!</h1>
                      <p>Hi ${u.name},</p>
                      <p>A new curated item "<strong>${createdAuction.title}</strong>" is now live.</p>
                      <p>Starting at ₹${createdAuction.startingBid}.</p>
                      <p><a href="http://localhost:5173/auction/${createdAuction._id}">View it now!</a></p>`,
            }).catch(console.error);
          }
        });
      })
      .catch(console.error);

    res.status(201).json(createdAuction);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

export default router;
