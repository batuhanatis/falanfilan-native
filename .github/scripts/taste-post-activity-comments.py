from pathlib import Path

p = Path('src/api/client.js')
s = p.read_text()
old = '  socialAddComment: (token, id, body) => request(`/api/social/posts/${id}/comments`, { method: "POST", token, body: { body } }),\n'
new = old + '  socialActivityComments: (token, id) => request(`/api/social/activities/${id}/comments`, { token }),\n  socialAddActivityComment: (token, id, body) => request(`/api/social/activities/${id}/comments`, { method: "POST", token, body: { body } }),\n'
assert old in s and 'socialActivityComments' not in s
s = s.replace(old, new, 1)
p.write_text(s)

p = Path('src/components/SocialCommentsModal.js')
s = p.read_text()
s = s.replace(
    'export default function SocialCommentsModal({ visible, postId, onClose, onChanged }) {',
    'export default function SocialCommentsModal({ visible, postId, activityId, onClose, onChanged }) {'
)
old = '''  useEffect(() => {\n    if (!visible || !postId) return;\n    setLoading(true);\n    api.socialComments(auth.token, postId)\n      .then((data) => setComments(data.results || []))\n      .catch(() => setComments([]))\n      .finally(() => setLoading(false));\n  }, [visible, postId, auth.token]);\n'''
new = '''  useEffect(() => {\n    const targetId = activityId || postId;\n    if (!visible || !targetId) return;\n    setLoading(true);\n    const request = activityId\n      ? api.socialActivityComments(auth.token, activityId)\n      : api.socialComments(auth.token, postId);\n    request\n      .then((data) => setComments(data.results || []))\n      .catch(() => setComments([]))\n      .finally(() => setLoading(false));\n  }, [visible, postId, activityId, auth.token]);\n'''
assert old in s
s = s.replace(old, new, 1)
old = '      const data = await api.socialAddComment(auth.token, postId, body);\n'
new = '''      const data = activityId\n        ? await api.socialAddActivityComment(auth.token, activityId, body)\n        : await api.socialAddComment(auth.token, postId, body);\n'''
assert old in s
s = s.replace(old, new, 1)
p.write_text(s)

p = Path('src/components/SocialFeedCard.js')
s = p.read_text()
old = '''      ) : primaryMovie ? (\n        <View style={styles.actions}>\n          <TouchableOpacity style={styles.action} onPress={() => likeActivityMovie(primaryMovie)}>\n            <ThumbsUp size={16} color={activityLiked ? c.accent2 : c.dim} fill={activityLiked ? c.accent2 : "none"} />\n            <Text style={[styles.actionText, activityLiked && { color: c.accent2 }]}>{activityLiked ? "Beğenildi" : "Ben de beğendim"}</Text>\n          </TouchableOpacity>\n          <TouchableOpacity style={[styles.action, { marginLeft: "auto" }]} onPress={() => openMovie(primaryMovie)}>\n            <Text style={styles.actionLink}>Detay</Text>\n          </TouchableOpacity>\n        </View>\n      ) : null}\n\n      {!!post?.id && (\n        <SocialCommentsModal\n          visible={commentsOpen}\n          postId={post.id}\n          onClose={() => setCommentsOpen(false)}\n          onChanged={() => {\n            setState((s) => ({ ...s, post: { ...s.post, commentCount: Number(s.post?.commentCount || 0) + 1 } }));\n            onChanged?.();\n          }}\n        />\n      )}\n'''
new = '''      ) : state.kind === "activity" ? (\n        <View style={styles.actions}>\n          {!!primaryMovie && (\n            <TouchableOpacity style={styles.action} onPress={() => likeActivityMovie(primaryMovie)}>\n              <ThumbsUp size={16} color={activityLiked ? c.accent2 : c.dim} fill={activityLiked ? c.accent2 : "none"} />\n              <Text style={[styles.actionText, activityLiked && { color: c.accent2 }]}>{activityLiked ? "Beğenildi" : "Ben de beğendim"}</Text>\n            </TouchableOpacity>\n          )}\n          {!!state.activityId && (\n            <TouchableOpacity style={styles.action} onPress={() => setCommentsOpen(true)}>\n              <MessageCircle size={17} color={c.dim} />\n              <Text style={styles.actionText}>{state.commentCount || 0}</Text>\n            </TouchableOpacity>\n          )}\n          {!!primaryMovie && (\n            <TouchableOpacity style={[styles.action, { marginLeft: "auto" }]} onPress={() => openMovie(primaryMovie)}>\n              <Text style={styles.actionLink}>Detay</Text>\n            </TouchableOpacity>\n          )}\n        </View>\n      ) : null}\n\n      {(!!post?.id || !!state.activityId) && (\n        <SocialCommentsModal\n          visible={commentsOpen}\n          postId={post?.id}\n          activityId={state.activityId}\n          onClose={() => setCommentsOpen(false)}\n          onChanged={() => {\n            if (post?.id) {\n              setState((s) => ({ ...s, post: { ...s.post, commentCount: Number(s.post?.commentCount || 0) + 1 } }));\n            } else {\n              setState((s) => ({ ...s, commentCount: Number(s.commentCount || 0) + 1 }));\n            }\n            onChanged?.();\n          }}\n        />\n      )}\n'''
assert old in s
s = s.replace(old, new, 1)
p.write_text(s)

p = Path('src/screens/DetailScreen.js')
s = p.read_text()
old = '''            <TouchableOpacity style={styles.actionSquare} onPress={() => setSendOpen(true)}>\n              <Send size={16} color={c.text} />\n            </TouchableOpacity>\n            <TouchableOpacity style={styles.actionSquare} onPress={() => setPostComposerOpen(true)}>\n              <Share2 size={16} color={c.text} />\n            </TouchableOpacity>\n          </View>\n\n          {/* DT2'''
new = '''            <TouchableOpacity style={styles.actionSquare} onPress={() => setSendOpen(true)}>\n              <Send size={16} color={c.text} />\n            </TouchableOpacity>\n          </View>\n\n          <TouchableOpacity style={styles.tastePostBtn} onPress={() => setPostComposerOpen(true)} activeOpacity={0.85}>\n            <Share2 size={15} color={c.accent} />\n            <View style={{ flex: 1 }}>\n              <Text style={styles.tastePostTitle}>Taste Post olarak paylaş</Text>\n              <Text style={styles.tastePostSub}>Bu içerik hakkında fikrini sosyal akışında paylaş.</Text>\n            </View>\n          </TouchableOpacity>\n\n          {/* DT2'''
assert old in s
s = s.replace(old, new, 1)
old = '''    actionSquare: {\n      width: 48, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12,\n      alignItems: "center", justifyContent: "center",\n    },\n    favBtn: {\n'''
new = '''    actionSquare: {\n      width: 48, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12,\n      alignItems: "center", justifyContent: "center",\n    },\n    tastePostBtn: {\n      marginTop: 10, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.accent, borderRadius: 12,\n      paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 9,\n    },\n    tastePostTitle: { color: c.text, fontWeight: "800", fontSize: 12 },\n    tastePostSub: { color: c.dim, fontSize: 10, marginTop: 2 },\n    favBtn: {\n'''
assert old in s
s = s.replace(old, new, 1)
p.write_text(s)
