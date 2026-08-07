import { BrowserRouter, Route, Routes } from 'react-router-dom'
import WorkflowPage from './pages/WorkflowPage.jsx'
import EditPage from './pages/EditPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkflowPage />} />
        <Route path="/edit" element={<EditPage />} />
      </Routes>
    </BrowserRouter>
  )
}
