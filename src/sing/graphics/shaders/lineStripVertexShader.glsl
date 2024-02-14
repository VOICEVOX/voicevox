#version 300 es

in vec3 pos; // 線分の頂点の位置
in vec2 p1; // 線分の始点の位置
in vec2 p2; // 線分の終点の位置

uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;

void main() {
  vec2 basisVecX = normalize(p2 - p1);
  vec2 basisVecY = vec2(-basisVecX.y, basisVecX.x);
  vec2 rotatedPos = basisVecX * pos.x + basisVecY * pos.y;
  vec3 calculatedPos = vec3(mix(p1, p2, pos.z) + rotatedPos, 1.0);
  gl_Position = vec4((projectionMatrix * translationMatrix * calculatedPos).xy, 0.0, 1.0);
}
