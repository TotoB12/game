const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const colorLeftTeam = "hsl(189, 100%, 51%)";
const colorRightTeam = "hsl(27, 70%, 55%)"; // Orange team color

let players = {};
let bullets = [];

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  socket.on("register", (data) => {
    console.log("New player registered:", data.username);

    const blueTeamCount = Object.values(players).filter(
      (p) => p.team === "left"
    ).length;
    const orangeTeamCount = Object.values(players).filter(
      (p) => p.team === "right"
    ).length;
    let team, color, x, y;

    if (blueTeamCount > orangeTeamCount) {
      team = "right"; // Orange team
      color = colorRightTeam;
      x = 40 + Math.floor(Math.random() * 81) - 40;
      y = 281 + Math.floor(Math.random() * 201) - 100;
    } else if (orangeTeamCount > blueTeamCount) {
      team = "left"; // Blue team
      color = colorLeftTeam;
      x = 40 + Math.floor(Math.random() * 81) - 40;
      y = 281 + Math.floor(Math.random() * 201) - 100;
    } else {
      // Randomly assign team if counts are equal
      if (Math.random() < 0.5) {
        team = "left"; // Blue team
        color = colorLeftTeam;
        x = 40 + Math.floor(Math.random() * 81) - 40;
        y = 281 + Math.floor(Math.random() * 201) - 100;
      } else {
        team = "right"; // Orange team
        color = colorRightTeam;
        x = 40 + Math.floor(Math.random() * 81) - 40;
        y = 281 + Math.floor(Math.random() * 201) - 100;
      }
    }

    players[socket.id] = {
      username: data.username,
      // x: Math.floor(Math.random() * 800),
      // y: Math.floor(Math.random() * 600),
      // Random position in the blue spawn zone
      x: x,
      y: y,
      // color: "#" + Math.floor(Math.random() * 16777215).toString(16),
      color: color,
      size: 20,
      velocityX: 0,
      velocityY: 0,
      weaponAngle: 0,
      team: team,
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
}, 1000 / 30); // for example, 60 times per second

// Serve the static files
app.use(express.static("public"));

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
