'use strict';

function onExtensionMessage(response) {
  switch (response.action) {
    case ACTION_APPEND:
      switch (response.source) {
        case SOURCE_POPUP:
          requestGenAXTree(response.action);
          break;
        case SOURCE_BACKGROUND:
          appendAXTree(response.axtree);
          break;
      }
      break;
    case ACTION_REMOVE:
      removeAXTree();
      break;
    case ACTION_MESSAGE:
      messageAXTree(response.axtree);
      break;
  }
}

function onPageMessage(event) {
  // Only accept messages from the embedding page.
  if (event.source !== window) {
    return;
  }

  let data = event.data || {};

  if (
    data.extension === EXT_NAME &&
    data.source === SOURCE_PAGE
  ) {
    switch (data.action) {
      case ACTION_APPEND:
      case ACTION_MESSAGE:
        requestGenAXTree(data.action);
        break;
      case ACTION_REMOVE:
        removeAXTree();
        break;
    }
  }
}

function requestGenAXTree(action) {
  if (document.readyState === READY_STATE_COMPLETE) {
    genAXTree(action);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      genAXTree(action);
      document.removeEventListener(genAXTree);
    });
  }
}

function genAXTree(action) {
  const message = {
    action: action,
    source: SOURCE_CONTENT
  };
  // Clean up any AX info in the DOM.
  removeAXTree().then(
    // Success.
    function() {
      // Wait for the DOM to really get itself freshened up.
      window.setTimeout(function() {
        // Rebuild the tree.
        chrome.runtime.sendMessage(message);
      }, 0);
    }
  );
}

function appendAXTree(axTree) {
  if (!axTree) {
    throw new Error('No AXTree provided for appending.');
    return;
  }
  let axTreeFrag = DocFragUtils.deserialize(axTree);
  let axContainer = document.createElement('div');
  axContainer.setAttribute('id', ARBOREA11Y_CONTAINER_ID);
  axContainer.setAttribute('style', 'outline: 1px solid red; outline-offset: -1px; padding: 10px; margin: 10px 0;');
  axContainer.appendChild(axTreeFrag);
  document.body.appendChild(axContainer);
}

function removeAXTree() {
  return new Promise(function(resolve, reject) {
    let axContainer = document.getElementById(ARBOREA11Y_CONTAINER_ID);
    if (axContainer) {
      // Wait for mutations to complete.
      let observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          for (let node of Array.prototype.slice.call(mutation.removedNodes)) {
            if (node === axContainer) {
              resolve(node);
              observer.disconnect();
              break;
            }
          }
        });
      });
      let config = {
        attributes: false,
        childList: true,
        characterData: false
      };
      observer.observe(document.body, config);
      document.body.removeChild(axContainer);
    }
    else {
      resolve();
    }
  });
}

function messageAXTree(axTree) {
  window.postMessage({
    extension: EXT_NAME,
    source: SOURCE_EXT,
    action: 'message',
    axtree: axTree
  }, '*');
}
// Embedded page messages.
window.addEventListener("message", onPageMessage, false);
// Background messages.
chrome.runtime.onMessage.addListener(onExtensionMessage);
