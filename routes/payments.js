import crypto from "crypto";
import express from "express";
import Razorpay from "razorpay";
import { protect } from "../middleware/auth.js";
import Auction from "../models/Auction.js";
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const toPaise = (amount) => Math.round(Number(amount || 0) * 100);

router.post("/razorpay/order/:auctionId", protect, async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res
        .status(500)
        .json({ message: "Razorpay is not configured on the server" });
    }

    const auction = await Auction.findById(req.params.auctionId)
      .populate("highestBidder", "name email")
      .populate("seller", "name email");

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.status !== "ended") {
      return res
        .status(400)
        .json({ message: "Payment is only available after the auction ends" });
    }

    if (
      !auction.highestBidder ||
      auction.highestBidder._id.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Only the winning bidder can pay for this auction" });
    }

    if (auction.paymentStatus === "paid") {
      return res
        .status(400)
        .json({ message: "This auction has already been paid for" });
    }

    const amount = toPaise(auction.currentBid);

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `auction_${auction._id}`,
      notes: {
        auctionId: auction._id.toString(),
        winnerId: req.user._id.toString(),
      },
    });

    auction.paymentStatus = "created";
    auction.paymentOrderId = order.id;
    auction.paymentAmount = amount;
    auction.paymentCurrency = "INR";
    await auction.save();

    res.json({
      order,
      keyId: process.env.RAZORPAY_KEY_ID,
      amount,
      currency: "INR",
      auction: {
        _id: auction._id,
        title: auction.title,
        currentBid: auction.currentBid,
      },
    });
  } catch (error) {
    console.error("Create Razorpay order error:", error);
    res.status(500).json({ message: "Failed to create Razorpay order" });
  }
});

router.post("/razorpay/verify", protect, async (req, res) => {
  try {
    const { auctionId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      req.body;

    if (
      !auctionId ||
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature
    ) {
      return res
        .status(400)
        .json({ message: "Missing payment verification data" });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res
        .status(500)
        .json({ message: "Razorpay is not configured on the server" });
    }

    const auction = await Auction.findById(auctionId)
      .populate("highestBidder", "name email")
      .populate("seller", "name email");

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (
      !auction.highestBidder ||
      auction.highestBidder._id.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Only the winning bidder can verify this payment" });
    }

    if (auction.paymentStatus === "paid") {
      return res.json({ message: "Payment already verified", auction });
    }

    if (auction.paymentOrderId && auction.paymentOrderId !== razorpayOrderId) {
      return res.status(400).json({ message: "Invalid payment order" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      auction.paymentStatus = "failed";
      await auction.save();
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    auction.paymentStatus = "paid";
    auction.paymentId = razorpayPaymentId;
    auction.paymentSignature = razorpaySignature;
    auction.paymentOrderId = razorpayOrderId;
    auction.paidAt = new Date();
    await auction.save();

    if (auction.seller?.email) {
      await sendEmail({
        email: auction.seller.email,
        subject: "Auction payment received",
        message: `<h1>Payment Confirmed</h1>
                  <p>Hi ${auction.seller.name},</p>
                  <p>The winning bidder has completed payment for "<strong>${auction.title}</strong>".</p>
                  <p>Paid amount: <strong>₹${auction.currentBid.toLocaleString()}</strong>.</p>`,
      }).catch(console.error);
    }

    res.json({ message: "Payment verified successfully", auction });
  } catch (error) {
    console.error("Verify Razorpay payment error:", error);
    res.status(500).json({ message: "Failed to verify Razorpay payment" });
  }
});

export default router;
