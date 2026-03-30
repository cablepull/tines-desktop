# User Story 65: Standardized Authentication (Bearer Tokens)

## 📋 Story Header
- **ID**: 65
- **Title**: Standardized Authentication (Bearer Tokens)
- **Priority**: High
- **Status**: Completed (Phase 33)

## 👤 User Persona
As a security-conscious Tines user, I want the IDE to use standard Authorization headers for all API requests so that I can maintain consistent access control across all tenant environments.

## 🎯 Acceptance Criteria
1. The application must replace the non-standard `X-User-Token` header with `Authorization: Bearer <token>`.
2. All SDK configurations across Dashboard, StoryView, and ActionsPage must be standardized.
3. API requests must return `200 OK` on tenants that strictly enforce Bearer authentication.

## 📖 Description
Ensure the IDE uses the modern Tines authentication standard (Bearer tokens) to avoid 401 Unauthorized errors caused by header conflicts with certain tenant configurations or service account keys.
