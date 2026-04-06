import express from 'express';
import { protect, admin } from '../middleware/auth.js';
import User from '../models/User.js';
import Auction from '../models/Auction.js';
import Bid from '../models/Bid.js';

const router = express.Router();

// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', protect, admin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
router.delete('/users/:id', protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      if (user.role === 'admin') {
        return res.status(400).json({ message: 'Cannot delete an admin user' });
      }
      await user.deleteOne();
      res.json({ message: 'User removed successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   DELETE /api/admin/auctions/:id
// @access  Private/Admin
router.delete('/auctions/:id', protect, admin, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (auction) {
      await auction.deleteOne();
      
      // Also delete associated bids
      await Bid.deleteMany({ auction: req.params.id });
      
      res.json({ message: 'Auction and related bids removed successfully' });
    } else {
      res.status(404).json({ message: 'Auction not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/admin/bids
// @access  Private/Admin
router.get('/bids', protect, admin, async (req, res) => {
  try {
    const bids = await Bid.find({})
        .populate('auction', 'title _id')
        .populate('bidder', 'name email _id')
        .sort({ time: -1 })
        .limit(100); // For monitoring the most recent 100 bids
    res.json(bids);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/admin/reports
// @access  Private/Admin
router.get('/reports', protect, admin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAuctions = await Auction.countDocuments();
    const activeAuctions = await Auction.countDocuments({ status: 'active' });
    const endedAuctions = await Auction.countDocuments({ status: 'ended' });
    const totalBidsCount = await Bid.countDocuments();

    // Summing revenue (bids placed on ended auctions natively)
    const revenueAgg = await Auction.aggregate([
       { $match: { status: 'ended', currentBid: { $gt: 0 } } },
       { $group: { _id: null, totalRevenue: { $sum: "$currentBid" } } }
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;

    res.json({
       totalUsers,
       totalAuctions,
       activeAuctions,
       endedAuctions,
       totalBidsCount,
       totalRevenue
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
