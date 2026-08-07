import { BrowserRouter, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import EditPage from './pages/EditPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/edit/:userId/:patientId/:extractionId" element={<EditPage />} />
      </Routes>
    </BrowserRouter>
  )
}
