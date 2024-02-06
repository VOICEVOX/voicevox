attribute vec3 pos;
attribute vec2 p1, p2;

uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;

void main() {
  vec2 basisVecX = normalize(p2 - p1);
  vec2 basisVecY = vec2(-basisVecX.y, basisVecX.x);
  vec2 posOfP1Basis = p1 + basisVecX * pos.x + basisVecY * pos.y;
  vec2 posOfP2Basis = p2 + basisVecX * pos.x + basisVecY * pos.y;
  vec3 calculatedPos = vec3(mix(posOfP1Basis, posOfP2Basis, pos.z), 1.0);
  gl_Position = vec4((projectionMatrix * translationMatrix * calculatedPos).xy, 0.0, 1.0);
}
