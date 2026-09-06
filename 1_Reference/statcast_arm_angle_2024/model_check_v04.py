"""Port of v0.4 skeleton() at release (tau=1) -> release point & Statcast-style arm angle per profile."""
import numpy as np
def unit(a): a=np.asarray(a,float); return a/np.linalg.norm(a)
def ik2(root,target,l1,l2,bend):
    root,target=np.asarray(root),np.asarray(target); d=target-root; L=np.linalg.norm(d); dh=d/L; L=min(L,l1+l2-1e-4)
    a=(l1*l1-l2*l2+L*L)/(2*L); hh=np.sqrt(max(0,l1*l1-a*a)); bend=np.asarray(bend,float); perp=bend-np.dot(bend,dh)*dh
    perp=unit(perp) if np.linalg.norm(perp)>1e-6 else np.array([0,-1,0]); return root+dh*a+perp*hh
def release(P):
    h=P['height']; side=-1 if P['hand']=='R' else 1; M0=18.44; Ltr=0.30*h; Lua=0.19*h; Lfa=0.26*h; SW=0.11*h; stride=P['stride']*h
    pelvis=np.array([0,M0-0.60*stride,0.46*h]); lean=np.radians(P['lean']); tilt=np.radians(P['tilt'])
    up=unit([-side*np.sin(tilt)*np.cos(lean), -np.sin(lean), np.cos(lean)*np.cos(tilt)])
    shC=pelvis+up*Ltr; shLine=np.array([side,0,0.0]); shLine=unit(shLine-np.dot(shLine,up)*up); shT=shC+shLine*SW
    s=np.radians(P['slot']); fw=np.radians(P['fwd'])
    d=np.array([side*np.cos(s)*np.cos(fw), -np.sin(fw), np.sin(s)*np.cos(fw)])
    d=unit([d[0]*np.cos(tilt)-side*d[2]*np.sin(tilt), d[1], d[2]*np.cos(tilt)+side*d[0]*np.sin(tilt)])
    hand=shT+d*(Lua+Lfa)
    dx,dz=hand[0]-shT[0],hand[2]-shT[2]; arm_angle=np.degrees(np.arctan2(dz,abs(dx)))  # Statcast-style: shoulder->ball, 0=horizontal
    front=M0-stride; rear=M0-0.03*h; com=0.55*pelvis+0.35*shC+0.10*(shC+up*0.13*h)
    return dict(rel_x=hand[0],rel_y=hand[1],rel_z=hand[2],ext=M0-hand[1],arm_angle=arm_angle,sh_z=shT[2],slotEff=P['slot']+P['tilt'],com_y=com[1],front_y=front,rear_y=rear)
PROFILES=[dict(n='A 오버핸드 파워',hand='R',height=1.93,stride=0.95,lean=35,tilt=30,slot=60,fwd=25),
 dict(n='B 쓰리쿼터 표준',hand='R',height=1.85,stride=0.85,lean=28,tilt=15,slot=45,fwd=22),
 dict(n='C 사이드암 기교',hand='R',height=1.80,stride=0.80,lean=20,tilt=-5,slot=12,fwd=30),
 dict(n='D 좌완 언더핸드',hand='L',height=1.78,stride=0.75,lean=40,tilt=-10,slot=-25,fwd=20),
 dict(n='E 좌완 하이슬롯',hand='L',height=1.88,stride=0.88,lean=30,tilt=25,slot=55,fwd=22)]
print("profile | slotEff | Statcast-style arm angle | rel z | |rel x| | ext | shoulder z | COM vs front foot")
for P in PROFILES:
    r=release(P); print(f"{P['n']:14s} | {r['slotEff']:4.0f}° | {r['arm_angle']:5.1f}° | {r['rel_z']:.2f} m | {abs(r['rel_x']):.2f} m | {r['ext']:.2f} m | {r['sh_z']:.2f} | COM {r['com_y']-r['front_y']:+.2f} m behind front foot (base {r['rear_y']-r['front_y']:.2f} m)")
print("\nStatcast 2024 reference: arm angle median 39.6 (5-95%: 17-57), rel z mean 1.75, |rel x| median 0.56, shoulder z 1.33, ext ~1.04*h (1.9 m), shoulder->ball 0.70 m")
