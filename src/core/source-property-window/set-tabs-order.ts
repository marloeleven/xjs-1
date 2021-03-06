export default function setTabsOrder(tabs: string[]) {
  if (typeof window === 'undefined') return;

  const payload = {
    event: 'set-tab-order',
    value: JSON.stringify(tabs),
  };

  window.parent.postMessage(JSON.stringify(payload), '*');
}
