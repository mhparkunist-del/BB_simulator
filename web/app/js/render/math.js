/* bbsim app · vector math, trajectory interpolation, pin-hole camera (shared by every renderer) */
function interp(fl,t){const T=fl.t,X=fl.xyz,n=T.length;if(n<2||t<=T[0])return X[0];if(t>=T[n-1])return X[n-1];
 let i=1;while(i<n-1&&T[i]<t)i++;const h=(T[i]-T[i-1])||1e-6,f=(t-T[i-1])/h,P1=X[i-1],P2=X[i];if(n<3)return lerp3(P1,P2,f);
 /* cubic Hermite with Catmull-Rom velocities: sampled flights (18-24 points) render as smooth arcs instead of a polyline;
    a sharp corner such as a bounce keeps one-sided tangents so it stays a corner (no overshoot through the ground) */
 const P0=X[Math.max(0,i-2)],P3=X[Math.min(n-1,i+1)],T0=T[Math.max(0,i-2)],T3=T[Math.min(n-1,i+1)],v12=mul3(sub3(P2,P1),1/h);
 const corner=(A,B,C)=>{const a=sub3(B,A),b=sub3(C,B),na=Math.hypot(a[0],a[1],a[2]),nb=Math.hypot(b[0],b[1],b[2]);return na<1e-9||nb<1e-9||dot(a,b)/(na*nb)<0.85};
 const m1=(i>=2&&!corner(P0,P1,P2))?mul3(sub3(P2,P0),1/(T[i]-T0)):v12,m2=(i+1<n&&!corner(P1,P2,P3))?mul3(sub3(P3,P1),1/(T3-T[i-1])):v12;
 const f2=f*f,f3=f2*f,h00=2*f3-3*f2+1,h10=f3-2*f2+f,h01=-2*f3+3*f2,h11=f3-f2;
 return [0,1,2].map(k=>h00*P1[k]+h10*h*m1[k]+h01*P2[k]+h11*h*m2[k])}
function sub3(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]}function add3(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]}function mul3(a,k){return [a[0]*k,a[1]*k,a[2]*k]}function lerp3(a,b,f){return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}function norm(a){const n=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/n,a[1]/n,a[2]/n]}
function camera(C,Tg,w,h,fov){return cameraFrom(C,norm(sub3(Tg,C)),w/(2*Math.tan(fov*Math.PI/360)),w,h)}
function cameraFrom(C,f,fl,w,h){const r=norm(cross(f,[0,0,1])),u=cross(r,f);return {fl,C,f,r,u,w,h,proj:P=>{const d=sub3(P,C);const z=dot(d,f);if(z<0.05)return null;return [w/2+fl*dot(d,r)/z,h/2-fl*dot(d,u)/z,z]}}}
function poly3(g,cam,pts,close){let s=false;g.beginPath();pts.forEach(P=>{const q=cam.proj(P);if(!q)return;s?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);s=true});if(close)g.closePath();g.stroke()}
function line3(g,cam,A,B){poly3(g,cam,[A,B],false)}
function dot3(g,cam,P,r,col){const q=cam.proj(P);if(!q)return;g.fillStyle=col;g.beginPath();g.arc(q[0],q[1],r,0,7);g.fill()}
