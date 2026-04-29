#version 300 es
precision mediump float;

uniform vec4 uLineColor;

out vec4 outColor;

void main() {
  outColor = uLineColor;
}
