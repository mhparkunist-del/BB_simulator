import numpy as np, math, sys
from PIL import Image, ImageDraw
W,H=640,400
CAM=eval(sys.argv[1]) if len(sys.argv)>1 else ([11.5,-9.5,2.6],[-2.5,7.0,1.30],42)
OUT=sys.argv[2] if len(sys.argv)>2 else "/tmp/claude-1002/-home-mhpark/ef5b4abe-eb6a-462c-970f-4e50b05f2f55/scratchpad/bg/out5.png"
C,Tg,FOV=np.array(CAM[0],float),np.array(CAM[1],float),CAM[2]
f=Tg-C; f/=np.linalg.norm(f); r=np.cross(f,[0,0,1]); r/=np.linalg.norm(r); u=np.cross(r,f)
FL=W/(2*math.tan(math.radians(FOV)/2)); NEAR=0.30
def dep(P): return float(np.dot(np.array(P,float)-C,f))
def pr(P):
    d=np.array(P,float)-C; z=float(np.dot(d,f))
    if z<NEAR: return None
    return (W/2+FL*float(np.dot(d,r))/z, H/2-FL*float(np.dot(d,u))/z)
def clipnear(pts):
    P=[np.array(p,float) for p in pts]; d=[dep(p) for p in P]; out=[]; n=len(P)
    for i in range(n):
        j=(i+1)%n
        if d[i]>=NEAR: out.append(P[i])
        if (d[i]>=NEAR)!=(d[j]>=NEAR):
            t=(NEAR-d[i])/(d[j]-d[i]); out.append(P[i]+(P[j]-P[i])*t)
    return out
img=Image.new("RGB",(W,H),(6,11,20)); dr=ImageDraw.Draw(img,"RGBA")
def poly(pts,fill=None,outline=None):
    q=[pr(p) for p in clipnear(pts)]; q=[x for x in q if x]
    if len(q)>=3: dr.polygon(q,fill=fill,outline=outline)
def pline(pts,col,wd=1,close=False):
    q=[pr(p) for p in (clipnear(pts+[pts[0]]) if close else clipnear(pts))]; q=[x for x in q if x]
    if len(q)>=2: dr.line(q,fill=col,width=wd)
D=math.radians; Rf=lambda a: 100+22*math.cos(D(a))**2
# ============ sky
for y in range(H):
    t=y/H; dr.line([(0,y),(W,y)],fill=(int(7+20*t),int(12+28*t),int(21+26*t)))
# ============ bowl curve: (point2, outward normal2) samples, index order = 3B corner -> outfield -> 1B corner
def wall_curve():
    S=[]
    n3=np.array([-0.7071,-0.7071]); d3=np.array([-0.7071,0.7071])
    for t in np.arange(100,4.9,-5): S.append((d3*t+n3*20.0,n3))          # 3B side line
    for a in np.arange(-46,-135.1,-6)[::-1]:                              # corner->behind home (3B quadrant)
        pass
    return S
SIDE3=[(np.array([-0.7071,-0.7071])*20.0+np.array([-0.7071,0.7071])*t, np.array([-0.7071,-0.7071])) for t in np.arange(5,101,5)]
SIDE1=[(np.array([0.7071,-0.7071])*20.0+np.array([0.7071,0.7071])*t, np.array([0.7071,-0.7071])) for t in np.arange(5,101,5)]
OUTF=[(np.array([math.sin(D(a)),math.cos(D(a))])*(Rf(a)+6.0), np.array([math.sin(D(a)),math.cos(D(a))])) for a in np.arange(-48,48.1,2.0)]
BOWL=SIDE3[::-1]+OUTF+SIDE1
def bowl_cells(seq,zf,rake,depth,nb=6):
    cells=[]
    for i in range(len(seq)-1):
        (p0,n0),(p1,n1)=seq[i],seq[i+1]
        for k in range(nb):
            s0,s1=depth*k/nb,depth*(k+1)/nb
            A=[p0[0]+n0[0]*s0,p0[1]+n0[1]*s0,zf+rake*s0]; B=[p1[0]+n1[0]*s0,p1[1]+n1[1]*s0,zf+rake*s0]
            Cc=[p1[0]+n1[0]*s1,p1[1]+n1[1]*s1,zf+rake*s1]; Dd=[p0[0]+n0[0]*s1,p0[1]+n0[1]*s1,zf+rake*s1]
            q=[A,B,Cc,Dd]; z=sum(dep(x) for x in q)/4
            if z<NEAR: continue
            cells.append((z,q,(p0,p1,n0,n1,s0,s1)))
    return cells
cells=bowl_cells(BOWL,1.0,0.42,26.0)
cells.sort(key=lambda c:-c[0])
rng=np.random.default_rng(7)
for z,q,meta in cells:
    shade=max(0.0,min(1.0,(q[0][2]-1.0)/11.0))
    col=(int(22+10*shade),int(29+12*shade),int(38+14*shade))
    poly(q,fill=col)
    p0,p1,n0,n1,s0,s1=meta
    seg=np.linalg.norm(p1-p0)
    npts=int(seg*(s1-s0)*3.0)
    for i in range(npts):
        t=rng.random(); s=s0+(s1-s0)*rng.random()
        p=p0+(p1-p0)*t; nn=n0+(n1-n0)*t
        P=[p[0]+nn[0]*s,p[1]+nn[1]*s,1.0+0.42*s+0.55]
        qq=pr(P)
        if not qq or not(0<=qq[0]<W and 0<=qq[1]<H): continue
        c=rng.random()
        col=(206,213,221,150) if c<0.38 else ((112,126,142,140) if c<0.76 else ((214,158,88,130) if c<0.92 else (160,70,70,130)))
        dr.point([qq],fill=col)
# back wall / roof
for z,q,meta in sorted(bowl_cells(BOWL,1.0+0.42*26,0.0,0.1,1),key=lambda c:-c[0]):
    p0,p1,n0,n1,s0,s1=meta
    A=[p0[0]+n0[0]*26,p0[1]+n0[1]*26,11.9];B=[p1[0]+n1[0]*26,p1[1]+n1[1]*26,11.9]
    poly([A,B,[B[0],B[1],16.5],[A[0],A[1],16.5]],fill=(13,18,25))
# ============ light towers (drawn after bowl so only tops show above roof)
for a in [-70,-40,-15,15,40,70]:
    R=(Rf(a)+56) if abs(a)<=45 else 132
    cx,cy=R*math.sin(D(a)),R*math.cos(D(a))
    q=pr([cx,cy,28])
    if q:
        for k in range(18,0,-1):
            rad=k*8; dr.ellipse([q[0]-rad,q[1]-rad*0.65,q[0]+rad,q[1]+rad*0.65],fill=(140,168,190,3))
    poly([[cx-0.9,cy,14],[cx+0.9,cy,14],[cx+0.9,cy,26],[cx-0.9,cy,26]],fill=(56,66,78))
    poly([[cx-5.5,cy,26],[cx+5.5,cy,26],[cx+5.5,cy,33],[cx-5.5,cy,33]],fill=(42,50,60))
    for i in range(7):
        for j in range(3):
            qq=pr([cx-4.8+i*1.6,cy-0.4,26.9+j*2.0])
            if qq: dr.ellipse([qq[0]-1.8,qq[1]-1.8,qq[0]+1.8,qq[1]+1.8],fill=(255,252,232))
# ============ scoreboard
def board(a_c,Rp,wm,z0,z1):
    ac=D(a_c); R=Rf(a_c)+Rp; cx,cy=R*math.sin(ac),R*math.cos(ac); tx,ty=math.cos(ac),-math.sin(ac)
    P=lambda s,z:[cx+tx*s,cy+ty*s,z]
    poly([P(-wm/2,z0-1.4),P(wm/2,z0-1.4),P(wm/2,z1),P(-wm/2,z1)],fill=(11,15,20),outline=(62,72,84))
    poly([P(-wm/2+1.6,z0),P(wm/2-1.6,z0),P(wm/2-1.6,z1-1.6),P(-wm/2+1.6,z1-1.6)],fill=(16,26,20))
    for i in range(10):
        for j in range(4):
            qq=pr(P(-wm/2+2.6+i*2.3,z0+1.4+j*2.0))
            if qq: dr.rectangle([qq[0]-3,qq[1]-2,qq[0]+3,qq[1]+2],fill=(226,178,66,200))
board(-33,16,22,11.0,17.6)
# ============ outfield wall
FP=[];FT=[]
for a in np.arange(-46,46.1,1.0):
    R=Rf(a); FP.append([R*math.sin(D(a)),R*math.cos(D(a)),0]); FT.append([R*math.sin(D(a)),R*math.cos(D(a)),2.6])
for i in range(len(FP)-1):
    poly([FP[i],FP[i+1],FT[i+1],FT[i]],fill=(19,46,31))
for a in np.arange(-46,46.1,1.35):
    R=Rf(a); pline([[R*math.sin(D(a)),R*math.cos(D(a)),0.05],[R*math.sin(D(a)),R*math.cos(D(a)),2.5]],(12,32,22),1)
for i in range(len(FT)-1): pline([FT[i],FT[i+1]],(233,198,62),3)
# side (foul territory) walls h=1.0
for SD in (SIDE3,SIDE1):
    for i in range(len(SD)-1):
        p0=SD[i][0];p1=SD[i+1][0]
        poly([[p0[0],p0[1],0],[p1[0],p1[1],0],[p1[0],p1[1],1.0],[p0[0],p0[1],1.0]],fill=(21,42,30))
        pline([[p0[0],p0[1],1.0],[p1[0],p1[1],1.0]],(190,196,188),1)
# dugouts: dark opening on the side wall, 12 m long starting 18 m from home along the line
for SD,s in ((SIDE3,-1),(SIDE1,1)):
    d0,d1=18.0,30.0
    n0=np.array([s*0.7071,-0.7071]); dv=np.array([s*0.7071,0.7071])
    A=dv*d0+n0*20.0; B=dv*d1+n0*20.0
    poly([[A[0],A[1],-0.9],[B[0],B[1],-0.9],[B[0],B[1],0.95],[A[0],A[1],0.95]],fill=(8,12,10))
    pline([[A[0],A[1],0.95],[B[0],B[1],0.95]],(150,156,150),2)
# foul poles
for s in (-1,1):
    x,y=s*100/math.sqrt(2),100/math.sqrt(2)
    poly([[x-0.3,y,2.6],[x+0.3,y,2.6],[x+0.3,y,20],[x-0.3,y,20]],fill=(242,208,62))
# ============ ground: outfield + foul grass
G=[[0,0,0]]+[[Rf(a)*math.sin(D(a)),Rf(a)*math.cos(D(a)),0] for a in np.arange(-45,45.1,1.5)]
poly(G,fill=(38,88,52))
for s in (-1,1):
    n0=np.array([s*0.7071,-0.7071]); dv=np.array([s*0.7071,0.7071])
    A=[[0,0,0]]+[[(dv*t)[0],(dv*t)[1],0] for t in np.arange(0,101,10)]
    A+= [[(dv*t+n0*20)[0],(dv*t+n0*20)[1],0] for t in np.arange(100,-0.1,-10)]
    poly(A,fill=(34,80,47))
poly([[0,0,0]]+[[20*math.sin(D(a)),20*math.cos(D(a)),0] for a in np.arange(-135,-225.1,-7.5)],fill=(34,80,47))
for i,a0 in enumerate(np.arange(-45,45,4.5)):
    if i%2: continue
    p=[[28.96*math.sin(D(a)),18.44+28.96*math.cos(D(a)),0] for a in np.linspace(a0,a0+4.5,3)]
    p+=[[(Rf(a)-4.57)*math.sin(D(a)),(Rf(a)-4.57)*math.cos(D(a)),0] for a in np.linspace(a0+4.5,a0,3)]
    poly(p,fill=(50,108,64))
p=[[(Rf(a)-4.57)*math.sin(D(a)),(Rf(a)-4.57)*math.cos(D(a)),0] for a in np.arange(-46,46.1,1.5)]
p+=[[Rf(a)*math.sin(D(a)),Rf(a)*math.cos(D(a)),0] for a in np.arange(46,-46.1,-1.5)]
poly(p,fill=(100,71,51))
# ============ infield dirt
XI=27.50
arc=[[28.96*math.sin(D(a)),18.44+28.96*math.cos(D(a)),0] for a in np.arange(-72,72.1,2.0)]
arc=[q for q in arc if abs(q[0])<=q[1]]
poly([[0,0,0],[-XI,XI,0]]+arc+[[XI,XI,0]],fill=(112,73,49))
w=2.75; cen=np.array([0,19.4]); F=1-w*math.sqrt(2)/19.4
V=[np.array([19.4,19.4]),np.array([0.,38.8]),np.array([-19.4,19.4]),np.array([0.,0.])]
Vi=[cen+(v-cen)*F for v in V]; hc=np.array([0,0.216]); Rh=3.96
def cc(A,B):
    d=B-A; a=d@d; b=2*d@(A-hc); c=(A-hc)@(A-hc)-Rh*Rh; disc=b*b-4*a*c
    ts=[t for t in ((-b+math.sqrt(disc))/(2*a),(-b-math.sqrt(disc))/(2*a)) if 0<=t<=1]
    return A+d*min(ts) if ts else None
P1=cc(Vi[3],Vi[0]); P3=cc(Vi[3],Vi[2])
a1=math.atan2(P1[0]-hc[0],P1[1]-hc[1]); a3=math.atan2(P3[0]-hc[0],P3[1]-hc[1])
gsec=[[hc[0]+Rh*math.sin(t),hc[1]+Rh*math.cos(t),0] for t in np.linspace(a3,a1,16)]
poly([[Vi[0][0],Vi[0][1],0],[Vi[1][0],Vi[1][1],0],[Vi[2][0],Vi[2][1],0]]+gsec,fill=(40,92,54))
poly([[hc[0]+Rh*math.sin(t),hc[1]+Rh*math.cos(t),0] for t in np.linspace(0,2*math.pi,48)],fill=(112,73,49))
for s in (-1,1):
    cx,cy=s*7.0,-5.5
    poly([[cx+1.5*math.sin(t),cy+1.5*math.cos(t),0] for t in np.linspace(0,2*math.pi,28)],fill=(106,69,47))
mc=np.array([0,17.98])
poly([[mc[0]+2.743*math.sin(t),mc[1]+2.743*math.cos(t),0] for t in np.linspace(0,2*math.pi,48)],fill=(122,81,54))
poly([[mc[0]+1.30*math.sin(t),mc[1]+0.35+1.30*math.cos(t),0.254] for t in np.linspace(0,2*math.pi,32)],fill=(136,92,62))
poly([[-0.305,18.44,0.254],[0.305,18.44,0.254],[0.305,18.592,0.254],[-0.305,18.592,0.254]],fill=(246,244,238))
# ============ chalk
for s in (-1,1):
    poly([[s*0.2159,0.2159,0.005],[s*(0.2159+0.108),0.2159,0.005],[s*(70.7+0.108),70.7,0.005],[s*70.7,70.7,0.005]],fill=(240,238,229))
def base(cx,cy,sz=0.457):
    poly([[cx-sz/2,cy-sz/2,0.02],[cx+sz/2,cy-sz/2,0.02],[cx+sz/2,cy+sz/2,0.02],[cx-sz/2,cy+sz/2,0.02]],fill=(247,245,239))
base(19.4-0.229,19.4-0.229); base(0,38.8); base(-19.4+0.229,19.4-0.229)
poly([[0,0,0.01],[0.2159,0.2159,0.01],[0.2159,0.4318,0.01],[-0.2159,0.4318,0.01],[-0.2159,0.2159,0.01]],fill=(249,247,241))
for s in (-1,1):
    x0=s*0.368; x1=s*1.587
    pline([[x0,-0.698,0.004],[x1,-0.698,0.004],[x1,1.130,0.004],[x0,1.130,0.004]],(238,235,226),2,close=True)
pline([[-0.546,-0.698,0.004],[0.546,-0.698,0.004],[0.546,-3.136,0.004],[-0.546,-3.136,0.004]],(238,235,226),2,close=True)
for s in (-1,1):
    P=lambda d,o:[s*(d+o)/math.sqrt(2),(d-o)/math.sqrt(2),0.004]
    pline([P(25.9,4.57),P(32.0,4.57),P(32.0,7.62),P(25.9,7.62)],(232,230,222),2,close=True)
def stick(pts,col,wd=4):
    for A,B in pts:
        a=pr(A);b=pr(B)
        if a and b: dr.line([a,b],fill=col,width=wd)
def person(x,y,h,col,face=0):
    P=lambda dx,dy,z:[x+dx,y+dy,z]
    stick([(P(-0.15,0,0),P(0,0,0.52*h)),(P(0.15,0,0),P(0,0,0.52*h)),(P(0,0,0.52*h),P(0,0,0.82*h)),
           (P(-0.2,0,0.78*h),P(0.2,0,0.78*h)),(P(-0.2,0,0.78*h),P(-0.3,0.1,0.6*h)),(P(0.2,0,0.78*h),P(0.3,0.1,0.6*h))],col)
    q=pr(P(0,0,0.93*h))
    if q: dr.ellipse([q[0]-4,q[1]-4,q[0]+4,q[1]+4],fill=col)
import os
if os.environ.get("FIG"):
    person(-0.85,0.4,1.80,(160,184,255))     # RH batter
    person(0.0,-1.35,1.30,(138,209,168))     # catcher (crouch h)
    person(-0.15,-2.35,1.85,(201,194,174))   # umpire
    person(0.3,17.2,1.90,(236,231,216))      # pitcher
    for (fx,fy,pos) in [(21,27,"1B"),(11,41,"2B"),(-11,41,"SS"),(-21,27,"3B"),(-38,86,"LF"),(0,98,"CF"),(38,86,"RF")]:
        person(fx,fy,1.85,(120,190,150))
ov=Image.new("RGBA",(W,H),(0,0,0,0)); od=ImageDraw.Draw(ov)
for i in range(60):
    a=int(44*(i/60)**2.2); od.rectangle([i*2,i*1.4,W-i*2,H-i*1.4],outline=(0,0,0,a))
img=Image.alpha_composite(img.convert("RGBA"),ov).convert("RGB")
img.save(OUT); print("ok",OUT)
