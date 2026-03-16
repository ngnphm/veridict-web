export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeMap = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }
  return (
    <div className={`${sizeMap[size] || sizeMap.md} ${className} animate-spin rounded-full border-2 border-gray-700 border-t-brand-500`} />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <LoadingSpinner size="lg" />
    </div>
  )
}
