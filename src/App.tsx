import { useEffect, useRef, useState } from "react";
import type { Category, Quest, Rule, SaveData } from "./lib/types";
import { categories, tagLabels } from "./lib/types";
import { dependents, evaluate } from "./lib/rules";
import {
  DEMO_SAVE_KEY,
  SAVE_KEY,
  emptySave,
  mergeSave,
  parseSave,
  readSave,
} from "./lib/storage";
import { quests, dataStatus } from "./data/quests";
import { demoQuests } from "./data/demo";

type View = {
  category: Category;
  rank: string;
  search: string;
  tag: string;
  role: string;
  incomplete: boolean;
};
const defaultView: View = {
  category: "village",
  rank: "3",
  search: "",
  tag: "",
  role: "",
  incomplete: false,
};
const VIEW_KEY = "qlog.mhxx.view.v1";
function loadView(): View {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null");
    if (
      !v ||
      !categories.some((c) => c.id === v.category && c.ranks.includes(v.rank))
    )
      return defaultView;
    return {
      category: v.category,
      rank: v.rank,
      search: typeof v.search === "string" ? v.search : "",
      tag: ["", ...Object.keys(tagLabels)].includes(v.tag) ? v.tag : "",
      role: ["", "hunter", "prowler"].includes(v.role) ? v.role : "",
      incomplete: v.incomplete === true,
    };
  } catch {
    return defaultView;
  }
}
function loadProgress(key: string): { save: SaveData; error: string } {
  try {
    return { save: readSave(localStorage, key), error: "" };
  } catch {
    return {
      save: emptySave(),
      error:
        "保存済みの進捗を読み取れません。既存の保存内容は上書きせず保護しています。元データを退避し、ブラウザの保存設定やJSONの内容を確認してください。",
    };
  }
}
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function rankLabel(category: Category, rank: string) {
  const label = categories.find((c) => c.id === category)!.label;
  if (category === "g_rank") return `${label} ${rank.replace("G", "G★")}`;
  if (category === "village") return `${label} ★${rank}`;
  if (category === "hub")
    return `${label} ★${rank}（${Number(rank) <= 3 ? "下位" : "上位"}）`;
  return `${label} ${rank}`;
}
const evaluationLabels = {
  met: "前提条件達成",
  unmet: "未達成",
  unknown: "要確認",
};

export default function App() {
  const [demo, setDemo] = useState(false);
  const [progress, setProgress] = useState(() => loadProgress(SAVE_KEY));
  const [view, setView] = useState(loadView);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [pending, setPending] = useState<SaveData | null>(null);
  const [replace, setReplace] = useState(false);
  const [hrText, setHrText] = useState(() => String(progress.save.hr ?? ""));
  const [hrError, setHrError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const items = demo ? demoQuests : quests;
  const key = demo ? DEMO_SAVE_KEY : SAVE_KEY;
  const { save } = progress;
  const completed = new Set(save.completedQuestIds);
  const knownIds = new Set(items.map((q) => q.id));
  const unknownSaved = save.completedQuestIds.filter((id) => !knownIds.has(id));
  const category = categories.find((c) => c.id === view.category)!;
  const rankQuests = items
    .filter((q) => q.category === view.category && q.rank === view.rank)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const doneCount = rankQuests.filter((q) => completed.has(q.id)).length;
  const filtered = rankQuests.filter(
    (q) =>
      (!view.search ||
        q.name
          .normalize("NFKC")
          .toLocaleLowerCase("ja")
          .includes(view.search.normalize("NFKC").toLocaleLowerCase("ja"))) &&
      (!view.tag || q.tags.includes(view.tag as keyof typeof tagLabels)) &&
      (!view.role || q.role === view.role || q.role === "either") &&
      (!view.incomplete || !completed.has(q.id)),
  );
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(view));
    } catch {
      setMessage(
        "表示設定を保存できません。ブラウザの保存設定・空き容量を確認してください。",
      );
    }
  }, [view]);
  useEffect(() => {
    if (expanded)
      document
        .getElementById(`quest-${expanded}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [expanded]);
  useEffect(() => {
    if (pending) dialog.current?.showModal();
  }, [pending]);
  function updateSave(next: SaveData) {
    if (progress.error) {
      setMessage("元の保存内容を保護中のため変更できません。");
      return false;
    }
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setProgress({ save: next, error: "" });
      setMessage("このブラウザに保存しました。");
      return true;
    } catch {
      setMessage(
        "保存できませんでした。変更は反映していません。ブラウザの保存設定・空き容量を確認してください。",
      );
      return false;
    }
  }
  function toggle(q: Quest) {
    updateSave({
      ...save,
      completedQuestIds: completed.has(q.id)
        ? save.completedQuestIds.filter((id) => id !== q.id)
        : [...save.completedQuestIds, q.id],
    });
  }
  function switchMode() {
    const next = !demo;
    const loaded = loadProgress(next ? DEMO_SAVE_KEY : SAVE_KEY);
    setDemo(next);
    setProgress(loaded);
    setHrText(String(loaded.save.hr ?? ""));
    setExpanded(null);
    setMessage("");
    setImportError("");
    setHrError("");
  }
  function jump(q: Quest) {
    setView({ ...defaultView, category: q.category, rank: q.rank });
    setExpanded(q.id);
  }
  function QuestLink({ id }: { id: string }) {
    const q = items.find((q) => q.id === id);
    return q ? (
      <button className="text-link" onClick={() => jump(q)}>
        {rankLabel(q.category, q.rank)} / {q.name}
      </button>
    ) : (
      <span>未収録の前提（{id}）</span>
    );
  }
  function RuleView({ rule }: { rule: Rule }) {
    const state = evaluate(rule, save);
    return (
      <div className={`rule rule-${state}`}>
        {rule.kind === "none" && "確認済み：前提なし"}
        {rule.kind === "unknown" &&
          `解放条件：未確認${rule.note ? `（${rule.note}）` : ""}`}
        {rule.kind === "external_flag" && `${rule.label}：ゲーム内で要確認`}
        {rule.kind === "hr_at_least" &&
          `HR ${rule.value}以上（${save.hr === undefined ? "HR未入力" : `入力HR ${save.hr}`}）`}
        {rule.kind === "quest_cleared" && (
          <>
            <QuestLink id={rule.questId} />{" "}
            <span>{state === "met" ? "クリア済み" : "未クリア"}</span>
          </>
        )}
        {(rule.kind === "all" || rule.kind === "any") && (
          <>
            <strong>
              {rule.kind === "all"
                ? "すべて必要（AND）"
                : "いずれかが必要（OR）"}
            </strong>
            <ul>
              {rule.rules.map((r, i) => (
                <li key={i}>
                  <RuleView rule={r} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }
  async function inspectFile(file: File | undefined) {
    if (!file) return;
    setImportError("");
    setMessage("");
    try {
      if (file.size > 2_000_000)
        throw Error("ファイルが大きすぎます（上限2MB）。");
      const text = await file.text();
      const incoming = parseSave(text);
      const dataset = JSON.parse(text).dataset ?? "mhxx";
      if (dataset !== (demo ? "demo" : "mhxx"))
        throw Error(
          "実データと架空の動作確認データのバックアップは相互に読み込めません。",
        );
      setReplace(false);
      setPending(incoming);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "読み込めませんでした。");
    }
    if (upload.current) upload.current.value = "";
  }
  function closeImport() {
    dialog.current?.close();
    setPending(null);
  }
  function applyImport() {
    if (pending && updateSave(replace ? pending : mergeSave(save, pending))) {
      if (replace) setHrText(String(pending.hr ?? ""));
      closeImport();
    }
  }
  const pendingUnknown =
    pending?.completedQuestIds.filter((id) => !knownIds.has(id)) ?? [];
  const removedCount = pending
    ? save.completedQuestIds.filter(
        (id) => !pending.completedQuestIds.includes(id),
      ).length
    : 0;
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#main">
            <span className="brand-mark" aria-hidden="true">
              Q
            </span>
            <span>
              QLOG<span className="brand-caption">MHXX クエスト手帳</span>
            </span>
          </a>
          <span className="private-label">ブラウザ内に保存</span>
        </div>
      </header>
      <main id="main">
        <section className="intro">
          <p className="eyebrow">MONSTER HUNTER XX / QUEST LOG</p>
          <h1>ひとつずつ、狩りの足跡。</h1>
          <p>クエストのクリア状況と、次につながる条件を手元に。</p>
        </section>
        <section className="notice" aria-label="データ収録状況">
          <strong>
            データ整備中 ·{" "}
            {demo
              ? "架空データで操作確認中"
              : `実クエスト${quests.length}件・一部確認`}
          </strong>
          <p>
            {demo
              ? "村★1〜3の6件はすべて架空の例です。実際のゲーム情報ではありません。進捗も実データとは別に保存します。"
              : dataStatus.note}
          </p>
          <button onClick={switchMode} className="secondary">
            {demo ? "実データに戻る" : "架空データで操作を試す"}
          </button>
        </section>
        {progress.error && (
          <div role="alert" className="error">
            <p>{progress.error}</p>
            <button
              className="secondary"
              onClick={() => {
                try {
                  download(
                    localStorage.getItem(key) ?? "",
                    "qlog-recovery.json",
                  );
                } catch {
                  setMessage(
                    "元データを読み取れません。ブラウザの保存設定を確認してください。",
                  );
                }
              }}
            >
              元の保存データを退避
            </button>
          </div>
        )}
        <nav className="category-nav" aria-label="クエストカテゴリ">
          {categories.map((c) => (
            <button
              key={c.id}
              aria-pressed={view.category === c.id}
              onClick={() => {
                setView({ ...view, category: c.id, rank: c.ranks[0] });
                setExpanded(null);
              }}
            >
              {c.label}
            </button>
          ))}
        </nav>
        <section className="workspace" aria-labelledby="rank-heading">
          <div className="rank-top">
            <div>
              <p className="eyebrow">
                QUESTS / {demo ? "DEMO" : "MY PROGRESS"}
              </p>
              <h2 id="rank-heading">{rankLabel(view.category, view.rank)}</h2>
            </div>
            <label className="rank-select">
              ランク
              <select
                value={view.rank}
                onChange={(e) => {
                  setView({ ...view, rank: e.target.value });
                  setExpanded(null);
                }}
              >
                {category.ranks.map((r) => (
                  <option key={r} value={r}>
                    {r.startsWith("G")
                      ? r.replace("G", "G★")
                      : /^\d+$/.test(r)
                        ? `★${r}`
                        : r}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="progress-heading">
            <span>
              クリア <strong>{doneCount}</strong> / 収録済み {rankQuests.length}
              件
            </span>
            <span>
              {rankQuests.length
                ? `${Math.round((doneCount / rankQuests.length) * 100)}%`
                : "未収録"}
            </span>
          </div>
          <progress
            aria-label="選択ランクの収録済みクエスト達成率"
            value={doneCount}
            max={rankQuests.length || 1}
          />
          <p className="small muted">
            {demo
              ? "架空データのみの達成率です。"
              : "分母は収録済みの件数です。全クエストの達成率ではありません。"}
          </p>
          <div className="filters">
            <label className="search-label">
              クエスト名で検索
              <input
                type="search"
                placeholder="クエスト名を入力"
                value={view.search}
                onChange={(e) => setView({ ...view, search: e.target.value })}
              />
            </label>
            <label>
              種別
              <select
                value={view.tag}
                onChange={(e) => setView({ ...view, tag: e.target.value })}
              >
                <option value="">すべて</option>
                {Object.entries(tagLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              プレイ種別
              <select
                value={view.role}
                onChange={(e) => setView({ ...view, role: e.target.value })}
              >
                <option value="">すべて</option>
                <option value="hunter">ハンター</option>
                <option value="prowler">ニャンター</option>
              </select>
            </label>
          </div>
          <div className="list-heading">
            <label className="check-label">
              <input
                type="checkbox"
                checked={view.incomplete}
                onChange={(e) =>
                  setView({ ...view, incomplete: e.target.checked })
                }
              />
              未クリアのみ
            </label>
            <span className="small muted">表示 {filtered.length}件</span>
          </div>
          <div className="quest-list">
            {filtered.map((q) => {
              const state = evaluate(q.condition, save),
                next = dependents(q.id, items),
                open = expanded === q.id;
              return (
                <article
                  key={q.id}
                  id={`quest-${q.id}`}
                  className={`quest-card ${completed.has(q.id) ? "is-done" : ""}`}
                >
                  <div className="quest-row">
                    <label className="quest-check">
                      <input
                        type="checkbox"
                        checked={completed.has(q.id)}
                        disabled={!!progress.error}
                        onChange={() => toggle(q)}
                        aria-label={`${q.name}をクリア`}
                      />
                      <span className="sr-only">クリア</span>
                    </label>
                    <button
                      className="quest-title"
                      aria-expanded={open}
                      aria-controls={`detail-${q.id}`}
                      onClick={() => setExpanded(open ? null : q.id)}
                    >
                      <span className="quest-tags">
                        {q.tags.map((t) => (
                          <span key={t} className={`tag tag-${t}`}>
                            {tagLabels[t]}
                          </span>
                        ))}
                        {q.role !== "hunter" && (
                          <span className="tag">
                            {q.role === "prowler" ? "ニャンター" : "共通"}
                          </span>
                        )}
                      </span>
                      <span className="quest-name">{q.name}</span>
                      <span className="quest-meta">
                        {q.verification === "verified"
                          ? "データ確認済み"
                          : q.verification === "partial"
                            ? "データ一部確認"
                            : "データ未確認"}{" "}
                        · {evaluationLabels[state]}
                      </span>
                    </button>
                    <span className="expand-icon" aria-hidden="true">
                      {open ? "−" : "＋"}
                    </span>
                  </div>
                  {open && (
                    <div className="quest-details" id={`detail-${q.id}`}>
                      <p className="small">{q.verificationNote}</p>
                      <h3>このクエストの出現前提</h3>
                      <p className={`state state-${state}`}>
                        {evaluationLabels[state]}
                      </p>
                      <RuleView rule={q.condition} />
                      <p className="small muted">
                        前提条件を満たしても、ゲーム内の出現・受領を保証しません。会話や進行状況を確認してください。
                      </p>
                      <h3>このクリアが条件に含まれるクエスト</h3>
                      {next.length ? (
                        <ul>
                          {next.map((n) => (
                            <li key={n.id}>
                              <QuestLink id={n.id} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="small muted">
                          収録済みデータ内に参照はありません。未収録の関係は判定できません。
                        </p>
                      )}
                      <h3>解放要素（参考）</h3>
                      {q.unlocks.length ? (
                        <ul>
                          {q.unlocks.map((u, i) => (
                            <li key={i}>
                              {u.label}
                              <p className="small">{u.note}</p>
                              <span className="small muted">
                                {completed.has(q.id)
                                  ? "クリア記録あり。ゲーム内での受け取りは要確認。"
                                  : "クエストのクリア記録なし。"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="small muted">解放要素：未確認</p>
                      )}
                      <h3>出典・攻略リンク</h3>
                      {q.sources.map((s) => (
                        <p key={s.url} className="small">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {s.site}（
                            {s.kind === "detail"
                              ? "該当クエスト詳細"
                              : s.kind === "list"
                                ? "一覧"
                                : "トップページ"}
                            ） ↗
                          </a>
                          {s.checkedAt && ` / 確認日 ${s.checkedAt}`}
                        </p>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {!filtered.length && (
            <div className="empty">
              <span aria-hidden="true">◇</span>
              <h3>
                {rankQuests.length
                  ? "条件に合うクエストがありません"
                  : "このランクは、これから収録します"}
              </h3>
              <p>
                {rankQuests.length
                  ? "検索・種別・未クリアの絞り込みを変更してください。"
                  : "確認できた情報から順に追加します。未収録は「クエストなし」を意味しません。"}
              </p>
              {rankQuests.length > 0 && (
                <button
                  className="secondary"
                  onClick={() =>
                    setView({
                      ...view,
                      search: "",
                      tag: "",
                      role: "",
                      incomplete: false,
                    })
                  }
                >
                  絞り込みを解除
                </button>
              )}
            </div>
          )}
        </section>
        <section className="tools" aria-labelledby="tools-heading">
          <div>
            <p className="eyebrow">SAVE & TRANSFER</p>
            <h2 id="tools-heading">進捗を大切に。</h2>
            <p className="small muted">
              1キャラクター分をこのブラウザに自動保存します。端末間の移行やブラウザのデータ削除に備えて、定期的にバックアップしてください。自動同期はありません。
            </p>
          </div>
          <div className="backup-buttons">
            <button
              disabled={!!progress.error}
              onClick={() =>
                download(
                  JSON.stringify(
                    { ...save, dataset: demo ? "demo" : "mhxx" },
                    null,
                    2,
                  ),
                  `qlog-${demo ? "demo-" : ""}${new Date().toISOString().slice(0, 10)}.json`,
                )
              }
            >
              JSONを書き出す
            </button>
            <button
              className="secondary"
              disabled={!!progress.error}
              onClick={() => upload.current?.click()}
            >
              JSONから復元
            </button>
            <input
              ref={upload}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="バックアップファイル"
              onChange={(e) => void inspectFile(e.target.files?.[0])}
            />
          </div>
          {importError && (
            <p role="alert" className="error">
              {importError} 既存の進捗は変更していません。
            </p>
          )}
          {unknownSaved.length > 0 && (
            <p className="small">
              未収録IDのクリア記録 {unknownSaved.length}
              件を保持しています。再収録時に表示されます。
            </p>
          )}
          <form
            className="hr-form"
            onSubmit={(e) => {
              e.preventDefault();
              const hr = hrText.trim() === "" ? undefined : Number(hrText);
              if (
                hr !== undefined &&
                (!Number.isInteger(hr) || hr < 1 || hr > 999)
              ) {
                setHrError("HRは1〜999の整数にしてください。");
                return;
              }
              setHrError("");
              updateSave({ ...save, hr });
            }}
          >
            <label htmlFor="hr">
              現在のHR（任意・1〜999）
              <span className="small muted">
                未入力のHR条件は「要確認」になります。
              </span>
            </label>
            <div>
              <input
                id="hr"
                inputMode="numeric"
                value={hrText}
                onChange={(e) => setHrText(e.target.value)}
                placeholder="未入力"
                aria-describedby={hrError ? "hr-error" : undefined}
              />
              <button className="secondary" disabled={!!progress.error}>
                HRを保存
              </button>
            </div>
            {hrError && (
              <p role="alert" id="hr-error" className="error">
                {hrError}
              </p>
            )}
          </form>
        </section>
        <details className="coverage">
          <summary>収録状況と出典について</summary>
          <p className="small">
            全対象クエストの収録を目標にしています。総件数は未確認です。
            {demo
              ? `以下は架空データの件数です。実クエストは${quests.length}件です。`
              : `現在は実クエスト${quests.length}件です。`}
          </p>
          <div className="table-scroll">
            <table>
              <caption>カテゴリ別・確認状況別の収録件数</caption>
              <thead>
                <tr>
                  <th>カテゴリ</th>
                  <th>収録済み</th>
                  <th>確認済み</th>
                  <th>一部確認</th>
                  <th>未確認</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => {
                  const group = items.filter((q) => q.category === c.id);
                  return (
                    <tr key={c.id}>
                      <th>{c.label}</th>
                      <td>{group.length}</td>
                      {(["verified", "partial", "unverified"] as const).map(
                        (v) => (
                          <td key={v}>
                            {group.filter((q) => q.verification === v).length}
                          </td>
                        ),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <table>
              <caption>村★1〜3の収録状況</caption>
              <thead>
                <tr>
                  <th>ランク</th>
                  <th>収録済み</th>
                  <th>網羅確認</th>
                </tr>
              </thead>
              <tbody>
                {["1", "2", "3"].map((rank) => (
                  <tr key={rank}>
                    <th>村★{rank}</th>
                    <td>
                      {
                        items.filter(
                          (q) => q.category === "village" && q.rank === rank,
                        ).length
                      }
                    </td>
                    <td>未完了</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small">
            第一参照元：
            <a
              href="https://wiki.mhxg.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              MHXX攻略レシピ ↗
            </a>
            。実在確認前の個別URLや解放条件は推測で登録しません。逆引きは収録済みの条件式から生成します。
          </p>
        </details>
        <p role="status" className="save-status" aria-live="polite">
          {message}
        </p>
      </main>
      <footer>
        QLOG / MHXX クエスト手帳
        <p>
          非公式の個人制作ツールです。サポートの義務はありません。
          <br />
          ゲーム内の情報を優先してご利用ください。
        </p>
      </footer>
      <dialog
        ref={dialog}
        onCancel={() => setPending(null)}
        aria-labelledby="import-heading"
      >
        {pending && (
          <>
            <h2 id="import-heading">復元内容の確認</h2>
            <p>ファイル内のクリア記録：{pending.completedQuestIds.length}件</p>
            <p>未収録のID：{pendingUnknown.length}件（削除せず保持します）</p>
            <p>ファイル内HR：{pending.hr ?? "未入力"}</p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />
              現在の進捗をファイルで置き換える
            </label>
            <p className="small">
              {replace
                ? `現在の記録のうち ${removedCount}件が外れ、HRもファイルの内容に置き換わります。`
                : "既存のクリア記録に追加します。現在のHRは変更しません。"}
            </p>
            <div className="dialog-actions">
              <button className="secondary" onClick={closeImport}>
                キャンセル
              </button>
              <button onClick={applyImport}>
                {replace ? "置き換えて復元" : "追加して復元"}
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
