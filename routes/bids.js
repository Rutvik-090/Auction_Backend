
import express from "express";
import { protect } from '../middleware/auth.js';
import Auction from '../models/Auction.js';
import Bid from '../models/Bid.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// @route   POST /api/bids/:auctionId
// @access  Private
router.post('/:auctionId', protect, async (req, res) => {
  try {
    const { amount } = req.body;
    const auctionId = req.params.auctionId;

    const auction = await Auction.findById(auctionId);

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    if (auction.status !== 'active') {
      return res.status(400).json({ message: 'Auction is not active' });
    }

    if (new Date(auction.endTime) < new Date()) {
      auction.status = 'ended';
      await auction.save();
      return res.status(400).json({ message: 'Auction has already ended' });
    }

    if (amount <= auction.currentBid) {
      return res.status(400).json({ message: 'Bid must be higher than current bid' });
    }

    // Determine outbid user for notification
    const previousHighestBidder = auction.highestBidder;

    // Save bid
    const bid = new Bid({
      auction: auctionId,
      bidder: req.user._id,
      amount,
    });
    await bid.save();

    // Update auction
    auction.currentBid = amount;
    auction.highestBidder = req.user._id;
    await auction.save();

    // Notify previous highest bidder if it's someone else
    if (previousHighestBidder && previousHighestBidder.toString() !== req.user._id.toString()) {
      await Notification.create({
        user: previousHighestBidder,
        message: `You have been outbid on "${auction.title}". The new bid is $${amount}.`,
        link: `/auction/${auction._id}`
      });
      // Optionally emit via Socket.io here...
    }

    // Emit live bid update via Socket.io
    const io = req.app.get('io');
    io.to(auctionId).emit('new_bid', { auctionId, amount, bidder: req.user.name });

    res.status(201).json(bid);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});


export default router;
