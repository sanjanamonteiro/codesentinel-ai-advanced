
import { useMemo, useState } from "react";
import { detectDivisionByZero } from "./analyzer";

type Tab = "analysis" | "findings" | "improvements";

type FindingItem = {
  id: string;
  ruleId: string;
  title: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  line: number;
  message: string;
  evidence: string;
  recommendation: string;
};

const SAMPLE_CODE = `def divide(a, b):
    return a / b

print(divide(10, 0))`;

const STARTER_CODE = `def calculate_average(total, count):
    return total / count

print(calculate_average(100, 0))`;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b1120",
    color: "#e5edf8",
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    padding: "18px 5%",
    borderBottom: "1px solid #253148",
    background: "#0f1728",
  },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  logo: {
    width: 42,
    height: 42,
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    background: "#153d54",
    border: "1px solid #287e9c",
    color: "#67e8f9",
    fontWeight: 800,
    fontSize: 21,
  },
  muted: { color: "#91a2ba" },
  container: { maxWidth: 1250, margin: "0 auto", padding: "32px 5%" },
  panel: {
    background: "#111c2e",
    border: "1px solid #263750",
    borderRadius: 14,
    padding: 22,
    minWidth: 0,
  },
  button: {
    background: "#0891b2",
    color: "#ffffff",
    border: 0,
    borderRadius: 8,
    padding: "11px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#1b2940",
    color: "#dbeafe",
    border: "1px solid #34445e",
    borderRadius: 8,
    padding: "10px 13px",
    cursor: "pointer",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "#080f1c",
    color: "#dbeafe",
    border: "1px solid #2a3b54",
    borderRadius: 9,
    padding: 15,
    fontFamily: "Consolas, Monaco, monospace",
    fontSize: 14,
    lineHeight: 1.65,
    resize: "vertical",
  },
  label: { fontSize: 13, fontWeight: 700, color: "#b8c7dc" },
};

function Metric({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div style={styles.panel}>
      <div style={styles.muted}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, margin: "10px 0" }}>
        {value}
      </div>
      <div style={{ ...styles.muted, fontSize: 12 }}>{description}</div>
    </div>
  );
}

function FindingCard({
  finding,
  onApplyFix,
}: {
  finding: FindingItem;
  onApplyFix: (finding: FindingItem) => void;
}) {
  const severityColors = {
    HIGH: { text: "#fca5a5", border: "#7f303d", bg: "#351b29" },
    MEDIUM: { text: "#fcd34d", border: "#705b29", bg: "#332b1a" },
    LOW: { text: "#86efac", border: "#28634b", bg: "#173126" },
  };

  const color = severityColors[finding.severity];

  return (
    <div
      style={{
        background: "#0b1423",
        border: "1px solid #293950",
        borderRadius: 11,
        padding: 17,
        marginTop: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <strong>{finding.title}</strong>
        <span
          style={{
            color: color.text,
            background: color.bg,
            border: `1px solid ${color.border}`,
            padding: "4px 8px",
            borderRadius: 5,
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {finding.severity}
        </span>
      </div>

      <p style={{ ...styles.muted, fontSize: 12 }}>
        {finding.ruleId} | Line {finding.line}
      </p>

      <p style={{ lineHeight: 1.6 }}>{finding.message}</p>

      <div style={{ marginTop: 12 }}>
        <div style={styles.label}>Evidence</div>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            background: "#070d17",
            borderRadius: 7,
            padding: 12,
            color: "#c4d5eb",
            fontSize: 12,
          }}
        >
          {finding.evidence}
        </pre>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 7,
          background: "#102c36",
          color: "#a5f3fc",
          lineHeight: 1.6,
        }}
      >
        <strong>Recommended fix:</strong> {finding.recommendation}
      </div>
      {finding.ruleId === "BUG-DIV-001" && (
        <button
          type="button"
          onClick={() => onApplyFix(finding)}
          style={{ ...styles.button, marginTop: 12 }}
        >
          Apply Suggested Fix
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [language, setLanguage] = useState("Python");
  const [activeTab, setActiveTab] = useState<Tab>("analysis");
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [status, setStatus] = useState("Ready to analyze");
  const [history, setHistory] = useState<
    { language: string; time: string; count: number }[]
  >([]);
  function applySuggestedFix(finding: FindingItem) {
    const match = finding.message.match(
      /Function "([A-Za-z_]\w*)" divides by parameter "([A-Za-z_]\w*)"/
    );

    if (!match || language !== "Python") {
      setStatus("No supported automatic fix is available.");
      return;
    }

    const functionName = match[1];
    const denominator = match[2];
    const lines = code.split(/\r?\n/);
    const definitionIndex = lines.findIndex((line) =>
      new RegExp("^\\s*def\\s+" + functionName + "\\s*\\(").test(line)
    );

    if (definitionIndex < 0) {
      setStatus("Could not locate the function. No changes made.");
      return;
    }

    const definition = lines[definitionIndex];
    const indent = definition.match(/^\s*/)?.[0] ?? "";
    const bodyIndent = indent + "    ";
    const nextLine = lines[definitionIndex + 1] ?? "";

    if (new RegExp("^\\s*if\\s+" + denominator + "\\s*==\\s*0\\s*:").test(nextLine)) {
      setStatus("A zero-denominator check already exists.");
      return;
    }

    lines.splice(
      definitionIndex + 1,
      0,
      bodyIndent + "if " + denominator + " == 0:",
      bodyIndent + '    raise ValueError("' + denominator + ' must not be zero")'
    );

    setCode(lines.join("\n"));
    setFindings([]);
    setHasAnalyzed(false);
    setStatus("Suggested check inserted. Analyze the updated code to verify it.");
  }

  const highCount = useMemo(
    () => findings.filter((item) => item.severity === "HIGH").length,
    [findings]
  );

  function analyzeCode() {
    if (!code.trim()) {
      setStatus("Please enter code before starting the analysis.");
      setFindings([]);
      setHasAnalyzed(false);
      return;
    }

    const results: FindingItem[] = [];

    if (language === "Python") {
      results.push(...detectDivisionByZero(code));
    }

    const lines = code.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (/\beval\s*\(/.test(line)) {
        results.push({
          id: `eval-${index + 1}`,
          ruleId: "SEC-EVAL-001",
          title: "Use of eval",
          severity: "HIGH",
          line: index + 1,
          message:
            "eval can execute dynamically supplied expressions and may be dangerous with untrusted input.",
          evidence: line.trim(),
          recommendation:
            "Avoid eval where possible. Use a safe parser or explicitly validate permitted inputs.",
        });
      }

      if (/\bTODO\b|\bFIXME\b/.test(line)) {
        results.push({
          id: `todo-${index + 1}`,
          ruleId: "MAINT-TODO-001",
          title: "Unfinished code marker",
          severity: "LOW",
          line: index + 1,
          message: "This line contains a TODO or FIXME marker.",
          evidence: line.trim(),
          recommendation:
            "Review this marker and complete or document the outstanding work.",
        });
      }

      if (/\bconsole\.log\s*\(/.test(line)) {
        results.push({
          id: `log-${index + 1}`,
          ruleId: "QUAL-LOG-001",
          title: "Debug logging detected",
          severity: "LOW",
          line: index + 1,
          message:
            "Console logging may expose unnecessary information or clutter production output.",
          evidence: line.trim(),
          recommendation:
            "Remove unnecessary debug statements or use a controlled logging system.",
        });
      }
    });

    const uniqueResults = results.filter(
      (item, index, all) =>
        all.findIndex((other) => other.id === item.id) === index
    );

    setFindings(uniqueResults);
    setHasAnalyzed(true);
    setActiveTab("analysis");
    setStatus(
      uniqueResults.length
        ? `Analysis completed: ${uniqueResults.length} finding(s) detected.`
        : "Analysis completed: no findings matched the enabled local checks."
    );

    setHistory((previous) =>
      [
        {
          language,
          time: new Date().toLocaleTimeString(),
          count: uniqueResults.length,
        },
        ...previous,
      ].slice(0, 5)
    );
  }
  function downloadReport() {
    if (!hasAnalyzed) {
      setStatus("Please analyze your code before downloading a report.");
      return;
    }

    const report = [
      "CODESENTINEL AI — CODE ANALYSIS REPORT",
      "======================================",
      `Date: ${new Date().toLocaleString()}`,
      `Language: ${language}`,
      `Total findings: ${findings.length}`,
      `High severity: ${findings.filter((f) => f.severity === "HIGH").length}`,
      `Medium severity: ${findings.filter((f) => f.severity === "MEDIUM").length}`,
      `Low severity: ${findings.filter((f) => f.severity === "LOW").length}`,
      "",
      "FINDINGS",
      "--------",
      ...(
        findings.length
          ? findings.flatMap((f, index) => [
              "",
              `${index + 1}. ${f.title}`,
              `Rule ID: ${f.ruleId}`,
              `Severity: ${f.severity}`,
              `Line: ${f.line}`,
              `Details: ${f.message}`,
              `Evidence: ${f.evidence}`,
              `Recommendation: ${f.recommendation}`,
            ])
          : ["No findings matched the enabled local checks."]
      ),
      "",
      "LIMITATION NOTICE",
      "-----------------",
      "This report covers only the local checks enabled in CodeSentinel AI.",
      "No findings does not guarantee that the code is secure or bug-free.",
    ].join("\n");

    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `codesentinel-report-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setStatus("Analysis report download requested.");
  }

  function loadSample() {
    setLanguage("Python");
    setCode(STARTER_CODE);
    setStatus("Sample loaded. Click Analyze Code to scan it.");
    setHasAnalyzed(false);
    setFindings([]);
  }

  function clearCode() {
    setCode("");
    setFindings([]);
    setHasAnalyzed(false);
    setStatus("Editor cleared.");
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.logo}>CS</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              CodeSentinel AI
            </div>
            <div style={{ ...styles.muted, fontSize: 12 }}>
              Code quality and security review
            </div>
          </div>
        </div>
        <div
          style={{
            border: "1px solid #28634b",
            color: "#86efac",
            background: "#173126",
            borderRadius: 20,
            padding: "7px 12px",
            fontSize: 12,
          }}
        >
          Local analysis mode
        </div>
      </header>

      <main style={styles.container}>
        <section style={{ marginBottom: 28 }}>
          <div
            style={{
              color: "#67e8f9",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 2,
            }}
          >
            CODE REVIEW WORKSPACE
          </div>
          <h1
            style={{
              fontSize: "clamp(28px, 4vw, 42px)",
              margin: "12px 0",
            }}
          >
            Find issues before they reach production.
          </h1>
          <p
            style={{
              ...styles.muted,
              maxWidth: 720,
              lineHeight: 1.7,
            }}
          >
            Inspect code with local, rule-based checks. Review the evidence,
            understand potential issues, and use the recommendations to
            improve your code.
          </p>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
            marginBottom: 24,
          }}
        >
          <Metric
            label="Findings in latest scan"
            value={hasAnalyzed ? findings.length : "--"}
            description="Based on the latest analysis"
          />
          <Metric
            label="High-severity findings"
            value={hasAnalyzed ? highCount : "--"}
            description="Potentially serious issues detected"
          />
          <Metric
            label="Language"
            value={language}
            description="Select the language for this scan"
          />
        </div>

        <section style={styles.panel}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 6px" }}>Code editor</h2>
              <div style={{ ...styles.muted, fontSize: 13 }}>
                Paste code below, or load the demonstration sample.
              </div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
              }}
            >
              Language
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                style={{
                  background: "#0b1423",
                  color: "#e5edf8",
                  border: "1px solid #34445e",
                  padding: 9,
                  borderRadius: 7,
                }}
              >
                <option>Python</option>
                <option>JavaScript</option>
                <option>TypeScript</option>
                <option>Java</option>
                <option>C</option>
                <option>C++</option>
              </select>
            </label>
          </div>

          <textarea
            aria-label="Code editor"
            spellCheck={false}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            rows={12}
            style={styles.input}
            placeholder="Paste your code here..."
          />

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 15,
            }}
          >
            <button onClick={analyzeCode} style={styles.button}>
              Analyze Code
            </button>
            <button onClick={loadSample} style={styles.secondaryButton}>
              Load Test Sample
            </button>
            <button onClick={clearCode} style={styles.secondaryButton}>
              Clear Editor
            <button
             onClick={downloadReport}
             style={styles.secondaryButton}
             disabled={!hasAnalyzed}
             >
             Download Report
            </button>
            </button>
          </div>

          <p
            role="status"
            style={{
              color: hasAnalyzed ? "#86efac" : "#91a2ba",
              fontSize: 13,
              marginBottom: 0,
            }}
          >
            {status}
          </p>
        </section>

        <section style={{ ...styles.panel, marginTop: 22 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              borderBottom: "1px solid #293950",
              paddingBottom: 15,
              marginBottom: 16,
            }}
          >
            {(
              [
                ["analysis", "Analysis Results"],
                ["findings", "All Findings"],
                ["improvements", "Recommendations"],
              ] as [Tab, string][]
            ).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  ...styles.secondaryButton,
                  background: activeTab === tab ? "#164e63" : "#1b2940",
                  borderColor: activeTab === tab ? "#0891b2" : "#34445e",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {!hasAnalyzed ? (
            <div style={{ padding: "26px 5px", textAlign: "center" }}>
              <h3>Ready for your first scan</h3>
              <p style={styles.muted}>
                Run the analysis to display findings and recommendations here.
              </p>
            </div>
          ) : findings.length === 0 ? (
            <div
              style={{
                padding: 20,
                background: "#102c36",
                borderRadius: 9,
                lineHeight: 1.7,
              }}
            >
              <strong style={{ color: "#a5f3fc" }}>
                No findings from the enabled checks
              </strong>
              <p style={{ marginBottom: 0 }}>
                This is not proof that the code is bug-free or secure. The
                current analyzer uses a limited set of local rules.
              </p>
            </div>
          ) : activeTab === "improvements" ? (
            <div>
              <h3>Recommended actions</h3>
              {findings.map((finding) => (
                <div
                  key={finding.id}
                  style={{
                    padding: 14,
                    marginTop: 10,
                    border: "1px solid #293950",
                    borderRadius: 9,
                    lineHeight: 1.7,
                  }}
                >
                  <strong>{finding.title}</strong>
                  <p style={{ marginBottom: 0 }}>
                    {finding.recommendation}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <h3>
                {activeTab === "findings" ? "All detected findings" : "Scan summary"}
              </h3>
              <p style={styles.muted}>
                {findings.length} finding(s) from the enabled local checks.
                Review each result before changing your code.
              </p>
              {findings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  onApplyFix={applySuggestedFix}
                />
              ))}
            </div>
          )}
        </section>

        <section style={{ ...styles.panel, marginTop: 22 }}>
          <h2 style={{ marginTop: 0 }}>Recent scans</h2>
          {history.length === 0 ? (
            <p style={styles.muted}>Your scan history will appear here during this session.</p>
          ) : (
            history.map((item, index) => (
              <div
                key={`${item.time}-${index}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                  padding: "12px 0",
                  borderBottom:
                    index < history.length - 1 ? "1px solid #293950" : "none",
                }}
              >
                <span>{item.language} scan</span>
                <span style={styles.muted}>{item.time}</span>
                <strong>{item.count} finding(s)</strong>
              </div>
            ))
          )}
        </section>

        <footer
          style={{
            textAlign: "center",
            padding: "28px 0 8px",
            ...styles.muted,
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          CodeSentinel AI | Educational code review prototype
          <br />
          Results depend on the implemented rules and do not guarantee security.
        </footer>
      </main>
    </div>
  );
}

