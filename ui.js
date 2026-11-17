(() => {
'use strict';
const $=id=>document.getElementById(id);
const {Game,TOWERS,ENEMIES,RESEARCH,PATH,PADS,TOTAL_WAVES=30,MAX_TOWER_LEVEL=8,MAX_RESEARCH_LEVEL=7,AFFINITIES={}}=TD;
const ICONS={
 coin:'<circle cx="12" cy="12" r="9"/><path d="M12 6v12m4-9h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/>',
 heart:'<path d="M12 21S2 15 2 8a5 5 0 0 1 10-1A5 5 0 0 1 22 8c0 7-10 13-10 13Z"/>',
 flag:'<path d="M5 22V3m0 1c5-5 9 5 15 0v11c-6 5-10-5-15 0"/>',
 sound:'<path d="m3 9 5 0 5-5v16l-5-5H3Zm14-1c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
 muted:'<path d="m3 9 5 0 5-5v16l-5-5H3Zm14 0 5 6m0-6-5 6"/>',
 book:'<path d="M12 5c-3-3-7-3-10-2v16c3-1 7-1 10 2 3-3 7-3 10-2V3c-3-1-7-1-10 2Zm0 0v16"/>',
 help:'<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 1 1 4 3c-1 1-1 2-1 3m0 3v1"/>',
 expand:'<path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6"/>',
 pause:'<path d="M8 4v16M16 4v16" stroke-width="3"/>',
 play:'<path d="m8 4 12 8-12 8Z"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 meteor:'<path d="m14 2-3 9M21 3l-8 8m9-3-9 5M10 8a7 7 0 1 0 6 7"/><circle cx="8" cy="16" r="2"/>',
 snow:'<path d="M12 2v20M3 7l18 10M3 17 21 7M8 4l4 3 4-3M8 20l4-3 4 3M3 11l5-1-1-5m14 8-5 1 1 5M3 13l5 1-1 5m14-8-5-1 1-5"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>'};
const icon=id=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]||ICONS.flag}</svg>`;
function icons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
icons();
const images={}; let imagesReady=false;
const svgURL=s=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);
const imageLoads=Object.entries(ART).map(([id,source])=>new Promise(resolve=>{const im=new Image();images[id]=im;im.onload=resolve;im.onerror=resolve;im.src=source.trimStart().startsWith('<')?svgURL(source):source;}));
const atlas=window.ANIMATION_ATLAS||{},atlasImages={};
for(const [id,def] of Object.entries(atlas))imageLoads.push(new Promise(resolve=>{const im=new Image();atlasImages[id]=im;im.onload=resolve;im.onerror=resolve;im.src=def.src;}));
const SRC=id=>images[id]?.src||'';
const canvas=$('battleCanvas'),ctx=canvas.getContext('2d');
const bg=document.createElement('canvas');bg.width=1000;bg.height=650;const b=bg.getContext('2d');
let game=new Game(), selectedType='archer',selectedTower=null,selectedEnemy=null,selectedSpell=null,paused=false,speed=1,showRanges=false,started=false;
let lastPhase=game.phase,modalType=null,previousFocus=null,toastTimer,bannerTimer,hoverPad=-1,savedData=null,lastReward=0;
let frameTime=0,visualTime=0,uiTick=0,shake=0,dirty=true,backgroundReady=false,cursorPoint=null;
let view={scale:1,x:0,y:0,width:1000,height:650,dpr:1};
let zoom=1,panX=0,panY=0,gesture=null,pinch=null;const pointers=new Map();
const particles=[],floatTexts=[],deaths=[],guardVisuals=new Map();
let pendingOutcome=null,renderDelta=0,animationPreview='walk',previewClock=0;
const storageKey='elderholm-save-v1';
let storageAvailable=true;
try{savedData=JSON.parse(localStorage.getItem(storageKey)||'null');if(![1,2].includes(savedData?.v))savedData=null;else savedData=Game.restore(savedData).serialize();}catch{storageAvailable=false;}
const audio={ctx:null,enabled:false,preference:true,nextNote:0,note:0,last:{},music:null,musicPending:false,musicWanted:false,musicBlocked:false,musicError:null,trackIndex:0,
 init(){
 this.musicBlocked=false;
 try{if(!this.ctx)this.ctx=new(window.AudioContext||window.webkitAudioContext)();this.ctx.resume().catch(()=>{});}catch{}
 if(!this.music&&window.EMBEDDED_PLAYLIST?.length){
  const music=new Audio(window.EMBEDDED_PLAYLIST[0].src);music.id='backgroundMusic';music.hidden=true;music.loop=false;music.volume=.24;music.preload='metadata';music.title=window.EMBEDDED_PLAYLIST[0].title;
  music.addEventListener('ended',()=>{this.trackIndex=(this.trackIndex+1)%window.EMBEDDED_PLAYLIST.length;const track=window.EMBEDDED_PLAYLIST[this.trackIndex];music.src=track.src;music.title=track.title;this.musicBlocked=false;this.syncMusic();});
  music.addEventListener('error',()=>{this.musicError=music.error?.code||'media-error';this.musicBlocked=true;});
  document.body.appendChild(music);this.music=music;
 }
},
 syncMusic(){
  const music=this.music;if(!music)return;
  this.musicWanted=this.enabled&&started&&!paused&&!document.hidden;
  if(!this.musicWanted){if(!music.paused)music.pause();return;}
  if(!music.paused||this.musicPending||this.musicBlocked)return;
  this.musicPending=true;
  music.play().then(()=>{this.musicPending=false;this.musicError=null;if(!this.musicWanted)music.pause();}).catch(error=>{this.musicPending=false;if(error.name!=='AbortError'){this.musicError=error.name;this.musicBlocked=true;}});
 },
 tone(freq,duration=.15,type='sine',volume=.035,slide=0){if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,osc=c.createOscillator(),gain=c.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,c.currentTime);if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide),c.currentTime+duration);gain.gain.setValueAtTime(0,c.currentTime);gain.gain.linearRampToValueAtTime(volume,c.currentTime+.012);gain.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);osc.connect(gain);gain.connect(c.destination);osc.start();osc.stop(c.currentTime+duration+.02);},
 noise(duration=.15,volume=.04){if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,buf=c.createBuffer(1,c.sampleRate*duration,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);const src=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();filter.type='lowpass';filter.frequency.value=1800;gain.gain.value=volume;src.buffer=buf;src.connect(filter);filter.connect(gain);gain.connect(c.destination);src.start();},
 event(type,tower){const now=performance.now();if(now-(this.last[type]||0)<(type==='hit'?130:type==='shoot'?95:40))return;this.last[type]=now;if(type==='shoot'){if(tower==='mortar'){this.tone(90,.19,'triangle',.025,-40);this.noise(.1,.018);}else this.tone(tower==='arcane'?560:tower==='frost'?850:460,.09,'triangle',.018,-180);}else if(type==='hit')this.tone(180,.055,'triangle',.009,-50);else if(type==='build'||type==='upgrade'||type==='enchant'){[330,440,660].forEach((f,i)=>setTimeout(()=>this.tone(f,.2,'triangle',.025),i*70));}else if(type==='reward'||type==='research'){[392,494,587,784].forEach((f,i)=>setTimeout(()=>this.tone(f,.3,'sine',.045),i*100));}else if(type==='wave'||type==='boss'){this.tone(110,.65,'sawtooth',.025,-25);this.tone(165,.7,'triangle',.04);}else if(type==='leak'){this.tone(190,.4,'sawtooth',.035,-95);}else if(type==='cast'){this.noise(.5,.1);this.tone(400,.6,'triangle',.05,-330);}else if(type==='victory'){[262,330,392,523,659].forEach((f,i)=>setTimeout(()=>this.tone(f,.7,'triangle',.05),i*180));}else if(type==='defeat'){this.tone(196,1,'triangle',.045,-80);this.tone(147,1.2,'sine',.06,-60);}},
 tick(t){this.syncMusic();if(this.music)return;if(!this.enabled||paused||!started||document.hidden||t<this.nextNote)return;this.nextNote=t+.7;const notes=[146.83,220,293.66,329.63,220,196,293.66,440,329.63,220,196,164.81];this.tone(notes[this.note++%notes.length],1.3,'sine',.013);if(this.note%4===0)this.tone(73.42,2.4,'triangle',.009);}
};
try{audio.preference=localStorage.getItem('elderholm-sound')!=='off';}catch{}
function syncSound(){const btn=$('soundBtn');btn.innerHTML=icon(audio.enabled?'sound':'muted');btn.classList.toggle('active',audio.enabled);btn.setAttribute('aria-label',audio.enabled?'Выключить музыку и звуки':'Включить музыку и звуки');btn.title=(audio.enabled?'Выключить':'Включить')+' музыку и звуки · M';audio.syncMusic();}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000);}
function banner(title,desc=''){const el=$('waveBanner');el.querySelector('strong').textContent=title;el.querySelector('div').textContent=desc;el.classList.add('show');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>el.classList.remove('show'),3300);}
function save(checkpoint=false){if(game.phase==='wave'&&!checkpoint)return;try{const data=game.serialize();if(game.phase==='wave')data.wave=Math.max(0,data.wave-1);localStorage.setItem(storageKey,JSON.stringify(data));storageAvailable=true;$('saveStatus').textContent='ПРОГРЕСС СОХРАНЁН';}catch{storageAvailable=false;$('saveStatus').textContent='СОХРАНЕНИЕ НЕДОСТУПНО';}}
function showModal(type,html){if(!modalType)previousFocus=document.activeElement;modalType=type;$('modal').innerHTML=html;$('modalBackdrop').hidden=false;icons($('modal'));requestAnimationFrame(()=>($('modal').querySelector('button:not([disabled])')||$('modal')).focus());}
function closeModal(){modalType=null;$('modalBackdrop').hidden=true;previousFocus?.focus?.();}
const closeButton=()=>`<button class="icon-btn modal-close" data-action="close-modal" aria-label="Закрыть" data-icon="close"></button>`;
function showIntro(){
 const resume=savedData&&savedData.phase!=='defeat'&&savedData.phase!=='victory'&&(savedData.wave>0||savedData.towers?.length);
 showModal('intro',`<div class="intro-hero"><img src="${SRC('castle')}" alt="Замок Эльдерхольма"><div><div class="eyebrow">Хроники северного королевства</div><h1 id="modalTitle">Последний<br>рубеж</h1><div class="intro-copy">Тьма идёт к Эльдерхольму.<br>Пусть каждый камень станет щитом.</div></div></div><p>Возведите оборону, объедините сталь и магию и переживите тридцать волн. Боссы осаждают постройки, а стихии решают исход схваток. После каждой победы вы решаете, каким станет ваше королевство.</p><div class="intro-features"><div><b>30 волн</b><small>6 осад боссов · финал на 30-й</small></div><div><b>8 уровней</b><small>специализации, прочность и ремонт</small></div><div><b>5 путей</b><small>по 7 рангов · стихийные уязвимости</small></div></div><div class="intro-actions">${resume?`<button class="primary" data-action="resume">Продолжить · волна ${Math.min(TOTAL_WAVES,savedData.wave+1)} ${icon('arrow')}</button>`:''}<button class="${resume?'secondary':'primary'}" data-action="new-game">${resume?'Новый поход':'Защитить королевство'} ${resume?'':icon('arrow')}</button></div><div class="intro-foot">Мышь или касание · Работает без интернета · Звук включается при старте</div>`);
}
function beginGame(resume=false){game=resume?Game.restore(savedData):new Game();started=true;paused=false;deaths.length=0;particles.length=0;floatTexts.length=0;guardVisuals.clear();pendingOutcome=null;selectedTower=null;selectedEnemy=null;selectedSpell=null;selectedType='archer';lastPhase=game.phase;closeModal();audio.init();audio.enabled=audio.preference;syncSound();save();dirty=true;renderUI();if(game.phase==='research')showResearch();else if(game.phase==='victory'||game.phase==='defeat')showResult();else banner(resume?'С возвращением, командир':'Королевству нужна ваша защита',resume?'Продолжите подготовку обороны':'Постройте первые башни до начала волны');}
function showResearch(){
 const cards=Object.entries(RESEARCH).map(([id,d])=>{const lv=game.research[id];return `<button class="research-card" data-action="research" data-id="${id}" ${lv>=MAX_RESEARCH_LEVEL?'disabled':''} style="--r:${d.color}"><span class="r-icon" style="color:${d.color}">${d.icon}</span><h3>${d.name}</h3><p>${d.description}</p><small>${lv>=MAX_RESEARCH_LEVEL?'МАКСИМУМ':`${lv} → ${lv+1}<br>уровень`}</small></button>`;}).join('');
 showModal('research',`<div class="eyebrow">Военный совет · волна ${game.wave} завершена</div><h2 id="modalTitle">Каким станет королевство?</h2><div class="reward-tag">${lastReward?`+${lastReward} ◈ в казну`:'Победа за нами'}</div><p>Выберите одно направление. Эффект действует до конца похода. Школа магии открывает зачарование построек: стихию нужно нанести за золото.</p><div class="research-cards">${cards}</div><div class="intro-foot">Каждое решение даёт дополнительное золото на восстановление обороны.</div>`);
}
function showCodex(tab='towers'){previewClock=0;if(tab==='towers'&&animationPreview==='die')animationPreview='attack';
 if(game.phase==='wave')paused=true;$('pausedShade').hidden=!paused;
 const tabs=[['towers','Арсенал'],['enemies','Противники'],['bosses','Владыки'],['affinities','Стихии'],['allies','Королевство']];
 let entries=tab==='affinities'?Object.entries(AFFINITIES).map(([id,d])=>['affinity-'+id,{...d,affinityKey:id,desc:d.description}]):tab==='towers'?Object.entries(TOWERS):tab==='allies'?[['castle',{name:'Ворота Эльдерхольма',desc:'Последний рубеж королевства. Защитите ворота от армии тьмы.'}],['guard',{name:'Королевский страж',desc:'Воин казармы. Задерживает наземных противников и сражается на дороге.'}]]:Object.entries(ENEMIES).filter(([id,d])=>tab==='bosses'?d.boss:!d.boss);
 const cards=entries.map(([id,d])=>`<figure class="codex-card ${d.boss?'boss-card':''}"><div class="codex-portrait">${d.affinityKey?`<span class="affinity-emblem" style="color:${d.color}">${d.icon||elementIcon[d.affinityKey]}</span>`:atlas[id]?`<canvas width="192" height="224" data-sprite="${id}" aria-label="${d.name}: анимация"></canvas>`:`<img src="${SRC(id)}" alt="${d.name}">`}</div><figcaption><h3>${d.name}</h3><p>${d.desc||enemyDescription(id,d)}</p>${ENEMIES[id]?`<div class="trait-list">${traitTags(id)}</div>`:d.affinityKey?`<div class="trait-list">${traitTags({type:'raider',affinity:d.affinityKey})}</div>`:''}</figcaption></figure>`).join('');
 showModal('codex',`${closeButton()}<div class="eyebrow">Иллюстрированные хроники</div><h2 id="modalTitle">Атлас Эльдерхольма</h2><p>Зелёные метки — повышенный урон, красные — сопротивление. Состав обороны важнее одной сильной башни.</p><nav class="codex-tabs">${tabs.map(([id,title])=>`<button class="${id===tab?'active':''}" data-action="codex-tab" data-id="${id}">${title}</button>`).join('')}</nav>${Object.keys(atlas).length&&tab!=='affinities'?`<div class="animation-tabs"><span>Анимация:</span>${[['walk',tab==='towers'?'Работа':'Движение'],['attack','Атака'],['die','Смерть']].filter(([id])=>id!=='die'||entries.some(([key])=>atlas[key]?.states.die)).map(([id,label])=>`<button class="${animationPreview===id?'active':''}" data-action="animation-preview" data-id="${id}">${label}</button>`).join('')}</div>`:''}<div class="codex-grid">${cards}</div>`);
}
function showHelp(){if(game.phase==='wave')paused=true;showModal('help',`${closeButton()}<div class="eyebrow">Полевой справочник</div><h2 id="modalTitle">Искусство обороны</h2><p>Не пытайтесь победить одной башней. Замедление, массовый урон и пробивание брони вместе сильнее любой отдельной постройки.</p><div class="help-grid"><div><h3>1. Подготовьте рубеж</h3><p>Выберите постройку внизу, затем круг с «+» на карте. Подсвеченная окружность показывает дальность. Кнопка «+» вверху поля увеличивает карту; перетаскивайте её или меняйте масштаб двумя пальцами. Ловушки размещаются на ближайшей дороге. Строительство доступно и во время боя. Улучшать готовые постройки и менять их стихию можно и во время боя.</p></div><div><h3>2. Найдите сочетание</h3><p>Лучники — быстрые цели; мортира — группы; лёд — контроль. Аркана пробивает броню. Стража задерживает пехоту, ловушки отравляют или замедляют. Мортира, стража и ловушки не бьют летунов. Против них нужны лучники, лёд или аркана.</p></div><div><h3>3. Развивайтесь</h3><p>Нажмите на готовую башню, чтобы выбрать уникальную ветку II уровня. Уровни III–VIII усиливают ветку и открывают новые свойства на IV, VI и VIII. После волны развивайте гвардию, экономику или школу магии. Улучшения построек и зачарования доступны и во время волны.</p></div><div><h3>4. Сохраните ворота</h3><p>Метеор наносит урон области за 55 ◈, стужа замедляет всех за 40 ◈. Заклинания перезаряжаются. Босс отнимает 5 прочности. Босс приходит каждую пятую волну и атакует здания: перед ударом появится красная метка. Последнего владыку на 30-й волне нужно уничтожить.</p></div></div><div class="note">После осады ремонтируйте повреждённые здания между волнами. Стихию орудия можно менять за золото. Уязвимости и сопротивления видны в атласе, а состав следующей волны — под её прогнозом.</div><div class="help-keys"><span>1–6 · постройки</span><span>Q · метеор</span><span>E · стужа</span><span>Пробел · пауза</span><span>Enter · волна</span><span>Esc · отмена</span><span>M · звук</span><span>F · полный экран</span></div><div class="note">Прогресс сохраняется между волнами. Если закрыть игру во время боя, вы вернётесь к подготовке этой волны.</div>`);$('pausedShade').hidden=!paused;}
function showPause(){if(!started)return;paused=true;$('pausedShade').hidden=false;showModal('pause',`<div class="result"><div class="eyebrow">Королевство ждёт</div><h2 id="modalTitle">Привал у костра</h2><p class="description">Оборона сохранена перед текущей волной.</p><div class="pause-actions"><button class="primary" data-action="unpause">Продолжить ${icon('play')}</button><button class="secondary" data-action="codex">Атлас королевства</button><button class="secondary" data-action="help">Полевой справочник</button><button class="secondary" data-action="confirm-restart">Начать новый поход</button></div></div>`);}
function showResult(){const won=game.phase==='victory';audio.event(won?'victory':'defeat');showModal('result',`<div class="result"><div class="result-emblem">${won?'♜':'♛'}</div><div class="eyebrow">${won?'Хроники славной победы':'Последняя запись летописца'}</div><h1 id="modalTitle">${won?'Эльдерхольм выстоял':'Ворота пали'}</h1><p>${won?'Король Пепла повержен. Сталь, магия и ваша стратегия защитили королевство.':'Тьма взяла этот рубеж. Измените сочетание построек, усилите контроль и возвращайтесь.'}</p><div class="result-stats"><div><b>${game.stats.wavesWon}</b><small>ВОЛН ОТБИТО</small></div><div><b>${game.kills}</b><small>ВРАГОВ ПОБЕЖДЕНО</small></div><div><b>${game.towers.length}</b><small>ПОСТРОЕК</small></div></div><div class="intro-actions"><button class="primary" data-action="new-game">Новый поход ${icon('arrow')}</button><button class="secondary" data-action="inspect">Осмотреть поле</button></div></div>`);}
const elementLabel={fire:'Огонь',frost:'Холод',storm:'Молния',arcane:'Аркана',physical:'Сталь',poison:'Яд'};
const elementIcon={fire:'♨',frost:'❄',storm:'ϟ',arcane:'✦',physical:'⚔',poison:'✺'};
const roman=['','I','II','III','IV','V','VI','VII','VIII','IX','X'];
const multiplier=n=>'×'+Number(n).toFixed(2).replace(/0$/,'').replace(/\.0$/,'').replace('.',',');
function traitTags(entity){const traits=game.getEnemyTraits?.(entity);if(!traits)return '';return [...traits.weaknesses.map(t=>`<span class="trait weak">${elementIcon[t.element]||'✦'} ${elementLabel[t.element]||t.element} ${multiplier(t.multiplier)}</span>`),...traits.resistances.map(t=>`<span class="trait resist">${elementIcon[t.element]||'✦'} ${elementLabel[t.element]||t.element} ${multiplier(t.multiplier)}</span>`)].join('');}
function enemyDescription(id,d){return (d.boss?'Осаждает и разрушает здания. ':d.fly?'Летает: мортира, стража и ловушки не достают. ':d.heal?'Исцеляет противников поблизости. ':'')+(d.armor?'Броня '+Math.round(d.armor*100)+'%. ':'')+(d.boss?'На каждой пятой волне сила владык растёт.':'');}
const roleLabel={archer:'Быстрые цели',mortar:'Массовый урон',frost:'Замедление',barracks:'Оборона пути',arcane:'Против брони',trap:'Руны на дороге'};
const tips={archer:'Расположите на изгибе: лучники успеют сделать больше выстрелов. Залп хорош против толпы.',mortar:'Наземные группы в паре со льдом. Летающие враги не получают урон от мортиры даже во взрыве.',frost:'Контроль увеличивает время, в течение которого все остальные башни наносят урон.',barracks:'Поставьте у дороги. Стражи задерживают пехоту, но не могут остановить летающих врагов.',arcane:'Броня големов и рыцарей плохо защищает от магии. Ветка «Казнь» добивает сильные цели.',trap:'Руна ляжет на ближайший участок дороги. Летуны не запускают ловушки.'};
function updateSidebar(){
 const enemy=game.enemies.find(e=>e.id===selectedEnemy);
 if(enemy){
  const d=ENEMIES[enemy.type];$('sideMode').textContent='ПРОТИВНИК';
  $('sideBody').innerHTML=`<div class="selection-title"><img src="${SRC(enemy.type)}" alt=""><div><small>${enemy.fly?'ЛЕТАЮЩИЙ':'НАЗЕМНЫЙ'}${d.boss?' · БОСС':''}</small><h2>${enemy.name||d.name}</h2></div></div><div class="structure-health"><div><span>Здоровье</span><strong>${Math.ceil(enemy.hp)} / ${Math.ceil(enemy.maxHp)}</strong></div><div class="structure-bar"><i style="width:${Math.max(0,enemy.hp/enemy.maxHp*100)}%"></i></div></div><p class="description">${enemyDescription(enemy.type,d)}</p><div class="subhead">СТИХИЙНЫЕ СВОЙСТВА</div><div class="trait-list">${traitTags(enemy)||'<span class="description">Нет стихийных особенностей</span>'}</div><div class="note">Зелёное — уязвимость, красное — сопротивление. Множитель применяется к урону выбранной стихии.</div><button class="secondary enemy-back" data-action="enemy-back">К обороне</button>`;return;
 }
 const tower=game.towers.find(t=>t.id===selectedTower),type=tower?.type||selectedType,d=TOWERS[type];
 $('sideMode').textContent=tower?'ПОСТРОЙКА':'СТРОИТЕЛЬСТВО';if(!d)return;
 const preview=tower||{type,level:1,branch:null,element:null},stats=game.getTowerStats(preview);
 const hp=tower?.hp??stats.maxHp??0,maxHp=tower?.maxHp??stats.maxHp??0;
 let html=`<div class="selection-title"><img src="${SRC(type)}" alt=""><div><small>${tower?`УРОВЕНЬ ${roman[tower.level]||tower.level} / VIII${tower.element?` · ${elementLabel[tower.element]}`:''}`:roleLabel[type].toUpperCase()}</small><h2>${d.name}</h2></div></div>`;
 if(tower){
  const refund=game.getSellValue?.(tower)??Math.floor((tower.spent||d.cost)*.62*(maxHp?Math.max(0,hp)/maxHp:1));
  html+=`<div class="tower-sale"><button class="sell" data-action="sell" ${game.phase!=='build'?'disabled':''}>Продать <span>+${refund} ◈</span></button></div>`;
  const damage=hp<maxHp-.5,repair=damage?(game.getRepairCost?.(tower)??0):0;
  html+=`<div class="structure-health"><div><span>Прочность</span><strong>${Math.ceil(hp)} / ${Math.ceil(maxHp)}</strong></div><div class="structure-bar"><i style="width:${Math.max(0,Math.min(100,hp/maxHp*100))}%"></i></div>${damage?`<button class="repair" data-action="repair" ${game.phase!=='build'||game.gold<repair?'disabled':''}>Ремонт <span>${repair} ◈</span></button>${game.phase!=='build'?'<small>Ремонт доступен после волны</small>':''}`:''}</div>`;
 }
 html+=`<p class="description">${d.desc}</p><div class="stats"><div class="stat"><b>${Math.round(stats.damage)}</b><small>УРОН</small></div><div class="stat"><b>${Math.round(stats.range)}</b><small>РАДИУС</small></div><div class="stat"><b>${stats.rate.toFixed(1)} с</b><small>ПЕРЕЗАРЯДКА</small></div></div>`;
 if(tower){
  const options=game.getUpgradeOptions(tower);html+=`<div class="subhead">${tower.level>=MAX_TOWER_LEVEL?'ВЕРШИНА МАСТЕРСТВА':tower.level===1?'ВЫБЕРИТЕ СПЕЦИАЛИЗАЦИЮ':`УЛУЧШИТЬ ДО ${roman[tower.level+1]||tower.level+1}`}</div>`;
  if(options.length)html+=options.map(option=>`<button class="upgrade" data-action="upgrade" data-id="${option.id}" ${!['build','wave'].includes(game.phase)||game.gold<option.cost?'disabled':''}><span><strong>${option.name}</strong><small>${option.description}</small></span><span class="cost">${option.cost} ◈</span></button>`).join('');
  else html+='<p class="description">VIII уровень · все свойства специализации открыты.</p>';
  const enchantCost=game.getEnchantCost(tower);html+=`<div class="subhead">${tower.element?'СМЕНИТЬ СТИХИЮ':'ЗАЧАРОВАТЬ'} · ${enchantCost} ◈</div><div class="enchant-row">${['fire','frost','storm'].map(element=>`<button class="${tower.element===element?'active':''}" data-action="enchant" data-id="${element}" ${tower.element===element||!game.research[element]||!['build','wave'].includes(game.phase)||game.gold<enchantCost?'disabled':''} title="${!game.research[element]?'Изучите школу магии':elementLabel[element]}">${elementIcon[element]} ${elementLabel[element]}</button>`).join('')}</div>`;
  if(!game.research.fire&&!game.research.frost&&!game.research.storm)html+='<div class="note">Изучите школу после волны, чтобы открыть зачарование.</div>';
  else if(tower.element)html+=`<div class="note">${elementLabel[tower.element]} · школа ${game.research[tower.element]}/${MAX_RESEARCH_LEVEL}. Сверяйтесь с уязвимостью следующей волны.</div>`;
 }else{
  html+=`<div class="subhead">ВЛИЯНИЕ КОРОЛЕВСТВА</div><div class="branch-mini"><div><b>${game.research.military}</b><small>ГВАРДИЯ</small></div><div><b>${game.research.fire+game.research.frost+game.research.storm}</b><small>МАГИЯ</small></div><div><b>${game.research.economy}</b><small>ЭКОНОМИКА</small></div></div><div class="note">${game.phase==='wave'?'Остерегайтесь меток осады: боссы могут разрушить здания.':tips[type]}</div>`;
 }
 $('sideBody').innerHTML=html;
}
function renderUI(){
 const gold=Math.floor(game.gold);$('gold').textContent=gold>=10000?(gold/1000).toFixed(gold<100000?1:0).replace('.0','')+'k':gold;$('gold').parentElement.parentElement.title=`Казна: ${gold} золотых`;
 $('lives').textContent=game.lives;$('wave').innerHTML=`${game.wave}<span style="font-size:12px;color:#8ba18f"> / ${game.autoWaves?'∞':TOTAL_WAVES}</span>`;
 const chapter=Math.min(9,Math.floor(Math.max(0,game.wave-1)/10));const names=['Сумеречная долина','Нашествие легиона','Огненная граница','Ледяные пределы','Гроза над лесом','Век железа','Пепельные земли','Разлом древних','Последняя осада','Корона Пепла'];
 document.querySelector('.chapter-no').textContent=roman[chapter+1];$('chapterTag').textContent=`Глава ${chapter+1} · волны ${chapter*10+1}–${(chapter+1)*10}`;$('location').textContent=names[chapter];
 $('campaignProgress').innerHTML=Array.from({length:TOTAL_WAVES/5},(_,i)=>`<span class="${game.stats.wavesWon>=(i+1)*5?'done ':''}${(i+1)%5===0?'boss ':''}${Math.ceil(game.wave/5)===i+1&&game.phase==='wave'?'current':''}" title="Волны ${i*5+1}–${(i+1)*5}"></span>`).join('');
 $('campaignLabel').textContent=game.phase==='wave'?`ВОЛНА ${game.wave}/${game.autoWaves?'∞':TOTAL_WAVES} · ВРАГОВ: ${game.enemies.length+game.queue.length}`:(game.wave>=TOTAL_WAVES&&!game.autoWaves)?'ПОХОД ЗАВЕРШЁН':`ДАЛЕЕ: ${game.wave+1}/${game.autoWaves?'∞':TOTAL_WAVES} · ${(game.wave+1)%5===0?'ОСАДА БОССА':'ПОДГОТОВЬТЕ РУБЕЖ'}`;
 $('buildings').innerHTML=Object.entries(TOWERS).map(([id,d],i)=>`<button class="build-card ${selectedType===id&&!selectedTower&&!selectedEnemy&&!selectedSpell?'active':''}" data-action="select-build" data-id="${id}" aria-label="${d.name}, ${game.getBuildCost(id)} золота" aria-pressed="${selectedType===id&&!selectedTower&&!selectedEnemy&&!selectedSpell}"><span class="key">${i+1}</span><img src="${SRC(id)}" alt=""><span><b>${d.short}</b><small class="role">${roleLabel[id]}</small><span class="price">${game.getBuildCost(id)} ◈</span></span></button>`).join('');
 const info=TD.getWaveInfo(game.phase==='wave'?game.wave:game.wave+1),enemy=info.boss||info.enemies.at(-1),affinity=AFFINITIES[info.affinity];
 $('forecast').innerHTML=`<img src="${SRC(enemy)}" alt=""><div><strong>${info.boss?'Босс осаждает здания':game.phase==='wave'?'Оборона рубежа':'Следующая волна'}</strong><small>${info.boss?ENEMIES[info.boss].name:`${info.count} врагов · ${ENEMIES[enemy].name}`}</small></div>`;
 const forecastOpen=$('waveTraits').querySelector('details')?.open;
 $('waveTraits').innerHTML=`${affinity?`<div class="wave-affinity" style="--affinity:${affinity.color}">${affinity.icon||elementIcon[info.affinity]} ${info.boss?'Сопровождение: ':''}${affinity.name}</div>`:''}${info.enemies.some(id=>ENEMIES[id]?.fly)||ENEMIES[info.boss]?.fly?'<div class="air-warning">✧ Есть летуны · мортира не достаёт</div>':''}<details class="forecast-details" ${forecastOpen?'open':''}><summary>Состав и уязвимости</summary><p>${info.description}</p>${info.boss?`<p>${info.count} сопровождающих: ${info.enemies.map(id=>ENEMIES[id].name).join(', ')}.</p>`:''}${affinity?`<p>${affinity.description}</p>`:''}<p>${info.tips||'Сочетайте разные орудия, берегите здания от осады.'}</p>${info.boss?`<div class="trait-list">${traitTags(info.boss)}</div>`:''}</details>`;
 const damaged=game.towers.filter(t=>t.hp<t.maxHp-.5),repairTotal=damaged.reduce((total,t)=>total+(game.getRepairCost?.(t)||0),0),repairAll=$('repairAllBtn');repairAll.hidden=game.phase!=='build'||!damaged.length;repairAll.disabled=game.gold<repairTotal;repairAll.textContent=`Ремонт всех (${damaged.length}) · ${repairTotal} ◈`;
 const wb=$('waveBtn');wb.disabled=game.phase==='wave'||(game.phase==='build'&&(game.wave>=TOTAL_WAVES&&!game.autoWaves));wb.innerHTML=game.phase==='wave'?`Идёт волна ${game.wave}…`:game.phase==='research'?`Совет королевства ${icon('arrow')}`:['victory','defeat'].includes(game.phase)?`Итоги похода ${icon('flag')}`:(game.wave>=TOTAL_WAVES&&!game.autoWaves)?'Поход завершён':`Начать волну ${game.wave+1} ${icon('arrow')}`;
 $('mapCaption').textContent=game.phase==='wave'?`ВОЛНА ${game.wave}/${game.autoWaves?'∞':TOTAL_WAVES} · ОБОРОНА РУБЕЖА`:game.phase==='research'?'ВОЛНА ОТБИТА · СОВЕТ КОРОЛЕВСТВА':game.phase==='victory'?'КОРОЛЕВСТВО СПАСЕНО':game.phase==='defeat'?'ВОРОТА ПАЛИ':'ПОДГОТОВКА ОБОРОНЫ';
 $('mapHint').textContent=selectedSpell?selectedSpell==='meteor'?'Выберите область удара · 55 ◈':'Нажмите на поле: стужа по всем врагам · 40 ◈':selectedEnemy?'Выбран противник · Уязвимости в панели':game.phase==='wave'?(selectedTower?'Улучшайте башню и меняйте стихию прямо в бою':'Выберите постройку и площадку · На башню — улучшения'):selectedTower?'Выбрано здание · улучшения, стихия и ремонт в панели':'Выберите постройку → нажмите на круг с «+»';
 $('autoWaves').checked=game.autoWaves;$('speedBtn').textContent=speed+'×';$('zoomBtn').textContent=zoom>1?'−':'＋';$('zoomBtn').setAttribute('aria-label',zoom>1?'Уместить всё поле':'Увеличить поле');$('rangeBtn').classList.toggle('active',showRanges);
 ['meteor','freeze'].forEach(id=>{const button=$(id+'Btn'),cooldown=game.spellCooldowns[id],label=button.querySelector('.cooldown');button.classList.toggle('selected',selectedSpell===id);label.hidden=cooldown<=0;label.style.display=cooldown>0?'grid':'none';label.textContent=Math.ceil(cooldown);button.style.opacity=game.phase==='wave'?'1':'.6';});
 updateSidebar();dirty=false;
}
function act(result){if(result?.message)toast(result.message);if(result?.ok){if(game.phase!=='wave')save();dirty=true;}return result?.ok;}
function pickBuild(type){selectedType=type;selectedTower=null;selectedEnemy=null;selectedSpell=null;dirty=true;}
function startWave(){if(!started)return;if(game.phase==='research'){showResearch();return;}if(game.phase==='defeat'||game.phase==='victory'){showResult();return;}if(game.phase!=='build')return;if(!game.towers.length){toast('Постройте хотя бы одну башню на круге с «+».');return;}save();if(act(game.startWave())){selectedSpell=null;dirty=true;}}
function selectSpell(type){if(!started)return;if(game.phase!=='wave'){toast('Заклинания доступны во время боя.');return;}if(game.spellCooldowns[type]>0){toast('Заклинание восстанавливается.');return;}if(game.gold<(type==='meteor'?55:40)){toast('В казне недостаточно золота для заклинания.');return;}selectedSpell=selectedSpell===type?null:type;selectedTower=null;selectedEnemy=null;dirty=true;}
function handleAction(e){const btn=e.target.closest('[data-action]');if(!btn||btn.disabled)return;const {action,id}=btn.dataset;
 if(action==='new-game')beginGame();else if(action==='resume')beginGame(true);else if(action==='select-build')pickBuild(id);else if(action==='research'){if(act(game.chooseResearch(id))){closeModal();banner('Новая глава королевства',RESEARCH[id].name);if(game.autoWaves)startWave();}}else if(action==='upgrade'){act(game.upgrade(selectedTower,id));}else if(action==='enchant')act(game.enchant(selectedTower,id));else if(action==='repair')act(game.repair(selectedTower));else if(action==='repair-all'){let count=0,spent=0;for(const t of [...game.towers]){const cost=game.getRepairCost(t);if(cost){const result=game.repair(t.id);if(result.ok){count++;spent+=cost;}}}if(count){save();dirty=true;toast(`Восстановлено: ${count} · потрачено ${spent} ◈`);}}else if(action==='enemy-back'){selectedEnemy=null;dirty=true;}else if(action==='sell'){if(act(game.sell(selectedTower)))selectedTower=null;}else if(action==='close-modal'){closeModal();if(paused){paused=false;$('pausedShade').hidden=true;}}else if(action==='unpause'){paused=false;$('pausedShade').hidden=true;closeModal();}else if(action==='help')showHelp();else if(action==='codex')showCodex();else if(action==='codex-tab')showCodex(id);else if(action==='animation-preview'){animationPreview=id;previewClock=0;$('modal').querySelectorAll('[data-action="animation-preview"]').forEach(b=>b.classList.toggle('active',b.dataset.id===id));}else if(action==='inspect')closeModal();else if(action==='confirm-restart')showModal('confirm',`<div class="eyebrow">Новый поход</div><h2 id="modalTitle">Начать с чистого листа?</h2><p>Текущий поход будет заменён. Вы снова начнёте с 360 золотыми и целыми воротами.</p><div class="intro-actions" style="margin-top:25px"><button class="secondary" data-action="back-pause">Вернуться</button><button class="primary" data-action="new-game">Начать заново</button></div>`);else if(action==='back-pause')showPause();
}
document.addEventListener('click',handleAction);
$('waveBtn').onclick=startWave;
$('soundBtn').onclick=()=>{audio.init();audio.enabled=!audio.enabled;audio.preference=audio.enabled;try{localStorage.setItem('elderholm-sound',audio.enabled?'on':'off');}catch{}syncSound();if(audio.enabled)audio.tone(440,.25);};
$('codexBtn').onclick=()=>{if(!modalType)showCodex();};
$('helpBtn').onclick=()=>{if(modalType==='research')return;showHelp();};
$('pauseBtn').onclick=()=>{if(modalType==='pause'){paused=false;closeModal();$('pausedShade').hidden=true;}else if(!modalType)showPause();};
$('autoWaves').onchange=()=>{game.autoWaves=$('autoWaves').checked;dirty=true;if(game.phase==='research'&&game.autoWaves&&game.lastResearch){game.chooseResearch(game.lastResearch,true);closeModal();startWave();}else if(game.phase==='build'&&game.autoWaves)startWave();else if(game.phase!=='wave')save();};
$('speedBtn').onclick=()=>{speed=speed===1?2:speed===2?3:1;dirty=true;};$('rangeBtn').onclick=()=>{showRanges=!showRanges;dirty=true;};
$('zoomBtn').onclick=()=>{zoom=zoom>1?1:1.8;panX=0;panY=0;resize();dirty=true;if(zoom>1)toast('Перетаскивайте поле для обзора. Двумя пальцами можно менять масштаб.');};
$('meteorBtn').onclick=()=>selectSpell('meteor');$('freezeBtn').onclick=()=>selectSpell('freeze');
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Используйте полноэкранный режим браузера.');}catch{toast('Полноэкранный режим недоступен.');}}
$('fullscreenBtn').onclick=fullscreen;
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const key=e.key.toLowerCase();if(e.key==='Tab'&&modalType){const all=[...$('modal').querySelectorAll('button:not([disabled])')];if(all.length){if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0].focus();}}return;}if(key==='escape'){if(modalType==='help'||modalType==='codex'){closeModal();paused=false;$('pausedShade').hidden=true;}else if(modalType==='pause'){closeModal();paused=false;$('pausedShade').hidden=true;}else{selectedSpell=null;selectedTower=null;selectedEnemy=null;dirty=true;}return;}if(modalType)return;if(key===' '){e.preventDefault();showPause();}else if(key==='enter')startWave();else if(key>='1'&&key<='6')pickBuild(Object.keys(TOWERS)[+key-1]);else if(key==='q')selectSpell('meteor');else if(key==='e')selectSpell('freeze');else if(key==='m')$('soundBtn').click();else if(key==='f')fullscreen();else if(key==='h')showHelp();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&game.phase==='wave'&&!modalType)showPause();if(!document.hidden)frameTime=0;audio.syncMusic();});
function mapPoint(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left-view.x)/view.scale,y:(e.clientY-r.top-view.y)/view.scale};}
function nearestPad(p){let closest=-1,d=Infinity;PADS.forEach((pad,i)=>{const tower=game.towers.find(t=>t.pad===i),dd=Math.hypot(p.x-pad.x,p.y-(pad.y-(tower?19:0)));if(dd<d){d=dd;closest=i;}});return d<Math.max(37,20/view.scale)?closest:-1;}
canvas.addEventListener('pointermove',e=>{
 if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pinch&&pointers.size>1){const pp=[...pointers.values()],distance=Math.hypot(pp[0].x-pp[1].x,pp[0].y-pp[1].y);zoom=Math.max(1,Math.min(2.6,pinch.zoom*distance/pinch.distance));if(gesture)gesture.moved=true;resize();dirty=true;return;}
 if(gesture&&gesture.id===e.pointerId&&zoom>1){const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.hypot(dx,dy)>6)gesture.moved=true;if(gesture.moved){panX=gesture.panX+dx;panY=gesture.panY+dy;resize();canvas.style.cursor='grabbing';return;}}
 const p=mapPoint(e);cursorPoint=p;hoverPad=nearestPad(p);canvas.style.cursor=selectedSpell?'crosshair':hoverPad>=0?'pointer':zoom>1?'grab':'default';
});
canvas.addEventListener('pointerleave',()=>{hoverPad=-1;cursorPoint=null;});
canvas.addEventListener('pointerdown',e=>{if(!started||paused||modalType)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1)gesture={id:e.pointerId,x:e.clientX,y:e.clientY,panX,panY,moved:false};else if(pointers.size===2){const pp=[...pointers.values()];pinch={distance:Math.max(1,Math.hypot(pp[0].x-pp[1].x,pp[0].y-pp[1].y)),zoom};if(gesture)gesture.moved=true;}});
canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);const moved=gesture?.moved||pinch||!gesture;if(!pointers.size){gesture=null;pinch=null;}if(!moved)mapTap(e);});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);gesture=null;pinch=null;});
function mapTap(e){if(!started||paused||modalType)return;const p=mapPoint(e);if(selectedSpell){if(act(game.cast(selectedSpell,p.x,p.y))){selectedSpell=null;dirty=true;}return;}if(game.phase==='wave'){
 const hit=game.enemies.map(e=>({e,d:Math.hypot(p.x-e.x,p.y-(e.y-(ENEMIES[e.type].boss?34:e.fly?29:17)))})).filter(q=>q.d<(ENEMIES[q.e.type].boss?36:Math.max(20,10/view.scale))).sort((a,b)=>a.d-b.d)[0];
 if(hit){selectedEnemy=hit.e.id;selectedTower=null;dirty=true;return;}
 }selectedEnemy=null;const pad=nearestPad(p);if(pad<0){selectedTower=null;dirty=true;return;}const tower=game.towers.find(t=>t.pad===pad);if(tower){selectedTower=tower.id;selectedSpell=null;dirty=true;return;}if(!['build','wave'].includes(game.phase)){toast('Сначала выберите развитие королевства.');return;}const result=game.build(selectedType,pad);if(act(result)){selectedTower=null;particlesBurst(PADS[pad].x,PADS[pad].y,'#e5cc8f',20);}}
function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);const scale=Math.min(r.width/1000,r.height/650)*zoom;const maxX=Math.max(0,(1000*scale-r.width)/2),maxY=Math.max(0,(650*scale-r.height)/2);panX=Math.max(-maxX,Math.min(maxX,panX));panY=Math.max(-maxY,Math.min(maxY,panY));view={scale,x:(r.width-1000*scale)/2+panX,y:(r.height-650*scale)/2+panY,width:r.width,height:r.height,dpr};}
new ResizeObserver(resize).observe($('battlefield'));
// Детерминированная карта: текстуры и окружение рисуются один раз.
function seeded(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function pathDistance(x,y){let d=Infinity;for(let i=1;i<PATH.length;i++){const a=PATH[i-1],z=PATH[i],dx=z.x-a.x,dy=z.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));d=Math.min(d,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));}return d;}
function sprite(c,id,x,y,w,h=w*112/96){const im=images[id];if(im?.complete&&im.naturalWidth)c.drawImage(im,x-w/2,y-h*.86,w,h);}
function animatedSprite(c,id,x,y,width,state='idle',elapsed=0,flip=false,alpha=1,offset=0){
 const def=atlas[id],im=atlasImages[id];
 if(def&&im?.complete&&im.naturalWidth)return SpriteFrames.draw(c,im,def,{x,y,width,state,time:elapsed,flip,alpha,offset});
 c.save();c.globalAlpha*=alpha;sprite(c,id,x,y,width);c.restore();return null;
}
function enemyWidth(type){return ENEMIES[type]?.boss?(type==='boss20'?105:94):type==='dragon'?66:type==='golem'?53:45;}
function renderAtlasPreview(){
 if(modalType!=='codex')return;
 for(const cv of $('modal').querySelectorAll('canvas[data-sprite]')){
  const id=cv.dataset.sprite,def=atlas[id];if(!def)continue;
  const c=cv.getContext('2d');c.clearRect(0,0,cv.width,cv.height);
  let state=animationPreview;if(!def.states[state])state=state==='walk'?'attack':'idle';
  const length=SpriteFrames.select(def,state,0).duration;
  const elapsed=(state==='die'||def.states[state]?.loop===false)?previewClock%(length+.55):previewClock;
  animatedSprite(c,id,cv.width/2,cv.height*.86,cv.width*.86,state,elapsed);
 }
}
function roundPath(c,points){c.beginPath();c.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length-1;i++){const cur=points[i],next=points[i+1],prev=points[i-1],r=32,dl=Math.hypot(cur.x-prev.x,cur.y-prev.y),dn=Math.hypot(next.x-cur.x,next.y-cur.y);c.lineTo(cur.x-(cur.x-prev.x)/dl*r,cur.y-(cur.y-prev.y)/dl*r);c.quadraticCurveTo(cur.x,cur.y,cur.x+(next.x-cur.x)/dn*r,cur.y+(next.y-cur.y)/dn*r);}c.lineTo(points.at(-1).x,points.at(-1).y);}
function makeBackground(){if(images.background?.naturalWidth){makePaintedBackground();return;}const r=seeded(8317);b.clearRect(0,0,1000,650);let grad=b.createLinearGradient(0,0,1000,650);grad.addColorStop(0,'#384b31');grad.addColorStop(.5,'#4b6240');grad.addColorStop(1,'#253f36');b.fillStyle=grad;b.fillRect(0,0,1000,650);
 // Holмы, мох и поляны.
 for(let i=0;i<95;i++){const x=r()*1000,y=r()*650,rad=35+r()*130;let g=b.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,r()>.45?'#77904c30':'#102f2c50');g.addColorStop(1,'#263d3000');b.fillStyle=g;b.fillRect(x-rad,y-rad,rad*2,rad*2);}
 // Река у нижней границы.
 b.save();b.lineCap='round';b.lineJoin='round';const river=[{x:-60,y:590},{x:180,y:605},{x:330,y:620},{x:540,y:600},{x:760,y:635},{x:1060,y:560}];roundPath(b,river);b.strokeStyle='#223d33';b.lineWidth=66;b.stroke();roundPath(b,river);b.strokeStyle='#64876d';b.lineWidth=51;b.stroke();roundPath(b,river);b.strokeStyle='#315e5b';b.lineWidth=43;b.stroke();roundPath(b,river);b.strokeStyle='#5c888044';b.lineWidth=17;b.stroke();b.restore();
 for(let i=0;i<95;i++){const x=r()*1100-50,y=595+Math.sin(x*.01)*13+r()*20;b.strokeStyle='#bbd1a52a';b.lineWidth=.8;b.beginPath();b.moveTo(x,y);b.lineTo(x+5+r()*14,y);b.stroke();}
 // Дорога: тёмная кромка, земля, песчаный центр.
 b.save();b.lineJoin='round';b.lineCap='round';roundPath(b,PATH);b.shadowColor='#10271988';b.shadowBlur=14;b.shadowOffsetY=6;b.strokeStyle='#243e2a';b.lineWidth=66;b.stroke();b.shadowColor='transparent';roundPath(b,PATH);b.strokeStyle='#758254';b.lineWidth=61;b.stroke();roundPath(b,PATH);b.strokeStyle='#a99e6c';b.lineWidth=51;b.stroke();roundPath(b,PATH);b.strokeStyle='#c0ac7a';b.lineWidth=36;b.stroke();roundPath(b,PATH);b.strokeStyle='#ccb88877';b.lineWidth=17;b.stroke();b.restore();
 for(let i=0;i<2700;i++){let x=r()*1000,y=r()*650,d=pathDistance(x,y);if(d<23){b.fillStyle=r()>.45?'#f5dca42b':'#695d4026';b.beginPath();b.ellipse(x,y,1+r()*3,.5+r(),r()*3,0,Math.PI*2);b.fill();}else if(d>39){b.strokeStyle=r()>.6?'#b3c17626':'#213f2b55';b.lineWidth=.7;b.beginPath();b.moveTo(x,y);b.lineTo(x-1-r()*2,y-3-r()*4);b.moveTo(x,y);b.lineTo(x+2+r()*2,y-3);b.stroke();}}
 // Крупные декорации располагаются вдали от строительных площадок.
 const deco=[];for(let i=0;i<110;i++){const x=r()*1040-20,y=r()*640;const nearPad=PADS.some(p=>Math.hypot(p.x-x,p.y-y)<63);if(pathDistance(x,y)>62&&!nearPad&&!(x>870&&y<185)){const edge=x<50||x>940||y<65||y>560;deco.push({x,y,id:r()>.15?'tree':'rock',w:edge?55+r()*38:35+r()*20});}}deco.sort((a,z)=>a.y-z.y).forEach(d=>sprite(b,d.id,d.x,d.y,d.w));
 // Полуразрушенная арка входа, дорожные камни и руины.
 b.fillStyle='#17271ee0';b.fillRect(0,136,13,91);b.fillStyle='#65745a';for(let i=0;i<6;i++){b.fillRect(2,138+i*15,16,12);b.fillStyle=i%2?'#5d6a50':'#778065';}sprite(b,'banner',38,160,40);sprite(b,'banner',910,172,39);sprite(b,'castle',968,135,132,151);
 for(const p of PADS){b.save();b.translate(p.x,p.y);b.fillStyle='#1a30294d';b.beginPath();b.ellipse(0,5,30,17,0,0,7);b.fill();b.strokeStyle='#98a97966';b.lineWidth=1.5;b.fillStyle='#687c4f44';b.beginPath();b.ellipse(0,0,24,16,0,0,7);b.fill();b.stroke();b.restore();}
 // Пограничные леса с глубокой виньеткой.
 const vignette=b.createRadialGradient(500,300,170,500,320,620);vignette.addColorStop(0,'#0b241000');vignette.addColorStop(.6,'#0b24100c');vignette.addColorStop(1,'#091c18aa');b.fillStyle=vignette;b.fillRect(0,0,1000,650);backgroundReady=true;
}
function makePaintedBackground(){if(Object.keys(atlas).length){makeCartoonBackground();return;}
 const random=seeded(8317);b.clearRect(0,0,1000,650);b.drawImage(images.background,0,0,1000,650);
 b.fillStyle='#09251c26';b.fillRect(0,0,1000,650);
 // The road keeps its exact gameplay geometry over the generated valley.
 b.save();b.lineJoin='round';b.lineCap='round';roundPath(b,PATH);b.shadowColor='#102116aa';b.shadowBlur=9;b.shadowOffsetY=3;b.strokeStyle='#263b26';b.lineWidth=62;b.stroke();b.shadowColor='transparent';
 roundPath(b,PATH);b.strokeStyle='#60684a';b.lineWidth=57;b.stroke();roundPath(b,PATH);b.strokeStyle='#887e5b';b.lineWidth=49;b.stroke();roundPath(b,PATH);b.strokeStyle='#b2a383';b.lineWidth=41;b.stroke();b.restore();
 const palette=['#d7c8a133','#ece0be33','#756b4c55','#665d4144','#eee1b644'];
 for(let i=0;i<4800;i++){const x=random()*1000,y=random()*650,d=pathDistance(x,y);if(d<21){const w=2+random()*6,h=1+random()*3;b.fillStyle=palette[Math.floor(random()*palette.length)];b.beginPath();b.moveTo(x-w,y-h);b.lineTo(x+w*.8,y-h*.7);b.lineTo(x+w,y+h);b.lineTo(x-w*.6,y+h*.9);b.closePath();b.fill();}else if(d>27&&d<35&&random()>.6){b.strokeStyle=random()>.5?'#b1c36a66':'#233e2866';b.lineWidth=1;b.beginPath();b.moveTo(x,y);b.lineTo(x-2,y-4);b.moveTo(x,y);b.lineTo(x+2,y-3);b.stroke();}}
 for(const p of PADS){b.save();b.translate(p.x,p.y);b.fillStyle='#16261977';b.beginPath();b.ellipse(1,4,27,17,0,0,7);b.fill();b.fillStyle='#596044aa';b.strokeStyle='#c0ad7777';b.lineWidth=2;b.beginPath();b.ellipse(0,0,23,15,0,0,7);b.fill();b.stroke();b.strokeStyle='#1d302777';b.lineWidth=1;b.beginPath();b.ellipse(0,0,18,11,0,0,7);b.stroke();b.restore();}
 sprite(b,'castle',985,142,132,154);sprite(b,'banner',35,155,29);sprite(b,'banner',904,167,30);
 const shade=b.createRadialGradient(500,310,220,500,330,650);shade.addColorStop(0,'#09211b00');shade.addColorStop(1,'#071b1477');b.fillStyle=shade;b.fillRect(0,0,1000,650);backgroundReady=true;
}
function drawMeadowDetails(){
 const random=seeded(41827),bushes=[];let tufts=0,stones=0;
 const free=(x,y,rx,ry)=>pathDistance(x,y)>34+Math.max(rx,ry)&&PADS.every(p=>Math.hypot((x-p.x)/(30+rx),(y-p.y)/(21+ry))>1)&&!(x>900&&y<170);
 // Sparse blade clusters give the clearing scale without filling it with noise.
 for(let i=0;i<1400&&tufts<72;i++){
  const x=35+random()*930,y=65+random()*505,size=4+random()*4;
  if(!free(x,y,7,9))continue;
  b.strokeStyle=['#526e45a0','#6e8452a0','#9c9a63a0'][Math.floor(random()*3)];b.lineWidth=1.4;b.lineCap='round';b.beginPath();b.moveTo(x-4,y);b.quadraticCurveTo(x-4,y-size*.6,x-7,y-size*.8);b.moveTo(x,y+1);b.quadraticCurveTo(x+1,y-size*.6,x,y-size);b.moveTo(x+3,y);b.quadraticCurveTo(x+4,y-size*.45,x+7,y-size*.65);b.stroke();tufts++;
 }
 // Low rounded bushes stay clear of both the road and building rings.
 for(let i=0;i<1200&&bushes.length<9;i++){
  const x=45+random()*910,y=80+random()*480,scale=.7+random()*.35;
  if(!(x<155||x>840||y<165||y>505||random()<.12)||!free(x,y,20*scale,24*scale)||bushes.some(p=>Math.hypot(p.x-x,p.y-y)<85))continue;
  bushes.push({x,y});b.save();b.translate(x,y);b.scale(scale,scale);b.fillStyle='#2d443c40';b.beginPath();b.ellipse(1,1,20,6,0,0,7);b.fill();b.strokeStyle='#38533d';b.lineWidth=1.8;b.fillStyle='#52734a';b.beginPath();b.moveTo(-17,-2);b.bezierCurveTo(-25,-13,-14,-22,-6,-17);b.bezierCurveTo(-4,-30,13,-28,16,-16);b.bezierCurveTo(28,-16,28,-1,17,1);b.quadraticCurveTo(0,6,-17,-2);b.closePath();b.fill();b.stroke();b.strokeStyle='#8ca469';b.lineWidth=2;b.beginPath();b.moveTo(-15,-12);b.quadraticCurveTo(-11,-19,-6,-15);b.moveTo(1,-20);b.quadraticCurveTo(7,-24,12,-17);b.stroke();b.restore();
 }
 for(let i=0;i<600&&stones<5;i++){
  const x=45+random()*910,y=80+random()*475;
  if(!free(x,y,11,8)||bushes.some(p=>Math.hypot(p.x-x,p.y-y)<36))continue;
  b.fillStyle='#69736250';b.beginPath();b.ellipse(x,y+2,10,3.5,0,0,7);b.fill();b.fillStyle='#989c83';b.strokeStyle='#5c6c57';b.lineWidth=1.1;b.beginPath();b.moveTo(x-7,y);b.lineTo(x-5,y-6);b.lineTo(x+2,y-9);b.lineTo(x+8,y-3);b.lineTo(x+6,y+1);b.closePath();b.fill();b.stroke();b.strokeStyle='#c0bd9b';b.beginPath();b.moveTo(x-4,y-5);b.lineTo(x+1,y-7);b.lineTo(x+5,y-3);b.stroke();stones++;
 }
}
function makeCartoonBackground(){
 b.clearRect(0,0,1000,650);b.drawImage(images.background,0,0,1000,650);drawMeadowDetails();
 b.save();b.lineCap='round';b.lineJoin='round';roundPath(b,PATH);b.strokeStyle='#3b5637';b.lineWidth=61;b.stroke();roundPath(b,PATH);b.strokeStyle='#af985f';b.lineWidth=54;b.stroke();roundPath(b,PATH);b.strokeStyle='#e6c58c';b.lineWidth=46;b.stroke();roundPath(b,PATH);b.strokeStyle='#f3d9a7';b.lineWidth=33;b.stroke();b.restore();
 const random=seeded(8317);for(let i=0;i<100;i++){const x=random()*1000,y=random()*650;if(pathDistance(x,y)<17){b.fillStyle='#a98f5a44';b.beginPath();b.ellipse(x,y,3+random()*3,1.5,0,0,7);b.fill();}}
 for(const p of PADS){b.fillStyle='#41643a88';b.beginPath();b.ellipse(p.x,p.y+4,25,16,0,0,7);b.fill();b.fillStyle='#76945b';b.strokeStyle='#304b2f';b.lineWidth=2;b.beginPath();b.ellipse(p.x,p.y,23,15,0,0,7);b.fill();b.stroke();b.strokeStyle='#c2d293';b.lineWidth=1;b.beginPath();b.ellipse(p.x,p.y-1,18,10,0,Math.PI,Math.PI*2);b.stroke();}
 sprite(b,'castle',985,142,132,154);backgroundReady=true;
}
function particlesBurst(x,y,color,n=8){for(let i=0;i<n&&particles.length<250;i++){const a=Math.random()*Math.PI*2,s=15+Math.random()*60;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-15,color,life:.4+Math.random()*.55,max:1,size:1+Math.random()*2.4});}}
function processEvents(){const events=game.drainEvents();for(const ev of events){if(!['victory','defeat'].includes(ev.type))audio.event(ev.type,ev.tower);if(ev.type==='kill'){
 if(selectedEnemy===ev.id){selectedEnemy=null;dirty=true;}
 const duration=atlas[ev.enemy]?SpriteFrames.select(atlas[ev.enemy],'die',0).duration:.65;
 if(deaths.length>=50)deaths.shift();deaths.push({id:ev.id,type:ev.enemy,x:ev.x,y:ev.y,fly:ev.fly,facing:ev.facing||1,elapsed:0,duration:duration+.45});
 particlesBurst(ev.x,ev.y,ENEMIES[ev.enemy]?.color||'#e3bd7d',3);floatTexts.push({x:ev.x,y:ev.y-22,text:`+${ev.reward}`,color:'#e9d38c',life:.9});}else if(ev.type==='hit'){if(ev.towerId&&ev.tower==='trap'){const t=game.towers.find(t=>t.id===ev.towerId);if(t)t.attackAt=game.time;}if(Math.random()<.28&&floatTexts.length<35)floatTexts.push({x:ev.x+(Math.random()-.5)*15,y:ev.y-25,text:String(ev.damage||''),color:ev.color||'#f0dfb5',life:.5});}else if(ev.type==='siege-warning'){
 toast(`${ENEMIES[ev.enemy]?.name||'Босс'} целится в ${TOWERS[game.towers.find(t=>t.id===ev.towerId)?.type]?.name||'постройку'}!`);dirty=true;
 }else if(ev.type==='tower-hit'){
 particlesBurst(ev.x,ev.y,'#e7ac72',8);floatTexts.push({x:ev.x,y:ev.y-30,text:'−'+ev.damage,color:'#ffac86',life:.9});dirty=true;
 }else if(ev.type==='tower-destroyed'){
 particlesBurst(ev.x,ev.y,'#d29d6b',28);shake=5;if(selectedTower===ev.towerId)selectedTower=null;toast(`${TOWERS[ev.tower]?.name||'Постройка'} разрушена боссом`);dirty=true;
 }else if(ev.type==='repair'){
 particlesBurst(ev.x,ev.y,'#b5df9b',12);audio.event('build');dirty=true;
 }else if(ev.type==='wave'){save(true);banner(`Волна ${ev.wave}`,TD.getWaveInfo(ev.wave).name.replace(/^Волна \d+ · /,''));}else if(ev.type==='boss'){banner('Приближается владыка',ENEMIES[ev.enemy].name);}else if(ev.type==='reward'){lastReward=ev.amount;particlesBurst(500,250,'#eed087',35);}else if(ev.type==='leak'){shake=7;particlesBurst(967,130,'#ef8766',16);}else if(ev.type==='cast'){shake=ev.spell==='meteor'?5:1;}else if(['upgrade','enchant','build'].includes(ev.type)){particlesBurst(ev.x,ev.y,'#e7c98b',15);}}
}
function drawRange(x,y,r,color='#dac793',alpha=.12){ctx.save();ctx.fillStyle=color;ctx.globalAlpha=alpha;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();ctx.globalAlpha=.55;ctx.strokeStyle=color;ctx.lineWidth=1.2;ctx.setLineDash([5,5]);ctx.stroke();ctx.restore();}
function renderMap(t){ctx.setTransform(view.dpr,0,0,view.dpr,0,0);ctx.fillStyle='#253c2e';ctx.fillRect(0,0,view.width,view.height);ctx.save();ctx.translate(view.x+(shake?(Math.random()-.5)*shake:0),view.y+(shake?(Math.random()-.5)*shake:0));ctx.scale(view.scale,view.scale);if(backgroundReady)ctx.drawImage(bg,0,0);else{ctx.fillStyle='#3c5538';ctx.fillRect(0,0,1000,650);}ctx.save();ctx.beginPath();ctx.rect(0,0,1000,650);ctx.clip();
 // Солнечные пылинки и светлячки.
 for(let i=0;i<19;i++){const x=(i*83+Math.sin(t*.2+i)*25)%1000,y=(i*127+Math.cos(t*.25+i)*30)%650;ctx.globalAlpha=.18+Math.sin(t+i)*.13;ctx.fillStyle='#e2e8a3';ctx.beginPath();ctx.arc(x,y,1.3,0,7);ctx.fill();}ctx.globalAlpha=1;
 const activeTower=game.towers.find(x=>x.id===selectedTower);
 if(selectedSpell==='meteor'&&cursorPoint)drawRange(cursorPoint.x,cursorPoint.y,94,'#f1ae70',.16);
 if(selectedSpell==='freeze')drawRange(500,325,750,'#9ddde2',.055);
 if(showRanges)for(const tower of game.towers)drawRange(tower.x,tower.y,game.getTowerStats(tower).range,TOWERS[tower.type].color,.035);
 if(activeTower)drawRange(activeTower.x,activeTower.y,game.getTowerStats(activeTower).range,TOWERS[activeTower.type].color,.11);
 else if(hoverPad>=0&&!game.towers.some(x=>x.pad===hoverPad)&&['build','wave'].includes(game.phase)){const p=PADS[hoverPad];drawRange(p.x,p.y,game.getTowerStats({type:selectedType,level:1}).range,TOWERS[selectedType].color,.1);}
 // Строительные площадки.
 PADS.forEach((p,i)=>{if(game.towers.some(t=>t.pad===i))return;const hot=i===hoverPad;ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=['build','wave'].includes(game.phase)?(hot?1:.72):.22;ctx.strokeStyle=hot?'#f3dba0':'#c7c292';ctx.fillStyle=hot?'#b4b57d44':'#243b2944';ctx.lineWidth=hot?2:1.3;ctx.setLineDash([3,3]);ctx.beginPath();ctx.ellipse(0,0,22,15,0,0,7);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle=hot?'#fff1be':'#c2c49e';ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(5,0);ctx.moveTo(0,-5);ctx.lineTo(0,5);ctx.stroke();ctx.restore();});
 // Спрайты сортируются по глубине.
 const entities=[...deaths.map(o=>({o,kind:'corpse',y:o.y})),...game.towers.map(o=>({o,kind:'tower',y:o.y})),...game.enemies.map(o=>({o,kind:'enemy',y:o.y+(o.fly?35:0)})),...game.troops.map(o=>({o,kind:'troop',y:o.y}))];entities.sort((a,b)=>a.y-b.y);
 for(const entry of entities){const o=entry.o;ctx.save();if(entry.kind==='tower'){
  const w=o.type==='trap'?64:['archer','frost','arcane'].includes(o.type)?75+(o.level-1):83+(o.level-1)*3;let yy=o.y;
  if(o.id===selectedTower||o.pad===hoverPad){ctx.strokeStyle='#ebd49a';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(o.x,o.y,29,18,0,0,7);ctx.stroke();}
  const elapsed=Number.isFinite(o.attackAt)?game.time-o.attackAt:99;const attack=atlas[o.type]&&elapsed>=0&&elapsed<SpriteFrames.select(atlas[o.type],'attack',0).duration;
  animatedSprite(ctx,o.type,o.x,yy,w,attack?'attack':'idle',attack?elapsed:0);
  if(o.level>1){ctx.font='bold 10px Georgia';ctx.textAlign='center';ctx.fillStyle='#f4d99b';ctx.fillText(roman[o.level]||o.level,o.x,o.y+17);}
  if(o.maxHp&&(o.hp<o.maxHp-.5||o.id===selectedTower)){const y=o.y-(o.type==='trap'?40:o.type==='mortar'?64:76);ctx.fillStyle='#16261ed9';ctx.fillRect(o.x-21,y,42,5);ctx.fillStyle=o.hp/o.maxHp<.35?'#e98d6c':'#a9cd7d';ctx.fillRect(o.x-20,y+1,40*Math.max(0,o.hp/o.maxHp),3);}
  if(o.element){const col=RESEARCH[o.element].color;ctx.shadowColor=col;ctx.shadowBlur=10;ctx.fillStyle=col;ctx.beginPath();ctx.arc(o.x+21,o.y-35+Math.sin(t*3+o.id)*3,4,0,7);ctx.fill();ctx.shadowBlur=0;}
  if(o.type==='frost'||o.type==='arcane'||o.type==='trap'){ctx.globalAlpha=.25+Math.sin(t*2+o.id)*.12;ctx.strokeStyle=TOWERS[o.type].color;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(o.x,o.y-2,22+Math.sin(t*2)*3,11,0,0,7);ctx.stroke();}
 }else if(entry.kind==='enemy'){
  const def=ENEMIES[o.type],boss=def.boss,w=enemyWidth(o.type),bob=o.fly?Math.sin(t*4+o.id)*2:0;const yy=o.y+(o.fly?-14:0)+bob;
  if(o.affinity&&AFFINITIES[o.affinity]){ctx.strokeStyle=AFFINITIES[o.affinity].color;ctx.lineWidth=2;ctx.globalAlpha=.7;ctx.beginPath();ctx.ellipse(o.x,o.y+1,boss?25:15,boss?10:6,0,0,7);ctx.stroke();ctx.globalAlpha=1;}
  if(o.id===selectedEnemy){ctx.strokeStyle='#f5dc99';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(o.x,o.y+1,boss?30:19,boss?12:8,0,0,7);ctx.stroke();}
  ctx.fillStyle='#0d251d55';ctx.beginPath();ctx.ellipse(o.x,o.y+3,boss?25:12,boss?9:4,0,0,7);ctx.fill();
  if(o.slow>0){ctx.fillStyle='#85e6ee33';ctx.strokeStyle='#c2f0eb88';ctx.beginPath();ctx.ellipse(o.x,o.y+2,w*.35,w*.15,0,0,7);ctx.fill();ctx.stroke();}
  animatedSprite(ctx,o.type,o.x,yy,w,o.animState||'walk',o.animTime??game.time,o.facing<0,1,o.animState==='attack'?0:o.id*.071);
  if(o.burn>0){ctx.globalAlpha=.75;for(let j=0;j<3;j++){ctx.fillStyle=j%2?'#ffe69c':'#ff9b52';ctx.beginPath();ctx.ellipse(o.x+(j-1)*7,o.y-12+Math.sin(t*14+j)*5,3,7,Math.sin(t*3),0,7);ctx.fill();}ctx.globalAlpha=1;}
  if(o.poison>0){ctx.fillStyle='#ade482';ctx.beginPath();ctx.arc(o.x+12,o.y-18,2+Math.sin(t*5),0,7);ctx.fill();}
  const barw=boss?57:29,by=yy-w*.96;ctx.fillStyle='#10221dcc';ctx.fillRect(o.x-barw/2-1,by-1,barw+2,5);ctx.fillStyle=boss?'#ed9d76':o.slow>0?'#9ad8d2':'#b6d27e';ctx.fillRect(o.x-barw/2,by,barw*Math.max(0,o.hp/o.maxHp),3);
  if(o.affinity&&AFFINITIES[o.affinity]){ctx.fillStyle=AFFINITIES[o.affinity].color;ctx.font='bold 13px Georgia';ctx.textAlign='center';ctx.fillText(AFFINITIES[o.affinity].icon||elementIcon[o.affinity],o.x+barw/2+8,by+5);}
 }else if(entry.kind==='corpse'){
  const fade=Math.min(1,Math.max(0,(o.duration-o.elapsed)/.35));
  const y=o.y-(o.fly?14*Math.max(0,1-o.elapsed/.4):0);
  animatedSprite(ctx,o.type,o.x,y,enemyWidth(o.type),'die',o.elapsed,o.facing<0,fade);
 }else{
  const enemy=game.enemies.find(e=>e.id===o.enemyId);const target={x:enemy?enemy.x+(o.id%2?13:-13):o.x,y:enemy?enemy.y+7:o.y};
  let v=guardVisuals.get(o.id);if(!v){v={x:o.x,y:o.y,time:0};guardVisuals.set(o.id,v);}
  const distance=Math.hypot(target.x-v.x,target.y-v.y),step=1-Math.exp(-renderDelta*7);v.x+=(target.x-v.x)*step;v.y+=(target.y-v.y)*step;v.time+=renderDelta;
  const state=distance>4?'walk':enemy?'attack':'idle';const clock=state==='attack'?(game.time-(o.attackAt||0)):v.time;
  animatedSprite(ctx,'guard',v.x,v.y,38,state,clock,target.x<v.x-1);
 }
 ctx.restore();}
 // Снаряды и магические следы.
 for(const p of game.projectiles){ctx.save();ctx.strokeStyle=p.color||'#eadba9';ctx.fillStyle=p.color||'#eadba9';ctx.lineWidth=p.type==='arcane'?3:2;ctx.shadowBlur=p.type==='archer'?0:10;ctx.shadowColor=p.color||'#fff';const a=Math.atan2(p.ty-p.y,p.tx-p.x);ctx.beginPath();ctx.moveTo(p.x-Math.cos(a)*12,p.y-Math.sin(a)*12-15);ctx.lineTo(p.x,p.y-15);ctx.stroke();if(p.type!=='archer'){ctx.beginPath();ctx.arc(p.x,p.y-15,p.type==='mortar'?4:3,0,7);ctx.fill();}else{ctx.beginPath();ctx.moveTo(p.x,p.y-15);ctx.lineTo(p.x-Math.cos(a-.6)*5,p.y-15-Math.sin(a-.6)*5);ctx.moveTo(p.x,p.y-15);ctx.lineTo(p.x-Math.cos(a+.6)*5,p.y-15-Math.sin(a+.6)*5);ctx.stroke();}ctx.restore();}
 for(const e of game.effects){const ratio=Math.max(0,e.life/(e.maxLife||1)),p=1-ratio;ctx.save();ctx.globalAlpha=ratio*.75;ctx.strokeStyle=e.color||'#f2dbaa';ctx.fillStyle=e.color||'#f2dbaa';ctx.lineWidth=e.type==='chain'?3:2;const rad=Math.max(1,(e.radius||15)*(.25+p*.75));if(e.type==='siege-warning'){
 ctx.globalAlpha=.65+Math.sin(t*16)*.2;ctx.strokeStyle='#ff805f';ctx.fillStyle='#ee623736';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(e.x,e.y-12,19+ratio*14,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#ffe0b2';ctx.font='bold 23px Georgia';ctx.textAlign='center';ctx.fillText('!',e.x,e.y-5);
 }else if(e.type==='meteor'){const g=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,rad);g.addColorStop(0,'#fff4bca0');g.addColorStop(.4,'#f29258aa');g.addColorStop(1,'#e0522900');ctx.fillStyle=g;ctx.beginPath();ctx.arc(e.x,e.y,rad,0,7);ctx.fill();for(let j=0;j<5;j++){const a=j/5*6.28+p*3;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*rad*.7,e.y+Math.sin(a)*rad*.7);ctx.lineTo(e.x+Math.cos(a)*rad,e.y+Math.sin(a)*rad);ctx.stroke();}}else if(e.type==='slash'){ctx.beginPath();ctx.arc(e.x,e.y,rad,-1.7+p,1+p);ctx.stroke();}else if(e.type==='heal'){ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(e.x-5,e.y-25);ctx.lineTo(e.x+5,e.y-25);ctx.moveTo(e.x,e.y-30);ctx.lineTo(e.x,e.y-20);ctx.stroke();}else{ctx.beginPath();ctx.ellipse(e.x,e.y,rad,rad*.6,0,0,7);ctx.stroke();ctx.globalAlpha=ratio*.15;ctx.fill();}ctx.restore();}
 for(const p of particles){ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.1,p.size*p.life),0,7);ctx.fill();}ctx.globalAlpha=1;
 ctx.textAlign='center';for(const f of floatTexts){ctx.globalAlpha=Math.min(1,f.life*2);ctx.font=f.text.startsWith('+')?'bold 12px Georgia':'10px Arial';ctx.fillStyle=f.color;ctx.shadowColor='#12261d';ctx.shadowBlur=3;ctx.fillText(f.text,f.x,f.y);ctx.shadowBlur=0;}ctx.globalAlpha=1;
 ctx.restore();ctx.restore();
 const boss=game.enemies.find(e=>ENEMIES[e.type].boss);$('bossbar').hidden=!boss;if(boss){$('bossbar').querySelector('b').textContent=(boss.name||ENEMIES[boss.type].name);$('bossbar').querySelector('i').style.width=Math.max(0,boss.hp/boss.maxHp*100)+'%';}
}
function frame(now){
 const delta=frameTime?Math.min(.065,(now-frameTime)/1000):0;frameTime=now;
 const active=started&&!paused&&!modalType;renderDelta=active?delta*speed:0;
 if(!paused)visualTime+=delta;if(modalType==='codex')previewClock+=delta;
 if(active){
  let remain=delta*speed;while(remain>0){const dt=Math.min(.0333,remain);game.update(dt);remain-=dt;}processEvents();
  if(lastPhase!==game.phase){lastPhase=game.phase;dirty=true;pendingOutcome=null;if(game.phase!=='wave')save();
   if(['research','victory','defeat'].includes(game.phase))pendingOutcome={phase:game.phase,delay:deaths.length?.95:.1};
  }
 }else if(started)processEvents();
 if(active){
  for(let i=deaths.length-1;i>=0;i--){deaths[i].elapsed+=renderDelta;if(deaths[i].elapsed>=deaths[i].duration)deaths.splice(i,1);}
  for(const id of guardVisuals.keys())if(!game.troops.some(q=>q.id===id))guardVisuals.delete(id);
  if(pendingOutcome){if(pendingOutcome.phase!==game.phase)pendingOutcome=null;else{pendingOutcome.delay-=renderDelta;if(pendingOutcome.delay<=0){const phase=pendingOutcome.phase;pendingOutcome=null;if(phase==='research')showResearch();else showResult();}}}
 }
 if(!paused){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=delta;p.x+=p.vx*delta;p.y+=p.vy*delta;p.vy+=30*delta;if(p.life<=0)particles.splice(i,1);}for(let i=floatTexts.length-1;i>=0;i--){const f=floatTexts[i];f.life-=delta;f.y-=delta*24;if(f.life<=0)floatTexts.splice(i,1);}shake=Math.max(0,shake-delta*18);}
 audio.tick(visualTime);uiTick+=delta;if(dirty||(uiTick>.3&&game.phase==='wave')){renderUI();uiTick=0;}renderMap(visualTime);renderAtlasPreview();requestAnimationFrame(frame);
}
// Небольшой интерфейс для проверок; игра не зависит от инструментов тестирования.
window.elderholm={get game(){return game;},get paused(){return paused;},get selectedType(){return selectedType;},get view(){return view;},get images(){return images;},get atlasImages(){return atlasImages;},get deaths(){return deaths;},get sound(){return{enabled:audio.enabled,musicPaused:audio.music?.paused??true,musicTime:audio.music?.currentTime||0,musicDuration:audio.music?.duration||0,musicLoop:audio.music?.loop||false,musicError:audio.musicError};},get animationStats(){return {sheets:Object.keys(atlas).length,corpses:deaths.length,frames:Object.values(atlas).reduce((n,d)=>n+d.cols*d.rows,0)};},selectBuild:pickBuild,get state(){return{phase:game.phase,wave:game.wave,gold:game.gold,lives:game.lives,towers:game.towers.length,enemies:game.enemies.length,kills:game.kills};}};
Promise.all(imageLoads).then(()=>{imagesReady=true;if(images.background)document.documentElement.style.setProperty('--scene-art',`url("${SRC('background')}")`);makeBackground();renderUI();showIntro();});
resize();requestAnimationFrame(frame);
})();
