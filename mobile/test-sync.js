// Test script for sync functionality
import { runOptimizedBulkDownload } from './utils/offlineSync';

const testSync = async () => {
  console.log('🧪 Starting sync test...');
  
  try {
    const result = await runOptimizedBulkDownload((progress) => {
      console.log(`Progress: ${progress.percentage}% (${progress.processed}/${progress.total})`);
    });
    
    console.log('✅ Sync test completed:', result);
  } catch (error) {
    console.error('❌ Sync test failed:', error);
  }
};

// Run test if this file is executed directly
if (typeof window !== 'undefined') {
  testSync();
}

export default testSync;
