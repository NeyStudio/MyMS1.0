const { Client } = require('pg');

exports.handler = async (event) => {
  // En-têtes pour éviter tout blocage CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

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
        headers,
        body: JSON.stringify(res.rows)
      };
    } 

    if (event.httpMethod === 'POST') {
      const { sender, encrypted_text } = JSON.parse(event.body || '{}');
      const res = await client.query(
        'INSERT INTO messages (sender, encrypted_text) VALUES ($1, $2) RETURNING *',
        [sender, encrypted_text]
      );
      await client.end();
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(res.rows[0])
      };
    }

    await client.end();
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (err) {
    if (client) await client.end();
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
