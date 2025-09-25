const mongoose = require('mongoose');

const shareHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  vehicleId: { type: String, required: true },
  vehicleType: { type: String, enum: ['two_wheeler', 'four_wheeler', 'cv', 'other'], default: 'other' },
  channel: { type: String, enum: ['whatsapp', 'sms', 'email', 'other'], default: 'whatsapp' },
  recipient: { type: String, trim: true },
  payloadPreview: { type: String, maxlength: 1000 },
  metadata: { type: Object },
}, { timestamps: true });

shareHistorySchema.index({ tenantId: 1, createdAt: -1 });
shareHistorySchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

module.exports = (connection) => connection.model('ShareHistory', shareHistorySchema);



