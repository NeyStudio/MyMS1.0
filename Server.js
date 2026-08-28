const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

io.on('connection', (socket) => {
  socket.on('send_message', (encryptedData) => {
    // Le serveur n'a jamais accès au texte en clair
    io.emit('encrypted_message', encryptedData);
  });
});

server.listen(3000, () => {
  console.log('Serveur démarré sur http://localhost:3000');
});
