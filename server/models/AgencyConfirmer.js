const mongoose = require('mongoose');

const agencyConfirmerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{10}$/.test(v);
      },
      message: 'Phone number must be exactly 10 digits'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, {
  timestamps: true
});

// Index for better query performance
agencyConfirmerSchema.index({ name: 1 });
agencyConfirmerSchema.index({ phoneNumber: 1 });
agencyConfirmerSchema.index({ isActive: 1 });

module.exports = agencyConfirmerSchema;
