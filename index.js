const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let players = {};

io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);

    // Assign a random color and initial position to the new player
  players[socket.id] = {
      x: Math.floor(Math.random() * 800),
      y: Math.floor(Math.random() * 600),
      color: "#" + Math.floor(Math.random()*16777215).toString(16),
      size: 20,
      velocityX: 0,
      velocityY: 0,
      weaponAngle: 0,
  };

    // Notify all players of the current players' state
    io.emit('players', players);

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        io.emit('players', players);
    });

      socket.on('move_player', (data) => {
          if (players[socket.id]) {
              players[socket.id].x = data.x;
              players[socket.id].y = data.y;
              players[socket.id].velocityX = data.velocityX;
              players[socket.id].velocityY = data.velocityY;
              players[socket.id].weaponAngle = data.weaponAngle;
              io.emit('players', players);
          }
      });
  });

// Serve the static files
app.use(express.static('public'));

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
