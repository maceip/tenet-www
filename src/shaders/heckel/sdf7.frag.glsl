#define GLSLIFY 1
// https://www.shadertoy.com/view/XsyGWV
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
#define MAX_DIST 200.
#define SURFACE_DIST.001
#define PI 3.14159265359

vec3 lightPosition=vec3(-0.7,0.5,-0.5);

float sdSphere(vec3 p,float radius){
    return length(p)-radius;
}

vec3 rotate(vec3 v,vec3 axis,float angle){
    mat4 m=rotation3d(axis,angle);
    return(m*vec4(v,1.)).xyz;
}

mat2 rot(float a){
    float sa=sin(a);
    float ca=cos(a);
    return mat2(ca,-sa,sa,ca);
}

// mat3 getCam(vec3 ro, vec3 lookAt) {
    //     vec3 camF = normalize(vec3(lookAt - ro));
    //     vec3 camR = normalize(cross(vec3(0, 1, 0), camF));
    //     vec3 camU = cross(camF, camR);
    //     return mat3(camR, camU, camF);
// }

vec3 repeat(vec3 p,float c){
    return mod(p+.5*c,c)-.5*c;
}

// https://iquilezles.org/articles/smin

float smin(float a,float b,float k){
    float h=clamp(.5+.5*(b-a)/k,0.,1.);
    return mix(b,a,h)-k*h*(1.-h);
}

float smax(float a,float b,float k){
    float h=max(k-abs(a-b),0.);
    return max(a,b)+h*h*.25/k;
}

mat2 m=mat2(.8,-.6,.6,.8);

float hash(vec3 p){
    p=5.*fract(p*.3183099+vec3(.71,.113,.419));
    return-1.+2.*fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}

// vec3 noised(vec2 x){
//     vec2 p=floor(x);
//     vec2 w=fract(x);
    
//     vec2 u=w*w*w*(w*(w*6.-15.)+10.);
//     vec2 du=30.*w*w*(w*(w-2.)+1.);
    
//     float a=textureLod(uTexture,(p+vec2(.5,.5))/256.,0.).x;
//     float b=textureLod(uTexture,(p+vec2(1.5,.5))/256.,0.).x;
//     float c=textureLod(uTexture,(p+vec2(.5,1.5))/256.,0.).x;
//     float d=textureLod(uTexture,(p+vec2(1.5,1.5))/256.,0.).x;
    
//     // float a=hash(vec3(p,0));
//     // float b=hash(vec3(p+vec2(1,0),0));
//     // float c=hash(vec3(p+vec2(0,1),0));
//     // float d=hash(vec3(p+vec2(1,1),0));
    
//     float k0=a;
//     float k1=b-a;
//     float k2=c-a;
//     float k3=a-b-c+d;
    
//     return vec3(
//         k0+k1*u.x+k2*u.y+k3*u.x*u.y,
//         du.x*(k1+k3*u.y),
//         du.y*(k2+k3*u.x)
//     );
// }

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
    vec2 p1 = p * 0.065;
    float a = -0.1;
    float b = 1.9;
	vec2  d = vec2(0.0);
    float scl = 2.95;
    for( int i=0; i<5; i++ ) {
        vec3 n = noised(p1);
        d+=n.yz;
        a += b*n.x/(dot(d,d)+1.);
        b *= -0.4;
        a *= .85;
        p1 = m*p1*scl;
    }
    return a*3.0;
}

// float terrain(vec2 x){
//     vec2 p=x*.04;
//     float a=1.3;
//     float b=1.9;
//     vec2 d=vec2(0.);
    
//     for(int i=0;i<8;i++){
//         vec3 n=noised(p);
//         d+=n.yz;
//         a+=b*n.x/(1.+dot(d,d));
//         b*=.65;
//         p=m*p*2.;
//     }
    
//     return a;
// }

float scene(vec3 p){
    return p.y-(terrain(p.zx));
}

// Better raymarching function from  https://www.shadertoy.com/view/XsyGWV
float raymarch(vec3 ro,vec3 rd){
    float t=0.;
    float precis=SURFACE_DIST;
    vec3 p=ro+rd*t;// march a certain distance in the ray direction from the origin
    float dS=scene(p);
    
    for(int i=0;i<MAX_STEPS;i++){
        precis=t*SURFACE_DIST;
        float rl=max(t*.02,1.);
        t+=dS*rl;
        p=ro+rd*t;
        dS=scene(p);
        
        t+=.4*dS;
        
        if(t>MAX_DIST||dS<precis){
            break;
        }
    }
    
    return t;
}

vec3 getNormal(vec3 p){
    float d=scene(p);
    vec2 e=vec2(.01,0.);
    
    vec3 n=d-vec3(
        scene(p-e.xyy),
        scene(p-e.yxy),
        scene(p-e.yyx)
    );
    
    return normalize(n);
}

float softShadows(in vec3 ro,in vec3 rd,float mint,float maxt,float k){
    float resultingShadowColor=1.;
    float t=mint;
    for(int i=0;i<50&&t<maxt;i++){
        float h=scene(ro+rd*t);
        if(h<.001)
        return 0.;
        resultingShadowColor=min(resultingShadowColor,k*h/t);
        t+=h;
    }
    return resultingShadowColor;
}

// vec3 fog(vec3 rgb,float distance,vec3 rayOrigin,vec3 rayDirection,vec3 sunDirection){
//     float b=.15;
//     float fogAmount=1.-exp(-distance*b);
//     vec3 fogColor=vec3(.5,.2,.15);
//     return mix(rgb,fogColor,fogAmount);
// }

vec3 fog2(vec3 ro,vec3 rd,vec3 col,float d){
    vec3 pos=ro+rd*d;
    
    const float b=1.3;
    float fogAmount=.2*exp(-ro.y*b)*(1.-exp(-d*rd.y*b))/rd.y;
    float sunAmount=max(dot(rd,lightPosition),0.);
    vec3 fogColor=mix(vec3(.5,.2,.15),vec3(1.1,.6,.45),pow(sunAmount,2.));
    return mix(col,fogColor,clamp(fogAmount,0.,1.));
}

float linstep(in float mn,in float mx,in float x){
    return clamp((x-mn)/(mx-mn),0.,1.);
}

vec3 scatter(vec3 ro,vec3 rd)
{
    float sunAmount=max(dot(rd,lightPosition)*.5+.5,0.);
    float depth=1.-(ro+rd*(MAX_DIST)).y*6.0;
    float hori=(linstep(-400.,0.,depth)-linstep(0.,400.,depth))*1.04;
    hori*=pow(sunAmount,.04);
    
    vec3 col=vec3(0);
    col+=pow(hori,100.)*vec3(1.,.7,.5)*1.;
    col+=pow(hori,25.)*vec3(1.,.5,.25)*1.2;
    col+=pow(hori,7.)*vec3(1.,.4,.25)*1.8;
    
    return col;
}

void main(){
    vec2 uv = gl_FragCoord.xy/uResolution.xy;
    uv -= 0.5;
    uv.x *= uResolution.x / uResolution.y;

    vec3 color=vec3(0.);
    vec3 ro=vec3(0.,18.,u_time*5.);
    vec3 rd=normalize(vec3(uv,1.));
    
    float d=raymarch(ro,rd);
    vec3 p=ro+rd*d;
    
    vec3 lightDirection=normalize(lightPosition-p);
    
    if(d<MAX_DIST){
        vec3 normal=getNormal(p);
        
        float amb=clamp(.5+.5*normal.y,0.,1.);
        float diffuse=clamp(dot(normal,lightDirection),0.,1.);
        float shadow=softShadows(p,lightDirection,.1,3.,64.);
        
        color=vec3(.25,.25,.3)*(vec3(.10,.11,.12)*amb+2.*vec3(.9,.4,.25)*diffuse)*shadow;
    }
    
    color=scatter(ro,rd)+fog2(ro,rd,color,d);
    
    gl_FragColor=vec4(color,1.);
}
