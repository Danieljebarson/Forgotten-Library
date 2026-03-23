import { useState, useEffect, useRef } from "react";

const ICONS = {
  lantern: "🕯", key: "🗝", book: "📖", map: "🗺", potion: "⚗",
  mirror: "🪞", coin: "🪙", amulet: "🧿", quill: "✒", rope: "🪢",
};
const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

const SYS = `You are narrator of a dark literary text adventure set in The Forgotten Library — a vast eerie library abandoned 300 years ago said to contain the Codex Veritatis, a book that answers any question.

WORLD: entrance hall, east wing, west wing, clock tower, scriptorium, basement, librarian's office.

THREE ENDINGS:
1. GOOD: Player escapes with the Codex (needs: silver_key AND mirror to unlock the vault)
2. BAD: Consumed by the curse (3+ reckless actions or ignoring warnings)
3. SECRET: Learns the library IS the Codex — a living entity (must read all 3 inscriptions: entrance arch, east wing mirror frame, clock tower base)

ITEMS (found once each): lantern (player starts with it), silver_key (clock tower), mirror (east wing), ancient_map (entrance hall), coin (librarian's desk), rope (west wing storage), potion (basement), quill (scriptorium).

PACING: 6-12 turns before an ending. Track risk internally. At risk 3+, the library fights back.

Respond ONLY with valid JSON, no markdown:
{
  "scene_title": "2-5 evocative words",
  "narrative": "2-4 paragraphs, vivid Gothic prose, second-person. Under 200 words.",
  "items_gained": [],
  "items_lost": [],
  "choices": [
    {"text": "Verb-led action", "type": "explore|interact|cautious|reckless"},
    {"text": "...", "type": "..."},
    {"text": "...", "type": "..."}
  ],
  "chapter": 1,
  "is_ending": false,
  "ending_type": null,
  "ending_label": null
}
When is_ending is true: set ending_type (good/bad/secret), ending_label (short poetic title), choices=[].`;

async function callClaude(messages) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYS,
      messages,
    }),
  });
  if (!res.ok) throw new Error("API error " + res.status);
  const data = await res.json();
  const text = data.content.map(b => b.text || "").join("").replace(/```json|```/g,"").trim();
  return JSON.parse(text);
}

export default function App() {
  const [inventory, setInventory] = useState(["lantern"]);
  const [sceneTitle, setSceneTitle] = useState("Prologue");
  const [narrative, setNarrative] = useState(
    "Rain hammers the cobblestones as you push open the iron gate. The library looms before you — dark, massive, abandoned for three centuries. Your lantern flickers.\n\nSomewhere within lies the Codex Veritatis: a book that answers any question. The front doors stand unlocked. Odd."
  );
  const [choices, setChoices] = useState([]);
  const [log, setLog] = useState([]);
  const [turn, setTurn] = useState(0);
  const [chapter, setChapter] = useState(1);
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(null);
  const [error, setError] = useState(null);
  const convoRef = useRef([]);
  const logRef = useRef(null);

  const addLog = (txt) => setLog(l => [txt, ...l].slice(0, 30));

  const updateState = (res, newTurn) => {
    setSceneTitle(res.scene_title || "");
    setNarrative(res.narrative || "");
    if (res.chapter) setChapter(res.chapter);
    setTurn(newTurn);
    setInventory(prev => {
      let inv = [...prev];
      (res.items_gained || []).forEach(item => { if (!inv.includes(item)) { inv.push(item); addLog("Found: " + item.replace(/_/g," ")); }});
      (res.items_lost || []).forEach(item => { inv = inv.filter(i => i !== item); });
      return inv;
    });
    if (res.is_ending) {
      setEnding({ type: res.ending_type, label: res.ending_label });
      setChoices([]);
    } else {
      setChoices(res.choices || []);
      setEnding(null);
    }
  };

  const startGame = async () => {
    convoRef.current = [];
    setInventory(["lantern"]);
    setTurn(0); setChapter(1); setEnding(null); setError(null);
    setLog([]); setChoices([]);
    setSceneTitle("Prologue");
    setNarrative("The lantern flickers as a new chapter begins...");
    setLoading(true);
    const msg = "Turn 0. Begin. Player at library entrance, stormy night. Inventory: [lantern]. Set opening scene, provide 3 choices.";
    convoRef.current.push({ role: "user", content: msg });
    try {
      const res = await callClaude(convoRef.current);
      convoRef.current.push({ role: "assistant", content: JSON.stringify(res) });
      updateState(res, 0);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const makeChoice = async (choice) => {
    if (loading || ending) return;
    setLoading(true); setError(null);
    const newTurn = turn + 1;
    const msg = `Turn ${newTurn}. Inventory: [${inventory.join(", ") || "empty"}]. Player chose: "${choice.text}" (type: ${choice.type})`;
    convoRef.current.push({ role: "user", content: msg });
    addLog(`T${newTurn}: ${choice.text.slice(0,50)}${choice.text.length>50?"...":""}`);
    try {
      const res = await callClaude(convoRef.current);
      convoRef.current.push({ role: "assistant", content: JSON.stringify(res) });
      updateState(res, newTurn);
    } catch(e) {
      setError(e.message);
      convoRef.current.pop();
    }
    setLoading(false);
  };

  useEffect(() => { startGame(); }, []);

  const endingColors = {
    good: { bg: "#d4edda", color: "#1a4a1a", border: "#a8d5b5", icon: "✦" },
    bad:  { bg: "#f8d7da", color: "#8b1a1a", border: "#f0b0b5", icon: "✗" },
    secret: { bg: "#fff3cd", color: "#856404", border: "#ffc107", icon: "✧" },
  };

  return (
    <div style={{ background: "#2a1a08", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "Georgia, serif" }}>
      <div style={{ width: "100%", maxWidth: "780px", background: "#f5ead0", borderRadius: "4px", boxShadow: "0 0 0 3px #5c3d1e, 0 0 0 6px #3a2010, 0 20px 60px rgba(0,0,0,.6)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: "#3a2010", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid #5c3d1e" }}>
          <div>
            <div style={{ color: "#d4a843", fontSize: "19px", fontWeight: "700", letterSpacing: "1px" }}>The Forgotten Library</div>
            <div style={{ color: "#a07840", fontSize: "11px", fontStyle: "italic", letterSpacing: "2px", textTransform: "uppercase", marginTop: "2px" }}>An Adventure of Mysteries & Choices</div>
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            {[["Chapter", ROMAN[chapter-1]||chapter], ["Turn", turn]].map(([lbl, val]) => (
              <div key={lbl} style={{ color: "#c8a060", fontSize: "13px", display: "flex", gap: "6px" }}>
                <span>{lbl}</span><span style={{ color: "#d4a843", fontWeight: "700" }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 195px", minHeight: "500px" }}>

          {/* Story panel */}
          <div style={{ padding: "24px 24px 20px", borderRight: "2px solid #e8d5a3", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ fontStyle: "italic", fontSize: "13px", color: "#7a3b1e", letterSpacing: "2px", textTransform: "uppercase", paddingBottom: "10px", borderBottom: "1px solid #e8d5a3", opacity: ".8" }}>
              {sceneTitle}
            </div>
            <div style={{ fontSize: "17px", lineHeight: "1.78", color: "#1a1209", flex: 1, whiteSpace: "pre-line", minHeight: "130px" }}>
              {narrative}
              {loading && <span style={{ display: "inline-block", width: "7px", height: "15px", background: "#7a3b1e", marginLeft: "4px", verticalAlign: "middle", animation: "none", opacity: ".7" }}>|</span>}
            </div>

            {error && (
              <div style={{ fontSize: "13px", color: "#8b1a1a", fontStyle: "italic", padding: "8px", background: "#fff0f0", borderRadius: "3px", border: "1px solid #f8d7da" }}>
                ⚠ {error} — please try again.
              </div>
            )}

            {ending && (() => {
              const ec = endingColors[ending.type] || endingColors.bad;
              return (
                <div style={{ display: "inline-block", padding: "5px 14px", borderRadius: "20px", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase", background: ec.bg, color: ec.color, border: `1px solid ${ec.border}`, alignSelf: "flex-start" }}>
                  {ec.icon} {ending.label || ending.type + " ending"}
                </div>
              );
            })()}

            {!ending && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" }}>
                <div style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: "#7a3b1e", opacity: ".55" }}>What do you do?</div>
                {choices.map((c, i) => (
                  <button key={i} onClick={() => makeChoice(c)} disabled={loading}
                    style={{ background: "transparent", border: "1.5px solid #e8d5a3", borderRadius: "3px", padding: "10px 14px", textAlign: "left", cursor: loading ? "not-allowed" : "pointer", fontFamily: "Georgia, serif", fontSize: "15px", color: loading ? "#aaa" : "#1a1209", lineHeight: "1.4", transition: "all .15s", width: "100%" }}
                    onMouseEnter={e => { if (!loading) { e.target.style.background="#e8d5a3"; e.target.style.borderColor="#c4652a"; e.target.style.color="#7a3b1e"; }}}
                    onMouseLeave={e => { e.target.style.background="transparent"; e.target.style.borderColor="#e8d5a3"; e.target.style.color=loading?"#aaa":"#1a1209"; }}
                  >
                    <span style={{ color: "#c4652a", marginRight: "8px", fontSize: "10px" }}>◈</span>{c.text}
                  </button>
                ))}
                {loading && choices.length === 0 && (
                  <div style={{ color: "#7a3b1e", fontStyle: "italic", fontSize: "14px", opacity: ".6" }}>The pages turn...</div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ background: "#f0e2bf", padding: "18px 14px", display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <div style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: "#7a3b1e", marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid #e8d5a3" }}>Inventory</div>
              {inventory.length === 0
                ? <div style={{ fontSize: "12px", color: "#7a3b1e", opacity: ".4", fontStyle: "italic", textAlign: "center", padding: "12px 0" }}>Empty satchel</div>
                : inventory.map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 8px", background: "#f5ead0", borderRadius: "3px", border: "1px solid #e8d5a3", fontSize: "13px", color: "#1a1209", marginBottom: "5px" }}>
                    <span>{ICONS[item] || "◈"}</span>
                    <span>{item.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}</span>
                  </div>
                ))
              }
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: "#7a3b1e", marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid #e8d5a3" }}>Chronicle</div>
              <div ref={logRef} style={{ overflowY: "auto", flex: 1, maxHeight: "180px", display: "flex", flexDirection: "column", gap: "3px" }}>
                {log.map((entry, i) => (
                  <div key={i} style={{ fontSize: "11px", color: "#7a3b1e", opacity: ".65", fontStyle: "italic", lineHeight: "1.4", paddingBottom: "3px", borderBottom: "1px dotted rgba(122,59,30,.15)" }}>{entry}</div>
                ))}
                {log.length === 0 && <div style={{ fontSize: "11px", color: "#7a3b1e", opacity: ".3", fontStyle: "italic" }}>No entries yet...</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 24px", background: "#f0e0b0", borderTop: "2px solid #e8d5a3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontStyle: "italic", fontSize: "12px", color: "#7a3b1e", opacity: ".6" }}>
            {ending ? "The End — Begin Anew?" : `Turn ${turn} · Chapter ${ROMAN[chapter-1]||chapter}`}
          </div>
          <button onClick={startGame} disabled={loading}
            style={{ background: "transparent", border: "1px solid #e8d5a3", color: "#7a3b1e", fontFamily: "Georgia, serif", fontSize: "13px", padding: "5px 14px", borderRadius: "3px", cursor: "pointer" }}>
            ✦ Begin Anew
          </button>
        </div>
      </div>
    </div>
  );
}
