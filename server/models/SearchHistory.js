const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  query: { type: String, trim: true },
  vehicleId: { type: String, required: true },
  vehicleType: { type: String, enum: ['two_wheeler', 'four_wheeler', 'cv', 'other'], default: 'other' },
  metadata: { type: Object },
}, { timestamps: true });

searchHistorySchema.index({ tenantId: 1, createdAt: -1 });
searchHistorySchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

module.exports = (connection) => connection.model('SearchHistory', searchHistorySchema);



