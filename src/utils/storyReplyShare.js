const PREFIX = "__STORY_REPLY__";

// Bu tür sadece backend'de (POST /api/stories/:id/reply) üretiliyor, native taraf hiç
// encode etmiyor — burada sadece ChatMessageRow/ChatListScreen/ChatConversationScreen'in
// gövdeyi çözmesi için decode var.
export function decodeStoryReply(body) {
  if (!body || typeof body !== "string" || !body.startsWith(PREFIX)) return null;
  try {
    return JSON.parse(body.slice(PREFIX.length));
  } catch {
    return null;
  }
}
