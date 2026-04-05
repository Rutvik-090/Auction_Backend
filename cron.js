import cron from 'node-cron';
import Auction from './models/Auction.js';
import User from './models/User.js';
import sendEmail from './utils/sendEmail.js';

export const startCronJobs = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      
      // Find all active auctions that have ended
      const endedAuctions = await Auction.find({
        status: 'active',
        endTime: { $lt: now }
      }).populate('highestBidder', 'name email');

      if (endedAuctions.length === 0) return;

      console.log(`Cron: Found ${endedAuctions.length} newly ended auctions. Processing...`);

      for (const auction of endedAuctions) {
        // Mark as ended
        auction.status = 'ended';
        await auction.save();

        // Notify winner
        if (auction.highestBidder && auction.highestBidder.email) {
            await sendEmail({
                email: auction.highestBidder.email,
                subject: 'You won the auction!',
                message: `<h1>Congratulations!</h1>
                          <p>Hi ${auction.highestBidder.name},</p>
                          <p>You are the winning bidder for "<strong>${auction.title}</strong>".</p>
                          <p>Your winning bid amount is <strong>$${auction.currentBid}</strong>.</p>
                          <p><a href="http://localhost:5173/auction/${auction._id}">Claim your item now!</a></p>`
            }).catch(err => console.error('Cron Win Email Error: ', err));
        }

        // We can also notify the seller here if desired
      }
    } catch (err) {
      console.error('Error running cron job: ', err);
    }
  });

  console.log('Cron jobs started (Running every minute).');
};
