import { connectToDatabase } from './db-connection.mjs';

export default async (req, context) => {
  const pollId = context.params.id;

  // Handle GET request - Fetch poll
  if (req.method === 'GET') {
    try {
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
  }

  // Handle DELETE request - Delete poll
  if (req.method === 'DELETE') {
    try {
      const body = await req.json();
      const deletionToken = body.deletionToken;

      if (!deletionToken) {
        return new Response(JSON.stringify({ error: 'Deletion token is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { db } = await connectToDatabase();
      const poll = await db.collection('polls').findOne({ id: pollId });

      if (!poll) {
        return new Response(JSON.stringify({ error: 'Poll not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify deletion token
      if (poll.deletionToken !== deletionToken) {
        return new Response(JSON.stringify({ error: 'Invalid deletion token' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Delete the poll
      await db.collection('polls').deleteOne({ id: pollId });

      return new Response(JSON.stringify({ success: true, message: 'Poll deleted successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (err) {
      console.error('Error deleting poll:', err);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Method not allowed
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = {
  path: "/api/polls/:id"
};
