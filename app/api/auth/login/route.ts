import { NextResponse } from 'next/server'
import { createChunks, createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

function getCredentials(body?: { email?: string; password?: string }) {
  return {
    email: body?.email || process.env.MIFINANZA_ADMIN_EMAIL,
    password: body?.password || process.env.MIFINANZA_ADMIN_PASSWORD,
  }
}

function errorHtml(message: string) {
  return new NextResponse(
    `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>MiFinanza</title>
        <style>
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0A0A0A; color: white; font-family: system-ui, sans-serif; }
          main { width: min(90vw, 420px); border: 1px solid rgba(255,255,255,.12); border-radius: 16px; padding: 24px; text-align: center; background: rgba(26,26,26,.7); }
          h1 { color: #00FF88; }
          p { color: #FF2D55; }
          small { color: #8B8B8B; }
        </style>
      </head>
      <body>
        <main>
          <h1>MiFinanza</h1>
          <p>${message}</p>
          <small>Ejecuta bun run create-user y recarga /auth.</small>
        </main>
      </body>
    </html>`,
    {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  )
}

function createSupabaseForResponse(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(
          name: string,
          value: string,
          options?: Parameters<typeof response.cookies.set>[2]
        ) {
          response.cookies.set(name, value, options)
        },
        remove(name: string, options?: Parameters<typeof response.cookies.set>[2]) {
          response.cookies.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )
}

async function signIn(
  request: NextRequest,
  response: NextResponse,
  body?: { email?: string; password?: string }
) {
  const { email, password } = getCredentials(body)

  if (!email || !password) {
    return { error: 'Faltan MIFINANZA_ADMIN_EMAIL y MIFINANZA_ADMIN_PASSWORD en .env.local.' }
  }

  const supabase = createSupabaseForResponse(request, response)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (data.session) {
    const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]
    const storageKey = `sb-${projectRef}-auth-token`
    const chunks = createChunks(storageKey, JSON.stringify(data.session))

    chunks.forEach((chunk) => {
      response.cookies.set(chunk.name, chunk.value, {
        path: '/',
        sameSite: 'lax',
        maxAge: data.session?.expires_in,
      })
    })
  }

  return { error: error?.message || null, session: data.session }
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/dashboard', request.url))
  const { error } = await signIn(request, response)

  if (error) {
    return errorHtml(error)
  }

  return response
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const response = NextResponse.json({ ok: true })
  const { error, session } = await signIn(request, response, body)

  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  return NextResponse.json({ ok: true, session })
}
