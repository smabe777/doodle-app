import { connectToDatabase } from './db-connection.mjs';

export default async (req, context) => {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Extract poll ID from URL parameter
    const pollId = context.params.id;

    // Connect to MongoDB and find poll
    const { db } = await connectToDatabase();
    const poll = await db.collection('polls').findOne({ id: pollId });

    if (!poll) {
      return new Response(JSON.stringify({ error: 'Poll not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Remove MongoDB _id field from response
    delete poll._id;

    return new Response(JSON.stringify(poll), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Error fetching poll:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: "/api/polls/:id"
};
