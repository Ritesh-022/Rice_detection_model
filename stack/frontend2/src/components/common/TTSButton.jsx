import { useTranslation } from 'react-i18next';
import { useTTS } from '../../hooks/useTTS';

export default function TTSButton({ text }) {
  const { t, i18n } = useTranslation();
  const { speak, stop, speaking, supported } = useTTS();

  if (!supported || !text) return null;

  const langMap = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' };
  const lang = langMap[i18n.language] ?? 'en-IN';

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      onClick={() => (speaking ? stop() : speak(text, lang))}
      aria-label={speaking ? t('tts_stop') : t('tts_listen')}
    >
      {speaking ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          {t('tts_stop')}
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          {t('tts_listen')}
        </>
      )}
    </button>
  );
}
