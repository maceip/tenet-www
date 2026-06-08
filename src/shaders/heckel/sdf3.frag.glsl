#define GLSLIFY 1
mat4 rotation3d(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;

  return mat4(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
    0.0,                                0.0,                                0.0,                                1.0
  );
}

varying vec2 vUv;

uniform float u_time;
uniform vec2 uMouse;
uniform vec2 uResolution;

float sdSphere(vec3 p) {
    return length(p) - 1.0;
}

vec3 rotate(vec3 v, vec3 axis, float angle) {
    mat4 m = rotation3d(axis, angle);
    return (m * vec4(v, 1.0)).xyz;
}

float sdSine(vec3 p) {
    return 1.0 - (sin(p.x) + sin(p.y) + sin(p.z))/3.0;
}

float scene(vec3 p) {
    vec3 p1 = rotate(p, vec3(1.0), u_time * 0.4);

    float scale = 8.0 + 6.0 * sin(u_time * 0.5);
    return max(sdSphere(p1), (0.8 - sdSine(p1 * scale))/(scale * 2.0));
}

vec3 getNormal(vec3 p) {
    float d = scene(p);
    vec2 e = vec2(0.001, 0.0);

    vec3 n = d - vec3(
        scene(p - e.xyy),
        scene(p - e.yxy),
        scene(p - e.yyx)
    );

    return normalize(n);
}

vec3 getColor(float amount) {
    vec3 color = 0.5 + 0.5 * cos(6.2831 * (vec3(0.2, 0.0, 0.67) + amount * vec3(1.0, 1.0, 0.5)));
    return color * amount;
}

vec3 getColorAmount(vec3 p) {
    float amount = clamp((2.3 - length(p))/2.0, 0.0, 1.0);
    vec3 color = 0.5 + 0.5 * cos(6.2831 * (vec3(0.2, 0.0, 0.67) + amount * vec3(1.0, 1.0, 0.5)));
    return color * amount;
}

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y;

    vec2 p = uv;

    // p.x += uMouse.x * 0.1;
    // p.y -= uMouse.y * 0.1;

    vec3 rayOrigin = vec3(p, 1.0);
    vec3 rayDirection = normalize(vec3(uv, -1.0));
    vec3 rayPosition = rayOrigin;

    float distance = 0.0;
    float rayLength = 0.0;

    vec3 light = vec3(-1.0, 1.0, 1.0);

    vec3 color = vec3(0.0);

    for(int i = 0; i < 64; i++) {
        distance = scene(rayPosition);
        rayLength += distance;

        rayPosition = rayOrigin + rayLength * rayDirection;

        if(abs(distance) < 0.001) {
            vec3 n = getNormal(rayPosition);
            float diffuse = max(0.0, dot(n, light));

            // color += getColor(diffuse / 2.0);
            break;
        }

        color += 0.05 * getColorAmount(rayPosition);
    }

    gl_FragColor = vec4(color, 1.0);

    gl_FragColor.r -= abs(uMouse.x)  * 0.5;
    gl_FragColor.b += abs(uMouse.y)  * 0.2;
}
