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
uniform vec2 uResolution;

#define MAX_STEPS 200
#define MAX_DIST 250.0
#define SURFACE_DIST 0.05

vec3 rotate(vec3 v, vec3 axis, float angle) {
    mat4 m = rotation3d(axis, angle);
    return (m * vec4(v, 1.0)).xyz;
}

vec3 repeat(vec3 p, float c) {
    return mod(p+0.5*c,c)-0.5*c;
}

float scene(vec3 p) {
    // vec3 s = vec3(0, 0, -4.0);
    vec3 s = repeat(p - vec3(0.0, 0.0, -5.0), 6.0);
    float sphereDist = length(s) - 0.5;

    float distance = sphereDist;

    return distance;
}

float raymarch(vec3 ro, vec3 rd) {
    float dO = 0.0;

    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * dO; // march a certain distance in the ray direction from the origin
        float dS = scene(p);

        dO += dS;

        if(dO > MAX_DIST || dS < SURFACE_DIST) {
            break;
        }
    }

    return dO;
}

vec3 getNormal(vec3 p) {
    float d = scene(p);
    vec2 e = vec2(0.01, 0.0);

    vec3 n = d - vec3(
        scene(p - e.xyy),
        scene(p - e.yxy),
        scene(p - e.yyx)
    );

    return normalize(n);
}

void main() {
    vec2 uv = ((vUv - 0.5) * uResolution.xy) / uResolution.y;

    vec3 color = vec3(0.0);

    // Ray Origin = camera
    vec3 ro = vec3(1.0, 1.0, 5.0 - u_time * 2.0);
    // Ray Direction
    vec3 rd = rotate(normalize(vec3(uv, -1.0)), vec3(0.0, 1.0, 0.0), u_time * 0.1);

    float d = raymarch(ro, rd);
     vec3 lightPosition = vec3(1.0, 1.0, 2.0);
    if(d<MAX_DIST) {
    	vec3 p = ro + rd * d;
        vec3 normal = getNormal(p);
        vec3 lightDirection = normalize(lightPosition - p);
    	float diffuse = max(0.0, dot(normal, lightDirection));
    	color = vec3(diffuse);
    }

    gl_FragColor = vec4(color, 1.0);
}
