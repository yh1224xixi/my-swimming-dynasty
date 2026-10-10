const fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{
process.chdir(path.resolve(__dirname,'../..'));
const {JSDOM,VirtualConsole}=require(process.env.JSDOM_MODULE||'jsdom');
const html=fs.readFileSync('football/index.html','utf8').replace(/<script[^>]*src=["'][^"']+["'][^>]*><\/script>/g,'');
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(html,{url:'https://yh1224xixi.github.io/my-swimming-dynasty/football/',runScripts:'outside-only',virtualConsole:vc,pretendToBeVisual:true});const w=dom.window;
w.matchMedia=()=>({matches:false,addEventListener(){}});w.confirm=()=>true;w.scrollTo=()=>{};
const scripts=[...fs.readFileSync('football/index.html','utf8').matchAll(/<script[^>]*src=["']([^"']+)/g)].map(x=>x[1].split('?')[0]);
for(const f of scripts){if(f==='js/v2/main.js')continue;w.eval(fs.readFileSync(path.join('football',f),'utf8'))}
const el=id=>w.document.getElementById('lm-'+id),set=(id,v)=>el(id).value=v,click=id=>el(id).click();


function career(pos='ST',club){const d=w.State.newCareer();d.player=w.PlayerSystem.create('数值审核',pos,'中国',75,9,90);d.player.age=24;d.phase='senior';w.State.isNew=false;w.Career.beginSeason(w.State,club||w.LD().epl.teams[0].id,'epl');return d}
const out={};
let d=career();
out.config={deposits:w.CONFIG.FINANCE.DEPOSITS,logMax:w.CONFIG.FINANCE.LOG_MAX,break:w.CONFIG.POTENTIAL.EXP_BREAK,level:w.CONFIG.LEVEL};
w.Finance.ensure(d);const limit=w.CONFIG.FINANCE.LOG_MAX||60;
for(let i=0;i<limit+3;i++)w.Finance.log(d,'测试',100,'记录'+i);
out.financeLog={length:d.finance.log.length,missingMonth:d.finance.log.filter(x=>!x._mk).length,last:d.finance.log.at(-1),monthSum:w.Finance.monthSum(d),sumRetained:d.finance.log.reduce((s,x)=>s+x.amt,0)};
let attr=Object.keys(d.player.attrs)[0];out.breakCosts=[0,5,10,15].map(n=>{d.player.expBreak={[attr]:n};return {raised:n,cost:w.Potential.expBreakCost(d,attr)}});
d=career();d.player.hidden.growth='special';d.talents=['diligent'];d.talentTiers={diligent:'diamond'};
let previous=d.expTotal||0;let v=w.Training.applyMatchExp(w.State,1000);out.matchExp={raw:1000,credited:d.expTotal-previous,returned:v};
const oldApply=w.INTL.applyResult,oldCaptain=w.INTL.checkCaptain,oldAdvance=w.Career.advanceDay;w.INTL.applyResult=()=>{};w.INTL.checkCaptain=()=>false;w.Career.advanceDay=()=>{};
d=career();const before=d.seasonStats.motm;
let fixture={type:'intl',comp:'友谊赛',day:0,match:{home:{id:'nat_中国',name:'中国',strength:75},away:{id:'nat_日本',name:'日本',strength:75}}};
let engine={fx:fixture,userHome:true,userStarter:true,userPerf:{played:true},result:{home:2,away:0,played:true,userGoals:1,userAssists:0,rating:8,motm:true,userSaves:0},opponentTeam(){return fixture.match.away}};
let intlResult=w.Settlement.applyResult({_retryOk:true,engine},'silent');out.intlMvp={before,after:d.seasonStats.motm,clubApps:d.seasonStats.apps,intlApps:d.intl.career.apps};
w.INTL.applyResult=oldApply;w.INTL.checkCaptain=oldCaptain;
// Match hook with club containing a real star; spy proves whether addFavor is reached.
const star=w.StarFavor.poolOf().find(x=>x.clubId&&w.teamById(x.clubId));d=career('ST',star.clubId);let favorCalls=0;const oldFavor=w.StarFavor.addFavor;w.StarFavor.addFavor=(...a)=>{favorCalls++;return oldFavor(...a)};fixture={type:'league',comp:'联赛',day:0,round:1,match:{home:{id:d.clubId,name:'主队',strength:75},away:{id:'test_opp',name:'客队',strength:75}}};const oldSeason=w.SeasonSystem.applyResult,oldRound=w.SeasonSystem.simulateRound;w.SeasonSystem.applyResult=()=>{};w.SeasonSystem.simulateRound=()=>{};engine={...engine,fx:fixture,result:{...engine.result,motm:false},opponentTeam(){return fixture.match.away}};
out.starFavorBefore=w.StarFavor.favorOf(d,star.pid);w.Settlement.applyResult({_retryOk:true,engine},'silent');out.starFavor={star:star.name,eligible:w.StarFavor.poolOf().filter(x=>x.clubId===d.clubId).length,calls:favorCalls,after:w.StarFavor.favorOf(d,star.pid)};
w.SeasonSystem.applyResult=oldSeason;w.SeasonSystem.simulateRound=oldRound;w.Career.advanceDay=oldAdvance;
// Core costs at equal values.
d=career();const core=w.CONFIG.POSITION_CORE.ST;for(const k of Object.keys(d.player.attrs))d.player.attrs[k]=80;let first=core.find(k=>k in d.player.attrs),other=Object.keys(d.player.attrs).find(k=>!core.includes(k));out.coreCosts={core:first,coreCost:w.Training.pointCost(w.State,first),nonCore:other,nonCoreCost:w.Training.pointCost(w.State,other),base:w.CONFIG.EXP_PER_ABILITY};
// Deposit rates advertised as annual, money received on maturity.
out.deposits=[];for(const [id,def] of Object.entries(w.CONFIG.FINANCE.DEPOSITS)){d=career();d.money=1000000;w.Finance.buyDeposit(w.State,id,100000);for(let n=0;n<def.months;n++)w.Finance.tickDeposits(w.State);out.deposits.push({id,months:def.months,annualRate:def.rate,interest:d.money-1000000});}

d=career();fixture=w.State.data.fixtures.find(f=>f.type==='league');engine=new w.MatchEngine(w.State,fixture);engine.score={home:0,away:0};engine.userPerf.played=true;engine.minute=70;engine.pendingKey={key:{cls:'att',choices:[{text:'精确传球',attr:'passing',goalP:0,assistP:1}]}};const oldNext=w.R.next;w.R.next=()=>0.5;const feed=engine.resolveKey(0);w.R.next=oldNext;out.assistScore={assists:engine.userPerf.assists,score:engine.score,feed:feed.map(x=>x.text.replace(/<[^>]*>/g,''))};
engine.score={home:1,away:0};engine.userPerf.goals=1;engine.userPerf.played=true;engine.userStarter=true;engine.userSentOff=true;engine.finish();out.sentOff=engine.result;const advRed=w.Career.advanceDay,applyRed=w.SeasonSystem.applyResult,roundRed=w.SeasonSystem.simulateRound;w.Career.advanceDay=()=>{};w.SeasonSystem.applyResult=()=>{};w.SeasonSystem.simulateRound=()=>{};w.Settlement.applyResult({_retryOk:true,engine},'silent');out.sentOffStats={apps:d.stats.apps,goals:d.stats.goals,seasonApps:d.seasonStats.apps,seasonGoals:d.seasonStats.goals};w.Career.advanceDay=advRed;w.SeasonSystem.applyResult=applyRed;w.SeasonSystem.simulateRound=roundRed;
engine=new w.MatchEngine(w.State,fixture);engine.userPerf.played=true;engine.userStarter=false;engine.userSubOn=80;engine.finish();out.subMinutes={enteredAt:80,minutes:engine.result.userMinutes};
d=career();d.traits={warmUp:5,tenacity:5};d.flags={justReturned:true};const oldAdv=w.Career.advanceDay,oldS=w.SeasonSystem.applyResult,oldR=w.SeasonSystem.simulateRound;w.Career.advanceDay=()=>{};w.SeasonSystem.applyResult=()=>{};w.SeasonSystem.simulateRound=()=>{};engine={fx:fixture,userHome:true,userStarter:false,userPerf:{played:true},result:{home:2,away:0,userGoals:1,userAssists:0,rating:10,played:true,motm:true},opponentTeam(){return fixture.match.away}};out.ratingAfterSettlement=w.Settlement.applyResult({_retryOk:true,engine},'silent').rating;w.Career.advanceDay=oldAdv;w.SeasonSystem.applyResult=oldS;w.SeasonSystem.simulateRound=oldR;
d=career('GK');d._lastSeasonStats={season:d.season-1,apps:30,goals:0,assists:0,ratingSum:210,motm:5,saves:100,cleanSheets:12};d.seasonStats={apps:0,ratingSum:0,motm:0};out.gkReport=w.SeasonReport.build(w.State,d.season-1);const drawn=[];w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText(t){return {width:String(t).length*8}},fillText(t){drawn.push(String(t))}},{get(o,k){return k in o?o[k]:()=>{}},set(o,k,v){o[k]=v;return true}});w.PosterArt.draw=()=>{};w.SeasonReport.draw(w.State,d.season-1);let idx=drawn.indexOf('零封');out.gkDraw={expected:12,drawnValue:drawn[idx-1]};
d=career();for(const k of Object.keys(d.player.attrs))d.player.attrs[k]=w.Potential.effPot(d,k);const attrsBefore={...d.player.attrs};const grow=w.Growth.seasonEnd(w.State);out.cappedGrowth={reported:grow.delta,gains:grow.gains,actual:Object.keys(d.player.attrs).reduce((s,k)=>s+d.player.attrs[k]-attrsBefore[k],0)};


assert.deepEqual(out.assistScore.score,{home:1,away:0});
assert.equal(out.sentOff.played,true);assert.equal(out.sentOffStats.apps,1);assert.equal(out.sentOffStats.goals,1);
assert.equal(out.subMinutes.minutes,10);assert.equal(out.ratingAfterSettlement,10);
assert.equal(out.intlMvp.after,0);assert(out.starFavor.calls>0);assert.equal(out.starFavor.after,2);
assert.equal(out.matchExp.returned.exp,out.matchExp.credited);
assert.equal(out.gkDraw.drawnValue,'12');assert.equal(out.cappedGrowth.reported,0);
assert.deepEqual(out.deposits.map(x=>x.interest),[500,1750,6000]);
assert.equal(out.financeLog.missingMonth,0);assert.equal(out.financeLog.monthSum.income,6300);
assert.deepEqual(out.breakCosts.map(x=>x.cost),[1650000,2062500,2578125,3222656]);
// Substitute goals/assists are credited when they happen, never at timeline creation.
d=career();fixture=d.fixtures.find(f=>f.type==='league');engine=new w.MatchEngine(w.State,fixture);
engine.userStarter=false;engine.userSubOn=80;engine.userPerf.played=true;engine.userPerf.goals=0;engine.userPerf.assists=0;
engine.score={home:0,away:0};engine.renderEvent({type:'goal',user:true,userScores:true,userAssists:false,minute:50});assert.equal(engine.userPerf.goals,0);
engine.renderEvent({type:'goal',user:true,userScores:false,userAssists:true,minute:85});assert.equal(engine.userPerf.assists,1);
engine.renderEvent({type:'card',user:true,userCard:true,yellow:false,minute:86});engine.renderEvent({type:'goal',user:true,userScores:true,minute:88});
assert.equal(engine.userPerf.goals,0);engine.finish();assert.equal(engine.result.userMinutes,6);assert(engine.result.played);
// Match records must conserve each team's goal count across the scorers board.
d=career();const season=w.State.data.season;const whole=await w.FootballSeasonSim.run();assert(whole.complete);
const stats=w.FootballStats.ensure(d),leagueApps=d.fixtures.filter(f=>f.type==='league'&&f.result?.played).length;
assert.equal(stats.league.apps,leagueApps);assert.equal(stats.league.apps+stats.cup.apps,d.seasonStats.apps);
for(const team of d.table){const total=Object.values(d.leagueBoard.players).filter(p=>p.clubId===team.id).reduce((n,p)=>n+p.goals,0);assert.equal(total,team.gf,team.name+' scorer totals');}
const rank=w.FootballStats.ranking(d,'goals');assert.equal(rank.find(p=>p.isUser).goals,stats.league.goals);
const stable=w.State._packSaveJson();w.FootballStats.ranking(d,'goals');assert.equal(w.State._packSaveJson(),stable);
w.Hub._clubTab='table';w.Hub.clubTab='table';const root=w.document.getElementById('hub-sheet-body');
w.Hub.clubPage(root);assert(root.textContent.includes('联赛射手榜'));assert(root.textContent.includes('联赛助攻榜'));
// League awards cannot be won from cup goals alone.
const cup=d.competitionStats.cup;cup.goals=100;d.competitionStats.league.goals=0;assert.equal(w.FootballStats.awardStatus(d).goldenBoot,false);
// Legacy migration reconstructs from results without touching aggregate money or career data.
const oldTotal=d.stats.goals,oldMoney=d.money;delete d.competitionStats;delete d.leagueBoard;
for(const f of d.fixtures)delete f._scopeRecorded;
w.FootballStats.ensure(d);w.FootballStats.ranking(d,'goals');assert.equal(d.stats.goals,oldTotal);assert.equal(d.money,oldMoney);
assert.equal(w.FootballStats.leagueStats(d).apps,leagueApps);
w.Flow.seasonEnd();assert.equal(d._lastCompetitionStats.season,season);assert.equal(w.FootballStats.leagueStats(d).apps,leagueApps);
assert(w.document.body.textContent.includes('本次赛季快进汇总'));assert(w.document.body.textContent.includes('赛事分别统计'));
// Pause before a life choice, save/reload it, apply effects exactly once, then resume.
d=career();d._stashedEvent={title:'测试代言',choices:[{text:'接受测试代言',effects:{money:1234}},{text:'婉拒测试代言',effects:{}}]};
const money=d.money,paused=await w.FootballSeasonSim.run({pauseOnChoices:true});assert.equal(paused.pauseReason,'测试代言');assert.equal(d.money,money);
w.State.save(true);w.State.data=null;w.State.load();d=w.State.data;assert(d._seasonSimPendingEvent);w.Hub.refresh(null);
w.document.querySelector('.ec-opt[data-i]').click();assert(!d._seasonSimPendingEvent);assert.equal(d.money,money+1234);
w.State.save(true);w.State.data=null;w.State.load();assert(!w.State.data._seasonSimPendingEvent);
// Daily choice cards retain their exact identity and effects across reloads.
d=career();const oldRoll=w.EventCards.rollDaily;const card={id:'test_pause_card',title:'测试生涯卡',body:'选择测试',options:[{text:'获得测试资金',fx:{money:321},response:'已领取'}]};
w.EventCards.rollDaily=()=>card;
const pauseCard=await w.FootballSeasonSim.run({pauseOnChoices:true});assert.equal(pauseCard.pauseReason,'测试生涯卡');const money2=d.money;
w.EventCards.rollDaily=oldRoll;w.State.save(true);w.State.data=null;w.State.load();d=w.State.data;assert(d._seasonSimPendingCard);
w.Hub.refresh(null);w.document.querySelector('.ec-opt[data-i]').click();assert(!d._seasonSimPendingCard);assert.equal(d.money,money2+321);
w.State.save(true);w.State.data=null;w.State.load();assert(!w.State.data._seasonSimPendingCard);
const resumed=await w.FootballSeasonSim.run();assert(resumed.complete);
console.log('PASS: numeric corrections, league conservation/migration, season snapshots, choice pause/reload/exactly-once/resume');
dom.window.close();
})().catch(e=>{console.error(e);process.exit(1)});
