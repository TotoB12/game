const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let players = {};
let bullets = [];

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  socket.on("register", (data) => {
    console.log("New player registered:", data.username);

    // Assign a random color and initial position to the new player
    players[socket.id] = {
      username: data.username,
      x: Math.floor(Math.random() * 800),
      y: Math.floor(Math.random() * 600),
      color: "#" + Math.floor(Math.random() * 16777215).toString(16),
      size: 20,
      velocityX: 0,
      velocityY: 0,
      weaponAngle: 0,
    };
    // Notify all players of the current players' state
    io.emit("players", players);
  });

  socket.on("register", (data) => {
    if (players[socket.id]) {
      players[socket.id].username = data.username;
    }
  });

  // Notify all players of the current players' state
  io.emit("players", players);

  socket.on("shoot_bullet", (bulletData) => {
    bullets.push({
      x: bulletData.x,
      y: bulletData.y,
      velocityX: bulletData.velocityX,
      velocityY: bulletData.velocityY,
      canvasWidth: bulletData.canvasWidth,
      canvasHeight: bulletData.canvasHeight,
      owner: socket.id,
    });
    io.emit("bullets", bullets);
  });

  socket.on("disconnect", () => {
    // Remove bullets that were shot by the disconnected player
    bullets = bullets.filter((bullet) => bullet.owner !== socket.id);
    io.emit("bullets", bullets);
    console.log("Player disconnected:", socket.id);
    delete players[socket.id];
    io.emit("players", players);
  });

  socket.on("move_player", (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].velocityX = data.velocityX;
      players[socket.id].velocityY = data.velocityY;
      players[socket.id].weaponAngle = data.weaponAngle;
      io.emit("players", players);
    }
  });
});

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    let bullet = bullets[i];
    bullet.x += bullet.velocityX;
    bullet.y += bullet.velocityY;

    // Use dynamic canvas boundaries for each bullet
    if (
      bullet.x < 0 ||
      bullet.x > bullet.canvasWidth ||
      bullet.y < 0 ||
      bullet.y > bullet.canvasHeight
    ) {
      bullets.splice(i, 1);
    }
  }
}

// Update bullet positions and send updates to clients
setInterval(() => {
  updateBullets();
  io.emit("bullets", bullets);
}, 1000 / 60); // for example, 60 times per second

// Serve the static files
app.use(express.static("public"));

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
