// Utility formatting helpers

export const maskPhoneNumber = (input) => {
  const digitsOnly = String(input || '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  const lastFour = digitsOnly.slice(-4);
  const maskCount = Math.max(0, Math.min(6, digitsOnly.length - 4));
  const masked = '*'.repeat(maskCount);
  return masked + lastFour;
};

export default {
  maskPhoneNumber,
};


