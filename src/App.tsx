import { Routes, Route } from 'react-router-dom'
import LandingPage from './LandingPage'
import DataRoom from './DataRoom'
import DocumentSharing from './DocumentSharing'
import ViewDocument from './ViewDocument'
import SignDocument from './SignDocument'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      {/* Public Routes */}
      <Route path="/view/:shareLink" element={<ViewDocument />} />
      <Route path="/sign/:signingLink" element={<SignDocument />} />

      {/* Application Routes */}
      <Route
        path="/dataroom"
        element={
          <ProtectedRoute>
            <DataRoom />
          </ProtectedRoute>
        }
      />
      <Route
        path="/document-sharing"
        element={
          <ProtectedRoute>
            <DocumentSharing />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
