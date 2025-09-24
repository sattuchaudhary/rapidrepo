// Database test utilities
import { initDatabase, countVehicles, bulkInsertVehicles } from './db';

export const testDatabase = async () => {
  console.log('🧪 Testing database operations...');
  
  try {
    // Test initialization
    console.log('1. Testing database initialization...');
    await initDatabase();
    console.log('✅ Database initialized successfully');
    
    // Test counting
    console.log('2. Testing vehicle count...');
    const count = await countVehicles();
    console.log(`✅ Vehicle count: ${count}`);
    
    // Test insertion
    console.log('3. Testing vehicle insertion...');
    const testData = [
      {
        _id: 'test1',
        vehicleType: 'TwoWheeler',
        regNo: 'TEST1234',
        chassisNo: 'CHASSIS123',
        loanNo: 'LOAN123',
        bank: 'Test Bank',
        make: 'Test Make',
        customerName: 'Test Customer',
        address: 'Test Address'
      }
    ];
    
    const inserted = await bulkInsertVehicles(testData);
    console.log(`✅ Inserted ${inserted} test records`);
    
    // Test count again
    const newCount = await countVehicles();
    console.log(`✅ New vehicle count: ${newCount}`);
    
    console.log('🎉 Database test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    return false;
  }
};

export default testDatabase;
