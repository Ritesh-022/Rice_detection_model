/**
 * context/LangContext.jsx
 *
 * Thin wrapper that exposes the active i18n language and a setter.
 * Components use useTranslation() for translations but can call
 * useLang().setLang('hi') to switch language from anywhere.
 */
import { createContext, useContext, useState } from 'react';
import i18n from '../i18n/index';

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(i18n.language || 'en');

  const setLang = (code) => {
    i18n.changeLanguage(code);
    setLangState(code);
  };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>');
  return ctx;
}
