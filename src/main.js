import './style.css';

// Git Topology Connections Graph
const connections = [
  { from: 'work', to: 'stage', bidirectional: true },
  { from: 'stage', to: 'local-main', bidirectional: false },
  { from: 'stage', to: 'local-feature', bidirectional: false },
  { from: 'local-main', to: 'remote', bidirectional: true },
  { from: 'local-feature', to: 'local-main', bidirectional: false }
];

// Global Git Repository State
let gitState = {
  activeBranch: 'main',
  unstaged: 3,
  staged: 0,
  localMainCommits: 0,
  localFeatureCommits: 0,
  remoteCommits: 0,
  isBranchCreated: false,
  animateWorkIn: false,
  animateStageIn: false
};

// Simulation Engine Variables
let particles = [];
let speedMultiplier = 1.2;
let isSimulating = false;
let sandboxMode = false;
let sandboxSourceNode = null;

let nodeRects = {};

function updateNodeRects() {
  const workspace = document.getElementById('canvas-workspace');
  if (!workspace) return;
  const workspaceRect = workspace.getBoundingClientRect();
  
  const nodes = ['work', 'stage', 'local-main', 'local-feature', 'remote'];
  nodeRects = {};
  nodes.forEach(nodeId => {
    const el = document.getElementById(`node-${nodeId}`);
    if (el) {
      const rect = el.getBoundingClientRect();
      nodeRects[nodeId] = {
        left: rect.left - workspaceRect.left,
        top: rect.top - workspaceRect.top,
        right: rect.right - workspaceRect.left,
        bottom: rect.bottom - workspaceRect.top
      };
    }
  });
}

// SLEEP UTILITY (Speed-aware)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms / speedMultiplier));

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Calculate and draw paths
  drawPaths();

  // Boot Particle loop
  updateParticles();

  // Update initial DOM metrics
  updateGitStateDOM();
  updateFilesDOM();

  // Add Event Listeners
  window.addEventListener('resize', drawPaths);
  setupNodeActionsListeners();
  setupUIEventListeners();

  logEntry('system', 'Ready. Click a Git action button inside any node card to begin.', 'system');
});

// REDRAW SVG PATHS
function drawPaths() {
  const svg = document.getElementById('connections-svg');
  if (!svg) return;

  updateNodeRects();

  // Clear existing paths (except <defs>)
  const paths = svg.querySelectorAll('.connection-path, .connection-path-glow');
  paths.forEach(p => p.remove());

  const workspace = document.getElementById('canvas-workspace');
  const workspaceRect = workspace.getBoundingClientRect();

  connections.forEach((conn) => {
    const fromNode = document.getElementById(`node-${conn.from}`);
    const toNode = document.getElementById(`node-${conn.to}`);
    if (!fromNode || !toNode) return;

    // Skip drawing branch paths if feature branch is inactive/hidden
    if ((conn.from === 'local-feature' || conn.to === 'local-feature') && !gitState.isBranchCreated) {
      return;
    }

    const fromRect = fromNode.getBoundingClientRect();
    const toRect = toNode.getBoundingClientRect();

    const x1 = fromRect.left + fromRect.width / 2 - workspaceRect.left;
    const y1 = fromRect.top + fromRect.height / 2 - workspaceRect.top;

    const x2 = toRect.left + toRect.width / 2 - workspaceRect.left;
    const y2 = toRect.top + toRect.height / 2 - workspaceRect.top;

    const dx = x2 - x1;
    const dy = y2 - y1;

    let pathD = '';
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal S-curve
      pathD = `M ${x1} ${y1} C ${x1 + dx * 0.45} ${y1}, ${x2 - dx * 0.45} ${y2}, ${x2} ${y2}`;
    } else {
      // Vertical S-curve
      pathD = `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.45}, ${x2} ${y2 - dy * 0.45}, ${x2} ${y2}`;
    }

    // Base connection path
    const basePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    basePath.setAttribute('d', pathD);
    basePath.setAttribute('class', 'connection-path');
    basePath.setAttribute('id', `path-${conn.from}-${conn.to}`);

    // Glow connection overlay
    const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glowPath.setAttribute('d', pathD);
    glowPath.setAttribute('class', 'connection-path-glow');
    glowPath.setAttribute('id', `glow-path-${conn.from}-${conn.to}`);

    svg.appendChild(basePath);
    svg.appendChild(glowPath);
  });
}

// PARTICLE ENGINE ANIMATION LOOP
function updateParticles() {
  const speedSlider = document.getElementById('speed-range');
  if (speedSlider) {
    speedMultiplier = parseFloat(speedSlider.value);
    const speedVal = document.getElementById('speed-val');
    if (speedVal) speedVal.textContent = speedMultiplier.toFixed(2);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.progress += 0.012 * speedMultiplier * p.speed;

    if (p.progress >= 1) {
      p.onComplete();
      p.element.remove();
      particles.splice(i, 1);
    } else {
      const currentLength = p.visualStartLength + p.progress * (p.visualEndLength - p.visualStartLength);
      const point = p.path.getPointAtLength(currentLength);
      p.element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%)`;
    }
  }

  requestAnimationFrame(updateParticles);
}

// DISPATCH DATA PACKET PROMISE
function dispatchPacket(from, to, colorClass) {
  updateNodeRects();
  return new Promise((resolve) => {
    let pathId = `path-${from}-${to}`;
    let direction = 1;
    let pathEl = document.getElementById(pathId);

    if (!pathEl) {
      pathId = `path-${to}-${from}`;
      pathEl = document.getElementById(pathId);
      direction = -1;
    }

    if (!pathEl) {
      console.warn(`No visual connection exists between ${from} and ${to}`);
      resolve();
      return;
    }

    const fromRect = nodeRects[from];
    const toRect = nodeRects[to];
    const pathLength = pathEl.getTotalLength();
    
    let visualStartLength = direction === 1 ? 0 : pathLength;
    let visualEndLength = direction === 1 ? pathLength : 0;
    
    if (fromRect) {
      if (direction === 1) {
        for (let len = 0; len <= pathLength; len += 2) {
          const pt = pathEl.getPointAtLength(len);
          if (pt.x < fromRect.left || pt.x > fromRect.right || pt.y < fromRect.top || pt.y > fromRect.bottom) {
            visualStartLength = len;
            break;
          }
        }
      } else {
        for (let len = pathLength; len >= 0; len -= 2) {
          const pt = pathEl.getPointAtLength(len);
          if (pt.x < fromRect.left || pt.x > fromRect.right || pt.y < fromRect.top || pt.y > fromRect.bottom) {
            visualStartLength = len;
            break;
          }
        }
      }
    }
    
    if (toRect) {
      if (direction === 1) {
        for (let len = pathLength; len >= 0; len -= 2) {
          const pt = pathEl.getPointAtLength(len);
          if (pt.x < toRect.left || pt.x > toRect.right || pt.y < toRect.top || pt.y > toRect.bottom) {
            visualEndLength = len;
            break;
          }
        }
      } else {
        for (let len = 0; len <= pathLength; len += 2) {
          const pt = pathEl.getPointAtLength(len);
          if (pt.x < toRect.left || pt.x > toRect.right || pt.y < toRect.top || pt.y > toRect.bottom) {
            visualEndLength = len;
            break;
          }
        }
      }
    }

    // Toggle glowing path overlay
    const glowEl = document.getElementById(`glow-${pathId}`);
    const colorTag = colorClass.replace('packet-', '');
    if (glowEl) {
      glowEl.classList.add(`active-${colorTag}`);
    }

    // Node state pulsing
    setNodeState(from, 'active', 'Syncing...');

    const container = document.getElementById('packets-container');
    const packetEl = document.createElement('div');
    packetEl.className = `data-packet ${colorClass}`;
    packetEl.style.left = '0px';
    packetEl.style.top = '0px';
    container.appendChild(packetEl);

    const particle = {
      element: packetEl,
      path: pathEl,
      from,
      to,
      direction,
      progress: 0,
      speed: 1.0,
      colorClass,
      visualStartLength,
      visualEndLength,
      onComplete: () => {
        if (glowEl) {
          glowEl.classList.remove(`active-${colorTag}`);
        }
        triggerArrivalPulse(to, colorTag);
        resolve();
      }
    };

    particles.push(particle);
  });
}

// TRIGGER GLOW FLASH PULSE ON PACKET ARRIVAL
function triggerArrivalPulse(nodeId, colorTag) {
  const nodeEl = document.getElementById(`node-${nodeId}`);
  if (!nodeEl) return;

  const pulseClass = `arrival-pulse-${colorTag}`;
  nodeEl.classList.add(pulseClass);

  // Remove after CSS animation ends (0.8s)
  setTimeout(() => {
    nodeEl.classList.remove(pulseClass);
  }, 800);
}

// UPDATE NODE STATUS METADATA
function setNodeState(nodeId, state, text) {
  const nodeEl = document.getElementById(`node-${nodeId}`);
  if (!nodeEl) return;

  const indicator = nodeEl.querySelector('.status-indicator');
  const textEl = nodeEl.querySelector('.status-text');

  if (indicator) {
    indicator.className = 'status-indicator';
  }
  nodeEl.classList.remove('active-pulse');

  if (state === 'idle') {
    if (indicator) indicator.classList.add('status-idle');
    if (textEl) {
      if (nodeId === 'local-feature' && !gitState.isBranchCreated) {
        textEl.textContent = 'Inactive';
      } else if (nodeId === 'local-main' && gitState.activeBranch === 'main') {
        textEl.textContent = 'HEAD pointing to main';
      } else if (nodeId === 'local-feature' && gitState.activeBranch === 'feature') {
        textEl.textContent = 'HEAD pointing to feature';
      } else {
        textEl.textContent = text || 'Clean';
      }
    }
  } else if (state === 'active') {
    if (indicator) indicator.classList.add('status-active');
    if (textEl) textEl.textContent = text || 'Executing...';
    nodeEl.classList.add('active-pulse');
  } else if (state === 'processing') {
    if (indicator) indicator.classList.add('status-processing');
    if (textEl) textEl.textContent = text || 'Indexing...';
    nodeEl.classList.add('active-pulse');
  } else if (state === 'success') {
    if (indicator) indicator.classList.add('status-success');
    if (textEl) textEl.textContent = text || 'Complete';
  } else if (state === 'error') {
    if (indicator) indicator.classList.add('status-error');
    if (textEl) textEl.textContent = text || 'Failed';
  }
}

// STREAM EVENTS LOG TO TERMINAL WITH EXPLAIN OPTIONS
function logEntry(node, message, type = 'info') {
  const consoleEl = document.getElementById('terminal-console');
  if (!consoleEl) return;

  const now = new Date();
  const timeStr = `[${now.toTimeString().split(' ')[0]}]`;

  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;

  const uppercaseTag = node.toUpperCase();
  entry.innerHTML = `
    <span class="log-time">${timeStr}</span>
    <span class="log-tag tag-${node}">${uppercaseTag}</span>
    <span class="log-message">${message}</span>
  `;

  consoleEl.appendChild(entry);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// UPDATE telemetries and conditional button disables
function updateGitStateDOM() {
  const badgeUnstaged = document.getElementById('badge-unstaged');
  if (badgeUnstaged) badgeUnstaged.textContent = `${gitState.unstaged} files modified`;
  
  const badgeStaged = document.getElementById('badge-staged');
  if (badgeStaged) badgeStaged.textContent = `${gitState.staged} files staged`;
  
  const badgeCommitsMain = document.getElementById('badge-commits-main');
  if (badgeCommitsMain) badgeCommitsMain.textContent = `${gitState.localMainCommits} commits`;
  
  const badgeCommitsFeature = document.getElementById('badge-commits-feature');
  if (badgeCommitsFeature) badgeCommitsFeature.textContent = `${gitState.localFeatureCommits} commits`;
  
  const badgeCommitsRemote = document.getElementById('badge-commits-remote');
  if (badgeCommitsRemote) badgeCommitsRemote.textContent = `${gitState.remoteCommits} commits`;

  const metricActiveBranch = document.getElementById('metric-active-branch');
  if (metricActiveBranch) metricActiveBranch.textContent = gitState.activeBranch;
  
  const metricLocalCommits = document.getElementById('metric-local-commits');
  if (metricLocalCommits) metricLocalCommits.textContent = gitState.localMainCommits + gitState.localFeatureCommits;
  
  const metricStagedCount = document.getElementById('metric-staged-count');
  if (metricStagedCount) metricStagedCount.textContent = gitState.staged;

  // Cleanliness bar based on unstaged files
  const cleanVal = Math.max(0, 100 - (gitState.unstaged * 20));
  const healthValue = document.getElementById('health-value');
  if (healthValue) healthValue.textContent = `${cleanVal}%`;
  
  const healthFill = document.getElementById('health-fill');
  if (healthFill) {
    healthFill.style.width = `${cleanVal}%`;
    if (cleanVal > 80) {
      healthFill.style.background = 'var(--color-green)';
    } else if (cleanVal > 40) {
      healthFill.style.background = 'var(--color-yellow)';
    } else {
      healthFill.style.background = 'var(--color-red)';
    }
  }

  // Repository Sync Status Compare
  const syncStatusEl = document.getElementById('metric-sync-status');
  if (syncStatusEl) {
    if (gitState.localMainCommits > gitState.remoteCommits) {
      syncStatusEl.textContent = 'Ahead of origin/main';
      syncStatusEl.style.color = 'var(--color-cyan)';
    } else if (gitState.localMainCommits < gitState.remoteCommits) {
      syncStatusEl.textContent = 'Behind origin/main';
      syncStatusEl.style.color = 'var(--color-yellow)';
    } else {
      syncStatusEl.textContent = 'Synced';
      syncStatusEl.style.color = 'var(--color-green)';
    }
  }

  // Feature Branch Node display toggle
  const featureNode = document.getElementById('node-local-feature');
  if (featureNode) {
    if (gitState.isBranchCreated) {
      featureNode.classList.remove('branch-hidden');
      const statusText = featureNode.querySelector('.status-text');
      if (statusText) statusText.textContent = gitState.activeBranch === 'feature' ? 'Active Branch' : 'Standby Branch';
      const statusIndicator = featureNode.querySelector('.status-indicator');
      if (statusIndicator) statusIndicator.className = `status-indicator ${gitState.activeBranch === 'feature' ? 'status-active' : 'status-idle'}`;
    } else {
      featureNode.classList.add('branch-hidden');
      const statusText = featureNode.querySelector('.status-text');
      if (statusText) statusText.textContent = 'Inactive';
      const statusIndicator = featureNode.querySelector('.status-indicator');
      if (statusIndicator) statusIndicator.className = 'status-indicator status-idle';
    }
  }

  // Reinitialize icons in new tooltips if needed
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Update dynamic file lists inside cards
  updateFilesDOM();

  // Update dynamic button disables/enables
  updateButtonStates();
}

let enabledButtons = new Set();

function setButtonDisabled(btn, disabled) {
  if (!btn) return;
  if (!disabled) {
    enabledButtons.add(btn.id);
    btn.disabled = false;
  } else {
    if (enabledButtons.has(btn.id)) {
      btn.disabled = false;
    } else {
      btn.disabled = true;
    }
  }
}

// UPDATE ACTIVE AND ENABLED BUTTON STATES DYNAMICALLY
function updateButtonStates() {
  if (sandboxMode) return; // Ignore states in Sandbox Mode

  // git add button: enabled if there are unstaged changes
  const btnAdd = document.getElementById('btn-git-add');
  if (btnAdd) {
    setButtonDisabled(btnAdd, gitState.unstaged === 0);
  }

  // git commit button: enabled if there are staged changes
  const btnCommit = document.getElementById('btn-git-commit');
  if (btnCommit) {
    setButtonDisabled(btnCommit, gitState.staged === 0);
  }

  // git push button: enabled if local commits on main exceed remote commits
  const btnPush = document.getElementById('btn-git-push');
  if (btnPush) {
    setButtonDisabled(btnPush, gitState.localMainCommits <= gitState.remoteCommits || gitState.activeBranch !== 'main');
  }

  // git branch button: enabled if feature branch hasn't been created yet AND there are commits on main
  const btnBranch = document.getElementById('btn-git-branch');
  if (btnBranch) {
    setButtonDisabled(btnBranch, gitState.isBranchCreated || gitState.localMainCommits === 0);
  }

  // git pull button: enabled if there is at least one local commit and HEAD is pointing to main
  const btnPull = document.getElementById('btn-git-pull');
  if (btnPull) {
    setButtonDisabled(btnPull, gitState.localMainCommits === 0 || gitState.activeBranch !== 'main');
  }

  // git merge button: displayed if feature branch contains commits and HEAD is back on main
  const btnMerge = document.getElementById('btn-git-merge');
  if (btnMerge) {
    if (gitState.isBranchCreated && gitState.localFeatureCommits > 0 && gitState.activeBranch === 'main') {
      btnMerge.style.display = 'flex';
      setButtonDisabled(btnMerge, false);
    } else {
      btnMerge.style.display = 'none';
      setButtonDisabled(btnMerge, true);
    }
  }

  // git checkout main button: enabled if we are actively on the feature branch
  const btnCheckoutMain = document.getElementById('btn-git-checkout-main');
  if (btnCheckoutMain) {
    setButtonDisabled(btnCheckoutMain, gitState.activeBranch !== 'feature');
  }

  // Update card dimming focus styles
  updateCardDimming();
}

function updateCardDimming() {
  const dimmed = new Set();

  if (sandboxMode) {
    document.querySelectorAll('.architecture-node').forEach(n => n.classList.remove('node-dimmed'));
  } else {
    const nodes = ['work', 'stage', 'local-main', 'local-feature', 'remote'];
    nodes.forEach(nodeId => {
      const card = document.getElementById(`node-${nodeId}`);
      if (!card) return;

      const buttons = card.querySelectorAll('.node-action-btn');
      let hasEnabledButton = false;

      buttons.forEach(btn => {
        const isUnlocked = enabledButtons.has(btn.id);
        const isMerge = btn.id === 'btn-git-merge';
        const isMergeVisible = isMerge ? (btn.style.display === 'flex') : true;
        if (isUnlocked && isMergeVisible) hasEnabledButton = true;
      });

      if (hasEnabledButton) {
        card.classList.remove('node-dimmed');
      } else {
        card.classList.add('node-dimmed');
        dimmed.add(nodeId);
      }
    });
  }

  // Dim connection paths where either endpoint is inactive
  connections.forEach(conn => {
    const pathEl = document.getElementById(`path-${conn.from}-${conn.to}`);
    if (!pathEl) return;
    const shouldDim = dimmed.has(conn.from) || dimmed.has(conn.to);
    pathEl.classList.toggle('connection-dimmed', shouldDim);
  });
}

// DISABLE ALL ACTIONS DURING SIMULATION PROGRESS
function disableAllButtons(disabled) {
  const actionButtons = document.querySelectorAll('.node-action-btn');
  actionButtons.forEach(btn => {
    if (disabled) {
      btn.disabled = true;
    } else {
      updateButtonStates(); // restore dynamic states
    }
  });
}

// EVENT ACTION TRIGGERS (Embedded Node Click Interactions with Explanations)

async function handleActionGitAdd() {
  if (isSimulating) return;
  isSimulating = true;
  disableAllButtons(true);

  logEntry('command', 'git status', 'command');
  logEntry('explain', '💡 Literal Translation: Check which Local Project Files have been modified on your computer.', 'explain');

  // If workspace is clean, automatically generate modifications
  if (gitState.unstaged === 0) {
    gitState.unstaged = 3;
    updateGitStateDOM();
    setNodeState('work', 'error', 'Unstaged Changes');
    logEntry('work', 'Modified local files on disk (index.html, style.css, main.js)', 'work');
    await sleep(300);
  }

  logEntry('command', 'git add .', 'command');
  logEntry('explain', '💡 Literal Translation: Prepare the modified files on your computer to be saved. Adding them to the staging checklist.', 'explain');
  await sleep(80);

  // Trigger slide-out-right animation on files in Working Directory
  const workFiles = document.querySelectorAll('#files-list-work .file-item');
  workFiles.forEach((file, index) => {
    file.style.animationDelay = `${index * 80}ms`;
    file.classList.add('slide-out-right');
  });

  // Wait for slide-out transition
  await sleep(350 + workFiles.length * 80);

  // Dispatch stage packet
  await dispatchPacket('work', 'stage', 'packet-cyan');

  gitState.staged += gitState.unstaged;
  gitState.unstaged = 0;
  gitState.animateStageIn = true;
  updateGitStateDOM();

  setNodeState('work', 'idle', 'Clean');
  setNodeState('stage', 'success', 'staged');
  logEntry('stage', `Added files to Staging index. Staging list now tracks ${gitState.staged} prepared changes.`, 'stage');
  await sleep(500);

  setNodeState('stage', 'idle', 'Changes prepared');

  isSimulating = false;
  disableAllButtons(false);
}

async function handleActionGitCommit() {
  if (isSimulating || gitState.staged === 0) return;
  isSimulating = true;
  disableAllButtons(true);

  const commitMsg = gitState.activeBranch === 'feature' 
    ? 'feat: design divergent ui elements' 
    : 'chore: configure index assets';

  logEntry('command', `git commit -m "${commitMsg}"`, 'command');
  logEntry('explain', '💡 Literal Translation: Save a historical snapshot of your prepared checklist files into local memory on your computer.', 'explain');
  await sleep(80);

  // Trigger slide-out-right animation on files in Staging Area
  const stageFiles = document.querySelectorAll('#files-list-stage .file-item');
  stageFiles.forEach((file, index) => {
    file.style.animationDelay = `${index * 80}ms`;
    file.classList.add('slide-out-right');
  });

  // Wait for slide-out transition
  await sleep(350 + stageFiles.length * 80);

  const targetNode = gitState.activeBranch === 'feature' ? 'local-feature' : 'local-main';
  
  // Dispatch commit packet
  await dispatchPacket('stage', targetNode, 'packet-green');

  if (gitState.activeBranch === 'feature') {
    gitState.localFeatureCommits += Math.ceil(gitState.staged / 3);
  } else {
    gitState.localMainCommits += Math.ceil(gitState.staged / 3);
  }
  gitState.staged = 0;
  updateGitStateDOM();

  setNodeState('stage', 'idle', 'Empty');
  setNodeState(targetNode, 'success', 'Snapshot Saved');
  
  const targetTag = gitState.activeBranch === 'feature' ? 'feature' : 'local';
  logEntry(targetTag, `[Local History -> ${gitState.activeBranch}] Created commit snapshot in computer storage.`, 'local');
  await sleep(500);

  setNodeState(targetNode, 'idle');

  isSimulating = false;
  disableAllButtons(false);
}

async function handleActionGitPush() {
  if (isSimulating || gitState.localMainCommits <= gitState.remoteCommits) return;
  isSimulating = true;
  disableAllButtons(true);

  logEntry('command', 'git push origin main', 'command');
  logEntry('explain', '💡 Literal Translation: Upload your computer\'s saved local commit snapshots up to the online Cloud Storage (GitHub).', 'explain');
  await sleep(80);

  // Dispatch upload packet
  await dispatchPacket('local-main', 'remote', 'packet-orange');

  gitState.remoteCommits = gitState.localMainCommits;
  updateGitStateDOM();

  setNodeState('local-main', 'idle');
  setNodeState('remote', 'success', 'Uploaded');
  logEntry('remote', 'Upload complete. Cloud Storage copy (GitHub) is now fully updated and backed up.', 'remote');
  await sleep(500);

  setNodeState('remote', 'idle');

  isSimulating = false;
  disableAllButtons(false);
}

async function handleActionGitBranch() {
  if (isSimulating || gitState.isBranchCreated) return;
  isSimulating = true;
  disableAllButtons(true);

  logEntry('command', 'git checkout -b feature/ui', 'command');
  logEntry('explain', '💡 Literal Translation: Create and switch to a separate isolated draft timeline, letting you test files safely without breaking the main timeline.', 'explain');
  await sleep(80);

  // Spawn and switch active branch
  gitState.isBranchCreated = true;
  gitState.activeBranch = 'feature';
  
  // Create modification automatically to lead the user
  gitState.unstaged = 2;
  
  updateGitStateDOM();

  // Re-draw connections so feature path appears
  drawPaths();

  setNodeState('local-feature', 'success', 'Draft Active');
  logEntry('local', 'Isolated timeline "feature/ui" active. Main timeline history preserved.', 'local');
  logEntry('work', 'Modified 2 local files on your computer inside the new isolated branch workspace.', 'work');
  await sleep(500);

  isSimulating = false;
  disableAllButtons(false);
}

async function handleActionGitCheckoutMain() {
  if (isSimulating || gitState.activeBranch !== 'feature') return;
  isSimulating = true;
  disableAllButtons(true);

  logEntry('command', 'git checkout main', 'command');
  logEntry('explain', '💡 Literal Translation: Swap the active folder files on your computer back to the main timeline view.', 'explain');
  await sleep(80);

  gitState.activeBranch = 'main';
  updateGitStateDOM();

  setNodeState('local-main', 'success', 'Switched');
  logEntry('local', 'HEAD is back on the "main" branch. Isolated draft branch goes standby.', 'local');
  await sleep(500);

  setNodeState('local-main', 'idle');

  isSimulating = false;
  disableAllButtons(false);
}

async function handleActionGitMerge() {
  if (isSimulating || !gitState.isBranchCreated || gitState.localFeatureCommits === 0) return;
  isSimulating = true;
  disableAllButtons(true);

  logEntry('command', 'git merge feature/ui', 'command');
  logEntry('explain', '💡 Literal Translation: Combine the changes from your draft branch timeline back into your main timeline history.', 'explain');
  await sleep(80);

  // Animate merge packet
  await dispatchPacket('local-feature', 'local-main', 'packet-purple');

  gitState.localMainCommits += gitState.localFeatureCommits;
  gitState.localFeatureCommits = 0;
  gitState.isBranchCreated = false; // Merge resolves the branch pointer
  
  updateGitStateDOM();

  // Re-draw lines to hide feature paths
  drawPaths();

  setNodeState('local-main', 'success', 'Merged');
  logEntry('local', 'Fast-forward merge complete. Main local history timeline updated to include feature commits.', 'local');
  await sleep(500);

  setNodeState('local-main', 'idle');

  isSimulating = false;
  disableAllButtons(false);
}

async function handleActionGitPull() {
  if (isSimulating) return;
  isSimulating = true;
  disableAllButtons(true);

  logEntry('command', 'git pull origin main', 'command');
  logEntry('explain', '💡 Literal Translation: Download the latest updates from online Cloud Storage (GitHub) and apply them to your computer\'s local history and files.', 'explain');
  await sleep(80);

  // Simulate remote update if equal/behind
  if (gitState.remoteCommits <= gitState.localMainCommits) {
    logEntry('system', 'Cloud origin update: 1 new commit pushed by coworker', 'system');
    gitState.remoteCommits = gitState.localMainCommits + 1;
    updateGitStateDOM();
    await sleep(300);
  }

  // Pull commit packet from remote to local main
  await dispatchPacket('remote', 'local-main', 'packet-yellow');

  gitState.localMainCommits = gitState.remoteCommits;
  updateGitStateDOM();
  setNodeState('local-main', 'success', 'Pulled');
  logEntry('local', 'Downloaded commits. Forwarded main branch history HEAD pointer.', 'local');
  await sleep(300);

  // write updates to staging area (git commit card)
  await dispatchPacket('local-main', 'stage', 'packet-cyan');

  setNodeState('local-main', 'idle');
  setNodeState('stage', 'success', 'Changes Synchronized');
  logEntry('stage', 'Downloaded changes written to Staging Area index.', 'stage');
  await sleep(500);

  setNodeState('stage', 'idle', gitState.staged > 0 ? 'Changes prepared' : 'Empty');

  isSimulating = false;
  disableAllButtons(false);
}

// RESET WORKSPACE REPO STATE
function resetRepository() {
  enabledButtons.clear();
  gitState = {
    activeBranch: 'main',
    unstaged: 3,
    staged: 0,
    localMainCommits: 0,
    localFeatureCommits: 0,
    remoteCommits: 0,
    isBranchCreated: false,
    animateWorkIn: false,
    animateStageIn: false
  };

  // Reset Node classes
  const nodes = ['work', 'stage', 'local-main', 'local-feature', 'remote'];
  nodes.forEach(node => {
    setNodeState(node, 'idle');
  });

  updateGitStateDOM();
  drawPaths();

  const consoleEl = document.getElementById('terminal-console');
  if (consoleEl) consoleEl.innerHTML = '';
  logEntry('system', 'Repository cleared. Saved history and computer workspace files are clean.', 'system');
}

// SANDBOX MODE FLOW HANDLERS (Manual clicking transfers)
function toggleSandboxMode() {
  sandboxMode = !sandboxMode;
  const btn = document.getElementById('btn-sandbox-toggle');
  const banner = document.getElementById('sandbox-banner');
  const workspace = document.getElementById('canvas-workspace');

  isSimulating = false;
  clearSandboxSelections();

  if (sandboxMode) {
    if (btn) btn.classList.add('active');
    if (banner) banner.classList.add('visible');
    if (workspace) workspace.classList.add('sandbox-mode');
    
    // Disable all buttons manually
    document.querySelectorAll('.node-action-btn').forEach(b => b.disabled = true);
    
    logEntry('system', 'Sandbox mode enabled. Click nodes directly to trigger manual path flows.', 'system');
  } else {
    if (btn) btn.classList.remove('active');
    if (banner) banner.classList.remove('visible');
    if (workspace) workspace.classList.remove('sandbox-mode');
    
    updateGitStateDOM(); // Restore normal button disabled states
    logEntry('system', 'Sandbox mode disabled. Node buttons active.', 'system');
  }
  updateCardDimming();
}

function handleNodeClick(nodeId) {
  if (!sandboxMode) return;

  const nodeEl = document.getElementById(`node-${nodeId}`);

  // Select Source node
  if (!sandboxSourceNode) {
    if (nodeId === 'local-feature' && !gitState.isBranchCreated) {
      logEntry('system', 'Feature branch is uninitialized. Double-click branch button in main to start.', 'warning');
      return;
    }

    sandboxSourceNode = nodeId;
    nodeEl.classList.add('sandbox-source');

    const targets = getConnectedNodes(nodeId);
    targets.forEach(tgt => {
      const tgtEl = document.getElementById(`node-${tgt}`);
      if (tgtEl) tgtEl.classList.add('sandbox-target-option');
    });

    logEntry('system', `Selected source [${nodeId.toUpperCase()}]. Select a connecting target.`, 'system');
  } else {
    const targets = getConnectedNodes(sandboxSourceNode);

    if (targets.includes(nodeId)) {
      const from = sandboxSourceNode;
      const to = nodeId;

      handleSandboxTransfer(from, to);
      clearSandboxSelections();
    } else if (nodeId === sandboxSourceNode) {
      clearSandboxSelections();
      logEntry('system', 'Selection cleared.', 'system');
    } else {
      // Toggle directly to new source
      if (nodeId === 'local-feature' && !gitState.isBranchCreated) return;
      
      clearSandboxSelections();
      sandboxSourceNode = nodeId;
      nodeEl.classList.add('sandbox-source');

      const newTargets = getConnectedNodes(nodeId);
      newTargets.forEach(tgt => {
        const tgtEl = document.getElementById(`node-${tgt}`);
        if (tgtEl) tgtEl.classList.add('sandbox-target-option');
      });

      logEntry('system', `Source switched to [${nodeId.toUpperCase()}]. Select target.`, 'system');
    }
  }
}

async function handleSandboxTransfer(from, to) {
  // 1. git add: work -> stage
  if (from === 'work' && to === 'stage') {
    if (gitState.unstaged === 0) gitState.unstaged = 1;
    
    logEntry('command', 'git add .', 'command');
    logEntry('explain', '💡 Sandbox: Preparing local computer files for snapshot checklist.', 'explain');

    const workFiles = document.querySelectorAll('#files-list-work .file-item');
    workFiles.forEach((file, index) => {
      file.style.animationDelay = `${index * 80}ms`;
      file.classList.add('slide-out-right');
    });
    await sleep(350 + workFiles.length * 80);

    await dispatchPacket('work', 'stage', 'packet-cyan');
    
    gitState.staged += gitState.unstaged;
    gitState.unstaged = 0;
    gitState.animateStageIn = true;
    updateGitStateDOM();
    logEntry('stage', 'Sandbox: Changes staged.', 'stage');
  }
  // 2. git commit: stage -> local repo
  else if (from === 'stage' && (to === 'local-main' || to === 'local-feature')) {
    if (gitState.staged === 0) {
      logEntry('system', 'Staging checklist is empty. Modify local files first.', 'warning');
      return;
    }

    if (to === 'local-feature' && !gitState.isBranchCreated) {
      gitState.isBranchCreated = true;
      gitState.activeBranch = 'feature';
      drawPaths();
    }

    logEntry('command', 'git commit -m "sandbox"', 'command');
    logEntry('explain', '💡 Sandbox: Saving snapshot of checklist to Local history on computer.', 'explain');

    const stageFiles = document.querySelectorAll('#files-list-stage .file-item');
    stageFiles.forEach((file, index) => {
      file.style.animationDelay = `${index * 80}ms`;
      file.classList.add('slide-out-right');
    });
    await sleep(350 + stageFiles.length * 80);

    const color = to === 'local-feature' ? 'packet-purple' : 'packet-green';
    await dispatchPacket('stage', to, color);

    if (to === 'local-feature') {
      gitState.localFeatureCommits++;
    } else {
      gitState.localMainCommits++;
    }
    gitState.staged = 0;
    updateGitStateDOM();
    logEntry('local', 'Sandbox: Created commit snapshot.', 'local');
  }
  // 3. git push: local-main -> remote
  else if (from === 'local-main' && to === 'remote') {
    logEntry('command', 'git push origin main', 'command');
    logEntry('explain', '💡 Sandbox: Uploading local history snapshots to Cloud storage (GitHub).', 'explain');
    await dispatchPacket('local-main', 'remote', 'packet-orange');
    gitState.remoteCommits = gitState.localMainCommits;
    updateGitStateDOM();
    logEntry('remote', 'Sandbox: Cloud update complete.', 'remote');
  }
  // 4. git pull: remote -> local-main
  else if (from === 'remote' && to === 'local-main') {
    logEntry('command', 'git pull origin main', 'command');
    logEntry('explain', '💡 Sandbox: Downloading updates from Cloud storage and copying to computer local history.', 'explain');
    if (gitState.remoteCommits <= gitState.localMainCommits) {
      gitState.remoteCommits = gitState.localMainCommits + 1;
    }
    await dispatchPacket('remote', 'local-main', 'packet-yellow');
    gitState.localMainCommits = gitState.remoteCommits;
    updateGitStateDOM();
    logEntry('local', 'Sandbox: Fast-forward completed.', 'local');
  }
  // 5. git merge: feature -> local-main
  else if (from === 'local-feature' && to === 'local-main') {
    logEntry('command', 'git merge feature', 'command');
    logEntry('explain', '💡 Sandbox: Combining isolated drafts back into main history timeline.', 'explain');
    await dispatchPacket('local-feature', 'local-main', 'packet-purple');
    gitState.localMainCommits += gitState.localFeatureCommits;
    gitState.localFeatureCommits = 0;
    gitState.isBranchCreated = false;
    updateGitStateDOM();
    drawPaths();
    logEntry('local', 'Sandbox: Merged draft history into main.', 'local');
  }
  // 6. Restore: stage -> work
  else if (from === 'stage' && to === 'work') {
    logEntry('command', 'git restore --staged .', 'command');
    logEntry('explain', '💡 Sandbox: Resetting staged changes back to unstaged computer files.', 'explain');

    const stageFiles = document.querySelectorAll('#files-list-stage .file-item');
    stageFiles.forEach((file, index) => {
      file.style.animationDelay = `${index * 80}ms`;
      file.classList.add('slide-out-left');
    });
    await sleep(350 + stageFiles.length * 80);

    await dispatchPacket('stage', 'work', 'packet-red');
    gitState.unstaged += gitState.staged;
    gitState.staged = 0;
    gitState.animateWorkIn = true;
    updateGitStateDOM();
    logEntry('work', 'Sandbox: Reset staged changes back to working directory.', 'work');
  }
}

function getConnectedNodes(nodeId) {
  const targets = [];
  connections.forEach(conn => {
    if ((conn.from === 'local-feature' || conn.to === 'local-feature') && !gitState.isBranchCreated) {
      return;
    }

    if (conn.from === nodeId) {
      targets.push(conn.to);
    } else if (conn.to === nodeId && conn.bidirectional) {
      targets.push(conn.from);
    }
  });
  return targets;
}

function clearSandboxSelections() {
  sandboxSourceNode = null;
  const nodes = document.querySelectorAll('.architecture-node');
  nodes.forEach(n => {
    n.classList.remove('sandbox-source');
    n.classList.remove('sandbox-target-option');
  });
}

// BIND EMBEDDED BUTTON INTERACTION TRIGGERS
function setupNodeActionsListeners() {
  document.getElementById('btn-git-add').addEventListener('click', (e) => {
    e.stopPropagation();
    handleActionGitAdd();
  });

  document.getElementById('btn-git-commit').addEventListener('click', (e) => {
    e.stopPropagation();
    handleActionGitCommit();
  });

  document.getElementById('btn-git-push').addEventListener('click', (e) => {
    e.stopPropagation();
    handleActionGitPush();
  });

  document.getElementById('btn-git-branch').addEventListener('click', (e) => {
    e.stopPropagation();
    handleActionGitBranch();
  });

  document.getElementById('btn-git-checkout-main').addEventListener('click', (e) => {
    e.stopPropagation();
    handleActionGitCheckoutMain();
  });

  document.getElementById('btn-git-merge').addEventListener('click', (e) => {
    e.stopPropagation();
    handleActionGitMerge();
  });

  document.getElementById('btn-git-pull').addEventListener('click', (e) => {
    e.stopPropagation();
    handleActionGitPull();
  });
}

// BIND HEADER AND MISC EVENTS
function setupUIEventListeners() {
  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      resetRepository();
    });
  }

  const btnSandboxToggle = document.getElementById('btn-sandbox-toggle');
  if (btnSandboxToggle) {
    btnSandboxToggle.addEventListener('click', () => {
      toggleSandboxMode();
    });
  }

  const btnClearLogs = document.getElementById('btn-clear-logs');
  if (btnClearLogs) {
    btnClearLogs.addEventListener('click', () => {
      const consoleEl = document.getElementById('terminal-console');
      if (consoleEl) {
        consoleEl.innerHTML = '';
        logEntry('system', 'Logs cleared.', 'system');
      }
    });
  }

  // Bind node click listener for sandbox mode
  const nodes = document.querySelectorAll('.architecture-node');
  nodes.forEach(n => {
    n.addEventListener('click', () => {
      const nodeId = n.dataset.node;
      handleNodeClick(nodeId);
    });
  });
}

function updateFilesDOM() {
  const listWork = document.getElementById('files-list-work');
  const listStage = document.getElementById('files-list-stage');
  
  if (listWork) {
    if (gitState.unstaged > 0) {
      const animateClass = gitState.animateWorkIn ? ' slide-in-right' : '';
      listWork.innerHTML = `
        <div class="file-item html-theme${animateClass}" style="animation-delay: 0ms;">
          <span class="file-name">index.html</span>
          <span class="file-ext">.html</span>
        </div>
        <div class="file-item css-theme${animateClass}" style="animation-delay: 80ms;">
          <span class="file-name">style.css</span>
          <span class="file-ext">.css</span>
        </div>
        <div class="file-item js-theme${animateClass}" style="animation-delay: 160ms;">
          <span class="file-name">main.js</span>
          <span class="file-ext">.js</span>
        </div>
      `;
      gitState.animateWorkIn = false;
    } else {
      listWork.innerHTML = `
        <div class="files-empty-state">
          <i data-lucide="check-circle" class="clean-icon"></i>
          <span>Workspace clean</span>
        </div>
      `;
    }
  }
  
  if (listStage) {
    if (gitState.staged > 0) {
      const animateClass = gitState.animateStageIn ? ' slide-in-left' : '';
      listStage.innerHTML = `
        <div class="file-item html-theme${animateClass}" style="animation-delay: 0ms;">
          <span class="file-name">index.html</span>
          <span class="file-ext">.html</span>
        </div>
        <div class="file-item css-theme${animateClass}" style="animation-delay: 80ms;">
          <span class="file-name">style.css</span>
          <span class="file-ext">.css</span>
        </div>
        <div class="file-item js-theme${animateClass}" style="animation-delay: 160ms;">
          <span class="file-name">main.js</span>
          <span class="file-ext">.js</span>
        </div>
      `;
      gitState.animateStageIn = false;
    } else {
      listStage.innerHTML = `
        <div class="files-empty-state">
          <span>Staging index empty</span>
        </div>
      `;
    }
  }
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}
