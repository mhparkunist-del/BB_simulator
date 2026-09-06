import math
def norm(a): return math.sqrt(sum(x*x for x in a))
def unit(a):
    n=norm(a) or 1e-12; return [x/n for x in a]
def add(a,b,k=1): return [a[i]+k*b[i] for i in range(3)]
def dot(a,b): return sum(a[i]*b[i] for i in range(3))
def smooth(a,b,x):
    t=min(1,max(0,(x-a)/(b-a))); return t*t*(3-2*t)
def lerp(a,b,t): return a+(b-a)*t
def lerp3(a,b,t): return [lerp(a[i],b[i],t) for i in range(3)]
def keyed(keys,tau):
    if tau<=keys[0][0]: return keys[0][1]
    for i in range(1,len(keys)):
        if tau<=keys[i][0]:
            f=smooth(keys[i-1][0],keys[i][0],tau); a,b=keys[i-1][1],keys[i][1]
            if isinstance(a,list):
                return unit(lerp3(a,b,f)) if abs(norm(a)-1)<0.01 else lerp3(a,b,f)
            return lerp(a,b,f)
    return keys[-1][1]
def ik2(root,target,l1,l2,bend):
    d=add(target,root,-1); L=norm(d); dh=unit(d); L=min(L,l1+l2-1e-4)
    a=(l1*l1-l2*l2+L*L)/(2*L); hh=math.sqrt(max(0,l1*l1-a*a))
    perp=add(bend,dh,-dot(bend,dh)); perp=[0,-1,0] if norm(perp)<1e-6 else unit(perp)
    return add(add(root,dh,a),perp,hh)
def skeleton(S,tau):
    h=S['height']; side=-1 if S['hand']=='R' else 1; M0=S['mound']
    Lth=0.245*h;Lsh=0.245*h;Ltr=0.30*h;Lua=0.19*h;Lfa=0.26*h;SW=0.11*h
    stride=S['stride']*h
    rearFoot=[side*0.06*h,M0-0.03*h,0]
    pelY=keyed([[0,M0-0.14*h],[0.3,M0-0.10*h],[0.65,M0-0.50*stride],[1,M0-0.60*stride],[1.35,M0-0.72*stride]],tau)
    pelZ=keyed([[0,0.52*h],[0.3,0.54*h],[0.65,0.49*h],[1,0.46*h],[1.35,0.42*h]],tau)
    pelvis=[0,pelY,pelZ]
    frontFoot=[-side*0.08*h,keyed([[0,M0-0.12*h],[0.3,M0-0.16*h],[0.65,M0-stride],[1.35,M0-stride]],tau),keyed([[0,0],[0.3,0.36*h],[0.65,0],[1.35,0]],tau)]
    rearHip=add(pelvis,[side*0.06*h,0,0]); frontHip=add(pelvis,[-side*0.06*h,0,0])
    rearKnee=ik2(rearHip,rearFoot,Lth,Lsh,[0,-1,0]); frontKnee=ik2(frontHip,frontFoot,Lth,Lsh,[0,-1,0.3])
    leanDeg=keyed([[0,-6],[0.3,-4],[0.65,4],[1,S['lean']],[1.35,S['lean']+18]],tau)*math.pi/180
    tiltDeg=keyed([[0,0],[0.65,S['tilt']*0.3],[1,S['tilt']],[1.35,S['tilt']*0.7]],tau)*math.pi/180
    up=[0,-math.sin(leanDeg),math.cos(leanDeg)]; up=[-side*math.sin(tiltDeg)*math.cos(leanDeg),up[1],up[2]*math.cos(tiltDeg)]; up=unit(up)
    shC=add(pelvis,up,Ltr)
    psi=keyed([[0,0],[0.3,0],[0.65,80],[0.85,45],[1,0],[1.35,-25]],tau)*math.pi/180
    shLine=[side*math.cos(psi),math.sin(psi),0]; shLine=unit(add(shLine,up,-dot(shLine,up)))
    shT=add(shC,shLine,SW); shG=add(shC,shLine,-SW)
    head=add(shC,up,0.13*h); eyes=add(head,[0,-0.06*h,0.02*h])
    s=S['slot']*math.pi/180; fw=S['fwd']*math.pi/180
    relDir=[side*math.cos(s)*math.cos(fw),-math.sin(fw),math.sin(s)*math.cos(fw)]
    relDir=unit([relDir[0]*math.cos(tiltDeg)-side*relDir[2]*math.sin(tiltDeg),relDir[1],relDir[2]*math.cos(tiltDeg)+side*relDir[0]*math.sin(tiltDeg)])
    uKeys=[[0,unit([side*0.15,0,-0.99])],[0.3,unit([side*0.15,0,-0.99])],[0.5,unit([side*0.6,0.35,-0.7])],[0.7,unit([side*0.95,0.25,0.2])],[0.85,unit([side*0.8,0.1,0.55])],[1,relDir],[1.35,unit([-side*0.45,-0.55,-0.7])]]
    fKeys=[[0,unit([-side*0.4,-0.3,0.87])],[0.3,unit([-side*0.4,-0.3,0.87])],[0.5,unit([side*0.3,0.5,-0.8])],[0.7,unit([side*0.1,0.35,0.93])],[0.85,unit([side*0.3,-0.1,0.95])],[1,relDir],[1.35,unit([-side*0.6,-0.4,-0.7])]]
    u=keyed(uKeys,tau); f=keyed(fKeys,tau)
    elbow=add(shT,u,Lua); hand=add(elbow,f,Lfa)
    com=add(add([x*0.55 for x in pelvis],shC,0.35),head,0.10)
    return dict(rearFoot=rearFoot,rearKnee=rearKnee,rearHip=rearHip,frontHip=frontHip,frontKnee=frontKnee,frontFoot=frontFoot,pelvis=pelvis,shC=shC,shT=shT,shG=shG,elbow=elbow,hand=hand,head=head,eyes=eyes,com=com,up=up,u=u,f=f,relDir=relDir,Lth=Lth,Lsh=Lsh,Lua=Lua,Lfa=Lfa,psi=psi,leanDeg=leanDeg,tiltDeg=tiltDeg)
PROFILES=[
 dict(n='A',hand='R',height=1.93,stride=0.95,lean=35,tilt=30,slot=60,fwd=25,eff=0.95,cmd=0.12,mph=97,rpm=2450),
 dict(n='B',hand='R',height=1.85,stride=0.85,lean=28,tilt=15,slot=45,fwd=22,eff=0.92,cmd=0.10,mph=94,rpm=2300),
 dict(n='C',hand='R',height=1.80,stride=0.80,lean=20,tilt=-5,slot=12,fwd=30,eff=0.80,cmd=0.09,mph=89,rpm=2100),
 dict(n='D',hand='L',height=1.78,stride=0.75,lean=40,tilt=-10,slot=-25,fwd=20,eff=0.85,cmd=0.14,mph=84,rpm=1900),
 dict(n='E',hand='L',height=1.88,stride=0.88,lean=30,tilt=25,slot=55,fwd=22,eff=0.97,cmd=0.08,mph=95,rpm=2550)]
for P in PROFILES:
    P['mound']=18.44
    sk=skeleton(P,1.0); rel=sk['hand']; h=P['height']
    slotEff=P['slot']+P['tilt']; tiltAxis=90-slotEff
    baseF=min(sk['frontFoot'][1],sk['rearFoot'][1]); baseB=max(sk['frontFoot'][1],sk['rearFoot'][1])
    comOut=max(0,baseF-sk['com'][1],sk['com'][1]-baseB); comFrac=(baseB-sk['com'][1])/(baseB-baseF)
    spd=1+0.06*(P['stride']-0.85)/0.15+0.03*(P['lean']-25)/20
    cmdMul=1+0.4*comOut/0.2+0.2*abs(P['tilt'])/30
    # statcast-like arm angle: shoulder->release in x-z plane
    d=add(rel,sk['shT'],-1); side=-1 if P['hand']=='R' else 1
    armAng=math.degrees(math.atan2(d[2],side*d[0]))
    # anatomical abduction: angle between arm dir and trunk down axis
    down=[-x for x in sk['up']]; abd=math.degrees(math.acos(max(-1,min(1,dot(unit(d),down)))))
    # shoulder line lateral tilt (frontal plane) : shT vs shG
    sl=add(sk['shT'],sk['shG'],-1); shTilt=math.degrees(math.atan2(sl[2],side*sl[0]))
    # leg lengths
    fl=norm(add(sk['frontFoot'],sk['frontHip'],-1)); rl=norm(add(sk['rearFoot'],sk['rearHip'],-1)); Lleg=sk['Lth']+sk['Lsh']
    # front knee angle
    fk=sk['frontKnee']; th=unit(add(fk,sk['frontHip'],-1)); sh=unit(add(sk['frontFoot'],fk,-1)); knee=math.degrees(math.acos(max(-1,min(1,dot(th,sh)))))
    print(f"{P['n']} h={h} stride={P['stride']*h:.2f}m relX={rel[0]:+.2f} relY={rel[1]:.2f} relZ={rel[2]:.2f} ({rel[2]/h:.2f}h) ext={P['mound']-rel[1]:.2f}m slotEff={slotEff} armAng(frontal)={armAng:.0f} abd(vs trunk)={abd:.0f} shLineTilt={shTilt:.0f} spd={spd:.3f} -> {P['mph']*spd:.1f}mph cmdMul={cmdMul:.2f} sig={P['cmd']*cmdMul*100:.1f}cm comOut={comOut*100:.0f}cm comBehindFront={(sk['com'][1]-sk['frontFoot'][1])*100:.0f}cm frontLeg={fl:.2f}/{Lleg:.2f}({fl/Lleg:.2f}) rearLeg={rl:.2f}/{Lleg:.2f}({rl/Lleg:.2f}) shT_z={sk['shT'][2]:.2f} shT_y={sk['shT'][1]:.2f} pelvY={sk['pelvis'][1]:.2f} frontFootY={sk['frontFoot'][1]:.2f} handAheadShoulder={sk['shT'][1]-rel[1]:.2f} axis={tiltAxis}")
# leg stretch across tau for B
P=PROFILES[1]
print('--- B leg stretch vs tau ---')
for tau in [0,0.3,0.5,0.65,0.85,1.0,1.35]:
    sk=skeleton(P,tau); Lleg=sk['Lth']+sk['Lsh']
    fl=norm(add(sk['frontFoot'],sk['frontHip'],-1)); rl=norm(add(sk['rearFoot'],sk['rearHip'],-1))
    # elbow flexion (angle between u and f)
    ef=math.degrees(math.acos(max(-1,min(1,dot(sk['u'],sk['f'])))))
    print(f"tau={tau} front={fl/Lleg:.2f} rear={rl/Lleg:.2f} psi={math.degrees(sk['psi']):.0f} elbowFlex={ef:.0f} forearm_y={sk['f'][1]:+.2f} handZ={sk['hand'][2]:.2f} t={-(1-tau)*0.9*1000:.0f}ms")
