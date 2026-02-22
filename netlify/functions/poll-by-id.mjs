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

  // Handle PATCH request - Update poll (add participants/instruments)
  if (req.method === 'PATCH') {
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

      if (poll.deletionToken !== deletionToken) {
        return new Response(JSON.stringify({ error: 'Invalid deletion token' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Save planning if provided
      if (body.planning !== undefined) {
        await db.collection('polls').updateOne(
          { id: pollId },
          { $set: { planning: body.planning } }
        );
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Merge new participants and instruments (deduplicate, case-insensitive for participants)
      const existingParticipantsLower = poll.participants.map(p => p.toLowerCase());
      const newParticipants = (body.newParticipants || [])
        .map(p => p.trim())
        .filter(p => p.length > 0 && !existingParticipantsLower.includes(p.toLowerCase()));

      const existingInstrumentsLower = poll.instruments.map(i => i.toLowerCase());
      const newInstruments = (body.newInstruments || [])
        .map(i => i.trim())
        .filter(i => i.length > 0 && !existingInstrumentsLower.includes(i.toLowerCase()));

      const updatedParticipants = [...poll.participants, ...newParticipants];
      const updatedInstruments = [...poll.instruments, ...newInstruments];

      await db.collection('polls').updateOne(
        { id: pollId },
        { $set: { participants: updatedParticipants, instruments: updatedInstruments } }
      );

      return new Response(JSON.stringify({
        success: true,
        addedParticipants: newParticipants,
        addedInstruments: newInstruments,
        participants: updatedParticipants,
        instruments: updatedInstruments,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (err) {
      console.error('Error updating poll:', err);
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
