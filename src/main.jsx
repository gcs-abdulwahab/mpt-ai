import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import TracksScreen from './routes/TracksScreen.jsx'
import PathScreen from './routes/PathScreen.jsx'
import LessonRoute from './routes/LessonRoute.jsx'
import AdminScreen from './routes/AdminScreen.jsx'
import { ContentProvider } from './content/ContentProvider.jsx'
import { ProgressProvider } from './storage/ProgressProvider.jsx'
import './index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <TracksScreen /> },
      { path: 'track/:trackId', element: <PathScreen /> },
      { path: 'lesson/:lessonId', element: <LessonRoute /> },
      { path: 'admin', element: <AdminScreen /> },
      { path: '*', element: <TracksScreen /> },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ContentProvider>
      <ProgressProvider>
        <RouterProvider router={router} />
      </ProgressProvider>
    </ContentProvider>
  </StrictMode>,
)
