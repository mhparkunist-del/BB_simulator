/* bbsim app · club office: schedule, quick-sim games, training, morale, roster moves (state in IndexedDB) */
(function(){
const DATA=window.APP.club;
const $=id=>document.getElementById(id);
const KO=DATA.ko;
let S=null, sel=null, swapSlot=null;
function rng(){S.seed=(S.seed*1664525+1013904223)>>>0;return S.seed/4294967296}
function gauss(){let u=0,v=0;while(u===0)u=rng();while(v===0)v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function poisson(l){let L=Math.exp(-l),k=0,p=1;do{k++;p*=rng()}while(p>L);return k-1}
function grade(v){return v>=0.85?"S":v>=0.7?"A":v>=0.55?"B":v>=0.4?"C":"D"}
function gi(g){return "<i class='g "+g+"'>"+g+"</i>"}
function fresh(){const d=JSON.parse(JSON.stringify(DATA));
 const bats=d.players.filter(p=>p.type=="B"&&p.active), sps=d.players.filter(p=>p.type=="P"&&p.role=="SP"&&p.active);
 S={seed:20260403,day:0,players:d.players,fa:d.free_agents,opps:d.opponents,sched:d.schedule,budget:d.club.budget,staff:d.club.staff,
    lineup:bats.slice(0,9).map(p=>p.id),rotation:sps.slice(0,5).map(p=>p.id),rotIdx:0,program:{},log:[],trainLog:[],W:0,L:0,runs:0,ra:0,weekGames:{}};
 S.players.forEach(p=>{S.program[p.id]=p.type=="B"?"bat":"control";S.weekGames[p.id]=0});
 addLog("시즌 개막 준비. 예산 "+S.budget+"억, 선수 "+S.players.length+"명.");save()}
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
function defStrength(){const L=S.lineup.map(P).filter(p=>p&&!p.injury);if(!L.length)return 0.4;return L.reduce((s,p)=>s+0.7*p.attrs.defense+0.3*p.attrs.arm,0)/L.length}
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
function advanceDay(){if(S.day>=DATA.days){addLog("시즌 종료. 최종 "+S.W+"승 "+S.L+"패");render();return}
 const g=gameToday();if(g)playGame(g);trainDay();recoverDay();if(S.day%7===6)moraleWeek();S.day++;
 const g2=S.sched.filter(x=>x.result).length;if(g2===30&&!S.done){S.done=true;addLog("정규 시즌 30경기 종료 · "+S.W+"승 "+S.L+"패")}save();render()}
function rankNow(){const rows=[{name:"덕아웃 나이트",W:S.W,L:S.L,me:true}].concat(S.opps.map(o=>({name:o.name,W:o.W,L:o.L})));rows.sort((a,b)=>(b.W/(b.W+b.L||1))-(a.W/(a.W+a.L||1)));return rows}
function render(){const d=dateOf(S.day);$("tDate").textContent=fmt(d);$("tRec").textContent=S.W+"-"+S.L;const rows=rankNow();$("tRank").textContent=(rows.findIndex(r=>r.me)+1)+"위 / 6";$("tBudget").textContent=S.budget.toFixed(1);$("tPay").textContent=S.players.reduce((s,p)=>s+p.contract.salary,0).toFixed(1);
 $("tMorale").textContent=Math.round(100*S.players.reduce((s,p)=>s+moraleOverall(p),0)/S.players.length)+"%";
 renderSchedule();renderTraining();renderRoster();renderStats();$("nextDay").disabled=S.day>=DATA.days}
function renderSchedule(){const t=today();$("schedule").innerHTML="<table><tr><th>#</th><th>날짜</th><th>상대</th><th>장소</th><th>결과</th><th>선발</th></tr>"+S.sched.map(g=>{const o=S.opps.find(x=>x.id===g.opp);const r=g.result;return "<tr class='"+(g.date===t?"today":"")+"'><td>"+g.g+"</td><td>"+fmt(new Date(g.date+"T00:00:00"))+"</td><td>"+o.name+"</td><td>"+(g.home?"홈":"원정")+"</td><td>"+(r?"<span class='"+(r.us>r.them?"win":"loss")+"'>"+(r.us>r.them?"승":"패")+" "+r.us+":"+r.them+"</span>":"-")+"</td><td>"+(r?r.sp+" "+r.ip+"이닝 "+r.er+"자책":"")+"</td></tr>"}).join("")+"</table>";
 const ng=S.sched.find(g=>!g.result);const sp=S.rotation.map(P)[S.rotIdx%Math.max(1,S.rotation.length)];
 $("nextGame").innerHTML=ng?"<div class='card'><h3>"+ng.g+"차전 · "+fmt(new Date(ng.date+"T00:00:00"))+" · "+S.opps.find(x=>x.id===ng.opp).name+(ng.home?" (홈)":" (원정)")+"</h3><div>예정 선발: "+(sp?sp.name+" (피로 "+Math.round(sp.fatigue*100)+"%)":"-")+"</div><div class='hint'>타선 강도 "+batStrength().toFixed(2)+" · 수비 "+defStrength().toFixed(2)+" · 상대 타격 "+S.opps.find(x=>x.id===ng.opp).bat+" / 투수 "+S.opps.find(x=>x.id===ng.opp).pitch+"</div></div>":"<div class='hint'>남은 경기가 없습니다.</div>";
 $("log").innerHTML=S.log.map(l=>"<div><span class='d'>"+l.d+"</span>"+l.t+"</div>").join("")}
function bar(v,cls){return "<span class='bar "+(cls||"")+"'><span style='width:"+Math.round(100*Math.max(0,Math.min(1,v)))+"%'></span></span>"}
function renderTraining(){const rowsB=S.players.filter(p=>p.type=="B"),rowsP=S.players.filter(p=>p.type=="P");
 const row=p=>{const progs=DATA.programs.filter(x=>x.for.includes(p.type));return "<tr><td>"+p.name+(p.injury?" <span class='inj'>부상 "+p.injury+"일</span>":"")+"</td><td>"+(p.pos||p.role)+"</td><td>"+p.age+"</td><td>"+gi(grade(ovr(p)))+" 잠재 "+gi(p.pot_grade)+"</td><td>컨디션 "+bar(p.condition/100)+" "+Math.round(p.condition)+"</td><td>피로 "+bar(p.fatigue,"f")+" "+Math.round(p.fatigue*100)+"%</td><td><select data-pid='"+p.id+"' class='prog'>"+progs.map(x=>"<option value='"+x.key+"'"+(S.program[p.id]===x.key?" selected":"")+">"+x.name+"</option>").join("")+"</select></td></tr>"};
 $("training").innerHTML="<table><tr><th>선수</th><th>포지션</th><th>나이</th><th>종합·잠재</th><th>컨디션</th><th>피로</th><th>프로그램</th></tr>"+rowsB.map(row).join("")+"<tr><td colspan=7 class='hint'>투수</td></tr>"+rowsP.map(row).join("")+"</table>";
 document.querySelectorAll(".prog").forEach(s=>s.onchange=()=>{S.program[+s.dataset.pid]=s.value;save()});
 $("staff").innerHTML="<table>"+Object.entries(S.staff).map(([k,v])=>"<tr><td>"+({batting:"타격 코치",pitching:"투수 코치",conditioning:"컨디셔닝",medical:"메디컬"}[k])+"</td><td>"+bar(v)+" "+Math.round(v*100)+"</td></tr>").join("")+"</table><div class='hint' style='margin-top:6px'>코치 역량이 높을수록 해당 영역 훈련 효율이 오릅니다(0.6+0.8×역량).</div>";
 $("trainLog").innerHTML=S.trainLog.map(l=>"<div><span class='d'>"+l.d+"</span>"+l.t+"</div>").join("")||"<div class='hint'>아직 훈련 기록이 없습니다.</div>"}
function playerRow(p,extra){return "<tr class='pr' data-pid='"+p.id+"'><td>"+p.name+(p.injury?" <span class='inj'>부상</span>":"")+"</td><td>"+(p.pos||p.role)+" · "+p.hand+"</td><td>"+p.age+"</td><td>"+(p.type=="B"?DATA.bat_keys:DATA.pit_keys).map(k=>KO[k]+" "+gi(p.grades[k])).join(" ")+"</td><td>"+extra+"</td></tr>"}
function renderRoster(){const bats=S.players.filter(p=>p.type=="B"&&p.active&&!p.injury);
 $("lineup").innerHTML="<table><tr><th>타순</th><th>선수</th><th>포지션</th><th>나이</th><th>등급</th><th></th></tr>"+S.lineup.map((id,i)=>{const p=P(id);return "<tr class='"+(swapSlot===i?"sel":"")+"'><td>"+(i+1)+"</td><td>"+(p?p.name:"-")+"</td><td>"+(p?p.pos:"")+"</td><td>"+(p?p.age:"")+"</td><td>"+(p?DATA.bat_keys.slice(0,4).map(k=>KO[k]+" "+gi(p.grades[k])).join(" "):"")+"</td><td><button data-slot='"+i+"' class='swap'>"+(swapSlot===i?"선택 중":"교체")+"</button></td></tr>"}).join("")+"</table><div class='hint' style='margin-top:6px'>교체를 누른 뒤 아래 1군 타자를 누르면 그 자리에 들어갑니다. 타순끼리 교체는 교체를 두 번 누르세요.</div>";
 document.querySelectorAll(".swap").forEach(b=>b.onclick=()=>{const i=+b.dataset.slot;if(swapSlot===null)swapSlot=i;else{[S.lineup[swapSlot],S.lineup[i]]=[S.lineup[i],S.lineup[swapSlot]];swapSlot=null;save()}renderRoster()});
 const sps=S.players.filter(p=>p.type=="P"&&p.active),rps=sps.filter(p=>!S.rotation.includes(p.id));
 $("rotation").innerHTML="<table><tr><th>#</th><th>선발</th><th>등급</th><th>피로</th><th></th></tr>"+S.rotation.map((id,i)=>{const p=P(id);return "<tr><td>"+(i+1)+"</td><td>"+(p?p.name:"-")+"</td><td>"+(p?DATA.pit_keys.map(k=>KO[k]+" "+gi(p.grades[k])).join(" "):"")+"</td><td>"+(p?bar(p.fatigue,"f")+" "+Math.round(p.fatigue*100)+"%":"")+"</td><td><select data-slot='"+i+"' class='rot'>"+sps.map(x=>"<option value='"+x.id+"'"+(x.id===id?" selected":"")+">"+x.name+"</option>").join("")+"</select></td></tr>"}).join("")+"</table><div class='hint' style='margin-top:6px'>불펜: "+rps.map(p=>p.name).join(", ")+"</div>";
 document.querySelectorAll(".rot").forEach(s=>s.onchange=()=>{const i=+s.dataset.slot,id=+s.value;const j=S.rotation.indexOf(id);if(j>=0)S.rotation[j]=S.rotation[i];S.rotation[i]=id;save();renderRoster()});
 const act=S.players.filter(p=>p.active),res=S.players.filter(p=>!p.active);
 $("rosterList").innerHTML="<table><tr><th>1군 ("+act.length+"/26)</th><th></th><th></th><th></th><th></th></tr>"+act.map(p=>playerRow(p,"<button data-act='down' data-pid='"+p.id+"'>2군</button>")).join("")+"<tr><th>2군 ("+res.length+")</th><th></th><th></th><th></th><th></th></tr>"+res.map(p=>playerRow(p,"<button data-act='up' data-pid='"+p.id+"'"+(act.length>=26?" disabled":"")+">1군</button> <button data-act='release' data-pid='"+p.id+"'>방출</button>")).join("")+"</table>";
 document.querySelectorAll(".pr").forEach(r=>r.onclick=e=>{if(e.target.tagName==="BUTTON")return;const p=P(+r.dataset.pid);if(swapSlot!==null&&p&&p.type=="B"&&p.active){if(!S.lineup.includes(p.id)){S.lineup[swapSlot]=p.id;swapSlot=null;save();renderRoster();return}}sel=p;renderCard()});
 document.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>{const p=P(+b.dataset.pid);const a=b.dataset.act;if(a==="down"){p.active=false;S.lineup=S.lineup.map(id=>id===p.id?(S.players.find(x=>x.type=="B"&&x.active&&!S.lineup.includes(x.id))||{id:null}).id:id);S.rotation=S.rotation.filter(id=>id!==p.id);if(S.rotation.length<5){const c=S.players.find(x=>x.type=="P"&&x.active&&!S.rotation.includes(x.id));if(c)S.rotation.push(c.id)}addLog(p.name+" 2군 이동")}
  else if(a==="up"){p.active=true;addLog(p.name+" 1군 등록")}
  else if(a==="release"){S.players=S.players.filter(x=>x.id!==p.id);S.players.forEach(x=>x.morale.relationships=Math.max(0,x.morale.relationships-0.02));addLog(p.name+" 방출 · 동료 사기 소폭 하락")}
  save();render()});
 $("market").innerHTML="<table><tr><th>선수</th><th>포지션</th><th>나이</th><th>등급</th><th>요구 연봉</th></tr>"+S.fa.map(p=>"<tr><td>"+p.name+"</td><td>"+(p.pos||p.role)+"</td><td>"+p.age+"</td><td>"+(p.type=="B"?DATA.bat_keys:DATA.pit_keys).slice(0,3).map(k=>KO[k]+" "+gi(p.grades[k])).join(" ")+"</td><td>"+p.asking+"억 <button data-sign='"+p.id+"'"+(S.budget<p.asking?" disabled":"")+">영입</button></td></tr>").join("")+"</table><div class='hint' style='margin-top:6px'>영입하면 2군에 들어오고 예산에서 첫해 연봉이 빠집니다.</div>";
 document.querySelectorAll("[data-sign]").forEach(b=>b.onclick=()=>{const p=S.fa.find(x=>x.id===+b.dataset.sign);S.fa=S.fa.filter(x=>x!==p);p.contract.salary=p.asking;p.active=false;S.program[p.id]=p.type=="B"?"bat":"control";S.weekGames[p.id]=0;S.players.push(p);S.budget=Math.round((S.budget-p.asking)*10)/10;addLog(p.name+" 영입 · 연봉 "+p.asking+"억");save();render()});
 renderCard()}
function renderCard(){const p=sel;if(!p){$("playerCard").innerHTML="<div class='hint'>선수를 누르면 보입니다.</div>";return}const ks=p.type=="B"?DATA.bat_keys:DATA.pit_keys;const st=p.stats;
 $("playerCard").innerHTML="<div class='card'><h3>"+p.name+" <span class='badge'>"+(p.pos||p.role)+"</span><span class='badge'>"+p.age+"세 · "+p.hand+"</span><span class='badge'>"+(p.active?"1군":"2군")+"</span></h3>"+
 "<table>"+ks.map(k=>"<tr><td>"+KO[k]+"</td><td>"+gi(p.grades[k])+"</td><td>"+bar(p.attrs[k])+"</td><td class='hint'>잠재 "+gi(grade(p.pot[k]))+"</td></tr>").join("")+"</table>"+
 "<div style='margin-top:8px'>컨디션 "+bar(p.condition/100)+" "+Math.round(p.condition)+" · 피로 "+bar(p.fatigue,"f")+" "+Math.round(p.fatigue*100)+"%"+(p.injury?" · <span class='inj'>부상 "+p.injury+"일</span>":"")+"</div>"+
 "<div>만족도 "+Math.round(100*moraleOverall(p))+"% · 출전 "+Math.round(100*p.morale.playing_time)+" · 성적 "+Math.round(100*p.morale.team_success)+" · 연봉 "+Math.round(100*p.morale.salary_fairness)+" · 동료 "+Math.round(100*p.morale.relationships)+" · 역할 "+Math.round(100*p.morale.role_fit)+"</div>"+
 "<div>성격 · 야망 "+p.personality.ambition+" 충성 "+p.personality.loyalty+" 프로의식 "+p.personality.pro+"</div>"+
 "<div>계약 · "+p.contract.salary+"억 × "+p.contract.years+"년 ("+({rookie:"신인",arbitration:"연봉조정",veteran:"베테랑"}[p.contract.status]||p.contract.status)+")</div>"+
 "<div class='hint' style='margin-top:6px'>"+(p.type=="B"?"시즌 "+st.G+"경기 "+st.PA+"타석 "+st.H+"안타 "+st.HR+"홈런 "+st.RBI+"타점 · 타율 "+(st.PA?(st.H/Math.max(1,st.PA-st.BB)).toFixed(3):"-"):"시즌 "+st.G+"경기 "+st.IP+"이닝 "+st.ER+"자책 · ERA "+(st.IP?(9*st.ER/st.IP).toFixed(2):"-")+" · "+st.W+"승 "+st.L+"패 "+st.SV+"세이브")+"</div></div>"}
function renderStats(){const rows=rankNow();$("standings").innerHTML="<table><tr><th>#</th><th>구단</th><th class='num'>승</th><th class='num'>패</th><th class='num'>승률</th></tr>"+rows.map((r,i)=>"<tr"+(r.me?" class='today'":"")+"><td>"+(i+1)+"</td><td>"+r.name+"</td><td class='num'>"+r.W+"</td><td class='num'>"+r.L+"</td><td class='num'>"+((r.W/((r.W+r.L)||1))).toFixed(3)+"</td></tr>").join("")+"</table>";
 const g=S.W+S.L;$("teamStats").innerHTML="<table><tr><td>경기</td><td class='num'>"+g+"</td></tr><tr><td>득점 / 실점</td><td class='num'>"+S.runs+" / "+S.ra+"</td></tr><tr><td>경기당 득점</td><td class='num'>"+(g?(S.runs/g).toFixed(2):"-")+"</td></tr><tr><td>타선 강도</td><td class='num'>"+batStrength().toFixed(2)+"</td></tr><tr><td>수비 강도</td><td class='num'>"+defStrength().toFixed(2)+"</td></tr><tr><td>1군 평균 만족도</td><td class='num'>"+Math.round(100*S.players.filter(p=>p.active).reduce((s,p)=>s+moraleOverall(p),0)/Math.max(1,S.players.filter(p=>p.active).length))+"%</td></tr></table>";
 const bats=S.players.filter(p=>p.type=="B"&&p.stats.PA>0).sort((a,b)=>b.stats.H/Math.max(1,b.stats.PA)-a.stats.H/Math.max(1,a.stats.PA));
 $("batStats").innerHTML="<table><tr><th>선수</th><th class='num'>G</th><th class='num'>PA</th><th class='num'>H</th><th class='num'>HR</th><th class='num'>RBI</th><th class='num'>BB</th><th class='num'>K</th><th class='num'>AVG</th></tr>"+bats.map(p=>{const s=p.stats;return "<tr><td>"+p.name+"</td><td class='num'>"+s.G+"</td><td class='num'>"+s.PA+"</td><td class='num'>"+s.H+"</td><td class='num'>"+s.HR+"</td><td class='num'>"+s.RBI+"</td><td class='num'>"+s.BB+"</td><td class='num'>"+s.K+"</td><td class='num'>"+(s.H/Math.max(1,s.PA-s.BB)).toFixed(3)+"</td></tr>"}).join("")+"</table>"||"";
 const pits=S.players.filter(p=>p.type=="P"&&p.stats.IP>0).sort((a,b)=>(9*a.stats.ER/a.stats.IP)-(9*b.stats.ER/b.stats.IP));
 $("pitStats").innerHTML="<table><tr><th>선수</th><th class='num'>G</th><th class='num'>IP</th><th class='num'>ER</th><th class='num'>ERA</th><th class='num'>W</th><th class='num'>L</th><th class='num'>SV</th><th class='num'>K</th></tr>"+pits.map(p=>{const s=p.stats;return "<tr><td>"+p.name+"</td><td class='num'>"+s.G+"</td><td class='num'>"+s.IP+"</td><td class='num'>"+s.ER+"</td><td class='num'>"+(9*s.ER/s.IP).toFixed(2)+"</td><td class='num'>"+s.W+"</td><td class='num'>"+s.L+"</td><td class='num'>"+s.SV+"</td><td class='num'>"+s.KP+"</td></tr>"}).join("")+"</table>"}
document.querySelectorAll(".ctabs [data-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll(".ctabs [data-tab]").forEach(x=>x.classList.toggle("on",x===b));["schedule","training","roster","stats"].forEach(t=>$("tab-"+t).hidden=t!==b.dataset.tab)});
$("nextDay").onclick=()=>advanceDay();
$("toGame").onclick=()=>{let n=0;do{advanceDay();n++}while(!S.sched.find(g=>g.date===today()&&!g.result)&&S.day<DATA.days&&n<10)};
$("week").onclick=()=>{for(let i=0;i<7&&S.day<DATA.days;i++)advanceDay()};
$("reset").onclick=()=>{if(confirm("저장된 시즌을 지우고 새로 시작할까요?")){fresh();render()}};
window.ClubUI_tab=t=>{const b=document.querySelector(".ctabs [data-tab='"+t+"']");if(b)b.click()};
load().then(ok=>{if(!ok)fresh();render();if(window.APP.onClubReady)window.APP.onClubReady()});
window.ClubUI={state:()=>S,render,advanceDay,fresh,lineupForGame:()=>{if(!S)return null;const ids=S.lineup.map(id=>{const p=S.players.find(x=>x.id===id);return p&&p.engine_id!==undefined?p.engine_id:null});const sp=S.rotation.map(id=>S.players.find(x=>x.id===id)).filter(p=>p&&p.engine_id!==undefined&&!p.injury)[S.rotIdx%Math.max(1,S.rotation.length)];return {order:ids.every(x=>x!==null)?ids:null,pitcher:sp?sp.engine_id:null}}};

})();
