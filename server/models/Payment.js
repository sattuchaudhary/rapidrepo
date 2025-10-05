const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    submittedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedByMobileId: { type: String }, // repo agent or staff id from token when not in main User collection
    planPeriod: { type: String, enum: ['weekly', 'monthly', 'quarterly', 'yearly'], required: true },
    amount: { type: Number, required: true, min: 0 },
    transactionId: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    effectiveStart: { type: Date },
    effectiveEnd: { type: Date }
  },
  { timestamps: true }
);

paymentSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);


