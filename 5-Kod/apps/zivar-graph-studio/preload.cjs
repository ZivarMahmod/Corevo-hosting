const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, value) => ipcRenderer.invoke(channel, value);

contextBridge.exposeInMainWorld("zivarStudio", {
  bootstrap: () => invoke("studio:bootstrap"),
  loadLibraryProject: (slot, projectId) => invoke("studio:load-library-project", { slot, projectId }),
  pickProject: (slot) => invoke("studio:pick-project", { slot }),
  pickDataFile: (slot) => invoke("studio:pick-data-file", { slot }),
  loadGithub: (slot, url) => invoke("studio:load-github", { slot, url }),
  loadGithubBranch: (url, branch, base) => invoke("studio:load-github-branch", { url, branch, base }),
  pickBranchRepo: (branch, base) => invoke("studio:pick-branch-repo", { branch, base }),
  refreshProject: (slot) => invoke("studio:refresh-project", { slot }),
  getView: (request) => invoke("studio:get-view", request),
  getNode: (slot, id) => invoke("studio:get-node", { slot, id }),
  search: (slot, query) => invoke("studio:search", { slot, query }),
  compare: () => invoke("studio:compare"),
  comparisonGraph: (diffOnly = false) => invoke("studio:comparison-graph", { diffOnly }),
  branchImpact: () => invoke("studio:branch-impact"),
  simulate: (aId, bId) => invoke("studio:simulate", { aId, bId }),
  getActivity: (after) => invoke("studio:get-activity", { after }),
  saveImage: (dataUrl) => invoke("studio:save-image", { dataUrl }),
  exportReport: () => invoke("studio:export-report"),
  updateState: (state) => invoke("studio:update-state", state),
  onProgress: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on("studio:progress", wrapped);
    return () => ipcRenderer.removeListener("studio:progress", wrapped);
  },
});
