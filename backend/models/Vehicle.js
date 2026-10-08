import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  registrationNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
  make: { type: String, required: true, trim: true, maxlength: 80 },
  model: { type: String, required: true, trim: true, maxlength: 80 },
  year: { type: Number, min: 1886 },
  fuelType: { type: String, trim: true, maxlength: 50 },
  mileage: { type: Number, min: 0 },
  vinNumber: { type: String, trim: true, uppercase: true, maxlength: 32 },
  imageUrl: { type: String, trim: true, maxlength: 1398136 }
}, { timestamps: true });

export default mongoose.model('Vehicle', vehicleSchema);
