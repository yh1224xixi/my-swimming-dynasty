(function () {
  'use strict';
  const blank = () => ({apps:0,goals:0,assists:0,saves:0,cleanSheets:0,ratingSum:0,motm:0,minutes:0});
  const statsSeason = d => d._seasonSettled ? d.season-1 : d.season;
  const scope = fx => fx.type === 'intl' || /世界杯|亚洲杯|世预赛|友谊赛|东亚杯|奥运会/.test(fx.comp || '') ? 'international' : fx.type === 'league' ? 'league' : 'cup';
  function add(stats, result, home) {
    if (!result.played) return;
    stats.apps++; stats.goals += result.userGoals || 0; stats.assists += result.userAssists || 0;
    stats.saves += result.userSaves || 0; stats.ratingSum += result.rating || 0;
    stats.motm += result.motm ? 1 : 0; stats.minutes += result.userMinutes || 0;
    if ((home ? result.away : result.home) === 0) stats.cleanSheets++;
  }
  function init(d) {
    d.competitionStats = {season:d.season,league:blank(),cup:blank(),international:blank()};
    d.leagueBoard = {season:d.season,leagueId:d.leagueId,players:{},games:{}};
  }
  function ensure(d) {
    if (d.competitionStats?.season === statsSeason(d)) return d.competitionStats;
    // Old saves retain their aggregate data. Rebuild the new scopes only from saved results.
    d.competitionStats = {season:statsSeason(d),league:blank(),cup:blank(),international:blank()};
    for (const fx of d.fixtures || []) if (fx.played && fx.result) {
      const type=scope(fx); add(d.competitionStats[type],fx.result,fx.match?.home?.id===d.clubId);
      fx._scopeRecorded=true;
    }
    return d.competitionStats;
  }
  function recordMatch(d, fx, result) {
    const stats=ensure(d);
    if (fx._scopeRecorded) return;
    add(stats[scope(fx)],result,fx.match?.home?.id===d.clubId || fx.match?.home?.id==='nat_中国');
    fx._scopeRecorded=true;
  }
  // A local seeded stream keeps scorer allocation independent of match-engine randomness.
  function rng(seed) {
    let value=2166136261;
    for (const c of String(seed)) {value^=c.charCodeAt(0);value=Math.imul(value,16777619);}
    return () => {value+=0x6D2B79F5;let t=Math.imul(value^value>>>15,1|value);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};
  }
  function roster(team) {
    const data=teamById(team.id) || team;
    const rows=(data.players || []).map((p,index)=>Array.isArray(p)?{name:p[0],pos:p[2],ovr:p[4],index}:{name:p.name,pos:p.position,ovr:p.overall,index}).filter(p=>p.name&&p.pos!=='GK');
    return rows.length?rows:[{name:team.name+'前锋',pos:'ST',ovr:team.strength||65,index:0},{name:team.name+'中场',pos:'CM',ovr:team.strength||65,index:1}];
  }
  function pick(rows, kind, random, excluded) {
    const pool=rows.filter(p=>p.id!==excluded);
    const weights={goals:{ST:5,CF:4.5,LW:3,RW:3,CAM:2.5,CM:1.3},assists:{CAM:5,CM:4,LW:3,RW:3,LM:3,RM:3,ST:1.5}};
    const weight=p=>(weights[kind][p.pos]||0.6)*Math.max(0.5,(p.ovr||65)/75);
    let roll=random()*pool.reduce((sum,p)=>sum+weight(p),0);
    for (const p of pool) if ((roll-=weight(p))<=0) return p;
    return pool[pool.length-1];
  }
  function board(d) {
    ensure(d);
    if (d.leagueBoard?.season!==statsSeason(d) || d.leagueBoard?.leagueId!==d.leagueId) {
      d.leagueBoard={season:statsSeason(d),leagueId:d.leagueId,players:{},games:{}};
      // Team totals are sufficient to backfill opponents without inventing past user performance.
      for (const team of d.table || []) allocate(d,team,team.gf||0,'legacy-'+team.id,
        team.id===d.clubId?d.competitionStats.league:null);
    }
    return d.leagueBoard;
  }
  function allocate(d,team,goals,seed,userResult) {
    const b=d.leagueBoard,random=rng(d.season+'|'+seed+'|'+team.id);
    const rows=roster(team).map(p=>({...p,id:team.id+'|'+p.name}));
    for (const p of rows) b.players[p.id] ||= {...p,clubId:team.id,clubName:team.name,goals:0,assists:0};
    const own=team.id===d.clubId;
    const userId='user';
    if(own)b.players[userId] ||= {id:userId,name:d.player.name,pos:d.player.position,clubId:team.id,clubName:team.name,goals:0,assists:0,isUser:true};
    const ug=own?Math.min(goals,userResult?.userGoals??userResult?.goals??0):0;
    const ua=own?Math.min(Math.max(0,goals-ug),userResult?.userAssists??userResult?.assists??0):0;
    for (let n=0;n<goals;n++) {
      const scorer=n<ug?b.players[userId]:pick(rows,'goals',random);
      if(!scorer)continue;
      b.players[scorer.id].goals++;
      const assister=n>=ug&&n<ug+ua?b.players[userId]:random()<0.7?pick(rows,'assists',random,scorer.id):null;
      if(assister)b.players[assister.id].assists++;
    }
  }
  function recordLeagueGame(d,home,away,hg,ag,key,result) {
    if(window.Youth&&Youth.inAcademy(d))return;
    const b=board(d);
    if(b.games[key])return;
    allocate(d,home,hg,key+'-home',result);
    allocate(d,away,ag,key+'-away',result);
    b.games[key]=true;
  }
  function ranking(d,kind) {
    const b=board(d),stats=ensure(d).league;
    // The player's exact match records take precedence over allocations for legacy saves.
    b.players.user ||= {id:'user',name:d.player.name,clubId:d.clubId,clubName:teamById(d.clubId)?.name||'',isUser:true};
    b.players.user.goals=stats.goals;b.players.user.assists=stats.assists;
    return Object.values(b.players).sort((a,b)=>(b[kind]||0)-(a[kind]||0)||String(a.id).localeCompare(String(b.id)));
  }
  function awardStatus(d) {
    const goals=ranking(d,'goals'),assists=ranking(d,'assists'),me=ensure(d).league;
    const goalLead=goals[0]?.goals||0,assistLead=assists[0]?.assists||0;
    return {goalLead,assistLead,goldenBoot:me.goals>0&&me.goals===goalLead,assistKing:me.assists>0&&me.assists===assistLead};
  }
  function boardHtml(d) {
    if(window.Youth&&Youth.inAcademy(d))return '';
    const esc=UIkit.esc;
    const list=(kind,label)=>'<div class="panel"><div class="panel-title">'+label+'</div>'+ranking(d,kind).filter(p=>(p[kind]||0)>0).slice(0,10).map((p,i)=>'<div class="row"><span>'+ (i+1)+'. '+esc(p.name)+(p.isUser?' · 你':'')+'<small class="dim12"> · '+esc(p.clubName)+'</small></span><b>'+p[kind]+'</b></div>').join('')+'</div>';
    const me=ensure(d).league;
    return '<div class="panel"><div class="panel-title">你的联赛数据</div><div class="dim12">'+me.apps+' 场 · '+me.goals+' 球 · '+me.assists+' 助 · MVP '+me.motm+' 次</div><div class="dim12">只统计联赛；金靴、助攻王按榜首结算，并列榜首可获奖。其他球员的数据随球队实际进球模拟分配；旧档从已有赛果补建。</div></div>'+list('goals','联赛射手榜')+list('assists','联赛助攻榜');
  }
  function competitionHtml(d,season) {
    const stats=d._lastCompetitionStats?.season===season?d._lastCompetitionStats:ensure(d);
    if(stats.season!==season)return '';
    return '<div class="panel"><div class="panel-title">赛事分别统计</div>'+[['league','联赛'],['cup','俱乐部杯赛'],['international','国家队']].map(([key,name])=>{
      const s=stats[key]||blank();return '<div class="row"><span>'+name+'</span><b>'+s.apps+' 场 · '+s.goals+' 球 · '+s.assists+' 助</b></div>';
    }).join('')+'<div class="dim12">上方赛季出场和表现为俱乐部总计；国家队单独统计。旧存档按保存的比赛结果补建。</div></div>';
  }
  function summaryHtml(d,season) {
    const run=d._lastSeasonSimulation;
    if(!run||run.season!==season)return '';
    const s=run.summary;
    if(!s)return '';
    const signed=n=>(n>=0?'+':'−')+Career.fmtMoney(Math.abs(n));
    return '<div class="panel"><div class="panel-title">本次赛季快进汇总</div><div class="row"><span>模拟进度</span><b>'+run.matches+' 场 · '+run.days+' 天</b></div><div class="row"><span>经验收入</span><b>+'+s.exp.toLocaleString('zh-CN')+'</b></div><div class="row"><span>总评</span><b>'+s.ovrBefore+' → '+PlayerSystem.overall(d.player)+'</b></div><div class="row"><span>收入累计（含奖金）</span><b>'+signed(s.wage)+'（奖金 '+Career.fmtMoney(s.bonus)+'）</b></div><div class="row"><span>资金净变化</span><b>'+signed(s.money)+'</b></div><div class="row"><span>伤病</span><b>新增 '+s.injuries+' 次 · 剩余 '+s.injuryDays+' 天</b></div><div class="dim12">仅统计这次快进；暂停后续跑会生成新的汇总。荣誉见赛季报告。</div></div>';
  }
  window.FootballStats={init,ensure,recordMatch,recordLeagueGame,leagueStats:d=>ensure(d).league,ranking,awardStatus,boardHtml,competitionHtml,summaryHtml};

  const refresh=Hub.refresh;
  Hub.refresh=function(event,done) {
    const d=State.data;
    if(d?._seasonSimPendingCard){
      this.header();
      const pending=d._seasonSimPendingCard;
      EventCards.showPending(State,pending.card,pending.ctx,()=>{delete d._seasonSimPendingCard;State.save();this.refresh(null);done&&done();});
      return;
    }
    if(d?._seasonSimPendingEvent){
      this.header();
      this.showEventModal(d._seasonSimPendingEvent,()=>{delete d._seasonSimPendingEvent;State.save();this.refresh(null);done&&done();});
      return;
    }
    return refresh.call(this,event,done);
  };
})();
