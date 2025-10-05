const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');

// User submits a payment proof (repo agent / office staff / admin)
const submitPayment = async (req, res) => {
  try {
    const { planPeriod, amount, transactionId, notes } = req.body;
    const tenantId = req.user?.tenantId || req.body.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'tenantId required' });
    }

    if (!['weekly', 'monthly', 'quarterly', 'yearly'].includes(planPeriod)) {
      return res.status(400).json({ success: false, message: 'Invalid planPeriod' });
    }

    const payment = await Payment.create({
      tenantId,
      submittedByUserId: req.user?.userId || req.user?._id || undefined,
      submittedByMobileId: req.user?.agentId || req.user?.staffId || undefined,
      planPeriod,
      amount,
      transactionId,
      notes,
      status: 'pending'
    });

    return res.json({ success: true, message: 'Payment submitted', data: payment });
  } catch (err) {
    console.error('submitPayment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin: list pending payments for tenant(s)
const listPayments = async (req, res) => {
  try {
    const { status = 'pending', tenantId } = req.query;
    const query = {};
    if (status) query.status = status;
    if (tenantId) query.tenantId = tenantId;
    const items = await Payment.find(query).sort({ createdAt: -1 }).limit(200);
    return res.json({ success: true, data: items });
  } catch (err) {
    console.error('listPayments error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin approves payment: extend tenant subscription
const approvePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Payment already processed' });
    }

    const tenant = await Tenant.findById(payment.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const now = new Date();
    const currentEnd = tenant.subscription?.endDate ? new Date(tenant.subscription.endDate) : now;
    const base = currentEnd > now ? currentEnd : now;

    const periodDaysMap = {
      weekly: 7,
      monthly: 30,
      quarterly: 90,
      yearly: 365
    };
    const daysToAdd = periodDaysMap[payment.planPeriod] || 30;

    const newEnd = new Date(base);
    newEnd.setDate(newEnd.getDate() + daysToAdd);

    tenant.subscription = {
      ...tenant.subscription,
      startDate: tenant.subscription?.startDate || now,
      endDate: newEnd
    };
    await tenant.save();

    payment.status = 'approved';
    payment.approvedBy = req.user?._id || req.user?.userId;
    payment.approvedAt = new Date();
    payment.effectiveStart = base;
    payment.effectiveEnd = newEnd;
    await payment.save();

    return res.json({ success: true, message: 'Payment approved and subscription extended', data: { payment, tenant } });
  } catch (err) {
    console.error('approvePayment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin rejects payment
const rejectPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Payment already processed' });
    }
    payment.status = 'rejected';
    payment.approvedBy = req.user?._id || req.user?.userId;
    payment.approvedAt = new Date();
    await payment.save();
    return res.json({ success: true, message: 'Payment rejected', data: payment });
  } catch (err) {
    console.error('rejectPayment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  submitPayment,
  listPayments,
  approvePayment,
  rejectPayment
};


