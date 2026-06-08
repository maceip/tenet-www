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

//
// GLSL textureless classic 2D noise "cnoise",
// with an RSL-style periodic variant "pnoise".
// Author:  Stefan Gustavson (stefan.gustavson@liu.se)
// Version: 2011-08-22
//
// Many thanks to Ian McEwan of Ashima Arts for the
// ideas for permutation and gradient selection.
//
// Copyright (c) 2011 Stefan Gustavson. All rights reserved.
// Distributed under the MIT license. See LICENSE file.
// https://github.com/ashima/webgl-noise
//

vec4 mod289(vec4 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x)
{
  return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec2 fade(vec2 t) {
  return t*t*t*(t*(t*6.0-15.0)+10.0);
}

// Classic Perlin noise
float cnoise(vec2 P)
{
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod289(Pi); // To avoid truncation effects in permutation
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;

  vec4 i = permute(permute(ix) + iy);

  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
  vec4 gy = abs(gx) - 0.5 ;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;

  vec2 g00 = vec2(gx.x,gy.x);
  vec2 g10 = vec2(gx.y,gy.y);
  vec2 g01 = vec2(gx.z,gy.z);
  vec2 g11 = vec2(gx.w,gy.w);

  vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
  g00 *= norm.x;
  g01 *= norm.y;
  g10 *= norm.z;
  g11 *= norm.w;

  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));

  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
  return 2.3 * n_xy;
}

varying vec2 vUv;

uniform float u_time;
uniform vec2 uResolution;
uniform int uQuality;
uniform float uSunHeight;
uniform sampler2D uTexture;

#define MAX_STEPS 100
#define MAX_DIST 200.0
#define SURFACE_DIST 0.01
#define PI 3.14159265359

vec3 rotate(vec3 v, vec3 axis, float angle) {
    mat4 m = rotation3d(axis, angle);
    return (m * vec4(v, 1.0)).xyz;
}

mat2 rot(float a) {
    float sa = sin(a);
    float ca = cos(a);
    return mat2(ca, -sa, sa, ca);
}

mat3 getCam(vec3 ro, vec3 lookAt) {
    vec3 camF = normalize(vec3(lookAt - ro));
    vec3 camR = normalize(cross(vec3(0, 1, 0), camF));
    vec3 camU = cross(camF, camR);
    return mat3(camR, camU, camF);
}

vec3 repeat(vec3 p, float c) {
    return mod(p+0.5*c,c)-0.5*c;
}

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b-a)/k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// https://iquilezles.org/articles/smin
float smax( float a, float b, float k ) {
    float h = max(k-abs(a-b),0.0);
    return max(a, b) + h*h*0.25/k;
}

float fbm(vec2 p) {
    float res = 0.0;
    float amp = 0.8;
    float freq = 1.5;

    for(int i = 0; i < uQuality; i++) {
        res += amp * cnoise(p * 0.8);
        amp *= 0.5;
        freq *= 1.05;
        p = p * freq * rot(PI / 4.0);
    }
    return res;
}

vec3 sky(vec3 p, vec3 rd, vec3 lightPosition) {
    vec3 col = vec3(0.0);
    float sun = 0.01 / (1.0 - dot(rd, normalize(lightPosition)));

    // col += mix(col, vec3(0.5,0.6,0.7), 2.0 * fbm(vec2(20.9 * length(rd.xz), rd.y)));
    col += vec3(0.3,0.6,0.8);
    col += sun * 0.1;
    return col;
}

float water(vec3 p) {
    float dist = p.y + 2.9 + sin(u_time) * 0.02;
    dist += max(1.5 * cnoise(p.xz * 0.02 + u_time * 0.1) - 0.5, -0.4);
    return dist;
}

mat2 m=mat2(.8,-.6,.6,.8);

vec3 noised(in vec2 x){
        vec2 p=floor(x);
        vec2 f=fract(x);
        vec2 u=f*f*(3.-2.*f);
        float a=textureLod(uTexture,(p+vec2(.0,.0))/256.,0.).x;
        float b=textureLod(uTexture,(p+vec2(1.0,.0))/256.,0.).x;
        float c=textureLod(uTexture,(p+vec2(.0,1.0))/256.,0.).x;
        float d=textureLod(uTexture,(p+vec2(1.0,1.0))/256.,0.).x;
       
        return vec3(a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y,
        6.*f*(1.-f)*(vec2(b-a,c-a)+(a-b-c+d)*u.yx));
}

float terrain(vec2 p){
    vec2 p1 = p * 0.15;
    float a = -0.1;
    float b = 1.9;
	vec2  d = vec2(0.0);
    float scl = 2.95;
    for( int i=0; i<uQuality; i++ ) {
        vec3 n = noised(p1);
        d+=n.yz;
        a += b*n.x/(dot(d,d)+1.);
        b *= -0.4;
        a *= .85;
        p1 = m*p1*scl;
    }
    return a*3.0;
}
float scene(vec3 p){
    return p.y-(terrain(p.zx));
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

float softShadows( in vec3 ro, in vec3 rd, float mint, float maxt, float k ) {
    float resultingShadowColor = 1.0;
    float t = mint;
    for(int i = 0; i < 50 && t < maxt; i++) {
        float h = scene(ro + rd*t);
        if( h < 0.001 )
            return 0.0;
        resultingShadowColor = min(resultingShadowColor, k*h/t );
        t += h;
    }
    return resultingShadowColor ;
}

float a = 0.005;
float b = 0.8;

// vec3 applyFog(vec3 rgb, float distance, vec3 rayDirection, vec3 sunDirection) {
//     float fogAmount = 1.0 - exp( -distance*b );
//     float sunAmount = max(0.0, dot(rayDirection, sunDirection));
//     vec3  fogColor  = mix(vec3(0.5, 0.6, 0.7), vec3(1.0, 0.9, 0.7), pow(sunAmount, 18.0));
//     return mix(rgb, fogColor, fogAmount);
//     // return rgb * fogAmount + fogColor * exp( -distance*b );
// }

vec3 applyFog(vec3 rgb, float distance, vec3 rayOrigin, vec3 rayDirection, vec3 sunDirection) {
    float fogAmount = (a/b) * exp(-rayOrigin.y * b) * (1.0 - exp(-distance * rayDirection.y*b))/rayDirection.y * 8.0;
    float sunAmount = max(0.0, dot(rayDirection, sunDirection));
    vec3  fogColor  = mix(vec3(0.5, 0.6, 0.7), vec3(1.0, 0.9, 0.7), pow(sunAmount, 50.0));
    return mix(rgb, fogColor, fogAmount);
    // return rgb * fogAmount + fogColor * exp( -distance*b );
}

vec3 getTerrainColor(vec3 p, vec3 normal) {
    float height = p.y;
    
    // Base colors for different terrain types
    vec3 grassColor = vec3(0.3, 0.5, 0.2);
    vec3 rockColor = vec3(0.5, 0.4, 0.45);
    vec3 snowColor = vec3(0.99, 0.99, 0.99);
    vec3 sandColor = vec3(0.76, 0.7, 0.5);
    
    // Slope-based coloring (steeper = more rocky)
    float slope = 1.0 - normal.y; // 0 = flat, 1 = vertical
    
    // Height-based coloring with smoothstep transitions
    
    vec3 baseColor = mix(snowColor, rockColor, smoothstep(0.0, 1.0, height));
    baseColor = mix(baseColor, snowColor, smoothstep(15.0, 20.0, height));
    
    // Mix in rock color based on slope
    baseColor = mix(baseColor, rockColor, smoothstep(0.3, 0.7, slope));
    
    // Add some noise variation
    float colorNoise = 0.1 * cnoise(p.xz * 0.2);
    baseColor += vec3(colorNoise);
    
    return baseColor;
}

void main() {
    vec2 uv = ((vUv - 0.5) * uResolution.xy) / uResolution.y;

    vec3 color = vec3(0.0);

    // Ray Origin = camera
    vec3 ro = vec3(0.0, 6.0, -u_time*5.0);
    //  ro.xz *= rot(u_time * 0.5);
    vec3 lookAt = vec3(0, 30.0, 0);
    // Ray Direction
     vec3 rd=normalize(vec3(uv,-1.));

    vec3 lightPosition = vec3(100.0, uSunHeight, -200.0) * 4.0;

    float d = raymarch(ro, rd);
    vec3 p = ro + rd * d;
    
    if(d<MAX_DIST) {
    	
        vec3 normal = getNormal(p);
        
        vec3 lightDirection = normalize(lightPosition - p);
       
    	float diffuse = max(0.0, dot(normal, lightDirection));
        float shadow = softShadows(p, lightDirection, 0.1, 5.0, 64.0);
        
        // Get terrain color based on position and normal
        vec3 terrainColor = getTerrainColor(p, normal);
        
    	color = terrainColor * diffuse * shadow;
        
        // Add ambient light so shadows aren't completely black
        float ambient = 0.2;
        color += terrainColor * ambient;
        
        color = applyFog(color, d, ro, rd, lightDirection);
    } else {
        color = sky(p, rd, lightPosition);
    }

    gl_FragColor = vec4(color, 1.0);
}
