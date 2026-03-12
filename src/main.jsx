import React from 'react'
import ReactDOM from 'react-dom/client'
import TaskBrain from './TaskBrain.jsx'

class ErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(err) { return { error: err } }
  componentDidCatch(err, info) { console.error('[TaskBrain]', err, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 560 }}>
          <h2 style={{ color: '#DC2626', marginBottom: 8 }}>页面加载出错</h2>
          <pre style={{ fontSize: 12, overflow: 'auto', background: '#f3f4f6', padding: 12, borderRadius: 8 }}>{this.state.error.message}</pre>
          <p style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>请打开浏览器开发者工具 (F12) → Console 查看完整错误，或检查 Vercel 环境变量是否已配置 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY。</p>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <TaskBrain />
    </ErrorBoundary>
  </React.StrictMode>
)
