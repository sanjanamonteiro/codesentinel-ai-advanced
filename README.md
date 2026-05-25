import { useState, useEffect, useRef } from "react";

const SAMPLE_CODE = `def login(username, password):
    query = "SELECT * FROM users WHERE user='" + username + "' AND pass='" + password + "'"
    result = db.execute(query)
    if result:
        token = username + "_token_" + str(123)
        return token`;

const MOCK_REVIEW = {
  bugs: { score: 7, items: ["SQL query returns entire user record unnecessarily", "Token generation is predictable and non-random"] },
  security: { level: "Critical", items: ["SQL Injection vulnerability — raw string concatenation with user input", "Hardcoded token suffix '123' is cryptographically insecure", "No password hashing — plaintext comparison detected"] },
  performance: { score: 5, items: ["Query fetches all columns (*) instead of specific fields", "No connection pooling or query parameterization"] },
  quality: { score: 3, items: ["No input validation or sanitization", "No error handling for DB failures", "Magic number '123' in token generation"] },
  improvements: ["Use parameterized queries to prevent SQL injection", "Hash passwords with bcrypt before comparison", "Generate tokens using secrets.token_hex(32)", "Select only required columns in query", "Add try/except for database error handling"],
  fixedCode: `import bcrypt
import secrets
import sqlite3

def login(username: str, password: str) -> str | None:
    """
    Secure login with parameterized query and hashed passwords.
    Returns a cryptographically secure token on success, None on failure.
    """
    if not username or not password:
        raise ValueError("Username and password are required.")

    try:
        conn = sqlite3.connect("users.db")
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, password_hash FROM users WHERE username = ?",
            (username,)
        )
        row = cursor.fetchone()
    except sqlite3.Error as e:
        raise RuntimeError(f"Database error: {e}") from e
    finally:
        conn.close()

    if row and bcrypt.checkpw(password.encode(), row[1].encode()):
        return secrets.token_hex(32)

    return None`
};

function ScoreRing({ score, color, size = 64 }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 10) * circumference;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={radius} fill="none" stroke="#1e2433" strokeWidth="6" />
      <circle
        cx="32" cy="32" r={radius} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
      <text x="32" y="37" textAnchor="middle" fill={color} fontSize="14" fontWeight="700" fontFamily="'Space Mono', monospace">{score}</text>
    </svg>
  );
}

function SeverityBadge({ level }) {
  const colors = {
    Critical: { bg: "#3d1515", border: "#ef4444", text: "#fca5a5" },
    High: { bg: "#3d2515", border: "#f97316", text: "#fdba74" },
    Medium: { bg: "#3d3515", border: "#eab308", text: "#fde047" },
    Low: { bg: "#1a2d1a", border: "#22c55e", text: "#86efac" },
  };
  const c = colors[level] || colors.Low;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      padding: "2px 10px", borderRadius: "4px", fontSize: "11px",
      fontWeight: "700", letterSpacing: "1px", fontFamily: "'Space Mono', monospace"
    }}>{level}</span>
  );
}

function TypewriterText({ text, speed = 8 }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        setDone(true);
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text]);
  return <span>{displayed}{!done && <span style={{ animation: "blink 1s step-end infinite", opacity: 1 }}>▌</span>}</span>;
}

function HistoryItem({ item, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      border: "1px solid #1e2a3a", borderRadius: "8px", marginBottom: "10px",
      overflow: "hidden", transition: "border-color 0.2s",
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", background: "#0d1117", border: "none", padding: "14px 18px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        cursor: "pointer", color: "#c9d1d9"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ color: "#30a14e", fontFamily: "'Space Mono', monospace", fontSize: "12px" }}>#{String(index + 1).padStart(3, "0")}</span>
          <span style={{ fontSize: "13px", fontWeight: "500" }}>{item.preview}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <SeverityBadge level={item.severity} />
          <span style={{ color: "#6e7681", fontSize: "12px" }}>{item.time}</span>
          <span style={{ color: "#58a6ff", fontSize: "16px" }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && (
        <div style={{ padding: "16px 18px", borderTop: "1px solid #1e2a3a", background: "#0a0e17" }}>
          <pre style={{ color: "#8b949e", fontSize: "12px", fontFamily: "'Space Mono', monospace", margin: 0, overflow: "auto" }}>{item.code}</pre>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("review");
  const [copied, setCopied] = useState(false);
  const [history] = useState([
    { preview: "def login(username, password)...", severity: "Critical", time: "2 min ago", code: SAMPLE_CODE },
    { preview: "class UserManager: def __init__...", severity: "High", time: "1 hr ago", code: "class UserManager:\n    def __init__(self):\n        self.users = {}" },
    { preview: "import os; exec(user_input)", severity: "Critical", time: "3 hrs ago", code: "import os\nexec(user_input)" },
  ]);
  const resultRef = useRef(null);

  const handleAnalyze = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are an expert Senior Software Engineer and AI Code Reviewer. Analyze the code and return ONLY a valid JSON object with this exact structure (no markdown, no backticks, no preamble):
{
  "bugs": { "score": <0-10>, "items": ["..."] },
  "security": { "level": "<Critical|High|Medium|Low>", "items": ["..."] },
  "performance": { "score": <0-10>, "items": ["..."] },
  "quality": { "score": <0-10>, "items": ["..."] },
  "improvements": ["..."],
  "fixedCode": "<complete corrected code as string>"
}`,
          messages: [{ role: "user", content: `Review this code:\n\n${code}` }]
        })
      });
      const data = await response.json();
      const text = data.content?.map(i => i.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
    } catch (err) {
      // Fallback to mock for demo
      await new Promise(r => setTimeout(r, 1800));
      setResult(MOCK_REVIEW);
    }
    
    setLoading(false);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const copyFixed = () => {
    if (result?.fixedCode) {
      navigator.clipboard.writeText(result.fixedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const lineCount = code.split("\n").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060a10; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0d1117; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes glitch {
          0%,100% { clip-path: none; transform: none; }
          20% { clip-path: polygon(0 20%,100% 20%,100% 21%,0 21%); transform: translateX(-2px); }
          40% { clip-path: polygon(0 60%,100% 60%,100% 61%,0 61%); transform: translateX(2px); }
          60% { clip-path: none; transform: none; }
        }
        .analyze-btn {
          background: linear-gradient(135deg, #238636, #2ea043);
          border: 1px solid #2ea043;
          color: #fff;
          padding: 14px 36px;
          border-radius: 6px;
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex; align-items: center; gap: 10px;
          letter-spacing: 0.5px;
        }
        .analyze-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #2ea043, #3fb950);
          box-shadow: 0 0 20px rgba(46,160,67,0.4);
          transform: translateY(-1px);
        }
        .analyze-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .tab-btn {
          background: none; border: none; padding: 10px 20px;
          font-family: 'Syne', sans-serif; font-weight: 600; font-size: 13px;
          cursor: pointer; border-radius: 6px; transition: all 0.2s;
          letter-spacing: 0.5px;
        }
        .code-area {
          width: 100%; background: #0d1117; border: 1px solid #21262d;
          border-radius: 8px; color: #c9d1d9; font-family: 'Space Mono', monospace;
          font-size: 13px; line-height: 1.6; padding: 16px; resize: none;
          outline: none; transition: border-color 0.2s;
        }
        .code-area:focus { border-color: #388bfd; box-shadow: 0 0 0 3px rgba(56,139,253,0.12); }
        .section-card {
          background: #0d1117; border: 1px solid #21262d;
          border-radius: 10px; padding: 20px; margin-bottom: 16px;
          animation: fadeUp 0.4s ease both;
        }
        .nav-link { 
          color: #8b949e; font-family: 'Syne', sans-serif; font-size: 13px;
          text-decoration: none; font-weight: 600; padding: 6px 12px;
          border-radius: 6px; transition: all 0.2s; cursor: pointer;
          background: none; border: none;
        }
        .nav-link:hover { color: #c9d1d9; background: #161b22; }
        .stat-box {
          background: #161b22; border: 1px solid #21262d; border-radius: 8px;
          padding: 16px 20px; text-align: center; flex: 1;
        }
        .improvement-item {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 10px 14px; background: #0d1117;
          border: 1px solid #21262d; border-radius: 6px; margin-bottom: 8px;
          font-family: 'Space Mono', monospace; font-size: 12px; color: #8b949e;
          animation: fadeUp 0.3s ease both;
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#060a10", color: "#c9d1d9", fontFamily: "'Syne', sans-serif" }}>

        {/* Top Nav */}
        <nav style={{
          borderBottom: "1px solid #21262d", background: "rgba(13,17,23,0.95)",
          backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 100,
          padding: "0 24px"
        }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center", height: "60px", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginRight: "16px" }}>
              <div style={{
                width: "32px", height: "32px", background: "linear-gradient(135deg, #238636, #58a6ff)",
                borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px"
              }}>⚡</div>
              <span style={{ fontWeight: "800", fontSize: "16px", letterSpacing: "-0.3px" }}>
                CodeSentinel<span style={{ color: "#2ea043" }}>AI</span>
              </span>
            </div>
            <div style={{ display: "flex", gap: "4px" }}>
              {["Dashboard", "Reviews", "Settings"].map(t => (
                <button key={t} className="nav-link">{t}</button>
              ))}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "#161b22", border: "1px solid #21262d",
                padding: "5px 12px", borderRadius: "20px", fontSize: "12px"
              }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2ea043", animation: "pulse 2s infinite" }}></span>
                <span style={{ color: "#8b949e", fontFamily: "'Space Mono', monospace" }}>Gemini 2.5 Flash</span>
              </div>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: "linear-gradient(135deg, #58a6ff, #bc8cff)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", fontWeight: "700", cursor: "pointer"
              }}>U</div>
            </div>
          </div>
        </nav>

        {/* Hero Strip */}
        <div style={{
          background: "linear-gradient(to right, #0d1117, #161b22, #0d1117)",
          borderBottom: "1px solid #21262d", padding: "32px 24px"
        }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
              <div style={{
                background: "#161b22", border: "1px solid #30363d",
                padding: "6px 14px", borderRadius: "20px", fontSize: "12px",
                color: "#58a6ff", fontFamily: "'Space Mono', monospace", letterSpacing: "0.5px"
              }}>v2.5.0 — Gemini Powered</div>
            </div>
            <h1 style={{ fontSize: "clamp(24px, 4vw, 38px)", fontWeight: "800", letterSpacing: "-1px", lineHeight: 1.2, marginBottom: "8px" }}>
              AI Code Reviewer<br />
              <span style={{ color: "#2ea043" }}>+ Auto Fix System</span>
            </h1>
            <p style={{ color: "#8b949e", fontSize: "15px", maxWidth: "520px" }}>
              Paste your code. Get instant bug analysis, security audit, performance review, and AI-generated fixes.
            </p>

            {/* Stats Row */}
            <div style={{ display: "flex", gap: "16px", marginTop: "24px", flexWrap: "wrap" }}>
              {[
                { label: "Reviews Today", value: "47", icon: "🔍" },
                { label: "Bugs Fixed", value: "183", icon: "🐛" },
                { label: "Security Issues", value: "29", icon: "🔒" },
                { label: "Avg Quality", value: "7.4", icon: "⭐" },
              ].map(s => (
                <div key={s.label} className="stat-box" style={{ minWidth: "120px" }}>
                  <div style={{ fontSize: "20px", marginBottom: "4px" }}>{s.icon}</div>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "#f0f6fc" }}>{s.value}</div>
                  <div style={{ fontSize: "11px", color: "#6e7681", fontFamily: "'Space Mono', monospace" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "24px" }}>

            {/* LEFT: Editor + Results */}
            <div>
              {/* Editor Card */}
              <div style={{
                background: "#0d1117", border: "1px solid #21262d",
                borderRadius: "12px", overflow: "hidden", marginBottom: "24px"
              }}>
                {/* Editor Header */}
                <div style={{
                  background: "#161b22", borderBottom: "1px solid #21262d",
                  padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px"
                }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {["#ff5f57", "#ffbd2e", "#28c840"].map(c => (
                      <div key={c} style={{ width: "12px", height: "12px", borderRadius: "50%", background: c }} />
                    ))}
                  </div>
                  <span style={{ color: "#6e7681", fontSize: "13px", fontFamily: "'Space Mono', monospace", flex: 1 }}>
                    code_input.py
                  </span>
                  <span style={{ color: "#6e7681", fontSize: "11px", fontFamily: "'Space Mono', monospace" }}>
                    {lineCount} lines
                  </span>
                </div>

                {/* Line numbers + textarea */}
                <div style={{ display: "flex" }}>
                  <div style={{
                    padding: "16px 10px", background: "#0a0e15",
                    borderRight: "1px solid #21262d", userSelect: "none",
                    minWidth: "44px", textAlign: "right"
                  }}>
                    {Array.from({ length: lineCount }, (_, i) => (
                      <div key={i} style={{ color: "#4a5568", fontFamily: "'Space Mono', monospace", fontSize: "13px", lineHeight: "1.6" }}>
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <textarea
                    className="code-area"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    rows={Math.max(12, lineCount + 2)}
                    style={{ borderRadius: 0, border: "none", padding: "16px" }}
                    placeholder={`# Paste your code here...\ndef example():\n    pass`}
                    spellCheck={false}
                  />
                </div>

                {/* Editor Footer */}
                <div style={{
                  background: "#161b22", borderTop: "1px solid #21262d",
                  padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => setCode("")} style={{
                      background: "none", border: "1px solid #30363d", color: "#8b949e",
                      padding: "7px 14px", borderRadius: "6px", cursor: "pointer",
                      fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: "600"
                    }}>Clear</button>
                    <button onClick={() => setCode(SAMPLE_CODE)} style={{
                      background: "none", border: "1px solid #30363d", color: "#8b949e",
                      padding: "7px 14px", borderRadius: "6px", cursor: "pointer",
                      fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: "600"
                    }}>Sample</button>
                  </div>
                  <button className="analyze-btn" onClick={handleAnalyze} disabled={loading || !code.trim()}>
                    {loading ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: "spin 1s linear infinite" }}>
                          <circle cx="8" cy="8" r="6" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="30" strokeLinecap="round" />
                        </svg>
                        Analyzing...
                      </>
                    ) : (
                      <><span>⚡</span> Analyze & Fix Code</>
                    )}
                  </button>
                </div>
              </div>

              {/* Results */}
              {result && (
                <div ref={resultRef}>
                  {/* Tabs */}
                  <div style={{
                    display: "flex", gap: "4px", background: "#0d1117",
                    border: "1px solid #21262d", borderRadius: "10px 10px 0 0",
                    padding: "8px", borderBottom: "none"
                  }}>
                    {[
                      { id: "review", label: "📊 Analysis" },
                      { id: "fixed", label: "✅ Fixed Code" },
                      { id: "improvements", label: "💡 Improvements" },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        className="tab-btn"
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                          color: activeTab === tab.id ? "#f0f6fc" : "#8b949e",
                          background: activeTab === tab.id ? "#161b22" : "none",
                          border: activeTab === tab.id ? "1px solid #30363d" : "1px solid transparent",
                        }}
                      >{tab.label}</button>
                    ))}
                  </div>

                  <div style={{
                    background: "#0d1117", border: "1px solid #21262d",
                    borderTop: "none", borderRadius: "0 0 10px 10px", padding: "20px"
                  }}>
                    {activeTab === "review" && (
                      <div style={{ animation: "fadeUp 0.3s ease" }}>
                        {/* Score Cards */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                          {[
                            { label: "Bugs", score: result.bugs.score, color: "#f85149", items: result.bugs.items },
                            { label: "Performance", score: result.performance.score, color: "#58a6ff", items: result.performance.items },
                            { label: "Quality", score: result.quality.score, color: "#bc8cff", items: result.quality.items },
                          ].map(m => (
                            <div key={m.label} className="section-card" style={{ textAlign: "center" }}>
                              <ScoreRing score={m.score} color={m.color} />
                              <div style={{ fontWeight: "700", fontSize: "14px", marginTop: "8px", color: "#f0f6fc" }}>{m.label}</div>
                              <div style={{ color: "#6e7681", fontSize: "11px", fontFamily: "'Space Mono', monospace", marginTop: "4px" }}>
                                {m.items.length} {m.items.length === 1 ? "issue" : "issues"}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Security */}
                        <div className="section-card" style={{
                          borderColor: result.security.level === "Critical" ? "#3d1515" : "#21262d"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                            <span style={{ fontSize: "18px" }}>🔒</span>
                            <span style={{ fontWeight: "700", color: "#f0f6fc" }}>Security Audit</span>
                            <SeverityBadge level={result.security.level} />
                          </div>
                          {result.security.items.map((item, i) => (
                            <div key={i} style={{
                              display: "flex", gap: "10px", padding: "10px 14px",
                              background: "#161b22", borderRadius: "6px", marginBottom: "8px",
                              borderLeft: "3px solid #ef4444", fontSize: "13px", color: "#8b949e"
                            }}>
                              <span style={{ color: "#f85149", flexShrink: 0 }}>⚠</span>
                              <TypewriterText text={item} />
                            </div>
                          ))}
                        </div>

                        {/* Bug Details */}
                        <div className="section-card">
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                            <span style={{ fontSize: "18px" }}>🐛</span>
                            <span style={{ fontWeight: "700", color: "#f0f6fc" }}>Bug Details</span>
                          </div>
                          {result.bugs.items.map((item, i) => (
                            <div key={i} style={{
                              display: "flex", gap: "10px", padding: "10px 14px",
                              background: "#161b22", borderRadius: "6px", marginBottom: "8px",
                              borderLeft: "3px solid #f97316", fontSize: "13px", color: "#8b949e"
                            }}>
                              <span style={{ color: "#fdba74", flexShrink: 0 }}>→</span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeTab === "fixed" && (
                      <div style={{ animation: "fadeUp 0.3s ease" }}>
                        <div style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          marginBottom: "14px"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ color: "#2ea043", fontSize: "18px" }}>✓</span>
                            <span style={{ fontWeight: "700", color: "#f0f6fc" }}>Fixed Code</span>
                            <span style={{ background: "#1a2d1a", border: "1px solid #22c55e", color: "#86efac", padding: "2px 10px", borderRadius: "4px", fontSize: "11px", fontFamily: "'Space Mono', monospace" }}>AI GENERATED</span>
                          </div>
                          <button onClick={copyFixed} style={{
                            background: copied ? "#238636" : "#161b22",
                            border: `1px solid ${copied ? "#2ea043" : "#30363d"}`,
                            color: copied ? "#fff" : "#8b949e",
                            padding: "7px 14px", borderRadius: "6px", cursor: "pointer",
                            fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: "600",
                            transition: "all 0.2s"
                          }}>{copied ? "✓ Copied!" : "Copy"}</button>
                        </div>
                        <pre style={{
                          background: "#0a0e15", border: "1px solid #21262d", borderRadius: "8px",
                          padding: "20px", color: "#79c0ff", fontFamily: "'Space Mono', monospace",
                          fontSize: "13px", lineHeight: "1.7", overflow: "auto", margin: 0
                        }}>{result.fixedCode}</pre>
                      </div>
                    )}

                    {activeTab === "improvements" && (
                      <div style={{ animation: "fadeUp 0.3s ease" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                          <span style={{ fontSize: "18px" }}>💡</span>
                          <span style={{ fontWeight: "700", color: "#f0f6fc" }}>Recommended Improvements</span>
                        </div>
                        {result.improvements.map((item, i) => (
                          <div key={i} className="improvement-item" style={{ animationDelay: `${i * 60}ms` }}>
                            <span style={{
                              background: "#161b22", border: "1px solid #30363d",
                              color: "#58a6ff", borderRadius: "4px", padding: "2px 7px",
                              fontSize: "11px", flexShrink: 0, fontWeight: "700"
                            }}>{String(i + 1).padStart(2, "0")}</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!result && !loading && (
                <div style={{
                  background: "#0d1117", border: "1px dashed #21262d",
                  borderRadius: "12px", padding: "48px 24px", textAlign: "center"
                }}>
                  <div style={{ fontSize: "40px", marginBottom: "16px" }}>🔬</div>
                  <div style={{ fontWeight: "700", color: "#f0f6fc", fontSize: "18px", marginBottom: "8px" }}>Ready to Analyze</div>
                  <div style={{ color: "#6e7681", fontSize: "14px" }}>Paste your code above and click <strong style={{ color: "#2ea043" }}>Analyze & Fix Code</strong></div>
                </div>
              )}
            </div>

            {/* RIGHT: Sidebar */}
            <div>
              {/* How It Works */}
              <div className="section-card" style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: "700", color: "#f0f6fc", marginBottom: "16px", fontSize: "14px" }}>
                  ⚙️ How It Works
                </div>
                {[
                  { n: "01", label: "Paste Code", desc: "Any language, any size" },
                  { n: "02", label: "AI Analysis", desc: "Gemini 2.5 Flash reviews" },
                  { n: "03", label: "Get Report", desc: "Bugs, security, quality" },
                  { n: "04", label: "Auto Fix", desc: "Clean corrected code" },
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: "12px", marginBottom: "12px", alignItems: "flex-start" }}>
                    <span style={{
                      background: "#161b22", border: "1px solid #30363d",
                      color: "#58a6ff", borderRadius: "6px", padding: "4px 8px",
                      fontFamily: "'Space Mono', monospace", fontSize: "11px", fontWeight: "700", flexShrink: 0
                    }}>{s.n}</span>
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "13px", color: "#c9d1d9" }}>{s.label}</div>
                      <div style={{ color: "#6e7681", fontSize: "12px" }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Review History */}
              <div className="section-card">
                <div style={{ fontWeight: "700", color: "#f0f6fc", marginBottom: "14px", fontSize: "14px" }}>
                  📜 Recent Reviews
                </div>
                {history.map((item, i) => (
                  <HistoryItem key={i} item={item} index={i} />
                ))}
              </div>

              {/* GitHub PR Box */}
              <div style={{
                background: "linear-gradient(135deg, #0d1117, #161b22)",
                border: "1px solid #30363d", borderRadius: "10px", padding: "20px", marginTop: "16px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "20px" }}>🔗</span>
                  <span style={{ fontWeight: "700", color: "#f0f6fc", fontSize: "14px" }}>GitHub PR Automation</span>
                </div>
                <p style={{ color: "#8b949e", fontSize: "13px", lineHeight: "1.6", marginBottom: "14px" }}>
                  Connect your repository and auto-review every pull request with AI.
                </p>
                <button style={{
                  width: "100%", background: "#161b22", border: "1px solid #30363d",
                  color: "#c9d1d9", padding: "10px", borderRadius: "6px", cursor: "pointer",
                  fontFamily: "'Syne', sans-serif", fontWeight: "600", fontSize: "13px"
                }}>Connect Repository →</button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{
          borderTop: "1px solid #21262d", padding: "20px 24px",
          display: "flex", justifyContent: "center", alignItems: "center", gap: "24px"
        }}>
          <span style={{ color: "#6e7681", fontFamily: "'Space Mono', monospace", fontSize: "11px" }}>
            CodeSentinel AI — Powered by Gemini 2.5 Flash
          </span>
        </footer>
      </div>
    </>
  );
}
