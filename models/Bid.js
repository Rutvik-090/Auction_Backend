import express from "express";
import mongoose from "mongoose";

const router = express.Router();

const bidSchema = new mongoose.Schema({
  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  bidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  time: { type: Date, default: Date.now },
});


export default mongoose.model('Bid', bidSchema);
