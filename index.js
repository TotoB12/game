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

let walls = [
  { x: 180, y: 281, width: 30, height: 270, color: "hsl(189, 100%, 51%)", string: false }, // Left wall
  { x: 820, y: 281, width: 30, height: 270, color: "hsl(27, 70%, 55%)", string: false }, // Right wall
  { x: 313, y: 170, width: 30, height: 30, color: "red", string: "1" }, // Ball
  { x: 687, y: 170, width: 30, height: 30, color: "red", string: "1" }, // Ball
  { x: 313, y: 392, width: 30, height: 30, color: "red", string: "2" }, // Ball
  { x: 687, y: 392, width: 30, height: 30, color: "red", string: "2" }, // Ball
];

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  socket.on("register", (data) => {
    // Check if the username is already taken
    const isUsernameTaken = Object.values(players).some(
      (player) => player.username === data.username,
    );

    if (isUsernameTaken) {
      // Emit an event to inform the client that the username is taken
      socket.emit("register_response", {
        success: false,
        message: "Username already taken",
      });
      return; // Stop further execution for this registration attempt
    }

    console.log("New player registered:", data.username);

    const blueTeamCount = Object.values(players).filter(
      (p) => p.team === "left",
    ).length;
    const orangeTeamCount = Object.values(players).filter(
      (p) => p.team === "right",
    ).length;
    let team, color, x, y;

    if (blueTeamCount > orangeTeamCount) {
      team = "right"; // Orange team
      color = colorRightTeam;
      x = 960 + Math.floor(Math.random() * 81) - 40;
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
        x = 960 + Math.floor(Math.random() * 81) - 40;
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
      health: 100, // health of the player : 100 health points
      ammo: 20, // ammunitions : 20 bullets
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
      size: bulletData.size, // Store bullet size received from the client
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

  socket.emit("walls", walls);
});

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    let bullet = bullets[i];
    bullet.x += bullet.velocityX;
    bullet.y += bullet.velocityY;

    let bulletHit = false;

    // Check collision with each player
    for (const playerId in players) {
      const player = players[playerId];
      if (bullet.owner === playerId) {
        continue; // Skip collision check if the bullet is from the same player
      }

      const dx = player.x - bullet.x;
      const dy = player.y - bullet.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if the bullet hits a player from the opposite team
      if (
        distance < player.size + bullet.size &&
        players[bullet.owner].team !== player.team
      ) {
        //player.health -= 10;
        bulletHit = true;
        break; // Stop checking for other collisions
      }
    }

    for (const wall of walls) {
      if (
        bullet.x > wall.x - wall.width / 2 &&
        bullet.x < wall.x + wall.width / 2 &&
        bullet.y > wall.y - wall.height / 2 &&
        bullet.y < wall.y + wall.height / 2
      ) {
        bulletHit = true;
        break;
      }
    }

    // Remove bullet if it hits a player from the opposite team or goes out of bounds
    if (
      bulletHit ||
      bullet.x < 0 ||
      bullet.x > bullet.canvasWidth ||
      bullet.y < 0 ||
      bullet.y > bullet.canvasHeight
    ) {
      bullets.splice(i, 1);
    }
  }
}

// At the end of the updateBullets function or the interval
io.emit("bullets", bullets);

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
