/* bbsim app · budget, transfer market and negotiations (rules and sources: docs/TRANSFER_MARKET.md)
   - money in 억원. S.budget is the cash the owner lets the manager spend; S.fin keeps the season ledger.
   - KBO frame: salary cap 137.4억 on the top-40 payroll (30 % of the excess, 50 % when repeated), floor 60.65억,
     trade deadline (game 20 of 30 ≈ KBO's 31 July), FA signings are trade-locked for a year, FA deals carry a signing bonus.
   - trade AI: value-based (ovr, age/potential, contract vs fair salary, positional need), counter-offers with cash or a player.
   - signing: agent ask, offer/counter rounds with limited patience (OOTP style), team success and playing time shift the ask. */
(function(){
const $=id=>document.getElementById(id);
const I=()=>window.ClubInt;
const CAP=137.4,FLOOR=60.65,TICKET=14632,PARENT_WEEK=2.0,OPS_WEEK=1.0,SEASON_DAYS=180,DEADLINE_GAME=20,CASH_UNIT=0.7;
const MK={sel:{theirs:[],ours:[]},club:null};
function S(){return I().S()}
function fin(){const s=S();if(!s.fin)s.fin={inc:{gate:0,ads:0,parent:0},exp:{salary:0,ops:0,tax:0,fees:0,buyout:0},ledger:[],taxYears:0,offers:[],nego:null,oppMods:{},weekGate:0,att:0};return s.fin}
function led(kind,amt,text){const f=fin();f.ledger.unshift({d:I().fmt(I().dateOf(S().day)),kind,amt:Math.round(amt*10)/10,text:text||""});if(f.ledger.length>80)f.ledger.length=80}
function cash(d){S().budget=Math.round((S().budget+d)*10)/10}
function gamesPlayed(){return S().sched.filter(g=>g.result).length}
function r1(v){return Math.round(v*10)/10}
function hash01(str){return (I().hash32(str)%10000)/10000}
/* ---------------- finance ---------------- */
function gate(g){const s=S(),f=fin();const wp=s.W/Math.max(1,s.W+s.L);const d=I().dateOf(s.day);const wk=(d.getDay()===0||d.getDay()===6)?3000:0;
 const base=s.kbo&&s.club&&s.club.code?11000+7000*hash01("pop|"+s.club.code):12000;
 const att=Math.round(Math.max(8000,Math.min(24000,base+8000*(wp-0.5)+wk+1500*Math.min(3,s.streak||0)+2500*(I().rng()-0.5))));
 const money=r1(att*TICKET/1e8);cash(money);f.inc.gate+=money;f.weekGate+=money;f.att+=att;led("입장 수입",money,"관중 "+att.toLocaleString()+"명");}
function weekly(){const s=S(),f=fin();const pay=r1(s.players.reduce((a,p)=>a+p.contract.salary,0)*7/SEASON_DAYS);const ads=r1(f.weekGate*0.6);
 cash(PARENT_WEEK+ads-pay-OPS_WEEK);f.inc.parent+=PARENT_WEEK;f.inc.ads+=ads;f.exp.salary+=pay;f.exp.ops+=OPS_WEEK;
 led("주간 결산",PARENT_WEEK+ads-pay-OPS_WEEK,"모기업 "+PARENT_WEEK+" + 광고·상품 "+ads+" − 연봉 "+pay+" − 운영 "+OPS_WEEK);f.weekGate=0;
 expireOffers();aiOffer();}
function seasonEnd(){const s=S(),f=fin();const t40=I().top40();
 if(t40>CAP){const tax=r1((t40-CAP)*(f.taxYears>0?0.5:0.3));cash(-tax);f.exp.tax+=tax;f.taxYears++;led("샐러리캡 제재금",-tax,"상위 40인 "+t40.toFixed(1)+"억, 초과분의 "+(f.taxYears>1?50:30)+"%");I().addLog("샐러리캡 초과 제재금 "+tax+"억 (야구발전기금)")}
 else{f.taxYears=0;if(t40<FLOOR){const fine=r1((FLOOR-t40)*0.3);cash(-fine);f.exp.tax+=fine;led("하한 미달 기금",-fine,"상위 40인 "+t40.toFixed(1)+"억");I().addLog("보수 총액 하한 미달 · 유소년 기금 "+fine+"억")}}
 I().addLog("시즌 재정 결산 · 잔액 "+s.budget+"억 · 수입 "+r1(f.inc.gate+f.inc.ads+f.inc.parent)+"억 · 지출 "+r1(f.exp.salary+f.exp.ops+f.exp.tax+f.exp.fees+f.exp.buyout)+"억")}
/* ---------------- valuation ---------------- */
function tradeValue(p){const o=I().ovr(p);let v=100*Math.pow(Math.max(0,o-0.35),2.2);
 const pot=p.pot?Object.values(p.pot).reduce((a,b)=>a+b,0)/Object.keys(p.pot).length:o;const up=Math.max(0,pot-o);
 const ageF=p.age<=24?1.1+1.5*up:p.age<=28?1.0+0.8*up:p.age<=31?0.9:p.age<=33?0.72:0.55;
 const fair=I().salaryModel(o,p.age,true);const cF=Math.max(0.5,Math.min(p.active?1.2:1.0,1-0.5*(p.contract.salary-fair)/Math.max(1,fair)));
 if(p.injury)v*=0.7;if(!p.active)v*=0.75;return r1(v*ageF*cF)}
function depth(list,p){return list.filter(x=>x.id!==p.id&&x.type===p.type&&(p.type=="B"?x.pos===p.pos:x.role===p.role)).length}
function oppRoster(code){const K=window.APP.kbo;const club=K&&K.clubs.find(c=>c.code===code);if(!club)return [];const f=fin();const mods=(f.oppMods[code]=f.oppMods[code]||{removed:[],added:[]});const ci=K.clubs.indexOf(club);
 return club.players.filter(kp=>kp.active).map((kp,i)=>I().kboPlayer(kp,club,10000+ci*200+i)).filter(p=>!mods.removed.includes(p.id)).concat(mods.added)}
function canTrade(){return gamesPlayed()<DEADLINE_GAME}
const CASH_MAX=15;
function oppCash(code){const f=fin();f.oppCash=f.oppCash||{};if(f.oppCash[code]===undefined)f.oppCash[code]=r1(20+40*hash01("cash|"+code));return f.oppCash[code]}
function evalTrade(code,theirs,ours,cashAmt){const roster=oppRoster(code);const top3=roster.slice().sort((a,b)=>tradeValue(b)-tradeValue(a)).slice(0,3).map(p=>p.id);
 const vIn=ours.reduce((s,p)=>s+tradeValue(p)*(depth(roster,p)<=1?1.15:1),0)+Math.max(0,cashAmt)*CASH_UNIT;
 const vOut=theirs.reduce((s,p)=>s+tradeValue(p)*(top3.includes(p.id)?1.3:1),0)+Math.max(0,-cashAmt)*CASH_UNIT;
 return {vIn:r1(vIn),vOut:r1(vOut),need:r1(vOut*1.08)}}
function proposeTrade(code,theirIds,ourIds,cashAmt){const s=S();const opp=s.opps.find(o=>o.code===code);if(!opp)return {ok:false,msg:"KBO 구단에서만 트레이드할 수 있습니다."};
 if(!canTrade())return {ok:false,msg:"트레이드 마감입니다 ("+DEADLINE_GAME+"경기 이후 · 실제 KBO는 7월 31일)."};
 cashAmt=+cashAmt||0;theirIds=[...new Set(theirIds||[])];ourIds=[...new Set(ourIds||[])];const roster=oppRoster(code);const theirs=theirIds.map(id=>roster.find(p=>p.id===id)).filter(Boolean),ours=ourIds.map(id=>I().P(id)).filter(Boolean);
 if(!theirs.length&&!ours.length)return {ok:false,msg:"선수를 고르세요."};
 if(!theirs.length&&!(cashAmt<0))return {ok:false,msg:"받을 선수나 받을 현금(음수) 없이 선수를 내줄 수는 없습니다."};
 if(theirs.length>2||ours.length>2)return {ok:false,msg:"한쪽 최대 2명입니다."};
 if(ours.some(p=>p.noTrade))return {ok:false,msg:"FA로 영입한 선수는 1년간 트레이드할 수 없습니다."};
 if(cashAmt>s.budget)return {ok:false,msg:"현금이 잔액("+s.budget+"억)을 넘습니다."};
 if(Math.abs(cashAmt)>CASH_MAX)return {ok:false,msg:"현금은 한 거래에 "+CASH_MAX+"억까지입니다."};
 if(cashAmt<0&&-cashAmt>oppCash(code))return {ok:false,msg:opp.short+" 현금 여력은 "+oppCash(code)+"억뿐입니다."};
 if(!ours.length){const top3=oppRoster(code).slice().sort((a,b)=>tradeValue(b)-tradeValue(a)).slice(0,3).map(p=>p.id);if(theirs.some(p=>top3.includes(p.id)||tradeValue(p)>8))return {ok:false,msg:opp.short+" 거절 · 주전급 선수는 현금만으로 팔지 않습니다. 선수를 넣으세요."}}
 const e=evalTrade(code,theirs,ours,cashAmt);
 if(e.vIn>=e.need){execTrade(opp,theirs,ours,cashAmt);return {ok:true,msg:opp.short+" 수락 · "+theirs.map(p=>p.name).join(", ")+" ⇄ "+ours.map(p=>p.name).join(", ")+(cashAmt?" + 현금 "+cashAmt+"억":""),e}}
 const gap=e.need-e.vIn;if(e.vIn<e.need*0.55)return {ok:false,msg:opp.short+" 거절 · 가치 차이가 큽니다 (우리 "+e.vIn+" vs 요구 "+e.need+").",e};
 const askCash=Math.ceil(gap/CASH_UNIT*2)/2;if(cashAmt+askCash<=Math.min(CASH_MAX,s.budget))return {ok:false,counter:{cash:cashAmt+askCash},msg:opp.short+" 역제안 · 현금 "+askCash+"억을 더하면 받겠습니다.",e};
 const cand=s.players.filter(p=>p.active&&!ourIds.includes(p.id)&&!p.noTrade).map(p=>({p,v:tradeValue(p)})).filter(x=>x.v>=gap*0.9&&x.v<=gap*1.8).sort((a,b)=>a.v-b.v)[0];
 if(cand)return {ok:false,counter:{add:cand.p.id},msg:opp.short+" 역제안 · "+cand.p.name+" 선수를 더하면 받겠습니다.",e};
 return {ok:false,msg:opp.short+" 거절 · 맞출 카드가 없습니다 (부족 "+r1(gap)+").",e}}
function dropFromClub(p){const s=S();s.players=s.players.filter(x=>x.id!==p.id);s.lineup=s.lineup.map(id=>id===p.id?(s.players.find(x=>x.type=="B"&&x.active&&!s.lineup.includes(x.id))||{id:null}).id:id);
 s.rotation=s.rotation.filter(id=>id!==p.id);if(s.rotation.length<5){const c=s.players.find(x=>x.type=="P"&&x.active&&!s.rotation.includes(x.id));if(c)s.rotation.push(c.id)}}
function addToClub(p){const s=S();const act=s.players.filter(x=>x.active).length;p.active=act<26;p.morale={playing_time:0.6,team_success:0.6,salary_fairness:0.65,relationships:0.5,role_fit:0.6};s.program[p.id]=p.type=="B"?"bat":"control";s.weekGames[p.id]=0;s.players.push(p)}
function execTrade(opp,theirs,ours,cashAmt){const s=S(),f=fin();const mods=(f.oppMods[opp.code]=f.oppMods[opp.code]||{removed:[],added:[]});
 ours.forEach(p=>{dropFromClub(p);const q=JSON.parse(JSON.stringify(p));q.active=true;mods.added.push(q)});theirs.forEach(p=>{mods.removed.push(p.id);mods.added=mods.added.filter(x=>x.id!==p.id);addToClub(JSON.parse(JSON.stringify(p)))});
 if(cashAmt){cash(-cashAmt);if(cashAmt>0)f.exp.fees+=cashAmt;else f.inc.parent+=-cashAmt;led("트레이드 현금",-cashAmt,opp.short);f.oppCash=f.oppCash||{};f.oppCash[opp.code]=r1(oppCash(opp.code)+cashAmt)}
 const dO=ours.reduce((a,p)=>a+I().ovr(p),0)-theirs.reduce((a,p)=>a+I().ovr(p),0);const nb=ours.filter(p=>p.type=="B").length+theirs.filter(p=>p.type=="B").length;
 if(nb)opp.bat=r1(Math.max(0.35,Math.min(0.8,opp.bat+0.04*dO/nb)));else opp.pitch=r1(Math.max(0.35,Math.min(0.8,opp.pitch+0.04*dO/Math.max(1,ours.length+theirs.length))));
 s.players.forEach(x=>x.morale.relationships=Math.max(0,x.morale.relationships-0.02));
 I().addLog("트레이드 · "+opp.short+"에 "+ours.map(p=>p.name).join(", ")+" ⇄ "+theirs.map(p=>p.name).join(", ")+(cashAmt?" + 현금 "+cashAmt+"억":""));MK.sel={theirs:[],ours:[]}}
/* AI-initiated offers: once a week with probability .35 an opponent asks for one of our better players and offers 1-2 of theirs */
function aiOffer(){const s=S(),f=fin();if(!s.kbo||!canTrade()||f.offers.length>=2||I().rng()>0.35)return;const opp=s.opps[Math.floor(I().rng()*s.opps.length)];if(!opp.code)return;
 const mine=s.players.filter(p=>p.active&&!p.noTrade).map(p=>({p,v:tradeValue(p)})).sort((a,b)=>b.v-a.v).slice(0,8);const want=mine[Math.floor(I().rng()*mine.length)];if(!want)return;
 const roster=oppRoster(opp.code).map(p=>({p,v:tradeValue(p)})).sort((a,b)=>b.v-a.v);let give=[],sum=0;
 for(const x of roster){if(give.length>=2)break;if(x.v<=want.v*1.15-sum&&x.v>=want.v*0.25){give.push(x.p);sum+=x.v;if(sum>=want.v*0.9)break}}
 if(!give.length||sum<want.v*0.85)return;f.offers.push({id:Date.now()%1e9,code:opp.code,short:opp.short,want:want.p.id,give:give.map(p=>p.id),day:s.day});
 I().addLog(opp.short+" 트레이드 제안: "+want.p.name+" ⇄ "+give.map(p=>p.name).join(", ")+" (예산·이적 화면에서 응답)")}
function expireOffers(){const f=fin(),s=S();f.offers=f.offers.filter(o=>s.day-o.day<=7)}
function answerOffer(id,accept){const f=fin(),s=S();const o=f.offers.find(x=>x.id===id);if(!o)return;f.offers=f.offers.filter(x=>x!==o);
 if(accept&&!canTrade()){I().addLog("트레이드 마감 · 받은 제안을 실행할 수 없습니다");I().save();I().render();return}
 if(accept){const opp=s.opps.find(x=>x.code===o.code);const roster=oppRoster(o.code);const theirs=o.give.map(i=>roster.find(p=>p.id===i)).filter(Boolean),ours=[I().P(o.want)].filter(Boolean);if(opp&&theirs.length&&ours.length)execTrade(opp,theirs,ours,0)}
 else I().addLog(o.short+" 제안 거절");I().save();I().render()}
/* ---------------- signing negotiation (FA / released players) ---------------- */
function yearsPref(p){return p.age<=29?3:(p.age<=33?2:1)}
function startNego(id){const s=S(),f=fin();const p=s.fa.find(x=>x.id===id);if(!p)return;f.negoHist=f.negoHist||{};const h=f.negoHist[id];
 if(h&&h.done){I().addLog(p.name+" 측은 이번 시즌 더 협상하지 않습니다");return}
 f.nego=h?Object.assign({},h,{msg:"에이전트: 지난번 조건 그대로입니다. "+h.ask+"억, "+h.years+"년."}):{id,ask:p.asking,years:yearsPref(p),patience:3,round:0,msg:"에이전트: "+p.name+" 선수는 연봉 "+p.asking+"억, "+yearsPref(p)+"년을 원합니다. 조건을 제시해 주세요.",done:false};
 $("negoModal").hidden=false;$("negoSalary").value=p.asking;$("negoYears").value=yearsPref(p);renderNego();I().save()}
function utility(p,salary,years){const s=S(),f=fin();const n=f.nego;let U=salary/n.ask;const yp=yearsPref(p);U*=years>=yp?1+0.03*(years-yp):1-0.06*(yp-years);
 const rank=I().rankNow().findIndex(r=>r.me)+1;const succ=rank<=2?1.06:rank>=5?0.94:1;U*=1+(succ-1)*(0.5+p.personality.ambition);
 const d=depth(s.players.filter(x=>x.active),p);U*=d<=1?1.08:d>=3?0.93:1;return U}
function offer(salary,years){const s=S(),f=fin();const n=f.nego;if(!n||n.done)return;const p=s.fa.find(x=>x.id===n.id);if(!p)return;
 const s0=+salary||0,y0=+years||1;salary=Math.round(10*Math.max(0.3,Math.min(30,s0)))/10;years=Math.max(1,Math.min(4,Math.floor(y0)||1));const bonus=r1(salary*years*0.3);
 if(salary!==s0||years!==y0){$("negoSalary").value=salary;$("negoYears").value=years;n.msg="구단 규정: 연봉 0.3~30억, 1~4년으로 맞췄습니다("+salary+"억 × "+years+"년). 다시 제안을 누르세요.";renderNego();return}
 if(bonus>s.budget){n.msg="구단 재정: 계약금 "+bonus+"억이 잔액 "+s.budget+"억을 넘습니다. 조건을 낮추세요.";renderNego();return}n.round++;
 const U=utility(p,salary,years);
 if(U>=0.97){sign(p,salary,years);n.done=true;n.msg="계약 성사 · "+p.name+" "+years+"년, 연봉 "+salary+"억 (계약금 "+r1(salary*years*0.3)+"억 별도)";}
 else if(U>=0.80){n.patience--;n.ask=r1(Math.max(salary,n.ask-(n.ask-salary)*0.45));if(years<yearsPref(p))n.years=yearsPref(p);
  if(I().rng()<0.25){n.ask=r1(n.ask*1.08);n.msg="에이전트: 다른 구단도 관심을 보여 요구액이 "+n.ask+"억으로 올랐습니다. "+n.years+"년이면 좋겠습니다."}
  else n.msg="에이전트: 조금 더 올려 주시죠. "+n.ask+"억, "+n.years+"년이면 사인하겠습니다."+(n.patience<=1?" (마지막 제안입니다)":"")}
 else{n.patience--;n.msg="에이전트: 그 조건으로는 어렵습니다. 요구는 "+n.ask+"억, "+n.years+"년입니다."+(n.patience<=1?" (마지막 제안입니다)":"")}
 if(!n.done&&n.patience<=0){n.done=true;s.fa=s.fa.filter(x=>x.id!==p.id);n.msg="협상 결렬 · "+p.name+" 측이 자리를 떴습니다. 이번 시즌 시장에서 빠집니다.";I().addLog(p.name+" 협상 결렬")}
 f.negoHist=f.negoHist||{};f.negoHist[n.id]={id:n.id,ask:n.ask,years:n.years,patience:n.patience,round:n.round,done:n.done};
 I().save();renderNego();I().render()}
function sign(p,salary,years){const s=S(),f=fin();const bonus=r1(salary*years*0.3);cash(-bonus);f.exp.fees+=bonus;led("계약금",-bonus,p.name+" "+years+"년");
 s.fa=s.fa.filter(x=>x.id!==p.id);p.contract={salary,years,status:"fa"};p.noTrade=true;p.signedDay=s.day;addToClub(p);
 const t40=I().top40();I().addLog(p.name+" 영입 · "+years+"년 총액 "+r1(salary*years+bonus)+"억 (계약금 "+bonus+"억 · 연봉 "+salary+"억)"+(t40>CAP?" · 상위 40인 "+t40.toFixed(1)+"억으로 샐러리캡 초과, 시즌 말 제재금":""))}
function renderNego(){const s=S(),f=fin();const n=f.nego;const box=$("negoBody");if(!n||!box)return;const p=s.fa.find(x=>x.id===n.id)||s.players.find(x=>x.id===n.id);if(!p){$("negoModal").hidden=true;return}
 const keys=p.type=="B"?I().DATA.bat_keys:I().DATA.pit_keys;const bonus=r1((+$("negoSalary").value||0)*(+$("negoYears").value||1)*0.3);
 box.innerHTML="<div><b>"+p.name+"</b> · "+(p.pos||p.role)+" · "+p.age+"세 · "+(p.from?"전 소속 "+p.from+" · ":"")+keys.slice(0,4).map(k=>I().KO[k]+" "+I().gi(p.grades[k])).join(" ")+"</div>"+
  "<div class='hint'>요구 "+n.ask+"억 × "+n.years+"년"+(n.done?"":" · 인내 "+"●".repeat(Math.max(0,n.patience))+"○".repeat(3-Math.max(0,n.patience)))+" · 잔액 "+s.budget+"억 · 계약금은 연봉×연수의 30 % (지금 "+bonus+"억)</div>"+
  "<div class='nmsg'>"+n.msg+"</div>";
 $("negoOffer").disabled=n.done;$("negoMeet").disabled=n.done;$("negoSalary").disabled=n.done;$("negoYears").disabled=n.done}
/* ---------------- screen ---------------- */
function render(){const s=S();if(!$("budget"))return;const f=fin();renderBudget(s,f);renderTrade(s,f);renderSigning(s,f)}
function renderBudget(s,f){const t40=I().top40();const inc=r1(f.inc.gate+f.inc.ads+f.inc.parent),exp=r1(f.exp.salary+f.exp.ops+f.exp.tax+f.exp.fees+f.exp.buyout);
 $("budget").innerHTML="<div class='fin'><div class='kv'><small>잔액(이적 자금)</small><b>"+s.budget.toFixed(1)+"억</b></div><div class='kv'><small>시즌 수입</small><b class='win'>+"+inc+"억</b></div><div class='kv'><small>시즌 지출</small><b class='loss'>−"+exp+"억</b></div></div>"+
  "<div class='capline'><span>상위 40인 보수 "+t40.toFixed(1)+"억</span><span class='gauge'><span style='width:"+Math.min(100,100*t40/CAP)+"%' class='"+(t40>CAP?"over":"")+"'></span><i style='left:"+(100*FLOOR/CAP)+"%'></i></span><span>캡 "+CAP+"억</span></div>"+
  "<div class='hint'>"+(t40>CAP?"초과 "+r1(t40-CAP)+"억 · 시즌 말 초과분의 "+(f.taxYears>0?50:30)+"% 제재금":t40<FLOOR?"하한 "+FLOOR+"억 미달 · 미달분 30 % 유소년 기금":"캡 여유 "+r1(CAP-t40)+"억")+" · 홈 관중 누계 "+f.att.toLocaleString()+"명 · "+(canTrade()?"트레이드 가능 (마감까지 "+(DEADLINE_GAME-gamesPlayed())+"경기)":"트레이드 마감")+"</div>"+
  "<table class='tiny'><tr><th>입장</th><th>광고·상품</th><th>모기업</th><th>연봉</th><th>운영</th><th>계약금·현금</th><th>정산·제재</th></tr><tr><td>"+r1(f.inc.gate)+"</td><td>"+r1(f.inc.ads)+"</td><td>"+r1(f.inc.parent)+"</td><td>"+r1(f.exp.salary)+"</td><td>"+r1(f.exp.ops)+"</td><td>"+r1(f.exp.fees)+"</td><td>"+r1(f.exp.tax+f.exp.buyout)+"</td></tr></table>"+
  "<div id='ledger' class='grow'></div>";
 I().pageTable("ledger","<tr><th>날짜</th><th>항목</th><th class='num'>금액</th><th>내용</th></tr>",f.ledger.map(l=>"<tr><td>"+l.d+"</td><td>"+l.kind+"</td><td class='num "+(l.amt>=0?"win":"loss")+"'>"+(l.amt>=0?"+":"")+l.amt+"</td><td>"+l.text+"</td></tr>"),6,"ledger")}
function renderTrade(s,f){const box=$("trade");const clubs=s.opps.filter(o=>o.code);
 if(!clubs.length){box.innerHTML="<div class='hint'>트레이드는 KBO 구단으로 시작한 시즌에서 할 수 있습니다.</div>";return}
 if(!MK.club||!clubs.find(c=>c.code===MK.club))MK.club=clubs[0].code;const roster=oppRoster(MK.club).map(p=>({p,v:tradeValue(p)})).sort((a,b)=>b.v-a.v);
 const mine=s.players.filter(p=>p.active).map(p=>({p,v:tradeValue(p)})).sort((a,b)=>b.v-a.v);
 const row=(x,side)=>{const on=MK.sel[side].includes(x.p.id);return "<tr class='"+(on?"sel":"")+"' title='연봉 "+x.p.contract.salary+"억'><td><label><input type='checkbox' data-side='"+side+"' data-id='"+x.p.id+"'"+(on?" checked":"")+(x.p.noTrade?" disabled":"")+"> "+x.p.name+"</label></td><td>"+(x.p.pos||x.p.role)+" "+x.p.age+"</td><td>"+I().gi(I().grade(I().ovr(x.p)))+" <small class='hint'>"+x.p.contract.salary+"억</small></td><td class='num'>"+x.v+"</td></tr>"};
 const offers=f.offers.map(o=>{const r=oppRoster(o.code);const w=I().P(o.want);return "<div class='offer'><b>"+o.short+"</b> "+(w?w.name:"?")+" ⇄ "+o.give.map(i=>(r.find(p=>p.id===i)||{name:"?"}).name).join(", ")+" <button data-off='"+o.id+"' data-a='1'>수락</button><button data-off='"+o.id+"' data-a='0'>거절</button></div>"}).join("");
 box.innerHTML="<div class='ctl'><span class='hint'>상대</span><select id='tradeClub'>"+clubs.map(c=>"<option value='"+c.code+"'"+(c.code===MK.club?" selected":"")+">"+c.name+"</option>").join("")+"</select><span class='hint'>가치 = 능력·나이·계약 (ZenGM식)</span></div>"+
  (offers?"<div class='offers'>"+offers+"</div>":"")+
  "<div class='tradecols'><div><h3>받을 선수 (최대 2)</h3><div id='tradeTheirs' class='grow'></div></div><div><h3>보낼 선수 (최대 2)</h3><div id='tradeOurs' class='grow'></div></div></div>"+
  "<div class='ctl'><span class='hint'>현금(억, 음수는 받음)</span><input type='number' id='tradeCash' step='0.5' value='"+(MK.cash||0)+"' style='width:70px'><button class='go' id='tradeGo'"+(canTrade()?"":" disabled")+">제안</button><span id='tradeMsg' class='hint'>"+(MK.msg||"")+"</span></div>";
 I().pageTable("tradeTheirs","<tr><th>선수</th><th>포지션</th><th>OVR·연봉</th><th class='num'>가치</th></tr>",roster.map(x=>row(x,"theirs")),window.innerHeight<520?4:6,"tth");
 I().pageTable("tradeOurs","<tr><th>선수</th><th>포지션</th><th>OVR·연봉</th><th class='num'>가치</th></tr>",mine.map(x=>row(x,"ours")),window.innerHeight<520?4:6,"tou");
 $("tradeClub").onchange=()=>{MK.club=$("tradeClub").value;MK.sel={theirs:[],ours:[]};MK.msg="";render()};
 box.querySelectorAll("input[type=checkbox]").forEach(c=>c.onchange=()=>{const side=c.dataset.side,id=+c.dataset.id;const a=MK.sel[side];if(c.checked){if(a.length>=2){c.checked=false;return}a.push(id)}else MK.sel[side]=a.filter(x=>x!==id);render()});
 $("tradeGo").onclick=()=>{MK.cash=+$("tradeCash").value||0;const r=proposeTrade(MK.club,MK.sel.theirs,MK.sel.ours,MK.cash);MK.msg=r.msg;if(r.counter&&r.counter.add&&MK.sel.ours.length<2)MK.sel.ours.push(r.counter.add);if(r.counter&&r.counter.cash!==undefined)MK.cash=r.counter.cash;I().save();I().render()};
 box.querySelectorAll("[data-off]").forEach(b=>b.onclick=()=>answerOffer(+b.dataset.off,b.dataset.a==="1"))}
function renderSigning(s,f){const box=$("signing");if(!box)return;
 I().pageTable("signing","<tr><th>선수</th><th>포지션</th><th>나이</th><th>등급</th><th>요구</th><th></th></tr>",s.fa.map(p=>"<tr><td>"+p.name+(p.from?" <small class='hint'>"+p.from+"</small>":"")+"</td><td>"+(p.pos||p.role)+"</td><td>"+p.age+"</td><td>"+(p.type=="B"?I().DATA.bat_keys:I().DATA.pit_keys).slice(0,3).map(k=>I().KO[k]+" "+I().gi(p.grades[k])).join(" ")+"</td><td>"+p.asking+"억</td><td><button data-nego='"+p.id+"'>협상</button></td></tr>"),5,"sign");
 box.querySelectorAll("[data-nego]").forEach(b=>b.onclick=()=>startNego(+b.dataset.nego))}
function wire(){if(!$("negoOffer"))return;$("negoOffer").onclick=()=>offer(+$("negoSalary").value||0,+$("negoYears").value||1);
 $("negoMeet").onclick=()=>{const n=fin().nego;if(!n)return;$("negoSalary").value=n.ask;$("negoYears").value=n.years;offer(n.ask,n.years)};
 $("negoClose").onclick=()=>{$("negoModal").hidden=true;I().render()};["negoSalary","negoYears"].forEach(id=>$(id).oninput=renderNego)}
window.ClubMarket={render,gate,weekly,seasonEnd,startNego,offer,proposeTrade,tradeValue,oppRoster,answerOffer,fin,CAP,DEADLINE_GAME};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wire);else wire();
})();
