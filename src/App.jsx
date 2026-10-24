import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import OfflineBanner from './components/OfflineBanner.jsx'
import PwaInstallBanner from './components/PwaInstallBanner.jsx'

const EditPage = lazy(() => import('./pages/EditPage.jsx'))
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'))
const DevEditPage = import.meta.env.DEV
  ? lazy(() => import('./pages/DevEditPage.jsx'))
  : null

function LegacyEditRedirect() {
  const { userId, patientId } = useParams()
  return <Navigate to={`/edit/${userId}/${patientId}`} replace />
}

function PageSuspenseFallback() {
  return (
    <div className="min-h-svh flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
        <p className="text-xs font-medium text-slate-500">Loading module…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <PwaInstallBanner />
      <Suspense fallback={<PageSuspenseFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/edit/:userId/:patientId/:legacyExtractionId" element={<LegacyEditRedirect />} />
          <Route path="/edit/:userId/:patientId" element={<EditPage />} />
          {DevEditPage && (
            <Route
              path="/dev/edit"
              element={<DevEditPage />}
            />
          )}
          {/* Redirect random/unavailable URLs to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
