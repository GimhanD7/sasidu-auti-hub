import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createApp } from './app.js';

dotenv.config();
const PORT = process.env.PORT || 5000;
const app = createApp();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/autoserv')
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(() => {
    console.error('Failed to connect to MongoDB. Check MONGO_URI.');
    process.exitCode = 1;
  });
