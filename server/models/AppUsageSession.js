const mongoose = require('mongoose');

const appUsageSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  deviceId: { type: String, trim: true },
  platform: { type: String, enum: ['web', 'mobile', 'other'], default: 'other' },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  durationMs: { type: Number },
  metadata: { type: Object },
}, { timestamps: true });

appUsageSessionSchema.index({ tenantId: 1, createdAt: -1 });
appUsageSessionSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

module.exports = (connection) => connection.model('AppUsageSession', appUsageSessionSchema);



