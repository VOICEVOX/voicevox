#version 300 es

// 実装時に参考にしたウェブサイト・ページのリンクは、プルリクエスト#1828に記載しています

in vec3 pos; // 頂点の位置
in vec2 pointA; // 線分の始点の位置
in vec2 pointB; // 線分の終点の位置

uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;

void main() {
  vec2 basisVecX = normalize(pointB - pointA);
  vec2 basisVecY = vec2(-basisVecX.y, basisVecX.x);
  vec2 rotatedPos = basisVecX * pos.x + basisVecY * pos.y;
  // mix(pointA, pointB, pos.z) は (pos.z == 0) ? pointA : pointB と同じ
  vec2 translatedPos = rotatedPos + mix(pointA, pointB, pos.z);
  vec3 transformedPos = projectionMatrix * translationMatrix * vec3(translatedPos, 1.0);
  gl_Position = vec4(transformedPos.xy, 0.0, 1.0);
}
