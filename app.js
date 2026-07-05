const { useState, useEffect, useRef } = React;

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
  get(key) { try { const v = localStorage.getItem(key); return v === null ? null : v; } catch (e) { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} },
  remove(key) { try { localStorage.removeItem(key); } catch (e) {} },
};

// scheduledFor: "today" | "tomorrow"
const seedTasks = [
  { id: "s1",  title: "Isaiah pre-breakfast med", kind: "fixed",     time: 5*60+30,  done: false, triggerId: null, recurring: true, scheduledFor: "today" },
  { id: "s2",  title: "Dogs out",                 kind: "triggered", time: null,      done: false, triggerId: "s1", recurring: true, scheduledFor: "today" },
  { id: "s3",  title: "Dogs breakfast",           kind: "triggered", time: null,      done: false, triggerId: "s2", recurring: true, scheduledFor: "today" },
  { id: "s4",  title: "Isaiah breakfast",         kind: "fixed",     time: 6*60,      done: false, triggerId: null, recurring: true, scheduledFor: "today" },
  { id: "s5",  title: "Isaiah ready for school",  kind: "fixed",     time: 7*60+15,   done: false, triggerId: null, recurring: true, scheduledFor: "today" },
  { id: "s6",  title: "Morning meds",             kind: "triggered", time: null,      done: false, triggerId: "s5", recurring: true, scheduledFor: "today" },
  { id: "s7",  title: "Isaiah morning meds",      kind: "fixed",     time: 7*60+45,   done: false, triggerId: null, recurring: true, scheduledFor: "today" },
  { id: "s8",  title: "Isaiah bus",               kind: "fixed",     time: 8*60+15,   done: false, triggerId: null, recurring: true, scheduledFor: "today" },
  { id: "s9",  title: "Litter boxes",             kind: "triggered", time: null,      done: false, triggerId: "s8", recurring: true, scheduledFor: "today" },
  { id: "s10", title: "Isaiah lunch",             kind: "fixed",     time: 12*60,     done: false, triggerId: null, recurring: true, scheduledFor: "today" },
  { id: "s11", title: "Lunch",                    kind: "fixed",     time: 12*60+30,  done: false, triggerId: null, recurring: true, scheduledFor: "today" },
  { id: "s12", title: "Isaiah PM meds",           kind: "fixed",     time: 15*60+45,  done: false, triggerId: null, recurring: true, scheduledFor: "today" },
  { id: "s13", title: "Start cooking dinner",     kind: "fixed",     time: 16*60+30,  done: false, triggerId: null, recurring: true, scheduledFor: "today" },
  { id: "s14", title: "Isaiah dinner",            kind: "fixed",     time: 18*60,     done: false, triggerId: null, recurring: true, scheduledFor: "today" },
  { id: "s15", title: "Kids' showers",            kind: "fixed",     time: 19*60,     done: false, triggerId: null, recurring: true, scheduledFor: "today" },
  { id: "s16", title: "Isaiah bedtime meds",      kind: "fixed",     time: 19*60+45,  done: false, triggerId: null, recurring: true, scheduledFor: "today" },
  { id: "s17", title: "Kellan bedtime meds",      kind: "fixed",     time: 20*60,     done: false, triggerId: null, recurring: true, scheduledFor: "today" },
  { id: "s18", title: "Elliot bedtime meds",      kind: "fixed",     time: 20*60,     done: false, triggerId: null, recurring: true, scheduledFor: "today" },
  { id: "s19", title: "Isaiah overnight",         kind: "fixed",     time: 1440,      done: false, triggerId: null, recurring: true, scheduledFor: "today" },
];

function parseBulkRows(text, existingTasks, scheduledFor = "today") {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const newTasks = [];
  const allForLookup = [...existingTasks];

  const parseTimeToMinutes = (raw) => {
    const s = raw.trim();
    const ampm = s.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)$/i);
    if (ampm) {
      let h = parseInt(ampm[1], 10);
      const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
      if (h === 12) h = 0;
      if (/pm/i.test(ampm[3])) h += 12;
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
      const trigger = allForLookup.find((t) => t.title.toLowerCase() === afterMatch[1].trim().toLowerCase());
      newTasks.push({ id, title, kind: "triggered", time: null, done: false, triggerId: trigger ? trigger.id : null, recurring, scheduledFor });
    } else {
      const minutes = parseTimeToMinutes(timeRaw || "");
      newTasks.push({ id, title, kind: "fixed", time: minutes ?? 9 * 60, done: false, triggerId: null, recurring, scheduledFor });
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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showTomorrow, setShowTomorrow] = useState(false);
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

    // Migrate old tasks that don't have scheduledFor
    loadedTasks = loadedTasks.map((t) => ({ scheduledFor: "today", ...t }));

    const lastReset = storage.get(RESET_KEY);
    const today = todayStr(new Date());
    if (lastReset !== today) {
      loadedTasks = loadedTasks.map((t) => {
        if (t.scheduledFor === "tomorrow") return { ...t, scheduledFor: "today", done: false };
        if (t.recurring) return { ...t, done: false };
        return t;
      });
      storage.set(RESET_KEY, today);
    }

    setTasks(loadedTasks);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    storage.set(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks, loaded]);

  const handleResetToDefault = () => {
    storage.remove(STORAGE_KEY);
    storage.remove(RESET_KEY);
    setTasks(seedTasks);
    setShowResetConfirm(false);
  };

  const nm = nowMinutes(now);
  const todayTasks = tasks.filter((t) => t.scheduledFor === "today");
  const tomorrowTasks = tasks.filter((t) => t.scheduledFor === "tomorrow");

  const isUnlocked = (task) => {
    if (task.kind === "fixed") return true;
    if (!task.triggerId) return true;
    const trigger = todayTasks.find((t) => t.id === task.triggerId);
    return trigger ? trigger.done : false;
  };

  const toggleDone = (id) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const deleteTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id && t.triggerId !== id));
  const deleteTomorrowTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const buildTimelineOrder = (taskList) => {
    const fixed = taskList.filter((t) => t.kind === "fixed").sort((a, b) => a.time - b.time);
    const result = [];
    fixed.forEach((f) => {
      result.push(f);
      taskList.filter((t) => t.triggerId === f.id).forEach((c) => result.push(c));
    });
    taskList.filter((t) => t.kind === "triggered" && !taskList.find((f) => f.id === t.triggerId)).forEach((o) => result.push(o));
    return result;
  };

  const timelineOrder = buildTimelineOrder(todayTasks);

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
  const allDone = todayTasks.length > 0 && todayTasks.every((t) => t.done);

  const onTouchStart = (e) => (touchStartX.current = e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) setView(dx < 0 ? "timeline" : "focus");
    touchStartX.current = null;
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", background: "#FAF7F2", fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif" }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <Header view={view} setView={setView} now={now} onReset={() => setShowResetConfirm(true)} tomorrowCount={tomorrowTasks.length} onTomorrowOpen={() => setShowTomorrow(true)} />
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {view === "focus"
          ? <FocusView nextThing={nextThing} allDone={allDone} onComplete={toggleDone} now={nm} />
          : <TimelineView order={timelineOrder} isUnlocked={isUnlocked} toggleDone={toggleDone} deleteTask={deleteTask} nextId={nextThing && nextThing.id} />}
      </div>
      <BottomBar onAdd={() => setShowAdd(true)} onBulkAdd={() => setShowBulkAdd(true)} />

      {showAdd && <AddTaskModal tasks={todayTasks} onClose={() => setShowAdd(false)} onAdd={(t) => { setTasks((p) => [...p, t]); setShowAdd(false); }} />}
      {showBulkAdd && <BulkAddModal tasks={tasks} onClose={() => setShowBulkAdd(false)} onAdd={(nt) => { setTasks((p) => [...p, ...nt]); setShowBulkAdd(false); }} />}
      {showResetConfirm && <ResetConfirmModal onConfirm={handleResetToDefault} onClose={() => setShowResetConfirm(false)} />}
      {showTomorrow && <TomorrowDrawer tasks={tomorrowTasks} onClose={() => setShowTomorrow(false)} onDelete={deleteTomorrowTask} onAdd={() => { setShowTomorrow(false); setShowAdd(true); }} />}
    </div>
  );
}

function Header({ view, setView, now, onReset, tomorrowCount, onTomorrowOpen }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 20px 16px", borderBottom: "1px solid #E8E1D4" }}>
      <div>
        <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "#9C8F76", fontFamily: "ui-monospace, monospace" }}>
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </div>
        {tomorrowCount > 0 && (
          <button onClick={onTomorrowOpen} style={{ background: "none", padding: 0, marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 11, color: "#7A8B69", fontFamily: "ui-monospace, monospace", letterSpacing: "0.08em" }}>
              {tomorrowCount} queued for tomorrow →
            </span>
          </button>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", borderRadius: 999, padding: 2, background: "#EFE9DC", border: "1px solid #E0D7C4" }}>
          <button onClick={() => setView("focus")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: view === "focus" ? "#2B2B2B" : "transparent", color: view === "focus" ? "#FAF7F2" : "#8A8270", fontSize: 13, fontFamily: "ui-monospace, monospace" }}>⚡ Now</button>
          <button onClick={() => setView("timeline")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: view === "timeline" ? "#2B2B2B" : "transparent", color: view === "timeline" ? "#FAF7F2" : "#8A8270", fontSize: 13, fontFamily: "ui-monospace, monospace" }}>☰ Day</button>
        </div>
        <button onClick={onReset} title="Reset to default schedule" style={{ width: 32, height: 32, borderRadius: 999, background: "#EFE9DC", color: "#9C8F76", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #E0D7C4" }}>↺</button>
      </div>
    </div>
  );
}

function TomorrowDrawer({ tasks, onClose, onDelete, onAdd }) {
  const tomorrowLabel = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  })();

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50, background: "rgba(43,43,43,0.4)" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 420, borderRadius: "16px 16px 0 0", padding: 20, display: "flex", flexDirection: "column", gap: 16, background: "#FAF7F2", maxHeight: "75vh" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 18, color: "#2B2B2B" }}>Tomorrow's queue</div>
            <div style={{ fontSize: 12, color: "#9C8F76", fontFamily: "ui-monospace, monospace", marginTop: 2 }}>{tomorrowLabel}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", color: "#9C8F76", fontSize: 18 }}>✕</button>
        </div>

        {tasks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#9C8F76", fontSize: 15 }}>
            Nothing queued yet.<br />
            <span style={{ fontSize: 13 }}>Add a task and toggle it to "tomorrow."</span>
          </div>
        ) : (
          <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {tasks.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #F0EAE0" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, color: "#2B2B2B" }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: "#ADA28A", fontFamily: "ui-monospace, monospace", marginTop: 2 }}>
                    {t.kind === "fixed" ? minutesToLabel(t.time) : "triggered"}
                    {t.recurring ? " · daily" : " · one-off"}
                  </div>
                </div>
                <button onClick={() => onDelete(t.id)} style={{ background: "none", opacity: 0.4, fontSize: 14, padding: 4 }}>🗑</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={onAdd} style={{ width: "100%", padding: "12px 0", borderRadius: 12, background: "#2B2B2B", color: "#FAF7F2", fontSize: 15 }}>
          + Add to tomorrow
        </button>
      </div>
    </div>
  );
}

function ResetConfirmModal({ onConfirm, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, background: "rgba(43,43,43,0.5)", padding: 24 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 360, borderRadius: 20, padding: 28, background: "#FAF7F2", display: "flex", flexDirection: "column", gap: 16, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 22, color: "#2B2B2B" }}>Reset schedule?</div>
        <div style={{ fontSize: 15, color: "#9C8F76", lineHeight: 1.5 }}>This will remove any tasks you've added and restore the default daily schedule. Completed tasks will also reset.</div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: "#EFE9DC", color: "#5C5440", fontSize: 15 }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: "#B85C4A", color: "#FAF7F2", fontSize: 15 }}>Reset</button>
        </div>
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
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 24px 0 24px", gap: 32 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: 380, width: "100%" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.14em", color: isFuture ? "#9C8F76" : "#7A8B69", fontFamily: "ui-monospace, monospace" }}>
          {isFuture ? `SCHEDULED · ${minutesToLabel(nextThing.time)}` : isFixed ? "DUE NOW" : "UNLOCKED"}
        </div>
        <div style={{ textAlign: "center", fontSize: 36, lineHeight: 1.25, color: "#2B2B2B", fontWeight: 500 }}>{nextThing.title}</div>
        {nextThing.kind === "triggered" && <div style={{ fontSize: 14, color: "#9C8F76" }}>unlocked by completing the task before it</div>}
      </div>
      <button onClick={() => onComplete(nextThing.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 999, background: "#2B2B2B", color: "#FAF7F2", fontSize: 16 }}>✓ Done</button>
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
            <div key={task.id} style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 28, height: 28, marginTop: 2, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: task.done ? "#7A8B69" : isNext ? "#2B2B2B" : "#FAF7F2", border: task.done || isNext ? "none" : `1.5px solid ${unlocked ? "#C9BFA6" : "#DCD5C6"}`, fontSize: 12 }}>
                  {task.done ? <span style={{ color: "#FAF7F2" }}>✓</span> : !unlocked ? <span style={{ color: "#B8AF99", fontSize: 11 }}>🔒</span> : task.kind === "fixed" ? <span style={{ color: isNext ? "#FAF7F2" : "#9C8F76", fontSize: 11 }}>⏰</span> : <span style={{ color: isNext ? "#FAF7F2" : "#9C8F76", fontSize: 11 }}>↳</span>}
                </div>
                {i < order.length - 1 && <div style={{ width: 1.5, flex: 1, background: "#E8E1D4", minHeight: 22 }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: 24, paddingTop: 2 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <button onClick={() => unlocked && toggleDone(task.id)} disabled={!unlocked} style={{ textAlign: "left", flex: 1, background: "none", cursor: unlocked ? "pointer" : "default" }}>
                    <div style={{ fontSize: 17, color: task.done ? "#B8AF99" : unlocked ? "#2B2B2B" : "#A39C88", textDecoration: task.done ? "line-through" : "none", fontWeight: isNext ? 600 : 400 }}>{task.title}</div>
                    <div style={{ fontSize: 12, color: "#ADA28A", fontFamily: "ui-monospace, monospace", marginTop: 2 }}>{task.kind === "fixed" ? minutesToLabel(task.time) : "after previous step"}</div>
                  </button>
                  <button onClick={() => deleteTask(task.id)} style={{ padding: 4, opacity: 0.4, background: "none", fontSize: 14 }}>🗑</button>
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
    <div style={{ position: "sticky", bottom: 0, padding: "12px 20px", display: "flex", justifyContent: "center", gap: 8, borderTop: "1px solid #E8E1D4", background: "#FAF7F2", zIndex: 10 }}>
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
  const [scheduledFor, setScheduledFor] = useState("today");

  const submit = () => {
    if (!title.trim()) return;
    const id = "t" + Date.now();
    const base = { id, title: title.trim(), done: false, recurring: false, scheduledFor };
    if (kind === "fixed") {
      onAdd({ ...base, kind, time: hour * 60 + minute, triggerId: null });
    } else {
      onAdd({ ...base, kind, time: null, triggerId: triggerId || null });
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50, background: "rgba(43,43,43,0.4)" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 420, borderRadius: "16px 16px 0 0", padding: 20, display: "flex", flexDirection: "column", gap: 14, background: "#FAF7F2" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 18, color: "#2B2B2B" }}>New task</div>
          <button onClick={onClose} style={{ background: "none", color: "#9C8F76", fontSize: 18 }}>✕</button>
        </div>

        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?"
          style={{ width: "100%", padding: "12px 16px", borderRadius: 12, background: "#EFE9DC", fontSize: 16, color: "#2B2B2B" }} />

        {/* Today / Tomorrow toggle */}
        <div style={{ display: "flex", alignItems: "center", borderRadius: 999, padding: 2, background: "#EFE9DC", border: "1px solid #E0D7C4", alignSelf: "center" }}>
          <button onClick={() => setScheduledFor("today")} style={{ padding: "6px 18px", borderRadius: 999, background: scheduledFor === "today" ? "#2B2B2B" : "transparent", color: scheduledFor === "today" ? "#FAF7F2" : "#8A8270", fontSize: 13, fontFamily: "ui-monospace, monospace" }}>today</button>
          <button onClick={() => setScheduledFor("tomorrow")} style={{ padding: "6px 18px", borderRadius: 999, background: scheduledFor === "tomorrow" ? "#7A8B69" : "transparent", color: scheduledFor === "tomorrow" ? "#FAF7F2" : "#8A8270", fontSize: 13, fontFamily: "ui-monospace, monospace" }}>tomorrow</button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setKind("fixed")} style={{ flex: 1, padding: "10px 0", borderRadius: 12, background: kind === "fixed" ? "#2B2B2B" : "#EFE9DC", color: kind === "fixed" ? "#FAF7F2" : "#5C5440", fontSize: 13, fontFamily: "ui-monospace, monospace" }}>fixed time</button>
          <button onClick={() => setKind("triggered")} disabled={tasks.length === 0} style={{ flex: 1, padding: "10px 0", borderRadius: 12, background: kind === "triggered" ? "#2B2B2B" : "#EFE9DC", color: kind === "triggered" ? "#FAF7F2" : "#5C5440", fontSize: 13, fontFamily: "ui-monospace, monospace", opacity: tasks.length === 0 ? 0.5 : 1 }}>after another task</button>
        </div>

        {kind === "fixed" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <select value={hour} onChange={(e) => setHour(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: 8, background: "#EFE9DC", fontSize: 16 }}>
              {Array.from({ length: 24 }, (_, h) => (<option key={h} value={h}>{h === 0 ? 12 : h > 12 ? h - 12 : h} {h >= 12 ? "PM" : "AM"}</option>))}
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

        <button onClick={submit} style={{ width: "100%", padding: "12px 0", borderRadius: 12, marginTop: 2, background: scheduledFor === "tomorrow" ? "#7A8B69" : "#2B2B2B", color: "#FAF7F2", fontSize: 16 }}>
          Add for {scheduledFor}
        </button>
      </div>
    </div>
  );
}

function BulkAddModal({ tasks, onClose, onAdd }) {
  const [text, setText] = useState("");
  const [scheduledFor, setScheduledFor] = useState("today");
  const preview = text.trim() ? parseBulkRows(text, tasks, scheduledFor) : [];

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50, background: "rgba(43,43,43,0.4)" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 420, borderRadius: "16px 16px 0 0", padding: 20, display: "flex", flexDirection: "column", gap: 12, background: "#FAF7F2", maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 18, color: "#2B2B2B" }}>Paste a list</div>
          <button onClick={onClose} style={{ background: "none", color: "#9C8F76", fontSize: 18 }}>✕</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", borderRadius: 999, padding: 2, background: "#EFE9DC", border: "1px solid #E0D7C4", alignSelf: "center" }}>
          <button onClick={() => setScheduledFor("today")} style={{ padding: "6px 18px", borderRadius: 999, background: scheduledFor === "today" ? "#2B2B2B" : "transparent", color: scheduledFor === "today" ? "#FAF7F2" : "#8A8270", fontSize: 13, fontFamily: "ui-monospace, monospace" }}>today</button>
          <button onClick={() => setScheduledFor("tomorrow")} style={{ padding: "6px 18px", borderRadius: 999, background: scheduledFor === "tomorrow" ? "#7A8B69" : "transparent", color: scheduledFor === "tomorrow" ? "#FAF7F2" : "#8A8270", fontSize: 13, fontFamily: "ui-monospace, monospace" }}>tomorrow</button>
        </div>

        <div style={{ fontSize: 12.5, color: "#9C8F76", lineHeight: 1.5 }}>
          One task per line:<br />
          <span style={{ fontFamily: "ui-monospace, monospace" }}>Call doctor, 10:00 AM</span><br />
          <span style={{ fontFamily: "ui-monospace, monospace" }}>File paperwork, after: Call doctor</span>
        </div>

        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"Call doctor, 10:00 AM\nFile paperwork, after: Call doctor"} rows={5}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 12, background: "#EFE9DC", fontSize: 14, color: "#2B2B2B", fontFamily: "ui-monospace, monospace", resize: "vertical" }} />

        {preview.length > 0 && (
          <div style={{ overflowY: "auto", maxHeight: 140 }}>
            <div style={{ fontSize: 11, color: "#9C8F76", fontFamily: "ui-monospace, monospace", marginBottom: 4 }}>{preview.length} task{preview.length !== 1 ? "s" : ""} → {scheduledFor}</div>
            {preview.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13.5, color: "#2B2B2B" }}>
                <span style={{ fontSize: 11, color: "#9C8F76" }}>↻</span>
                <span style={{ flex: 1 }}>{t.title}</span>
                <span style={{ fontSize: 11, color: "#9C8F76", fontFamily: "ui-monospace, monospace" }}>{t.kind === "fixed" ? minutesToLabel(t.time) : t.triggerId ? "triggered" : "⚠ no trigger"}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => preview.length && onAdd(preview)} disabled={preview.length === 0}
          style={{ width: "100%", padding: "12px 0", borderRadius: 12, background: preview.length ? (scheduledFor === "tomorrow" ? "#7A8B69" : "#2B2B2B") : "#DCD5C6", color: "#FAF7F2", fontSize: 16 }}>
          Add {preview.length || ""} task{preview.length === 1 ? "" : "s"} for {scheduledFor}
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<NextThing />);
