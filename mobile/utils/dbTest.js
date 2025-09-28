import { initDatabase, countVehicles, bulkInsertVehicles, clearVehicles } from './db';

// Test database functionality
export const testDatabaseInsertion = async () => {
  try {
    console.log('🧪 Starting database insertion test...');
    
    // Initialize database
    await initDatabase();
    console.log('✅ Database initialized');
    
    // Clear existing data
    await clearVehicles();
    console.log('✅ Existing data cleared');
    
    // Test data
    const testData = [
      {
        _id: 'test1',
        regNo: 'ABC1234',
        chassisNo: 'CHASSIS123',
        loanNo: 'LOAN001',
        bank: 'Test Bank',
        make: 'Test Make',
        customerName: 'Test Customer',
        address: 'Test Address',
        vehicleType: 'TwoWheeler'
      },
      {
        _id: 'test2',
        regNo: 'XYZ5678',
        chassisNo: 'CHASSIS456',
        loanNo: 'LOAN002',
        bank: 'Test Bank 2',
        make: 'Test Make 2',
        customerName: 'Test Customer 2',
        address: 'Test Address 2',
        vehicleType: 'FourWheeler'
      }
    ];
    
    console.log(`📝 Inserting ${testData.length} test records...`);
    
    // Insert test data
    const inserted = await bulkInsertVehicles(testData, {
      chunkSize: 100,
      reindex: true
    });
    
    console.log(`✅ Inserted ${inserted} test records`);
    
    // Verify insertion
    const count = await countVehicles();
    console.log(`📊 Total records in database: ${count}`);
    
    if (count === testData.length) {
      console.log('✅ Database insertion test PASSED');
      return { success: true, message: 'Database insertion test passed' };
    } else {
      console.log('❌ Database insertion test FAILED');
      return { success: false, message: `Expected ${testData.length} records, got ${count}` };
    }
    
  } catch (error) {
    console.error('❌ Database insertion test ERROR:', error);
    return { success: false, message: error.message };
  }
};

// Test database search functionality
export const testDatabaseSearch = async () => {
  try {
    console.log('🔍 Starting database search test...');
    
    const { searchByRegSuffix, searchByChassis } = await import('./db');
    
    // Test registration number search
    const regResults = await searchByRegSuffix('1234');
    console.log(`📊 Registration search results: ${regResults.length}`);
    
    // Test chassis number search
    const chassisResults = await searchByChassis('CHASSIS');
    console.log(`📊 Chassis search results: ${chassisResults.length}`);
    
    if (regResults.length > 0 && chassisResults.length > 0) {
      console.log('✅ Database search test PASSED');
      return { success: true, message: 'Database search test passed' };
    } else {
      console.log('❌ Database search test FAILED');
      return { success: false, message: 'Search functionality not working' };
    }
    
  } catch (error) {
    console.error('❌ Database search test ERROR:', error);
    return { success: false, message: error.message };
  }
};

// Complete database test
export const runCompleteDatabaseTest = async () => {
  try {
    console.log('🚀 Starting complete database test...');
    
    // Test 1: Insertion
    const insertionTest = await testDatabaseInsertion();
    if (!insertionTest.success) {
      return insertionTest;
    }
    
    // Test 2: Search
    const searchTest = await testDatabaseSearch();
    if (!searchTest.success) {
      return searchTest;
    }
    
    console.log('🎉 All database tests PASSED');
    return { success: true, message: 'All database tests passed' };
    
  } catch (error) {
    console.error('❌ Complete database test ERROR:', error);
    return { success: false, message: error.message };
  }
};