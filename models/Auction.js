import mongoose from "mongoose";

const auctionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, default: "Uncategorized" },
  startingBid: { type: Number, required: true },
  reservePrice: { type: Number, default: 0 },
  currentBid: { type: Number, default: 0 },
  highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  images: [{ type: String }],
  endTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ["active", "ended", "cancelled"],
    default: "active",
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "created", "paid", "failed"],
    default: "pending",
  },
  paymentOrderId: { type: String, default: "" },
  paymentId: { type: String, default: "" },
  paymentSignature: { type: String, default: "" },
  paymentAmount: { type: Number, default: 0 },
  paymentCurrency: { type: String, default: "INR" },
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Auction", auctionSchema);
