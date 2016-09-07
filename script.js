document.body.onload = init;

var canvas;
var boundingClientRect;
var gl;
var dots = [];
var vertices;
var numDots = 1024;
var dotSize = 5.0;
var mousePressed = false;
var touchIdentifier = null;
var mouseX = 0;
var mouseY = 0;
var target = vec2.create();
var resolutionMatrix = vec2.create();
var tickCounter = 0;
var prof = {
  tick: [],
  render: []
};

function init() {
  canvas = document.getElementById('swarm-canvas');
  gl = initWebGL(canvas);
  if (!gl) {
    return;
  }


  document.addEventListener('keypress', function(e) {
    if (String.fromCharCode(e.keyCode) === 'r') {
      numDots =  prompt('How many dots would you like?');
      initDots();
    }
  });

  canvas.addEventListener('mousedown', startClick);
  canvas.addEventListener('touchstart', startTouch);

  canvas.addEventListener('mouseup', endClick);
  canvas.addEventListener('touchend', endTouch);

  canvas.addEventListener('mousemove', moveMouse);
  canvas.addEventListener('touchmove', moveTouch);

  initShaders();
  initBuffers();

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  initDots();

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  currentTime = performance.now();
  requestAnimationFrame(tick);
}

function tick() {
  gameTick();
  drawScene();
  requestAnimationFrame(tick);
}

function gameTick() {
  var targetX = mouseX - boundingClientRect.left;
  var targetY = canvas.height - (mouseY - boundingClientRect.top);
  vec2.set(target, targetX, targetY);
  for (var i = 0, len = dots.length; i < len; i++) {
    if (mousePressed) {
      dots[i].accelToward(target);
    }
    dots[i].moveTick();
  }
}

function initDots() {
  dots = [];
  for (var i = 0; i < numDots; i++) {
    var x = Math.random() * canvas.width;
    var y = Math.random() * canvas.height;
    dots.push(new Dot(x, y));
  }
  vertices = new Float32Array(numDots * 2);
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
  shaderProgram.pointSizeUniform = gl.getUniformLocation(shaderProgram, 'u_PointSize');
}

function initBuffers() {
  dotArrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, dotArrayBuffer);
  dotArrayBuffer.itemSize = 2;
}

function bufferDots() {
  for(var i = 0, len = dots.length; i < len; i++) {
    vertices[2 * i] = dots[i].position[0];
    vertices[2 * i + 1] = dots[i].position[1];
  }
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  dotArrayBuffer.numItems = dots.length;
}

function drawScene() {
  bufferDots();

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniform1f(shaderProgram.pointSizeUniform, dotSize);

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

function resizeCanvas() {
  var width = canvas.clientWidth;
  var height = canvas.clientHeight;
  if (canvas.width != width || canvas.height != height) {
    canvas.width = width;
    canvas.height = height;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  vec2.set(resolutionMatrix, canvas.width, canvas.height);
  gl.uniform2fv(shaderProgram.resolutionUniform, resolutionMatrix);
  boundingClientRect = canvas.getBoundingClientRect();
}

function startClick(e) {
  e.preventDefault();
  mousePressed = true;
  moveTarget(e.clientX, e.clientY);
}

function startTouch(e) {
  e.preventDefault();
  if (!touchIdentifier) {
    touchIdentifier = e.touches[0].identifier;
    mousePressed = true;
    moveTarget(e.touches[0].pageX, e.touches[0].pageY);
  }
}

function moveMouse(e) {
  e.preventDefault();
  moveTarget(e.clientX, e.clientY);
}

function moveTouch(e) {
  e.preventDefault();
  moveTarget(e.touches[0].pageX, e.touches[0].pageY);
}

function endClick(e) {
  e.preventDefault();
  mousePressed = false;
}

function endTouch(e) {
  e.preventDefault();
  for (var i = 0, len = e.touches.length; i < len; i++) {
    if (e.touches[i].identifier === touchIdentifier) {
      // The original touch is still active.
      return;
    }
  }
  // The original touch was not found.
  mousePressed = false;
  touchIdentifier = null;
}

function moveTarget(x, y) {
  mouseX = x;
  mouseY = y;
}

var targetVelocity = vec2.create();
var acceleration = vec2.create();

var Dot = function(x, y) {
  this.position = vec2.create();
  this.velocity = vec2.create();
  vec2.set(this.position, x, y);
  vec2.set(this.velocity, 0, 0);
  this.topSpeed = 10;
  this.maxAcceleration = 0.1;
  this.maxAccelerationSq = this.maxAcceleration * this.maxAcceleration;
}

Dot.prototype.moveTick = function() {
  vec2.add(this.position, this.position, this.velocity);
}

Dot.prototype.accelToward = function(position) {
  vec2.subtract(targetVelocity, position, this.position);
  vec2.scale(targetVelocity, targetVelocity, this.topSpeed / vec2.length(targetVelocity));
  this.approachVelocity(targetVelocity);
}

// TODO: Is there a better way to do this?
Dot.prototype.approachVelocity = function(targetVelocity) {
  vec2.subtract(acceleration, targetVelocity, this.velocity);
  if (vec2.squaredLength(acceleration) > this.maxAccelerationSq) {
    vec2.scale(acceleration, acceleration, this.maxAcceleration / vec2.length(acceleration));
  }
  vec2.add(this.velocity, this.velocity, acceleration);
}
