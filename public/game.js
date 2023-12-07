let players = {};
let needsUpdate = false;
let usernameSubmitted = false;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let root = document.documentElement;

const acceleration = 0.5;
const friction = 0.9;
const maxSpeed = 5;

const shootingTimeoutIndicator = document.getElementById(
  "shooting-timeout-indicator"
);

const ammoIndicator = document.getElementById(
  "ammo-indicator"
);

let bullets = [];

const bulletSpeed = 20;
const bulletSize = 5;
const bulletColorLeftTeam = getComputedStyle(root)
  .getPropertyValue("--left-team-bullet-color")
  .trim();
const leftTeamColor = getComputedStyle(root)
.getPropertyValue("--left-team-color")
.trim();

const shootingTimeout = 250; // Adjust timeout as needed
root.style.setProperty("--shooting-timeout", shootingTimeout + "ms");

let isShootingTimeout = false;

const reloadTime = 3000;
root.style.setProperty("--reload-time", reloadTime + "ms");

let keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false,
};

let mousePosition = { x: 0, y: 0 };

const admins = ["TotoB12", "Txori"]

let socket; // Declare the socket variable

function initializeGame(username) {
  // Save username in localStorage
  localStorage.setItem("lastUsername", username);
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

  // Inside the initializeGame function, after establishing the socket connection
  socket.on("register_response", (response) => {
    if (!response.success) {
      alert(response.message);
      document.getElementById("usernamePopup").style.display = "flex";
      usernameSubmitted = false; // Reset the flag to allow trying again
    }
  });

  socket.on("player_hit", (data) => {
    if (players[data.playerId]) {
      players[data.playerId].isHit = true;

      // Reset color after 0.2 seconds
      setTimeout(() => {
        if (players[data.playerId]) {
          players[data.playerId].isHit = false;
        }
      }, 100); // 0.1 seconds
    }
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
      // document.getElementById("usernameDisplay").innerText = username;
      document.getElementById("usernamePopup").style.display = "none";

      // Initialize and start the game with the username
      initializeGame(username);

      if (!admins.includes(username)) {
        ammoIndicator.innerHTML = "x20";
      }
    } else {
      alert("Please enter a username.");
    }
  });

// Show the popup when the page loads
window.onload = function () {
  const lastUsername = localStorage.getItem("lastUsername");
  if (lastUsername) {
    document.getElementById("usernameInput").value = lastUsername;
  }

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

    // Draw player with red color if hit
    ctx.fillStyle = player.isHit ? "red" : player.color;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
    ctx.fill();

    // Draw weapon
    const weaponLength = 15; // Length of the weapon
    const weaponWidth = 10; // Width of the weapon
    const weaponDistance = player.size + weaponLength + 4; // Distance from player center

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.weaponAngle + Math.PI / 2); // Adjust rotation here
    ctx.fillStyle = "white";
    ctx.fillRect(-weaponWidth / 2, -weaponDistance, weaponWidth, weaponLength); // Adjusted position
    ctx.restore();

    // Draw other players' usernames
    if (id !== socket.id) {
      // Check if not the local player
      ctx.fillStyle = "white"; // Text color
    } else {
      ctx.fillStyle = player.color;
    }
    ctx.font = "17px Space Grotesk"; // Adjust font size and style as needed
    ctx.textAlign = "center";
    ctx.fillText(player.username, player.x, player.y - player.size - 10); // Position the text above the player
  }
}

function updatePlayerPosition(player) {
  // Define a speed multiplier for specific players
  const speedMultiplier =
    player.username === "Txori" || player.username === "TotoB12" ? 1.2 : 1; // 1.2x speed for Txori and TotoB12

  if (keys.a) {
    player.velocityX -= acceleration * speedMultiplier;
  }
  if (keys.d) {
    player.velocityX += acceleration * speedMultiplier;
  }

  if (keys.w) {
    player.velocityY -= acceleration * speedMultiplier;
  }
  if (keys.s) {
    player.velocityY += acceleration * speedMultiplier;
  }

  player.velocityX *= friction;
  player.velocityY *= friction;

  player.velocityX = Math.max(
    Math.min(player.velocityX, maxSpeed * speedMultiplier),
    -maxSpeed * speedMultiplier
  );
  player.velocityY = Math.max(
    Math.min(player.velocityY, maxSpeed * speedMultiplier),
    -maxSpeed * speedMultiplier
  );

  // Update position with boundary checks
  player.x = Math.max(
    Math.min(player.x + player.velocityX, canvas.width - player.size),
    player.size
  );
  player.y = Math.max(
    Math.min(player.y + player.velocityY, canvas.height - player.size),
    player.size
  );

  shootingTimeoutIndicator.style.left = player.x + "px";
  shootingTimeoutIndicator.style.top = player.y + "px";
  ammoIndicator.style.left = player.x + "px";
  ammoIndicator.style.top = player.y + "px";

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
    if (keys.space) {
      shootBullet();
    }
    }
    handleCollisions(); // Handle collisions
    drawPlayers();
    drawBullets();
    requestAnimationFrame(update); // Move this inside the if condition
  }
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    keys.space = true;
  } else {
    keys[event.key] = true;
  }
  needsUpdate = true;
});

document.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    keys.space = false;
  } else {
    keys[event.key] = false;
  }
  needsUpdate = true;
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

// shooting
function shootBullet() {
  if (players[socket.id]) {
    if (isShootingTimeout) {
      return;
    }
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

    // Emit bullet data to the server, including canvas dimensions and bullet size
    socket.emit("shoot_bullet", {
      x: bulletX,
      y: bulletY,
      velocityX: bulletVelocityX,
      velocityY: bulletVelocityY,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      size: bulletSize, // Include bullet size here
    });

    if (
      players[socket.id] && 
      !admins.includes(players[socket.id].username)
    ) {
      // decrease the ammo
      players[socket.id].ammo -= 1;
      ammoIndicator.innerHTML = 'x' + players[socket.id].ammo;
      if (players[socket.id].ammo <= 0) {
        isShootingTimeout = true;
        shootingTimeoutIndicator.style.display = "block";
        shootingTimeoutIndicator.classList.add("reloading");
        setTimeout(() => {
          // reset ammo
          players[socket.id].ammo = 20;
          ammoIndicator.innerHTML = 'x' + players[socket.id].ammo;
          isShootingTimeout = false;
          shootingTimeoutIndicator.style.display = "none";
          shootingTimeoutIndicator.classList.remove("reloading");
        }, reloadTime);
        return;
      }
    }

    if (
      players[socket.id] && 
      !admins.includes(players[socket.id].username)
    ) {
      isShootingTimeout = true;
      shootingTimeoutIndicator.style.display = "block";
      shootingTimeoutIndicator.classList.add("active");
      setTimeout(() => {
        isShootingTimeout = false;
        shootingTimeoutIndicator.style.display = "none";
        shootingTimeoutIndicator.classList.remove("active");
      }, shootingTimeout);
    }
  }
};

canvas.addEventListener("click", (event) => {
  shootBullet();
});


function drawBullets() {
  for (const bullet of bullets) {
    const owner = players[bullet.owner];
    if (owner) {
      ctx.fillStyle = owner.color; // Use player's team color for the bullet
    } else {
      ctx.fillStyle = "grey"; // Default color if owner is not found
    }
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bulletSize, 0, Math.PI * 2);
    ctx.fill();
  }
}

