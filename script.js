document.body.onload = init;

var ONE_SECOND = 1000;
var TICK_RATE = 60;
var TICK_TIME = ONE_SECOND / TICK_RATE
var currentTime;
var dots = [];
var numDots = 1024;
var mousePressed = false;
var targetX = 0;
var targetY = 0;
var tickCounter = 0;
var prof = {
  tick: [],
  render: []
};

function init() {
  var canvas = document.getElementById('swarm-canvas');
  gl = initWebGL(canvas);
  if (!gl) {
    return;
  }
  gl.viewportWidth = canvas.width;
  gl.viewportHeight = canvas.height;

  document.addEventListener('keypress', function(e) {
    if (String.fromCharCode(e.keyCode) === 'r') {
      numDots =  prompt('How many dots would you like?');
      initDots();
    }
  });

  canvas.addEventListener('mousedown', function(e) {
    var rect = canvas.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = canvas.height - (e.clientY - rect.top);
    mousePressed = true;
  });

  canvas.addEventListener('mouseup', function(e) {
    mousePressed = false;
  });

  canvas.addEventListener('mousemove', function(e) {
    if (mousePressed) {
      var rect = canvas.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = canvas.height - (e.clientY - rect.top);
    }
  });

  initDots();
  initShaders();
  initBuffers();

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  var resolutionMatrix = vec2.create();
  vec2.set(resolutionMatrix, gl.viewportWidth, gl.viewportHeight);
  gl.uniform2fv(shaderProgram.resolutionUniform, resolutionMatrix);

  currentTime = performance.now();
  requestAnimationFrame(tick);
}

function tick(newTime) {
  var frameTime = newTime - currentTime;
  currentTime = newTime;

  while (frameTime >= TICK_TIME) {
    gameTick();
    frameTime -= TICK_TIME;
  }
  // If there is a substantial part of a partial frame remaining, do sub-step.
  // Not great, but keeps things generally smooth.
  // This isn't a critical simulation, so as long as it looks good it's OK.
  if (frameTime / TICK_TIME > 0.1) {
    gameTick(frameTime / TICK_TIME);
  }

  drawScene();
  requestAnimationFrame(tick);
}

function gameTick(fraction) {
  fraction = fraction || 1;
  var target = vec2.create();
  vec2.set(target, targetX, targetY);
  for (var i = 0, len = dots.length; i < len; i++) {
    if (mousePressed) {
      dots[i].accelToward(target, fraction);
    }
    dots[i].moveTick(fraction);
  }
}

function initDots() {
  dots = [];
  for (var i = 0; i < numDots; i++) {
    var x = Math.random() * gl.viewportWidth;
    var y = Math.random() * gl.viewportHeight;
    dots.push(new Dot(x, y));
  }

}

function initWebGL(canvas) {
  gl = null;
  gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    alert('Your browser does not support WebGL :(');
  }
  return gl;
}

function initShaders() {
  var vertShader = getShader(gl, 'shader-vert');
  var fragShader = getShader(gl, 'shader-frag');
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertShader);
  gl.attachShader(shaderProgram, fragShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize shaders!');
  }
  gl.useProgram(shaderProgram);
  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, 'a_Position');
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
  shaderProgram.resolutionUniform = gl.getUniformLocation(shaderProgram, 'u_Resolution');
}

function initBuffers() {
  dotArrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, dotArrayBuffer);
  dotArrayBuffer.itemSize = 2;
}

function bufferDots() {
  var vertices = dots.reduce(function(verts, dot) {
    verts.push(dot.position[0], dot.position[1]);
    return verts;
  }, []);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  dotArrayBuffer.numItems = dots.length;
}

function drawScene() {
  bufferDots();

  gl.viewPort = (0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.bindBuffer(gl.ARRAY_BUFFER, dotArrayBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, dotArrayBuffer.itemSize, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.POINTS, 0, dotArrayBuffer.numItems);
}

function getShader(gl, scriptId) {
  var scriptElement = document.getElementById(scriptId);
  if (!scriptElement) {
    return null;
  }
  var script = '';
  var node = scriptElement.firstChild;
  while (node) {
    if (node.nodeType = Node.TEXT_NODE) {
      script += node.textContent;
    }
    node = node.nextSibling;
  }

  var shader;
  if (scriptElement.type === 'x-shader/x-fragment') {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (scriptElement.type === 'x-shader/x-vertex') {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }

  gl.shaderSource(shader, script);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}

var Dot = function(x, y) {
  this.position = vec2.create();
  this.velocity = vec2.create();
  vec2.set(this.position, x, y);
  vec2.set(this.velocity, 0, 0);
  this.topSpeed = 10;
  this.maxAcceleration = 0.1;
  this.maxAccelerationSq = this.maxAcceleration * this.maxAcceleration;
}

Dot.prototype.moveTick = function(fraction) {
  var scaledVelocity = vec2.create();
  vec2.scale(scaledVelocity, this.velocity, fraction);
  vec2.add(this.position, this.position, scaledVelocity);
}

Dot.prototype.accelToward = function(position, fraction) {
  var targetVelocity = vec2.create();
  vec2.subtract(targetVelocity, position, this.position);
  vec2.scale(targetVelocity, targetVelocity, this.topSpeed / vec2.length(targetVelocity));
  this.approachVelocity(targetVelocity, fraction);
}

// TODO: Is there a better way to do this?
Dot.prototype.approachVelocity = function(targetVelocity, fraction) {
  var acceleration = vec2.create();
  vec2.subtract(acceleration, targetVelocity, this.velocity);
  if (vec2.squaredLength(acceleration) > this.maxAccelerationSq) {
    vec2.scale(acceleration, acceleration, this.maxAcceleration / vec2.length(acceleration));
  }
  vec2.scale(acceleration, acceleration, fraction);
  vec2.add(this.velocity, this.velocity, acceleration);
}
