/* bbsim app · vector math, trajectory interpolation, pin-hole camera (shared by every renderer) */
function interp(fl,t){const T=fl.t,X=fl.xyz;if(t<=T[0])return X[0];for(let i=1;i<T.length;i++)if(T[i]>=t){const f=(t-T[i-1])/(T[i]-T[i-1]);return [0,1,2].map(k=>X[i-1][k]+f*(X[i][k]-X[i-1][k]))}return X[X.length-1]}
function sub3(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]}function add3(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]}function mul3(a,k){return [a[0]*k,a[1]*k,a[2]*k]}function lerp3(a,b,f){return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}function norm(a){const n=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/n,a[1]/n,a[2]/n]}
function camera(C,Tg,w,h,fov){const f=norm(sub3(Tg,C)),r=norm(cross(f,[0,0,1])),u=cross(r,f);const fl=w/(2*Math.tan(fov*Math.PI/360));return {fl,C,f,r,u,w,h,proj:P=>{const d=sub3(P,C);const z=dot(d,f);if(z<0.05)return null;return [w/2+fl*dot(d,r)/z,h/2-fl*dot(d,u)/z,z]}}}
function poly3(g,cam,pts,close){let s=false;g.beginPath();pts.forEach(P=>{const q=cam.proj(P);if(!q)return;s?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);s=true});if(close)g.closePath();g.stroke()}
function line3(g,cam,A,B){poly3(g,cam,[A,B],false)}
function dot3(g,cam,P,r,col){const q=cam.proj(P);if(!q)return;g.fillStyle=col;g.beginPath();g.arc(q[0],q[1],r,0,7);g.fill()}
