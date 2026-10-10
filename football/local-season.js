(function () {
  'use strict';
  let running = false, cancelRequested = false;
  const yieldFrame = () => new Promise(resolve => setTimeout(resolve, 0));
  function resolveEvent(event) {
    if (!event) return;
    // Events without choices have already applied their effects in advanceDay.
    const choice = event.choices && event.choices[0];
    if (!choice) return;
    Career.applyEffects(State, choice.effects || choice.fx || {});
    if (choice.hidden) Career.applyEffects(State, choice.hidden);
    if (choice.delayed) {
      const d = State.data;
      d.delayedQueue = d.delayedQueue || [];
      d.delayedQueue.push({dueDay:d.dayIndex + (choice.delayed.days || 7), message:choice.delayed.message, effects:choice.delayed.effects || {}});
    }
  }
  function saveProgress() {
    State.save(true);
    if (localStorage.getItem(State._lsMain()) !== State._packSaveJson()) throw Error('浏览器未能保存模拟进度，请释放存储空间或导出存档。');
  }
  function simulateFixture(fixture) {
    // Use the ordinary engine and settlement, including penalties and tournament progression.
    // A season simulation accepts the result rather than opening optional retry dialogs.
    const ui = {_retryOk:true, _applied:false};
    if (!(State.data.injuryDays > 0)) return Settlement.simMatch(ui, fixture, {silent:true});
    const engine = new MatchEngine(State, fixture);
    engine.interactive = false;
    engine.userPerf.played = false;
    engine.userStarter = false;
    let steps = 0;
    while (engine.phase !== 'done' && steps++ < 500) {
      const step = engine.step();
      if (step && step.keyMoment) engine.resolveKey(R.int(0, step.keyMoment.choices.length - 1));
    }
    if (engine.phase !== 'done') engine.finish();
    if (engine.result.home === engine.result.away && (engine.fx.cupKO || engine.isCup)) engine.result.pens = Settlement.simPens(engine);
    ui.engine = engine;
    return Settlement.applyResult(ui, 'silent');
  }
  window.FootballSeasonSim = {
    get running() { return running; },
    cancel() { cancelRequested = true; },
    async run(options = {}) {
      if (running) throw Error('赛季模拟正在进行。');
      const d = State.data;
      if (!d || !d.player || !d.clubId || State.isNew) throw Error('请先进入生涯。');
      if (d.retired) throw Error('球员已经退役，无法模拟。');
      if (d.offseason || d._seasonSettled) throw Error('当前已在休赛期，请先开始新赛季。');
      if (d._seasonSimPendingCard || d._seasonSimPendingEvent) throw Error('请先完成待处理事件，再继续模拟。');
      if ((window.MatchUI && MatchUI.isRunning()) || (window.GameLoop && GameLoop.phase !== GameLoop.PHASES.WAITING)) throw Error('请先完成当前比赛或战报，再模拟赛季。');
      const initial = State._packSaveJson(), season = d.season, startDay = d.dayIndex;
      const baseline = {exp:d.expTotal||0,money:d.money||0,bonus:d.stats.bonusEarned||0,
        wage:d.stats.wageEarned||0,ovr:PlayerSystem.overall(d.player),injuryDays:d.injuryDays||0};
      localStorage.setItem('football_local_mod_backup', initial);
      running = true; cancelRequested = false;
      let matches = 0, events = 0, steps = 0, checkpoint = initial, complete = false, pauseReason='',injuries=0;
      const report = () => ({season, days:Math.max(0,State.data.dayIndex-startDay), matches, events, remaining:SeasonSystem.pendingFixtures(State).length, date:{...State.data.date}, cancelled:cancelRequested, complete,pauseReason,
        summary:{exp:(State.data.expTotal||0)-baseline.exp,money:(State.data.money||0)-baseline.money,
          bonus:(State.data.stats.bonusEarned||0)-baseline.bonus,wage:(State.data.stats.wageEarned||0)-baseline.wage,
          ovrBefore:baseline.ovr,ovrAfter:PlayerSystem.overall(State.data.player),injuries,injuryDays:State.data.injuryDays||0}});
      const handleEvent = event => {
        if (!event) return false;
        if (options.pauseOnChoices && event.choices?.length) {
          State.data._seasonSimPendingEvent=event;pauseReason=event.title||'生活抉择';return true;
        }
        resolveEvent(event);events++;return false;
      };
      const handleCard = (card,ctx) => {
        if(!card)return false;
        if(options.pauseOnChoices&&card.options?.length){State.data._seasonSimPendingCard={card,ctx:ctx||{}};pauseReason=card.title||'生涯抉择';return true;}
        EventCards.autoResolve(State,card);events++;return false;
      };
      try {
        if (d._stashedEvent) { const event=d._stashedEvent; delete d._stashedEvent; handleEvent(event); }
        while (!cancelRequested && !pauseReason) {
          const current = State.data;
          if (current.retired || Career.forcedRetirement(State)) break;
          if (current.season !== season || current.offseason) throw Error('赛季状态发生变化，模拟已停止。');
          checkpoint = State._packSaveJson();
          const fixture = SeasonSystem.fixtureToday(State);
          if (!fixture && !SeasonSystem.pendingFixtures(State).length) { complete = true; break; }
          if (++steps > 1200) throw Error('赛程超过模拟上限，请检查存档后重试。');
          if (fixture) {
            const result = simulateFixture(fixture);
            if (!result || result.retryPending) throw Error('本场比赛未完成结算。');
            matches++;
            if(result.injured)injuries++;
            if(current._stashedEvent){const event=current._stashedEvent;delete current._stashedEvent;handleEvent(event);}
            if (result.ecCtx && window.EventCards) {
              if (window.StarFavor) StarFavor.applyGlow(State, result.ecCtx);
              if (window.ClubEvents) ClubEvents.noteSilent(State, [result.ecCtx]);
              if(!pauseReason)handleCard(EventCards.silentPick(State, [result.ecCtx]),result.ecCtx);
            }
          } else {
            if (current.injuryDays <= 0) {const train=Training.dailyTrain(State);if(train.injured)injuries++;}
            const event = Career.advanceDay(State);
            handleEvent(event);
            Career.processMissedFixtures(State);
            if (!pauseReason && !current.retired && !current.offseason && window.EventCards) {
              const card = EventCards.rollDaily(State);
              handleCard(card);
            }
          }
          if (steps % 7 === 0 || fixture) saveProgress();
          if (options.onProgress) options.onProgress(report());
          await yieldFrame();
        }
        State.data._lastSeasonSimulation=report();
        saveProgress();
        return report();
      } catch (error) {
        // Restore the last complete day/match if an engine throws midway through settlement.
        State.data = JSON.parse(checkpoint);
        State._unpackLoaded(State.data);
        State.save(true);
        throw error;
      } finally {
        running = false;
        if (window.GameLoop) GameLoop.resetToWaiting();
      }
    }
  };
})();
