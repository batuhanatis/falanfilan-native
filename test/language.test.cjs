const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { transformSync } = require('@babel/core');
if (!process.env.PELLIX_TEST_RUNTIME) {
  test('language runtime tests (set PELLIX_TEST_RUNTIME)', { skip: true }, () => {});
} else {
const runtime = Module.createRequire(path.join(process.env.PELLIX_TEST_RUNTIME, 'package.json'));
const React = runtime('react'), Renderer = runtime('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
function load(file, mocks) {
  const filename = path.resolve(__dirname, '..', file);
  const { code } = transformSync(fs.readFileSync(filename, 'utf8'), { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'] });
  const mod = new Module(filename); mod.filename = filename;
  mod.require = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.endsWith('.json')) return require(path.resolve(path.dirname(filename), name));
    throw Error('Unmocked import: ' + name);
  };
  mod._compile(code, filename); return mod.exports;
}
const core = load('src/i18n/core.js', {});
const text = n => typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(text).join(' ') : (n?.children || []).map(text).join(' ');

test('language preference restores, switches immediately, and persists across remounts', async () => {
  let saved = 'en', rejectSave = false;
  const store = {getItem: async () => saved, setItem: async (_, value) => { if(rejectSave) throw Error('disk full'); saved=value; }};
  const {LanguageProvider, useLanguage} = load('src/i18n/LanguageContext.js', {react:React,'@react-native-async-storage/async-storage':store,'./core':core});
  let context;
  function Probe(){context=useLanguage();return React.createElement('Text',null,core.t('Ayarlar'));}
  let tree;
  await Renderer.act(async()=>{tree=Renderer.create(React.createElement(LanguageProvider,null,React.createElement(Probe)));});
  assert.equal(text(tree.toJSON()),'Settings');
  await Renderer.act(async()=>{await context.setLanguage('tr');});
  assert.equal(saved,'tr'); assert.equal(text(tree.toJSON()),'Ayarlar');
  rejectSave=true; await assert.rejects(context.setLanguage('en')); assert.equal(core.getLanguage(),'tr');
  await Renderer.act(async()=>tree.unmount());
  rejectSave=false;
  await Renderer.act(async()=>{tree=Renderer.create(React.createElement(LanguageProvider,null,React.createElement(Probe)));});
  assert.equal(context.language,'tr'); await Renderer.act(async()=>tree.unmount());
});

test('English labels, templates, and date locale preserve dynamic values', () => {
  core.setLanguageValue('en');
  assert.equal(core.t('Şu an popüler'),'Popular now');
  assert.equal(core.t('{0} arkadaşın beğendi',{0:12}),'12 friends liked this');
  assert.equal(core.getLocale(),'en-GB');
  assert.equal(core.t('A custom message by Deniz'),'A custom message by Deniz');
  core.setLanguageValue('tr'); assert.equal(core.t('Şu an popüler'),'Şu an popüler');
  assert.equal(core.getLocale(),'tr-TR'); assert.throws(()=>core.setLanguageValue('fr'));
});

test('popular cards keep movie titles unchanged in English', async()=>{
 core.setLanguageValue('en');
 const native={View:'View',Text:'Text',Image:'Image',TouchableOpacity:'TouchableOpacity',ScrollView:'ScrollView',StyleSheet:{create:x=>x,absoluteFillObject:{}},Animated:{Value:class{},loop:()=>({start(){},stop(){}}),sequence:x=>x,timing:()=>({}),View:'AnimatedView'}};
 const {default:PopularNowRow}=load('src/components/PopularNowRow.js',{'../i18n/core':core,react:React,'react-native':native,'../context/ThemeContext':{useAppTheme:()=>({c:{text:'#fff'}})},'../theme/fonts':{FONTS:{}}});
 let tree;await Renderer.act(async()=>{tree=Renderer.create(React.createElement(PopularNowRow,{items:[{id:1,title:'Sen',imdb:8}],onPress(){}}));});
 assert.match(text(tree.toJSON()),/Popular now/); assert.match(text(tree.toJSON()),/Sen/);
 assert.doesNotMatch(text(tree.toJSON()),/You/); await Renderer.act(async()=>tree.unmount());core.setLanguageValue('tr');
});


test('hero uses native paging, locks vertical scroll and animates every letter on each page', async () => {
  core.setLanguageValue('en');
  let nextTimer=0,timers=new Map(),appListener,scrollCalls=[],locks=[],animationStarts=0;
  const oldInterval=global.setInterval,oldClear=global.clearInterval,oldTimeout=global.setTimeout;
  let letterSchedules=0;
  global.setTimeout=(fn,ms)=>{if(ms<600){letterSchedules++;return oldTimeout(fn,60000);}return oldTimeout(fn,ms);};
  global.setInterval=(fn,ms)=>{assert.equal(ms,7000);timers.set(++nextTimer,fn);return nextTimer;};
  global.clearInterval=id=>timers.delete(id);
  const Scroll=React.forwardRef((props,ref)=>{React.useImperativeHandle(ref,()=>({scrollTo:config=>scrollCalls.push(config)}));return React.createElement('HorizontalPager',props,props.children);});
  const native={View:'View',Text:'Text',Image:'Image',TouchableOpacity:'TouchableOpacity',ScrollView:Scroll,StyleSheet:{create:x=>x},
    Animated:{Value:class {setValue(){} stopAnimation(){}},Text:'AnimatedText',timing:()=>({start(){animationStarts++;}})},
    AccessibilityInfo:{isReduceMotionEnabled:async()=>false,addEventListener:()=>({remove(){}})},
    AppState:{currentState:'active',addEventListener:(_,fn)=>{appListener=fn;return {remove(){}};}}};
  let tree;
  try {
    const {default:Hero,formatHeroRuntime}=load('src/components/salon/SeansBoard.js',{
      '../../i18n/core':core,react:React,'react-native':native,'@react-navigation/native':{useIsFocused:()=>true},
      'lucide-react-native':{Heart:'Heart',ChevronRight:'ChevronRight',ChevronLeft:'ChevronLeft'},
      '../../theme/fonts':{FONTS:{},upperTR:x=>String(x).toUpperCase()},'../../utils/platform':{platformName:p=>p.name,platformLogo:()=>null},
      '../../utils/origin':{isDomestic:()=>false},'../../utils/haptics':{hapticSelection(){}},
    });
    // Identical titles ensure even unchanged characters animate on every page change.
    const selections=Array.from({length:10},(_,i)=>i+1).map(id=>({movie:{id,title:'Same',genre:'Gerilim',runtime:'2 Sezon · 10 Bölüm'},reasons:[]}));
    function Harness(){const [index,setIndex]=React.useState(0);return React.createElement(Hero,{selections,index,onIndexChange:setIndex,onSlidingChange:locked=>locks.push(locked),isLiked:()=>false,onLike(){},onWhy(){},onOpen(){}});}
    await Renderer.act(async()=>{tree=Renderer.create(React.createElement(Harness));});
    const clip=tree.root.findAllByType('View').find(x=>x.props.onLayout&&!x.props.style?.gap);
    await Renderer.act(async()=>clip.props.onLayout({nativeEvent:{layout:{width:300}}}));
    const pager=()=>tree.root.findByType('HorizontalPager');
    assert.equal(pager().props.pagingEnabled,true);assert.equal(pager().props.directionalLockEnabled,true);
    assert.equal(formatHeroRuntime('1 Sezon · 1 Bölüm'),'1 season · 1 episode');
    const grids=tree.root.findAllByType('View').filter(x=>x.props.onLayout&&x.props.style?.gap===3);
    await Renderer.act(async()=>grids.forEach(g=>g.props.onLayout({nativeEvent:{layout:{width:300}}})));
    assert.equal(tree.root.findAllByType('AnimatedText').length,220);
    assert.equal(letterSchedules,22);
    letterSchedules=0;
    await Renderer.act(async()=>pager().props.onScrollBeginDrag());assert.equal(locks.at(-1),true);assert.equal(timers.size,0);
    await Renderer.act(async()=>{pager().props.onScroll({nativeEvent:{contentOffset:{x:1200}}});pager().props.onMomentumScrollEnd();});
    assert.equal(locks.at(-1),false);
    assert.equal(letterSchedules,22);
    assert.equal(tree.root.findAllByType('TouchableOpacity').find(x=>x.props.accessibilityLabel==='Pick 5 of 10').props.accessibilityState.selected,true);
    letterSchedules=0;
    await Renderer.act(async()=>tree.root.findAllByType('TouchableOpacity').find(x=>x.props.accessibilityLabel==='Pick 10 of 10').props.onPress());
    assert.ok(scrollCalls.some(x=>x.x===2700));
    await Renderer.act(async()=>{pager().props.onScroll({nativeEvent:{contentOffset:{x:2700}}});pager().props.onMomentumScrollEnd();});
    assert.equal(letterSchedules,22);
    // Each active page schedules all 22 cells, not just letters that changed.
    assert.equal(timers.size,1);
    await Renderer.act(async()=>appListener('background'));assert.equal(timers.size,0);
    await Renderer.act(async()=>tree.unmount());assert.equal(locks.at(-1),false);
  } finally {if(tree)await Renderer.act(async()=>tree.unmount());global.setInterval=oldInterval;global.clearInterval=oldClear;global.setTimeout=oldTimeout;core.setLanguageValue('tr');}
});

test('hero recommendation explanations translate dynamic genres and preserve title names', () => {
  core.setLanguageValue('en');
  const {recommendationReasons}=load('src/utils/recommend.js',{'../i18n/core':core,'./platform':{platformName:p=>p.name}});
  const movie={id:1,title:'Taşacak Bu Deniz',genre:'Gerilim',type:'Film',runtime:'95 dk',year:2026,imdb:8};
  const likes=[2,3,4,5].map(id=>({id,title:id===2?'Sen':'Title '+id,genre:'Gerilim',type:'Film',runtime:'100 dk',year:2022}));
  const reasons=recommendationReasons(movie,likes,{preferredGenres:['Gerilim'],genreFilter:'Gerilim',shortOnly:true,typeFilter:'Film'});
  assert.ok(reasons.some(x=>x.short==='Matches your Thriller preference'));
  assert.ok(reasons.some(x=>x.short==='Similar taste signals to Sen'));
  assert.doesNotMatch(reasons.map(x=>x.short+' '+x.detail).join(' '),/beğen|tercih|Gerilim|dakikalık/);
  core.setLanguageValue('tr');assert.ok(recommendationReasons(movie,likes,{preferredGenres:['Gerilim']}).some(x=>x.short==='Gerilim tercihinle eşleşiyor'));
});

}
