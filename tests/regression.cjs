const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require(process.env.SWIM_TEST_MODULES ? process.env.SWIM_TEST_MODULES+'/jsdom' : 'jsdom');
const acorn=require(process.env.SWIM_TEST_MODULES ? process.env.SWIM_TEST_MODULES+'/acorn' : 'acorn');
const html=fs.readFileSync(__dirname+'/../index.html','utf8'),errors=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
const noop=()=>{},ctx=new Proxy({measureText:s=>({width:String(s).length*7}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),getImageData:()=>({data:new Uint8Array(4)})},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
const dom=new JSDOM(html,{url:'https://swim-test.invalid/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=noop;w.scrollTo=noop;w.matchMedia=()=>({matches:false,addListener:noop,addEventListener:noop});}});
const w=dom.window;const evalGame=code=>vm.runInContext(code,dom.getInternalVMContext(),{timeout:240000});
for(const el of w.document.scripts){if(el.type==='application/json'||el.src)continue;acorn.parse(el.textContent,{ecmaVersion:'latest'});}
console.log('All inline scripts parse');
console.log('Boot errors:',errors.map(e=>e.message));

const result=evalGame(`(()=>{
  const checks=[];const ok=(label,test)=>{if(!test)throw Error(label);checks.push(label)};
  Object.assign(WIZ,{name:'回归测试',nat:'CN',sex:'M',sys:'cn',age:19,main:100,cat:'sprint',rtype:'allrd',pa:162,gc:'std',extra:{},prov:'广东队'});
  newGame();migrate();
  ok('first-year history initialized',G.world.swimV10.lastYear===BASE_YEAR);
  const before=G.p.money,quote=trainCostOf(G.p,'accel',2),log=doTrain('accel',2);
  markTrained(G.p,'accel',2,false,log);
  ok('training quote = cash = ledger = result',before-G.p.money===quote && log.cost===quote && G.p.ledger.oc.train===quote && trainResultText(G.p,'accel',2,log).cost===quote);
  for(const k of ['prize','fee','ach','goal','inv','spon']){const b=G.p.money;const paid=earn(G.p,k,8000);ok(k+' advertised amount honored',paid===8000&&G.p.money-b===8000)}
  for(const sex of ['M','F'])for(const ev of EVS){
    for(const level of [3,10,20]){
      const P=physOf(uniformAttrs(level),ev,1,sex),rt=P.rtBase;
      const rr=raceRun(P,ev,EVENTS[ev].d,rt,1.2,{daySlow:.02},sex),pr=swimProfile(rr.sim,rr.t,EVENTS[ev].d);
      ok(sex+ev+level+' swim splits and finish',pr.splits.at(-1).t===rr.t&&swimDistance(pr,rr.t)===EVENTS[ev].d&&swimDistance(pr,rr.t-.01)<EVENTS[ev].d&&pr.vTop<4);
      ok(sex+ev+level+' chronological splits',pr.splits.every((s,i)=>s.t> (i?pr.splits[i-1].t:rt)));
    }
    ok(sex+ev+' swimming season limits',limitTimeOf(ev,sex,2028)>wrOf(ev,sex)*.90 && limitTimeOf(ev,sex,2028)<wrOf(ev,sex)*1.03);
  }
  G.p.results=[{ev:'200',t:112.7,week:G.week,meet:'测试赛',tier:'B',place:1,final:true,perf:900},{ev:400,t:245,week:G.week,meet:'测试赛',tier:'B',place:1,final:true,perf:900}];
  G.p.pb[200]=112.7;G.p.pb[400]=245;G.p.sb={200:{t:112.7,y:BASE_YEAR},400:{t:245,y:BASE_YEAR}};
  ok('200m valid result counted',evStatsIn(G.p,0).find(x=>x.ev===200).meets===1);
  ok('400m valid result counted',evStatsIn(G.p,0).find(x=>x.ev===400).meets===1);
  ok('200m qualification above 90 seconds',qualBestOf(G.p,200,'GL',52)===112.7);
  ok('400m field best is valid',fieldBestOf([{t:245,name:'A'},{t:244,name:'B'},{t:99,dq:true}]).t===244);
  ok('season best no duplicate keys',seasonSummaryOf(G.p,BASE_YEAR).sb.length===2);
  const squad=[{id:'A',t:49},{id:'B',t:50},{id:'C',t:51},{id:'D',t:52}];
  const relay=relayTimeOf([0,1,2,3],squad,'M');
  ok('relay 4 equal 100m legs',relay>200&&relay<203&&RELAY_DIST.every(d=>d===1));
  ok('relay swim record anchors',relayWROf('M')===188.24&&relayWROf('F')===207.96&&relayNROf('CN','M')>188.24);
  G.world.recRelay={WR:{M:36.84,F:40.82},AR:{M:37.43,F:42.23},NR:{}};delete G.world.swimFixVersion;migrate();
  ok('old track relay record migration',relayRecCur('WR','M')===188.24);
  const world=G.world;swimV10YearTick(world,BASE_YEAR+1);
  ok('first season captured once with year',world.swimV10.seasonRows[0].year===BASE_YEAR&&world.swimV10.seasonRows[0].rows.every(r=>r.year===BASE_YEAR));
  const n=world.swimV10.seasonRows.length;swimV10YearTick(world,BASE_YEAR+1);ok('history tick idempotent',world.swimV10.seasonRows.length===n);
  ok('new nationalities display and continents',natName('RO')==='罗马尼亚'&&contOf('HU')==='欧洲'&&contOf('KY')==='北美洲'&&contOf('TN')==='非洲');
  genSponsor(G.p,BASE_YEAR,false,true);const need=G.p.spon.need;
  ok('sponsor renewed when qualified',settleSponsor(G.p,BASE_YEAR,need).ok&&G.p.spon.yr===BASE_YEAR+1);
  G.week=WPSE;genSponsor(G.p,BASE_YEAR+1,false,true);
  ok('sponsor ends when failed',!settleSponsor(G.p,BASE_YEAR+1,0).ok&&G.p.spon.state==='none');
  ok('vacant sponsor cannot be re-settled',settleSponsor(G.p,BASE_YEAR+1,5)===null);
  ok('swimmer retirement comparison',!JSON.stringify(legendOf(G.p)).includes('苏林'));
  save();const saved=load();ok('save roundtrip',saved.p.name===G.p.name&&saved.world.swimV10.seasonRows.length===world.swimV10.seasonRows.length);
  return checks;
})()`);
console.log('Passed',result.length,'core checks');
console.log(evalGame(`(()=>{
  const ok=(name,test)=>{if(!test)throw Error(name)};
  Math.random=mulberry32(726);
  Object.assign(WIZ,{name:'赛季回归',sys:'cn',age:19,sex:'M',pa:180,main:100,step:0});
  for(let step=0;step<7;step++){
    WIZ.step=step;renderWizard();const text=$('#wizard').textContent;
    ok('creation step '+step,!text.includes('undefined')&&!text.includes('NaN')&&!text.includes('短跑'));
  }
  newGame();migrate();
  ok('real star identity',G.world.rivals.filter(r=>r.realSwimmer).every(r=>SWIM_STARS.some(s=>s.name===r.name)));
  const star=G.world.rivals.find(r=>r.realSwimmer&&r.nat==='CN');star.name='马军';swimAddStars(G.world);fixNameNatWorld();ok('old renamed star repaired',star.name===star.swimStarName&&star.name!=='马军');
  const shapeP=physOf(uniformAttrs(14),200,1,'M');
  ok('pace actually affects the shared formula',simulate(shapeP,200,.15,1,{pace:[{to:1,k:.98}]}).t>simulate(shapeP,200,.15,1,{pace:[{to:1,k:1.02}]}).t);
  const achieved=ACHS.find(a=>a.k==='sub20');const athlete={pb:{200:wrOf(200,'F')*1.01},sex:'F'};
  ok('swim achievement attainable and sex-scaled',achieved.f(athlete));
  G.p.money=1500000;setAutoStaffMode(G.p,'all');ADV.stop=false;ADV.pending='auto';
  let runs=0,iterations=0,extensions=0,oldYear=BASE_YEAR;
  const start=Date.now();
  while(!G.p.retired&&iterations++<40){
    if(G.pending){const decision=G.pending; const choice=(decision.opts||decision.choices||[])[0]; if(choice){resolvePending(0);}else G.pending=null;}
    if(G.p.retireOffer){retireExtend(G.p);extensions++;}
    if(G.p.injOffer){G.p.injOffer=null;G.p.inj=null;}
    G.p.money=Math.max(G.p.money,1000000);
    const out=advanceRun(40);runs+=out.rep.length;
    for(const ev of [200,400]){const b=(G.p.pb||{})[ev];if(b)ok('long-distance PB retained',validTime(b));}
    ok('history contains finite times and explicit years',G.world.swimV10.seasonRows.every(y=>y.rows.every(r=>validTime(r.t)&&r.year===y.year)));
    if(G.p.retireOffer){retireExtend(G.p);extensions++;}
    if(G.pending)G.pending=null;
  }
  ok('multiple seasons progressed',runs>=WPSE*10);
  ok('retirement completed',!!G.p.retired);
  ok('age extension bounded',retireExtCount(G.p)<=5);
  save();const saved=load();ok('retirement persists',saved.p.retired.why===G.p.retired.why);
  const views=['hub','train','cal','rank','rec','biz','gear','ach','nats','scout','invest'];
  for(const view of views){VIEW=view;render();ok('view '+view,!$('#view').textContent.includes('undefined')&&!$('#view').textContent.includes('NaN'));}
  return {weeks:runs,year:yearOf(G.week),age:ageOf(G.p),retirement:G.p.retired.why,extensions,elapsedMs:Date.now()-start,history:G.world.swimV10.seasonRows.length};
})()`));
if(errors.some(e=>/Uncaught/.test(e.message)))throw errors.find(e=>/Uncaught/.test(e.message));
(async()=>{
  evalGame(`Object.assign(WIZ,{name:'异步回归',sys:'cn',age:19,sex:'F',pa:180,main:200,step:0});newGame();migrate();G.p.money=1000000;setAutoStaffMode(G.p,'all');ADV.stop=false;ADV.pending='auto';`);
  let heartbeat=0;const timer=w.setInterval(()=>heartbeat++,0);
  const pending=evalGame('runAdvance(8)');
  assert.equal(evalGame('SIM_RUNNING'),true);
  assert.equal(w.document.body.classList.contains('sim-running'),true);
  await pending;w.clearInterval(timer);
  assert.equal(evalGame('SIM_RUNNING'),false);
  assert.equal(w.document.body.classList.contains('sim-running'),false);
  assert.ok(heartbeat>0,'simulation must yield to UI timers');
  assert.ok(!errors.some(e=>/Uncaught/.test(e.message)),'no uncaught JavaScript errors');
  console.log('Async simulation yields to UI and releases controls');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>dom.window.close());
