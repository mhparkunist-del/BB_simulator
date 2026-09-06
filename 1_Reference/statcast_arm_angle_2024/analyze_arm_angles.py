"""Statcast 2024 arm-angle CSV (Baseball Savant via TJStats mirror) -> distribution table.
Columns: ball_angle (deg, 0=sidearm, 90=over top), relative_release_ball_x (ft, sign: + toward glove side?),
release_ball_z (ft), relative_shoulder_x (ft), shoulder_z (ft). Units feet."""
import csv, numpy as np
rows=[r for r in csv.DictReader(open('pitcher_arm_angles_2024.csv',encoding='utf-8-sig'))]
FT=0.3048
def col(k): return np.array([float(r[k]) for r in rows])
n=col('n_pitches'); ang=col('ball_angle'); rz=col('release_ball_z'); rx=col('relative_release_ball_x'); sz=col('shoulder_z'); sx=col('relative_shoulder_x')
hand=np.array([r['pitch_hand'] for r in rows])
m=n>=100
print(f"pitchers total {len(rows)}, with >=100 pitches {m.sum()}")
def q(x,w): 
    idx=np.argsort(x); cw=np.cumsum(w[idx])/w[idx].sum(); return [float(x[idx][np.searchsorted(cw,p)]) for p in (0.05,0.1,0.25,0.5,0.75,0.9,0.95)]
print("percentiles 5/10/25/50/75/90/95")
print("arm angle deg      ", [round(v,1) for v in q(ang[m],n[m])], "mean %.1f sd %.1f"%(np.average(ang[m],weights=n[m]), np.sqrt(np.average((ang[m]-np.average(ang[m],weights=n[m]))**2,weights=n[m]))))
print("release z (m)      ", [round(v*FT,2) for v in q(rz[m],n[m])], "mean %.2f"%(np.average(rz[m],weights=n[m])*FT))
print("|release x| (m)    ", [round(v*FT,2) for v in q(np.abs(rx[m]),n[m])])
print("shoulder z (m)     ", [round(v*FT,2) for v in q(sz[m],n[m])], "mean %.2f"%(np.average(sz[m],weights=n[m])*FT))
armlen=np.hypot(rx-sx, rz-sz)*FT
print("shoulder->ball dist (m)", [round(v,2) for v in q(armlen[m],n[m])], "mean %.2f"%np.average(armlen[m],weights=n[m]))
# bins
bins=[(-90,0,'서브마린/언더(<0)'),(0,20,'사이드암(0-20)'),(20,35,'로우 쓰리쿼터(20-35)'),(35,50,'쓰리쿼터(35-50)'),(50,65,'하이 쓰리쿼터(50-65)'),(65,95,'오버핸드(>65)')]
print("\nbin | pitchers | share(pitches) | mean rel z (m) | mean |rel x| (m) | mean shoulder z")
for a,b,name in bins:
    k=m&(ang>=a)&(ang<b)
    if k.sum()==0: print(name,0); continue
    print(f"{name:18s} | {k.sum():4d} | {n[k].sum()/n[m].sum()*100:5.1f}% | {np.average(rz[k],weights=n[k])*FT:.2f} | {np.average(np.abs(rx[k]),weights=n[k])*FT:.2f} | {np.average(sz[k],weights=n[k])*FT:.2f}")
# regression release z vs angle
A=np.vstack([ang[m],np.ones(m.sum())]).T; c=np.linalg.lstsq(A*np.sqrt(n[m])[:,None], rz[m]*FT*np.sqrt(n[m]),rcond=None)[0]
print(f"\nrelease z (m) ≈ {c[1]:.3f} + {c[0]:.4f} * angle(deg)   (corr %.2f)"%np.corrcoef(ang[m],rz[m])[0,1])
A=np.vstack([ang[m],np.ones(m.sum())]).T; c2=np.linalg.lstsq(A, np.abs(rx[m])*FT,rcond=None)[0]
print(f"|release x| (m) ≈ {c2[1]:.3f} + {c2[0]:.4f} * angle(deg)")
# extremes
for name,idx in (('lowest',np.argsort(ang+ (~m)*999)[:5]),('highest',np.argsort(-ang+(~m)*999)[:5])):
    print(name, [(rows[i]['pitcher_name'],rows[i]['pitch_hand'],ang[i],round(rz[i]*FT,2)) for i in idx])
