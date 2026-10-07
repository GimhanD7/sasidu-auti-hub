import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  registrationNumber: { type: String, required: true, unique: true },
  make: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number },
  fuelType: { type: String },
  mileage: { type: Number },
  vinNumber: { type: String },
  imageUrl: { type: String }
}, { timestamps: true });

export default mongoose.model('Vehicle', vehicleSchema);
