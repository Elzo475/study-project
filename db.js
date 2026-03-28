const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
let client;
let database;

async function connectDb() {
  if (database) return database;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (!client) {
    client = new MongoClient(uri);
  }

  await client.connect();
  database = client.db();
  return database;
}

async function getCollection(name) {
  const db = await connectDb();
  return db.collection(name);
}

module.exports = {
  getCollection
};
