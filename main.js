
'use strict';

// Storing relevant values globally to be used throughout application
let
    gl,
    program,
    modelViewMatrix = mat4.create(),
    projectionMatrix = mat4.create(),
    normalMatrix = mat4.create(),
    objects = [],
    angle = 0,
    lastTime = 0,
    lightPosition = [4.5, 3, 15],
    shininess = 200,
    distance = -100;

const VS = `#version 300 es
precision mediump float;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 uNormalMatrix;
uniform vec3 uLightPosition;

in vec3 aVertexPosition;
in vec3 aVertexNormal;

out vec3 vNormal;
out vec3 vLightRay;
out vec3 vEyeVector;

void main(void) {
    vec4 vertex = uModelViewMatrix * vec4(aVertexPosition, 1.0);
    vec4 light = uModelViewMatrix * vec4(uLightPosition, 1.0);

    // Set varyings to be used inside of fragment shader
    vNormal = vec3(uNormalMatrix * vec4(aVertexNormal, 1.0));
    vLightRay = vertex.xyz - light.xyz;
    vEyeVector = -vec3(vertex.xyz);

    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
}
`

const FS=`#version 300 es
precision mediump float;

uniform vec4 uLightAmbient;
uniform vec4 uLightDiffuse;
uniform vec4 uLightSpecular;
uniform vec4 uMaterialAmbient;
uniform vec4 uMaterialDiffuse;
uniform vec4 uMaterialSpecular;
uniform float uShininess;

in vec3 vNormal;
in vec3 vLightRay;
in vec3 vEyeVector;

out vec4 fragColor;

void main(void) {
vec3 L = normalize(vLightRay);
vec3 N = normalize(vNormal);
float lambertTerm = dot(N, -L);

// Ambient
vec4 Ia = uLightAmbient * uMaterialAmbient;
// Diffuse
vec4 Id = vec4(0.0, 0.0, 0.0, 1.0);
// Specular
vec4 Is = vec4(0.0, 0.0, 0.0, 1.0);

if (lambertTerm > 0.0) {
// Update diffuse
Id = uLightDiffuse * uMaterialDiffuse * lambertTerm;
vec3 E = normalize(vEyeVector);
vec3 R = reflect(L, N);
float specular = pow( max(dot(R, E), 0.0), uShininess);
// Update specular
Is = uLightSpecular * uMaterialSpecular * specular;
}

// Final fragment color takes into account ambient, diffuse, and specular
fragColor = vec4(vec3(Ia + Id + Is), 1.0);
}
`

function initProgram() {
    // Configure `canvas`
    const canvas = document.getElementById('glcanvas');

    // Configure `gl`
    gl = canvas.getContext('webgl2');
    gl.clearColor(0.9, 0.9, 0.9, 1);
    gl.clearDepth(100);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);


    // Configure `program`
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, VS);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(vertexShader));
        return null;
      }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, FS);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(fragmentShader));
        return null;
      }


    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Could not initialize shaders');
    }

    gl.useProgram(program);

    // Setting locations onto `program` instance
    program.aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
    program.aVertexNormal = gl.getAttribLocation(program, 'aVertexNormal');
    program.uProjectionMatrix = gl.getUniformLocation(program, 'uProjectionMatrix');
    program.uModelViewMatrix = gl.getUniformLocation(program, 'uModelViewMatrix');
    program.uNormalMatrix = gl.getUniformLocation(program, 'uNormalMatrix');
    program.uMaterialAmbient = gl.getUniformLocation(program, 'uMaterialAmbient');
    program.uMaterialDiffuse = gl.getUniformLocation(program, 'uMaterialDiffuse');
    program.uMaterialSpecular = gl.getUniformLocation(program, 'uMaterialSpecular');
    program.uShininess = gl.getUniformLocation(program, 'uShininess');
    program.uLightPosition = gl.getUniformLocation(program, 'uLightPosition');
    program.uLightAmbient = gl.getUniformLocation(program, 'uLightAmbient');
    program.uLightDiffuse = gl.getUniformLocation(program, 'uLightDiffuse');
    program.uLightSpecular = gl.getUniformLocation(program, 'uLightSpecular');
}

// Configure lights
function initLights() {
    gl.uniform3fv(program.uLightPosition, lightPosition);
    gl.uniform4f(program.uLightAmbient, 1, 1, 1, 1);
    gl.uniform4f(program.uLightDiffuse, 1, 1, 1, 1);
    gl.uniform4f(program.uLightSpecular, 1, 1, 1, 1);
    gl.uniform4f(program.uMaterialAmbient, 0.1, 0.1, 0.1, 1);
    gl.uniform4f(program.uMaterialDiffuse, 0.5, 0.8, 0.1, 1);
    gl.uniform4f(program.uMaterialSpecular, 0.6, 0.6, 0.6, 1);
    gl.uniform1f(program.uShininess, shininess);
}

function draw() {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.perspective(projectionMatrix, 45 * (Math.PI / 180), gl.canvas.width / gl.canvas.height, 0.1, 1000);

    // We will start using the `try/catch` to capture any errors from our `draw` calls
    try {
        // Iterate over every object
        objects.forEach(object => {
            // We will cover these operations in later chapters
            mat4.identity(modelViewMatrix);
            mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, distance]);
            mat4.rotate(modelViewMatrix, modelViewMatrix, 30 * Math.PI / 180, [1, 0, 0]);
            mat4.rotate(modelViewMatrix, modelViewMatrix, angle * Math.PI / 180, [0, 1, 0]);

            // If object is the light, we update its position
            if (object.alias === 'light') {
                const lightPosition = gl.getUniform(program, program.uLightPosition);
                mat4.translate(modelViewMatrix, modelViewMatrix, lightPosition);
            }

            mat4.copy(normalMatrix, modelViewMatrix);
            mat4.invert(normalMatrix, normalMatrix);
            mat4.transpose(normalMatrix, normalMatrix);

            gl.uniformMatrix4fv(program.uModelViewMatrix, false, modelViewMatrix);
            gl.uniformMatrix4fv(program.uProjectionMatrix, false, projectionMatrix);
            gl.uniformMatrix4fv(program.uNormalMatrix, false, normalMatrix);

            // Set lighting data
            gl.uniform4fv(program.uMaterialAmbient, object.ambient);
            gl.uniform4fv(program.uMaterialDiffuse, object.diffuse);
            gl.uniform4fv(program.uMaterialSpecular, object.specular);

            // Bind
            gl.bindVertexArray(object.vao);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, object.ibo);

            // Draw
            gl.drawElements(gl.TRIANGLES, object.indices.length, gl.UNSIGNED_SHORT, 0);

            // Clean
            gl.bindVertexArray(null);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        });
    }
    // We catch the `error` and simply output to the screen for testing/debugging purposes
    catch (error) {
        console.error(error);
    }
}

// Return the associated object, given its `alias`
function getObject(alias) {
    return objects.find(object => object.alias === alias);
}

function animate() {
    const timeNow = new Date().getTime();
    if (lastTime) {
        const elapsed = timeNow - lastTime;
        angle += (90 * elapsed) / 10000.0;
    }
    lastTime = timeNow;
}

function render() {
    requestAnimationFrame(render);
    draw();
    animate();
}

function loadObject(filePath, alias) {
    fetch(filePath)
        .then(res => res.json())
        .then(data => {
            data.alias = alias;

            // Configure VAO
            const vao = gl.createVertexArray();
            gl.bindVertexArray(vao);

            // Vertices
            const vertexBufferObject = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBufferObject);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vertices), gl.STATIC_DRAW);
            // Configure instructions for VAO
            gl.enableVertexAttribArray(program.aVertexPosition);
            gl.vertexAttribPointer(program.aVertexPosition, 3, gl.FLOAT, false, 0, 0);

            // Normals
            const normalBufferObject = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBufferObject);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(utils.calculateNormals(data.vertices, data.indices)), gl.STATIC_DRAW);
            // Configure instructions for VAO
            gl.enableVertexAttribArray(program.aVertexNormal);
            gl.vertexAttribPointer(program.aVertexNormal, 3, gl.FLOAT, false, 0, 0);

            // Indices
            const indexBufferObject = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBufferObject);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);

            // Attach values to be able to reference later for drawing
            data.vao = vao;
            data.ibo = indexBufferObject;

            // Push onto objects for later reference
            objects.push(data);

            // Clean
            gl.bindVertexArray(vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        });
}

// Load each individual object
function load() {
    loadObject('/models/plane.json', 'plane');
    loadObject('/models/cone.json', 'cone');
    loadObject('/models/sphere1.json', 'sphere');
    loadObject('/models/sphere2.json', 'light');
}

function init() {
    initProgram();
    initLights();
    load();
    render();
}

window.onload = init;
