const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Database connection error: ${error.message}`);
    process.exit(1);
  }
};

// Get tenant database connection
const getTenantDB = async (tenantName) => {
  const dbName = `tenants_${tenantName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  // Check if connection already exists
  if (mongoose.connections.some(conn => conn.name === dbName)) {
    return mongoose.connections.find(conn => conn.name === dbName);
  }
  
  // Create new connection if doesn't exist
  const conn = mongoose.createConnection(process.env.MONGODB_URI.replace('rapidrepo', dbName));
  
  await new Promise((resolve, reject) => {
    conn.once('connected', resolve);
    conn.once('error', reject);
  });

  return conn;
};

module.exports = { connectDB, getTenantDB };


