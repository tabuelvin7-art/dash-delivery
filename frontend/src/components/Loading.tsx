interface LoadingProps {
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function Loading({ fullScreen = false, size = 'md' }: LoadingProps) {
  const sizes = { sm: 'h-6 w-6', md: 'h-10 w-10', lg: 'h-14 w-14' };
  const spinner = (
    <div
      className={`animate-spin rounded-full border-b-2 border-green-600 ${sizes[size]}`}
      role="status"
      aria-label="Loading"
    />
  );
  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {spinner}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center h-40">
      {spinner}
    </div>
  );
}
