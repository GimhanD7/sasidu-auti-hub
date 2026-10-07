import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/vehicles', vehicleRoutes);
// app.use('/api/appointments', appointmentRoutes);
// app.use('/api/jobs', jobRoutes);
// app.use('/api/invoices', invoiceRoutes);

app.get('/', (req, res) => {
  res.send('Vehicle Service & Repair Tracking System API is running...');
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI || 'mongodb+srv://Gimhana:12345678Gd@cluster0.zvuioqx.mongodb.net/?appName=Cluster0')
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
  });


  