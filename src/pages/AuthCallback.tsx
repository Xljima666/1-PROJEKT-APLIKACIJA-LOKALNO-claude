import { useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    let mounted = true

    const run = async () => {
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      if (error) {
        console.error('OAuth callback error:', error, errorDescription)
        if (mounted) navigate('/login', { replace: true })
        return
      }

      const { data, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('Session error:', sessionError)
        if (mounted) navigate('/login', { replace: true })
        return
      }

      // 🔥 OVDJE JE FIX
      if (data.session) {
        if (mounted) navigate('/dashboard', { replace: true })
        return
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted) return

        // 🔥 I OVDJE
        if (event === 'SIGNED_IN' && session) {
          navigate('/dashboard', { replace: true })
        } else if (event === 'SIGNED_OUT') {
          navigate('/login', { replace: true })
        }
      })

      return () => subscription.unsubscribe()
    }

    const cleanupPromise = run()

    return () => {
      mounted = false
      Promise.resolve(cleanupPromise).then((cleanup) => {
        if (typeof cleanup === 'function') cleanup()
      })
    }
  }, [navigate, searchParams])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Učitavanje...</p>
    </div>
  )
}