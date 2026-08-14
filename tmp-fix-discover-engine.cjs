const fs = require('fs');

function patch(path, fn) {
  const before = fs.readFileSync(path, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`no change produced for ${path}`);
  fs.writeFileSync(path, after);
}

patch('src/api/client.js', (s) => {
  const oldText = '  recommendations: (token) => request("/api/recommendations", { token }),';
  const newText = `  recommendations: (token, type = null, limit = null) => {\n    const parts = [];\n    if (type === "movie" || type === "tv") parts.push(\`type=\${type}\`);\n    if (Number.isFinite(Number(limit))) parts.push(\`limit=\${Math.floor(Number(limit))}\`);\n    return request(\`/api/recommendations\${parts.length ? \`?\${parts.join("&")}\` : ""}\`, { token });\n  },`;
  if (!s.includes(oldText)) throw new Error('client recommendations anchor missing');
  return s.replace(oldText, newText);
});

patch('src/context/PrefetchContext.js', (s) => {
  if (!s.includes('const DISCOVER_STOCK_TARGET = 20;')) throw new Error('prefetch target anchor missing');
  s = s.replace('const DISCOVER_STOCK_TARGET = 20;', 'const DISCOVER_STOCK_TARGET = 80;');
  const start = s.indexOf('    (async () => {\n      try {\n        const interactionsData = await api.interactions(token);');
  if (start < 0) throw new Error('prefetch block start missing');
  const endMarker = '    })();\n\n    return () => { cancelled = true; };';
  const end = s.indexOf(endMarker, start);
  if (end < 0) throw new Error('prefetch block end missing');
  const replacement = `    (async () => {\n      try {\n        // Discover açılmadan önce Taste Engine'den geniş bir kişisel kart stoğu hazırla.\n        // Rastgele katalog sayfaları yerine kullanıcının zevk skoruna göre sıralanmış cache havuzu gelir.\n        const data = await api.recommendations(token, null, DISCOVER_STOCK_TARGET);\n        if (!stillCurrent()) return;\n        setDiscoverQueue((data.results || []).slice(0, DISCOVER_STOCK_TARGET));\n      } catch {\n        // Hata durumunda null bırak; Discover kendi öneri isteğini atsın.\n      }\n    })();\n\n    return () => { cancelled = true; };`;
  return s.slice(0, start) + replacement + s.slice(end + endMarker.length);
});

patch('src/screens/DiscoverScreen.js', (s) => {
  const oldVote = '          if (row.action === "like" || row.action === "dislike" || row.action === "skip") voted.add(row.movie_id);';
  const newVote = '          if (row.action === "like" || row.action === "dislike") voted.add(row.movie_id);';
  if (!s.includes(oldVote)) throw new Error('voted ids anchor missing');
  s = s.replace(oldVote, newVote);

  const start = s.indexOf('  const growQueue = useCallback(async (existingQueue, existingShown, existingFilter, generation = filterGenerationRef.current) => {');
  if (start < 0) throw new Error('growQueue start missing');
  const endMarker = '  }, [auth.token]);';
  const end = s.indexOf(endMarker, start);
  if (end < 0) throw new Error('growQueue end missing');
  const replacement = `  const growQueue = useCallback(async (existingQueue, existingShown, existingFilter, generation = filterGenerationRef.current) => {\n    const growKey = \`\${generation}:\${existingFilter}\`;\n    if (growingRef.current.has(growKey)) return [];\n    growingRef.current.add(growKey);\n    try {\n      const votedIds = await getVotedIds();\n      const usedIds = new Set([...existingQueue.map((m) => m.id), ...existingShown, ...votedIds]);\n      const apiType = existingFilter === "Movie" ? "movie" : existingFilter === "TV Shows" ? "tv" : null;\n\n      // Taste Engine geniş cache havuzunu kullanıcının gerçek like/dislike geçmişine göre sıralıyor.\n      // 120 kart istiyoruz; ekranda kullanılanlar tekrar elendikten sonra da stok hızla tükenmesin.\n      const data = await api.recommendations(auth.token, apiType, 120);\n      if (generation !== filterGenerationRef.current || activeFilterRef.current !== existingFilter) return [];\n\n      return (data.results || [])\n        .filter((m) => !usedIds.has(m.id))\n        .map((m) => existingFilter === "Movie"\n          ? { ...m, type: "Film" }\n          : existingFilter === "TV Shows"\n            ? { ...m, type: "Dizi" }\n            : m)\n        .filter((m) => existingFilter === "All" || (existingFilter === "Movie" ? m.type === "Film" : m.type === "Dizi"));\n    } catch {\n      return [];\n    } finally {\n      growingRef.current.delete(growKey);\n    }\n  }, [auth.token]);`;
  return s.slice(0, start) + replacement + s.slice(end + endMarker.length);
});

console.log('Discover Taste Engine patch applied.');
