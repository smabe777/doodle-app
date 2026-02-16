import { MongoClient } from 'mongodb';

// Cached connection for serverless warm starts
let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
  // Return cached connection if available (warm start)
  if (cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // MongoDB connection URI from environment variable
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  // Create new connection with serverless-optimized settings
  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,                    // Limit connections per function instance
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,     // Fail fast if can't connect
    socketTimeoutMS: 5000,
  });

  await client.connect();

  // Extract database name from URI
  const dbName = MONGODB_URI.split('/').pop().split('?')[0] || 'doodle-app';
  const db = client.db(dbName);

  console.log(`Connected to MongoDB: ${dbName}`);

  // Create indexes for better performance (idempotent operation)
  await db.collection('polls').createIndex({ id: 1 }, { unique: true });
  await db.collection('polls').createIndex({ createdAt: -1 });

  // Cache for subsequent invocations
  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
