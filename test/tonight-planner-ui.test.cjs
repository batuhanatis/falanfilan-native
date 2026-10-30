// Test-only packages live outside the native dependency graph (see TONIGHT_PLANNER.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const runtimeRoot = process.env.PELLIX_TEST_RUNTIME;
const enabled = !!runtimeRoot;
let React, Renderer, transformSync;
if (enabled) {
  const runtime = Module.createRequire(path.join(runtimeRoot, 'package.json'));
  React = runtime('react'); Renderer = runtime('react-test-renderer');
  transformSync = require('@babel/core').transformSync;
  global.IS_REACT_ACT_ENVIRONMENT = true;
}
const colors = { bg: '#111', surface: '#222', surface2: '#333', text: '#fff', dim: '#aaa', accent: '#f0b429', border: '#444', danger: '#f44' };
const fixtureOptions = { platforms: [{ id: 8, name: 'Netflix' }, { id: 9, name: 'Prime' }], friends: [{ id: 2, name: 'Deniz', username: 'deniz' }, { id: 3, name: 'Ece' }] };
const flatten = node => typeof node === 'string' || typeof node === 'number' ? String(node) : (node?.children || []).map(flatten).join(' ');
async function render({ premium = true, failPlan = false } = {}) {
  const payloads = [], navigations = [];
  const mocks = {
    react: React,
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', Image: 'Image', ActivityIndicator: 'ActivityIndicator', ScrollView: 'ScrollView', TextInput: 'TextInput', StyleSheet: { create: x => x } },
    '@react-navigation/native': { useFocusEffect: cb => React.useEffect(cb, [cb]) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {} },
    'lucide-react-native': { Crown: 'Crown', Moon: 'Moon', Check: 'Check', ChevronRight: 'ChevronRight' },
    '../context/ThemeContext': { useAppTheme: () => ({ c: colors }) },
    '../context/AuthContext': { useAuth: () => ({ auth: { id: 10, token: 'test' } }) },
    '../api/client': { api: {
      premiumStatus: async () => ({ isPremium: premium }), tonightOptions: async () => fixtureOptions,
      tonightPlan: async (_token, body) => {
        payloads.push(body);
        if (failPlan) throw new Error('Ağ hatası');
        return { results: [{ id: 50, title: 'Test Film', type: 'Film', year: 2024, availableOn: [{ id: 8, name: 'Netflix' }], reasons: ['Test nedeni'] }], participants: body.participantIds.map(id => ({ id, name: 'Deniz', hasTaste: true })), tasteProfileCount: 2 };
      },
    } },
    '../components/ScreenHeader': 'ScreenHeader', '../components/ListPickerModal': 'ListPickerModal',
  };
  const filename = path.resolve(__dirname, '../src/screens/TonightPlannerScreen.js');
  const { code } = transformSync(fs.readFileSync(filename, 'utf8'), { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'] });
  const mod = new Module(filename); mod.filename = filename;
  mod.require = name => { if (Object.hasOwn(mocks, name)) return mocks[name]; throw new Error(`Unmocked import ${name}`); };
  mod._compile(code, filename);
  let tree;
  await Renderer.act(async () => { tree = Renderer.create(React.createElement(mod.exports.default, { navigation: { navigate: (...args) => navigations.push(args), goBack: () => {} } })); });
  return {
    tree, payloads, navigations,
    text: () => flatten(tree.toJSON()),
    async tap(label) {
      const button = tree.root.findAllByType('TouchableOpacity').find(b => flatten(b).trim() === label);
      assert.ok(button, `Missing button: ${label}`);
      await Renderer.act(async () => { button.props.onPress(); });
    },
    async close() { await Renderer.act(async () => tree.unmount()); },
  };
}
test('solo flow requires an explicit platform choice and sends all eight answers', { skip: !enabled }, async () => {
  const ui = await render();
  for (let i = 0; i < 7; i++) await ui.tap('Devam et');
  await ui.tap('Bu akşamı planla'); assert.equal(ui.payloads.length, 0); assert.match(ui.text(), /En az bir platform/);
  await ui.tap('Netflix'); await ui.tap('Bu akşamı planla');
  assert.equal(ui.payloads.length, 1); assert.deepEqual(ui.payloads[0].providerIds, [8]); assert.equal(ui.payloads[0].company, 'solo'); assert.equal(ui.payloads[0].maxMinutes, 120);
  assert.match(ui.text(), /ANA ÖNERİ/); assert.match(ui.text(), /Test Film/);
  await ui.tap('Bunu izledim'); assert.deepEqual(ui.payloads[1].excludeIds, [50]);
  await ui.tap('Listeme ekle'); assert.equal(ui.tree.root.findByType('ListPickerModal').props.movie.id, 50);
  await ui.close();
});
test('couple flow adds optional profile step and submits the selected friend', { skip: !enabled }, async () => {
  const ui = await render(); await ui.tap('Sevgilimle'); await ui.tap('Devam et');
  await ui.tap('Deniz · @deniz'); await ui.tap('Ece'); assert.match(ui.text(), /En fazla 1 profil seçebilirsin/);
  for (let i = 0; i < 7; i++) await ui.tap('Devam et');
  await ui.tap('Platform fark etmez'); await ui.tap('Bu akşamı planla');
  assert.deepEqual(ui.payloads[0].participantIds, [2]); assert.equal(ui.payloads[0].platformMode, 'any');
  await ui.close();
});
test('non-premium users see an upgrade route and never call the planner', { skip: !enabled }, async () => {
  const ui = await render({ premium: false }); await ui.tap('Premium ile akşamı planla');
  assert.deepEqual(ui.navigations[0], ['Premium', { reason: 'tonight_planner' }]); assert.equal(ui.payloads.length, 0); await ui.close();
});
test('API failure preserves the choices and offers retry', { skip: !enabled }, async () => {
  const ui = await render({ failPlan: true }); for (let i=0;i<7;i++) await ui.tap('Devam et');
  await ui.tap('Netflix'); await ui.tap('Bu akşamı planla'); assert.match(ui.text(), /Ağ hatası/);
  await ui.tap('Bu akşamı planla'); assert.deepEqual(ui.payloads[0], ui.payloads[1]); await ui.close();
});
