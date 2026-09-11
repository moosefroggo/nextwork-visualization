# Git Workflow Visualizer

An interactive simulator that makes Git's invisible state transitions visible—from working files to staging, local history, branches, and GitHub.

**[Open the live visualizer →](https://moosefroggo.github.io/nextwork-visualization/)**

## What you can explore

- Run simulated `git add`, `commit`, `push`, `pull`, `checkout`, and `merge` actions
- Watch animated packets travel between working files, staging, local branches, and the remote repository
- See branch, commit, file, and sync state update after every action
- Read a plain-language translation alongside each Git command
- Create an isolated feature branch and merge it back into `main`
- Switch to sandbox mode and move changes manually through valid paths
- Adjust animation speed, inspect the activity log, or reset the repository state

## Why I built it

Git is difficult to learn because its most important objects and transitions are invisible. This prototype turns the mental model into a manipulable system, connecting each command to both its destination and its effect on repository state.

## Implementation

The visualizer uses a small in-browser state machine. SVG paths connect each repository layer, while JavaScript calculates node geometry and animates packets along those paths. The UI derives action availability, metrics, and explanatory logs from the current simulated state.

This is an educational simulation: it does not execute Git commands or modify a real repository.

## Stack

- Vanilla JavaScript
- CSS animations and responsive SVG
- Vite

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```
