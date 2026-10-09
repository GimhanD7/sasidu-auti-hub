// Persist hashed login tokens with expiration and an account session version. Expired sessions are rejected even before MongoDB removes them.
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  // MongoDB's TTL index eventually removes expired rows; requireAuth also checks expiration on every request.
  expiresAt: { type: Date, required: true, expires: 0 },
  version: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('AuthSession', schema);
