/* bbsim app · game screen: two-sided innings, bench signs, scenes, bank fetched per plate appearance */
const BANK=window.APP.roster;BANK.bank={};
const _bank={};async function loadBank(half,p,b){const k=half+"_"+p+"_"+b;if(_bank[k])return _bank[k];const d=await window.APP.fetchJSON("data/bank/"+k+".json");_bank[k]=d;return d}
const $=id=>document.getElementById(id);
const KO={contact:"컨택",power:"파워",eye:"선구",speed:"주력",stuff:"구위",control:"제구",stamina:"체력"};
const CALLKO={none:"자유",bunt:"번트",take:"기다려",power:"강공",inside:"몸쪽 승부",outside:"바깥쪽 유인구",infield_in:"내야 전진",outfield_deep:"외야 후퇴"};
let pick={pitcher:null,order:[]}, G=null, call="none", dcall="none", busy=false, stopFlag=false, rng=null, scene="pitch";
function setScene(sc){scene=sc;$("scenePitch").hidden=sc!="pitch";$("scenePlay").hidden=sc!="play";$("sceneBreak").hidden=sc!="break"}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
function grades(c,keys){let h="<div class='g'>"+keys.filter(k=>c[k]).map(k=>KO[k]+" <i class='"+c[k]+"'>"+c[k]+"</i>").join("")+"</div>";
 if(BANK.admin&&c.attrs){h+="<div class='hint' style='font-size:10.5px;line-height:1.35;margin-top:4px'>"+Object.entries(c.attrs).filter(([k])=>!["name","hand"].includes(k)).map(([k,v])=>k+" "+v).join(" · ")+"</div>"}
 if(BANK.admin&&c.profile_id)h+="<div class='hint' style='font-size:10.5px'>프로필 "+c.profile_id+"</div>";return h}
function roster(){const R=BANK;const CL=window.APP.clubLineup;if(CL&&CL.order&&CL.order.length==9){pick.order=CL.order.slice();if(CL.pitcher!==null&&CL.pitcher!==undefined)pick.pitcher=CL.pitcher}
 $("pitchers").innerHTML=R.pitchers.map(p=>"<div class='pc' data-p='"+p.id+"'><b>"+p.name+" · "+p.hand+" · "+p.form+"</b>"+grades(p,["stuff","control","stamina"])+"</div>").join("");
 $("batters").innerHTML=R.batters.map(b=>"<div class='pc' data-b='"+b.id+"'><span class='ord' id='ord"+b.id+"'></span><b>"+b.name+" · "+b.hand+"</b>"+grades(b,["contact","power","eye","speed"])+"</div>").join("");
 document.querySelectorAll("[data-p]").forEach(e=>e.onclick=()=>{pick.pitcher=+e.dataset.p;document.querySelectorAll("[data-p]").forEach(x=>x.classList.toggle("sel",+x.dataset.p==pick.pitcher));check()});
 document.querySelectorAll("[data-b]").forEach(e=>e.onclick=()=>{const id=+e.dataset.b;if(pick.order.includes(id)||pick.order.length>=9)return;pick.order.push(id);e.classList.add("sel");$("ord"+id).textContent=pick.order.length;check()});
 pick.order.forEach((id,i)=>{const e=document.querySelector("[data-b='"+id+"']");if(e){e.classList.add("sel");$("ord"+id).textContent=i+1}});if(pick.pitcher!==null){const e=document.querySelector("[data-p='"+pick.pitcher+"']");if(e)e.classList.add("sel")}check()}
function check(){$("order").textContent="선택 "+pick.order.length+"/9";$("start").disabled=!(pick.pitcher!==null&&pick.order.length==9)}
$("clearOrder").onclick=()=>{pick.order=[];document.querySelectorAll("[data-b]").forEach(x=>{x.classList.remove("sel");$("ord"+x.dataset.b).textContent=""});check()};
$("autoOrder").onclick=()=>{$("clearOrder").onclick();const sc=b=>({S:5,A:4,B:3,C:2,D:1}[b.contact]+{S:5,A:4,B:3,C:2,D:1}[b.eye]+{S:5,A:4,B:3,C:2,D:1}[b.power]);[...BANK.batters].sort((a,b)=>sc(b)-sc(a)).slice(0,9).forEach(b=>{pick.order.push(b.id);document.querySelector("[data-b='"+b.id+"']").classList.add("sel");$("ord"+b.id).textContent=pick.order.length});if(pick.pitcher===null){pick.pitcher=1;document.querySelector("[data-p='1']").classList.add("sel")}check()};
$("start").onclick=()=>{const seed=+$("seed").value||1;rng=mulberry(seed);G={inning:1,half:"top",outs:0,runners:[false,false,false],total:+$("innings").value||3,over:false,score:{us:[0],them:[]},hits:{us:0,them:0},errors:{us:0,them:0},idx:{us:0,them:0},lineup:pick.order.slice(),oppLineup:BANK.opp.batters.map(b=>b.id),ourPitcher:pick.pitcher,oppPitcher:seed%5,pitcher:seed%5,pitches:{us:0,them:0},mph:{us:[0,0],them:[0,0]},box:{us:{},them:{}},pline:{us:{outs:0,H:0,R:0,K:0,BB:0},them:{outs:0,H:0,R:0,K:0,BB:0}},used:{},balls:0,strikes:0,paPitches:0};setScene("pitch");
 $("setup").hidden=true;$("game").hidden=false;$("feed").innerHTML="";if(window.APP&&window.APP.onGameStart)window.APP.onGameStart();feed("플레이 볼 · 우리 선발 "+BANK.pitchers[G.ourPitcher].name+" · 상대 선발 "+BANK.opp.pitchers[G.oppPitcher].name+" · 1번 "+BANK.batters[G.lineup[0]].name,true);render();drawAll(null,-2)};
document.querySelectorAll(".call").forEach(b=>b.onclick=()=>{call=b.dataset.call;document.querySelectorAll(".call").forEach(x=>x.classList.toggle("on",x===b));if(G&&!G.over)feed("벤치 사인: "+CALLKO[call]+" (다음 투구부터)",false)});
document.querySelectorAll(".dcall").forEach(b=>b.onclick=()=>{dcall=b.dataset.dcall;document.querySelectorAll(".dcall").forEach(x=>x.classList.toggle("on",x===b));if(G&&!G.over)feed("수비 사인: "+CALLKO[dcall]+" (다음 투구부터)",false)});
function feed(t,big,badge){const d=document.createElement("div");d.className="l"+(big?" big":"");d.innerHTML=(G?"<span class='t'>"+G.inning+"회"+(G.half=="top"?"초":"말")+"</span>":"")+t+(badge?"<span class='bs'>benchsign!</span>":"");$("feed").prepend(d)}
function lamps(id,n){[...$(id).children].forEach((s,j)=>s.classList.toggle("on",j<n))}
function batter(){return G.half=="top"?BANK.batters[G.lineup[G.idx.us%9]]:BANK.opp.batters[G.oppLineup[G.idx.them%9]]}
function offense(){return G.half=="top"?"us":"them"}
function defense(){return G.half=="top"?"them":"us"}
function sum(a){return a.reduce((x,y)=>x+y,0)}
function render(){$("sInn").textContent=Math.min(G.inning,G.total)+"회"+(G.half=="top"?"초":"말");$("sRuns").textContent=sum(G.score.us)+":"+sum(G.score.them);lamps("lOuts",G.outs);lamps("lBalls",G.balls);lamps("lStrikes",G.strikes);["b1","b2","b3"].forEach((b,j)=>$(b).classList.toggle("on",G.runners[j]));$("sBatter").textContent=G.over?"경기 종료":batter().name+" · 투수 "+G.pitches[defense()]+"구";["playPitch","playPA","playInning"].forEach(k=>$(k).disabled=G.over||busy);$("offCalls").style.display=G.half=="top"?"":"none";$("defCalls").style.display=G.half=="bottom"?"":"none";renderScore()}
function renderScore(){const n=G.total;const row=(nm,sc,h,e)=>"<tr><td>"+nm+"</td>"+Array.from({length:n},(_,i)=>"<td>"+(sc[i]===undefined?"":sc[i])+"</td>").join("")+"<td><b>"+sum(sc)+"</b></td><td>"+h+"</td><td>"+e+"</td></tr>";$("breakScore").innerHTML="<table class='box'><tr><th></th>"+Array.from({length:n},(_,i)=>"<th>"+(i+1)+"</th>").join("")+"<th>R</th><th>H</th><th>E</th></tr>"+row("우리",G.score.us,G.hits.us,G.errors.us)+row("상대",G.score.them,G.hits.them,G.errors.them)+"</table>"}
async function pickPitch(){const b=batter().id;const top=G.half=="top";const c=top?call:dcall;const pre=top?"":"D|";const bank=await loadBank(top?"top":"bot",G.pitcher,b);const key=pre+b+"|"+G.pitcher+"|"+c+"|"+G.balls+"|"+G.strikes;const list=bank[key]||bank[pre+b+"|"+G.pitcher+"|none|"+G.balls+"|"+G.strikes];if(!list||!list.length)throw new Error("은행 없음: "+key);const u=G.used[key]||0;G.used[key]=u+1;return list[(u+Math.floor(rng()*list.length))%list.length]}
function advanceAll(n){let r=0;for(let i=0;i<n;i++){if(G.runners[2])r++;G.runners=[false,G.runners[0],G.runners[1]]}return r}
function applyOutcome(o,la,dist){const R=G.runners;let runs=0,outs=0;const ev={};
 if(o=="strikeout")outs=1;
 else if(o=="walk"||o=="hbp"){if(R[0]){if(R[1]){if(R[2])runs++;R[2]=true}R[1]=true}R[0]=true}
 else if(o=="out"){outs=1;if(la!==null&&la<10&&R[0]&&G.outs+outs<3&&rng()<0.40){outs++;R[0]=false;ev.dp=true}
  else if(la!==null&&la>=25&&dist>65&&R[2]&&G.outs+outs<3){runs++;R[2]=false;ev.sf=true}
  else if(la!==null&&la<10&&G.outs+outs<3){if(R[2]){runs++;R[2]=false}if(R[1]){R[2]=true;R[1]=false}}}
 else if(o=="single"||o=="error"){if(R[2])runs++;const r2=R[1]&&rng()<0.6;let r3=R[1]&&!r2;runs+=r2?1:0;const r13=R[0]&&rng()<0.3&&!r3;r3=r3||r13;const r2n=R[0]&&!r13;G.runners=[true,r2n,r3]}
 else if(o=="double"){runs+=(R[2]?1:0)+(R[1]?1:0);const r1s=R[0]&&rng()<0.45;runs+=r1s?1:0;G.runners=[false,true,R[0]&&!r1s]}
 else if(o=="triple"){runs+=R.filter(Boolean).length;G.runners=[false,false,true]}
 else if(o=="single_out"){outs=1;if(R[2])runs++;const r2=R[1]&&rng()<0.6;let r3=R[1]&&!r2;runs+=r2?1:0;const r13=R[0]&&rng()<0.3&&!r3;r3=r3||r13;const r2n=R[0]&&!r13;G.runners=[false,r2n,r3]}
 else if(o=="double_out"){outs=1;runs+=(R[2]?1:0)+(R[1]?1:0);const r1s=R[0]&&rng()<0.45;runs+=r1s?1:0;G.runners=[false,false,R[0]&&!r1s]}
 else if(o=="HR"){runs+=R.filter(Boolean).length+1;G.runners=[false,false,false]}
 else outs=1;
 return {runs,outs,ev}}
const OUTKO={strikeout:"삼진",walk:"볼넷",hbp:"몸에 맞는 공",out:"아웃",single:"안타",double:"2루타",triple:"3루타",HR:"홈런!",error:"실책으로 출루",single_out:"안타 뒤 2루 주루사",double_out:"2루타 뒤 3루 주루사"};
const BASES_OF={single:1,error:1,double:2,triple:3,HR:4,walk:1,hbp:1,single_out:2,double_out:3};
function todayLine(nm,o){const bx=G.box[o][nm];return bx?bx.H+"/"+bx.PA:"0/0"}
function attrLine(a){return Object.entries(a).filter(([k])=>!["name","hand","height"].includes(k)).slice(0,8).map(([k,v])=>k+" "+(typeof v=="number"?v.toFixed(2):v)).join(" ")}
function paCard(){const b=batter();const top=G.half=="top";const d=defense();const n=G.pitches[d];const m=G.mph[d];const avg=m[1]?(m[0]/m[1]).toFixed(0)+" mph":"-";
 if(top){const P=BANK.opp.pitchers[G.oppPitcher];return "<b>타석 시작</b> · "+b.name+" ("+b.hand+") · 컨택 "+b.contact+" 파워 "+b.power+" 선구 "+b.eye+" 주력 "+b.speed+" · 오늘 "+todayLine(b.name,"us")+(BANK.admin&&b.attrs?" · "+attrLine(b.attrs):"")+"<br>상대 투수 "+P.name+" ("+P.hand+") · 투구 "+n+"구 · 평균 "+avg+(BANK.admin&&P.profile_id?" · 프로필 "+P.profile_id:"")}
 const P=BANK.pitchers[G.ourPitcher];const st={S:4,A:3,B:2,C:1,D:0}[P.stamina]||1;const pct=Math.max(0,Math.round(100-n*(0.9-0.15*st)));
 return "<b>타석 시작</b> · 상대 타자 "+b.name+" ("+b.hand+") · 오늘 "+todayLine(b.name,"them")+(BANK.admin&&b.attrs?" · "+attrLine(b.attrs):"")+"<br>우리 투수 "+P.name+" ("+P.hand+") · 구위 "+P.stuff+" 제구 "+P.control+" 체력 "+P.stamina+" · 투구 "+n+"구 · 평균 "+avg+" · 체력 잔량 "+pct+"%(추정)"}
function addRuns(r){if(!r)return;const o=offense();G.score[o][G.score[o].length-1]+=r}
function endHalf(){const o=offense();feed(G.inning+"회"+(G.half=="top"?"초":"말")+" 종료 · "+G.score[o][G.score[o].length-1]+"점",true);G.outs=0;G.runners=[false,false,false];G.balls=0;G.strikes=0;G.paPitches=0;
 if(G.half=="top"){G.half="bottom";G.pitcher=G.ourPitcher;while(G.score.them.length<G.inning)G.score.them.push(0)}
 else{if(G.inning>=G.total){G.over=true;render();setScene("break");renderBreak(true);feed("경기 종료 · 우리 "+sum(G.score.us)+" : 상대 "+sum(G.score.them),true);return "inning"}G.inning++;G.half="top";G.pitcher=G.oppPitcher;while(G.score.us.length<G.inning)G.score.us.push(0)}
 dcall="none";call="none";document.querySelectorAll(".call,.dcall").forEach(x=>x.classList.toggle("on",x.dataset.call=="none"||x.dataset.dcall=="none"));render();setScene("break");renderBreak(false);return "inning"}
function ip(o){return Math.floor(o/3)+"."+(o%3)}
function renderBreak(over){$("breakTitle").textContent=over?"경기 종료 · 우리 "+sum(G.score.us)+" : 상대 "+sum(G.score.them):(Math.min(G.inning,G.total)+"회"+(G.half=="top"?"초":"말")+" 시작 전 · 점수와 기록");renderScore();
 const tbl=bx=>"<table class='box'><tr><th>타자</th><th>타석</th><th>안타</th><th>볼넷</th><th>삼진</th></tr>"+(Object.entries(bx).map(([n,v])=>"<tr><td>"+n+"</td><td>"+v.PA+"</td><td>"+v.H+"</td><td>"+v.BB+"</td><td>"+v.K+"</td></tr>").join("")||"<tr><td colspan=5>기록 없음</td></tr>")+"</table>";
 $("breakUs").innerHTML=tbl(G.box.us);$("breakThem").innerHTML=tbl(G.box.them);
 const pl=(nm,d)=>{const L=G.pline[d],m=G.mph[d];return "<tr><td>"+nm+"</td><td>"+ip(L.outs)+"</td><td>"+G.pitches[d]+"</td><td>"+L.H+"</td><td>"+L.R+"</td><td>"+L.K+"</td><td>"+L.BB+"</td><td>"+(m[1]?(m[0]/m[1]).toFixed(0):"-")+"</td></tr>"};
 $("breakPitchers").innerHTML="<table class='box'><tr><th>투수</th><th>이닝</th><th>투구</th><th>피안타</th><th>실점</th><th>삼진</th><th>볼넷</th><th>평균 mph</th></tr>"+pl("우리 · "+BANK.pitchers[G.ourPitcher].name,"us")+pl("상대 · "+BANK.opp.pitchers[G.oppPitcher].name,"them")+"</table>";
 $("resume").textContent=over?"정비로 돌아가기":"다음 이닝 진행";$("resume").onclick=()=>{if(over){const res={us:sum(G.score.us),them:sum(G.score.them),sp:BANK.pitchers[G.ourPitcher].name,ip:Math.round(G.pline.us.outs/3*10)/10,er:G.pline.us.R,box:Object.entries(G.box.us).map(([n,v])=>({name:n,PA:v.PA,H:v.H,BB:v.BB,K:v.K}))};G=null;$("game").hidden=true;$("setup").hidden=false;setScene("pitch");if(window.APP&&window.APP.onGameOver)window.APP.onGameOver(res)}else{setScene("pitch");render();drawAll(null,-2)}}}
async function onePitch(){let p;try{p=await pickPitch()}catch(e){feed("이 조합의 투구 데이터가 없습니다 ("+e.message+")",true);stopFlag=true;return "pitch"}const top=G.half=="top";const used=top?call!="none":dcall!="none";$("signBadge").classList.toggle("on",used);
 if(G.paPitches==0)feed(paCard(),false);
 let paOver=null;
 if(p.wild_pitch){const r=advanceAll(1);addRuns(r)}
 const before=G.runners.slice();
 if(p.result=="ball"){G.balls++;if(G.balls>=4)paOver="walk"}
 else if(p.result=="called_strike"||p.result=="swinging_strike"){G.strikes++;if(G.strikes>=3)paOver="strikeout"}
 else if(p.result=="foul"){G.strikes=Math.min(2,G.strikes+1)}
 else if(p.result=="hbp")paOver="hbp";
 else if(p.result=="in_play"){paOver=p.kind||"out"}
 const res=paOver?applyOutcome(paOver,p.la===undefined?null:p.la,p.dist||0):null;
 p.runnersAnim={before,after:G.runners.slice(),runs:res?res.runs:0,batterBases:BASES_OF[paOver]||0,dp:!!(res&&res.ev.dp)};
 await animate(p);const d=defense();G.pitches[d]++;G.paPitches++;G.mph[d][0]+=p.mph;G.mph[d][1]++;$("speed").textContent=p.mph.toFixed(0);feed(p.text+(BANK.admin?" ["+p.code+"]":""),false,used);if(BANK.admin)adminInfo(p);
 render();
 if(paOver){const {runs,outs,ev}=res;addRuns(runs);G.outs+=outs;
  const o=offense();const nm=batter().name;const bx=G.box[o][nm]||(G.box[o][nm]={PA:0,H:0,BB:0,K:0});bx.PA++;const hit=["single","double","triple","HR","single_out","double_out"].includes(paOver);bx.H+=hit?1:0;if(hit)G.hits[o]++;if(paOver=="error")G.errors[d]++;bx.BB+=(paOver=="walk"||paOver=="hbp")?1:0;bx.K+=paOver=="strikeout"?1:0;const L=G.pline[d];L.outs+=outs;L.R+=runs;if(hit)L.H++;if(paOver=="strikeout")L.K++;if(paOver=="walk"||paOver=="hbp")L.BB++;
  feed(OUTKO[paOver]+(ev.dp?" (병살)":"")+(ev.sf?" (희생플라이)":"")+" · 아웃 "+G.outs+" · 우리 "+sum(G.score.us)+" : 상대 "+sum(G.score.them),true);
  G.idx[o]++;G.balls=0;G.strikes=0;G.paPitches=0;
  if(G.outs>=3)return endHalf();
  render();return "pa"}
 return "pitch"}
async function run(mode){if(busy||!G||G.over)return;busy=true;stopFlag=false;render();
 try{while(true){const r=await onePitch();if(G.over||stopFlag)break;if(mode=="pitch")break;if(mode=="pa"&&r!="pitch")break;if(mode=="inning"&&r=="inning")break;await new Promise(res=>setTimeout(res,350))}}
 finally{busy=false;render()}}
$("playPitch").onclick=()=>run("pitch");$("playPA").onclick=()=>run("pa");$("playInning").onclick=()=>run("inning");$("stop").onclick=()=>{stopFlag=true};$("stop2").onclick=()=>{stopFlag=true};
function adminInfo(p){$("adminPanel").hidden=false;const f=p.fielding;const c=p.contact;
 const rows=[["구종·목표",p.code+" @ "+p.zone+" ("+(100*p.target_xz[0]).toFixed(0)+", "+(100*p.target_xz[1]).toFixed(0)+" cm), 제구 σ "+(100*p.sigma).toFixed(0)+" cm, "+p.rpm+" rpm"],
  ["투수 의도",p.intent.join("@")+(p.intent_reasons.length?" · "+p.intent_reasons.join(", "):"")],
  ["포수 사인",p.sign.join("@")+(p.sign_reasons.length?" · "+p.sign_reasons.join(", "):"")+(p.shake_offs?" · 흔들기 "+p.shake_offs:"")],
  ["실제 도달",p.plate_xz?"("+(100*p.plate_xz[0]).toFixed(0)+", "+(100*p.plate_xz[1]).toFixed(0)+") cm":"원바운드"],
  ["타자 판단",(p.swing?"스윙":"노스윙")+" · "+p.decision_note+(p.predicted_xz?" · 예측 ("+(100*p.predicted_xz[0]).toFixed(0)+", "+(100*p.predicted_xz[1]).toFixed(0)+") cm":"")+(p.plate_xz&&p.predicted_xz?" · 오차 "+(100*(p.plate_xz[1]-p.predicted_xz[1])).toFixed(1)+" cm":"")+(p.tipped?" · 릴리스 팁":"")+(p.adjusted?" · 늦은 보정 ("+(100*p.late_shift[0]).toFixed(1)+", "+(100*p.late_shift[1]).toFixed(1)+")":"")+(p.checked?" · 체크 스윙":"")+" · 결정 잠김 "+(1000*p.t_deadline).toFixed(0)+" ms"],
  ["판정",p.result+(p.umpire?" ("+p.umpire+")":"")+(p.in_dirt?" · 원바운드":"")+(p.wild_pitch?" · 폭투":"")]];
 if(c)rows.push(["타구",c.ev_mph+" mph · "+c.la+"° · 방향 "+c.spray+"° · "+c.spin_rpm+" rpm · 배트 "+c.bat_speed+" mph · 오프셋 수직 "+c.offset_v_cm+" cm / 축 "+c.offset_a_cm+" cm · 타이밍 "+c.timing_ms+" ms"+(p.batted?" · 비거리 "+p.batted.distance+" m 체공 "+p.batted.hang+" s":"")]);
 if(p.play)rows.push(["결과",p.play.kind+" · "+p.play.note]);
 if(f)rows.push(["수비",f.kind+" · 낙구 ("+f.landing[0]+", "+f.landing[1]+") m · "+f.attempts.map(a=>a.position+" p="+a.p+(a.success?" 성공":" 실패")+" 도달 "+a.t_fielder+"s/공 "+a.t_ball+"s"+(a.difficulty?" ["+a.difficulty+"]":"")+(a.read_error_m?" 읽기오차 "+a.read_error_m+" m":"")).join(" ; ")+(f.retriever?" · 회수 "+f.retriever+" "+f.t_retrieve+"s":"")+(f.note?" · "+f.note:"")]);
 $("admin").innerHTML=rows.map(([k,v])=>"<div><b style='color:var(--bulb)'>"+k+"</b> "+v+"</div>").join("")}
function showBox(){renderBreak(true);setScene("break")}
/* ---------- 3D helpers ---------- */


function drawKz(p,done){const c=$("kz"),g=c.getContext("2d");g.fillStyle="#0a1510";g.fillRect(0,0,c.width,c.height);const S=150,X=x=>c.width/2+x*S,Y=z=>c.height-16-z*S;const top=p?p.zone_top:1.05,bot=p?p.zone_bottom:0.5;
 g.strokeStyle="#ece7d8";g.lineWidth=1.5;g.strokeRect(X(-0.216),Y(top),0.432*S,(top-bot)*S);g.strokeStyle="#24382c";g.lineWidth=1;for(let i=1;i<3;i++){g.beginPath();g.moveTo(X(-0.216+i*0.144),Y(top));g.lineTo(X(-0.216+i*0.144),Y(bot));g.stroke();g.beginPath();g.moveTo(X(-0.216),Y(bot+i*(top-bot)/3));g.lineTo(X(0.216),Y(bot+i*(top-bot)/3));g.stroke()}
 if(p&&BANK.admin&&p.target_xz){g.strokeStyle="#4fa3e0";g.lineWidth=1.5;const tx=X(p.target_xz[0]),ty=Y(p.target_xz[1]);g.beginPath();g.moveTo(tx-7,ty);g.lineTo(tx+7,ty);g.moveTo(tx,ty-7);g.lineTo(tx,ty+7);g.stroke();g.fillStyle="#4fa3e0";g.font="10px IBM Plex Mono";g.fillText("목표",tx+8,ty-4)}
 if(p&&BANK.admin&&p.predicted_xz){g.strokeStyle="#f2b441";g.lineWidth=2;g.beginPath();g.arc(X(p.predicted_xz[0]),Y(p.predicted_xz[1]),8,0,7);g.stroke();g.fillStyle="#f2b441";g.font="10px IBM Plex Mono";g.fillText("타자 예측",X(p.predicted_xz[0])+10,Y(p.predicted_xz[1])+4)}
 if(p&&done&&p.plate_xz){g.fillStyle=p.result=="ball"?"#4fa3e0":(p.swing?"#e0524b":"#f2b441");g.beginPath();g.arc(X(p.plate_xz[0]),Y(p.plate_xz[1]),7,0,7);g.fill()}}
function drawField(p,tb,id){const c=$(id||"field"),g=c.getContext("2d");g.fillStyle="#0a1510";g.fillRect(0,0,c.width,c.height);const hx=c.width/2,hy=c.height-14,S=(c.height-36)/130;g.fillStyle="#1c4a2e";g.beginPath();g.moveTo(hx,hy);g.arc(hx,hy,125*S,-Math.PI*0.75,-Math.PI*0.25);g.closePath();g.fill();
 const Pt=q=>[hx+q[0]*S,hy-q[1]*S];g.fillStyle="rgba(0,0,0,0.28)";g.beginPath();g.moveTo(hx,hy);g.lineTo(hx-135*S,hy);g.lineTo(hx-135*S,hy-135*S);g.closePath();g.fill();g.beginPath();g.moveTo(hx,hy);g.lineTo(hx+135*S,hy);g.lineTo(hx+135*S,hy-135*S);g.closePath();g.fill();
 g.strokeStyle="#f4f1e8";g.lineWidth=1.5;g.beginPath();g.moveTo(hx,hy);g.lineTo(hx-72*S,hy-72*S);g.moveTo(hx,hy);g.lineTo(hx+72*S,hy-72*S);g.stroke();
 g.strokeStyle="#6b4f2e";g.lineWidth=2;g.beginPath();[[0,0],[19.4,19.4],[0,38.8],[-19.4,19.4]].forEach((q,i)=>{const [x,y]=Pt(q);i?g.lineTo(x,y):g.moveTo(x,y)});g.closePath();g.stroke();
 g.strokeStyle="#3a5242";g.lineWidth=1;g.beginPath();for(let a=-45;a<=45;a+=3){const f=Math.pow(Math.cos(a*Math.PI/180),2),R=(100+22*f)*S,x=hx+R*Math.sin(a*Math.PI/180),y=hy-R*Math.cos(a*Math.PI/180);a==-45?g.moveTo(x,y):g.lineTo(x,y)}g.stroke();
 const evs=playEvents(p),homes=fieldPositions(p),live=!!(p&&p.fielding);
 BANK.fielders.forEach(f=>{let xy=homes[f.pos]||f.xy,active=false;if(live){const st=fielderState(f.pos,evs,xy,tb);xy=st.xy;active=st.mode!="ready"||st.hasBall}const [x,y]=Pt(xy);g.fillStyle=active?"#e0524b":"#8ad1a8";g.beginPath();g.arc(x,y,4.5,0,7);g.fill();g.fillStyle="#c9c2ae";g.font="10px IBM Plex Mono";g.fillText(f.pos,x+6,y+3)});
 if(p&&p.runnersAnim){const bb=BASES_OF[p.kind]||0;runnerDests(p.runnersAnim,bb).forEach(rd=>{const st=baseRunnerState(rd,live?tb:-1);const [x,y]=Pt(st.xy);g.fillStyle=st.out?"#7a4a4a":"#f2b441";g.beginPath();g.arc(x,y,4.5,0,7);g.fill()})}
 if(live){const runEv=evs.find(e=>e.kind=="run"&&e.who=="BR");if(runEv&&tb>0.3){const rs=runnerState(runEv,tb);const [x,y]=Pt(rs.xy);g.fillStyle=rs.out?"#7a4a4a":"#f2b441";g.beginPath();g.arc(x,y,5,0,7);g.fill();g.strokeStyle="#fff";g.lineWidth=1;g.stroke()}}
 if(!p||!p.batted)return;const flt=p.batted.flight;g.strokeStyle="#4fa3e0";g.beginPath();flt.xyz.forEach((q,i)=>{const [x,y]=Pt(q);i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke();
 const gr=p.fielding&&p.fielding.ground;if(gr&&gr.t&&gr.t.length){g.strokeStyle="rgba(244,241,232,0.45)";g.setLineDash([3,3]);g.beginPath();gr.xyz.forEach((q,i)=>{const [x,y]=Pt(q);i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke();g.setLineDash([])}
 const bb=battedBall(p,tb+flt.t[0],tb,evs);let q=bb?bb.xyz:interp(flt,Math.min(tb+flt.t[0],flt.t[flt.t.length-1]));
 const [x,y]=Pt(q);g.fillStyle="#fff";g.beginPath();g.arc(x,y-q[2]*S*0.5,4+q[2]*0.15,0,7);g.fill();
 const fp=p.fielding&&p.fielding.foul_point;if(fp&&tb>(p.fielding.hang||0)){const [fx,fy]=Pt(fp);g.strokeStyle="#e0524b";g.lineWidth=2;g.beginPath();g.moveTo(fx-5,fy-5);g.lineTo(fx+5,fy+5);g.moveTo(fx+5,fy-5);g.lineTo(fx-5,fy+5);g.stroke();g.fillStyle="#e0524b";g.font="bold 11px IBM Plex Mono";g.fillText("파울",fx+7,fy+4)}
 else if(p.result=="in_play"&&p.fielding&&tb>(p.fielding.hang||0)+0.2){const [fx,fy]=Pt(p.fielding.landing||[0,0]);g.fillStyle="#8ad1a8";g.font="bold 11px IBM Plex Mono";g.fillText("페어",fx+7,fy+4)}}
function drawAll(p,t){const T=p?p.flight.t[p.flight.t.length-1]:0.42;const tb=Math.max(0,t-(p&&p.batted?p.batted.flight.t[0]:T));
 if(scene=="play"){drawCam(p,t,"play");drawField(p,tb,"field2");return}
 if(scene!="pitch")return;const H=window.VIEW_HIDE||{};if(!H.cam)drawCam(p,t);if(!H.body)drawBody(p,t);drawField(p,tb);drawKz(p,t>=T);if(!H.seam)drawSeam(p,t)}
function animate(p){return new Promise(res=>{const t0=performance.now();const spd=parseFloat($("spd").value)||1;const T=p.flight.t[p.flight.t.length-1];const PRE=1.9;const evs=playEvents(p);const tEnd=evs.reduce((m,e)=>Math.max(m,e.t1||0,e.t||0,(e.arrive&&e.arrive.length)?e.arrive[e.arrive.length-1]:0,e.out_t||0),0);const TB=Math.max(p.batted?p.batted.flight.t[p.batted.flight.t.length-1]-T:0,tEnd>0?contactTime(p)+tEnd-T:0)+0.9;$("speed").textContent="—";drawKz(p,false);
  const tC=contactTime(p);const hasPlay=!!(p.fielding&&evs.length);
  function fr(now){const t=(now-t0)/1000*spd-PRE;if(hasPlay&&scene=="pitch"&&t>=tC+0.35){setScene("play");$("playText").textContent=p.text}drawAll(p,t);if(t<T+TB&&!stopFlag)requestAnimationFrame(fr);else{if(scene=="play")setScene("pitch");drawKz(p,true);res()}}requestAnimationFrame(fr)})}
window.GameUI={roster,drawIdle:()=>drawAll(null,-2),setScene,state:()=>G,pick,pickPitch,drawAll};
