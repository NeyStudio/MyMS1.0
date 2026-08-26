const { Client } = require('pg');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    if (event.httpMethod === 'POST') {
      const { user } = JSON.parse(event.body || '{}');
      if (user) {
        // Mettre à jour la dernière activité de l'utilisateur
        await client.query(
          'UPDATE user_presence SET last_seen = CURRENT_TIMESTAMP WHERE username = $1',
          [user]
        );
      }

      // Récupérer le statut des deux utilisateurs
      const res = await client.query('SELECT username, last_seen FROM user_presence');
      await client.end();

      const now = new Date();
      const presence = {};
      
      // Considéré en ligne si vu dans les 15 dernières secondes
      res.rows.forEach(row => {
        const lastSeen = new Date(row.last_seen);
        const diffSeconds = (now - lastSeen) / 1000;
        presence[row.username] = diffSeconds < 15;
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(presence)
      };
    }

    await client.end();
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  } catch (err) {
    if (client) await client.end();
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
