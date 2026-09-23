export function formatDelta(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`;
}

export function downloadJson(value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'simulation-result.json';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
