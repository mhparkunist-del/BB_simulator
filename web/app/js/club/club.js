/* bbsim app · club office: schedule, quick-sim games, training, morale, roster moves (state in IndexedDB) */
(function(){
const DATA=window.APP.club;
const $=id=>document.getElementById(id);
const KO=DATA.ko;
let S=null, sel=null, swapSlot=null;const PG={};
function pageTable(id,head,rows,per,key){const box=$(id);const draw=pp=>{const n=Math.max(1,Math.ceil(rows.length/pp));const p=Math.min(PG[key]||0,n-1);PG[key]=p;box.innerHTML="<table>"+head+rows.slice(p*pp,(p+1)*pp).join("")+"</table>"+(n>1?"<div class='pager'><button data-pg='"+key+"' data-d='-1'>이전</button><span>"+(p+1)+"/"+n+"</span><button data-pg='"+key+"' data-d='1'>다음</button></div>":"");return n};
 let pp=per,n=draw(pp);for(let k=0;k<6&&box.clientHeight>60&&box.scrollHeight>box.clientHeight+2&&pp>2;k++){pp--;n=draw(pp)}
 box.querySelectorAll("[data-pg]").forEach(b=>b.onclick=()=>{PG[key]=Math.max(0,Math.min(n-1,(PG[key]||0)+ +b.dataset.d));render()})}
function rng(){S.seed=(S.seed*1664525+1013904223)>>>0;return S.seed/4294967296}
function gauss(){let u=0,v=0;while(u===0)u=rng();while(v===0)v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function poisson(l){let L=Math.exp(-l),k=0,p=1;do{k++;p*=rng()}while(p>L);return k-1}
function grade(v){return v>=0.85?"S":v>=0.7?"A":v>=0.55?"B":v>=0.4?"C":"D"}
function gi(g){return "<i class='g "+g+"'>"+g+"</i>"}
function hash32(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function srng(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
function sgauss(r){let u=0,v=0;while(u===0)u=r();while(v===0)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function grade(v){return v>=0.85?"S":v>=0.7?"A":v>=0.55?"B":v>=0.4?"C":"D"}
const POS_OF_GROUP={C:["C"],IF:["SS","2B","3B","1B"],OF:["CF","LF","RF"]};
function kboPlayer(kp,club,id){const r=srng(hash32(club.code+"|"+kp.name+"|"+kp.num));const kind=kp.group==="P"?"P":"B";const keys=kind==="B"?DATA.bat_keys:DATA.pit_keys;
 const peak=Math.max(0.25,Math.min(0.92,0.55+(kp.active?0.05:-0.06)+0.12*sgauss(r)));const attrs={},pot={},grades={};const head=Math.max(0,(30-kp.age)/11);
 keys.forEach(k=>{attrs[k]=Math.max(0.12,Math.min(0.96,peak+0.10*sgauss(r)));pot[k]=Math.max(attrs[k],Math.min(0.98,attrs[k]+(0.02+0.30*r())*head+0.03*sgauss(r)));grades[k]=grade(Math.max(0,Math.min(1,attrs[k]+0.06*sgauss(r))))});
 if(kind==="B"&&kp.pos==="C")attrs.speed=Math.min(attrs.speed,0.45);
 const potAvg=Object.values(pot).reduce((a,b)=>a+b,0)/keys.length;const salary=salaryModel(Object.values(attrs).reduce((a,b)=>a+b,0)/keys.length,kp.age,!!kp.active,0.8+0.5*r());
 return {id,name:kp.name,num:kp.num,age:kp.age,hand:kind==="B"?(kp.bats==="S"?"L":kp.bats):kp.throws,bats:kp.bats,throws:kp.throws,type:kind,pos:kind==="B"?kp.pos:null,role:kind==="P"?(kp.active?"SP":"RP"):null,
  grades,attrs:Object.fromEntries(keys.map(k=>[k,Math.round(attrs[k]*1000)/1000])),pot:Object.fromEntries(keys.map(k=>[k,Math.round(pot[k]*1000)/1000])),pot_grade:grade(potAvg),
  personality:{ambition:Math.round((0.2+0.7*r())*100)/100,loyalty:Math.round((0.2+0.7*r())*100)/100,pro:Math.round((0.3+0.65*r())*100)/100},
  morale:{playing_time:0.6,team_success:0.6,salary_fairness:0.6,relationships:0.6,role_fit:0.6},condition:Math.round(65+27*r()),fatigue:Math.round((0.05+0.2*r())*100)/100,injury:0,
  contract:{salary,years:1+Math.floor(r()*3),status:kp.age<=23?"rookie":(kp.age<=27?"arbitration":"veteran")},stats:{G:0,PA:0,H:0,HR:0,RBI:0,BB:0,K:0,IP:0,ER:0,W:0,L:0,SV:0,KP:0},height:kp.height,active:!!kp.active,real:!kp.est}}
/* salary scale (억): KBO 2025 first-team payroll ≈ 100~140억 for 40 players, minimum 0.3억. ovr .58 → ≈1.9억, .75 → ≈7.3억, .92 → ≈15억; farm players 0.3~0.6억 */
function salaryModel(ovr,age,active,noise){noise=noise||1;if(!active)return Math.round(10*Math.max(0.3,Math.min(0.6,0.3+0.3*Math.max(0,ovr-0.45)*noise)))/10;
 return Math.round(10*Math.max(0.3,Math.min(30,(0.4+60*Math.pow(Math.max(0,ovr-0.45),1.8))*noise*(age>=31?1.15:1))))/10}
function buildKboClub(code){const K=window.APP.kbo;if(!K)return null;const club=K.clubs.find(c=>c.code===code);if(!club)return null;
 const R=window.APP.roster;const ourArch={L:R.batters.filter(b=>b.hand==="L").map(b=>b.id),R:R.batters.filter(b=>b.hand!=="L").map(b=>b.id)};
 let id=1;const players=club.players.map(kp=>kboPlayer(kp,club,id++));
 // starting nine + bench from the active roster: one per position first, then best remaining; map onto the physics batter archetypes by hand
 const bats=players.filter(p=>p.type=="B");const act=bats.filter(p=>p.active);
 const need=["C","SS","2B","CF","3B","1B","LF","RF"];const chosen=[];need.forEach(ps=>{const c=act.filter(p=>p.pos===ps&&!chosen.includes(p)).sort((a,b)=>ovr(b)-ovr(a))[0];if(c)chosen.push(c)});
 act.filter(p=>!chosen.includes(p)).sort((a,b)=>ovr(b)-ovr(a)).forEach(p=>{if(chosen.length<12)chosen.push(p)});
 if(chosen[8])chosen[8].pos="DH";                                     // ninth starter bats as the designated hitter (KBO uses the DH)
 const pools={L:ourArch.L.slice(),R:ourArch.R.slice()};chosen.forEach(p=>{const pool=pools[p.hand==="L"?"L":"R"].length?pools[p.hand==="L"?"L":"R"]:(pools.L.length?pools.L:pools.R);if(pool.length)p.engine_id=pool.shift()});
 const pits=players.filter(p=>p.type=="P");const sps=pits.filter(p=>p.active).sort((a,b)=>ovr(b)-ovr(a));
 R.pitchers.forEach((ap,i)=>{const cand=sps.filter(p=>p.engine_id===undefined&&(ap.hand==="L")===(p.hand==="L"))[0]||sps.filter(p=>p.engine_id===undefined)[0];if(cand){cand.engine_id=ap.id;cand.role="SP"}});
 pits.forEach(p=>{if(p.role==="SP"&&p.engine_id===undefined)p.role="RP"});
 bats.forEach(p=>{p.active=chosen.includes(p)||(p.active&&bats.filter(x=>x.active).length<13)});
 let nb=bats.filter(p=>p.active).length,np=pits.filter(p=>p.active).length;
 bats.forEach(p=>{if(p.active&&!chosen.includes(p)&&nb>14){p.active=false;nb--}});pits.forEach(p=>{if(p.active&&p.role!=="SP"&&np>12){p.active=false;np--}});
 const lineup=chosen.slice(0,9).map(p=>p.id);const rotation=pits.filter(p=>p.role==="SP"&&p.engine_id!==undefined).sort((a,b)=>a.engine_id-b.engine_id).map(p=>p.id);
 const opps=K.clubs.filter(c=>c.code!==code).map((c,j)=>{const r=srng(hash32("club|"+c.code+"|2026"));return {id:j+1,code:c.code,name:c.name,short:c.short,color:c.color,bat:Math.round((0.46+0.16*r())*100)/100,pitch:Math.round((0.46+0.16*r())*100)/100,def:Math.round((0.46+0.14*r())*100)/100,W:0,L:0,starter:j%5}});
 const d0=new Date(DATA.date0+"T00:00:00");const sched=[];let g=1,day=0;while(g<=30){const d=new Date(d0);d.setDate(d0.getDate()+day);if(d.getDay()!==1){const oi=Math.floor((g-1)/3)%opps.length;sched.push({g,date:d.toISOString().slice(0,10),opp:opps[oi].id,home:Math.floor((g-1)/3)%2===0,result:null});g++}day++}
 /* per-club payroll band: scale first-team salaries so the top-40 total lands between 96 and 136억 (KBO 2025 spread), seeded by club */
 const target=96+40*((hash32("pay|"+code)%1000)/1000);const t40=players.map(p=>p.contract.salary).sort((a,b)=>b-a).slice(0,40).reduce((a,b)=>a+b,0);
 const k=t40>0?target/t40:1;players.forEach(p=>{if(p.active)p.contract.salary=Math.round(10*Math.max(0.3,p.contract.salary*k))/10});
 return {players,lineup,rotation,opps,sched,club:{name:club.name,short:club.short,color:club.color,color2:club.color2,city:club.city,code}}}
function fresh(identity){const d=JSON.parse(JSON.stringify(DATA));if(identity){d.club.name=identity.name;d.club.color=identity.color;d.club.color2=identity.color2;d.club.city=identity.city}
 const bats=d.players.filter(p=>p.type=="B"&&p.active), sps=d.players.filter(p=>p.type=="P"&&p.role=="SP"&&p.active);
 S={seed:20260403,day:0,players:d.players,fa:d.free_agents,opps:d.opponents,sched:d.schedule,budget:d.club.budget,staff:d.club.staff,
    lineup:bats.slice(0,9).map(p=>p.id),rotation:sps.slice(0,5).map(p=>p.id),rotIdx:0,program:{},log:[],trainLog:[],W:0,L:0,runs:0,ra:0,weekGames:{},club:d.club,policy:"manual",played:[]};
 if(identity&&identity.code){const K=buildKboClub(identity.code);if(K){S.players=K.players;S.lineup=K.lineup;S.rotation=K.rotation;S.opps=K.opps;S.sched=K.sched;S.club=K.club;S.kbo=true;
   const fa=[];const others=window.APP.kbo.clubs.filter(c=>c.code!==identity.code);for(let k=0;k<8;k++){const c=others[(k*3)%others.length];const cand=c.players.filter(p=>!p.active)[(k*7)%Math.max(1,c.players.filter(p=>!p.active).length)];if(cand){const q=kboPlayer(cand,c,5000+k);q.active=false;q.asking=salaryModel(ovr(q),q.age,true,1.1);q.from=c.short;fa.push(q)}}S.fa=fa}}
 S.players.forEach(p=>{S.program[p.id]=p.type=="B"?"bat":"control";S.weekGames[p.id]=0});
 S.budget=40;S.fin={inc:{gate:0,ads:0,parent:0},exp:{salary:0,ops:0,tax:0,fees:0,buyout:0},ledger:[],taxYears:0,offers:[],nego:null,oppMods:{},weekGate:0,att:0};   // 잔액 40억 = 구단주가 승인한 이적·영입 자금
 addLog((S.club&&S.club.name?S.club.name+" · ":"")+"시즌 개막 준비. 이적 자금 "+S.budget+"억, 선수 "+S.players.length+"명, 상위 40인 보수 "+top40().toFixed(1)+"억 (샐러리캡 137.4억).");save()}
function top40(){return S.players.map(p=>p.contract.salary).sort((a,b)=>b-a).slice(0,40).reduce((a,b)=>a+b,0)}
function save(){window.APP.kv.set("club",S)}
async function load(){const s=await window.APP.kv.get("club");if(s){S=s;return true}return false}
function P(id){return S.players.find(p=>p.id===id)}
function dateOf(day){const d=new Date(DATA.date0+"T00:00:00");d.setDate(d.getDate()+day);return d}
function fmt(d){return (d.getMonth()+1)+"/"+d.getDate()+" ("+"일월화수목금토"[d.getDay()]+")"}
function today(){return dateOf(S.day).toISOString().slice(0,10)}
function gameToday(){return S.sched.find(g=>g.date===today()&&!g.result)}
function addLog(t){S.log.unshift({d:fmt(dateOf(S.day)),t});if(S.log.length>200)S.log.length=200}
function ovr(p){const ks=p.type=="B"?DATA.bat_keys:DATA.pit_keys;return ks.reduce((s,k)=>s+p.attrs[k],0)/ks.length}
function condF(p){return 0.88+0.24*(p.condition/100)}
function batStrength(){const L=S.lineup.map(P).filter(p=>p&&!p.injury);if(!L.length)return 0.3;return L.reduce((s,p)=>s+(0.4*p.attrs.contact+0.3*p.attrs.power+0.3*p.attrs.eye)*condF(p),0)/L.length}
function lineupPositions(){return S.lineup.map(P).filter(Boolean).map(p=>p.pos||"")}
function positionWarnings(){const ps=lineupPositions();const need=["C","1B","2B","3B","SS","LF","CF","RF"];const miss=need.filter(k=>!ps.includes(k));const dup=need.filter(k=>ps.filter(x=>x===k).length>1);return {miss,dup}}
function defStrength(){const L=S.lineup.map(P).filter(p=>p&&!p.injury);if(!L.length)return 0.4;const w=positionWarnings();return Math.max(0.2,L.reduce((s,p)=>s+0.7*p.attrs.defense+0.3*p.attrs.arm,0)/L.length-0.05*(w.miss.length+w.dup.length))}
function pitchStrength(sp){const pen=1-0.6*Math.max(0,sp.fatigue-0.3);const st=(0.5*sp.attrs.stuff+0.3*sp.attrs.control+0.2*sp.attrs.movement)*condF(sp)*pen;
 const rp=S.players.filter(p=>p.type=="P"&&p.role=="RP"&&p.active&&!p.injury);const r=rp.length?rp.reduce((s,p)=>s+0.5*p.attrs.stuff+0.3*p.attrs.control+0.2*p.attrs.movement,0)/rp.length:0.4;return {st,r,tot:0.65*st+0.35*r}}
function nextStarter(){const rot=S.rotation.map(P).filter(p=>p&&p.active);for(let i=0;i<rot.length;i++){const p=rot[(S.rotIdx+i)%rot.length];if(!p.injury&&p.fatigue<0.75){S.rotIdx=(S.rotIdx+i+1)%rot.length;return p}}return rot[0]||S.players.find(p=>p.type=="P")}
function playGame(g){const opp=S.opps.find(o=>o.id===g.opp);const sp=nextStarter();const ps=pitchStrength(sp);const B=batStrength(),D=defStrength();
 const home=g.home?0.15:0;const lu=4.6*Math.max(0.3,1+1.7*(B-opp.pitch)+0.5*(0.5-opp.def))+home;const lt=4.6*Math.max(0.3,1+1.7*(opp.bat-ps.tot)+0.5*(0.5-D));
 let ru=poisson(lu),rt=poisson(lt);if(ru===rt){if(rng()<0.5)ru++;else rt++}
 const ip=Math.min(9,Math.max(3,Math.round(4.5+3*sp.attrs.stamina-2*sp.fatigue+gauss()*0.7)));const er=Math.min(rt,Math.round(rt*ip/9));
 sp.stats.G++;sp.stats.IP=Math.round((sp.stats.IP+ip)*10)/10;sp.stats.ER+=er;sp.stats.KP+=Math.round(ip*(0.6+0.6*sp.attrs.stuff));if(ru>rt)sp.stats.W++;else sp.stats.L++;sp.fatigue=Math.min(1,sp.fatigue+0.42+0.02*ip);sp.condition=Math.max(30,sp.condition-4);S.weekGames[sp.id]++;
 const rps=S.players.filter(p=>p.type=="P"&&p.role=="RP"&&p.active&&!p.injury);for(let k=0;k<Math.min(3,rps.length);k++){const r=rps[Math.floor(rng()*rps.length)];r.stats.G++;r.stats.IP=Math.round((r.stats.IP+1)*10)/10;r.fatigue=Math.min(1,r.fatigue+0.18);if(k===0&&ru>rt&&ru-rt<=3)r.stats.SV++}
 const L=S.lineup.map(P).filter(p=>p&&!p.injury);let hitsLeft=Math.max(2,Math.round(ru*1.9+gauss()));const box=[];
 L.forEach((p,i)=>{const pa=4+(i<4?1:0);p.stats.G++;p.stats.PA+=pa;let h=0,hr=0,bb=0,k=0;for(let j=0;j<pa;j++){const r=rng();const pH=0.16+0.2*p.attrs.contact;const pBB=0.04+0.1*p.attrs.eye;const pK=0.28-0.18*p.attrs.contact;
   if(r<pH){h++;if(rng()<0.05+0.16*p.attrs.power)hr++}else if(r<pH+pBB)bb++;else if(r<pH+pBB+pK)k++}
  p.stats.H+=h;p.stats.HR+=hr;p.stats.BB+=bb;p.stats.K+=k;const rbi=Math.min(ru,hr+(h>0&&rng()<0.35?1:0));p.stats.RBI+=rbi;p.fatigue=Math.min(1,p.fatigue+0.07);p.condition=Math.max(30,p.condition-2);S.weekGames[p.id]++;if(h||hr)box.push(p.name+" "+h+"안타"+(hr?" "+hr+"홈런":""))});
 g.result={us:ru,them:rt,sp:sp.name,ip,er};if(ru>rt){S.W++;opp.L++}else{S.L++;opp.W++}S.runs+=ru;S.ra+=rt;
 addLog((ru>rt?"승 ":"패 ")+ru+":"+rt+" vs "+opp.name+(g.home?" (홈)":" (원정)")+" · 선발 "+sp.name+" "+ip+"이닝 "+er+"실점"+(box.length?" · "+box.slice(0,3).join(", "):""));
 S.opps.forEach(o=>{if(o.id!==opp.id&&rng()<0.83){const other=S.opps[Math.floor(rng()*S.opps.length)];if(other.id!==o.id){const pw=0.5+0.6*((o.bat+o.pitch)-(other.bat+other.pitch));if(rng()<pw){o.W++;other.L++}else{o.L++;other.W++}}}})}
function ageMult(p,k){const phys=["power","speed","stuff","stamina"].includes(k);const a=p.age;if(a<=27)return 1.0;if(a<=31)return phys?0.5:0.8;return phys?-0.35:0.25}
function moraleOverall(p){const m=p.morale,w={playing_time:0.8+0.6*p.personality.ambition,team_success:0.6+0.6*p.personality.ambition,salary_fairness:1,relationships:0.6+0.8*p.personality.loyalty,role_fit:0.8};let s=0,t=0;for(const k in w){s+=w[k]*m[k];t+=w[k]}return s/t}
function trainDay(){const isGame=!!gameToday();const gains={};const staff=S.staff;
 S.players.forEach(p=>{if(p.injury){p.injury--;p.fatigue=Math.max(0,p.fatigue-0.05);if(p.injury===0)addLog(p.name+" 부상 회복, 복귀");return}
  const prog=DATA.programs.find(x=>x.key===S.program[p.id])||DATA.programs.find(x=>x.key==="rest");const inten=isGame?0.5:1.0;
  if(prog.key==="rest"){p.fatigue=Math.max(0,p.fatigue-0.10*inten);p.condition=Math.min(99,p.condition+5*inten);return}
  const dom=prog.for.includes("P")&&p.type=="P"?"pitching":(prog.key==="power"||prog.key==="speed"||prog.key==="endurance"?"conditioning":"batting");const stf=staff[dom]||0.5;
  const mm=1-(0.6-0.4*p.personality.pro)*Math.max(0,0.5-moraleOverall(p));const fpen=1-0.7*Math.max(0,p.fatigue-0.4)/0.6;
  for(const k in prog.targets){if(!(k in p.attrs))continue;const head=Math.max(0,(p.pot[k]-p.attrs[k])/Math.max(p.pot[k],0.05));const am=ageMult(p,k);
   const g=0.0035*prog.targets[k]*(0.6+0.8*stf)*mm*Math.sqrt(head)*fpen*inten*(am>0?am:0)+(am<0?0.0004*am*inten:0);p.attrs[k]=Math.min(0.98,Math.max(0.05,p.attrs[k]+g));gains[p.name]=(gains[p.name]||0)+g}
  p.fatigue=Math.min(1,p.fatigue+0.03*prog.load*inten-0.02);p.condition=Math.max(30,Math.min(99,p.condition+(prog.load<1.2?1.5:-0.5)));
  const risk=(0.0015+0.02*Math.max(0,p.fatigue-0.6)+prog.risk*(0.5+p.fatigue))*inten;if(rng()<risk){p.injury=3+Math.floor(rng()*(8+30*p.fatigue));addLog(p.name+" 훈련 중 부상 · "+p.injury+"일 결장");}
 });
 const top=Object.entries(gains).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,g])=>n+" +"+(g*100).toFixed(2));if(top.length)S.trainLog.unshift({d:fmt(dateOf(S.day)),t:top.join(" · ")});if(S.trainLog.length>60)S.trainLog.length=60}
function recoverDay(){S.players.forEach(p=>{if(!gameToday()){p.fatigue=Math.max(0,p.fatigue-0.06);p.condition=Math.min(99,p.condition+2)}p.condition=Math.min(99,Math.max(30,p.condition+(rng()-0.5)*2))})}
function moraleWeek(){const wp=S.W/Math.max(1,S.W+S.L);const ch=S.players.reduce((s,p)=>s+moraleOverall(p),0)/S.players.length;const avgSal=S.players.reduce((s,p)=>s+p.contract.salary,0)/S.players.length;
 S.players.forEach(p=>{const m=p.morale;const step=(c,t,k=0.15)=>c+k*(t-c);const played=(S.weekGames[p.id]||0)>=(p.type=="P"?1:4);m.playing_time=step(m.playing_time,p.active?(played?1:0.25):0.15);m.team_success=step(m.team_success,wp);
  const fair=Math.min(1,p.contract.salary/Math.max(0.5,avgSal*(0.4+1.6*ovr(p))));m.salary_fairness=step(m.salary_fairness,fair);const roleOk=p.type=="B"?S.lineup.includes(p.id)||!p.active:(p.role=="SP"?S.rotation.includes(p.id):true);m.role_fit=step(m.role_fit,roleOk?1:0.3);m.relationships=step(m.relationships,ch,0.08);
  if(moraleOverall(p)<0.35-0.15*p.personality.loyalty&&rng()<0.5)addLog(p.name+" 불만: 이적 요청 (출전·역할·연봉 점검 필요)");S.weekGames[p.id]=0})}
const POLICY={balanced:{B:["bat","eye","field","speed"],P:["control","stuff","movement"]},hitting:{B:["bat","power","eye"],P:["control","stuff"]},pitching:{B:["bat","field"],P:["stuff","control","movement","endurance"]},youth:{B:["power","bat","speed"],P:["stuff","control"]},rest:{B:["rest","bat"],P:["rest","control"]}};
function applyPolicy(){const pol=POLICY[S.policy];if(!pol)return;S.players.forEach((p,i)=>{if(p.fatigue>0.6){S.program[p.id]="rest";return}const list=pol[p.type];let k=(i+Math.floor(S.day/7))%list.length;if(S.policy==="youth"&&p.age>=29)k=0;S.program[p.id]=list[k]})}
function advanceDay(){if(S.day>=DATA.days){addLog("시즌 종료. 최종 "+S.W+"승 "+S.L+"패");render();return}
 if(S.policy!=="manual"&&S.day%7===0)applyPolicy();
 const g=gameToday();const M=window.ClubMarket;if(g&&!(S.played||[]).includes(g.g)){playGame(g);if(g.home&&M)M.gate(g)}trainDay();recoverDay();if(S.day%7===6){moraleWeek();if(M)M.weekly()}S.day++;
 const g2=S.sched.filter(x=>x.result).length;if(g2===30&&!S.done){S.done=true;addLog("정규 시즌 30경기 종료 · "+S.W+"승 "+S.L+"패");if(M)M.seasonEnd()}save();render()}
function rankNow(){const rows=[{name:"덕아웃 나이트",W:S.W,L:S.L,me:true}].concat(S.opps.map(o=>({name:o.name,W:o.W,L:o.L})));rows.sort((a,b)=>(b.W/(b.W+b.L||1))-(a.W/(a.W+a.L||1)));return rows}
function render(){if(window.APP.theme&&S.club)window.APP.theme(S.club.color,S.club.color2);const d=dateOf(S.day);$("tDate").textContent=fmt(d);$("tRec").textContent=S.W+"-"+S.L;const rows=rankNow();$("tRank").textContent=(rows.findIndex(r=>r.me)+1)+"위 / 6";$("tBudget").textContent=S.budget.toFixed(1);$("tPay").textContent=top40().toFixed(1)+"/137.4";
 $("tMorale").textContent=Math.round(100*S.players.reduce((s,p)=>s+moraleOverall(p),0)/S.players.length)+"%";
 renderSchedule();renderTraining();renderRoster();renderStats();if(window.ClubMarket)window.ClubMarket.render();$("nextDay").disabled=S.day>=DATA.days}
function renderSchedule(){const t=today();const rows=S.sched.map(g=>{const o=S.opps.find(x=>x.id===g.opp);const r=g.result;return "<tr class='"+(g.date===t?"today":"")+"'><td>"+g.g+"</td><td>"+fmt(new Date(g.date+"T00:00:00"))+"</td><td>"+o.name+"</td><td>"+(g.home?"홈":"원정")+"</td><td>"+(r?"<span class='"+(r.us>r.them?"win":"loss")+"'>"+(r.us>r.them?"승":"패")+" "+r.us+":"+r.them+"</span>":"-")+"</td><td>"+(r?r.sp+" "+r.ip+"이닝 "+r.er+"자책":"")+"</td></tr>"});
 if(PG.sched===undefined){const i=S.sched.findIndex(g=>!g.result);PG.sched=Math.floor(Math.max(0,i)/8)}
 pageTable("schedule","<tr><th>#</th><th>날짜</th><th>상대</th><th>장소</th><th>결과</th><th>선발</th></tr>",rows,8,"sched");
 const ng=S.sched.find(g=>!g.result);const sp=S.rotation.map(P)[S.rotIdx%Math.max(1,S.rotation.length)];
 $("nextGame").innerHTML=ng?"<div><b>"+ng.g+"차전 · "+fmt(new Date(ng.date+"T00:00:00"))+" · "+S.opps.find(x=>x.id===ng.opp).name+(ng.home?" (홈)":" (원정)")+"</b><div class='hint'>예정 선발 "+(sp?sp.name+" (피로 "+Math.round(sp.fatigue*100)+"%)":"-")+" · 타선 "+batStrength().toFixed(2)+" · 수비 "+defStrength().toFixed(2)+" · 상대 타격 "+S.opps.find(x=>x.id===ng.opp).bat+" / 투수 "+S.opps.find(x=>x.id===ng.opp).pitch+"</div></div>":"<div class='hint'>남은 경기가 없습니다.</div>";
 $("log").innerHTML=S.log.slice(0,12).map(l=>"<div><span class='d'>"+l.d+"</span>"+l.t+"</div>").join("")}
function bar(v,cls){return "<span class='bar "+(cls||"")+"'><span style='width:"+Math.round(100*Math.max(0,Math.min(1,v)))+"%'></span></span>"}
function renderTraining(){const all=S.players.filter(p=>p.type=="B").concat(S.players.filter(p=>p.type=="P"));
 const row=p=>{const progs=DATA.programs.filter(x=>x.for.includes(p.type));return "<tr><td>"+p.name+(p.injury?" <span class='inj'>부상 "+p.injury+"일</span>":"")+"</td><td>"+(p.pos||p.role)+"</td><td>"+p.age+"</td><td>"+gi(grade(ovr(p)))+"잠재 "+gi(p.pot_grade)+"</td><td>"+bar(p.condition/100)+" "+Math.round(p.condition)+"</td><td>"+bar(p.fatigue,"f")+" "+Math.round(p.fatigue*100)+"%</td><td><select data-pid='"+p.id+"' class='prog'>"+progs.map(x=>"<option value='"+x.key+"'"+(S.program[p.id]===x.key?" selected":"")+">"+x.name+"</option>").join("")+"</select></td></tr>"};
 pageTable("training","<tr><th>선수</th><th>포지션</th><th>나이</th><th>종합·잠재</th><th>컨디션</th><th>피로</th><th>프로그램</th></tr>",all.map(row),7,"train");
 document.querySelectorAll(".prog").forEach(s=>s.onchange=()=>{S.program[+s.dataset.pid]=s.value;save()});
 $("staff").innerHTML="<table>"+Object.entries(S.staff).map(([k,v])=>"<tr><td>"+({batting:"타격 코치",pitching:"투수 코치",conditioning:"컨디셔닝",medical:"메디컬"}[k])+"</td><td>"+bar(v)+" "+Math.round(v*100)+"</td></tr>").join("")+"</table>";
 $("trainLog").innerHTML=S.trainLog.slice(0,8).map(l=>"<div><span class='d'>"+l.d+"</span>"+l.t+"</div>").join("")||"<div class='hint'>아직 훈련 기록이 없습니다.</div>"}
const POS_B=["C","1B","2B","3B","SS","LF","CF","RF","DH","OF","IF"],POS_P=["SP","RP","CL"];
function posSel(p){const opts=p.type=="B"?POS_B:POS_P;const cur=p.type=="B"?p.pos:p.role;return "<select class='posSel' data-pid='"+p.id+"'>"+opts.map(o=>"<option"+(o===cur?" selected":"")+">"+o+"</option>").join("")+"</select>"}
function playerRow(p,extra){return "<tr class='pr' data-pid='"+p.id+"'><td>"+p.name+(p.injury?" <span class='inj'>부상</span>":"")+"</td><td>"+posSel(p)+" "+p.hand+"</td><td>"+p.age+"</td><td>"+(p.type=="B"?DATA.bat_keys:DATA.pit_keys).map(k=>KO[k]+" "+gi(p.grades[k])).join(" ")+"</td><td>"+extra+"</td></tr>"}
function renderRoster(){const bats=S.players.filter(p=>p.type=="B"&&p.active&&!p.injury);
 $("lineup").innerHTML="<table><tr><th>타순</th><th>선수</th><th>포지션</th><th>나이</th><th>등급</th><th></th></tr>"+S.lineup.map((id,i)=>{const p=P(id);return "<tr class='"+(swapSlot===i?"sel":"")+"'><td>"+(i+1)+"</td><td>"+(p?p.name:"-")+"</td><td>"+(p?p.pos:"")+"</td><td>"+(p?p.age:"")+"</td><td>"+(p?DATA.bat_keys.slice(0,4).map(k=>KO[k]+" "+gi(p.grades[k])).join(" "):"")+"</td><td><button data-slot='"+i+"' class='swap'>"+(swapSlot===i?"선택 중":"교체")+"</button></td></tr>"}).join("")+"</table>"+(()=>{const w=positionWarnings();return (w.miss.length||w.dup.length)?"<div class='warn'>포지션 "+(w.miss.length?"비어 있음: "+w.miss.join(", "):"")+(w.dup.length?" 중복: "+w.dup.join(", "):"")+" · 수비 강도 −"+(5*(w.miss.length+w.dup.length))+"%</div>":"<div class='hint'>포지션 8개가 모두 채워졌습니다.</div>"})()+"<div class='hint'>교체를 누른 뒤 오른쪽 1군 타자를 누르면 그 자리에 들어갑니다. 포지션은 선수 목록의 셀렉트로 바꿉니다.</div>";
 document.querySelectorAll(".swap").forEach(b=>b.onclick=()=>{const i=+b.dataset.slot;if(swapSlot===null)swapSlot=i;else{[S.lineup[swapSlot],S.lineup[i]]=[S.lineup[i],S.lineup[swapSlot]];swapSlot=null;save()}renderRoster()});
 const sps=S.players.filter(p=>p.type=="P"&&p.active),rps=sps.filter(p=>!S.rotation.includes(p.id));
 $("rotation").innerHTML="<table><tr><th>#</th><th>선발</th><th>등급</th><th>피로</th><th></th></tr>"+S.rotation.map((id,i)=>{const p=P(id);return "<tr><td>"+(i+1)+"</td><td>"+(p?p.name:"-")+"</td><td>"+(p?DATA.pit_keys.map(k=>KO[k]+" "+gi(p.grades[k])).join(" "):"")+"</td><td>"+(p?bar(p.fatigue,"f")+" "+Math.round(p.fatigue*100)+"%":"")+"</td><td><select data-slot='"+i+"' class='rot'>"+sps.map(x=>"<option value='"+x.id+"'"+(x.id===id?" selected":"")+">"+x.name+"</option>").join("")+"</select></td></tr>"}).join("")+"</table><div class='hint' style='margin-top:6px'>불펜: "+rps.map(p=>p.name).join(", ")+"</div>";
 document.querySelectorAll(".rot").forEach(s=>s.onchange=()=>{const i=+s.dataset.slot,id=+s.value;const j=S.rotation.indexOf(id);if(j>=0)S.rotation[j]=S.rotation[i];S.rotation[i]=id;save();renderRoster()});
 const act=S.players.filter(p=>p.active),res=S.players.filter(p=>!p.active);
 const rows=act.map(p=>playerRow(p,"<button data-act='down' data-pid='"+p.id+"'>2군</button>")).concat(["<tr><th colspan=5>2군 ("+res.length+")</th></tr>"],res.map(p=>playerRow(p,"<button data-act='up' data-pid='"+p.id+"'"+(act.length>=26?" disabled":"")+">1군</button> <button data-act='release' data-pid='"+p.id+"'>방출</button>")));
 pageTable("rosterList","<tr><th>1군 ("+act.length+"/26)</th><th></th><th></th><th></th><th></th></tr>",rows,7,"roster");
 document.querySelectorAll(".posSel").forEach(sl=>{sl.onclick=e=>e.stopPropagation();sl.onchange=()=>{const p=P(+sl.dataset.pid);if(p.type=="B")p.pos=sl.value;else p.role=sl.value;save();renderRoster()}});
 document.querySelectorAll(".pr").forEach(r=>r.onclick=e=>{if(e.target.tagName==="BUTTON"||e.target.tagName==="SELECT"||e.target.tagName==="OPTION")return;const p=P(+r.dataset.pid);if(swapSlot!==null&&p&&p.type=="B"&&p.active){if(!S.lineup.includes(p.id)){S.lineup[swapSlot]=p.id;swapSlot=null;save();renderRoster();return}}sel=p;renderCard();$("cardModal").hidden=false});
 document.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>{const p=P(+b.dataset.pid);const a=b.dataset.act;if(a==="down"){p.active=false;S.lineup=S.lineup.map(id=>id===p.id?(S.players.find(x=>x.type=="B"&&x.active&&!S.lineup.includes(x.id))||{id:null}).id:id);S.rotation=S.rotation.filter(id=>id!==p.id);if(S.rotation.length<5){const c=S.players.find(x=>x.type=="P"&&x.active&&!S.rotation.includes(x.id));if(c)S.rotation.push(c.id)}addLog(p.name+" 2군 이동")}
  else if(a==="up"){p.active=true;addLog(p.name+" 1군 등록")}
  else if(a==="release"){const bo=Math.max(0.2,Math.round(p.contract.salary*0.5*10)/10);if(S.budget<bo){addLog(p.name+" 방출 불가 · 잔여 연봉 정산금 "+bo+"억이 잔액보다 큽니다");save();render();return}
   S.players=S.players.filter(x=>x.id!==p.id);S.players.forEach(x=>x.morale.relationships=Math.max(0,x.morale.relationships-0.02));S.budget=Math.round((S.budget-bo)*10)/10;if(S.fin){S.fin.exp.buyout+=bo;S.fin.ledger.unshift({d:fmt(dateOf(S.day)),kind:"방출 정산",amt:-bo,text:p.name})}addLog(p.name+" 방출 · 잔여 연봉 정산 "+bo+"억 · 동료 사기 소폭 하락")}
  save();render()});
 pageTable("market","<tr><th>선수</th><th>포지션</th><th>나이</th><th>등급</th><th>요구 연봉</th></tr>",S.fa.map(p=>"<tr><td>"+p.name+"</td><td>"+(p.pos||p.role)+"</td><td>"+p.age+"</td><td>"+(p.type=="B"?DATA.bat_keys:DATA.pit_keys).slice(0,3).map(k=>KO[k]+" "+gi(p.grades[k])).join(" ")+"</td><td>"+p.asking+"억 <button data-sign='"+p.id+"'>협상</button></td></tr>"),3,"fa");
 document.querySelectorAll("[data-sign]").forEach(b=>b.onclick=()=>{if(window.ClubMarket)window.ClubMarket.startNego(+b.dataset.sign)});
 renderCard()}
function renderCard(){const p=sel;if(!p){$("playerCard").innerHTML="<div class='hint'>선수를 누르면 보입니다.</div>";return}if($("cardClose"))$("cardClose").onclick=()=>{$("cardModal").hidden=true};const ks=p.type=="B"?DATA.bat_keys:DATA.pit_keys;const st=p.stats;
 $("playerCard").innerHTML="<div class='card'><h3>"+p.name+" <span class='badge'>"+(p.pos||p.role)+"</span><span class='badge'>"+p.age+"세 · "+p.hand+"</span><span class='badge'>"+(p.active?"1군":"2군")+"</span></h3>"+
 "<table>"+ks.map(k=>"<tr><td>"+KO[k]+"</td><td>"+gi(p.grades[k])+"</td><td>"+bar(p.attrs[k])+"</td><td class='hint'>잠재 "+gi(grade(p.pot[k]))+"</td></tr>").join("")+"</table>"+
 "<div style='margin-top:8px'>컨디션 "+bar(p.condition/100)+" "+Math.round(p.condition)+" · 피로 "+bar(p.fatigue,"f")+" "+Math.round(p.fatigue*100)+"%"+(p.injury?" · <span class='inj'>부상 "+p.injury+"일</span>":"")+"</div>"+
 "<div>만족도 "+Math.round(100*moraleOverall(p))+"% · 출전 "+Math.round(100*p.morale.playing_time)+" · 성적 "+Math.round(100*p.morale.team_success)+" · 연봉 "+Math.round(100*p.morale.salary_fairness)+" · 동료 "+Math.round(100*p.morale.relationships)+" · 역할 "+Math.round(100*p.morale.role_fit)+"</div>"+
 "<div>성격 · 야망 "+p.personality.ambition+" 충성 "+p.personality.loyalty+" 프로의식 "+p.personality.pro+"</div>"+
 "<div>계약 · "+p.contract.salary+"억 × "+p.contract.years+"년 ("+({rookie:"신인",arbitration:"연봉조정",veteran:"베테랑"}[p.contract.status]||p.contract.status)+")</div>"+
 "<div class='hint' style='margin-top:6px'>"+(p.type=="B"?"시즌 "+st.G+"경기 "+st.PA+"타석 "+st.H+"안타 "+st.HR+"홈런 "+st.RBI+"타점 · 타율 "+(st.PA?(st.H/Math.max(1,st.PA-st.BB)).toFixed(3):"-"):"시즌 "+st.G+"경기 "+st.IP+"이닝 "+st.ER+"자책 · ERA "+(st.IP?(9*st.ER/st.IP).toFixed(2):"-")+" · "+st.W+"승 "+st.L+"패 "+st.SV+"세이브")+"</div>"+
 "<div style='margin-top:8px'>개별 훈련 <select id='cardProg'>"+DATA.programs.filter(x=>x.for.includes(p.type)).map(x=>"<option value='"+x.key+"'"+(S.program[p.id]===x.key?" selected":"")+">"+x.name+"</option>").join("")+"</select>"+(S.policy!=="manual"?" <span class='hint'>(방침이 매주 다시 배정합니다)</span>":"")+"</div>"+
 (p.type=="P"?"<div class='form'><span>팔 각도</span><input type='range' min='20' max='90' value='"+((p.form_adj||{}).abd||55)+"' data-f='abd'><span>"+((p.form_adj||{}).abd||55)+"°</span><span>스트라이드</span><input type='range' min='70' max='100' value='"+((p.form_adj||{}).stride||84)+"' data-f='stride'><span>"+((p.form_adj||{}).stride||84)+"%</span><span>상체 기울기</span><input type='range' min='10' max='50' value='"+((p.form_adj||{}).lean||30)+"' data-f='lean'><span>"+((p.form_adj||{}).lean||30)+"°</span></div><div class='hint'>투구 폼 조정은 저장되며, 엔진이 브라우저에서 실시간으로 돌게 되면 투구 물리에 반영됩니다(지금은 미리 계산된 은행 사용).</div>":"")+"</div>";
 const cp=$("cardProg");if(cp)cp.onchange=()=>{S.program[p.id]=cp.value;save()};document.querySelectorAll("#playerCard input[type=range]").forEach(r=>r.oninput=()=>{p.form_adj=p.form_adj||{};p.form_adj[r.dataset.f]=+r.value;r.nextElementSibling.textContent=r.value+(r.dataset.f==="stride"?"%":"°");save()})}
function renderStats(){const rows=rankNow();$("standings").innerHTML="<table><tr><th>#</th><th>구단</th><th class='num'>승</th><th class='num'>패</th><th class='num'>승률</th></tr>"+rows.map((r,i)=>"<tr"+(r.me?" class='today'":"")+"><td>"+(i+1)+"</td><td>"+r.name+"</td><td class='num'>"+r.W+"</td><td class='num'>"+r.L+"</td><td class='num'>"+((r.W/((r.W+r.L)||1))).toFixed(3)+"</td></tr>").join("")+"</table>";
 const g=S.W+S.L;$("teamStats").innerHTML="<table><tr><td>경기</td><td class='num'>"+g+"</td></tr><tr><td>득점 / 실점</td><td class='num'>"+S.runs+" / "+S.ra+"</td></tr><tr><td>경기당 득점</td><td class='num'>"+(g?(S.runs/g).toFixed(2):"-")+"</td></tr><tr><td>타선 강도</td><td class='num'>"+batStrength().toFixed(2)+"</td></tr><tr><td>수비 강도</td><td class='num'>"+defStrength().toFixed(2)+"</td></tr><tr><td>1군 평균 만족도</td><td class='num'>"+Math.round(100*S.players.filter(p=>p.active).reduce((s,p)=>s+moraleOverall(p),0)/Math.max(1,S.players.filter(p=>p.active).length))+"%</td></tr></table>";
 const bats=S.players.filter(p=>p.type=="B"&&p.stats.PA>0).sort((a,b)=>b.stats.H/Math.max(1,b.stats.PA)-a.stats.H/Math.max(1,a.stats.PA));
 pageTable("batStats","<tr><th>선수</th><th class='num'>G</th><th class='num'>PA</th><th class='num'>H</th><th class='num'>HR</th><th class='num'>RBI</th><th class='num'>BB</th><th class='num'>K</th><th class='num'>AVG</th></tr>",bats.map(p=>{const s=p.stats;return "<tr><td>"+p.name+"</td><td class='num'>"+s.G+"</td><td class='num'>"+s.PA+"</td><td class='num'>"+s.H+"</td><td class='num'>"+s.HR+"</td><td class='num'>"+s.RBI+"</td><td class='num'>"+s.BB+"</td><td class='num'>"+s.K+"</td><td class='num'>"+(s.H/Math.max(1,s.PA-s.BB)).toFixed(3)+"</td></tr>"}),5,"bat");
 const pits=S.players.filter(p=>p.type=="P"&&p.stats.IP>0).sort((a,b)=>(9*a.stats.ER/a.stats.IP)-(9*b.stats.ER/b.stats.IP));
 pageTable("pitStats","<tr><th>선수</th><th class='num'>G</th><th class='num'>IP</th><th class='num'>ER</th><th class='num'>ERA</th><th class='num'>W</th><th class='num'>L</th><th class='num'>SV</th><th class='num'>K</th></tr>",pits.map(p=>{const s=p.stats;return "<tr><td>"+p.name+"</td><td class='num'>"+s.G+"</td><td class='num'>"+s.IP+"</td><td class='num'>"+s.ER+"</td><td class='num'>"+(9*s.ER/s.IP).toFixed(2)+"</td><td class='num'>"+s.W+"</td><td class='num'>"+s.L+"</td><td class='num'>"+s.SV+"</td><td class='num'>"+s.KP+"</td></tr>"}),4,"pit")}
document.querySelectorAll(".ctabs [data-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll(".ctabs [data-tab]").forEach(x=>x.classList.toggle("on",x===b));["schedule","training","roster","stats","market"].forEach(t=>{if($("tab-"+t))$("tab-"+t).hidden=t!==b.dataset.tab})});
$("nextDay").onclick=()=>advanceDay();
$("toGame").onclick=()=>{let n=0;do{advanceDay();n++}while(!S.sched.find(g=>g.date===today()&&!g.result)&&S.day<DATA.days&&n<10)};
$("week").onclick=()=>{for(let i=0;i<7&&S.day<DATA.days;i++)advanceDay()};
$("reset").onclick=()=>{if(confirm("저장된 시즌을 지우고 새로 시작할까요?")){fresh();render()}};
window.ClubInt={S:()=>S,P,ovr,save,render,addLog,pageTable,kboPlayer,rankNow,grade,gi,bar,KO,DATA,rng,srng,hash32,today,dateOf,fmt,moraleOverall,salaryModel,top40,positionWarnings};
window.ClubUI_tab=t=>{const b=document.querySelector(".ctabs [data-tab='"+t+"']");if(b)b.click()};
load().then(ok=>{if(!ok)fresh();render();if(window.APP.onClubReady)window.APP.onClubReady()});
document.querySelectorAll(".pol").forEach(b=>b.classList.toggle("on",b.dataset.pol===(S&&S.policy||"manual")));
document.querySelectorAll(".pol").forEach(b=>b.onclick=()=>{S.policy=b.dataset.pol;document.querySelectorAll(".pol").forEach(x=>x.classList.toggle("on",x===b));if(S.policy!=="manual")applyPolicy();save();render()});
function recordExternalGame(res){const g=gameToday();if(!g||g.result)return false;const opp=S.opps.find(o=>o.id===g.opp);g.result={us:res.us,them:res.them,sp:res.sp||"-",ip:res.ip||0,er:res.er||0,real:true};if(res.us>res.them){S.W++;opp.L++}else{S.L++;opp.W++}S.runs+=res.us;S.ra+=res.them;S.played=S.played||[];S.played.push(g.g);
 (res.box||[]).forEach(b=>{const p=S.players.find(x=>x.name===b.name);if(!p)return;p.stats.G++;p.stats.PA+=b.PA||0;p.stats.H+=b.H||0;p.stats.BB+=b.BB||0;p.stats.K+=b.K||0;p.fatigue=Math.min(1,p.fatigue+0.07)});
 if(res.sp){const p=S.players.find(x=>x.name===res.sp);if(p){p.stats.G++;p.stats.IP=Math.round((p.stats.IP+(res.ip||0))*10)/10;p.stats.ER+=res.er||0;if(res.us>res.them)p.stats.W++;else p.stats.L++;p.fatigue=Math.min(1,p.fatigue+0.45)}}
 addLog((res.us>res.them?"승 ":"패 ")+res.us+":"+res.them+" vs "+opp.name+" · 직접 경기");save();render();return true}
window.ClubUI={state:()=>S,render,advanceDay,fresh,setState:s=>{S=s;save();render()},recordExternalGame,gameToday:()=>{const g=gameToday();return g?{g:g.g,opp:S.opps.find(o=>o.id===g.opp).name,home:g.home,starter:S.opps.find(o=>o.id===g.opp).starter}:null},lineupForGame:()=>{if(!S)return null;let names=null,oppNames=null,oppClub=null;if(S.kbo&&window.APP.kbo){names={};S.players.filter(p=>p.engine_id!==undefined).forEach(p=>{names[(p.type=="B"?"b":"p")+p.engine_id]={name:p.name,pos:p.pos,num:p.num}});const g=gameToday()||S.sched.find(x=>!x.result);const oc=g?S.opps.find(o=>o.id===g.opp):null;const kc=oc?window.APP.kbo.clubs.find(c=>c.code===oc.code):null;if(kc){oppClub={name:kc.name,short:kc.short,color:kc.color};const R=window.APP.roster;const ob=kc.players.filter(p=>p.group!=="P"&&p.active);const used=new Set();oppNames={};R.opp.batters.forEach(ab=>{let c=ob.find(p=>!used.has(p.name)&&(p.bats==="L")===(ab.hand==="L"))||ob.find(p=>!used.has(p.name));if(c){used.add(c.name);oppNames[ab.id]={name:c.name,pos:c.pos,num:c.num}}});const op=kc.players.filter(p=>p.group==="P"&&p.active);R.opp.pitchers.forEach((ap,i)=>{const c=op.filter(p=>(p.throws==="L")===(ap.hand==="L"))[i%Math.max(1,op.length)]||op[i%Math.max(1,op.length)];if(c)oppNames["p"+ap.id]={name:c.name,num:c.num}})}}const pitcherState={};S.players.filter(p=>p.type=="P"&&p.engine_id!==undefined).forEach(p=>{pitcherState[p.engine_id]={fatigue:p.fatigue,condition:p.condition,injury:p.injury}});const ids=S.lineup.map(id=>{const p=S.players.find(x=>x.id===id);return p&&p.engine_id!==undefined?p.engine_id:null});const sp=S.rotation.map(id=>S.players.find(x=>x.id===id)).filter(p=>p&&p.engine_id!==undefined&&!p.injury)[S.rotIdx%Math.max(1,S.rotation.length)];return {order:ids.every(x=>x!==null)?ids:null,pitcher:sp?sp.engine_id:null,pitcherState,names,oppNames,oppClub,clubName:S.club&&S.club.name}}};

})();
