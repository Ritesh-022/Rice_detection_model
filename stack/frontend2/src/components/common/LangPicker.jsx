/**
 * components/common/LangPicker.jsx
 * Language selector — reads/writes through LangContext.
 */
import { useLang } from '../../context/LangContext';

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हिं' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
];

export default function LangPicker() {
  const { lang, setLang } = useLang();

  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      className="input"
      style={{ width: 'auto', padding: '4px 8px', fontSize: 13, marginLeft: 8 }}
      aria-label="Language"
    >
      {LANGS.map(({ code, label }) => (
        <option key={code} value={code}>{label}</option>
      ))}
    </select>
  );
}
