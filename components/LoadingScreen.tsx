interface LoadingScreenProps {
  message?: string
}

export function LoadingScreen({ message = 'Cargando...' }: LoadingScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neonCyan border-t-transparent" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}
