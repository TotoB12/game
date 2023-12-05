let players = {};
let needsUpdate = false;
let usernameSubmitted = false;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const acceleration = 0.5;
const friction = 0.9;
const maxSpeed = 5;

let bullets = [];

const bulletSpeed = 10;
const bulletSize = 5; // Adjust size as needed
const bulletColorLeftTeam = "#9EF0FF";

let keys = {
  w: false,
  a: false,
  s: false,
  d: false,
};

let mousePosition = { x: 0, y: 0 };

let socket; // Declare the socket variable

function initializeGame(username) {
  usernameSubmitted = true;

  socket = io();

  socket.emit("register", { username });

  // Existing socket event listeners...
  socket.on("players", (updatedPlayers) => {
    // Remove disconnected players
    for (const id in players) {
      if (!updatedPlayers[id]) {
        delete players[id];
      }
    }

    // Update or add new players
    for (const id in updatedPlayers) {
      if (players[id]) {
        players[id].targetX = updatedPlayers[id].x;
        players[id].targetY = updatedPlayers[id].y;
        // Update target weapon angle for other players
        if (id !== socket.id) {
          players[id].targetWeaponAngle = updatedPlayers[id].weaponAngle;
        }
      } else {
        players[id] = updatedPlayers[id];
        // Initialize weapon angle for new players
        players[id].weaponAngle = updatedPlayers[id].weaponAngle;
      }
    }
  });

  // Add this inside initializeGame after establishing the socket connection
  socket.on("bullets", (updatedBullets) => {
    bullets = updatedBullets;
  });

  // Start the game update loop
  update();
}

// Event listener for submitting the username
document
  .getElementById("submitUsername")
  .addEventListener("click", function () {
    const username = document
      .getElementById("usernameInput")
      .value.substring(0, 10);
    if (username.trim() !== "") {
      document.getElementById("usernameDisplay").innerText = username;
      document.getElementById("usernamePopup").style.display = "none";

      // Initialize and start the game with the username
      initializeGame(username);
    } else {
      alert("Please enter a username.");
    }
  });

// Show the popup when the page loads
window.onload = function () {
  document.getElementById("usernamePopup").style.display = "flex";
};

function lerpAngle(a, b, t) {
  let delta = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + delta * t;
}

// socket.on("players", (updatedPlayers) => {
//   // Remove disconnected players
//   for (const id in players) {
//     if (!updatedPlayers[id]) {
//       delete players[id];
//     }
//   }

//   // Update or add new players
//   for (const id in updatedPlayers) {
//     if (players[id]) {
//       players[id].targetX = updatedPlayers[id].x;
//       players[id].targetY = updatedPlayers[id].y;
//       // Update target weapon angle for other players
//       if (id !== socket.id) {
//         players[id].targetWeaponAngle = updatedPlayers[id].weaponAngle;
//       }
//     } else {
//       players[id] = updatedPlayers[id];
//       // Initialize weapon angle for new players
//       players[id].weaponAngle = updatedPlayers[id].weaponAngle;
//     }
//   }
// });

function drawPlayers() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const id in players) {
    const player = players[id];

    // Interpolate positions
    if (player.targetX !== undefined && player.targetY !== undefined) {
      player.x += (player.targetX - player.x) * 0.1;
      player.y += (player.targetY - player.y) * 0.1;
    }

    // Interpolate weapon angle for smoother rotation
    if (player.targetWeaponAngle !== undefined) {
      player.weaponAngle = lerpAngle(
        player.weaponAngle,
        player.targetWeaponAngle,
        0.1
      );
    }

    // Draw player
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
    ctx.fill();

    // Draw weapon
    const weaponLength = 15; // Length of the weapon
    const weaponWidth = 10; // Width of the weapon
    const weaponDistance = player.size + weaponLength + 6; // Distance from player center

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.weaponAngle + Math.PI / 2); // Adjust rotation here
    ctx.fillStyle = "white";
    ctx.fillRect(-weaponWidth / 2, -weaponDistance, weaponWidth, weaponLength); // Adjusted position
    ctx.restore();
  }
}

function updatePlayerPosition(player) {
  if (keys.a) {
    player.velocityX -= acceleration;
  }
  if (keys.d) {
    player.velocityX += acceleration;
  }

  if (keys.w) {
    player.velocityY -= acceleration;
  }
  if (keys.s) {
    player.velocityY += acceleration;
  }

  player.velocityX *= friction;
  player.velocityY *= friction;

  player.velocityX = Math.max(Math.min(player.velocityX, maxSpeed), -maxSpeed);
  player.velocityY = Math.max(Math.min(player.velocityY, maxSpeed), -maxSpeed);

  // Update position with boundary checks
  player.x = Math.max(
    Math.min(player.x + player.velocityX, canvas.width - player.size),
    player.size
  );
  player.y = Math.max(
    Math.min(player.y + player.velocityY, canvas.height - player.size),
    player.size
  );

  // Set the flag to true if movement occurs
  if (player.velocityX !== 0 || player.velocityY !== 0) {
    needsUpdate = true;
  }
}

function handleCollisions() {
  const playerIds = Object.keys(players);
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const player1 = players[playerIds[i]];
      const player2 = players[playerIds[j]];

      const dx = player2.x - player1.x;
      const dy = player2.y - player1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = player1.size + player2.size;

      if (distance < minDistance) {
        // Resolve the overlapping
        const overlap = (minDistance - distance) / 2;
        const offsetX = (overlap * dx) / distance;
        const offsetY = (overlap * dy) / distance;

        player1.x -= offsetX;
        player1.y -= offsetY;
        player2.x += offsetX;
        player2.y += offsetY;

        if (distance < player1.size + player2.size) {
          // Collision detected, now resolve it
          const angle = Math.atan2(dy, dx);
          const sin = Math.sin(angle);
          const cos = Math.cos(angle);

          // Rotate player's position
          const x1 = 0;
          const y1 = 0;

          const x2 = dx * cos + dy * sin;
          const y2 = dy * cos - dx * sin;

          // Rotate player's velocity
          const vx1 = player1.velocityX * cos + player1.velocityY * sin;
          const vy1 = player1.velocityY * cos - player1.velocityX * sin;

          const vx2 = player2.velocityX * cos + player2.velocityY * sin;
          const vy2 = player2.velocityY * cos - player2.velocityX * sin;

          // Collision response
          const vx1Final =
            ((player1.size - player2.size) * vx1 + 2 * player2.size * vx2) /
            (player1.size + player2.size);
          const vx2Final =
            ((player2.size - player1.size) * vx2 + 2 * player1.size * vx1) /
            (player1.size + player2.size);

          // Update velocity
          player1.velocityX = vx1Final * cos - vy1 * sin;
          player1.velocityY = vy1 * cos + vx1Final * sin;

          player2.velocityX = vx2Final * cos - vy2 * sin;
          player2.velocityY = vy2 * cos + vx2Final * sin;
        }
      }
      // Boundary check for player1
      player1.x = Math.max(
        Math.min(player1.x, canvas.width - player1.size),
        player1.size
      );
      player1.y = Math.max(
        Math.min(player1.y, canvas.height - player1.size),
        player1.size
      );

      // Boundary check for player2
      player2.x = Math.max(
        Math.min(player2.x, canvas.width - player2.size),
        player2.size
      );
      player2.y = Math.max(
        Math.min(player2.y, canvas.height - player2.size),
        player2.size
      );
    }
  }
}

function update() {
  if (usernameSubmitted) {
    if (socket.id && players[socket.id]) {
      updatePlayerPosition(players[socket.id]);

      // Update the weapon angle continuously
      const angle = getAngle(
        players[socket.id].x,
        players[socket.id].y,
        mousePosition.x,
        mousePosition.y
      );
      players[socket.id].targetWeaponAngle = angle;

      // Emit only if an update is needed
      if (needsUpdate) {
        socket.emit("move_player", {
          x: players[socket.id].x,
          y: players[socket.id].y,
          velocityX: players[socket.id].velocityX,
          velocityY: players[socket.id].velocityY,
          weaponAngle: angle,
        });
        needsUpdate = false;
      }
    }
    handleCollisions(); // Handle collisions
    drawPlayers();
    drawBullets();
    requestAnimationFrame(update); // Move this inside the if condition
  }
}

document.addEventListener("keydown", (event) => {
  keys[event.key] = true;
  needsUpdate = true; // Set flag on key down
});

document.addEventListener("keyup", (event) => {
  keys[event.key] = false;
  needsUpdate = true; // Set flag on key up
});

update();

function getAngle(cx, cy, ex, ey) {
  const dy = ey - cy;
  const dx = ex - cx;
  const theta = Math.atan2(dy, dx); // range (-PI, PI]
  return theta;
}

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  mousePosition.x = event.clientX - rect.left;
  mousePosition.y = event.clientY - rect.top;
  needsUpdate = true;
});

canvas.addEventListener("click", (event) => {
  if (players[socket.id]) {
    // Calculate bullet velocity based on weapon angle and player's velocity
    // const bulletVelocityX = bulletSpeed * Math.cos(players[socket.id].weaponAngle) + players[socket.id].velocityX;
    // const bulletVelocityY =
    //   bulletSpeed * Math.sin(players[socket.id].weaponAngle) +
    //   players[socket.id].velocityY;

    // Calculate bullet velocity based only on weapon angle
    const bulletVelocityX =
      bulletSpeed * Math.cos(players[socket.id].weaponAngle);
    const bulletVelocityY =
      bulletSpeed * Math.sin(players[socket.id].weaponAngle);

    // Calculate the initial position of the bullet
    const bulletX =
      players[socket.id].x +
      (players[socket.id].size + 15) * Math.cos(players[socket.id].weaponAngle);
    const bulletY =
      players[socket.id].y +
      (players[socket.id].size + 15) * Math.sin(players[socket.id].weaponAngle);

    // Create the bullet
    bullets.push({
      x: bulletX,
      y: bulletY,
      velocityX: bulletVelocityX,
      velocityY: bulletVelocityY,
    });

    // Emit bullet data to the server, including canvas dimensions
    socket.emit("shoot_bullet", {
      x: bulletX,
      y: bulletY,
      velocityX: bulletVelocityX,
      velocityY: bulletVelocityY,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    });
  }
});

function drawBullets() {
  for (const bullet of bullets) {
    ctx.fillStyle = bulletColorLeftTeam;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bulletSize, 0, Math.PI * 2);
    ctx.fill();
  }
}