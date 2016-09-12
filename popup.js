window.onload = () => {
  document.getElementById('versionNumber').innerText = chrome.runtime.getManifest().version;
};
