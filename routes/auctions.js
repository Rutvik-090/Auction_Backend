import express from 'express';
import { protect } from '../middleware/auth.js';
import Auction from '../models/Auction.js';

const router = express.Router();

// @route   GET /api/auctions
// @access  Public
router.get('/', async (req, res) => {
  try {
    const auctions = await Auction.find({}).populate('seller', 'name email').populate('highestBidder', 'name');
    res.json(auctions);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/auctions/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('seller', 'name email')
      .populate('highestBidder', 'name');

    if (auction) {
      res.json(auction);
    } else {
      res.status(404).json({ message: 'Auction not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   POST /api/auctions
// @access  Private (Sellers/Users)
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, startingBid, reservePrice, images, endTime } = req.body;

    const auction = new Auction({
      title,
      description,
      startingBid,
      reservePrice: reservePrice || 0,
      currentBid: startingBid,
      images: images || [],
      endTime,
      seller: req.user._id,
    });

    const createdAuction = await auction.save();
    res.status(201).json(createdAuction);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router
