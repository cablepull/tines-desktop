# User Story 67: Grouped Team Selection (Personal vs Shared)

## 📋 Story Header
- **ID**: 67
- **Title**: Grouped Team Selection (Personal vs Shared)
- **Priority**: Medium
- **Status**: Completed (Phase 35)

## 👤 User Persona
As an organized Tines architect, I want to distinguish between my personal workspace and shared team environments in the workspace selector so that I don't accidentally create test flows in production teams.

## 🎯 Acceptance Criteria
1. The Team Selector dropdown must utilize `<optgroup>` labels to separate "Personal Space" from "Shared Teams".
2. The application must fetch personal workspaces using the `includePersonalTeams: true` API flag.
3. The Dashboard header must update its orientation message based on the selected workspace type.

## 📖 Description
Mirror the Tines web interface's organizational model by clearly segmenting personal vs collaborative workspaces in the primary navigation.
