import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image uploaded' });
  }

  const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
      const cld_upload_stream = cloudinary.uploader.upload_stream(
        { folder: 'auction_curator' },
        (error, result) => {
          if (error) {
            console.error('Cloudinary Upload Error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      streamifier.createReadStream(buffer).pipe(cld_upload_stream);
    });
  };

  uploadToCloudinary(req.file.buffer)
    .then((result) => {
      res.json({
        message: 'Image uploaded successfully',
        url: result.secure_url,
      });
    })
    .catch((error) => {
      res.status(500).json({ message: 'Error uploading image to Cloudinary' });
    });
});

export default router;
