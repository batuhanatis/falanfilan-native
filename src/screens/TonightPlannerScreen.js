import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Crown, Moon, Check, ChevronRight } from 'lucide-react-native';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import ScreenHeader from '../components/ScreenHeader';
import ListPickerModal from '../components/ListPickerModal';

const INITIAL = { company: 'solo', participantIds: [], type: 'Film', mood: 'gripping', maxMinutes: 120,
  pace: 'any', avoidGenres: [], origin: 'any', platformMode: 'selected', providerIds: [] };
const QUESTIONS = {
  company: { title: 'Bu akşam kimlerle?', hint: 'Ortak öneri için Pellix profilleri ekleyebilirsin.', choices: [['solo', 'Tek başıma'], ['partner', 'Sevgilimle'], ['friends', 'Arkadaşlarımla']] },
  members: { title: 'Kimler sana eşlik ediyor?', hint: 'İsteğe bağlı. Görünür beğenileri olan arkadaşlarınla ortak öneri hazırlayalım. Yalnızca senin Premium olman yeterli.' },
  type: { title: 'Film mi, dizi mi?', hint: 'Dizi seçersen bu akşam başlayabileceğin bir dizi bulalım.', choices: [['Film', 'Bir film izleyelim'], ['Dizi', 'Bir diziye başlayalım'], ['any', 'İkisi de olur']] },
  mood: { title: 'Nasıl hissettirsin?', hint: 'Bu akşamki ruh haline yakın türleri öne çıkarırız.', choices: [['light', 'Kafam dağılsın'], ['gripping', 'Beni içine çeksin'], ['emotional', 'İçimde bir şey bıraksın'], ['imaginative', 'Başka bir dünyaya götürsün'], ['any', 'Beni şaşırt']] },
  maxMinutes: { title: 'Ne kadar vaktin var?', hint: 'Film için toplam süre, dizi için tek bölüm süresi. Dizi bölümleri farklı uzunlukta olabilir.', choices: [[30, 'En fazla 30 dakika'], [60, 'En fazla 1 saat'], [90, 'En fazla 90 dakika'], [120, 'En fazla 2 saat'], [180, 'En fazla 3 saat'], [null, 'Acele yok']] },
  pace: { title: 'Nasıl bir tempo?', hint: 'Tempo tercihini tür bilgisi üzerinden sıralamaya yansıtırız.', choices: [['fast', 'Hareketli ve sürükleyici'], ['calm', 'Sakin, hikâyeye zaman ayıran'], ['any', 'Fark etmez']] },
  avoidGenres: { title: 'Bu akşam ne olmasın?', hint: 'Seçtiğin türleri içeren yapımları sonuçlardan çıkarırız.', choices: ['Korku', 'Gerilim', 'Dram', 'Romantik', 'Animasyon', 'Belgesel'].map(g => [g, g]) },
  origin: { title: 'Yerli mi, yabancı mı?', hint: 'Yerli seçiminde Türkçe özgün dildeki yapımlara bakarız.', choices: [['any', 'Fark etmez'], ['domestic', 'Yerli yapım'], ['foreign', 'Yabancı yapım']] },
  platforms: { title: 'Hangi platformlar sende var?', hint: 'Türkiye kataloğu. Bu akşam kullanabileceğiniz abonelikleri seç; kiralama ve satın alma seçeneklerini dahil etmiyoruz.' },
};
const toggle = (items, value) => items.includes(value) ? items.filter(x => x !== value) : [...items, value];

export default function TonightPlannerScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [answers, setAnswers] = useState(INITIAL);
  const [options, setOptions] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [listMovie, setListMovie] = useState(null);
  const excluded = useRef([]);
  const working = useRef(false);
  const mounted = useRef(true);
  const restored = useRef(false);
  const scroll = useRef(null);
  const storageKey = `pellix:tonight:platforms:${auth.id}`;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const loadOptions = useCallback(async (isActive = () => mounted.current) => {
    setLoadingOptions(true); setError('');
    try {
      // Existing status endpoint also reconciles recently purchased subscriptions.
      const status = await api.premiumStatus(auth.token);
      if (!isActive()) return;
      if (!status.isPremium) { setPremiumRequired(true); return; }
      const data = await api.tonightOptions(auth.token);
      if (!isActive()) return;
      setOptions(data); setPremiumRequired(false);
      if (!restored.current) {
        const raw = await AsyncStorage.getItem(storageKey).catch(() => null);
        if (!isActive()) return;
        let saved;
        try { saved = JSON.parse(raw); } catch { saved = null; }
        if (saved && Array.isArray(saved.providerIds)) {
          setAnswers(a => ({ ...a, providerIds: saved.providerIds.filter(id => data.platforms.some(p => p.id === id)), platformMode: saved.platformMode === 'any' ? 'any' : 'selected' }));
        }
        restored.current = true;
      }
    } catch (e) {
      if (!isActive()) return;
      if (e.code === 'PREMIUM_REQUIRED') setPremiumRequired(true);
      else setError(e.status === 404 ? 'Bu özellik henüz sunucuda hazır değil. Lütfen biraz sonra tekrar dene.' : e.message || 'Seçenekler yüklenemedi.');
    } finally { if (isActive()) setLoadingOptions(false); }
  }, [auth.token, storageKey]);
  useFocusEffect(useCallback(() => { let active = true; loadOptions(() => active); return () => { active = false; }; }, [loadOptions]));

  const steps = ['company', ...(answers.company === 'solo' ? [] : ['members']), 'type', 'mood', 'maxMinutes', 'pace', 'avoidGenres', 'origin', 'platforms'];
  const key = steps[Math.min(step, steps.length - 1)];
  const question = QUESTIONS[key];
  function change(field, value) {
    setError('');
    setAnswers(a => ({ ...a, [field]: value, ...(field === 'company' ? { participantIds: [] } : {}) }));
  }
  function move(index) { setStep(index); setQuery(''); setShowAllPlatforms(false); setError(''); scroll.current?.scrollTo({ y: 0, animated: false }); }
  function edit() { setResult(null); excluded.current = []; move(0); }
  async function plan(skipIds = []) {
    if (working.current) return;
    if (answers.platformMode === 'selected' && !answers.providerIds.length) { setError('En az bir platform seç veya “Platform fark etmez” seçeneğini kullan.'); return; }
    if (excluded.current.length + skipIds.length > 200) { setError('Bu turda çok sayıda öneriyi eledin. Seçimlerini değiştirerek yeni bir tur başlat.'); return; }
    working.current = true; setBusy(true); setError(''); setResult(null);
    excluded.current = [...new Set([...excluded.current, ...skipIds])];
    try {
      const data = await api.tonightPlan(auth.token, { ...answers, excludeIds: excluded.current });
      if (!mounted.current) return;
      setResult(data); scroll.current?.scrollTo({ y: 0, animated: false });
      AsyncStorage.setItem(storageKey, JSON.stringify({ providerIds: answers.providerIds, platformMode: answers.platformMode })).catch(() => {});
    } catch (e) {
      if (!mounted.current) return;
      if (e.code === 'PREMIUM_REQUIRED') setPremiumRequired(true);
      setError(e.message || 'Öneri hazırlanamadı. Tekrar deneyebilirsin.');
    } finally { working.current = false; if (mounted.current) setBusy(false); }
  }
  const choiceButton = (value, label, selected, onPress, extra = null) => (
    <TouchableOpacity key={String(value)} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
      style={[styles.choice, selected && styles.selected]} activeOpacity={0.8}>
      {extra}<Text style={styles.choiceText}>{label}</Text>{selected ? <Check size={18} color={c.accent} /> : null}
    </TouchableOpacity>
  );
  function body() {
    if (premiumRequired) return <View style={styles.gate}>
      <Crown size={32} color={c.accent} /><Text style={styles.title}>Bu akşamın seçimi sana özel.</Text>
      <Text style={styles.hint}>Platformlarına ve zevkine göre bir ana öneri, iki alternatif. İstersen sevgilinin veya arkadaşlarının Pellix profillerini de dahil et.</Text>
      <TouchableOpacity style={styles.primary} onPress={() => navigation.navigate('Premium', { reason: 'tonight_planner' })}><Text style={styles.primaryText}>Premium ile akşamı planla</Text></TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={() => loadOptions()} disabled={loadingOptions}><Text style={styles.secondaryText}>Üyeliğimi tekrar kontrol et</Text></TouchableOpacity>
    </View>;
    if (loadingOptions && !options) return <View style={styles.gate}><ActivityIndicator color={c.accent} /><Text style={styles.hint}>Platformlar ve profiller hazırlanıyor…</Text></View>;
    if (!options) return <TouchableOpacity style={styles.primary} onPress={() => loadOptions()}><Text style={styles.primaryText}>Tekrar dene</Text></TouchableOpacity>;
    if (busy) return <View style={styles.gate}><ActivityIndicator size="large" color={c.accent} /><Text style={styles.title}>Bu akşamı hazırlıyoruz.</Text><Text style={styles.hint}>Zevkleri karşılaştırıyor, platformları ve süreleri kontrol ediyoruz.</Text></View>;
    if (result) return <>
      <Text style={styles.eyebrow}>BU AKŞAMIN SEÇİMİ</Text><Text style={styles.title}>{answers.company === 'solo' ? 'Kendine bir akşam ayır.' : 'Birlikte güzel bir akşam.'}</Text>
      {!!result.participants?.length && <Text style={styles.hint}>Sen + {result.participants.map(p => p.name).join(', ')}</Text>}
      {answers.company !== 'solo' && !result.participants?.length && <Text style={styles.hint}>Başka profil eklemediğin için öneriler senin zevkine ve yanıtlarına göre.</Text>}
      {!!result.participants?.some(p => !p.hasTaste) && <Text style={styles.hint}>Bazı profillerde henüz yeterli görünür beğeni yok; o kişilerin zevki sıralamaya dahil edilemedi.</Text>}
      {result.tasteProfileCount === 0 && <Text style={styles.hint}>Henüz yeterli zevk verisi yok; bu seçimler sorulara verdiğin yanıtlara göre hazırlandı.</Text>}
      {!result.results?.length && <Text style={styles.hint}>{result.emptyMessage}</Text>}
      {(result.results || []).map((movie, i) => <View key={movie.id} style={[styles.result, i === 0 && styles.featured]}>
        <Text style={styles.eyebrow}>{i === 0 ? 'ANA ÖNERİ' : `ALTERNATİF ${i}`}</Text>
        <TouchableOpacity style={styles.movieRow} accessibilityRole="button" accessibilityLabel={`${movie.title}, detayları gör`} onPress={() => navigation.navigate('Detail', { movie })}>
          {movie.poster ? <Image source={{ uri: movie.poster }} style={styles.poster} /> : null}
          <View style={{ flex: 1 }}><Text style={styles.movieTitle}>{movie.title}</Text><Text style={styles.meta}>{movie.year} · {movie.type}{movie.tonightMinutes ? ` · ${movie.type === 'Dizi' ? 'Bölüm ~' : ''}${movie.tonightMinutes} dk` : ''}</Text></View><ChevronRight size={18} color={c.dim} />
        </TouchableOpacity>
        <Text style={styles.overview} numberOfLines={i === 0 ? 4 : 2}>{movie.overview}</Text>
        {(movie.reasons || []).map((r, j) => <Text key={j} style={styles.reason}>• {r}</Text>)}
        <View style={styles.platformBadges}>{(movie.availableOn || []).map(p => <View style={styles.platformBadge} key={p.id}>{p.logo ? <Image source={{ uri: p.logo }} style={styles.smallLogo} /> : null}<Text style={styles.meta}>{p.name}</Text></View>)}</View>
        {!movie.availableOn?.length && <Text style={styles.hint}>Türkiye için abonelik platformu bilgisi bulunamadı.</Text>}
        <View style={styles.actions}><TouchableOpacity style={styles.secondary} onPress={() => setListMovie(movie)}><Text style={styles.secondaryText}>Listeme ekle</Text></TouchableOpacity><TouchableOpacity style={styles.secondary} onPress={() => plan([movie.id])}><Text style={styles.secondaryText}>Bunu izledim</Text></TouchableOpacity></View>
      </View>)}
      {!!result.notice && <Text style={styles.note}>{result.notice}</Text>}
      {!!result.results?.length && <><Text style={styles.note}>Platform bilgisi: TMDB / JustWatch, Türkiye. “Bunu izledim” bu turdan çıkarır; günlüğünü değiştirmez.</Text><TouchableOpacity style={styles.primary} onPress={() => plan(result.results.map(m => m.id))}><Text style={styles.primaryText}>Başka öneriler bul</Text></TouchableOpacity></>}
      <TouchableOpacity style={styles.secondary} onPress={edit}><Text style={styles.secondaryText}>Seçimlerimi değiştir</Text></TouchableOpacity>
    </>;
    const filteredFriends = options.friends.filter(f => `${f.name} ${f.username || ''}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')));
    const filteredPlatforms = options.platforms.filter(p => p.name.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')));
    return <>
      <View style={styles.progress}>{steps.map((s, i) => <View key={s} style={[styles.progressPart, i <= step && { backgroundColor: c.accent }]} />)}</View>
      <Text style={styles.eyebrow}>BU AKŞAMI PLANLA · {step + 1} / {steps.length}</Text>
      <Text style={styles.title}>{question.title}</Text><Text style={styles.hint}>{question.hint}</Text>
      <View style={styles.choices}>
        {question.choices?.map(([value, label]) => choiceButton(value, label, key === 'avoidGenres' ? answers.avoidGenres.includes(value) : answers[key] === value,
          () => change(key, key === 'avoidGenres' ? toggle(answers.avoidGenres, value) : value)))}
        {key === 'avoidGenres' && choiceButton('none', 'Bir kısıtım yok', answers.avoidGenres.length === 0, () => change('avoidGenres', []))}
        {key === 'members' && <>
          <TextInput accessibilityLabel="Pellix arkadaşlarında ara" style={styles.input} value={query} onChangeText={setQuery} placeholder="Ad veya kullanıcı adıyla ara" placeholderTextColor={c.dim} autoCapitalize="none" />
          {choiceButton('skip', 'Profil eklemeden devam', answers.participantIds.length === 0, () => change('participantIds', []))}
          <Text style={styles.note}>{answers.company === 'partner' ? 'En fazla 1 profil' : 'En fazla 5 profil'} · Seçilen: {answers.participantIds.length}</Text>
          {filteredFriends.map(f => choiceButton(f.id, `${f.name}${f.username ? ` · @${f.username}` : ''}`, answers.participantIds.includes(Number(f.id)), () => {
            const id = Number(f.id); const max = answers.company === 'partner' ? 1 : 5;
            if (!answers.participantIds.includes(id) && answers.participantIds.length >= max) { setError(`En fazla ${max} profil seçebilirsin.`); return; }
            change('participantIds', toggle(answers.participantIds, id));
          }, f.avatar_url ? <Image source={{ uri: f.avatar_url }} style={styles.avatar} /> : null))}
          {!filteredFriends.length && <Text style={styles.hint}>Uygun profil bulunamadı. Burada yalnızca arkadaş olduğun, seni engellemeyen ve beğenileri arkadaşlarına açık profiller görünür. Profil eklemeden de devam edebilirsin.</Text>}
        </>}
        {key === 'platforms' && <>
          {choiceButton('any', 'Platform fark etmez', answers.platformMode === 'any', () => change('platformMode', answers.platformMode === 'any' ? 'selected' : 'any'))}
          <TextInput accessibilityLabel="Platform ara" style={styles.input} value={query} onChangeText={setQuery} placeholder="Platform ara" placeholderTextColor={c.dim} />
          <Text style={styles.note}>{answers.platformMode === 'any' ? 'Tüm platformlar dahil.' : `${answers.providerIds.length} platform seçili. Seçtiklerinden birinde olması yeterli.`}</Text>
          {(query || showAllPlatforms ? filteredPlatforms : filteredPlatforms.slice(0, 12)).map(p => choiceButton(p.id, p.name, answers.platformMode === 'selected' && answers.providerIds.includes(p.id), () => {
            const next = toggle(answers.providerIds, p.id);
            if (next.length > 30) { setError('En fazla 30 platform seçebilirsin.'); return; }
            setAnswers(a => ({ ...a, platformMode: 'selected', providerIds: next })); setError('');
          }, p.logo ? <Image source={{ uri: p.logo }} style={styles.logo} /> : null))}
          {!query && filteredPlatforms.length > 12 && <TouchableOpacity style={styles.secondary} onPress={() => setShowAllPlatforms(v => !v)}><Text style={styles.secondaryText}>{showAllPlatforms ? 'Daha az göster' : 'Tüm platformları göster'}</Text></TouchableOpacity>}
          {!filteredPlatforms.length && <Text style={styles.hint}>Aramana uygun platform bulunamadı.</Text>}
        </>}
      </View>
      <TouchableOpacity style={styles.primary} onPress={() => step === steps.length - 1 ? plan() : move(step + 1)}><Text style={styles.primaryText}>{step === steps.length - 1 ? 'Bu akşamı planla' : 'Devam et'}</Text></TouchableOpacity>
      {step > 0 && <TouchableOpacity style={styles.secondary} onPress={() => move(step - 1)}><Text style={styles.secondaryText}>Önceki soru</Text></TouchableOpacity>}
    </>;
  }
  return <View style={styles.root}>
    <ScreenHeader title="Bu Akşamı Planla" subtitle="PELLIX PREMIUM" onBack={() => navigation.goBack()} right={<Moon size={20} color={c.accent} />} />
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
      {body()}
      {!!error && <View accessibilityLiveRegion="polite"><Text style={styles.error}>{error}</Text>{options && !busy && !premiumRequired && <TouchableOpacity style={styles.secondary} onPress={edit}><Text style={styles.secondaryText}>Seçimlerime dön</Text></TouchableOpacity>}</View>}
    </ScrollView>
    {listMovie && <ListPickerModal movie={listMovie} onClose={() => setListMovie(null)} />}
  </View>;
}
function makeStyles(c) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg }, content: { padding: 22, gap: 12 },
  title: { color: c.text, fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6 },
  hint: { color: c.dim, fontSize: 14, lineHeight: 21 }, eyebrow: { color: c.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  progress: { flexDirection: 'row', gap: 5, marginBottom: 10 }, progressPart: { height: 3, flex: 1, borderRadius: 2, backgroundColor: c.border },
  choices: { gap: 10, marginVertical: 10 }, choice: { minHeight: 56, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 15 },
  selected: { borderColor: c.accent, backgroundColor: c.surface2 }, choiceText: { flex: 1, color: c.text, fontSize: 15, fontWeight: '600' },
  primary: { minHeight: 52, backgroundColor: c.accent, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 15 }, primaryText: { color: c.bg, fontSize: 15, fontWeight: '800' },
  secondary: { minHeight: 46, alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: c.surface2, borderRadius: 12 }, secondaryText: { color: c.text, fontSize: 13, fontWeight: '600' },
  input: { minHeight: 48, backgroundColor: c.surface2, color: c.text, fontSize: 16, paddingHorizontal: 14, borderRadius: 12 },
  note: { color: c.dim, fontSize: 12, lineHeight: 18 }, error: { color: c.danger, fontSize: 14, lineHeight: 21, marginVertical: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18 }, logo: { width: 32, height: 32, borderRadius: 8 },
  gate: { paddingVertical: 35, gap: 20 }, result: { backgroundColor: c.surface, borderRadius: 18, padding: 17, gap: 12, borderWidth: 1, borderColor: c.border }, featured: { borderColor: c.accent },
  movieRow: { flexDirection: 'row', alignItems: 'center', gap: 14 }, poster: { width: 74, height: 111, borderRadius: 10 }, movieTitle: { color: c.text, fontSize: 21, fontWeight: '800' }, meta: { color: c.dim, fontSize: 12, lineHeight: 18 },
  overview: { color: c.text, fontSize: 14, lineHeight: 21 }, reason: { color: c.dim, fontSize: 12, lineHeight: 18 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, platformBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, platformBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 }, smallLogo: { width: 23, height: 23, borderRadius: 5 },
}); }
