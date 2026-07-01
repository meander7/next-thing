const { useState, useEffect, useRef } = React;

// ---- helpers ----
const pad = (n) => String(n).padStart(2, "0");
const nowMinutes = (d) => d.getHours() * 60 + d.getMinutes();
const minutesToLabel = (m) => {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(min)} ${ampm}`;
};
const todayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const STORAGE_KEY = "next-thing:tasks-v1";
const RESET_KEY = "next-thing:last-reset-date";

const storage = {
  get(key) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? null : v;
    } catch (e) {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  },
};

const seedTasks = [
  { id: "t1", title: "Take morning meds", kind: "fixed", time: 8 * 60, done: false, triggerId: null, recurring: true },
  { id: "t2", title: "Feed the pets", kind: "fixed", time: 8 * 60 + 15, done: false, triggerId: null, recurring: true },
  { id: "t3", title: "Log pet weights", kind: "triggered", time: null, done: false, triggerId: "t2", recurring: true },
  { id: "t4", title: "Check job board / Huntr", kind: "fixed", time: 10 * 60, done: false, triggerId: null, recurring: true },
  { id: "t5", title: "Send one follow-up email", kind: "triggered", time: null, done: false, triggerId: "t4", recurring: true },
  { id: "t6", title: "Lunch", kind: "fixed", time: 12 * 60 + 30, done: false, triggerId: null, recurring: true },
  { id: "t7", title: "Wash lunch dishes", kind: "triggered", time: null, done: false, triggerId: "t6", recurring: true },
  { id: "t8", title: "Evening meds", kind: "fixed", time: 20 * 60, done: false, triggerId: null, recurring: true },
];

function parseBulkRows(text, existingTasks) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const newTasks = [];
  const allForLookup = [...existingTasks];

  const parseTimeToMinutes = (raw) => {
    const s = raw.trim();
    const ampm = s.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)$/i);
    if (ampm) {
      let h = parseInt(ampm[1], 10);
      const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
      const isPM = /pm/i.test(ampm[3]);
      if (h === 12) h = 0;
      if (isPM) h += 12;
      return h * 60 + m;
    }
    const military = s.match(/^(\d{1,2}):(\d{2})$/);
    if (military) return parseInt(military[1], 10) * 60 + parseInt(military[2], 10);
    return null;
  };

  lines.forEach((line, idx) => {
    const cols = line.split(/\t|,(?![^(]*\))/).map((c) => c.trim());
    if (cols.length < 2) return;
    const [titleRaw, timeRaw, recurRaw] = cols;
    if (/^title$/i.test(titleRaw)) return;
    const title = titleRaw.replace(/^"|"$/g, "");
    if (!title) return;
    const recurring = recurRaw ? /^(y|yes|true|1)/i.test(recurRaw) : true;
    const id = "t" + Date.now() + "-" + idx;

    const afterMatch = timeRaw && timeRaw.match(/^after:?\s*(.+)$/i);
    if (afterMatch) {
      const triggerTitle = afterMatch[1].trim().toLowerCase();
      const trigger = allForLookup.find((t) => t.title.toLowerCase() === triggerTitle);
      newTasks.push({ id, title, kind: "triggered", time: null, done: false, triggerId: trigger ? trigger.id : null, recurring });
    } else {
      const minutes = parseTimeToMinutes(timeRaw || "");
      newTasks.push({ id, title, kind: "fixed", time: minutes ?? 9 * 60, done: false, triggerId: null, recurring });
    }
    allForLookup.push(newTasks[newTasks.length - 1]);
  });

  return newTasks;
}

function NextThing() {
  const [tasks, setTasks] = useState(seedTasks);
  const [view, setView] = useState("focus");
  const [now, setNow] = useState(new Date());
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let loadedTasks = seedTasks;
    const raw = storage.get(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) loadedTasks = parsed;
      } catch (e) {}
    }
    const lastReset = storage.get(RESET_KEY);
    const today = todayStr(new Date());
    if (lastReset !== today) {
      loadedTasks = loadedTasks.map((t) => (t.recurring ? { ...t, done: false } : t));
      storage.set(RESET_KEY, today);
    }
    setTasks(loadedTasks);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    storage.set(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks, loaded]);

  const nm = nowMinutes(now);

  const isUnlocked = (task) => {
    if (task.kind === "fixed") return true;
    if (!task.triggerId) return true;
    const trigger = tasks.find((t) => t.id === task.triggerId);
    return trigger ? trigger.done : false;
  };

  const toggleDone = (id) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const deleteTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id && t.triggerId !== id));

  const buildTimelineOrder = () => {
    const fixed = tasks.filter((t) => t.kind === "fixed").sort((a, b) => a.time - b.time);
    const result = [];
    fixed.forEach((f) => {
      result.push(f);
      tasks.filter((t) => t.triggerId === f.id).forEach((c) => result.push(c));
    });
    tasks
      .filter((t) => t.kind === "triggered" && !tasks.find((f) => f.id === t.triggerId))
      .forEach((o) => result.push(o));
    return result;
  };

  const timelineOrder = buildTimelineOrder();

  const getNextThing = () => {
    const undone = timelineOrder.filter((t) => !t.done);
    const unlockedUndone = undone.filter(isUnlocked);
    if (unlockedUndone.length === 0) return undone[0] || null;
    const dueFixed = unlockedUndone.filter((t) => t.kind === "fixed" && t.time <= nm).sort((a, b) => b.time - a.time)[0];
    if (dueFixed) return dueFixed;
    const unlockedTriggered = unlockedUndone.find((t) => t.kind === "triggered");
    if (unlockedTriggered) return unlockedTriggered;
    return unlockedUndone.sort((a, b) => (a.time ?? 9999) - (b.time ?? 9999))[0];
  };

  const nextThing = getNextThing();
  const allDone = tasks.length > 0 && tasks.every((t) => t.done);

  const onTouchStart = (e) => (touchStartX.current = e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) setView(dx < 0 ? "timeline" : "focus");
    touchStartX.current = null;
  };

  return (
    <div
      style={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", background: "#FAF7F2", fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <Header view={view} setView={setView} now={now} />
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {view === "focus" ? (
          <FocusView nextThing={nextThing} allDone={allDone} onComplete={toggleDone} now={nm} />
        ) : (
          <TimelineView order={timelineOrder} isUnlocked={isUnlocked} toggleDone={toggleDone} deleteTask={deleteTask} nextId={nextThing && nextThing.id} />
        )}
      </div>
      <BottomBar onAdd={() => setShowAdd(true)} onBulkAdd={() => setShowBulkAdd(true)} />
      {showAdd && (
        <AddTaskModal tasks={tasks} onClose={() => setShowAdd(false)} onAdd={(t) => { setTasks((p) => [...p, t]); setShowAdd(false); }} />
      )}
      {showBulkAdd && (
        <BulkAddModal tasks={tasks} onClose={() => setShowBulkAdd(false)} onAdd={(nt) => { setTasks((p) => [...p, ...nt]); setShowBulkAdd(false); }} />
      )}
    </div>
  );
}

function Header({ view, setView, now }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 20px 16px", borderBottom: "1px solid #E8E1D4" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "#9C8F76", fontFamily: "ui-monospace, monospace" }}>
        {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </div>
      <div style={{ display: "flex", alignItems: "center", borderRadius: 999, padding: 2, background: "#EFE9DC", border: "1px solid #E0D7C4" }}>
        <button onClick={() => setView("focus")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: view === "focus" ? "#2B2B2B" : "transparent", color: view === "focus" ? "#FAF7F2" : "#8A8270", fontSize: 13, fontFamily: "ui-monospace, monospace" }}>
          ⚡ Now
        </button>
        <button onClick={() => setView("timeline")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: view === "timeline" ? "#2B2B2B" : "transparent", color: view === "timeline" ? "#FAF7F2" : "#8A8270", fontSize: 13, fontFamily: "ui-monospace, monospace" }}>
          ☰ Day
        </button>
      </div>
    </div>
  );
}

function FocusView({ nextThing, allDone, onComplete, now }) {
  if (allDone) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center", gap: 12 }}>
        <div style={{ fontSize: 15, fontFamily: "ui-monospace, monospace", color: "#9C8F76", letterSpacing: "0.08em" }}>ALL CLEAR</div>
        <div style={{ fontSize: 28, color: "#2B2B2B", lineHeight: 1.3 }}>Nothing left for now.</div>
        <div style={{ fontSize: 15, color: "#9C8F76" }}>Rest. The next thing will wait for you.</div>
      </div>
    );
  }
  if (!nextThing) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
        <div style={{ fontSize: 18, color: "#9C8F76" }}>Everything left is locked. Check the Day view to see what unlocks it.</div>
      </div>
    );
  }
  const isFixed = nextThing.kind === "fixed";
  const isFuture = isFixed && nextThing.time > now;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", gap: 32 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: 380, width: "100%" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.14em", color: isFuture ? "#9C8F76" : "#7A8B69", fontFamily: "ui-monospace, monospace" }}>
          {isFuture ? `SCHEDULED · ${minutesToLabel(nextThing.time)}` : isFixed ? "DUE NOW" : "UNLOCKED"}
        </div>
        <div style={{ textAlign: "center", fontSize: 36, lineHeight: 1.25, color: "#2B2B2B", fontWeight: 500 }}>{nextThing.title}</div>
        {nextThing.kind === "triggered" && <div style={{ fontSize: 14, color: "#9C8F76" }}>unlocked by completing the task before it</div>}
      </div>
      <button onClick={() => onComplete(nextThing.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 999, background: "#2B2B2B", color: "#FAF7F2", fontSize: 16, fontFamily: "system-ui, sans-serif" }}>
        ✓ Done
      </button>
    </div>
  );
}

function TimelineView({ order, isUnlocked, toggleDone, deleteTask, nextId }) {
  if (order.length === 0) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
        <div style={{ fontSize: 16, color: "#9C8F76" }}>No tasks yet. Add one to start the day.</div>
      </div>
    );
  }
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "20px 20px" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {order.map((task, i) => {
          const unlocked = isUnlocked(task);
          const isNext = task.id === nextId;
          return (
            <div key={task.id} style={{ display: "flex", gap: 12, position: "relative" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 28, height: 28, marginTop: 2, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: task.done ? "#7A8B69" : isNext ? "#2B2B2B" : "#FAF7F2", border: task.done || isNext ? "none" : `1.5px solid ${unlocked ? "#C9BFA6" : "#DCD5C6"}`, fontSize: 12 }}>
                  {task.done ? <span style={{ color: "#FAF7F2" }}>✓</span> : !unlocked ? <span style={{ color: "#B8AF99" }}>🔒</span> : task.kind === "fixed" ? <span style={{ color: isNext ? "#FAF7F2" : "#9C8F76" }}>⏰</span> : null}
                </div>
                {i < order.length - 1 && <div style={{ width: 1.5, flex: 1, background: "#E8E1D4", minHeight: 22 }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: 24, paddingTop: 2 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <button onClick={() => unlocked && toggleDone(task.id)} disabled={!unlocked} style={{ textAlign: "left", flex: 1, background: "none", cursor: unlocked ? "pointer" : "default" }}>
                    <div style={{ fontSize: 17, color: task.done ? "#B8AF99" : unlocked ? "#2B2B2B" : "#A39C88", textDecoration: task.done ? "line-through" : "none", fontWeight: isNext ? 600 : 400 }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#ADA28A", fontFamily: "ui-monospace, monospace", marginTop: 2 }}>
                      {task.kind === "fixed" ? minutesToLabel(task.time) : "after previous step"}
                    </div>
                  </button>
                  <button onClick={() => deleteTask(task.id)} style={{ padding: 4, opacity: 0.5, background: "none" }}>🗑</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BottomBar({ onAdd, onBulkAdd }) {
  return (
    <div style={{ padding: "12px 20px", display: "flex", justifyContent: "center", gap: 8, borderTop: "1px solid #E8E1D4" }}>
      <button onClick={onAdd} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, background: "#EFE9DC", color: "#5C5440", fontSize: 13, fontFamily: "ui-monospace, monospace" }}>+ add task</button>
      <button onClick={onBulkAdd} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, background: "#EFE9DC", color: "#5C5440", fontSize: 13, fontFamily: "ui-monospace, monospace" }}>📋 paste list</button>
    </div>
  );
}

function AddTaskModal({ tasks, onClose, onAdd }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("fixed");
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [triggerId, setTriggerId] = useState((tasks[0] && tasks[0].id) || "");

  const submit = () => {
    if (!title.trim()) return;
    const id = "t" + Date.now();
    if (kind === "fixed") {
      onAdd({ id, title: title.trim(), kind, time: hour * 60 + minute, done: false, triggerId: null, recurring: true });
    } else {
      onAdd({ id, title: title.trim(), kind, time: null, done: false, triggerId: triggerId || null, recurring: true });
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50, background: "rgba(43,43,43,0.4)" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 420, borderRadius: "16px 16px 0 0", padding: 20, display: "flex", flexDirection: "column", gap: 16, background: "#FAF7F2", fontFamily: "'Iowan Old Style', Georgia, serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 18, color: "#2B2B2B" }}>New task</div>
          <button onClick={onClose} style={{ background: "none", color: "#9C8F76", fontSize: 18 }}>✕</button>
        </div>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" style={{ width: "100%", padding: "12px 16px", borderRadius: 12, background: "#EFE9DC", fontSize: 16, color: "#2B2B2B", fontFamily: "system-ui, sans-serif" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setKind("fixed")} style={{ flex: 1, padding: "10px 0", borderRadius: 12, background: kind === "fixed" ? "#2B2B2B" : "#EFE9DC", color: kind === "fixed" ? "#FAF7F2" : "#5C5440", fontSize: 13, fontFamily: "ui-monospace, monospace" }}>fixed time</button>
          <button onClick={() => setKind("triggered")} disabled={tasks.length === 0} style={{ flex: 1, padding: "10px 0", borderRadius: 12, background: kind === "triggered" ? "#2B2B2B" : "#EFE9DC", color: kind === "triggered" ? "#FAF7F2" : "#5C5440", fontSize: 13, fontFamily: "ui-monospace, monospace", opacity: tasks.length === 0 ? 0.5 : 1 }}>after another task</button>
        </div>
        {kind === "fixed" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <select value={hour} onChange={(e) => setHour(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: 8, background: "#EFE9DC", fontSize: 16 }}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{h === 0 ? 12 : h > 12 ? h - 12 : h} {h >= 12 ? "PM" : "AM"}</option>
              ))}
            </select>
            <select value={minute} onChange={(e) => setMinute(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: 8, background: "#EFE9DC", fontSize: 16 }}>
              {[0, 15, 30, 45].map((m) => (<option key={m} value={m}>:{pad(m)}</option>))}
            </select>
          </div>
        ) : (
          <select value={triggerId} onChange={(e) => setTriggerId(e.target.value)} style={{ padding: "10px 12px", borderRadius: 8, width: "100%", background: "#EFE9DC", fontSize: 15 }}>
            {tasks.map((t) => (<option key={t.id} value={t.id}>after: {t.title}</option>))}
          </select>
        )}
        <button onClick={submit} style={{ width: "100%", padding: "12px 0", borderRadius: 12, marginTop: 4, background: "#7A8B69", color: "#FAF7F2", fontSize: 16, fontFamily: "system-ui, sans-serif" }}>Add to schedule</button>
      </div>
    </div>
  );
}

function BulkAddModal({ tasks, onClose, onAdd }) {
  const [text, setText] = useState("");
  const preview = text.trim() ? parseBulkRows(text, tasks) : [];

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50, background: "rgba(43,43,43,0.4)" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 420, borderRadius: "16px 16px 0 0", padding: 20, display: "flex", flexDirection: "column", gap: 12, background: "#FAF7F2", fontFamily: "'Iowan Old Style', Georgia, serif", maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 18, color: "#2B2B2B" }}>Paste a list</div>
          <button onClick={onClose} style={{ background: "none", color: "#9C8F76", fontSize: 18 }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#9C8F76", lineHeight: 1.5 }}>
          One task per line. Copy straight from a spreadsheet column, or type:<br />
          <span style={{ fontFamily: "ui-monospace, monospace" }}>Take meds, 8:00 AM</span><br />
          <span style={{ fontFamily: "ui-monospace, monospace" }}>Log weights, after: Feed the pets</span><br />
          All rows are daily-recurring by default — add a 3rd column "no" to make a one-off.
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"Take meds, 8:00 AM\nFeed the pets, 8:15 AM\nLog weights, after: Feed the pets"} rows={6} style={{ width: "100%", padding: "10px 12px", borderRadius: 12, background: "#EFE9DC", fontSize: 14, color: "#2B2B2B", fontFamily: "ui-monospace, monospace", resize: "vertical" }} />
        {preview.length > 0 && (
          <div style={{ overflowY: "auto", maxHeight: 160 }}>
            <div style={{ fontSize: 11, color: "#9C8F76", fontFamily: "ui-monospace, monospace", marginBottom: 4 }}>{preview.length} task{preview.length !== 1 ? "s" : ""} will be added</div>
            {preview.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13.5, color: "#2B2B2B" }}>
                <span style={{ color: t.recurring ? "#7A8B69" : "#C9BFA6", fontSize: 11 }}>↻</span>
                <span style={{ flex: 1 }}>{t.title}</span>
                <span style={{ fontSize: 11, color: "#9C8F76", fontFamily: "ui-monospace, monospace" }}>{t.kind === "fixed" ? minutesToLabel(t.time) : t.triggerId ? "triggered" : "⚠ trigger not found"}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => preview.length && onAdd(preview)} disabled={preview.length === 0} style={{ width: "100%", padding: "12px 0", borderRadius: 12, marginTop: 4, background: preview.length ? "#7A8B69" : "#DCD5C6", color: "#FAF7F2", fontSize: 16, fontFamily: "system-ui, sans-serif" }}>
          Add {preview.length || ""} task{preview.length === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<NextThing />);
