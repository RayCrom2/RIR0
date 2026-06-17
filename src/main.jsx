import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

document.addEventListener("click", (e) => {
  if (e.target.tagName === "INPUT" && e.target.type !== "checkbox" && e.target.type !== "radio") {
    e.target.select();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)