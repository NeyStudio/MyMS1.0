const { Client } = require('pg');

exports.handler = async (event) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Récupérer les cartes
    if (event.httpMethod === 'GET') {
      const res = await client.query('SELECT * FROM reward_cards ORDER BY created_at DESC');
      await client.end();
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(res.rows)
      };
    } 

    // Créer une carte
    if (event.httpMethod === 'POST') {
      const { title, description, icon, sender, recipient } = JSON.parse(event.body);
      const res = await client.query(
        'INSERT INTO reward_cards (title, description, icon, sender, recipient) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [title, description, icon || '🌹', sender, recipient]
      );
      await client.end();
      return {
        statusCode: 201,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(res.rows[0])
      };
    }

    // Utiliser/Échanger une carte (Redeem)
    if (event.httpMethod === 'PATCH') {
      const { id } = JSON.parse(event.body);
      const res = await client.query(
        'UPDATE reward_cards SET is_redeemed = TRUE, redeemed_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [id]
      );
      await client.end();
      return {
        statusCode: 200,
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
