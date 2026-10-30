
import { useMemo, useState } from "react";
import {
  detectDivisionByZero,
  detectUnreachableCode,
  detectEmptyExceptionHandling,
  detectRiskyFloatEquality,
} from "./analyzer";
import type { Finding } from "./analyzer";
import "./App.css";

type Tab = "analysis" | "findings" | "improvements";
type Page = "dashboard" | "history" | "settings";
type Review = {
  date: string;
  count: number;
  high: number;
  findings: Finding[];
  language: string;
};

const SAMPLE_CODE = `def calculate_average(total, count):
    return total / count

def check_price(price):
    if price == 0.1:
        print("Special price")

def process_data(items):
    try:
        result = items[0]
    except:
        pass

    return result
    print("This code cannot execute")

result = calculate_average(100, 0)
`;

const DEFAULT_SETTINGS = {
  darkMode: true,
  fontSize: 14,
  defaultLanguage: "Python",
  notifications: true,
};

const extraChecks = (code: string): Finding[] => {
  const findings: Finding[] = [];

  code.split(/\r?\n/).forEach((line, index) => {
    const checks = [
      {
        pattern: /\beval\s*\(/,
        id: "SEC-EVAL",
        ruleId: "SEC-EVAL-001",
        title: "Use of eval()",
        severity: "HIGH" as const,
        message: "eval() can execute dynamically supplied code.",
        recommendation: "Avoid eval() and use safer alternatives.",
      },
      {
        pattern: /\bTODO\b|\bFIXME\b/i,
        id: "QUALITY-TODO",
        ruleId: "QUALITY-TODO-001",
        title: "Unresolved TODO/FIXME",
        severity: "LOW" as const,
        message: "This line contains an unfinished task marker.",
        recommendation: "Resolve or document this task before release.",
      },
      {
        pattern: /console\.log\s*\(/,
        id: "QUALITY-LOG",
        ruleId: "QUALITY-LOG-001",
        title: "Console logging",
        severity: "LOW" as const,
        message: "Debug logging may have been left in the code.",
        recommendation: "Remove unnecessary debug logs before production.",
      },
    ];

    checks.forEach((check) => {
      if (check.pattern.test(line)) {
        findings.push({
          id: `${check.id}-${index + 1}`,
          ruleId: check.ruleId,
          title: check.title,
          severity: check.severity,
          line: index + 1,
          message: check.message,
          evidence: line.trim(),
          recommendation: check.recommendation,
        });
      }
    });
  });

  return findings;
};

function App() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [language, setLanguage] = useState(DEFAULT_SETTINGS.defaultLanguage);
  const [tab, setTab] = useState<Tab>("analysis");
  const [page, setPage] = useState<Page>("dashboard");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [history, setHistory] = useState<Review[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [status, setStatus] = useState("Ready to analyze");

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("cs-dark-mode") !== "false";
  });
  const [fontSize, setFontSize] = useState(() => {
    return Number(localStorage.getItem("cs-font-size")) || 14;
  });
  const [defaultLanguage, setDefaultLanguage] = useState(() => {
    return localStorage.getItem("cs-language") || "Python";
  });
  const [notifications, setNotifications] = useState(() => {
    return localStorage.getItem("cs-notifications") !== "false";
  });

  const high = useMemo(
    () => findings.filter((f) => f.severity === "HIGH").length,
    [findings]
  );
  const medium = findings.filter((f) => f.severity === "MEDIUM").length;
  const low = findings.filter((f) => f.severity === "LOW").length;
  const score = Math.max(0, 100 - high * 20 - medium * 10 - low * 4);

  function saveSetting(key: string, value: string) {
    localStorage.setItem(key, value);
  }

  function changeTheme(value: boolean) {
    setDarkMode(value);
    saveSetting("cs-dark-mode", String(value));
  }

  function changeFontSize(value: number) {
    setFontSize(value);
    saveSetting("cs-font-size", String(value));
  }

  function changeDefaultLanguage(value: string) {
    setDefaultLanguage(value);
    saveSetting("cs-language", value);
    setLanguage(value);
  }

  function changeNotifications(value: boolean) {
    setNotifications(value);
    saveSetting("cs-notifications", String(value));
    setStatus(value ? "Notification preference enabled." : "Notification preference disabled.");
  }

  function analyze() {
    if (!code.trim()) {
      setStatus("Please enter code before analyzing.");
      return;
    }

    setStatus("Analyzing code...");

    const results: Finding[] = [];

    if (language === "Python") {
      results.push(
        ...detectDivisionByZero(code),
        ...detectUnreachableCode(code),
        ...detectEmptyExceptionHandling(code),
        ...detectRiskyFloatEquality(code)
      );
    }

    results.push(...extraChecks(code));

    const unique = results.filter(
      (item, index, all) =>
        all.findIndex(
          (other) =>
            other.ruleId === item.ruleId &&
            other.line === item.line &&
            other.message === item.message
        ) === index
    );

    setFindings(unique);
    setAnalyzed(true);
    setTab("analysis");
    setStatus("Analysis completed");

    setHistory((previous) => [
      {
        date: new Date().toLocaleString(),
        count: unique.length,
        high: unique.filter((f) => f.severity === "HIGH").length,
        findings: unique,
        language,
      },
      ...previous,
    ].slice(0, 20));
  }

  function downloadReport() {
    if (!analyzed) return;

    const report = [
      "CODESENTINEL AI — CODE ANALYSIS REPORT",
      `Date: ${new Date().toLocaleString()}`,
      `Language: ${language}`,
      `Risk score: ${score}/100`,
      `Total findings: ${findings.length}`,
      "",
      ...findings.flatMap((f) => [
        `[${f.severity}] ${f.title}`,
        `Rule: ${f.ruleId}`,
        `Line: ${f.line}`,
        `Message: ${f.message}`,
        `Evidence: ${f.evidence}`,
        `Recommendation: ${f.recommendation}`,
        "",
      ]),
      "Note: Results are produced by local rule-based checks, not a guarantee of security.",
    ].join("\n");

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "codesentinel-report.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function applyFix(finding: Finding) {
    if (finding.ruleId !== "BUG-DIV-001" || language !== "Python") return;

    const lines = code.split(/\r?\n/);
    const target = finding.line - 1;
    const line = lines[target];

    if (!line) return;

    const indent = line.match(/^\s*/)?.[0] ?? "";
    const match = line.match(/return\s+(.+?)\s*\/\s*(\w+)/);

    if (!match) {
      setStatus("Automatic fix unavailable for this expression.");
      return;
    }

    const denominator = match[2];

    lines.splice(
      target,
      0,
      `${indent}if ${denominator} == 0:`,
      `${indent}    return 0`
    );

    setCode(lines.join("\n"));
    setAnalyzed(false);
    setFindings([]);
    setStatus("Suggested guard added. Analyze again to verify.");
  }

  function openHistoryItem(item: Review) {
    setFindings(item.findings);
    setLanguage(item.language);
    setAnalyzed(true);
    setTab("analysis");
    setStatus("Viewing a previous analysis");
    setPage("dashboard");
  }

  function resetSettings() {
    changeTheme(DEFAULT_SETTINGS.darkMode);
    changeFontSize(DEFAULT_SETTINGS.fontSize);
    changeDefaultLanguage(DEFAULT_SETTINGS.defaultLanguage);
    changeNotifications(DEFAULT_SETTINGS.notifications);
    setStatus("Settings restored to defaults.");
  }

  function clearHistory() {
    setHistory([]);
    setStatus("Review history cleared.");
  }

  return (
    <div className={`app-shell ${darkMode ? "dark-theme" : "light-theme"}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✦</div>
          <div>
            <strong>CodeSentinel</strong>
            <small>AI CODE REVIEWER</small>
          </div>
        </div>

        <div className="side-label">WORKSPACE</div>

        <button className={`nav-item ${page === "dashboard" ? "active" : ""}`} onClick={() => setPage("dashboard")}>
          ▦ <span>Dashboard</span>
        </button>
        <button className={`nav-item ${page === "history" ? "active" : ""}`} onClick={() => setPage("history")}>
          ◷ <span>Review History</span>
        </button>
        <button className={`nav-item ${page === "settings" ? "active" : ""}`} onClick={() => setPage("settings")}>
          ⚙ <span>Settings</span>
        </button>

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <span>Local analysis engine</span>
          <small>ACTIVE</small>
        </div>
      </aside>

      <main className="main-content">
        {page === "dashboard" && (
          <>
            <header className="topbar">
              <div>
                <span className="eyebrow">DEVELOPER WORKSPACE / OVERVIEW</span>
                <h1>Code Review Dashboard</h1>
              </div>
              <div className="top-status"><span /> SYSTEM OPERATIONAL</div>
            </header>

            <section className="welcome">
              <div>
                <span className="eyebrow">INTELLIGENT CODE INSPECTION</span>
                <h2>Write better code.<br /><span>Ship with confidence.</span></h2>
                <p>Inspect your source code for potential bugs, risky patterns and quality issues.</p>
              </div>
              <div className="welcome-symbol">⌘</div>
            </section>

            <section className="metrics">
              <div className="metric-card purple">
                <span>CODE QUALITY SCORE</span>
                <strong>{analyzed ? score : "—"}<small>/100</small></strong>
                <p>{analyzed ? "Based on detected findings" : "Run an analysis to calculate"}</p>
              </div>
              <div className="metric-card red">
                <span>HIGH SEVERITY</span>
                <strong>{analyzed ? high : "—"}</strong>
                <p>Critical issues to review</p>
              </div>
              <div className="metric-card orange">
                <span>MEDIUM SEVERITY</span>
                <strong>{analyzed ? medium : "—"}</strong>
                <p>Potential code problems</p>
              </div>
              <div className="metric-card green">
                <span>TOTAL FINDINGS</span>
                <strong>{analyzed ? findings.length : "—"}</strong>
                <p>Across enabled checks</p>
              </div>
            </section>

            <section className="workspace">
              <div className="panel editor-panel">
                <div className="panel-heading">
                  <div><span className="live-dot" /> CODE EDITOR</div>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option>Python</option>
                    <option>JavaScript</option>
                    <option>TypeScript</option>
                    <option>Java</option>
                    <option>C</option>
                    <option>C++</option>
                  </select>
                </div>

                <div className="editor-toolbar">
                  <span>● ● ●</span>
                  <span>main.{language === "Python" ? "py" : language.toLowerCase()}</span>
                  <span>{code.split("\n").length} lines</span>
                </div>

                <textarea
                  className="code-editor"
                  spellCheck={false}
                  value={code}
                  style={{ fontSize: `${fontSize}px` }}
                  onChange={(e) => setCode(e.target.value)}
                  aria-label="Source code editor"
                />

                <div className="editor-actions">
                  <button className="button primary" onClick={analyze}>✦ Analyze Code</button>
                  <button className="button secondary" onClick={() => setCode(SAMPLE_CODE)}>Load Sample</button>
                  <button className="button secondary" onClick={() => { setCode(""); setFindings([]); setAnalyzed(false); }}>Clear</button>
                  <button className="button secondary" onClick={downloadReport} disabled={!analyzed}>↓ Report</button>
                </div>
                <div className="status-line">{status}</div>
              </div>

              <div className="panel results-panel">
                <div className="panel-heading">
                  <div>◈ ANALYSIS RESULTS</div>
                  <span className="result-count">{analyzed ? `${findings.length} FOUND` : "AWAITING SCAN"}</span>
                </div>

                <div className="tabs">
                  <button className={tab === "analysis" ? "selected" : ""} onClick={() => setTab("analysis")}>Overview</button>
                  <button className={tab === "findings" ? "selected" : ""} onClick={() => setTab("findings")}>All Findings</button>
                  <button className={tab === "improvements" ? "selected" : ""} onClick={() => setTab("improvements")}>Improvements</button>
                </div>

                {!analyzed ? (
                  <div className="empty-state">
                    <div>⌕</div>
                    <h3>Ready when you are</h3>
                    <p>Run an analysis to see bugs, security warnings and code recommendations here.</p>
                  </div>
                ) : tab === "improvements" ? (
                  <div className="improvement-list">
                    {findings.length === 0 ? (
                      <p>No recommendations. No issues were detected by the enabled checks.</p>
                    ) : findings.map((f) => (
                      <div className="improvement" key={f.id}>
                        <strong>{f.title}</strong>
                        <p>{f.recommendation}</p>
                        <small>LINE {f.line} · {f.ruleId}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="finding-list">
                    {findings.length === 0 ? (
                      <div className="empty-state compact">
                        <div>✓</div><h3>No issues detected</h3>
                        <p>Local checks did not find matching risk patterns.</p>
                      </div>
                    ) : (tab === "findings" ? findings : findings.slice(0, 4)).map((f) => (
                      <article className="finding-card" key={f.id}>
                        <div className="finding-top">
                          <span className={`severity ${f.severity.toLowerCase()}`}>{f.severity}</span>
                          <span className="finding-line">LINE {f.line}</span>
                        </div>
                        <h3>{f.title}</h3>
                        <p>{f.message}</p>
                        <code>{f.evidence}</code>
                        <div className="recommendation">
                          <strong>RECOMMENDATION</strong>
                          <p>{f.recommendation}</p>
                        </div>
                        {f.ruleId === "BUG-DIV-001" && language === "Python" && (
                          <button className="fix-button" onClick={() => applyFix(f)}>Apply suggested guard</button>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="bottom-grid">
              <div className="panel bottom-panel">
                <div className="panel-heading">◷ RECENT REVIEWS</div>
                {history.length === 0 ? <p className="muted">Your recent scans will appear here.</p> :
                  history.slice(0, 5).map((item, index) => (
                    <div className="history-row" key={`${item.date}-${index}`}>
                      <span className="history-icon">⌁</span>
                      <span>Local code analysis<small>{item.date}</small></span>
                      <strong>{item.count} findings</strong>
                    </div>
                  ))}
              </div>
              <div className="panel bottom-panel how-panel">
                <div className="panel-heading">✧ HOW IT WORKS</div>
                <p><b>01</b> Paste your source code into the editor.</p>
                <p><b>02</b> Run the available local detection rules.</p>
                <p><b>03</b> Review evidence and recommendations.</p>
                <p><b>04</b> Download a report for your records.</p>
              </div>
            </section>

            <footer>CodeSentinel AI <span>·</span> Local rule-based code analysis · Review findings before applying changes</footer>
          </>
        )}

        {page === "history" && (
          <>
            <header className="topbar">
              <div>
                <span className="eyebrow">DEVELOPER WORKSPACE / RECORDS</span>
                <h1>Review History</h1>
              </div>
              <div className="top-status"><span /> LOCAL HISTORY</div>
            </header>

            <section className="panel page-panel">
              <div className="panel-heading">
                <div>◷ PREVIOUS ANALYSES</div>
                <span className="result-count">{history.length} REVIEWS</span>
              </div>

              {history.length === 0 ? (
                <div className="empty-state">
                  <div>◷</div>
                  <h3>No review history yet</h3>
                  <p>Your completed code analyses will appear here.</p>
                  <button className="button primary" onClick={() => setPage("dashboard")}>Go to Dashboard</button>
                </div>
              ) : (
                <div className="finding-list">
                  {history.map((item, index) => (
                    <div className="history-row" key={`${item.date}-${index}`}>
                      <span className="history-icon">⌁</span>
                      <span>
                        Code analysis · {item.language}
                        <small>{item.date}</small>
                      </span>
                      <strong>{item.count} findings · {item.high} high</strong>
                      <button className="button secondary" onClick={() => openHistoryItem(item)}>View Results</button>
                    </div>
                  ))}
                </div>
              )}

              {history.length > 0 && (
                <button className="button secondary" onClick={clearHistory}>Clear Review History</button>
              )}
            </section>
            <footer>CodeSentinel AI <span>·</span> Review History</footer>
          </>
        )}

        {page === "settings" && (
          <>
            <header className="topbar">
              <div>
                <span className="eyebrow">DEVELOPER WORKSPACE / PREFERENCES</span>
                <h1>Settings</h1>
              </div>
              <div className="top-status"><span /> CONFIGURATION</div>
            </header>

            <section className="panel page-panel">
              <div className="panel-heading">⚙ APPLICATION SETTINGS</div>

              <div className="setting-row">
                <div>
                  <strong>Appearance</strong>
                  <p>Change the dashboard between dark and light themes.</p>
                </div>
                <button className="button secondary" onClick={() => changeTheme(!darkMode)}>
                  {darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                </button>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Editor Font Size</strong>
                  <p>Adjust the code editor text size.</p>
                </div>
                <div className="setting-controls">
                  <button className="button secondary" onClick={() => changeFontSize(Math.max(10, fontSize - 1))}>A−</button>
                  <strong>{fontSize}px</strong>
                  <button className="button secondary" onClick={() => changeFontSize(Math.min(24, fontSize + 1))}>A+</button>
                </div>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Default Programming Language</strong>
                  <p>Choose the language selected when the application opens.</p>
                </div>
                <select value={defaultLanguage} onChange={(e) => changeDefaultLanguage(e.target.value)}>
                  <option>Python</option>
                  <option>JavaScript</option>
                  <option>TypeScript</option>
                  <option>Java</option>
                  <option>C</option>
                  <option>C++</option>
                </select>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Notifications Preference</strong>
                  <p>Save your preference for application notifications.</p>
                </div>
                <button className="button secondary" onClick={() => changeNotifications(!notifications)}>
                  {notifications ? "Notifications: On" : "Notifications: Off"}
                </button>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Analysis Engine</strong>
                  <p>Local rule-based checks are currently enabled.</p>
                </div>
                <span className="result-count">ACTIVE</span>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Clear Review History</strong>
                  <p>Remove all reviews stored in this session.</p>
                </div>
                <button className="button secondary" onClick={clearHistory}>Clear History</button>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Reset Settings</strong>
                  <p>Restore all preferences to their default values.</p>
                </div>
                <button className="button secondary" onClick={resetSettings}>Reset Settings</button>
              </div>

              <p className="status-line">{status}</p>
            </section>
            <footer>CodeSentinel AI <span>·</span> Application Settings</footer>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
