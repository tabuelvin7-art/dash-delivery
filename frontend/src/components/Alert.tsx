interface AlertProps { message: string; }

export function SuccessAlert({ message }: AlertProps) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-xl flex items-center gap-2">
      <span>✓</span> {message}
    </div>
  );
}

export function ErrorAlert({ message }: AlertProps) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl flex items-center gap-2">
      <span>⚠</span> {message}
    </div>
  );
}
