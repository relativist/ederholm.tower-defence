/* Crownfall — автономная логика боя. Координаты карты: 1000 × 650. */
(() => {
  'use strict';

  const PATH = [[-30,180],[150,180],[150,440],[350,440],[350,245],[565,245],[565,490],[790,490],[790,130],[1015,130]]
    .map(([x,y]) => ({x,y}));
  const PADS = [
    // Первые 16 площадок сохраняют индексы и координаты прежних сохранений.
    [80,285],[220,290],[260,510],[280,365],[425,325],[470,160],[485,420],[645,355],
    [670,555],[710,230],[870,240],[865,415],[425,535],[70,515],[900,70],[275,175],
    // Дополнительные рубежи с обеих сторон дороги и возле поворотов.
    [50,105],[740,75],[820,555],[590,195],[170,115],[550,555],[730,435],[90,405],
    [370,185],[160,495],[730,325],[940,205],[850,325],[510,305],[350,495],[620,275],
    [620,435],[820,75],[290,255],[410,445],[730,155],[500,495],[870,495],[210,215]
  ]
    .map(([x,y]) => ({x,y}));

  const TOWERS = {
    archer:  {name:'Лучная башня', short:'Лучники', cost:85, color:'#91dc8c', damage:19, range:165, rate:.72, kind:'arrow', target:'first', desc:'Надёжный дальний урон по одной цели.'},
    mortar:  {name:'Мортира', short:'Мортира', cost:125, color:'#f2a55c', damage:37, range:145, rate:1.65, kind:'shell', splash:55, target:'clump', desc:'Взрыв поражает группу. Отлично против толпы.'},
    frost:   {name:'Ледяной обелиск', short:'Лёд', cost:115, color:'#79d9ee', damage:10, range:150, rate:.88, kind:'ice', slow:.48, target:'first', desc:'Замедляет врагов и поддерживает союзников.'},
    barracks:{name:'Казарма', short:'Стража', cost:105, color:'#e6cc82', damage:25, range:83, rate:.9, kind:'melee', target:'first', desc:'Стражи задерживают врагов на дороге.'},
    arcane:  {name:'Арканная башня', short:'Аркана', cost:145, color:'#bc91ff', damage:47, range:180, rate:1.45, kind:'arcane', magic:true, target:'strong', desc:'Магический заряд пробивает броню.'},
    trap:    {name:'Рунная ловушка', short:'Ловушка', cost:70, color:'#ee7aa9', damage:52, range:96, rate:3.7, kind:'trap', splash:34, target:'first', desc:'Срабатывает на проходящих, затем перезаряжается.'}
  };

  const ENEMIES = {
    raider:{name:'Налётчик', hp:74, speed:39, armor:0, reward:8, color:'#c98a62'},
    runner:{name:'Волкоскок', hp:48, speed:68, armor:0, reward:7, color:'#dfaa64'},
    knight:{name:'Чёрный рыцарь', hp:230, speed:25, armor:.32, reward:18, color:'#8893a7'},
    shaman:{name:'Шаман', hp:145, speed:28, armor:.08, reward:18, color:'#b875cf', heal:22},
    wraith:{name:'Призрак', hp:138, speed:50, armor:.1, reward:17, color:'#83d9d5', fly:true},
    golem:{name:'Железный голем', hp:590, speed:17, armor:.48, reward:36, color:'#9f8e7e'},
    dragon:{name:'Молодой дракон', hp:370, speed:42, armor:.24, reward:34, color:'#df725e', fly:true},
    boss5:{name:'Огр-крушитель', hp:1350, speed:15, armor:.36, reward:120, color:'#d17a55', boss:true, ability:'roar'},
    boss10:{name:'Ледяной великан', hp:3200, speed:13, armor:.46, reward:230, color:'#78b9d6', boss:true, ability:'frost'},
    boss15:{name:'Теневой дракон', hp:5700, speed:20, armor:.34, reward:360, color:'#9d75d7', boss:true, fly:true, ability:'surge'},
    boss20:{name:'Король Пепла', hp:5500, speed:17, armor:.42, reward:700, color:'#e57846', boss:true, fly:true, ability:'inferno'}
  };

  const RESEARCH = {
    military:{name:'Королевская гвардия', icon:'⚔', description:'Урон всех башен +9%; каждый выбор возвращает 1 жизнь (не выше 20).', color:'#e7bc70'},
    fire:{name:'Школа пламени', icon:'♨', description:'Открывает огненное зачарование; урон огня растёт.', color:'#f08a59'},
    frost:{name:'Школа льда', icon:'❄', description:'Открывает ледяное зачарование; усиливает замедление.', color:'#7dd9e8'},
    storm:{name:'Школа бури', icon:'ϟ', description:'Открывает молниевое зачарование и цепные разряды.', color:'#c0a1fa'},
    economy:{name:'Королевская казна', icon:'◈', description:'Постройки и улучшения дешевле; награда волн выше.', color:'#83d9a1'}
  };

  const UPGRADES = {
    archer:{a:{name:'Залп',description:'Бьёт 3 цели; уровни 4/6/8 добавляют по одной цели.',cost:124},b:{name:'Длинный лук',description:'Пробивает броню; уровень 4 усиливает урон по боссам, 6 бьёт 2 цели, 8 — 3.',cost:130}},
    mortar:{a:{name:'Осадный заряд',description:'Большой взрыв; уровни 4/6/8 увеличивают радиус.',cost:156},b:{name:'Зажигательная смесь',description:'Поджигает на 3 секунды; уровни 4/6/8 продлевают горение и усиливают его.',cost:150}},
    frost:{a:{name:'Вечная зима',description:'Замедление 70%; уровни 4/6/8 доводят его до 76/82/88%, с кратким оглушением на 6/8.',cost:137},b:{name:'Хрупкий лёд',description:'Помеченные цели получают на 38% больше урона; уровни 4/6/8 повышают бонус до 48/60/75%.',cost:143}},
    barracks:{a:{name:'Передовой пост',description:'Выставляет 3 стражей; уровни 4/6/8 дают 4/5/6 стражей.',cost:130},b:{name:'Клятва клинка',description:'Один страж бьёт сильнее; с уровня 4 рассекает врагов рядом, радиус и урон растут на 6/8.',cost:143}},
    arcane:{a:{name:'Эхо маны',description:'Один разряд перескакивает на 3 цели; уровни 4/6/8 добавляют прыжки до 4/5/6 целей.',cost:169},b:{name:'Казнь',description:'Казнит цель ниже 30% здоровья; уровни 4/6/8 повышают порог и урон, особенно по боссам.',cost:163}},
    trap:{a:{name:'Ядовитая руна',description:'Яд действует 4 секунды; уровни 4/6/8 продлевают его до 5/6/7 секунд и снижают броню.',cost:98},b:{name:'Руна оцепенения',description:'Замедляет на 2.8 секунды; уровни 4/6/8 продлевают эффект до 3.4/4/4.8 секунды.',cost:111}}
  };

  const TOTAL_WAVES=30, MAX_TOWER_LEVEL=8, MAX_RESEARCH_LEVEL=7;
  const WAVE_BOSSES=Object.fromEntries(Array.from({length:TOTAL_WAVES/5},(_,i)=>[(i+1)*5,['boss5','boss10','boss15','boss20'][i%4]]));
  WAVE_BOSSES[TOTAL_WAVES]='boss20';
  const AFFINITIES={
    fire:{name:'Пламя',color:'#ff8052',icon:'♨',description:'Уязвимы к холоду, устойчивы к огню.'},
    frost:{name:'Мороз',color:'#79d9ee',icon:'❄',description:'Уязвимы к огню, устойчивы к холоду.'},
    storm:{name:'Буря',color:'#c0a1fa',icon:'ϟ',description:'Уязвимы к огню, устойчивы к молнии.'}
  };
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const copy=o=>JSON.parse(JSON.stringify(o));

  function getWaveInfo(n) {
    n = Math.max(1, Math.floor(Number(n)||1));
    const boss=n===TOTAL_WAVES?'boss20':n%5===0?['boss5','boss10','boss15','boss20'][(n/5-1)%4]:null;
    const count=Math.min(68,Math.round(7+n*.76));
    const types=n<3?['raider','runner']:n<6?['raider','runner','knight']:n<10?['knight','shaman','wraith','runner']:['knight','shaman','wraith','golem','dragon'];
    const affinity=n<12?'neutral':['fire','frost','storm','neutral'][Math.floor((n-12)/5)%4];
    const name=boss?ENEMIES[boss].name:`Волна ${n} · ${n<5?'Разведчики':n<10?'Чёрный легион':n<15?'Пробуждение древних':n<35?'Осадный поход':n<70?'Бесконечная ночь':'Последний поход'}`;
    const description=boss?`Босс: ${ENEMIES[boss].name}. ${ENEMIES[boss].fly?'Летит над ловушками и стражей. ':''}Броня ${Math.round(ENEMIES[boss].armor*100)}%.`:`${count} врагов. ${types.map(t=>ENEMIES[t].name).join(' · ')}.`;
    const tips=boss?'Подготовьте разные стихии и следите за осадной атакой босса.':affinity==='neutral'?'Смешивайте типы башен и прикрывайте дорогу.':`${AFFINITIES[affinity].name}: ${AFFINITIES[affinity].description}`;
    return {name,description,enemies:types,count,boss:boss||null,affinity,tips};
  }

  function waveQueue(n) {
    const info=getWaveInfo(n); const arr=[];
    if (n<3) {
      for(let i=0;i<info.count;i++) arr.push(i%5===4?'runner':'raider');
    } else if (n<5) {
      for(let i=0;i<info.count;i++) arr.push(i%6===4?'knight':i%3===2?'runner':'raider');
    } else {
      const pool=info.enemies;
      for(let i=0;i<info.count;i++) arr.push(pool[(i*7+Math.floor(i/4)+n)%pool.length]);
    }
    if(info.boss) arr.push(info.boss);
    return arr;
  }

  class Game {
    constructor(){ this.reset(); }
    reset(){
      this.autoWaves=false; this.lastResearch=null; this.phase='build'; this.wave=0; this.gold=360; this.lives=20; this.towers=[]; this.enemies=[];
      this.projectiles=[]; this.effects=[]; this.troops=[]; this.events=[]; this.time=0; this.kills=0;
      this.research={military:0,fire:0,frost:0,storm:0,economy:0}; this.stats={damage:0,leaks:0,wavesWon:0};
      this.queue=[]; this.spawnTimer=0; this.pendingGold=0; this.nextId=1; this.selectedTarget=null;
      this.spellCooldowns={meteor:0,freeze:0}; this.difficulty=1;
      this.defeatReason=null;
      return this;
    }
    getBuildCost(type){ const d=TOWERS[type]; return d?Math.ceil(d.cost*(1+Math.max(0,this.wave-1)*.035+this.towers.length*.018)*Math.max(.68,1-this.research.economy*.04)):Infinity; }
    getUpgradeOptions(tower){
      const t=typeof tower==='object'?tower:this.towers.find(x=>x.id===tower);
      if(!t||t.level>=MAX_TOWER_LEVEL)return [];
      const choices=UPGRADES[t.type]||{};
      const tier=t.level+1, branchCost=choices[t.branch||'a']?.cost||90, base=tier===2?branchCost:branchCost*Math.pow(1.7,tier-2);
      const price=c=>Math.ceil(c*(tier===2?1.3:1)*(1+Math.max(0,this.wave-1)*.004)*Math.max(.75,1-this.research.economy*.012));
      if(t.level===1)return ['a','b'].map(id=>({id,...choices[id],cost:price(choices[id].cost),locked:false}));
      const perks={
        archer:{a:{4:'Добавит четвёртую цель.',6:'Добавит пятую цель.',8:'Добавит шестую цель.'},b:{4:'Урон по боссам станет выше на 35%.',6:'Начнёт поражать вторую цель.',8:'Начнёт поражать третью цель.'}},
        mortar:{a:{4:'Радиус взрыва вырастет на 20%.',6:'Радиус взрыва вырастет ещё на 35%.',8:'Радиус взрыва вырастет ещё на 45%.'},b:{4:'Горение продлится 4 секунды.',6:'Горение продлится 5 секунд и нанесёт больше урона.',8:'Горение продлится 6 секунд и нанесёт ещё больше урона.'}},
        frost:{a:{4:'Замедление усилится до 76%.',6:'Замедление достигнет 82% и появится короткое оглушение.',8:'Замедление достигнет 88%, оглушение станет сильнее.'},b:{4:'Бонус по метке вырастет до 48%.',6:'Бонус по метке вырастет до 60%.',8:'Бонус по метке вырастет до 75%.'}},
        barracks:{a:{4:'Появится четвёртый страж.',6:'Появится пятый страж.',8:'Появится шестой страж.'},b:{4:'Удар заденет врагов в радиусе 26.',6:'Радиус вырастет до 38, урон по соседям до 50%.',8:'Радиус вырастет до 50, урон по соседям до 65%.'}},
        arcane:{a:{4:'Разряд сможет перескочить на 4 цели.',6:'Разряд сможет перескочить на 5 целей.',8:'Разряд сможет перескочить на 6 целей.'},b:{4:'Казнь начнётся при 35% здоровья и усилится против боссов.',6:'Казнь начнётся при 40% здоровья и станет сильнее.',8:'Бонус казни достигнет предела.'}},
        trap:{a:{4:'Яд продлится 5 секунд и снизит броню цели.',6:'Яд продлится 6 секунд.',8:'Яд продлится 7 секунд.'},b:{4:'Замедление продлится 3.4 секунды.',6:'Замедление продлится 4 секунды.',8:'Замедление продлится 4.8 секунды.'}}
      };
      const perk=perks[t.type]?.[t.branch]?.[tier]||`Урон и прочие параметры вырастут на ${tier>=8?85:tier>=6?48:tier>=4?22:10}%.`;
      return [{id:t.branch,name:`${choices[t.branch]?.name||'Улучшение'} ${tier}`,description:perk,cost:price(base),locked:false}];
    }
    getEnchantCost(tower){ const t=typeof tower==='object'?tower:this.towers.find(x=>x.id===tower); return t?Math.round((72+t.level*24)*(1+Math.max(0,this.wave-1)*.025)):Infinity; }
    build(type,padIndex){
      const def=TOWERS[type], pad=PADS[padIndex];
      if(!['build','wave'].includes(this.phase))return {ok:false,message:'Сначала выберите развитие королевства.'};
      if(!def)return {ok:false,message:'Неизвестная постройка.'};
      if(!Number.isInteger(padIndex)||!pad)return {ok:false,message:'Выберите свободное место.'};
      if(this.towers.some(t=>t.pad===padIndex))return {ok:false,message:'Это место уже занято.'};
      const cost=this.getBuildCost(type);
      if(this.gold<cost)return {ok:false,message:`Нужно ещё ${cost-this.gold} ◈.`};
      const tower={id:this.nextId++,type,pad:padIndex,x:pad.x,y:pad.y,level:1,branch:null,element:null,spent:cost,cooldown:.15,targetAngle:-Math.PI/2,triggered:false,used:0,attackAt:0,maxHp:this.towerMaxHp(type,1),hp:this.towerMaxHp(type,1)};
      this.gold-=cost; this.towers.push(tower); this.events.push({type:'build',tower:type,towerId:tower.id,x:pad.x,y:pad.y});
      return {ok:true,message:`${def.name} возведена.`,tower};
    }
    upgrade(id,branch='a'){
      const t=this.towers.find(x=>x.id===id); if(!t)return {ok:false,message:'Башня не найдена.'};
      if(t.hp!==undefined&&t.hp<=0)return {ok:false,message:'Разрушенную башню нельзя улучшить.'};
      if(!['build','wave'].includes(this.phase))return {ok:false,message:'Улучшения доступны при подготовке и во время боя.'};
      if(t.level>=MAX_TOWER_LEVEL)return {ok:false,message:'Башня уже достигла предела.'};
      const options=this.getUpgradeOptions(t); const choice=options.find(x=>x.id===branch);
      if(!choice)return {ok:false,message:'Эта ветка улучшения недоступна.'};
      const cost=choice.cost;
      if(this.gold<cost)return {ok:false,message:`Для улучшения нужно ${cost} ◈.`};
      const fraction=clamp((t.hp??t.maxHp)/(t.maxHp||1),0,1);this.gold-=cost; t.spent=(t.spent||0)+cost; t.level++; if(t.level===2)t.branch=branch;t.maxHp=this.towerMaxHp(t.type,t.level);t.hp=Math.round(t.maxHp*fraction);
      this.events.push({type:'upgrade',tower:t.type,towerId:t.id,x:t.x,y:t.y,branch});
      return {ok:true,message:`Улучшение «${choice.name}» изучено.`,tower:t};
    }
    enchant(id,element){
      const t=this.towers.find(x=>x.id===id); const school={fire:'fire',frost:'frost',storm:'storm'}[element];
      if(!t)return {ok:false,message:'Башня не найдена.'};
      if(t.hp!==undefined&&t.hp<=0)return {ok:false,message:'Разрушенную башню нельзя зачаровать.'};
      if(!school||!this.research[school])return {ok:false,message:'Сначала развейте эту школу магии.'};
      if(t.element===element)return {ok:false,message:'Эта стихия уже установлена.'};
      if(!['build','wave'].includes(this.phase))return {ok:false,message:'Зачарования доступны при подготовке и во время боя.'};
      const cost=this.getEnchantCost(t); if(this.gold<cost)return {ok:false,message:`Нужно ${cost} ◈.`};
      this.gold-=cost; t.spent=(t.spent||0)+cost; t.element=element; this.events.push({type:'enchant',element,towerId:t.id,x:t.x,y:t.y});
      return {ok:true,message:`Орудие зачаровано: ${element}.`,tower:t};
    }
    sell(id){
      if(this.phase!=='build')return {ok:false,message:'Сначала выберите развитие королевства.'};
      const i=this.towers.findIndex(t=>t.id===id); if(i<0)return {ok:false,message:'Башня не найдена.'};
      const t=this.towers[i];
      const refund=Math.floor((t.spent||TOWERS[t.type].cost)*.62*clamp((t.hp??t.maxHp??1)/(t.maxHp||1),0,1));
      this.gold+=refund; this.towers.splice(i,1); this.events.push({type:'sell',towerId:t.id,x:t.x,y:t.y});
      return {ok:true,message:`Получено ${refund} ◈.`,refund};
    }
    getRepairCost(tower){const t=typeof tower==='object'?tower:this.towers.find(x=>x.id===tower);if(!t||!t.maxHp)return 0;const hp=Number.isFinite(+t.hp)?clamp(+t.hp,0,t.maxHp):t.maxHp;if(hp<=0||hp>=t.maxHp)return 0;return Math.max(1,Math.ceil((t.spent||TOWERS[t.type].cost)*.18*(1-hp/t.maxHp)));}
    repair(id){const t=this.towers.find(x=>x.id===id);if(!t)return {ok:false,message:'Башня не найдена.'};if(t.hp<=0)return {ok:false,message:'Разрушенную башню нельзя восстановить.'};if(this.phase!=='build')return {ok:false,message:'Ремонт доступен между волнами.'};const cost=this.getRepairCost(t);if(!cost)return {ok:false,message:'Башня не повреждена.'};if(this.gold<cost)return {ok:false,message:`Нужно ${cost} ◈.`};this.gold-=cost;t.hp=t.maxHp;this.events.push({type:'repair',towerId:t.id,x:t.x,y:t.y,cost});return {ok:true,message:`Башня восстановлена за ${cost} ◈.`,tower:t,cost};}
    cast(type,x,y){
      if(this.phase!=='wave')return {ok:false,message:'Заклинания доступны во время боя.'};
      if(!['meteor','freeze'].includes(type))return {ok:false,message:'Неизвестное заклинание.'};
      if(this.spellCooldowns[type]>0)return {ok:false,message:'Заклинание ещё восстанавливается.'};
      const cost=type==='meteor'?55:40; if(this.gold<cost)return {ok:false,message:`Нужно ${cost} ◈.`};
      this.gold-=cost;
      if(type==='meteor'){
        this.spellCooldowns.meteor=18; const r=94,damage=(145+this.research.fire*30)*(1+this.wave*.025);
        this.effects.push({x,y,type:'meteor',color:'#ff9a58',life:1.1,maxLife:1.1,radius:r});
        for(const e of this.enemies)if(dist(e,{x,y})<r)this.damageEnemy(e,damage,'fire',null,{burn:3});
      }else{
        this.spellCooldowns.freeze=22;
        this.effects.push({x:500,y:325,type:'freeze',color:'#8ce7f5',life:1.25,maxLife:1.25,radius:900});
        for(const e of this.enemies)this.damageEnemy(e,0,'frost',null,{slow:3+this.research.frost*.1,slowDuration:3+this.research.frost*.1,slowFactor:.28});
      }
      this.events.push({type:'cast',spell:type,x,y}); return {ok:true,message:type==='meteor'?'Метеор обрушился!':'Время замерло!'};
    }
    chooseResearch(id,automatic=false){
      if(this.phase!=='research')return {ok:false,message:'Сейчас королевство не выбирает развитие.'};
      if(!RESEARCH[id])return {ok:false,message:'Неизвестное направление.'};
      if(this.research[id]>=MAX_RESEARCH_LEVEL&&!automatic)return {ok:false,message:'Это направление уже достигло предела.'};
      this.research[id]=Math.min(MAX_RESEARCH_LEVEL,this.research[id]+1); this.lastResearch=id;
      const bonus=id==='economy'?Math.round((18+this.wave*1.1)*(1+(this.research.economy-1)*.05)):Math.round(8+this.wave*.55);
      if(id==='military'){
        this.lives=Math.min(20,this.lives+1);
        for(const t of this.towers){const fraction=clamp((t.hp??t.maxHp)/(t.maxHp||1),0,1);t.maxHp=this.towerMaxHp(t.type,t.level);t.hp=Math.round(t.maxHp*fraction);}
      }
      this.gold+=bonus; this.events.push({type:'research',id,bonus}); this.phase='build';
      return {ok:true,message:`${RESEARCH[id].name}: уровень ${this.research[id]}. +${bonus} ◈`,bonus};
    }
    startWave(){
      if(this.phase!=='build')return {ok:false,message:'Сначала выберите развитие королевства.'};
      if(this.wave>=TOTAL_WAVES&&!this.autoWaves)return {ok:false,message:'Поход уже завершён.'};
      this.wave++; this.phase='wave'; this.queue=waveQueue(this.wave); this.spawnTimer=.35;
      this.events.push({type:'wave',wave:this.wave});
      const boss=getWaveInfo(this.wave).boss; if(boss)this.events.push({type:'boss',enemy:boss});
      return {ok:true,message:getWaveInfo(this.wave).name};
    }
    getTowerStats(t){
      if(typeof t==='number'||typeof t==='string')t=this.towers.find(x=>x.id===t);
      if(!t||!TOWERS[t.type])return null;
      const d=TOWERS[t.type],lvl=t.level||1, military=1+this.research.military*.09;
      let damage=d.damage*(1+(lvl-1)*.56)*military, range=d.range*(1+(lvl-1)*.07), rate=d.rate*(1+(lvl-1)*.07);
      let splash=d.splash||0, slow=d.slow||0, targets=1, troops=1, chainHops=0, poisonDuration=0, burnDuration=0, burnDps=0, snareDuration=0, stun=0, markMultiplier=1, cleaveRadius=0, cleaveDamage=0, executeThreshold=0, executeMultiplier=0, bossMultiplier=1;
      const milestone=lvl>=8?8:lvl>=6?6:lvl>=4?4:2;
      const tierBoost=lvl>=8?1.85:lvl>=6?1.48:lvl>=4?1.22:1;
      damage*=tierBoost;
      if(t.type==='barracks'){
        troops=t.branch==='a'?({2:3,4:4,6:5,8:6}[milestone]||1):1;damage*=t.branch==='b'?1.82:1.12;
        if(t.branch==='b'&&lvl>=4){cleaveRadius=lvl>=8?50:lvl>=6?38:26;cleaveDamage=lvl>=8?.65:lvl>=6?.5:.35;}
        if(t.element==='fire')damage*=1+this.research.fire*.13;
        if(t.element==='frost'){damage*=1+this.research.frost*.045;slow=Math.max(slow,Math.min(.78,.26+this.research.frost*.026));}
        if(t.element==='storm')damage*=1+this.research.storm*.08;
        return {damage,range,rate,splash,slow,slowFactor:slow?1-slow:1,targets,troops,cleaveRadius,cleaveDamage,kind:d.kind,element:t.element,color:t.element?RESEARCH[t.element].color:d.color,maxHp:t.maxHp??this.towerMaxHp(t.type,lvl)};
      }
      if(t.type==='archer'&&t.branch==='a')targets=({2:3,4:4,6:5,8:6}[milestone]||1);
      if(t.type==='archer'&&t.branch==='b'){damage*=1.65;range*=1.32;targets=lvl>=8?3:lvl>=6?2:1;bossMultiplier=lvl>=4?1.35:1;}
      if(t.type==='mortar'&&t.branch==='a'){damage*=1.5;splash*=1.42+(lvl>=4?.2:0)+(lvl>=6?.35:0)+(lvl>=8?.45:0);}
      if(t.type==='mortar'&&t.branch==='b'){damage*=1.12+(lvl>=6?.24:0);burnDuration=lvl>=8?6:lvl>=6?5:lvl>=4?4:3;burnDps=damage*(lvl>=8?.22:lvl>=6?.18:lvl>=4?.14:.11);}
      if(t.type==='frost'&&t.branch==='a'){slow=({2:.70,4:.76,6:.82,8:.88}[milestone]||.48);damage*=1.5;stun=lvl>=8?.4:lvl>=6?.25:0;}
      if(t.type==='frost'&&t.branch==='b'){markMultiplier=({2:1.38,4:1.48,6:1.60,8:1.75}[milestone]||1);damage*=.86+(markMultiplier-1)*.6;}
      if(t.type==='arcane'&&t.branch==='a'){targets=1;chainHops=({2:2,4:3,6:4,8:5}[milestone]||0);}
      if(t.type==='arcane'&&t.branch==='b'){damage*=1.22+(lvl>=6?.28:0);executeThreshold=({2:.30,4:.35,6:.40,8:.40}[milestone]||.30);executeMultiplier=({2:1.9,4:2.25,6:2.6,8:3}[milestone]||1.9);bossMultiplier=lvl>=4?1.25:1;}
      if(t.type==='trap'&&t.branch==='a'){poisonDuration=({2:4,4:5,6:6,8:7}[milestone]||0);}
      if(t.type==='trap'&&t.branch==='b'){snareDuration=({2:2.8,4:3.4,6:4,8:4.8}[milestone]||2.8);slow=snareDuration;}
      if(t.element==='fire')damage*=1+this.research.fire*.13;
      if(t.element==='frost')damage*=1+this.research.frost*.045;
      if(t.element==='frost')slow=Math.max(slow,Math.min(.78,.26+this.research.frost*.026));
      if(t.element==='storm'){damage*=1+this.research.storm*.08; if(t.type==='arcane'||t.type==='archer')targets=Math.max(targets,2);}
      return {damage,range,rate,splash,slow,slowFactor:slow?1-slow:1,targets,chainHops,poisonDuration,burnDuration,burnDps,snareDuration,stun,markMultiplier,executeThreshold,executeMultiplier,bossMultiplier,kind:d.kind,element:t.element,color:t.element?RESEARCH[t.element].color:d.color,maxHp:t.maxHp??this.towerMaxHp(t.type,lvl)};
    }
    towerMaxHp(type,level=1){const base={archer:190,mortar:220,frost:180,barracks:240,arcane:180,trap:160}[type]||180;return Math.round(base*(1+(level-1)*.18)*(1+this.research.military*.025));}
    getEnemyTraits(typeOrInstance){
      const e=typeof typeOrInstance==='string'?{type:typeOrInstance}:typeOrInstance||{},type=e.type||'raider';
      const table={dragon:{resistances:[{element:'fire',multiplier:.45}],weaknesses:[{element:'frost',multiplier:1.65}]},boss15:{resistances:[{element:'fire',multiplier:.55}],weaknesses:[{element:'frost',multiplier:1.55}]},boss20:{resistances:[{element:'fire',multiplier:.5}],weaknesses:[{element:'frost',multiplier:1.7}]},golem:{weaknesses:[{element:'storm',multiplier:1.7}],resistances:[{element:'fire',multiplier:.65}]},boss5:{weaknesses:[{element:'storm',multiplier:1.4}]},wraith:{weaknesses:[{element:'storm',multiplier:1.55}]},shaman:{weaknesses:[{element:'fire',multiplier:1.55}],resistances:[{element:'arcane',multiplier:.6}]},boss10:{weaknesses:[{element:'fire',multiplier:1.8}],resistances:[{element:'frost',multiplier:.45}]}};
      const multipliers=new Map(),apply=(items)=>{for(const item of items||[])multipliers.set(item.element,(multipliers.get(item.element)||1)*item.multiplier);};
      const base=table[type]||{};apply(base.weaknesses);apply(base.resistances);
      const affinity=Object.prototype.hasOwnProperty.call(AFFINITIES,e.affinity)?e.affinity:null;
      if(affinity){const weak={fire:'frost',frost:'fire',storm:'fire'}[affinity],resist={fire:'fire',frost:'frost',storm:'storm'}[affinity];apply([{element:weak,multiplier:1.35},{element:resist,multiplier:.65}]);}
      const weaknesses=[],resistances=[];for(const [element,value] of multipliers){const multiplier=clamp(value,.25,2);if(multiplier>1)weaknesses.push({element,multiplier});else if(multiplier<1)resistances.push({element,multiplier});}
      return {weaknesses,resistances,affinity,labels:affinity?[AFFINITIES[affinity].name]:[]};
    }
    getDamageMultiplier(enemy,element){const traits=this.getEnemyTraits(enemy);return traits.weaknesses.find(x=>x.element===element)?.multiplier??traits.resistances.find(x=>x.element===element)?.multiplier??1;}
    update(dt){
      dt=clamp(Number(dt)||0,0,.06); if(!dt)return;
      this.time+=dt;
      for(const s of Object.keys(this.spellCooldowns))this.spellCooldowns[s]=Math.max(0,this.spellCooldowns[s]-dt);
      for(const fx of this.effects)fx.life-=dt;
      this.effects=this.effects.filter(f=>f.life>0);
      if(this.phase!=='wave')return;
      this.spawnTimer-=dt;
      if(this.queue.length&&this.spawnTimer<=0){
        this.spawn(this.queue.shift()); const gap=this.wave>=15?.58:this.wave>=8?.72:.9;
        this.spawnTimer=gap*(this.queue.length<3?.85:1);
      }
      this.updateEnemies(dt);
      if(this.phase!=='wave')return;
      this.updateTowers(dt);
      this.updateProjectiles(dt);
      this.updateTroops(dt);
      if(!this.queue.length&&!this.enemies.length&&this.phase==='wave')this.finishWave();
    }
    spawn(type){
      const def=ENEMIES[type];if(!def)return;
      const waveIndex=Math.max(0,this.wave-1),bossIndex=Math.max(0,this.wave-5);
      const scale=1+.14*waveIndex+.005*waveIndex*waveIndex;
      const bossScale=1+.11*bossIndex+.004*bossIndex*bossIndex;
      const hp=Math.round(def.hp*(def.boss?bossScale:scale));
      const info=getWaveInfo(this.wave);let affinity=null,name=def.name,color=def.color;
      if(!def.boss&&info.affinity!=='neutral'&&['fire','frost','storm'].includes(info.affinity)){affinity=info.affinity;const adjective={fire:'Огненный',frost:'Ледяной',storm:'Грозовой'}[affinity];name=`${adjective} ${name}`;color=AFFINITIES[affinity].color;}
      const enemy={id:this.nextId++,type,name,affinity,color,x:PATH[0].x,y:PATH[0].y,hp,maxHp:hp,progress:0,speed:def.speed*(1+Math.max(0,this.wave-1)*.007),armor:def.armor||0,fly:!!def.fly,boss:!!def.boss,facing:1,animState:'walk',animTime:0,animAttack:0,slow:0,slowFactor:1,stun:0,burn:0,burnDps:0,poison:0,poisonDps:0,armorBreakTimer:0,marked:0,markedMultiplier:1,healCooldown:1.6,abilityCooldown:5,radius:def.boss?20:def.hp>300?14:10,alive:true,siegeCooldown:8+Math.random()*3,siegeTarget:null,siegeTimer:0};
      this.enemies.push(enemy);
    }
    setEnemyAnimation(e,state,duration=0){
      if(e.animState!==state){e.animState=state;e.animTime=0;}
      if(duration)e.animAttack=Math.max(e.animAttack||0,duration);
    }
    updateEnemies(dt){
      const lengths=[];let total=0;
      for(let i=0;i<PATH.length-1;i++){const l=dist(PATH[i],PATH[i+1]);lengths.push(l);total+=l;}
      for(const e of [...this.enemies]){
        if(e.hp<=0)continue;
        e.animAttack=Math.max(0,(e.animAttack||0)-dt);
        if(e.slow>0){e.slow=Math.max(0,e.slow-dt);if(!e.slow)e.slowFactor=1;}
        if(e.stun>0)e.stun=Math.max(0,e.stun-dt);
        if(e.armorBreakTimer>0)e.armorBreakTimer=Math.max(0,e.armorBreakTimer-dt);
        if(e.marked>0){e.marked=Math.max(0,e.marked-dt);if(!e.marked)e.markedMultiplier=1;}
        if(e.burn>0){e.burn=Math.max(0,e.burn-dt);this.damageEnemy(e,e.burnDps*dt,'fire',null);}
        if(e.poison>0){e.poison=Math.max(0,e.poison-dt);this.damageEnemy(e,e.poisonDps*dt,'poison',null);}
        if(e.hp<=0)continue;
        const def=ENEMIES[e.type];
        if(def.heal){e.healCooldown-=dt;if(e.healCooldown<=0){e.healCooldown=2.2;let target=null;for(const q of this.enemies)if(q!==e&&q.hp>0&&q.maxHp-q.hp>8&&dist(e,q)<100&&(!target||q.maxHp-q.hp>target.maxHp-target.hp))target=q;if(target){target.hp=Math.min(target.maxHp,target.hp+def.heal);this.setEnemyAnimation(e,'attack',.5);this.effects.push({x:target.x,y:target.y,type:'heal',color:'#80edaa',life:.55,maxLife:.55,radius:24});}}}
        if(def.boss){
          if(e.siegeTimer>0){e.siegeTimer-=dt;if(e.siegeTimer<=0){const target=this.towers.find(t=>t.id===e.siegeTarget);if(target){const damage=Math.round(34+this.wave*1.35+(e.type==='boss20'?75:0));const area=e.type==='boss15'||e.type==='boss20'?86:0;const hit=[target,...(area?this.towers.filter(t=>t.id!==target.id&&dist(t,target)<area):[])];for(const t of hit){t.hp=Math.max(0,(t.hp??t.maxHp)-damage);this.events.push({type:'tower-hit',towerId:t.id,damage,hp:t.hp,maxHp:t.maxHp,x:t.x,y:t.y});this.effects.push({x:t.x,y:t.y,type:'siege-impact',color:def.color,life:.65,maxLife:.65,radius:area||32});if(t.hp<=0){this.towers=this.towers.filter(x=>x.id!==t.id);this.troops=this.troops.filter(x=>x.owner!==t.id);this.effects=this.effects.filter(f=>f.towerId!==t.id);this.events.push({type:'tower-destroyed',towerId:t.id,tower:t.type,x:t.x,y:t.y,enemy:e.type});}}}e.siegeTarget=null;e.siegeCooldown=8+Math.random()*3;}
          }else{e.siegeCooldown-=dt;if(e.siegeCooldown<=0){const target=this.towers.filter(t=>dist(t,e)<=220).sort((a,b)=>dist(a,e)-dist(b,e))[0];if(target){e.siegeTarget=target.id;e.siegeTimer=1.2;this.setEnemyAnimation(e,'attack',1.2);this.effects.push({x:target.x,y:target.y,type:'siege-warning',life:1.2,maxLife:1.2,radius:e.type==='boss15'||e.type==='boss20'?86:34,color:def.color,enemyId:e.id,towerId:target.id});this.events.push({type:'siege-warning',enemy:e.type,enemyId:e.id,towerId:target.id,x:target.x,y:target.y,delay:1.2});}else e.siegeCooldown=2;}}
          e.abilityCooldown-=dt;
          if(e.abilityCooldown<=0){e.abilityCooldown=def.ability==='inferno'?5.5:7.5;
            this.setEnemyAnimation(e,'attack',.5);
            if(def.ability==='roar'||def.ability==='frost'){
              for(const t of this.towers)if(dist(t,e)<250)t.cooldown=Math.max(t.cooldown,.85);
              this.effects.push({x:e.x,y:e.y,type:'pulse',color:def.color,life:.65,maxLife:.65,radius:155});
            }else if(def.ability==='surge'||def.ability==='inferno'){
              e.progress+=def.ability==='inferno'?44:27;
              this.effects.push({x:e.x,y:e.y,type:'surge',color:def.color,life:.55,maxLife:.55,radius:45});
            }
          }
        }
        const held=this.troops.some(q=>q.enemyId===e.id&&this.towers.some(t=>t.id===q.owner));
        const slowFactor=e.slow>0?(e.slowFactor||.5):1;
        const moveFactor=e.stun>0?0:(held?.46:1)*slowFactor;
        const animState=held||e.animAttack>0?'attack':'walk';
        this.setEnemyAnimation(e,animState);
        e.animTime=(e.animTime||0)+dt*(animState==='walk'?moveFactor:1);
        const vel=e.speed*moveFactor;
        e.progress+=vel*dt;
        let p=e.progress;
        for(let i=0;i<lengths.length;i++){
          if(p<=lengths[i]){const a=PATH[i],b=PATH[i+1],t=lengths[i]?p/lengths[i]:1;e.x=a.x+(b.x-a.x)*t;e.y=a.y+(b.y-a.y)*t;if(b.x!==a.x)e.facing=Math.sign(b.x-a.x)||e.facing;break;}
          p-=lengths[i];
        }
        if(e.progress>=total){
          e.hp=0;this.effects=this.effects.filter(f=>f.enemyId!==e.id);this.lives=Math.max(0,this.lives-(def.boss?5:1));this.stats.leaks++;
          this.events.push({type:'leak',enemy:e.type,x:990,y:e.y,lives:this.lives});
          this.effects.push({x:970,y:e.y,type:'leak',color:'#ff6375',life:.75,maxLife:.75,radius:42});
          if(e.type==='boss20'&&this.wave===TOTAL_WAVES){this.phase='defeat';this.defeatReason='last-boss-escaped';this.events.push({type:'defeat',reason:this.defeatReason});}
        }
      }
      this.enemies=this.enemies.filter(e=>e.hp>0);
      if(this.lives<=0&&this.phase!=='defeat'){this.phase='defeat';this.defeatReason='lives-depleted';this.events.push({type:'defeat',reason:this.defeatReason});}
    }
    updateTowers(dt){
      for(const t of this.towers){
        t.cooldown=Math.max(0,t.cooldown-dt);
        if(t.type==='trap'&&t.cooldown<=0)t.triggered=false;
        const s=this.getTowerStats(t); if(t.cooldown>0)continue;
        const targets=this.enemies.filter(e=>!(e.fly&&['trap','melee'].includes(s.kind))&&!(e.fly&&t.type==='mortar')).filter(e=>dist(t,e)<=s.range);
        if(!targets.length)continue;
        targets.sort((a,b)=>{
          if(t.type==='arcane'&&t.branch==='b'&&Math.abs(a.hp/a.maxHp-b.hp/b.maxHp)>.2)return a.hp/a.maxHp-b.hp/b.maxHp;
          return b.progress-a.progress;
        });
        const target=targets[0];t.targetAngle=Math.atan2(target.y-t.y,target.x-t.x);
        if(t.type==='trap'){
          if(t.triggered)continue;t.triggered=true;t.cooldown=s.rate;t.attackAt=this.time;
          this.triggerTrap(t,s,target);continue;
        }
        t.cooldown=s.rate;
        if(t.type==='barracks'){
          t.attackAt=this.time;
          this.ensureTroops(t,s); continue;
        }
        t.attackAt=this.time;
        for(let i=0;i<s.targets;i++){
          const targetN=targets[i];if(!targetN)break;
          this.projectiles.push({x:t.x,y:t.y,tx:targetN.x,ty:targetN.y,targetId:targetN.id,speed:t.type==='mortar'?300:t.type==='arcane'?520:620,damage:s.damage,type:t.type,color:s.color,splash:s.splash,slow:s.slow,slowFactor:s.slowFactor,branch:t.branch,element:t.element,owner:t.id,life:1.5,chainHops:s.chainHops,poisonDuration:s.poisonDuration,burnDuration:s.burnDuration,burnDps:s.burnDps,stun:s.stun,markMultiplier:s.markMultiplier});
          this.events.push({type:'shoot',tower:t.type,towerId:t.id,x:t.x,y:t.y,color:s.color});
        }
      }
    }
    ensureTroops(t,s){
      let soldiers=this.troops.filter(q=>q.owner===t.id);
      const max=s.troops||1;
      while(soldiers.length<max){const troop={id:this.nextId++,owner:t.id,x:t.x+(soldiers.length-.5)*12,y:t.y+20,enemyId:null,cooldown:Math.random()*.4,phase:Math.random()*6.28,animState:'walk',animTime:0,attackAt:0};this.troops.push(troop);soldiers.push(troop);}
      soldiers.forEach((q,i)=>{q.x=t.x+(i-(max-1)/2)*13;q.y=t.y+18;});
    }
    updateTroops(dt){
      for(const t of [...this.towers].filter(x=>x.type==='barracks')){
        const s=this.getTowerStats(t);this.ensureTroops(t,s);
        const assigned=new Set();
        for(const q of this.troops.filter(x=>x.owner===t.id)){
          q.cooldown=Math.max(0,q.cooldown-dt);
          q.animTime=(q.animTime||0)+dt;
          let e=q.enemyId&&this.enemies.find(x=>x.id===q.enemyId);
          if(!e||assigned.has(e.id)||dist(t,e)>s.range+45||e.fly){e=this.enemies.filter(x=>!x.fly&&!assigned.has(x.id)&&dist(t,x)<s.range+12).sort((a,b)=>b.progress-a.progress)[0];q.enemyId=e?e.id:null;}
          if(e){assigned.add(e.id);q.phase+=dt*8;q.animState='walk';if(q.cooldown<=0){q.cooldown=s.rate;q.animState='attack';q.animTime=0;q.attackAt=this.time;t.attackAt=this.time;this.damageEnemy(e,s.damage,s.element||'physical',t,this.elementEffects(t,s));if(s.cleaveRadius)for(const other of this.enemies)if(other!==e&&!other.fly&&dist(other,e)<s.cleaveRadius)this.damageEnemy(other,s.damage*s.cleaveDamage,s.element||'physical',t);this.effects.push({x:e.x,y:e.y,type:'slash',color:s.color||'#fff0b0',life:.2,maxLife:.2,radius:22});this.events.push({type:'hit',tower:'barracks',towerId:t.id,enemyId:e.id,x:e.x,y:e.y});}}
        }
      }
    }
    triggerTrap(t,s,target){
      t.triggered=true;t.cooldown=s.rate;t.used=(t.used||0)+1;
      this.effects.push({x:target.x,y:target.y,type:'trap',color:s.color,life:.5,maxLife:.5,radius:s.splash||34});
      for(const e of this.enemies)if(!e.fly&&dist(target,e)<(s.splash||34)+e.radius){
        const extras=this.elementEffects(t,s);
        extras.poison=Math.max(extras.poison||0,s.poisonDuration||0);extras.poisonDps=s.damage*.1;if(t.branch==='a'&&t.level>=4)extras.armorBreak=3;
        if(t.branch==='b'){extras.slow=s.snareDuration||2.8;extras.slowFactor=.28;}
        this.damageEnemy(e,s.damage,t.element||'physical',t,extras);
      }
      this.events.push({type:'hit',tower:'trap',towerId:t.id,enemyId:target.id,x:target.x,y:target.y});
    }
    updateProjectiles(dt){
      for(const p of [...this.projectiles]){
        p.life-=dt; const target=this.enemies.find(e=>e.id===p.targetId);
        if(target){p.tx=target.x;p.ty=target.y;}
        const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy),step=p.speed*dt;
        if(d<=step||p.life<=0){
          if(target){const owner=this.towers.find(t=>t.id===p.owner);this.impact(target,p,owner);}
          this.effects.push({x:p.tx,y:p.ty,type:p.type==='mortar'?'explosion':'spark',color:p.color,life:.28,maxLife:.28,radius:p.splash||10});
          this.projectiles.splice(this.projectiles.indexOf(p),1);
        }else{p.x+=dx/d*step;p.y+=dy/d*step;}
      }
    }
    impact(target,p,owner){
      if(p.type==='mortar'){
        const extras=owner?this.elementEffects(owner,this.getTowerStats(owner)):{};
        if(p.branch==='b'){extras.burn=Math.max(extras.burn||0,p.burnDuration||3);extras.burnDps=p.burnDps||p.damage*.11;}
        if(p.slow){extras.slow=p.slow;extras.slowDuration=1.5;extras.slowFactor=p.slowFactor||1-p.slow;}
        for(const e of this.enemies)if(!e.fly&&dist(e,{x:p.tx,y:p.ty})<=p.splash+e.radius)this.damageEnemy(e,p.damage,p.element||(owner&&owner.type==='arcane'?'arcane':'physical'),owner,extras);
      }else{
        const intrinsic=p.type==='arcane'?'arcane':p.type==='frost'?'frost':'physical';
        const extras=owner?this.elementEffects(owner,{slow:p.slow||0,slowFactor:p.slowFactor||1}):{};
        extras.slow=Math.max(extras.slow||0,p.slow||0);
        if(p.slow){extras.slowDuration=p.type==='frost'?1.5:p.slow;extras.slowFactor=p.slowFactor||1-p.slow;}
        extras.marked=owner&&owner.type==='frost'&&owner.branch==='b'?3:0;extras.markedMultiplier=p.markMultiplier||1;
        extras.chain=Math.max(extras.chain||0,p.chainHops||0);
        if(p.stun)extras.stun=p.stun;
        extras.pierce=owner&&owner.type==='archer'&&owner.branch==='b';
        this.damageEnemy(target,p.damage,p.element||intrinsic,owner,extras);
      }
    }
    damageEnemy(e,amount,element='physical',owner=null,extra={}){
      if(!e||e.hp<=0)return;
      if(e.fly&&owner&&['mortar','barracks','trap'].includes(owner.type))return;
      const isMagic=['fire','frost','storm','arcane','poison'].includes(element);
      let armor=extra.pierce?0:e.armor||0;if(e.armorBreakTimer>0)armor*=.65;
      if(isMagic)armor*=.32;
      if(owner){const stats=this.getTowerStats(owner);if(e.boss&&stats?.bossMultiplier>1)amount*=stats.bossMultiplier;if(stats?.executeThreshold&&e.hp/e.maxHp<=stats.executeThreshold)amount*=stats.executeMultiplier;}
      let damage=amount*(1-armor)*this.getDamageMultiplier(e,element);
      if(e.marked>0)damage*=e.markedMultiplier||1.38;
      e.hp-=damage;this.stats.damage+=damage;
      if(extra.slow){const resistance=Math.min(1,this.getDamageMultiplier(e,'frost')),duration=(extra.slowDuration||extra.slow)*resistance;e.slow=Math.max(e.slow||0,e.boss?Math.min(2.4,duration):duration);const factor=1-(1-(extra.slowFactor||.5))*resistance;e.slowFactor=Math.min(e.slowFactor||1,e.boss?Math.max(.58,factor):factor);}
      if(extra.marked){e.marked=Math.max(e.marked||0,extra.marked);e.markedMultiplier=Math.max(e.markedMultiplier||1,extra.markedMultiplier||1.38);}
      if(extra.stun)e.stun=Math.max(e.stun||0,e.boss?Math.min(.12,extra.stun):extra.stun);
      if(extra.armorBreak)e.armorBreakTimer=Math.max(e.armorBreakTimer||0,extra.armorBreak);
      if(extra.burn){e.burn=Math.max(e.burn||0,extra.burn);e.burnDps=Math.max(e.burnDps||0,extra.burnDps||amount*.11);}
      if(extra.poison){e.poison=Math.max(e.poison||0,extra.poison);e.poisonDps=Math.max(e.poisonDps||0,extra.poisonDps||amount*.075);}
      if(extra.chain){const visited=extra.chainVisited||[e.id],other=this.enemies.filter(x=>!visited.includes(x.id)&&x.hp>0&&!(x.fly&&owner&&['mortar','barracks','trap'].includes(owner.type))&&dist(x,e)<65).sort((a,b)=>dist(a,e)-dist(b,e))[0];if(other){this.damageEnemy(other,amount*.62,'storm',owner,{chain:extra.chain-1,chainVisited:[...visited,other.id]});this.effects.push({x:e.x,y:e.y,type:'chain',color:'#d1b6ff',life:.25,maxLife:.25,radius:dist(e,other)});}}
      this.events.push({type:'hit',enemyId:e.id,enemyType:e.type,towerId:owner?.id,x:e.x,y:e.y,damage:Math.round(damage),color:element==='physical'?'#f7e8c5':RESEARCH[element]?.color||'#d4a8ff'});
      if(e.hp<=0){e.hp=0;this.effects=this.effects.filter(f=>f.enemyId!==e.id);this.kills++;this.pendingGold+=Math.round(ENEMIES[e.type].reward*(1+Math.max(0,this.wave-1)*.012));this.events.push({type:'kill',enemy:e.type,id:e.id,facing:e.facing||1,fly:!!e.fly,x:e.x,y:e.y,reward:Math.round(ENEMIES[e.type].reward*(1+Math.max(0,this.wave-1)*.012))});this.effects.push({x:e.x,y:e.y,type:'death',color:e.color||ENEMIES[e.type].color,life:.45,maxLife:.45,radius:e.radius*1.5});}
    }
    elementEffects(t,s={}){
      const effects={};
      if(t.element==='fire'){
        effects.burn=3;effects.burnDps=(s.damage||this.getTowerStats(t).damage)*.11;
      }else if(t.element==='frost'){
        const slow=Math.max(s.slow||0,.26+this.research.frost*.085);
        effects.slow=1.5;effects.slowDuration=1.5;effects.slowFactor=1-Math.min(.78,slow);
      }else if(t.element==='storm')effects.chain=2;
      return effects;
    }
    finishWave(){
      this.stats.wavesWon++;const base=25+this.wave*4;const bonus=Math.round(base*(1+this.research.economy*.14));
      const reward=this.pendingGold+bonus;this.pendingGold=0;this.gold+=reward;
      this.events.push({type:'reward',amount:reward,wave:this.wave});
      this.enemies=[];this.projectiles=[];
      if(this.wave>=TOTAL_WAVES&&!this.autoWaves){this.phase='victory';this.events.push({type:'victory'});}
      else {this.phase='research';if(this.autoWaves&&this.lastResearch){this.chooseResearch(this.lastResearch,true);this.startWave();}}
    }
    drainEvents(){const out=this.events;this.events=[];return out;}
    serialize(){
      return {v:2,autoWaves:this.autoWaves,lastResearch:this.lastResearch,phase:['build','research','victory','defeat'].includes(this.phase)?this.phase:'build',wave:this.wave,gold:this.gold,lives:this.lives,
        towers:this.towers.map(({id,type,pad,level,branch,element,spent,hp,maxHp})=>({id,type,pad,level,branch,element,spent,hp,maxHp})),research:{...this.research},kills:this.kills,stats:{...this.stats},nextId:this.nextId};
    }
    static restore(data){
      const g=new Game();if(!data||![1,2].includes(data.v))return g;
      g.autoWaves=data.autoWaves===true;g.lastResearch=RESEARCH[data.lastResearch]?data.lastResearch:null;
      const legacy=data.v===1;g.wave=clamp(Number.isFinite(+data.wave)?Math.floor(+data.wave):0,0,g.autoWaves?Number.MAX_SAFE_INTEGER:TOTAL_WAVES);g.gold=clamp(Number.isFinite(+data.gold)?Math.floor(+data.gold):0,0,999999);g.lives=clamp(data.lives===undefined?20:(Number.isFinite(+data.lives)?Math.floor(+data.lives):0),0,20);
      g.phase=['build','research','victory','defeat'].includes(data.phase)?data.phase:'build';
      for(const k of Object.keys(g.research))g.research[k]=clamp(Number.isFinite(+((data.research||{})[k]))?Math.floor(+data.research[k]):0,0,MAX_RESEARCH_LEVEL);
      g.towers=[];
      for(const raw of Array.isArray(data.towers)?data.towers:[]){
        if(!TOWERS[raw.type]||!Number.isInteger(raw.pad)||!PADS[raw.pad]||g.towers.some(t=>t.pad===raw.pad))continue;
        const level=clamp(Number.isFinite(+raw.level)?Math.floor(+raw.level):1,1,MAX_TOWER_LEVEL),branch=['a','b'].includes(raw.branch)?raw.branch:null;
        const element=['fire','frost','storm'].includes(raw.element)?raw.element:null;
        if(level>1&&!branch)continue;
        const maxHp=legacy?g.towerMaxHp(raw.type,level):clamp(Number.isFinite(+raw.maxHp)?Math.floor(+raw.maxHp):g.towerMaxHp(raw.type,level),1,10000),hp=legacy?maxHp:clamp(Number.isFinite(+raw.hp)?Math.floor(+raw.hp):maxHp,0,maxHp);if(!hp)continue;
        g.towers.push({id:Number.isFinite(+raw.id)&&+raw.id>0?Math.floor(+raw.id):g.nextId++,type:raw.type,pad:raw.pad,x:PADS[raw.pad].x,y:PADS[raw.pad].y,level,branch,element,spent:clamp(Number.isFinite(+raw.spent)?Math.floor(+raw.spent):TOWERS[raw.type].cost,0,99999),hp,maxHp,cooldown:.15,targetAngle:-Math.PI/2,triggered:false,used:0,attackAt:0});
      }
      g.nextId=Math.max(g.nextId,Math.floor(+data.nextId||1),...g.towers.map(t=>t.id+1));
      g.kills=Math.max(0,Math.floor(+data.kills||0));g.stats={damage:Math.max(0,+((data.stats||{}).damage)||0),leaks:Math.max(0,Math.floor(+((data.stats||{}).leaks)||0)),wavesWon:Math.max(0,Math.floor(+((data.stats||{}).wavesWon)||0))};
      if(g.phase==='wave'||g.phase==='research'&&g.wave===0)g.phase='build';
      if(legacy&&g.phase==='victory'){g.phase='build';g.wave=20;}
      else if(g.phase==='victory')g.wave=TOTAL_WAVES;
      if(!g.autoWaves&&g.wave>=TOTAL_WAVES&&g.phase!=='defeat')g.phase='victory';
      return g;
    }
  }

  const API={Game,TOWERS,ENEMIES,RESEARCH,PATH,PADS,W:1000,H:650,WAVE_BOSSES,TOTAL_WAVES,MAX_TOWER_LEVEL,MAX_RESEARCH_LEVEL,AFFINITIES,getWaveInfo};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
  if(typeof window!=='undefined')window.TD=API;
})();
