(function(){'use strict';
const launch=document.createElement('button');launch.id='lm-launch';launch.textContent='本地修改';document.body.appendChild(launch);
const panel=document.createElement('div');panel.id='lm-panel';panel.hidden=true;
panel.innerHTML='<section id="lm-card" role="dialog" aria-modal="true" aria-label="本地修改面板"><button id="lm-close">关闭</button><h2>本地修改面板</h2><p>创建人物并进入生涯后使用。修改前自动备份；能力和潜力上限 99。</p><label>资金<input id="lm-money" type="number" min="0" max="1000000000"></label><label>技能点<input id="lm-sp" type="number" min="0" max="99999"></label><details open><summary>经验与等级</summary><label>可用经验池<input id="lm-pool" type="number" min="0" max="1000000000"></label><label>球员等级<input id="lm-level" type="number" min="1" max="999"></label><label>本级已获经验<input id="lm-level-exp" type="number" min="0"></label><p id="lm-level-hint"></p><p>直接设定等级不额外发放升级奖励；经验池和技能点按填写值保存。</p></details><details><summary>位置熟练度</summary><p>0–100；只显示当前球员可踢的位置。留空保持原值。</p><div id="lm-mastery"></div><button id="lm-mastery-max" type="button">全部熟练度填为 100</button></details><details><summary>天赋与档位</summary><p>选择“未拥有”可移除天赋。即时能力与潜力加成按档位差额调整，不会重复叠加。</p><div id="lm-talents"></div><button id="lm-talents-max" type="button">已有天赋填为钻石</button></details><details><summary>能力与恢复</summary><label>所有能力设为<input id="lm-ability" type="number" min="1" max="99" placeholder="留空则不改"></label><label>所有潜力设为<input id="lm-potential" type="number" min="1" max="99" placeholder="留空则不改"></label><label><span>恢复伤病和士气</span><input id="lm-heal" type="checkbox"></label></details><button id="lm-apply">应用并保存</button><div class="lm-grid"><button id="lm-export">导出存档</button><button id="lm-import">导入存档</button><button id="lm-undo">撤回上次修改</button><button id="lm-refresh">读取当前数值</button></div><input id="lm-file" type="file" accept="application/json,.json" hidden><div id="lm-status" role="status"></div><p>本地存档保存在当前浏览器。广告奖励可直接领取且不限次数；线上排行榜与虎扑云存档不提供。</p></section>';
document.body.appendChild(panel);const el=id=>document.getElementById('lm-'+id),msg=s=>el('status').textContent=s;
function state(){if(!window.State||!State.data||!State.data.player||!State.data.clubId||State.isNew)throw Error('请先创建人物并进入生涯，再使用修改功能。');return State.data}
function backup(){const raw=State._packSaveJson();localStorage.setItem('football_local_mod_backup',raw);return raw}
function levelInfo(lv){
 const cfg=CONFIG.LEVEL||{},base=cfg.EXP_PER_LEVEL||80000,k=cfg.ESCALATION??.15;
 const cost=l=>l<=40?base:Math.round(base*(1+k*(l-40)));
 let total=0;for(let l=1;l<lv;l++)total+=cost(l);
 return {total,need:cost(lv),max:cfg.MAX||999,xpMax:lv===(cfg.MAX||999)?1e12-total:cost(lv)-1};
}
function levelHint(){try{const lv=number('level',1,CONFIG.LEVEL?.MAX||999),info=levelInfo(lv);el('level-exp').max=info.xpMax;el('level-hint').textContent=lv===info.max?'已达最高等级，可继续保留累计经验。':'本级经验范围：0–'+info.xpMax.toLocaleString('zh-CN')+'；升级所需 '+info.need.toLocaleString('zh-CN')+'。'}catch(e){el('level-hint').textContent=e.message}}
function positions(d){return Object.keys(CONFIG.POSITIONS||{}).filter(p=>!window.Pool||Pool.canCross(d.player.position,p))}
function refresh(){try{
 const d=state(),progress=Skills.levelProgressOf(d);
 el('money').value=d.money;el('sp').value=d.skillPoints??0;el('pool').value=d.expPool??0;
 el('level').max=CONFIG.LEVEL?.MAX||999;el('level').value=progress.lv;el('level-exp').value=progress.into;levelHint();
 el('ability').value='';el('potential').value='';el('heal').checked=false;
 el('mastery').replaceChildren();for(const p of positions(d)){
  const label=document.createElement('label'),name=document.createElement('span'),input=document.createElement('input');
  name.textContent=CONFIG.POSITIONS[p].name+' ('+p+')';input.id='lm-pos-'+p;input.type='number';input.min=0;input.max=100;input.step='any';input.value=window.Position?Position.masteryOf(d,p):(d.player.posMastery?.[p]??0);label.append(name,input);el('mastery').append(label);
 }
 el('talents').replaceChildren();for(const t of TAL.POOL){
  const label=document.createElement('label'),name=document.createElement('span'),select=document.createElement('select');name.textContent=t.name;select.id='lm-tal-'+t.id;
  for(const tier of ['',...TAL.TIER_ORDER]){const option=document.createElement('option');option.value=tier;option.textContent=tier?TAL.TIER[tier].name:'未拥有';select.append(option)}
  select.value=TAL.has(d,t.id)?TAL.tierOf(d,t.id):'';select.title=select.value?TAL.descOf(t.id,select.value):t.desc;select.onchange=()=>select.title=select.value?TAL.descOf(t.id,select.value):t.desc;label.append(name,select);el('talents').append(label);
 }
 msg('已读取：'+d.player.name);
}catch(e){msg(e.message)}}
function talentChanges(d){
 const attrs=d.player.attrs||{},delta={},potDelta={};let baseDelta=0;
 for(const t of TAL.POOL){
  const before=TAL.has(d,t.id)?TAL.tierOf(d,t.id):'',after=el('tal-'+t.id).value;
  if(after&&!TAL.TIER[after])throw Error('天赋档位无效');
  if(before===after)continue;
  const change=(after?t.vals[after]:0)-(before?t.vals[before]:0);
  if(t.onCreate==='attrs')for(const [id] of CONFIG.ATTRIBUTES[t.catTarget]||[])if(typeof attrs[id]==='number')delta[id]=(delta[id]||0)+change;
  if(t.onCreate==='allAttrs')for(const id of Object.keys(attrs))delta[id]=(delta[id]||0)+change;
  if(t.onCreate==='pot'){for(const id of Object.keys(d.player.pot||{}))if(typeof d.player.pot[id]==='number')potDelta[id]=(potDelta[id]||0)+change;baseDelta+=change;}
  d.talents=(d.talents||[]).filter(id=>id!==t.id);d.talentTiers=d.talentTiers||{};
  if(after){d.talents.push(t.id);d.talentTiers[t.id]=after}else delete d.talentTiers[t.id];
 }
 for(const id of Object.keys(delta))attrs[id]=Math.min(99,Math.max(1,attrs[id]+delta[id]));
 for(const id of Object.keys(potDelta))d.player.pot[id]=Math.min(99,Math.max(attrs[id]||1,d.player.pot[id]+potDelta[id]));
 if(baseDelta)d.player._potBase=Math.min(99,Math.max(1,(d.player._potBase||0)+baseDelta));
}
function number(id,min,max,optional){const v=el(id).value.trim();if(optional&&!v)return null;const n=Number(v);if(!v||!Number.isFinite(n)||n<min||n>max)throw Error('请输入有效数值：'+id+'（'+min+'–'+max+'）');return Math.floor(n)}
function download(raw,name){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function persist(){State.save(true);if(localStorage.getItem(State._lsMain())!==State._packSaveJson())throw Error('浏览器存档写入未确认，请导出存档备份。')}
launch.onclick=()=>{panel.hidden=false;refresh();el('close').focus()};el('close').onclick=()=>{panel.hidden=true;launch.focus()};panel.onclick=e=>{if(e.target===panel)el('close').click()};document.addEventListener('keydown',e=>{if(e.key==='Escape')el('close').click()});el('refresh').onclick=refresh;
el('level').oninput=levelHint;
el('mastery-max').onclick=()=>{el('mastery').querySelectorAll('input').forEach(input=>input.value=100)};
el('talents-max').onclick=()=>{el('talents').querySelectorAll('select').forEach(select=>{if(select.value){select.value='diamond';select.onchange()}})};
el('apply').onclick=()=>{let previous=null,raw=null;try{
 const original=state(),d=JSON.parse(JSON.stringify(original));
 const money=number('money',0,1e9),sp=number('sp',0,99999),pool=number('pool',0,1e9),lv=number('level',1,CONFIG.LEVEL?.MAX||999),info=levelInfo(lv),xp=number('level-exp',0,info.xpMax),ability=number('ability',1,99,true),pot=number('potential',1,99,true);
 const mastery={};for(const p of positions(d)){const input=el('pos-'+p);if(input.value.trim()){const value=Number(input.value);if(!Number.isFinite(value)||value<0||value>100)throw Error('位置熟练度必须为 0–100：'+p);mastery[p]=value;}}
 talentChanges(d);d.money=money;d.skillPoints=sp;d.expPool=pool;d.expTotal=info.total+xp;d.level=lv;delete d._levelUps;
 d.player.posMastery=Object.assign({},d.player.posMastery||{},mastery);
 const attrs=d.player.attrs||{};
 if(ability!==null)for(const k of Object.keys(attrs))attrs[k]=ability;
 if(pot!==null&&d.player.pot)for(const k of Object.keys(d.player.pot))if(typeof d.player.pot[k]==='number')d.player.pot[k]=pot;
 if(d.player.pot)for(const k of Object.keys(attrs))if(typeof d.player.pot[k]==='number')d.player.pot[k]=Math.max(d.player.pot[k],attrs[k]);
 if(el('heal').checked){d.injuryDays=0;d.morale=100}
 raw=backup();previous=original;State.data=d;persist();previous=null;
 if(window.Hub&&Hub.refresh)Hub.refresh(State);refresh();msg('修改已保存：等级 '+lv+'，经验池 '+pool.toLocaleString('zh-CN')+'。潜力不会低于当前能力。');
}catch(e){if(previous){State.data=previous;try{localStorage.setItem(State._lsMain(),raw)}catch(_){}}msg(e.message)}};
el('export').onclick=()=>{try{state();persist();download(State._packSaveJson(),'football-career-save.json');msg('已导出当前存档。')}catch(e){msg(e.message)}};
function validate(d){if(!d||Array.isArray(d)||d.meta?.dataset!=='real-v1'||!d.player||!d.clubId||!d.date||!Number.isFinite(d.money)||!d.player.attrs||typeof d.player.name!=='string')throw Error('这不是有效的本游戏生涯存档。');if(!window.teamById||!teamById(d.clubId))throw Error('存档俱乐部不存在。');return d}
function restore(raw){let d=validate(JSON.parse(raw));const old=State.data;try{State.data=d;State._unpackLoaded(d);State.isNew=false;persist()}catch(e){State.data=old;throw e}location.reload()}
el('import').onclick=()=>el('file').click();el('file').onchange=async()=>{const f=el('file').files[0];if(!f)return;try{if(f.size>25*1024*1024)throw Error('存档文件过大。');const raw=await f.text();validate(JSON.parse(raw));if(!confirm('导入将替换当前生涯，当前进度会先备份。继续？'))return;if(State.data?.player&&!State.isNew)backup();restore(raw)}catch(e){msg(e.message)}finally{el('file').value=''}};
el('undo').onclick=()=>{try{const raw=localStorage.getItem('football_local_mod_backup');if(!raw)throw Error('还没有修改备份。');validate(JSON.parse(raw));if(confirm('恢复修改前的存档？'))restore(raw)}catch(e){msg(e.message)}};
})();

// Keep legacy reward counters readable in the standalone unlimited edition.
(function () {
  if (window.Hub) Hub.adsTodayRows = function () {
    return '<div class="row"><span>网页版奖励</span><b>直接领取 · 不限次数</b></div>';
  };
  function wording(node) {
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), text;
    while ((text = walker.nextNode())) {
      var original = text.nodeValue;
      var value = original
        .replace(/本季剩(?:余)?\s*Infinity(?:\s*\/\s*\d+)?(?:\s*次)?/g, '不限次数')
        .replace(/每季\s*\d+\s*次/g, '不限次数')
        .replace(/Infinity\s*\/\s*\d+/g, '不限次数')
        .replace(/Infinity/g, '不限');
      if (value !== original) text.nodeValue = value;
    }
  }
  var root = document.getElementById('app');
  if (root) {
    wording(root);
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === 'characterData') wording(m.target.parentNode);
        else m.addedNodes.forEach(function (n) { if (n.nodeType === 1) wording(n); else if (n.nodeType === 3) wording(n.parentNode); });
      });
    }).observe(root, {childList:true, subtree:true, characterData:true});
  }
})();
