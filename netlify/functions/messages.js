const { Client } = require('pg');

exports.handler = async (event) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    if (event.httpMethod === 'GET') {
      const res = await client.query('SELECT * FROM messages ORDER BY created_at ASC LIMIT 100');
      await client.end();
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(res.rows)
      };
    } 
    
    if (event.httpMethod === 'POST') {
      const { sender, encrypted_text } = JSON.parse(event.body);
      const res = await client.query(
        'INSERT INTO messages (sender, encrypted_text) VALUES ($1, $2) RETURNING *',
        [sender, encrypted_text]
      );
      await client.end();
      return {
        statusCode: 201,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(res.rows[0])
      };
    }

    await client.end();
    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
