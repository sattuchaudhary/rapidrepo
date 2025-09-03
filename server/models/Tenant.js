const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tenant name is required'],
    trim: true,
    maxlength: [100, 'Tenant name cannot exceed 100 characters']
  },
  type: {
    type: String,
    required: [true, 'Tenant type is required'],
    enum: ['agency', 'nbfc', 'bank'],
    default: 'agency'
  },
  subscription: {
    plan: {
      type: String,
      enum: ['basic', 'premium', 'enterprise'],
      default: 'basic'
    },
    maxUsers: {
      type: Number,
      default: 10,
      min: [1, 'Max users must be at least 1'],
      max: [1000, 'Max users cannot exceed 1000']
    },
    currentUsers: {
      type: Number,
      default: 0
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    allowUserRegistration: {
      type: Boolean,
      default: true
    },
    requireEmailVerification: {
      type: Boolean,
      default: true
    },
    maxFileSize: {
      type: Number,
      default: 10, // MB
      min: [1, 'Max file size must be at least 1 MB'],
      max: [100, 'Max file size cannot exceed 100 MB']
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  adminUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
tenantSchema.index({ name: 1 });
tenantSchema.index({ type: 1 });
tenantSchema.index({ isActive: 1 });
tenantSchema.index({ 'subscription.plan': 1 });

// Virtual for full tenant name
tenantSchema.virtual('fullName').get(function() {
  return `${this.name} (${this.type.toUpperCase()})`;
});

// Method to check if tenant can add more users
tenantSchema.methods.canAddUser = function() {
  return this.subscription.currentUsers < this.subscription.maxUsers;
};

// Method to get subscription status
tenantSchema.methods.getSubscriptionStatus = function() {
  if (!this.subscription.endDate) return 'active';
  
  const now = new Date();
  if (now > this.subscription.endDate) return 'expired';
  if (now > new Date(this.subscription.endDate.getTime() - 7 * 24 * 60 * 60 * 1000)) return 'expiring_soon';
  return 'active';
};

// Pre-save middleware
tenantSchema.pre('save', function(next) {
  // Ensure current users don't exceed max users
  if (this.subscription.currentUsers > this.subscription.maxUsers) {
    this.subscription.currentUsers = this.subscription.maxUsers;
  }
  next();
});

module.exports = mongoose.model('Tenant', tenantSchema);
