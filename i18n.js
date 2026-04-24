// i18n.js — shared strings for options page UI
// Usage: call applyI18n() after DOM ready; call setLang(lang) to switch.

const STRINGS = {
  ja: {
    // Sidebar
    navDatabases:   "データベース",
    navHotkey:      "ホットキー",
    // Database tab
    dbTabTitle:     "データベース設定",
    dbTabHint:      "チェックを外すと、そのデータベース／プレフィックスはポップアップの候補から除外されます。",
    dbToggleShow:   "データベース一覧を表示",
    dbToggleHide:   "データベース一覧を隠す",
    searchPlaceholder: "データベース名・キーで絞り込み…",
    addDbTitle:     "新規データベースを追加",
    fieldKey:       "キー（英数字・アンダースコア）",
    fieldLabel:     "表示名",
    fieldRegex:     "正規表現（ID パターン）",
    btnAddPrefixRow:"＋ prefix を追加",
    btnAddDb:       "追加",
    badgeCustom:    "カスタム",
    btnEdit:        "編集",
    btnDelete:      "削除",
    btnAddPrefix:   "＋ prefix",
    confirmDelete:  (label) => `"${label}" を削除しますか？`,
    // Inline add prefix
    piLabelPlaceholder: "ラベル（例: mysite）",
    piUriPlaceholder:   "URI プレフィックス",
    btnAddInline:   "追加",
    btnCancel:      "キャンセル",
    errLabelUri:    "ラベルと URI を入力してください。",
    // New DB errors
    errKeyRequired: "キーを入力してください。",
    errKeyInvalid:  "キーは英数字とアンダースコアのみ使用できます。",
    errLabelRequired: "表示名を入力してください。",
    errRegexRequired: "正規表現を入力してください。",
    errRegexInvalid:  "正規表現が不正です。",
    errPrefixBoth:    "各 prefix のラベルと URI を両方入力してください。",
    errPrefixMin:     "prefix を 1 つ以上追加してください。",
    errKeyDuplicate:  (key) => `キー "${key}" は既に使用されています。`,
    // Hotkey tab
    hotkeyTabTitle:   "ホットキー設定",
    hotkeyDesc:       "Chrome の拡張機能ショートカット設定画面からホットキーを変更できます。",
    hotkeyDefault:    "デフォルト:",
    btnOpenShortcuts: "ショートカット設定を開く",
    hotkeyNote:       "chrome://extensions/shortcuts が新しいタブで開きます。Alt+Shift+O（TogoID Open）のキーを変更できます。",
    // Modal
    modalTitle:       (label) => `編集: ${label}`,
    modalSave:        "保存",
    modalCancel:      "キャンセル",
    modalAddPrefix:   "＋ prefix を追加",
    // Placeholders
    phKey:    "my_database",
    phLabel:  "My Database",
    phRegex:  "^(?<id>PREFIX\\d+)$",
    phPiLabel: "ラベル（例: main）",
    phPiUri:   "URI プレフィックス",
    searchCount: (shown, total, q) => q ? `${shown} / ${total} 件` : `${total} 件`,
  },
  en: {
    navDatabases:   "Databases",
    navHotkey:      "Hotkey",
    dbTabTitle:     "Database Settings",
    dbTabHint:      "Uncheck to exclude a database or prefix from popup candidates.",
    dbToggleShow:   "Show database list",
    dbToggleHide:   "Hide database list",
    searchPlaceholder: "Filter by name or key…",
    addDbTitle:     "Add New Database",
    fieldKey:       "Key (alphanumeric / underscore)",
    fieldLabel:     "Display name",
    fieldRegex:     "Regex (ID pattern)",
    btnAddPrefixRow:"＋ Add prefix",
    btnAddDb:       "Add",
    badgeCustom:    "Custom",
    btnEdit:        "Edit",
    btnDelete:      "Delete",
    btnAddPrefix:   "＋ prefix",
    confirmDelete:  (label) => `Delete "${label}"?`,
    piLabelPlaceholder: "Label (e.g. mysite)",
    piUriPlaceholder:   "URI prefix",
    btnAddInline:   "Add",
    btnCancel:      "Cancel",
    errLabelUri:    "Please enter both label and URI.",
    errKeyRequired: "Please enter a key.",
    errKeyInvalid:  "Key must be alphanumeric or underscore only.",
    errLabelRequired: "Please enter a display name.",
    errRegexRequired: "Please enter a regex.",
    errRegexInvalid:  "Invalid regular expression.",
    errPrefixBoth:    "Please enter both label and URI for each prefix.",
    errPrefixMin:     "Please add at least one prefix.",
    errKeyDuplicate:  (key) => `Key "${key}" is already in use.`,
    hotkeyTabTitle:   "Hotkey Settings",
    hotkeyDesc:       "You can change the hotkey in Chrome's extension shortcuts settings.",
    hotkeyDefault:    "Defaults:",
    btnOpenShortcuts: "Open Shortcut Settings",
    hotkeyNote:       "Opens chrome://extensions/shortcuts in a new tab. You can change the Alt+Shift+O hotkey for TogoID Open.",
    modalTitle:       (label) => `Edit: ${label}`,
    modalSave:        "Save",
    modalCancel:      "Cancel",
    modalAddPrefix:   "＋ Add prefix",
    phKey:    "my_database",
    phLabel:  "My Database",
    phRegex:  "^(?<id>PREFIX\\d+)$",
    phPiLabel: "Label (e.g. main)",
    phPiUri:   "URI prefix",
    searchCount: (shown, total, q) => q ? `${shown} / ${total}` : `${total} items`,
  }
};

let _lang = "en";

function t(key, ...args) {
  const val = STRINGS[_lang]?.[key] ?? STRINGS.en[key] ?? key;
  return typeof val === "function" ? val(...args) : val;
}

function setLang(lang) {
  _lang = lang;
  localStorage.setItem("togoid-lang", lang);
  applyI18n();
}

function getLang() { return _lang; }

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });
}

// Load saved language preference
_lang = localStorage.getItem("togoid-lang") || "en";
