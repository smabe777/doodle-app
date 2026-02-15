const { MongoClient } = require('mongodb');

// MongoDB connection URL - defaults to local MongoDB for development
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/doodle-app';

let client = null;
let db = null;

async function connect() {
  if (db) {
    return db;
  }

  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();

    // Get database name from URI or use default
    const dbName = MONGODB_URI.split('/').pop().split('?')[0] || 'doodle-app';
    db = client.db(dbName);

    console.log(`Connected to MongoDB: ${dbName}`);

    // Create indexes for better performance
    await db.collection('polls').createIndex({ id: 1 }, { unique: true });
    await db.collection('polls').createIndex({ createdAt: -1 });

    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

async function getDb() {
  if (!db) {
    await connect();
  }
  return db;
}

async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed');
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await close();
  process.exit(0);
});

module.exports = { connect, getDb, close };
