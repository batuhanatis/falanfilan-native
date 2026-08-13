from pathlib import Path

path = Path("src/screens/ChatConversationScreen.js")
s = path.read_text()

old = '''  useEffect(() => {
    messages.forEach((m) => {
      if (m._status === "failed" && !retryTimeoutsRef.current.has(m.id)) {
        retrySend(m, m._retryCount || 0);
      }
    });
  }, [messages]);'''
new = '''  useEffect(() => {
    messages.forEach((m) => {
      // Kalıcı 4xx hatası veya otomatik deneme sınırına ulaşmış mesajlar uygulama yeniden
      // açıldığında tekrar sonsuz retry döngüsüne girmesin. Kullanıcı isterse balona dokunup
      // manuel olarak yeniden deneyebilir.
      if (m._status === "failed" && !m._autoRetryStopped && !retryTimeoutsRef.current.has(m.id)) {
        retrySend(m, m._retryCount || 0);
      }
    });
  }, [messages]);'''
assert old in s, "failed-message restart effect bulunamadı"
s = s.replace(old, new, 1)

old = '''  const retryTimeoutsRef = useRef(new Map()); // tempId -> setTimeout referansı
  const RETRY_DELAYS = [3000, 6000, 12000, 24000, 30000];'''
new = '''  const retryTimeoutsRef = useRef(new Map()); // tempId -> setTimeout referansı
  const RETRY_DELAYS = [3000, 6000, 12000, 24000, 30000];
  const MAX_AUTO_RETRIES = 5;

  function isRetryableSendError(error) {
    if (error?.isTimeout) return true;
    // fetch'in hiç HTTP cevabı alamadığı network hatalarında status yoktur.
    if (error?.status == null) return true;
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }'''
assert old in s, "retry constants bulunamadı"
s = s.replace(old, new, 1)

old = '''    } catch {
      // Başarısız durumu da kalıcı hale getiriyoruz — sohbetten çıkıp geri dönülse ya da
      // uygulama yeniden başlatılsa bile mesaj "kayıp" görünmüyor, tekrar deneme devam ediyor.
      setMessages((prev) => prev.map((m) => {
        if (m.id !== tempId) return m;
        const updated = { ...m, _status: "failed", _retryCount: retryCount, _clientId: clientId };
        updateLocalMessage(chatId, updated).catch(() => {});
        return updated;
      }));
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
      const t = setTimeout(() => {
        // Bu arada mesaj başka bir yoldan (ör. elle tekrar deneme) zaten gönderilmiş/kaldırılmış
        // olabilir — hâlâ listede VE hâlâ "failed" durumundaysa devam ediyoruz. ÖNEMLİ: clientId
        // burada DEĞİŞMİYOR — aynı mantıksal mesajın tekrar denemesi olduğu için sunucunun
        // "bunu daha önce gördüm" diyebilmesi bu tutarlılığa bağlı.
        setMessages((prevMsgs) => {
          const stillThere = prevMsgs.find((m) => m.id === tempId && m._status === "failed");
          if (stillThere) attemptSend(tempId, body, replyId, clientId, retryCount + 1);
          return prevMsgs;
        });
      }, delay);
      retryTimeoutsRef.current.set(tempId, t);
    }'''
new = '''    } catch (e) {
      const shouldRetry = isRetryableSendError(e) && retryCount < MAX_AUTO_RETRIES;
      // 400/401/403/404 gibi kalıcı HTTP hataları otomatik tekrar edilmez. Network/timeout,
      // 408/429 ve 5xx ise sınırlı sayıda kademeli olarak denenir.
      setMessages((prev) => prev.map((m) => {
        if (m.id !== tempId) return m;
        const updated = {
          ...m,
          _status: "failed",
          _retryCount: retryCount,
          _clientId: clientId,
          _autoRetryStopped: !shouldRetry,
        };
        updateLocalMessage(chatId, updated).catch(() => {});
        return updated;
      }));
      if (!shouldRetry) {
        retryTimeoutsRef.current.delete(tempId);
        return;
      }
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
      const t = setTimeout(() => {
        setMessages((prevMsgs) => {
          const stillThere = prevMsgs.find((m) => m.id === tempId && m._status === "failed" && !m._autoRetryStopped);
          if (stillThere) attemptSend(tempId, body, replyId, clientId, retryCount + 1);
          return prevMsgs;
        });
      }, delay);
      retryTimeoutsRef.current.set(tempId, t);
    }'''
assert old in s, "text attemptSend catch bloğu bulunamadı"
s = s.replace(old, new, 1)

old = '''    } catch {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== tempId) return m;
        const updated = { ...m, _status: "failed", _retryCount: retryCount, _clientId: clientId };
        updateLocalMessage(chatId, updated).catch(() => {});
        return updated;
      }));
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
      const t = setTimeout(() => {
        setMessages((prevMsgs) => {
          const stillThere = prevMsgs.find((m) => m.id === tempId && m._status === "failed");
          if (stillThere) attemptSendPhoto(tempId, dataUri, once, clientId, retryCount + 1);
          return prevMsgs;
        });
      }, delay);
      retryTimeoutsRef.current.set(tempId, t);
    }'''
new = '''    } catch (e) {
      const shouldRetry = isRetryableSendError(e) && retryCount < MAX_AUTO_RETRIES;
      setMessages((prev) => prev.map((m) => {
        if (m.id !== tempId) return m;
        const updated = {
          ...m,
          _status: "failed",
          _retryCount: retryCount,
          _clientId: clientId,
          _autoRetryStopped: !shouldRetry,
        };
        updateLocalMessage(chatId, updated).catch(() => {});
        return updated;
      }));
      if (!shouldRetry) {
        retryTimeoutsRef.current.delete(tempId);
        return;
      }
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
      const t = setTimeout(() => {
        setMessages((prevMsgs) => {
          const stillThere = prevMsgs.find((m) => m.id === tempId && m._status === "failed" && !m._autoRetryStopped);
          if (stillThere) attemptSendPhoto(tempId, dataUri, once, clientId, retryCount + 1);
          return prevMsgs;
        });
      }, delay);
      retryTimeoutsRef.current.set(tempId, t);
    }'''
assert old in s, "photo retry catch bloğu bulunamadı"
s = s.replace(old, new, 1)

old = '''    setMessages((prev) => prev.map((m) => (m.id === item.id ? { ...m, _status: "sending" } : m)));'''
new = '''    setMessages((prev) => prev.map((m) => (m.id === item.id ? { ...m, _status: "sending", _autoRetryStopped: false } : m)));'''
assert old in s, "manual retry state satırı bulunamadı"
s = s.replace(old, new, 1)

path.write_text(s)
print("ChatConversation retry policy patched")
