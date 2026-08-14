from pathlib import Path

p = Path('src/screens/PellixPlayScreen.js')
s = p.read_text()
replacements = [
    (
        'Yeterli beğeni / beğenmeme verisi olan arkadaşlarınla hemen oynayabilirsin.',
        'En az 10 beğenisi olan arkadaşlarınla hemen oynayabilirsin.',
    ),
    (
        '{friend.ready ? `${friend.questionCount} soruluk tur hazır` : "Biraz daha zevk verisi gerekiyor"}',
        '{friend.ready ? `${friend.questionCount} soruluk tur hazır` : `${friend.likeCount || 0}/10 beğeni · biraz daha gerekiyor`}',
    ),
    (
        '<Text style={styles.friendSub}>Hangisini tercih ederdi?</Text>',
        '<Text style={styles.friendSub}>Hangisini beğenmiş?</Text>',
    ),
]
for old, new in replacements:
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'expected exactly one occurrence for {old!r}, found {count}')
    s = s.replace(old, new, 1)
p.write_text(s)
