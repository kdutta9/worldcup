import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import WorldCupLottoDraft from './WorldCupLottoDraft'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WorldCupLottoDraft />
  </StrictMode>
)
