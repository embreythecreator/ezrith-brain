import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'

// Which translucency the OS can back. Asked synchronously because the renderer
// needs it before its first paint, and answered by main because deciding it
// needs `os.release()` — a sandboxed preload may only require electron, events,
// timers and url, so importing node:os here throws before contextBridge runs
// and takes the ENTIRE bridge down with it (window.ezrithDesktop undefined =>
// "Desktop IPC bridge is unavailable"). No reply means no glass, which degrades
// to an ordinary opaque window rather than a page thinned over nothing.
const translucencySupport = ipcRenderer.sendSync('ezrith:translucency:support')
const hudWindowing = ipcRenderer.sendSync('ezrith:hud:windowing')
const hudNativeDrag = hudWindowing?.nativeDrag === true

contextBridge.exposeInMainWorld('ezrithDesktop', {
  glassSupported: translucencySupport?.glass === true,
  translucencySupported: translucencySupport?.translucency === true,
  getConnection: profile => ipcRenderer.invoke('ezrith:connection', profile),
  // Registry-scoped backend resolution: { connectionId, profile } → descriptor.
  getConnectionFor: payload => ipcRenderer.invoke('ezrith:connection:for', payload),
  getProfileRoutes: profiles => ipcRenderer.invoke('ezrith:plugin-profile-routes', profiles),
  revalidateConnection: () => ipcRenderer.invoke('ezrith:connection:revalidate'),
  touchBackend: profile => ipcRenderer.invoke('ezrith:backend:touch', profile),
  getGatewayWsUrl: profile => ipcRenderer.invoke('ezrith:gateway:ws-url', profile),
  // Registry-scoped fresh WS URL: { connectionId, profile } → result shape of
  // getGatewayWsUrl, minted against that connection's backend.
  getGatewayWsUrlFor: payload => ipcRenderer.invoke('ezrith:gateway:ws-url-for', payload),
  // Union agent roster across every registered connection.
  getAgentRoster: () => ipcRenderer.invoke('ezrith:agents:roster'),
  openSessionWindow: (sessionId, opts) => ipcRenderer.invoke('ezrith:window:openSession', sessionId, opts),
  openSessionInTerminal: (sessionId, opts) => ipcRenderer.invoke('ezrith:window:openInTerminal', sessionId, opts),
  openWindow: () => ipcRenderer.invoke('ezrith:window:openInstance'),
  openBrowserWindow: tabId => ipcRenderer.invoke('ezrith:window:openBrowser', tabId),
  onBrowserPopoutClosed: callback => {
    const listener = (_event, tabId) => callback(tabId)
    ipcRenderer.on('ezrith:browser-popout:closed', listener)

    return () => ipcRenderer.removeListener('ezrith:browser-popout:closed', listener)
  },
  claimAmbientCue: key => ipcRenderer.invoke('ezrith:ambient:claim', key),
  wakeIndicator: {
    getState: () => ipcRenderer.invoke('ezrith:wake-indicator:get'),
    setState: state => ipcRenderer.send('ezrith:wake-indicator:set', state),
    onState: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('ezrith:wake-indicator:state', listener)

      return () => ipcRenderer.removeListener('ezrith:wake-indicator:state', listener)
    }
  },
  petOverlay: {
    // Main renderer → main process: window lifecycle + drag. `request` is
    // `{ bounds, screen }`; resolves with the screen bounds it actually used.
    open: request => ipcRenderer.invoke('ezrith:pet-overlay:open', request),
    close: () => ipcRenderer.invoke('ezrith:pet-overlay:close'),
    setBounds: bounds => ipcRenderer.send('ezrith:pet-overlay:set-bounds', bounds),
    setIgnoreMouse: ignore => ipcRenderer.send('ezrith:pet-overlay:ignore-mouse', ignore),
    // Flip the overlay focusable (and focus it) while the composer needs keys.
    setFocusable: focusable => ipcRenderer.send('ezrith:pet-overlay:set-focusable', focusable),
    // Main renderer → overlay (forwarded by main): push the latest pet state.
    pushState: payload => ipcRenderer.send('ezrith:pet-overlay:state', payload),
    // Overlay → main renderer (forwarded by main): pop back in / composer submit.
    control: payload => ipcRenderer.send('ezrith:pet-overlay:control', payload),
    // Overlay subscribes to state pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ezrith:pet-overlay:state', listener)

      return () => ipcRenderer.removeListener('ezrith:pet-overlay:state', listener)
    },
    // Main renderer subscribes to overlay control messages.
    onControl: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ezrith:pet-overlay:control', listener)

      return () => ipcRenderer.removeListener('ezrith:pet-overlay:control', listener)
    }
  },
  // HUD mode: the chrome-free floating chat. A full app renderer (own gateway)
  // sized as a floating bar, so it mounts the real composer. Main owns the
  // window; `onChanged` keeps every window's toggle truthful.
  hud: {
    nativeDrag: hudNativeDrag,
    windowing: {
      clientPlacement: hudWindowing?.clientPlacement !== false,
      controlDrag: hudWindowing?.controlDrag === true,
      nativeDrag: hudNativeDrag,
      solid: hudWindowing?.solid === true,
      workspaceTransfer: hudWindowing?.workspaceTransfer === true
    },
    open: request => ipcRenderer.invoke('ezrith:hud:open', request),
    close: () => ipcRenderer.invoke('ezrith:hud:close'),
    setIgnoreMouse: ignore => ipcRenderer.send('ezrith:hud:ignore-mouse', ignore),
    beginMove: () => ipcRenderer.send('ezrith:hud:begin-move'),
    endMove: () => ipcRenderer.send('ezrith:hud:end-move'),
    moveBy: delta => ipcRenderer.send('ezrith:hud:move-by', delta),
    setWorkspaceTransfer: transferring => ipcRenderer.send('ezrith:hud:workspace-transfer', transferring),
    setBounds: bounds => ipcRenderer.send('ezrith:hud:set-bounds', bounds),
    resetLayout: () => ipcRenderer.invoke('ezrith:hud:reset-layout'),
    // Whether the band covers the window below the bar. Main pairs it with the
    // user's translucency setting to decide the native frost (macOS vibrancy /
    // Windows 11 DWM backdrop) — see hudFrostFor.
    setFrost: showing => ipcRenderer.invoke('ezrith:hud:frost', showing),
    // The HUD tells main which session it is on; main hands that back to the
    // app window when the HUD closes, so the app can re-home onto it.
    setSession: sessionId => ipcRenderer.send('ezrith:hud:session', sessionId),
    onGoto: callback => {
      const listener = (_event, sessionId) => callback(sessionId)
      ipcRenderer.on('ezrith:hud:goto', listener)

      return () => ipcRenderer.removeListener('ezrith:hud:goto', listener)
    },
    onChanged: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('ezrith:hud:changed', listener)

      return () => ipcRenderer.removeListener('ezrith:hud:changed', listener)
    },
    // Linux only, and silent elsewhere: where the cursor is, in page
    // coordinates, or null when it has left the window. Stands in for the
    // mousemove that `setIgnoreMouseEvents(true, { forward: true })` delivers on
    // macOS and Windows but not here.
    onCursor: callback => {
      const listener = (_event, point) => callback(point)
      ipcRenderer.on('ezrith:hud:cursor', listener)

      return () => ipcRenderer.removeListener('ezrith:hud:cursor', listener)
    },
    // Main's game-overlay watch: whether a fullscreen app (a game) is under
    // the HUD, so the renderer can step back to the low-opacity overlay
    // treatment while one owns the screen.
    onGameOverlay: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('ezrith:hud:game-overlay', listener)

      return () => ipcRenderer.removeListener('ezrith:hud:game-overlay', listener)
    }
  },
  // Quick Entry: the global-hotkey mini composer window. Main owns the OS
  // shortcut + the persisted preference; the quick window only captures text
  // and hands it back, and the primary renderer submits it through the normal
  // prompt path.
  quickEntry: {
    getSettings: () => ipcRenderer.invoke('ezrith:quick-entry:settings:get'),
    setSettings: patch => ipcRenderer.invoke('ezrith:quick-entry:settings:set', patch),
    submit: payload => ipcRenderer.send('ezrith:quick-entry:submit', payload),
    dismiss: () => ipcRenderer.send('ezrith:quick-entry:dismiss'),
    // Primary renderer → main → quick window: gateway connection state + the
    // recent-session options the target picker offers. Main caches the latest
    // payload so a freshly spawned quick window starts from truth.
    pushState: payload => ipcRenderer.send('ezrith:quick-entry:state', payload),
    // Quick window subscribes to those pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ezrith:quick-entry:state', listener)

      return () => ipcRenderer.removeListener('ezrith:quick-entry:state', listener)
    },
    // Main → primary renderer: a submit captured by the quick window.
    onSubmit: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ezrith:quick-entry:submit', listener)

      return () => ipcRenderer.removeListener('ezrith:quick-entry:submit', listener)
    },
    // Main → quick window: you were just summoned (reset draft + refocus).
    onShown: callback => {
      const listener = () => callback()
      ipcRenderer.on('ezrith:quick-entry:shown', listener)

      return () => ipcRenderer.removeListener('ezrith:quick-entry:shown', listener)
    }
  },
  getBootProgress: () => ipcRenderer.invoke('ezrith:boot-progress:get'),
  getConnectionConfig: profile => ipcRenderer.invoke('ezrith:connection-config:get', profile),
  saveConnectionConfig: payload => ipcRenderer.invoke('ezrith:connection-config:save', payload),
  applyConnectionConfig: payload => ipcRenderer.invoke('ezrith:connection-config:apply', payload),
  testConnectionConfig: payload => ipcRenderer.invoke('ezrith:connection-config:test', payload),
  // Opt-in OS-keychain encryption for stored gateway secrets (default off —
  // see secret-storage-policy.ts). get never touches the OS keychain.
  getSecretStorageEncryption: () => ipcRenderer.invoke('ezrith:secret-storage:get'),
  setSecretStorageEncryption: (on: boolean) => ipcRenderer.invoke('ezrith:secret-storage:set', on),
  // v2 multi-connection registry: named agent sources (local / remote / cloud / ssh).
  connections: {
    list: () => ipcRenderer.invoke('ezrith:connections:list'),
    save: payload => ipcRenderer.invoke('ezrith:connections:save', payload),
    remove: id => ipcRenderer.invoke('ezrith:connections:remove', id),
    setPrimary: id => ipcRenderer.invoke('ezrith:connections:set-primary', id),
    setLaunchMode: mode => ipcRenderer.invoke('ezrith:connections:set-launch-mode', mode),
    setLastUsed: id => ipcRenderer.invoke('ezrith:connections:set-last-used', id),
    test: id => ipcRenderer.invoke('ezrith:connections:test', id),
    updateManaged: id => ipcRenderer.invoke('ezrith:connections:update-managed', id),
    // Fan out `ezrith update` to every eligible registered connection.
    // Optional excludeIds skips rows the caller updates through another path.
    updateAll: options => ipcRenderer.invoke('ezrith:connections:update-all', options),
    // Registry lifecycle push (main → renderer): a connection was removed or
    // materially edited, so secondaries scoped to it must be disposed (and,
    // for edits, re-dialed at the new target).
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ezrith:connections:changed', listener)

      return () => ipcRenderer.removeListener('ezrith:connections:changed', listener)
    }
  },
  sshConfigHosts: () => ipcRenderer.invoke('ezrith:ssh-config:hosts'),
  sshResolveHost: host => ipcRenderer.invoke('ezrith:ssh-config:resolve', host),
  probeConnectionConfig: remoteUrl => ipcRenderer.invoke('ezrith:connection-config:probe', remoteUrl),
  oauthLoginConnectionConfig: remoteUrl => ipcRenderer.invoke('ezrith:connection-config:oauth-login', remoteUrl),
  oauthLogoutConnectionConfig: remoteUrl => ipcRenderer.invoke('ezrith:connection-config:oauth-logout', remoteUrl),
  // Ezrith Cloud: one portal login powers discovery + silent per-agent sign-in
  // (cloud-auto-discovery Phase 3).
  cloud: {
    status: () => ipcRenderer.invoke('ezrith:cloud:status'),
    login: () => ipcRenderer.invoke('ezrith:cloud:login'),
    logout: () => ipcRenderer.invoke('ezrith:cloud:logout'),
    discover: org => ipcRenderer.invoke('ezrith:cloud:discover', org),
    agentSignIn: dashboardUrl => ipcRenderer.invoke('ezrith:cloud:agent-sign-in', dashboardUrl)
  },
  profile: {
    get: () => ipcRenderer.invoke('ezrith:profile:get'),
    remember: name => ipcRenderer.invoke('ezrith:profile:remember', name),
    set: name => ipcRenderer.invoke('ezrith:profile:set', name)
  },
  api: request => ipcRenderer.invoke('ezrith:api', request),
  notify: payload => ipcRenderer.invoke('ezrith:notify', payload),
  requestMicrophoneAccess: () => ipcRenderer.invoke('ezrith:requestMicrophoneAccess'),
  readWindowBelow: () => ipcRenderer.invoke('ezrith:window:readBelow'),
  readFileDataUrl: filePath => ipcRenderer.invoke('ezrith:readFileDataUrl', filePath),
  readFileDataUrlForAttach: filePath => ipcRenderer.invoke('ezrith:readFileDataUrlForAttach', filePath),
  dataUrlReadMax: {
    get: () => ipcRenderer.invoke('ezrith:data-url-read-max:get'),
    set: maxMb => ipcRenderer.invoke('ezrith:data-url-read-max:set', maxMb)
  },
  readFileText: filePath => ipcRenderer.invoke('ezrith:readFileText', filePath),
  readPluginSource: (filePath: string) => ipcRenderer.invoke('ezrith:readPluginSource', filePath),
  selectPaths: options => ipcRenderer.invoke('ezrith:selectPaths', options),
  selectSavePath: options => ipcRenderer.invoke('ezrith:selectSavePath', options),
  writeClipboard: text => ipcRenderer.invoke('ezrith:writeClipboard', text),
  readClipboard: () => ipcRenderer.invoke('ezrith:readClipboard'),
  saveGatewayFile: payload => ipcRenderer.invoke('ezrith:saveGatewayFile', payload),
  saveImageFromUrl: url => ipcRenderer.invoke('ezrith:saveImageFromUrl', url),
  contextMenuEdit: command => ipcRenderer.invoke('ezrith:context-menu:edit', command),
  contextMenuCopyImage: () => ipcRenderer.invoke('ezrith:context-menu:copy-image'),
  contextMenuSpellcheck: action => ipcRenderer.invoke('ezrith:context-menu:spellcheck', action),
  contextMenuGuestAddWord: payload => ipcRenderer.invoke('ezrith:context-menu:guest-add-word', payload),
  onContextMenuSpellcheck: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ezrith:context-menu-spellcheck', listener)

    return () => ipcRenderer.removeListener('ezrith:context-menu-spellcheck', listener)
  },
  saveImageBuffer: (data, ext) => ipcRenderer.invoke('ezrith:saveImageBuffer', { data, ext }),
  saveClipboardImage: () => ipcRenderer.invoke('ezrith:saveClipboardImage'),
  getPathForFile: file => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  normalizePreviewTarget: (target, baseDir) => ipcRenderer.invoke('ezrith:normalizePreviewTarget', target, baseDir),
  watchPreviewFile: url => ipcRenderer.invoke('ezrith:watchPreviewFile', url),
  watchDirectory: dir => ipcRenderer.invoke('ezrith:watchDirectory', dir),
  stopPreviewFileWatch: id => ipcRenderer.invoke('ezrith:stopPreviewFileWatch', id),
  setActiveWork: payload => ipcRenderer.send('ezrith:active-work', payload),
  setTitleBarTheme: payload => ipcRenderer.send('ezrith:titlebar-theme', payload),
  setNativeTheme: mode => ipcRenderer.send('ezrith:native-theme', mode),
  setTranslucency: payload => ipcRenderer.send('ezrith:translucency', payload),
  setKeepAwake: on => ipcRenderer.send('ezrith:keep-awake', on),
  setDisableF12: blocked => ipcRenderer.send('ezrith:devtools:disable-f12', blocked),
  setPreviewShortcutActive: active => ipcRenderer.send('ezrith:previewShortcutActive', Boolean(active)),
  openExternal: url => ipcRenderer.invoke('ezrith:openExternal', url),
  mcpOauth: {
    // One-shot loopback listener for MCP OAuth against remote backends: bind
    // on this machine, hand redirectUri to mcp.servers.oauth.start, then wait
    // for the provider redirect and relay code/state via oauth.callback.
    listen: () => ipcRenderer.invoke('ezrith:mcp-oauth:listen'),
    wait: (id, timeoutMs) => ipcRenderer.invoke('ezrith:mcp-oauth:wait', id, timeoutMs),
    cancel: id => ipcRenderer.invoke('ezrith:mcp-oauth:cancel', id)
  },
  openPreviewInBrowser: url => ipcRenderer.invoke('ezrith:openPreviewInBrowser', url),
  reachPreviewUrl: url => ipcRenderer.invoke('ezrith:preview:reach', url),
  setActiveConnectionRoute: route => ipcRenderer.send('ezrith:connection:active-route', route),
  fetchLinkTitle: url => ipcRenderer.invoke('ezrith:fetchLinkTitle', url),
  resolveFavicon: url => ipcRenderer.invoke('ezrith:resolveFavicon', url),
  sanitizeWorkspaceCwd: cwd => ipcRenderer.invoke('ezrith:workspace:sanitize', cwd),
  settings: {
    getDefaultProjectDir: () => ipcRenderer.invoke('ezrith:setting:defaultProjectDir:get'),
    setDefaultProjectDir: dir => ipcRenderer.invoke('ezrith:setting:defaultProjectDir:set', dir),
    pickDefaultProjectDir: () => ipcRenderer.invoke('ezrith:setting:defaultProjectDir:pick')
  },
  zoom: {
    // Current zoom of this window, as { level, percent }.
    get: () => ipcRenderer.invoke('ezrith:zoom:get'),
    // Synchronous zoom factor (1 = 100%). Coordinate math needs it in the
    // same tick as the event it converts, so no IPC round-trip here.
    factor: () => webFrame.getZoomFactor(),
    setPercent: percent => ipcRenderer.send('ezrith:zoom:set-percent', percent),
    // Fires on every zoom change, including the Ctrl/Cmd +/-/0 shortcuts,
    // so the settings UI can stay in sync with the keyboard.
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ezrith:zoom:changed', listener)

      return () => ipcRenderer.removeListener('ezrith:zoom:changed', listener)
    }
  },
  revealLogs: () => ipcRenderer.invoke('ezrith:logs:reveal'),
  getRecentLogs: () => ipcRenderer.invoke('ezrith:logs:recent'),
  // Fire-and-forget: persists a renderer error-boundary catch (with component
  // stack) to desktop.log so crashes survive the window (#79428).
  reportRendererError: report => ipcRenderer.send('ezrith:logs:renderer-error', report),
  readDir: dirPath => ipcRenderer.invoke('ezrith:fs:readDir', dirPath),
  gitRoot: startPath => ipcRenderer.invoke('ezrith:fs:gitRoot', startPath),
  revealPath: targetPath => ipcRenderer.invoke('ezrith:fs:reveal', targetPath),
  openDir: dirPath => ipcRenderer.invoke('ezrith:fs:openDir', dirPath),
  desktopPluginsRoot: () => ipcRenderer.invoke('ezrith:fs:desktopPluginsRoot'),
  logsRoot: () => ipcRenderer.invoke('ezrith:fs:logsRoot'),
  agentPluginsRoot: () => ipcRenderer.invoke('ezrith:fs:agentPluginsRoot'),
  renamePath: (targetPath, newName) => ipcRenderer.invoke('ezrith:fs:rename', targetPath, newName),
  writeTextFile: (filePath, content) => ipcRenderer.invoke('ezrith:fs:writeText', filePath, content),
  trashPath: targetPath => ipcRenderer.invoke('ezrith:fs:trash', targetPath),
  git: {
    worktreeList: repoPath => ipcRenderer.invoke('ezrith:git:worktreeList', repoPath),
    worktreeAdd: (repoPath, options) => ipcRenderer.invoke('ezrith:git:worktreeAdd', repoPath, options),
    worktreeRemove: (repoPath, worktreePath, options) =>
      ipcRenderer.invoke('ezrith:git:worktreeRemove', repoPath, worktreePath, options),
    branchSwitch: (repoPath, branch) => ipcRenderer.invoke('ezrith:git:branchSwitch', repoPath, branch),
    branchList: repoPath => ipcRenderer.invoke('ezrith:git:branchList', repoPath),
    baseBranchList: repoPath => ipcRenderer.invoke('ezrith:git:baseBranchList', repoPath),
    repoStatus: repoPath => ipcRenderer.invoke('ezrith:git:repoStatus', repoPath),
    fileDiff: (repoPath, filePath) => ipcRenderer.invoke('ezrith:git:fileDiff', repoPath, filePath),
    scanRepos: (roots, options) => ipcRenderer.invoke('ezrith:git:scanRepos', roots, options),
    review: {
      list: (repoPath, scope, baseRef) => ipcRenderer.invoke('ezrith:git:review:list', repoPath, scope, baseRef),
      diff: (repoPath, filePath, scope, baseRef, staged) =>
        ipcRenderer.invoke('ezrith:git:review:diff', repoPath, filePath, scope, baseRef, staged),
      stage: (repoPath, filePath) => ipcRenderer.invoke('ezrith:git:review:stage', repoPath, filePath),
      unstage: (repoPath, filePath) => ipcRenderer.invoke('ezrith:git:review:unstage', repoPath, filePath),
      revert: (repoPath, filePath) => ipcRenderer.invoke('ezrith:git:review:revert', repoPath, filePath),
      revParse: (repoPath, ref) => ipcRenderer.invoke('ezrith:git:review:revParse', repoPath, ref),
      commit: (repoPath, message, push) => ipcRenderer.invoke('ezrith:git:review:commit', repoPath, message, push),
      commitContext: repoPath => ipcRenderer.invoke('ezrith:git:review:commitContext', repoPath),
      push: repoPath => ipcRenderer.invoke('ezrith:git:review:push', repoPath),
      shipInfo: repoPath => ipcRenderer.invoke('ezrith:git:review:shipInfo', repoPath),
      prList: (repoPath, branches, numbers) =>
        ipcRenderer.invoke('ezrith:git:review:prList', repoPath, branches, numbers),
      fetchPrComment: (repoPath, url) => ipcRenderer.invoke('ezrith:git:review:fetchPrComment', repoPath, url),
      createPr: repoPath => ipcRenderer.invoke('ezrith:git:review:createPr', repoPath)
    }
  },
  terminal: {
    cwd: id => ipcRenderer.invoke('ezrith:terminal:cwd', id),
    dispose: id => ipcRenderer.invoke('ezrith:terminal:dispose', id),
    resize: (id, size) => ipcRenderer.invoke('ezrith:terminal:resize', id, size),
    start: options => ipcRenderer.invoke('ezrith:terminal:start', options),
    write: (id, data) => ipcRenderer.invoke('ezrith:terminal:write', id, data),
    onData: (id, callback) => {
      const channel = `ezrith:terminal:${id}:data`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (id, callback) => {
      const channel = `ezrith:terminal:${id}:exit`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  onClosePreviewRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('ezrith:close-preview-requested', listener)

    return () => ipcRenderer.removeListener('ezrith:close-preview-requested', listener)
  },
  onPreviewNav: callback => {
    const listener = (_event, command) => callback(command)
    ipcRenderer.on('ezrith:preview-nav', listener)

    return () => ipcRenderer.removeListener('ezrith:preview-nav', listener)
  },
  onOpenFolderRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('ezrith:open-folder-requested', listener)

    return () => ipcRenderer.removeListener('ezrith:open-folder-requested', listener)
  },
  onOpenUpdatesRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('ezrith:open-updates', listener)

    return () => ipcRenderer.removeListener('ezrith:open-updates', listener)
  },
  onDeepLink: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ezrith:deep-link', listener)

    return () => ipcRenderer.removeListener('ezrith:deep-link', listener)
  },
  signalDeepLinkReady: () => ipcRenderer.invoke('ezrith:deep-link-ready'),
  probePluginRepo: payload => ipcRenderer.invoke('ezrith:plugin:probe', payload),
  installDesktopPlugin: payload => ipcRenderer.invoke('ezrith:plugin:installDesktop', payload),
  onWindowStateChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ezrith:window-state-changed', listener)

    return () => ipcRenderer.removeListener('ezrith:window-state-changed', listener)
  },
  onFocusSession: callback => {
    const listener = (_event, sessionId) => callback(sessionId)
    ipcRenderer.on('ezrith:focus-session', listener)

    return () => ipcRenderer.removeListener('ezrith:focus-session', listener)
  },
  onNotificationAction: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ezrith:notification-action', listener)

    return () => ipcRenderer.removeListener('ezrith:notification-action', listener)
  },
  onNotificationActivate: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ezrith:notification-activate', listener)

    return () => ipcRenderer.removeListener('ezrith:notification-activate', listener)
  },
  onPreviewFileChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ezrith:preview-file-changed', listener)

    return () => ipcRenderer.removeListener('ezrith:preview-file-changed', listener)
  },
  onBackendExit: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ezrith:backend-exit', listener)

    return () => ipcRenderer.removeListener('ezrith:backend-exit', listener)
  },
  // Soft gateway-mode apply finished tearing down the primary backend. Renderer
  // should wipe session lists + re-dial without a window reload.
  onConnectionApplied: callback => {
    const listener = () => callback()
    ipcRenderer.on('ezrith:connection:applied', listener)

    return () => ipcRenderer.removeListener('ezrith:connection:applied', listener)
  },
  onPowerResume: callback => {
    const listener = () => callback()
    ipcRenderer.on('ezrith:power-resume', listener)

    return () => ipcRenderer.removeListener('ezrith:power-resume', listener)
  },
  // AC ↔ battery transitions; renderers slow their backstop polls on battery.
  getOnBattery: () => ipcRenderer.invoke('ezrith:power-battery:get'),
  onBatteryChanged: callback => {
    const listener = (_event, onBattery) => callback(Boolean(onBattery))
    ipcRenderer.on('ezrith:power-battery', listener)

    return () => ipcRenderer.removeListener('ezrith:power-battery', listener)
  },
  onBootProgress: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ezrith:boot-progress', listener)

    return () => ipcRenderer.removeListener('ezrith:boot-progress', listener)
  },
  // First-launch bootstrap progress -- emitted by the install.ps1 stage
  // runner in main.ts (apps/desktop/electron/bootstrap-runner.ts).
  // Renderer's install overlay subscribes to live events and queries the
  // current snapshot via getBootstrapState() to recover after a devtools
  // reload mid-bootstrap.
  getBootstrapState: () => ipcRenderer.invoke('ezrith:bootstrap:get'),
  continueBootstrapLocal: () => ipcRenderer.invoke('ezrith:bootstrap:continue-local'),
  resetBootstrap: () => ipcRenderer.invoke('ezrith:bootstrap:reset'),
  repairBootstrap: () => ipcRenderer.invoke('ezrith:bootstrap:repair'),
  cancelBootstrap: () => ipcRenderer.invoke('ezrith:bootstrap:cancel'),
  onBootstrapEvent: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ezrith:bootstrap:event', listener)

    return () => ipcRenderer.removeListener('ezrith:bootstrap:event', listener)
  },
  getVersion: () => ipcRenderer.invoke('ezrith:version'),
  getRemoteDisplayReason: () => ipcRenderer.invoke('ezrith:get-remote-display-reason'),
  uninstall: {
    summary: () => ipcRenderer.invoke('ezrith:uninstall:summary'),
    run: mode => ipcRenderer.invoke('ezrith:uninstall:run', { mode })
  },
  updates: {
    check: () => ipcRenderer.invoke('ezrith:updates:check'),
    apply: opts => ipcRenderer.invoke('ezrith:updates:apply', opts),
    getBranch: () => ipcRenderer.invoke('ezrith:updates:branch:get'),
    setBranch: name => ipcRenderer.invoke('ezrith:updates:branch:set', name),
    onProgress: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ezrith:updates:progress', listener)

      return () => ipcRenderer.removeListener('ezrith:updates:progress', listener)
    }
  },
  themes: {
    fetchMarketplace: id => ipcRenderer.invoke('ezrith:vscode-theme:fetch', id),
    searchMarketplace: query => ipcRenderer.invoke('ezrith:vscode-theme:search', query)
  },
  // Find-in-page (Ctrl/Cmd+F): delegates to Electron's
  // webContents.findInPage on the IPC sender's window so a Cmd+F pressed
  // in a secondary session window searches THAT window, not the primary.
  // `onFoundInPage` returns the unsubscribe fn; the renderer wires it via
  // `initFindInPageListener` in store/find-in-page.ts and tears it down
  // when the FindBar unmounts.
  findInPage: (query, options) => ipcRenderer.invoke('ezrith:find-in-page', query, options),
  stopFindInPage: () => ipcRenderer.invoke('ezrith:stop-find-in-page'),
  onFoundInPage: callback => {
    const listener = (_event, result) => callback(result)
    ipcRenderer.on('ezrith:found-in-page', listener)

    return () => ipcRenderer.removeListener('ezrith:found-in-page', listener)
  },
  // Main-process `before-input-event` forwards Ctrl/Cmd+F here so renderer
  // can open the FindBar even when the GTK compositor has already grabbed
  // the chord at the windowing layer (#81727).
  onOpenFindBarRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('ezrith:open-find-bar', listener)

    return () => ipcRenderer.removeListener('ezrith:open-find-bar', listener)
  }
})
