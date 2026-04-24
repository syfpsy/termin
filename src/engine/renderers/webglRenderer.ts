import type { Appearance } from '../../state/types';
import type { PhosphorBuffer } from '../grid';
import { renderBufferToCanvas } from './canvasRenderer';

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_texel;
uniform float u_scanlines;
uniform float u_curvature;
uniform float u_flicker;
uniform float u_chromatic;
uniform float u_bloom;
uniform float u_time;
varying vec2 v_uv;

float noise(float x) {
  return fract(sin(x * 12.9898) * 43758.5453);
}

vec2 curveUv(vec2 uv) {
  vec2 centered = uv * 2.0 - 1.0;
  float r2 = dot(centered, centered);
  centered *= 1.0 + u_curvature * r2 * 0.16;
  return centered * 0.5 + 0.5;
}

vec4 sampleBloom(vec2 uv) {
  vec4 base = texture2D(u_texture, uv);
  vec4 blur = vec4(0.0);
  blur += texture2D(u_texture, uv + vec2(u_texel.x, 0.0));
  blur += texture2D(u_texture, uv - vec2(u_texel.x, 0.0));
  blur += texture2D(u_texture, uv + vec2(0.0, u_texel.y));
  blur += texture2D(u_texture, uv - vec2(0.0, u_texel.y));
  blur *= 0.25;
  return base + blur * u_bloom * 0.22;
}

void main() {
  vec2 uv = curveUv(v_uv);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.02, 0.025, 0.018, 1.0);
    return;
  }

  vec2 offset = vec2(u_chromatic * 0.0028, 0.0);
  vec4 color = sampleBloom(uv);
  if (u_chromatic > 0.001) {
    color.r = sampleBloom(uv + offset).r;
    color.b = sampleBloom(uv - offset).b;
  }

  float scan = mod(gl_FragCoord.y, 3.0) < 1.0 ? 1.0 - (u_scanlines * 0.28) : 1.0;
  float flicker = 1.0 + (noise(floor(u_time * 30.0)) - 0.5) * u_flicker * 0.12;
  color.rgb *= scan * flicker;
  gl_FragColor = vec4(color.rgb, 1.0);
}
`;

export class WebGlPhosphorRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private sourceCanvas = document.createElement('canvas');

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) throw new Error('WebGL is not available in this browser.');
    this.gl = gl;
    this.program = createProgram(gl);
    const texture = gl.createTexture();
    if (!texture) throw new Error('Unable to create WebGL texture.');
    this.texture = texture;
    this.initGeometry();
  }

  render(buffer: PhosphorBuffer, appearance: Appearance, width: number, height: number, timeMs: number) {
    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.floor(width * dpr));
    const pixelHeight = Math.max(1, Math.floor(height * dpr));

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    renderBufferToCanvas(this.sourceCanvas, buffer, appearance, {
      width: pixelWidth,
      height: pixelHeight,
      background: '#050604',
    });

    const gl = this.gl;
    gl.viewport(0, 0, pixelWidth, pixelHeight);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.sourceCanvas);

    uniform1i(gl, this.program, 'u_texture', 0);
    uniform2f(gl, this.program, 'u_texel', 1 / pixelWidth, 1 / pixelHeight);
    uniform1f(gl, this.program, 'u_scanlines', appearance.scanlines);
    uniform1f(gl, this.program, 'u_curvature', appearance.chrome === 'bezel' ? appearance.curvature : 0);
    uniform1f(gl, this.program, 'u_flicker', appearance.flicker);
    uniform1f(gl, this.program, 'u_chromatic', appearance.chromatic);
    uniform1f(gl, this.program, 'u_bloom', appearance.bloom);
    uniform1f(gl, this.program, 'u_time', timeMs / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private initGeometry() {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  }
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create WebGL program.');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'WebGL program link failed.');
  }
  return program;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create WebGL shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'WebGL shader compile failed.');
  }
  return shader;
}

function uniform1i(gl: WebGLRenderingContext, program: WebGLProgram, name: string, value: number) {
  gl.uniform1i(gl.getUniformLocation(program, name), value);
}

function uniform1f(gl: WebGLRenderingContext, program: WebGLProgram, name: string, value: number) {
  gl.uniform1f(gl.getUniformLocation(program, name), value);
}

function uniform2f(gl: WebGLRenderingContext, program: WebGLProgram, name: string, x: number, y: number) {
  gl.uniform2f(gl.getUniformLocation(program, name), x, y);
}
