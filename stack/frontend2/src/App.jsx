/**
 * App.jsx
 *
 * Route map:
 *   /                → Home    — upload form + how-it-works guide
 *   /result/:uuid    → Result  — analysis result, charts, email gate
 *   /iot/:uuid?      → IoT     — sensor data for a job (uuid optional)
 *   /about           → About   — transparency + API reference
 *   *                → NotFound
 *
 * Provider order (outer → inner):
 *   I18nextProvider (in main.jsx)
 *     BrowserRouter
 *       JobProvider   — global job state shared across all pages
 *         LangProvider — active language, synced with i18n
 *           Routes
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { JobProvider }  from './context/JobContext';
import { LangProvider } from './context/LangContext';
import Home    from './pages/Home';
import Scan    from './pages/Scan';
import Result  from './pages/Result';
import IoT     from './pages/IoT';
import About   from './pages/About';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <JobProvider>
        <LangProvider>
          <Routes>
            <Route path="/"              element={<Home />}    />
            <Route path="/scan"          element={<Scan />}    />
            <Route path="/result/:uuid"  element={<Result />}  />
            <Route path="/iot/:uuid"     element={<IoT />}     />
            <Route path="/iot"           element={<IoT />}     />
            <Route path="/about"         element={<About />}   />
            {/* Legacy query-param URLs — redirect to path-param form */}
            <Route path="/result"        element={<ResultRedirect />} />
            <Route path="*"              element={<NotFound />} />
          </Routes>
        </LangProvider>
      </JobProvider>
    </BrowserRouter>
  );
}

/** Redirect /result?uuid=xxx → /result/xxx */
function ResultRedirect() {
  const params = new URLSearchParams(window.location.search);
  const uuid = params.get('uuid');
  return uuid ? <Navigate to={`/result/${uuid}`} replace /> : <Navigate to="/" replace />;
}
