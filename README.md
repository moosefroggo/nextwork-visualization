# Git Workflow Visualizer

This simulator shows what happens when you stage files, commit, branch, merge, push, and pull in Git.

[Try the visualizer](https://moosefroggo.github.io/nextwork-visualization/)

## What you can do

- Run simulated `git add`, `commit`, `push`, `pull`, `checkout`, and `merge` actions
- See changes move between working files, staging, local branches, and the remote
- Watch the branch, commit, and sync state update after each action
- Read a plain-language explanation of each command
- Create and merge a feature branch
- Use sandbox mode to move changes yourself
- Change the animation speed, view the activity log, or reset the simulation

## Why I built it

Git can be hard to learn because you cannot see where your changes go. This project shows the effect of each command on a small example repository.

## How it works

An in-browser state machine tracks the example repository. JavaScript updates the diagram and animates changes along SVG paths. The available actions and activity log change with the repository state.

This is a teaching tool. It does not run Git commands or change a real repository.

## Stack

Vanilla JavaScript, CSS, SVG, and Vite.

## Run locally

```bash
npm install
npm run dev
```

To build it:

```bash
npm run build
```
