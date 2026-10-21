import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import EditPage from './pages/EditPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'

const DevEditPage = import.meta.env.DEV
  ? lazy(() => import('./pages/DevEditPage.jsx'))
  : null

function LegacyEditRedirect() {
  const { userId, patientId } = useParams()
  return <Navigate to={`/edit/${userId}/${patientId}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/edit/:userId/:patientId/:legacyExtractionId" element={<LegacyEditRedirect />} />
        <Route path="/edit/:userId/:patientId" element={<EditPage />} />
        {DevEditPage && (
          <Route
            path="/dev/edit"
            element={
              <Suspense fallback={null}>
                <DevEditPage />
              </Suspense>
            }
          />
        )}
        {/* Redirect random/unavailable URLs to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
