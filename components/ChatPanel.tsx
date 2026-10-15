'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, Bell, Check, CheckCheck, MessageCircle, SquarePen, FileText, Image as ImageIcon, Mic, MoreVertical, Paperclip, Search, Send, Smile, X, Square, Pin, Star, Users, MoreHorizontal } from 'lucide-react';
import type { Persona, ChatMessage } from '@/lib/types';
import { nameFor, timeAgo } from '@/lib/types';
import { getSupabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import ProfileAvatar from './ProfileAvatar';
import { CHAT_BUCKET, signedMedia, uploadMedia, validateUpload } from '@/lib/media';

const db = getSupabase();
type ChatListRow = { conversation_id: string; other_user_id: string; last_message_at: string | null };
type Props = { user: User; friends: Persona[]; directory: Persona[]; initialPeerId?: string | null; onlineIds?: string[]; onProfile?: (id: string) => void; onError: (e: unknown) => void };

type PreviewMap = Record<string, { body: string; media_type: string; created_at: string | null }>;

function previewText(entry?: { body: string; media_type: string; created_at: string | null }) {
  if (!entry) return 'Start a conversation';
  if (entry.body?.trim()) return entry.body.trim();
  if (entry.media_type === 'image') return '📷 Photo';
  if (entry.media_type === 'video') return '🎬 Video';
  if (entry.media_type === 'audio') return '🎤 Voice message';
  if (entry.media_type === 'file') return '📄 Document';
  return 'New message';
}

export default function ChatPanel({ user, friends, directory, initialPeerId, onlineIds = [], onProfile, onError }: Props) {
  const [rows, setRows] = useState<ChatListRow[]>([]);
  const [peer, setPeer] = useState<string | null>(null);
  const [conversation, setConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readMessageIds, setReadMessageIds] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('');
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [chatNotice, setChatNotice] = useState('');
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'online'>('all');
  const [unreadIds, setUnreadIds] = useState<string[]>([]);
  const [starred, setStarred] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<{ muted: boolean; pinned: boolean }>({ muted: false, pinned: false });
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadSearch, setThreadSearch] = useState('');
  const [previewByConversation, setPreviewByConversation] = useState<PreviewMap>({});

  const threadScroller = useRef<HTMLDivElement>(null);
  const previousScroll = useRef<{ conversation: string | null; lastId: string | null }>({ conversation: null, lastId: null });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const didAutoSelect = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recorderStream = useRef<MediaStream | null>(null);
  const recorderChunks = useRef<Blob[]>([]);
  const msg = errorMessage;
  const show = (e: unknown) => { setChatNotice(msg(e)); onError(e); };

  const loadList = useCallback(async () => {
    if (!db) return;
    const res = await db.rpc('tgy_list_direct_chats');
    if (res.error) show(res.error);
    else setRows((res.data || []) as ChatListRow[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const loadMessages = useCallback(async (id: string) => {
    if (!db) return;
    const res = await db.from('tgy_messages').select('id,conversation_id,sender_id,body,media_path,media_type,attachment_name,created_at')
      .eq('conversation_id', id).order('created_at', { ascending: true }).limit(250);
    if (res.error) show(res.error);
    else {
      const arr = (res.data || []) as ChatMessage[];
      setMessages(arr);
      const received = arr.filter(m => m.sender_id !== user.id).map(m => ({ message_id: m.id, user_id: user.id }));
      if (received.length) void db.from('tgy_message_reads').upsert(received, { onConflict: 'message_id,user_id', ignoreDuplicates: true });
      const ids = arr.filter(m => m.sender_id === user.id).map(m => m.id);
      if (ids.length) {
        const receipts = await db.from('tgy_message_reads').select('message_id').in('message_id', ids);
        if (!receipts.error) setReadMessageIds((receipts.data || []).map(r => r.message_id));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const loadPreviews = useCallback(async (list: ChatListRow[]) => {
    if (!db) return;
    const ids = list.map(x => x.conversation_id).filter(Boolean);
    if (!ids.length) {
      setPreviewByConversation({});
      return;
    }
    const res = await db.from('tgy_messages').select('conversation_id,body,media_type,created_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(Math.max(ids.length * 6, 40));
    if (res.error) return;
    const map: PreviewMap = {};
    for (const row of (res.data || []) as { conversation_id: string; body: string; media_type: string; created_at: string | null }[]) {
      if (!map[row.conversation_id]) map[row.conversation_id] = row;
    }
    setPreviewByConversation(map);
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { void loadPreviews(rows); }, [rows, loadPreviews]);

  useEffect(() => {
    if (!db || !conversation) return;
    void loadMessages(conversation);
    const channel = db.channel(`dm-${conversation}`).on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'tgy_messages', filter: `conversation_id=eq.${conversation}`
    }, () => { void loadMessages(conversation); void loadList(); }).subscribe();
    const tick = window.setInterval(() => { void loadMessages(conversation); }, 15000);
    return () => { clearInterval(tick); void db?.removeChannel(channel); };
  }, [conversation, loadMessages, loadList]);

  // Never use scrollIntoView here: it scrolls the entire Next.js page and
  // hides the chat header/composer. Only scroll inside the message pane.
  useEffect(() => {
    const pane = threadScroller.current;
    if (!pane) return;
    const lastId = messages[messages.length - 1]?.id ?? null;
    const changedThread = previousScroll.current.conversation !== conversation;
    const firstLoadedMessages = previousScroll.current.lastId === null && lastId !== null;
    const nearBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 220;
    if (changedThread || firstLoadedMessages || (previousScroll.current.lastId !== lastId && nearBottom)) {
      pane.scrollTop = pane.scrollHeight;
    }
    previousScroll.current = { conversation, lastId };
  }, [messages, conversation]);
  useEffect(() => {
    let alive = true;
    Promise.all(messages.filter(m => m.media_path).map(async m => {
      try { return [m.id, await signedMedia(CHAT_BUCKET, m.media_path!)] as const; } catch { return [m.id, ''] as const; }
    })).then(entries => { if (alive) setUrls(Object.fromEntries(entries)); });
    return () => { alive = false; };
  }, [messages]);

  const open = useCallback(async (other: string) => {
    if (!db || other === user.id) return;
    const res = await db.rpc('tgy_open_direct_chat', { p_other_user: other });
    if (res.error) { show(res.error); return; }
    setConversation(String(res.data));
    setPeer(other);
    setAttachmentsOpen(false);
    setMessages([]);
    void loadList();
    const id = String(res.data);
    void db.from('tgy_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).eq('kind', 'message').filter('payload->>conversation_id', 'eq', id).is('read_at', null).then(({ error }) => { if (!error) setUnreadIds(x => x.filter(y => y !== id)); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, loadList]);

  useEffect(() => { if (initialPeerId) void open(initialPeerId); }, [initialPeerId, open]);

  // On desktop, select the first real chat once. On mobile, start with the
  // conversation list. Crucially, Back must not immediately reopen a chat.
  useEffect(() => {
    if (didAutoSelect.current || conversation || initialPeerId || window.innerWidth <= 850) return;
    const candidate = rows[0]?.other_user_id || friends[0]?.user_id;
    if (candidate) { didAutoSelect.current = true; void open(candidate); }
  }, [conversation, rows, friends, initialPeerId, open]);

  const sendText = async () => {
    if (!db || !conversation || !text.trim()) return;
    setBusy(true);
    const r = await db.from('tgy_messages').insert({ conversation_id: conversation, sender_id: user.id, body: text.trim(), media_type: 'text' });
    if (r.error) show(r.error); else { setText(''); await loadMessages(conversation); await loadList(); }
    setBusy(false);
  };

  const sendFile = async (file: File) => {
    if (!db || !conversation) return;
    setBusy(true); setAttachmentsOpen(false);
    try {
      validateUpload(file, 'chat');
      const path = await uploadMedia(CHAT_BUCKET, user.id, conversation, file);
      const category = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'file';
      const r = await db.from('tgy_messages').insert({ conversation_id: conversation, sender_id: user.id, body: null, media_path: path, media_type: category, attachment_name: file.name.slice(0, 180) });
      if (r.error) throw r.error;
      await loadMessages(conversation);
      await loadList();
    } catch (e) { show(e); } finally { setBusy(false); }
  };

  const startRecording = async () => {
    if (!conversation) { setChatNotice('Open a conversation first.'); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setChatNotice('This browser does not support voice recording.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : MediaRecorder.isTypeSupported('audio/mp4') ? { mimeType: 'audio/mp4' } : undefined;
      const rec = new MediaRecorder(stream, options); recorder.current = rec; recorderStream.current = stream; recorderChunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) recorderChunks.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop()); setRecording(false);
        const mime = rec.mimeType.startsWith('audio/mp4') ? 'audio/mp4' : 'audio/webm';
        const audio = new Blob(recorderChunks.current, { type: mime });
        if (audio.size > 0) void sendFile(new File([audio], `voice-${Date.now()}.${mime === 'audio/mp4' ? 'm4a' : 'webm'}`, { type: mime }));
      };
      rec.start(); setRecording(true);
    } catch (e) { show(e); }
  };

  const stopRecording = () => recorder.current?.state === 'recording' && recorder.current.stop();
  useEffect(() => () => { const rec = recorder.current; if (rec?.state === 'recording') { rec.onstop = null; rec.stop(); } recorderStream.current?.getTracks().forEach(t => t.stop()); }, []);

  useEffect(() => {
    if (!db || !user) return;
    const load = async () => {
      const r = await db.from('tgy_notifications').select('payload').eq('user_id', user.id).eq('kind', 'message').is('read_at', null).limit(100);
      if (!r.error) setUnreadIds((r.data || []).map(x => String(x.payload?.conversation_id || '')));
    };
    void load();
    const id = window.setInterval(() => { void load(); }, 12000);
    return () => clearInterval(id);
  }, [user.id]);

  useEffect(() => {
    if (!db || !conversation) return; let alive = true;
    Promise.all([
      db.from('tpy_chat_preferences').select('muted,pinned').eq('user_id', user.id).eq('conversation_id', conversation).maybeSingle(),
      db.from('tpy_starred_messages').select('message_id').eq('user_id', user.id),
    ]).then(([a, b]) => {
      if (!alive) return;
      if (!a.error) setPrefs({ muted: a.data?.muted || false, pinned: a.data?.pinned || false });
      if (!b.error) setStarred((b.data || []).map(x => x.message_id));
    });
    return () => { alive = false; };
  }, [conversation, user.id]);

  const updatePref = async (key: 'muted' | 'pinned') => {
    if (!db || !conversation) return;
    const next = { ...prefs, [key]: !prefs[key] };
    const r = await db.from('tpy_chat_preferences').upsert({ conversation_id: conversation, user_id: user.id, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id,conversation_id' });
    if (r.error) show(r.error); else setPrefs(next);
  };

  const toggleStar = async (id: string) => {
    if (!db) return;
    const had = starred.includes(id);
    const r = had
      ? await db.from('tpy_starred_messages').delete().eq('user_id', user.id).eq('message_id', id)
      : await db.from('tpy_starred_messages').insert({ user_id: user.id, message_id: id });
    if (r.error) show(r.error); else setStarred(cur => had ? cur.filter(x => x !== id) : [...cur, id]);
  };

  const chatList = [...rows];
  for (const f of friends) if (!chatList.some(r => r.other_user_id === f.user_id)) chatList.push({ conversation_id: '', other_user_id: f.user_id, last_message_at: null });

  const shown = useMemo(() => chatList
    .filter(c => nameFor(directory, c.other_user_id).toLowerCase().includes(filter.toLowerCase()))
    .filter(c => chatFilter === 'all' || (chatFilter === 'unread' && unreadIds.includes(c.conversation_id)) || (chatFilter === 'online' && onlineIds.includes(c.other_user_id)))
    .sort((a, b) => {
      const ap = a.conversation_id === conversation && prefs.pinned ? 1 : 0;
      const bp = b.conversation_id === conversation && prefs.pinned ? 1 : 0;
      return bp - ap || new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
    }), [chatList, directory, filter, chatFilter, unreadIds, onlineIds, conversation, prefs.pinned]);

  const peerProfile = directory.find(p => p.user_id === peer);
  const shared = messages.filter(m => m.media_path);
  const starredMessages = messages.filter(m => starred.includes(m.id));
  const currentPreview = conversation ? previewByConversation[conversation] : undefined;
  const visibleMessages = threadSearch.trim()
    ? messages.filter(m => (m.body || m.attachment_name || '').toLowerCase().includes(threadSearch.trim().toLowerCase()))
    : messages;

  return <div className={`messenger tpy-messages-reference ${conversation && peer && detailsOpen ? 'has-chat-details' : 'no-chat-details'}`}>
    <aside className={`message-sidebar ${conversation ? 'mobile-hidden' : ''}`}>
      <div className="message-heading">
        <h1>Chats</h1>
        <button aria-label="Find a new conversation" onClick={() => { setChatFilter('all'); setFilter(''); searchInputRef.current?.focus(); }}><SquarePen size={18} /></button>
      </div>
      <label className="chat-search"><Search size={18} /><input ref={searchInputRef} placeholder="Search messages..." value={filter} onChange={e => setFilter(e.target.value)} /></label>
      <div className="chat-filters">{(['all', 'unread', 'online'] as const).map(x => <button type="button" key={x} className={chatFilter === x ? 'selected' : ''} onClick={() => setChatFilter(x)}>{x === 'all' ? 'All' : x === 'unread' ? `Unread ${unreadIds.length || ''}` : 'Online'}</button>)}</div>
      <div className="ui-chat-list-scroll">
        {shown.length ? shown.map(c => {
          const profile = directory.find(p => p.user_id === c.other_user_id);
          const isUnread = unreadIds.includes(c.conversation_id);
          const isActive = peer === c.other_user_id;
          const preview = previewByConversation[c.conversation_id];
          return <button key={c.other_user_id} className={`conversation-row ${isActive ? 'selected' : ''}`} onClick={() => void open(c.other_user_id)}>
            <ProfileAvatar profile={profile} size={56} online={onlineIds.includes(c.other_user_id)} />
            <span className="ui-chat-row-main">
              <span className="ui-chat-row-top"><b>{profile?.display_name || 'Member'}</b><small>{preview?.created_at ? timeAgo(preview.created_at) : c.last_message_at ? timeAgo(c.last_message_at) : ''}</small></span>
              <span className="ui-chat-row-bottom"><small>{previewText(preview).slice(0, 48)}</small>{isUnread ? <i className="ui-chat-unread-badge">{Math.min(9, unreadIds.filter(x => x === c.conversation_id).length || 1)}</i> : null}</span>
            </span>
          </button>;
        }) : <p className="chat-placeholder">No chats yet. Add a friend to start messaging.</p>}
      </div>
    </aside>

    <main className={`message-thread ${!conversation ? 'mobile-hidden' : ''}`}>
      {conversation && peer ? <>
        <header className="thread-header">
          <button className="mobile-back" aria-label="All chats" onClick={() => { setConversation(null); setPeer(null); }}><ArrowLeft size={20} /></button>
          <ProfileAvatar profile={peerProfile} size={46} online={onlineIds.includes(peer)} />
          <button className="thread-contact ui-chat-profile-link" onClick={() => onProfile?.(peer)}>
            <b>{nameFor(directory, peer)}</b>
            <small>{onlineIds.includes(peer) ? '● Online now' : 'Private conversation'}</small>
          </button>
          <div className="thread-actions">
            <button aria-label="Search in chat" onClick={() => { setThreadSearchOpen(v => !v); setThreadSearch(''); }}><Search size={19} /></button>
            <button aria-label="Conversation details" onClick={() => setDetailsOpen(v => !v)}><Users size={19} /></button>
            <button aria-label="Chat options" onClick={() => setMenuOpen(v => !v)}><MoreHorizontal size={19} /></button>
            {menuOpen && <div className="ui-small-popover ui-thread-menu">
              <button onClick={() => { void updatePref('muted'); setMenuOpen(false); }}>{prefs.muted ? 'Unmute' : 'Mute'} notifications</button>
              <button onClick={() => { void updatePref('pinned'); setMenuOpen(false); }}>{prefs.pinned ? 'Unpin' : 'Pin'} conversation</button>
              <button onClick={() => { setDetailsOpen(true); setMenuOpen(false); }}>Conversation details</button>
            </div>}
          </div>
        </header>

        {threadSearchOpen && <div className="tpy-thread-search"><Search size={17} /><input autoFocus value={threadSearch} onChange={e => setThreadSearch(e.target.value)} placeholder="Find a message in this chat" aria-label="Find message" /><button type="button" aria-label="Close message search" onClick={() => { setThreadSearchOpen(false); setThreadSearch(''); }}><X size={17} /></button></div>}
        <div className="thread-scroller" ref={threadScroller}>
          <div className="chat-encryption">Only conversation members can access messages through Supabase policies. This is not end-to-end encryption.</div>
          {threadSearch && !visibleMessages.length && <p className="tpy-chat-no-results">No messages match your search.</p>}
          {visibleMessages.map(m => <div className={`message-bubble ${m.sender_id === user.id ? 'my-bubble' : ''}`} key={m.id}>
            <button className={`ui-message-star ${starred.includes(m.id) ? 'active' : ''}`} title={starred.includes(m.id) ? 'Unstar message' : 'Star message'} aria-label={starred.includes(m.id) ? 'Unstar message' : 'Star message'} onClick={() => void toggleStar(m.id)}><Star size={14} fill={starred.includes(m.id) ? 'currentColor' : 'none'} /></button>
            {!!m.body && <div className="bubble-text">{m.body}</div>}
            {m.media_path && (urls[m.id] ? (m.media_type === 'audio' ? <audio controls preload="metadata" src={urls[m.id]} /> :
              m.media_type === 'video' ? <video controls preload="metadata" className="chat-media" src={urls[m.id]} /> :
                m.media_type === 'image' ? <img src={urls[m.id]} className="chat-media" alt={m.attachment_name || 'Shared photo'} /> :
                  <a href={urls[m.id]} target="_blank" rel="noreferrer" className="chat-document"><FileText size={20} />{m.attachment_name || 'Download attachment'}</a>) : <span>Loading attachment…</span>)}
            <small>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{m.sender_id === user.id && (readMessageIds.includes(m.id) ? <CheckCheck size={12} color="#7fe8c7" /> : <Check size={12} />)}</small>
          </div>)}
          <div aria-hidden="true" />
        </div>

        <form className="chat-composer" onSubmit={e => { e.preventDefault(); void sendText(); }}>
          <div className="attach-wrap"><button type="button" aria-label="Attach file" onClick={() => setAttachmentsOpen(v => !v)}><Paperclip size={20} /></button>
            {attachmentsOpen && <div className="attach-menu">
              <button type="button" onClick={() => fileRef.current?.click()}><ImageIcon size={18} /> Photos &amp; videos</button>
              <button type="button" onClick={() => fileRef.current?.click()}><FileText size={18} /> Document</button>
              <button type="button" onClick={() => setChatNotice('Use the microphone button to record a voice note.')}><Mic size={18} /> Voice message</button>
            </div>}
          </div>
          <input ref={fileRef} type="file" hidden accept="image/*,video/mp4,video/webm,audio/webm,audio/mp4,audio/ogg,audio/mpeg,application/pdf" onChange={e => { const file = e.target.files?.[0]; if (file) void sendFile(file); e.target.value = ''; }} />
          <button type="button" aria-label="Insert emoji" onClick={() => setText(s => s + ' 😊')}><Smile size={20} /></button>
          <input className="chat-text-input" aria-label="Write a message" placeholder={recording ? 'Recording voice note…' : 'Type a message...'} value={text} maxLength={10000} onChange={e => setText(e.target.value)} disabled={busy || recording} />
          {text.trim() ? <button aria-label="Send message" type="submit" disabled={busy}><Send size={19} /></button> :
            <button aria-label={recording ? 'Stop recording and send' : 'Record voice message'} type="button" onClick={recording ? stopRecording : () => void startRecording()} className={recording ? 'recording' : ''}>{recording ? <Square size={17} /> : <Mic size={20} />}</button>}
        </form>
      </> : <div className="conversation-empty"><MessageCircleIcon /><h2>Private conversations</h2><p>Choose a friend to begin chatting. Text, images, video attachments and voice notes are supported.</p></div>}
    </main>

    {conversation && peer && detailsOpen && <aside className="ui-conversation-details">
      <header><h2>Conversation details</h2><button className="ui-btn-icon" aria-label="Close details" onClick={() => setDetailsOpen(false)}><X size={17} /></button></header>
      <div className="ui-conversation-person"><ProfileAvatar profile={peerProfile} size={82} online={onlineIds.includes(peer)} /><b>{peerProfile?.display_name || 'Member'}</b><small>@{peerProfile?.username || 'member'}</small><p>{peerProfile?.bio || 'Private conversation between connected members.'}</p><button className="ui-btn-outline" onClick={() => onProfile?.(peer)}>View profile</button></div>
      <div className="ui-conversation-option"><span><Bell size={17} /> Notifications</span><button onClick={() => void updatePref('muted')}>{prefs.muted ? 'Muted' : 'Enabled'}</button></div>
      <div className="ui-conversation-option"><span><Pin size={17} /> Pinned conversation</span><button onClick={() => void updatePref('pinned')}>{prefs.pinned ? 'Pinned' : 'Not pinned'}</button></div>
      <section><h3>Shared media <span>{shared.length}</span></h3>{shared.length ? <div className="ui-chat-shared">{shared.slice(-8).map(m => m.media_type === 'image' && urls[m.id] ? <img src={urls[m.id]} key={m.id} alt={m.attachment_name || 'Shared image'} loading="lazy" /> : <a key={m.id} href={urls[m.id] || '#'} target="_blank" rel="noopener noreferrer"><FileText size={18} />{m.attachment_name || m.media_type}</a>)}</div> : <p>No shared media yet.</p>}</section>
      <section><h3><Star size={16} /> Starred messages <span>{starredMessages.length}</span></h3>{starredMessages.length ? <div className="ui-chat-starred">{starredMessages.map(m => <button key={m.id} onClick={() => void toggleStar(m.id)} title="Remove star">{m.body?.slice(0, 90) || m.attachment_name || 'Media'}<Star size={14} fill="currentColor" /></button>)}</div> : <p>Star a message to find it here.</p>}</section>
      <section><h3>Preview</h3><p>{previewText(currentPreview)}</p></section>
      <small className="ui-chat-privacy">Supabase row policies restrict conversations to members. Messages are not end-to-end encrypted.</small>
    </aside>}

    {chatNotice && <div className="inapp-toast" role="status">{chatNotice}<button onClick={() => setChatNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
  </div>;
}
function MessageCircleIcon() { return <MessageCircle size={52} strokeWidth={1.4} />; }
