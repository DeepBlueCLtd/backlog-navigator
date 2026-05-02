import { useState } from 'react';
import { setPat, hasPat, clearPat } from '../github/auth';
import { strings } from '../strings';

export interface AuthPromptProps {
  onSaved?: () => void;
}

export function AuthPrompt({ onSaved }: AuthPromptProps): JSX.Element {
  const [pat, setPatLocal] = useState('');
  const [stored, setStored] = useState(hasPat());

  const save = (): void => {
    if (pat.trim().length === 0) return;
    setPat(pat.trim());
    setPatLocal('');
    setStored(true);
    onSaved?.();
  };
  const clear = (): void => {
    clearPat();
    setStored(false);
  };

  return (
    <div className="auth-prompt" role="region" aria-label="GitHub authentication">
      <strong>{strings.auth.title}</strong>
      <input
        type="password"
        placeholder={strings.auth.patLabel}
        value={pat}
        onChange={(e) => setPatLocal(e.target.value)}
        aria-label={strings.auth.patLabel}
      />
      <button onClick={save}>{strings.auth.save}</button>
      {stored ? <button onClick={clear}>{strings.auth.clear}</button> : null}
      <span style={{ marginLeft: 'auto', color: 'var(--fg-muted)' }}>
        {stored ? strings.auth.stored : strings.auth.notStored}
        {' '}
        <a href={strings.auth.patCreateUrl} target="_blank" rel="noopener noreferrer">
          {strings.auth.patCreateLink}
        </a>
      </span>
    </div>
  );
}
