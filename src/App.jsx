import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import EditPage from './pages/EditPage.jsx'

function LegacyEditRedirect() {
  const { userId, patientId } = useParams()
  return <Navigate to={`/edit/${userId}/${patientId}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/edit/:userId/:patientId/:legacyExtractionId" element={<LegacyEditRedirect />} />
        <Route path="/edit/:userId/:patientId" element={<EditPage />} />
      </Routes>
    </BrowserRouter>
  )
}
