
'use strict';

// Storing relevant values globally to be used throughout application
let
    gl,
    program,
    skyprogram,
    positionLocation,
    positionBuffer,
    viewDirectionProjectionInverseLocation,
    skyboxLocation,
    modelViewMatrix = mat4.create(),
    projectionMatrix = mat4.create(),
    normalMatrix = mat4.create(),
    objects = [],
    angle = 0,
    lastTime = 0,
    lightPosition = [-50, 50, -14],
    lp = mat4.create(),
    shininess = 200,
    distance = -70;

const skyVS = `attribute vec4 a_position;
varying vec4 v_position;
void main() {
  v_position = a_position;
  gl_Position = a_position;
  gl_Position.z = 1.0;
}`

const skyFS = `precision mediump float;
uniform samplerCube u_skybox;
uniform mat4 u_viewDirectionProjectionInverse;
 
varying vec4 v_position;
void main() {
  vec4 t = u_viewDirectionProjectionInverse * v_position;
  gl_FragColor = textureCube(u_skybox, normalize(t.xyz / t.w));
}`

function setGeometry(gl) {
    var positions = new Float32Array(
        [
            -1, -1,
            1, -1,
            -1, 1,
            -1, 1,
            1, -1,
            1, 1,
        ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
}

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
    vec4 light = vec4(uLightPosition, 1.0);

    // Set varyings to be used inside of fragment shader
    vNormal = vec3(uNormalMatrix * vec4(aVertexNormal, 1.0));
    vLightRay = vertex.xyz - light.xyz;
    vEyeVector = -vec3(vertex.xyz);

    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
}
`

const FS = `#version 300 es
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

    // configure skybox program
    const skyvertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(skyvertexShader, skyVS);
    gl.compileShader(skyvertexShader);
    if (!gl.getShaderParameter(skyvertexShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(skyvertexShader));
        return null;
    }

    const skyfragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(skyfragmentShader, skyFS);
    gl.compileShader(skyfragmentShader);
    if (!gl.getShaderParameter(skyfragmentShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(skyfragmentShader));
        return null;
    }

    skyprogram = gl.createProgram();
    gl.attachShader(skyprogram, skyvertexShader);
    gl.attachShader(skyprogram, skyfragmentShader);
    gl.linkProgram(skyprogram);

    positionLocation = gl.getAttribLocation(skyprogram, "a_position");

    skyboxLocation = gl.getUniformLocation(skyprogram, "u_skybox");
    viewDirectionProjectionInverseLocation =
        gl.getUniformLocation(skyprogram, "u_viewDirectionProjectionInverse");

    // Create a buffer for positions
    positionBuffer = gl.createBuffer();
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Put the positions in the buffer
    setGeometry(gl);

    // Create a texture.
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    const faceInfos = [
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            url: 'images/4161612.jpg',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            url: 'images/4161612.jpg',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            url: 'images/4161612.jpg',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            url: 'images/4161612.jpg',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            url: 'images/4161612.jpg',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            url: 'images/4161612.jpg',
        },
    ];
    faceInfos.forEach((faceInfo) => {
        const { target, url } = faceInfo;

        // Upload the canvas to the cubemap face.
        const level = 0;
        const internalFormat = gl.RGBA;
        const width = 512;
        const height = 512;
        const format = gl.RGBA;
        const type = gl.UNSIGNED_BYTE;

        // setup each face so it's immediately renderable
        gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);

        // Asynchronously load an image
        const image = new Image();
        image.src = url;
        image.addEventListener('load', function () {
            // Now that the image has loaded make copy it to the texture.
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
            gl.texImage2D(target, level, internalFormat, format, type, image);
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        });
    });
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);






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

            if (object.alias === 'cylinder1') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [0.3, 2, 0.3]);
                // mat4.translate(modelViewMatrix, modelViewMatrix, [3, 0, 0]);

            }
            if (object.alias === 'cylinder2') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [0.1, 1.5, 0.1]);
                mat4.translate(modelViewMatrix, modelViewMatrix, [180, 0, 0]);

            }
            if (object.alias === 'cylinder3') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [0.1, 1.5, 0.1]);
                mat4.translate(modelViewMatrix, modelViewMatrix, [-180, 0, 0]);

            }
            if (object.alias === 'cylinder4') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [0.1, 1.5, 0.1]);
                mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, 180]);

            }
            if (object.alias === 'cylinder5') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [0.1, 1.5, 0.1]);
                mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -180]);

            }
            if (object.alias === 'cylinder6') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [4, 0.1, 4]);
                mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, 0]);

            }

            if (object.alias === 'cube1') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [0.5, 0.5,0.5]);
                mat4.rotate(modelViewMatrix, modelViewMatrix, 90 * Math.PI / 180, [-1, 0, 0]);
                mat4.rotate(modelViewMatrix, modelViewMatrix, 90 * Math.PI / 180, [0, 0, 0]);
                mat4.translate(modelViewMatrix, modelViewMatrix, [-36,0 , 2*Math.sin(angle / 2) + 4]);
            }
            if (object.alias === 'cube2') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [0.5, 0.5,0.5]);
                mat4.rotate(modelViewMatrix, modelViewMatrix, 90 * Math.PI / 180, [-1, 0, 0]);
                mat4.rotate(modelViewMatrix, modelViewMatrix, 90 * Math.PI / 180, [0, 0, 1]);
                mat4.translate(modelViewMatrix, modelViewMatrix, [-36, 0, 2*Math.sin(angle / 2 + Math.PI / 2) + 4]);
            }
            if (object.alias === 'cube3') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [0.5, 0.5,0.5]);
                mat4.rotate(modelViewMatrix, modelViewMatrix, 90 * Math.PI / 180, [-1, 0, 0]);
                mat4.rotate(modelViewMatrix, modelViewMatrix, 90 * Math.PI / 180, [0, 0, -1]);
                mat4.translate(modelViewMatrix, modelViewMatrix, [-36, 0, 2*Math.sin(angle / 2 - Math.PI / 2) + 4]);
            }
            if (object.alias === 'cube4') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [0.5, 0.5,0.5]);
                mat4.rotate(modelViewMatrix, modelViewMatrix, 90 * Math.PI / 180, [-1, 0, 0]);
                mat4.rotate(modelViewMatrix, modelViewMatrix, 180 * Math.PI / 180, [0, 0, 1]);
                mat4.translate(modelViewMatrix, modelViewMatrix, [-36, 0, Math.sin(angle / 2 + 2*Math.PI / 2 * 3) + 4]);
            }


            if (object.alias === 'cone') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [4, 1, 4]);
                mat4.translate(modelViewMatrix, modelViewMatrix, [3, 20, 0]);
            }

            if (object.alias === 'wall1') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [2, 1, 2]);
                mat4.rotate(modelViewMatrix, modelViewMatrix, -angle * Math.PI / 180, [0, 1, 0]);

                mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, 14]);
            }
            if (object.alias === 'wall2') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [2, 1, 2]);
                mat4.rotate(modelViewMatrix, modelViewMatrix, -angle * Math.PI / 180, [0, 1, 0]);

                mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -14]);
            }
            if (object.alias === 'wall3') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [2, 1, 2]);
                mat4.rotate(modelViewMatrix, modelViewMatrix, 90 * Math.PI / 180, [0, 1, 0]);
                mat4.rotate(modelViewMatrix, modelViewMatrix, -angle * Math.PI / 180, [0, 1, 0]);

                mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, 14]);

            }
            if (object.alias === 'wall4') {
                mat4.scale(modelViewMatrix, modelViewMatrix, [2, 1, 2]);
                mat4.rotate(modelViewMatrix, modelViewMatrix, 90 * Math.PI / 180, [0, 1, 0]);
                mat4.rotate(modelViewMatrix, modelViewMatrix, -angle * Math.PI / 180, [0, 1, 0]);

                mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -14]);
            }
            // if (object.alias === 'wall5') {
            //     mat4.scale(modelViewMatrix, modelViewMatrix, [40, 0.01, 1]);
            //     mat4.rotate(modelViewMatrix, modelViewMatrix, 90 * Math.PI / 180, [0, 1, 0]);
            //     // mat4.rotate(modelViewMatrix, modelViewMatrix, -angle * Math.PI / 180, [0, 1, 0]);

            //     // mat4.translate(modelViewMatrix, modelViewMatrix, [0, -5, 0]);
            // }



            gl.useProgram(program);

            mat4.identity(lp);
            mat4.translate(lp, lp, lightPosition);
            // mat4.rotate(lp, lp, 30 * Math.PI / 180, [1, 0, 0]);
            mat4.rotate(lp, lp, angle * Math.PI / 180, [0, 1, 0]);
            // console.log(lp);
            gl.uniform3fv(program.uLightPosition, lp);

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



            gl.enable(gl.CULL_FACE);
            gl.enable(gl.DEPTH_TEST);
            gl.useProgram(skyprogram);
            gl.enableVertexAttribArray(positionLocation);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            var size = 2;          // 2 components per iteration
            var type = gl.FLOAT;   // the data is 32bit floats
            var normalize = false; // don't normalize the data
            var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
            var offset = 0;        // start at the beginning of the buffer
            gl.vertexAttribPointer(
                positionLocation, size, type, normalize, stride, offset);


            var viewDirectionProjectionInverseMatrix = mat4.create();
            mat4.rotate(viewDirectionProjectionInverseMatrix, projectionMatrix, angle * Math.PI / 180, [0, 1, 0]);
            mat4.invert(viewDirectionProjectionInverseMatrix, viewDirectionProjectionInverseMatrix);
            gl.uniformMatrix4fv(
                viewDirectionProjectionInverseLocation, false,
                viewDirectionProjectionInverseMatrix);

            gl.uniform1i(skyboxLocation, 0);

            // let our quad pass the depth test at 1.0
            gl.depthFunc(gl.LEQUAL);

            // Draw the geometry.
            // gl.disable(gl.gl.CULL_FACE
            gl.drawArrays(gl.TRIANGLES, 0, 1 * 6);
            gl.bindVertexArray(null);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            gl.useProgram(program);

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
    // loadObject('/models/horse.json', 'horse');


    loadObject('/models/cone.json', 'cone');
    // loadObject('/models/sphere1.json', 'sphere');
    loadObject('/models/cylinder.json', 'cylinder1');
    loadObject('/models/cylinder.json', 'cylinder2');
    loadObject('/models/cylinder.json', 'cylinder3');
    loadObject('/models/cylinder.json', 'cylinder4');
    loadObject('/models/cylinder.json', 'cylinder5');
    loadObject('/models/cylinder.json', 'cylinder6');
    // loadObject('/models/ball.json', 'sphere');

    loadObject('/models/horse.json', 'cube1');
    loadObject('/models/horse.json', 'cube2');

    loadObject('/models/horse.json', 'cube3');

    loadObject('/models/horse.json', 'cube4');
    loadObject('/models/wall.json', 'wall1');
    loadObject('/models/wall.json', 'wall2');
    loadObject('/models/wall.json', 'wall3');
    loadObject('/models/wall.json', 'wall4');
    // loadObject('/models/wall.json', 'wall5');






    // loadObject('/models/sphere2.json', 'light');

}

function init() {
    initProgram();
    initLights();
    load();
    render();

    initControls();
}

function initControls() {
    utils.configureControls({
        'Top Color': {
            value: [235, 0, 210],
            onChange: v => getObject('cone').diffuse = [...utils.normalizeColor(v), 1.0]
        },
        'Plane Color': {
            value: [145, 145, 189],
            onChange: v => getObject('cylinder6').diffuse = [...utils.normalizeColor(v), 1.0]
        },
        Shininess: {
            value: shininess,
            min: 1, max: 50, step: 0.1,
            onChange: v => gl.uniform1f(program.uShininess, v)
        },
        Distance: {
            value: distance,
            min: -200, max: -50, step: 0.1,
            onChange: v => distance = v
        }
    });
}

window.onload = init;
