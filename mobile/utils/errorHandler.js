// Error handling utilities for mobile app

export const handleProgressError = (error, context = 'Progress') => {
  console.error(`${context} Error:`, error);
  
  // Return safe default progress
  return {
    processed: 0,
    total: 0,
    percentage: 0,
    error: error.message || 'Unknown error'
  };
};

export const safeProgressCallback = (callback, progressData) => {
  try {
    if (callback && typeof callback === 'function') {
      // Validate progress data
      const safeData = {
        processed: Math.max(0, parseInt(progressData?.processed) || 0),
        total: Math.max(1, parseInt(progressData?.total) || 1),
        percentage: Math.max(0, Math.min(100, parseFloat(progressData?.percentage) || 0))
      };
      
      callback(safeData);
    }
  } catch (error) {
    console.error('Progress callback error:', error);
  }
};

export const validateProgressData = (data) => {
  if (!data || typeof data !== 'object') {
    return { processed: 0, total: 0, percentage: 0 };
  }
  
  return {
    processed: Math.max(0, parseInt(data.processed) || 0),
    total: Math.max(1, parseInt(data.total) || 1),
    percentage: Math.max(0, Math.min(100, parseFloat(data.percentage) || 0))
  };
};

export const logProgress = (context, progressData) => {
  const safe = validateProgressData(progressData);
  console.log(`${context}: ${safe.processed}/${safe.total} (${safe.percentage}%)`);
};
