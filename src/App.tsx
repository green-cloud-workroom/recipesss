import { RouterProvider } from 'react-router-dom'

import { appRouter } from './routes/appRouter'

export function App() {
  return <RouterProvider router={appRouter} />
}

export default App
