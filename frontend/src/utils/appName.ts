export function getAppName(): string {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('finzox.live')) {
    return 'Finzo X';
  }
  return 'Viser Digital';
}
