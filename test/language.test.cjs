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


test('hero slider supports dots, swipes, auto advance, and pauses in background', async () => {
  core.setLanguageValue('en');
  let nextTimer = 0, timers = new Map(), appListener, panHandlers;
  const previousInterval = global.setInterval, previousClear = global.clearInterval;
  global.setInterval = (fn, ms) => { assert.equal(ms, 7000); timers.set(++nextTimer, fn); return nextTimer; };
  global.clearInterval = id => timers.delete(id);
  const native = { View:'View', Text:'Text', Image:'Image', TouchableOpacity:'TouchableOpacity', StyleSheet:{create:x=>x},
    Animated:{Value:class {setValue(){} stopAnimation(){} interpolate(){return 1;}},Text:'AnimatedText',View:'AnimatedView',timing:()=>({start(){}})},
    PanResponder:{create:handlers=>{panHandlers=handlers;return {panHandlers:handlers};}},
    AccessibilityInfo:{isReduceMotionEnabled:async()=>false},AppState:{currentState:'active',addEventListener:(_,fn)=>{appListener=fn;return {remove(){}};}} };
  let tree;
  try {
    const {default:Hero,formatHeroRuntime} = load('src/components/salon/SeansBoard.js', {
      '../../i18n/core':core,react:React,'react-native':native,'@react-navigation/native':{useIsFocused:()=>true},
      'lucide-react-native':{Heart:'Heart',ChevronRight:'ChevronRight',ChevronLeft:'ChevronLeft'},
      '../../theme/fonts':{FONTS:{},upperTR:x=>String(x).toUpperCase()},'../../utils/platform':{platformName:p=>p.name,platformLogo:()=>null},
      '../../utils/origin':{isDomestic:()=>false},'../../utils/haptics':{hapticSelection(){}},
    });
    const selections=[{movie:{id:1,title:'Sen',genre:'Gerilim',runtime:'2 Sezon · 10 Bölüm',year:2026},reasons:[]},{movie:{id:2,title:'Another',genre:'Komedi',runtime:'95 dk'},reasons:[]}];
    function Harness(){const [index,setIndex]=React.useState(0);return React.createElement(Hero,{selections,index,onIndexChange:setIndex,isLiked:()=>false,onLike(){},onWhy(){},onOpen(){}});}
    await Renderer.act(async()=>{tree=Renderer.create(React.createElement(Harness));});
    assert.equal(formatHeroRuntime('1 Sezon · 1 Bölüm'),'1 season · 1 episode');
    assert.match(text(tree.toJSON()),/THRILLER.*2 SEASONS.*10 EPISODES/);
    assert.equal(timers.size,1);
    await Renderer.act(async()=>{[...timers.values()][0]();});
    assert.equal(tree.root.findAllByType('TouchableOpacity').find(x=>x.props.accessibilityLabel==='Pick 2 of 2').props.accessibilityState.selected,true);
    await Renderer.act(async()=>panHandlers.onPanResponderRelease(null,{dx:60,dy:0}));
    assert.equal(tree.root.findAllByType('TouchableOpacity').find(x=>x.props.accessibilityLabel==='Pick 1 of 2').props.accessibilityState.selected,true);
    await Renderer.act(async()=>tree.root.findAllByType('TouchableOpacity').find(x=>x.props.accessibilityLabel==='Pick 2 of 2').props.onPress());
    assert.match(text(tree.toJSON()),/95 MIN/);
    await Renderer.act(async()=>appListener('background'));assert.equal(timers.size,0);
    await Renderer.act(async()=>appListener('active'));assert.equal(timers.size,1);
    await Renderer.act(async()=>tree.unmount());assert.equal(timers.size,0);
  } finally { if(tree) await Renderer.act(async()=>tree.unmount());global.setInterval=previousInterval;global.clearInterval=previousClear;core.setLanguageValue('tr'); }
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
