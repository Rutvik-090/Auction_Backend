import express from "express";
import jwt from "jsonwebtoken";
import { protect } from "../middleware/auth.js";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import User from "../models/User.js";

const router = express.Router();

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// @route   POST /api/auth/register
// @access  Public
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, avatar } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      name,
      email,
      password,
      avatar: avatar || "",
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
});

// @route   POST /api/auth/login
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/auth/profile
// @access  Private
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// @route   PUT /api/auth/profile
// @access  Private
router.put("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      if (req.body.avatar) user.avatar = req.body.avatar;

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        role: updatedUser.role,
        token: generateToken(updatedUser._id),
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/auth/dashboard
// @access  Private
router.get("/dashboard", protect, async (req, res) => {
  try {
    const [
      bidsPlaced,
      wonAuctions,
      sellerAuctions,
      activeListings,
      soldListings,
    ] = await Promise.all([
      Bid.countDocuments({ bidder: req.user._id }),
      Auction.find({ highestBidder: req.user._id, status: "ended" })
        .populate("seller", "name email")
        .sort({ paidAt: -1, createdAt: -1 })
        .limit(5),
      Auction.find({ seller: req.user._id })
        .populate("highestBidder", "name")
        .sort({ createdAt: -1 })
        .limit(5),
      Auction.countDocuments({ seller: req.user._id, status: "active" }),
      Auction.countDocuments({ seller: req.user._id, status: "ended" }),
    ]);

    const recentBids = await Bid.find({ bidder: req.user._id })
      .populate({
        path: "auction",
        select: "title currentBid startingBid status endTime images",
      })
      .sort({ time: -1 })
      .limit(5);

    const totalSpentAgg = await Bid.aggregate([
      { $match: { bidder: req.user._id } },
      { $group: { _id: null, totalSpent: { $sum: "$amount" } } },
    ]);

    const totalRevenueAgg = await Auction.aggregate([
      {
        $match: {
          seller: req.user._id,
          status: "ended",
          currentBid: { $gt: 0 },
        },
      },
      { $group: { _id: null, totalRevenue: { $sum: "$currentBid" } } },
    ]);

    const winningBidIds = wonAuctions.map((auction) => auction._id.toString());

    res.json({
      profile: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        role: req.user.role,
      },
      buyer: {
        bidsPlaced,
        wonAuctions: wonAuctions.length,
        totalSpent: totalSpentAgg.length > 0 ? totalSpentAgg[0].totalSpent : 0,
        recentBids,
        recentWins: wonAuctions,
        winningBidIds,
      },
      seller: {
        activeListings,
        soldListings,
        totalRevenue:
          totalRevenueAgg.length > 0 ? totalRevenueAgg[0].totalRevenue : 0,
        recentListings: sellerAuctions,
      },
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
