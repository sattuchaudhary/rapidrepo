const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  mobileUserId: { type: String, required: true, index: true }, // repo agent id or staff id from token
  userType: { type: String, enum: ['repo_agent', 'office_staff', 'other'], default: 'repo_agent' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  lastPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }
}, { timestamps: true });

userSubscriptionSchema.index({ tenantId: 1, mobileUserId: 1 }, { unique: true });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);


