/**
 * Centralised user-facing strings (i18n-ready; no per-file literals).
 * Future translation: replace the default export with a locale-resolving function.
 */

export const strings = {
  app: {
    title: 'Backlog Navigator',
    loading: 'Loading BACKLOG.md…',
    loadError: 'Failed to load BACKLOG.md',
  },
  filters: {
    placeholder: 'Filter…',
    status: 'Status',
    category: 'Category',
    epic: 'Epic',
    complexity: 'Complexity',
    free: 'Free text',
    clear: 'Clear filters',
    any: '(any)',
    none: '(none)',
  },
  columns: {
    id: 'ID',
    category: 'Category',
    description: 'Description',
    value: 'V',
    media: 'M',
    autonomy: 'A',
    total: 'Total',
    complexity: 'Complexity',
    status: 'Status',
    epic: 'Epic',
    created: 'Created',
    updated: 'Updated',
  },
  group: {
    byEpic: 'Group by epic',
    flat: 'Flat list',
    unassigned: '(unassigned)',
    progress: (done: number, total: number) => `${done}/${total}`,
  },
  description: {
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    expand: 'Expand',
    collapse: 'Collapse',
  },
  pending: {
    footer: (n: number) => `${n} pending edit${n === 1 ? '' : 's'}`,
    pushChanges: 'Push Changes',
    discardAll: 'Discard all',
    confirmDiscard: 'Discard every pending edit?',
    none: 'No pending edits',
    undo: 'Undo this edit',
  },
  push: {
    title: 'Push Changes',
    prTitleLabel: 'PR title',
    prBodyLabel: 'PR body',
    summaryHeading: 'Summary',
    rawDiff: 'Show raw diff',
    rawDiffHide: 'Hide raw diff',
    confirm: 'Open PR',
    confirmDryRun: 'Preview submission',
    confirmPr: 'Add commit to existing PR',
    cancel: 'Cancel',
    pushing: 'Pushing…',
    successLive: (url: string) => `PR opened: ${url}`,
    successPr: (url: string) => `Commit added to PR: ${url}`,
    successDryRun: 'Preview submission acknowledged — no PR opened.',
    failPrefix: 'Push failed',
    staleBase:
      'BACKLOG.md has moved since you loaded it. Reload and re-apply your edits.',
    collision: 'ID collision detected. Resolve before pushing.',
    scopeMissing: 'Your PAT lacks `repo` scope. Update it in settings.',
    networkError: 'Network error. Your edits are preserved; please retry.',
  },
  auth: {
    settingsButton: 'Settings',
    settingsAriaLabel: 'Open settings (GitHub authentication)',
    title: 'Sign in to push edits',
    patLabel: 'GitHub Personal Access Token (classic, scope `repo`)',
    patHelp:
      'Generate a classic PAT with `repo` scope. The token is stored only in this device\'s localStorage.',
    patCreateUrl: 'https://github.com/settings/tokens/new?scopes=repo',
    patCreateLink: 'Open GitHub PAT settings',
    save: 'Save token',
    clear: 'Clear token',
    stored: 'A token is stored on this device.',
    notStored: 'No token stored.',
    invalid: 'Token rejected by GitHub.',
  },
  prMode: {
    banner: (n: number, branch: string) =>
      `Editing PR #${n} — head branch \`${branch}\``,
    closed: (n: number) => `PR #${n} is closed; switching to read-only.`,
    noChanges: (n: number) =>
      `PR #${n} doesn't currently touch BACKLOG.md.`,
    invalid: 'Invalid PR number in URL.',
  },
  dryRun: {
    banner: 'Preview deployment — Push Changes will not commit.',
  },
  errors: {
    parseError: 'BACKLOG.md could not be parsed.',
    sentinelDate: 'Created date could not be recovered from history.',
    duplicateId: (id: number) => `Duplicate ID: ${id}.`,
    unknownEpic: (id: string) => `Epic ${id} is referenced but not defined.`,
  },
  defaults: {
    prBodyPrefix: 'Backlog edits via Backlog Navigator.\n\n',
  },
} as const;
