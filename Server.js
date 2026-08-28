const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client } = require('pg');

const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);

app.use(cors({ origin: '*', methods: ["GET", "POST"] }));

const io = new Server(server, {
    cors: { origin: '*', methods: ["GET", "POST"] }
});

const connectedUsers = {}; 

const emitOnlineUsers = () => {
    const allowedUsers = ['Olga', 'Eric'];
    const onlineUsers = Object.values(connectedUsers).filter(name => allowedUsers.includes(name));
    io.emit('online users', onlineUsers);
};

const PORT = process.env.PORT || 3000;
let pgClient;

async function startServer() {
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
        console.error("❌ ERREUR: DATABASE_URL n'est pas définie.");
        process.exit(1);
    }

    try {
        pgClient = new Client({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false },
        });

        await pgClient.connect();
        console.log('✅ Connecté à PostgreSQL Railway.');

        // Structure de la table messages
        await pgClient.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Structure de la table reward_cards
        await pgClient.query(`
            CREATE TABLE IF NOT EXISTS reward_cards (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(100) NOT NULL,
                description TEXT,
                icon VARCHAR(10) DEFAULT '💌',
                sender VARCHAR(50) NOT NULL,
                recipient VARCHAR(50) NOT NULL,
                is_redeemed BOOLEAN DEFAULT FALSE,
                redeemed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        server.listen(PORT, () => {
            console.log(`🚀 Serveur démarré sur le port ${PORT}`);
        });

    } catch (err) {
        console.error('❌ Erreur au démarrage :', err.stack);
        process.exit(1);
    }
}

app.get('/', (req, res) => {
    res.status(200).send('Serveur de Cocon est opérationnel !');
});

// --- SOCKET.IO ---
io.on('connection', async (socket) => {
    
    // Identification
    socket.on('user joined', async (username) => {
        if (username === 'Olga' || username === 'Eric') {
            connectedUsers[socket.id] = username;
            emitOnlineUsers();
        }

        // Envoyer l'historique complet des messages
        try {
            if (pgClient) {
                const resMsg = await pgClient.query('SELECT * FROM messages ORDER BY timestamp ASC LIMIT 500;');
                socket.emit('history', resMsg.rows);

                const resCards = await pgClient.query('SELECT * FROM reward_cards ORDER BY created_at DESC;');
                socket.emit('cards_history', resCards.rows);
            }
        } catch (e) {
            console.error('❌ Erreur chargement historique :', e);
            socket.emit('history', []);
        }
    });

    // Gestion du Chat
    socket.on('chat message', async (data) => {
        if (!data.message || !data.sender) return;

        let msgToEmit = {
            sender: data.sender,
            message: data.message,
            timestamp: new Date()
        };

        try {
            if (pgClient) {
                const query = 'INSERT INTO messages (sender, message) VALUES ($1, $2) RETURNING id, timestamp;';
                const result = await pgClient.query(query, [data.sender, data.message]);
                msgToEmit.id = result.rows[0].id;
                msgToEmit.timestamp = result.rows[0].timestamp;
            }
        } catch (e) {
            console.error('❌ Erreur sauvegarde message :', e);
        }

        io.emit('chat message', msgToEmit);
    });

    // Gestion des Cartes Cadeaux
    socket.on('create_card', async (cardData) => {
        try {
            if (pgClient) {
                const query = `
                    INSERT INTO reward_cards (title, description, icon, sender, recipient) 
                    VALUES ($1, $2, $3, $4, $5) RETURNING *;
                `;
                const res = await pgClient.query(query, [
                    cardData.title, cardData.description, cardData.icon || '🌹', cardData.sender, cardData.recipient
                ]);
                io.emit('card_created', res.rows[0]);
            }
        } catch (e) {
            console.error('❌ Erreur création carte :', e);
        }
    });

    socket.on('redeem_card', async (cardId) => {
        try {
            if (pgClient) {
                const query = 'UPDATE reward_cards SET is_redeemed = TRUE, redeemed_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *;';
                const res = await pgClient.query(query, [cardId]);
                io.emit('card_redeemed', res.rows[0]);
            }
        } catch (e) {
            console.error('❌ Erreur utilisation carte :', e);
        }
    });

    socket.on('disconnect', () => {
        if (connectedUsers[socket.id]) {
            delete connectedUsers[socket.id];
            emitOnlineUsers();
        }
    });
});

startServer();
