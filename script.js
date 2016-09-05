document.body.onload = init;

x = 0.0;
y = 0.0;
z = -5.0;
rot = 0;
framerate = 60;
mousePressed = false;
targetX = 0;
targetY = 0;
tickCounter = 0;
prof = {
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
  /*
  dots = [
    new Dot(100, 100),
    new Dot(200, 200),
    new Dot(300, 300)
  ];
  */
  dots = [];
  for (var i = 0; i < 1000; i++) {
    var x = Math.random() * canvas.width;
    var y = Math.random() * canvas.height;
    dots.push(new Dot(x, y));
  }

  initShaders();
  initBuffers();

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);


  setInterval(tick, 1000/framerate);
}

function tick() {
  var startTime = performance.now();
  gameTick();
  prof.tick.push(performance.now() - startTime);
  startTime = performance.now();
  drawScene();
  prof.render.push(performance.now() - startTime);
  tickCounter++;
  if (tickCounter % 300 === 0) {
    var avgTick = prof.tick.reduce(function(p, c) {
      return p + c;
    }) / prof.tick.length;
    var avgRender = prof.render.reduce(function(p, c) {
      return p + c;
    }) / prof.render.length;
    console.log('avgTick: ' + avgTick + ' ms');
    console.log('avgRend: ' + avgRender + ' ms');
    console.log('avgFrame: ' + (avgTick + avgRender) + ' ms');
    prof.tick = [];
    prof.render = [];
  }
}

function gameTick() {
  var target = vec2.create();
  vec2.set(target, targetX, targetY);
  for (var i = 0, len = dots.length; i < len; i++) {
    if (mousePressed) {
      //var velocity = vec2.create();
      //vec2.subtract(velocity, target, dots[i].position);
      //vec2.scale(velocity, velocity, 1 / vec2.length(velocity));
      dots[i].accelToward(target);
      //dots[i].velocity = velocity;
    }
    dots[i].moveTick();
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
  var resolutionMatrix = vec2.create();
  vec2.set(resolutionMatrix, gl.viewportWidth, gl.viewportHeight);

  gl.viewPort = (0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.bindBuffer(gl.ARRAY_BUFFER, dotArrayBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, dotArrayBuffer.itemSize, gl.FLOAT, false, 0, 0);

  gl.uniform2fv(shaderProgram.resolutionUniform, resolutionMatrix);

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

Dot.prototype.moveTick = function() {
  vec2.add(this.position, this.position, this.velocity);
}

Dot.prototype.accelToward = function(position) {
  var targetVelocity = vec2.create();
  vec2.subtract(targetVelocity, position, this.position);
  vec2.scale(targetVelocity, targetVelocity, this.topSpeed / vec2.length(targetVelocity));
  this.approachVelocity(targetVelocity);
}

// TODO: Is there a better way to do this?
Dot.prototype.approachVelocity = function(targetVelocity) {
  var acceleration = vec2.create();
  vec2.subtract(acceleration, targetVelocity, this.velocity);
  if (vec2.squaredLength(acceleration) > this.maxAccelerationSq) {
    vec2.scale(acceleration, acceleration, this.maxAcceleration / vec2.length(acceleration));
  }
  vec2.add(this.velocity, this.velocity, acceleration);
}
